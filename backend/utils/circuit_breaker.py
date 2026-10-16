"""
RailSync - Resilience Engine & 3-State Circuit Breaker
Protects internal railway operations from external legacy CRIS (COA/FOIS) latency and failures.
3-State FSM: CLOSED -> OPEN -> HALF-OPEN.
Thresholds:
  - Failure rate > 50% over rolling 30-second window
  - P95 latency > 2,000ms over rolling 30-second window
Graceful Fallback:
  - Dead Letter Queue (DLQ) asynchronous buffering to eliminate thread starvation.
"""

import asyncio
import inspect
import logging
import math
import threading
import time
import uuid
from enum import Enum
from typing import Dict, List, Any, Optional, Callable, Union

logger = logging.getLogger("railsync.circuit_breaker")


class CircuitState(str, Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


class CallMetric:
    __slots__ = ("timestamp", "duration_ms", "success")

    def __init__(self, timestamp: float, duration_ms: float, success: bool):
        self.timestamp = timestamp
        self.duration_ms = duration_ms
        self.success = success


class DeadLetterQueue:
    """Thread-safe Dead Letter Queue (DLQ) for failed legacy external sync operations."""
    def __init__(self, maxsize: int = 10000):
        self._queue: List[Dict[str, Any]] = []
        self._lock = threading.Lock()
        self.maxsize = maxsize

    def enqueue(self, system: str, payload: Dict[str, Any], reason: str) -> str:
        dlq_id = f"DLQ-{uuid.uuid4().hex[:12]}"
        record = {
            "dlq_id": dlq_id,
            "system": system,
            "payload": payload,
            "reason": reason,
            "timestamp": time.time(),
            "retries": 0,
            "status": "QUEUED"
        }
        with self._lock:
            if len(self._queue) >= self.maxsize:
                self._queue.pop(0)  # Evict oldest if full
            self._queue.append(record)
        logger.warning(f"DLQ Enqueued [{system}] {dlq_id}: {reason}")
        return dlq_id

    def size(self) -> int:
        with self._lock:
            return len(self._queue)

    def get_all(self) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self._queue)

    def drain(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._lock:
            items = self._queue[:limit]
            self._queue = self._queue[limit:]
            return items

    def clear(self):
        with self._lock:
            self._queue.clear()


class CircuitBreakerOpenException(Exception):
    """Raised when an operation is attempted while the circuit breaker is in OPEN state."""
    pass


class CircuitBreaker:
    """
    Production-grade 3-state Circuit Breaker with rolling 30s window statistics,
    P95 latency tracking, and DLQ fallback.
    """
    def __init__(
        self,
        name: str = "CRIS_SYNC",
        failure_rate_threshold: float = 0.50,  # 50%
        p95_latency_threshold_ms: float = 2000.0,  # 2,000ms
        rolling_window_seconds: float = 30.0,
        recovery_timeout_seconds: float = 15.0,
        min_throughput_samples: int = 5,
        half_open_success_trials: int = 2,
        dlq: Optional[DeadLetterQueue] = None
    ):
        self.name = name
        self.failure_rate_threshold = failure_rate_threshold
        self.p95_latency_threshold_ms = p95_latency_threshold_ms
        self.rolling_window_seconds = rolling_window_seconds
        self.recovery_timeout_seconds = recovery_timeout_seconds
        self.min_throughput_samples = min_throughput_samples
        self.half_open_success_trials = half_open_success_trials

        self.state = CircuitState.CLOSED
        self.opened_at: Optional[float] = None
        self.half_open_successes: int = 0
        self.metrics: List[CallMetric] = []
        self._lock = threading.Lock()
        self.dlq = dlq or DeadLetterQueue()

    def _prune_metrics(self, now: float):
        cutoff = now - self.rolling_window_seconds
        self.metrics = [m for m in self.metrics if m.timestamp >= cutoff]

    def _calculate_metrics(self) -> Dict[str, Any]:
        now = time.time()
        self._prune_metrics(now)
        total = len(self.metrics)
        if total == 0:
            return {
                "total": 0,
                "failures": 0,
                "failure_rate": 0.0,
                "p95_latency_ms": 0.0,
                "avg_latency_ms": 0.0
            }

        failures = sum(1 for m in self.metrics if not m.success)
        rate = failures / total

        latencies = sorted(m.duration_ms for m in self.metrics)
        p95_index = min(math.ceil(0.95 * total) - 1, total - 1)
        p95 = latencies[max(0, p95_index)]
        avg = sum(latencies) / total

        return {
            "total": total,
            "failures": failures,
            "failure_rate": round(rate, 4),
            "p95_latency_ms": round(p95, 2),
            "avg_latency_ms": round(avg, 2)
        }

    def _check_and_update_state(self, now: float):
        """Evaluates state transitions based on time and metrics."""
        if self.state == CircuitState.OPEN:
            if self.opened_at and (now - self.opened_at) >= self.recovery_timeout_seconds:
                logger.info(f"[{self.name}] Cooldown elapsed ({self.recovery_timeout_seconds}s). Transitioning OPEN -> HALF_OPEN.")
                self.state = CircuitState.HALF_OPEN
                self.half_open_successes = 0

        elif self.state == CircuitState.CLOSED:
            stats = self._calculate_metrics()
            if stats["total"] >= self.min_throughput_samples:
                # Trip check 1: Failure rate > 50%
                if stats["failure_rate"] > self.failure_rate_threshold:
                    self._trip_to_open(
                        f"Failure rate {stats['failure_rate']*100:.1f}% exceeded threshold {self.failure_rate_threshold*100:.1f}%"
                    )
                # Trip check 2: P95 latency > 2,000ms
                elif stats["p95_latency_ms"] > self.p95_latency_threshold_ms:
                    self._trip_to_open(
                        f"P95 latency {stats['p95_latency_ms']:.1f}ms exceeded threshold {self.p95_latency_threshold_ms:.1f}ms"
                    )

    def _trip_to_open(self, reason: str):
        self.state = CircuitState.OPEN
        self.opened_at = time.time()
        logger.error(f"[{self.name}] CIRCUIT BREAKER TRIPPED -> OPEN. Reason: {reason}")

    def record_call(self, duration_ms: float, success: bool):
        with self._lock:
            now = time.time()
            self.metrics.append(CallMetric(now, duration_ms, success))

            if self.state == CircuitState.HALF_OPEN:
                if success:
                    self.half_open_successes += 1
                    if self.half_open_successes >= self.half_open_success_trials:
                        logger.info(f"[{self.name}] HALF_OPEN trials passed ({self.half_open_successes}). Transitioning -> CLOSED.")
                        self.state = CircuitState.CLOSED
                        self.opened_at = None
                        self.half_open_successes = 0
                else:
                    self._trip_to_open("Failed trial execution in HALF_OPEN state.")
            else:
                self._check_and_update_state(now)

    def can_execute(self) -> bool:
        with self._lock:
            now = time.time()
            self._check_and_update_state(now)
            return self.state in (CircuitState.CLOSED, CircuitState.HALF_OPEN)

    def execute_with_fallback(
        self,
        func: Callable,
        *args,
        payload_for_dlq: Optional[Dict[str, Any]] = None,
        system_name: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Synchronous execution with automatic DLQ fallback.
        Never raises CircuitBreakerOpenException; safely buffers into DLQ.
        """
        system = system_name or self.name
        dlq_payload = payload_for_dlq or {"args": str(args), "kwargs": str(kwargs)}

        if not self.can_execute():
            # Circuit is OPEN - fallback to DLQ
            dlq_id = self.dlq.enqueue(
                system=system,
                payload=dlq_payload,
                reason=f"Circuit Breaker {self.name} is OPEN (P95/Error threshold tripped)"
            )
            return {
                "status": "QUEUED_DLQ",
                "circuit_state": self.state.value,
                "dlq_id": dlq_id,
                "message": f"Operation queued to DLQ. Local railway operations unaffected.",
                "executed_live": False
            }

        start = time.perf_counter()
        try:
            result = func(*args, **kwargs)
            duration_ms = (time.perf_counter() - start) * 1000
            self.record_call(duration_ms, success=True)
            return {
                "status": "SUCCESS",
                "circuit_state": self.state.value,
                "result": result,
                "latency_ms": round(duration_ms, 2),
                "executed_live": True
            }
        except Exception as exc:
            duration_ms = (time.perf_counter() - start) * 1000
            self.record_call(duration_ms, success=False)
            dlq_id = self.dlq.enqueue(
                system=system,
                payload=dlq_payload,
                reason=f"Execution error: {str(exc)}"
            )
            return {
                "status": "FALLBACK_DLQ",
                "circuit_state": self.state.value,
                "dlq_id": dlq_id,
                "error": str(exc),
                "message": "Call failed; gracefully enqueued to DLQ.",
                "executed_live": False
            }

    async def execute_async_with_fallback(
        self,
        coro_func: Callable,
        *args,
        payload_for_dlq: Optional[Dict[str, Any]] = None,
        system_name: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Asynchronous execution with automatic DLQ fallback.
        """
        system = system_name or self.name
        dlq_payload = payload_for_dlq or {"args": str(args), "kwargs": str(kwargs)}

        if not self.can_execute():
            dlq_id = self.dlq.enqueue(
                system=system,
                payload=dlq_payload,
                reason=f"Circuit Breaker {self.name} is OPEN"
            )
            return {
                "status": "QUEUED_DLQ",
                "circuit_state": self.state.value,
                "dlq_id": dlq_id,
                "message": "Operation queued to DLQ. Local railway operations unaffected.",
                "executed_live": False
            }

        start = time.perf_counter()
        try:
            result = await coro_func(*args, **kwargs)
            duration_ms = (time.perf_counter() - start) * 1000
            self.record_call(duration_ms, success=True)
            return {
                "status": "SUCCESS",
                "circuit_state": self.state.value,
                "result": result,
                "latency_ms": round(duration_ms, 2),
                "executed_live": True
            }
        except Exception as exc:
            duration_ms = (time.perf_counter() - start) * 1000
            self.record_call(duration_ms, success=False)
            dlq_id = self.dlq.enqueue(
                system=system,
                payload=dlq_payload,
                reason=f"Execution error: {str(exc)}"
            )
            return {
                "status": "FALLBACK_DLQ",
                "circuit_state": self.state.value,
                "dlq_id": dlq_id,
                "error": str(exc),
                "message": "Async call failed; gracefully enqueued to DLQ.",
                "executed_live": False
            }

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            stats = self._calculate_metrics()
            return {
                "circuit_name": self.name,
                "state": self.state.value,
                "failure_rate_threshold": self.failure_rate_threshold,
                "p95_latency_threshold_ms": self.p95_latency_threshold_ms,
                "rolling_window_seconds": self.rolling_window_seconds,
                "metrics": stats,
                "dlq_backlog_size": self.dlq.size()
            }

    def reset(self):
        with self._lock:
            self.state = CircuitState.CLOSED
            self.opened_at = None
            self.half_open_successes = 0
            self.metrics.clear()
            self.dlq.clear()


# -------------------------------------------------------------
# CRIS (COA / FOIS) Legacy Integration Client
# -------------------------------------------------------------
class CRISIntegrationClient:
    """
    Client for synchronizing with Indian Railways Centralised Railway Information System:
      - COA: Control Office Application
      - FOIS: Freight Operating Information System
    Protected by 3-state Circuit Breaker with Dead Letter Queue.
    """
    def __init__(self, breaker: Optional[CircuitBreaker] = None):
        self.breaker = breaker or CircuitBreaker(
            name="CRIS_LEGACY_GATEWAY",
            failure_rate_threshold=0.50,
            p95_latency_threshold_ms=2000.0,
            rolling_window_seconds=30.0,
            recovery_timeout_seconds=15.0,
            min_throughput_samples=5
        )

    def sync_block_to_coa(self, event_id: str, block_details: Dict[str, Any], simulate_fail: bool = False, latency_s: float = 0.05) -> Dict[str, Any]:
        """Syncs approved track block requisition to CRIS COA."""
        def _mock_coa_remote_call():
            if latency_s > 0:
                time.sleep(latency_s)
            if simulate_fail:
                raise TimeoutError("CRIS COA mainframe gateway timeout (504 Gateway Time-out)")
            return {
                "coa_reference_id": f"COA-CR-NGP-{int(time.time())}",
                "status": "ACKNOWLEDGED_BY_COA",
                "synced_at": time.time()
            }

        payload = {"event_id": event_id, "block_details": block_details}
        return self.breaker.execute_with_fallback(
            _mock_coa_remote_call,
            payload_for_dlq=payload,
            system_name="CRIS_COA"
        )

    def sync_train_advisory_fois(self, train_id: str, speed_restriction_kmh: int, simulate_fail: bool = False, latency_s: float = 0.05) -> Dict[str, Any]:
        """Syncs speed restriction / caution orders to CRIS FOIS."""
        def _mock_fois_remote_call():
            if latency_s > 0:
                time.sleep(latency_s)
            if simulate_fail:
                raise ConnectionResetError("CRIS FOIS TCP connection reset by peer")
            return {
                "fois_notice_id": f"FOIS-CAUTION-{train_id}-{int(time.time())}",
                "status": "ACCEPTED_BY_FOIS",
                "restriction_kmh": speed_restriction_kmh
            }

        payload = {"train_id": train_id, "speed_restriction_kmh": speed_restriction_kmh}
        return self.breaker.execute_with_fallback(
            _mock_fois_remote_call,
            payload_for_dlq=payload,
            system_name="CRIS_FOIS"
        )

    def get_telemetry(self) -> Dict[str, Any]:
        return self.breaker.get_status()

    def drain_dlq(self, limit: int = 50) -> List[Dict[str, Any]]:
        return self.breaker.dlq.drain(limit)


# Global singleton client
cris_client = CRISIntegrationClient()
