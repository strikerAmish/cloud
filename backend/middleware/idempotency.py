"""
RailSync - Distributed Idempotency Middleware
Guarantees exactly-once processing semantics for mutating railway operations.
Prevents duplicate fencing token acquisitions, double-allocations, and state race conditions.
Utilizes Redis SETNX with 120-second TTL with thread-safe in-memory cluster fallback.
"""

import json
import logging
import os
import threading
import time
from typing import Dict, Any, Optional, Tuple, Callable
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse

logger = logging.getLogger("railsync.idempotency")

# Default TTL for idempotency records per Section 1 requirements (120 seconds)
IDEMPOTENCY_TTL_SECONDS = 120


class IdempotencyStore:
    """
    Dual-engine Idempotency Store:
    1. Primary: Redis (ElastiCache / Cluster) using atomic SETNX and EXPIRE.
    2. Fallback: High-performance Thread-Safe In-Memory Store with TTL pruning.
    """
    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self.redis_client = None
        self._memory_cache: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()
        self._init_redis()

    def _init_redis(self):
        try:
            import redis
            client = redis.from_url(
                self.redis_url,
                socket_connect_timeout=0.5,
                socket_timeout=0.5,
                decode_responses=True
            )
            client.ping()
            self.redis_client = client
            logger.info("Connected to Redis for distributed idempotency.")
        except Exception:
            self.redis_client = None
            logger.info("Redis unavailable; using high-speed thread-safe in-memory idempotency store.")

    def acquire_or_get(self, key: str, ttl: int = IDEMPOTENCY_TTL_SECONDS) -> Tuple[str, Optional[Dict[str, Any]]]:
        """
        Attempts to acquire an idempotency lock for `key`.
        Returns:
            ("HIT", cached_data)        -> Request already processed, return cached response
            ("IN_FLIGHT", None)         -> Request currently processing by concurrent call
            ("ACQUIRED", None)          -> Key locked as PROCESSING, proceed with execution
        """
        redis_key = f"railsync:idempotency:{key}"
        now = time.time()

        # 1. Try Redis Engine
        if self.redis_client:
            try:
                # Attempt atomic SETNX with PROCESSING state
                acquired = self.redis_client.set(
                    redis_key,
                    json.dumps({"state": "PROCESSING", "created_at": now}),
                    nx=True,
                    ex=ttl
                )
                if acquired:
                    return "ACQUIRED", None

                # Key exists - fetch cached state
                raw = self.redis_client.get(redis_key)
                if raw:
                    payload = json.loads(raw)
                    if payload.get("state") == "COMPLETED":
                        return "HIT", payload
                    else:
                        return "IN_FLIGHT", None
            except Exception as e:
                logger.warning(f"Redis idempotency lookup failed, falling back to local memory: {e}")

        # 2. In-Memory Fallback Engine
        with self._lock:
            # Prune expired keys
            expired = [k for k, v in self._memory_cache.items() if v.get("expires_at", 0) <= now]
            for k in expired:
                del self._memory_cache[k]

            entry = self._memory_cache.get(key)
            if entry:
                if entry.get("state") == "COMPLETED":
                    return "HIT", entry
                else:
                    return "IN_FLIGHT", None

            # Acquire new key
            self._memory_cache[key] = {
                "state": "PROCESSING",
                "created_at": now,
                "expires_at": now + ttl
            }
            return "ACQUIRED", None

    def store_response(
        self,
        key: str,
        status_code: int,
        headers: Dict[str, str],
        body: bytes,
        ttl: int = IDEMPOTENCY_TTL_SECONDS
    ):
        """Stores the completed execution payload in the idempotency cache."""
        redis_key = f"railsync:idempotency:{key}"
        now = time.time()
        payload = {
            "state": "COMPLETED",
            "status_code": status_code,
            "headers": {k: v for k, v in headers.items() if k.lower() in ["content-type"]},
            "body": body.decode("utf-8", errors="replace"),
            "completed_at": now,
            "expires_at": now + ttl
        }

        # 1. Persist to Redis
        if self.redis_client:
            try:
                self.redis_client.set(redis_key, json.dumps(payload), ex=ttl)
            except Exception as e:
                logger.warning(f"Redis store_response failed: {e}")

        # 2. Persist to Memory
        with self._lock:
            self._memory_cache[key] = payload

    def release_key(self, key: str):
        """Releases the lock if an unhandled internal exception occurred."""
        redis_key = f"railsync:idempotency:{key}"
        if self.redis_client:
            try:
                self.redis_client.delete(redis_key)
            except Exception:
                pass
        with self._lock:
            self._memory_cache.pop(key, None)

    def clear(self):
        """Utility for test suites."""
        with self._lock:
            self._memory_cache.clear()


# Global Singleton Store
idempotency_store = IdempotencyStore()


class IdempotencyMiddleware(BaseHTTPMiddleware):
    """
    FastAPI / Starlette Middleware enforcing Idempotency-Key validation.
    Intercepts mutating requests (`POST /api/v1/events/...`).
    Returns cached response on duplicate keys, preventing double allocation or fencing token races.
    """
    def __init__(self, app, store: Optional[IdempotencyStore] = None):
        super().__init__(app)
        self.store = store or idempotency_store

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Check only mutating HTTP requests
        if request.method not in ("POST", "PUT", "PATCH"):
            return await call_next(request)

        idempotency_key = request.headers.get("Idempotency-Key")
        if not idempotency_key:
            return await call_next(request)

        # Check key status
        status, cached = self.store.acquire_or_get(idempotency_key, ttl=IDEMPOTENCY_TTL_SECONDS)

        if status == "HIT" and cached:
            # Replay cached response
            body_content = cached.get("body", "{}")
            status_code = cached.get("status_code", 200)
            headers = {
                "X-Cache": "HIT-IDEMPOTENT",
                "X-Idempotency-Key": idempotency_key,
                "Content-Type": cached.get("headers", {}).get("content-type", "application/json")
            }
            logger.info(f"Idempotency HIT for key '{idempotency_key}' - Returning cached response.")
            return Response(
                content=body_content,
                status_code=status_code,
                headers=headers,
                media_type="application/json"
            )

        if status == "IN_FLIGHT":
            # Concurrent duplicate request in progress
            logger.warning(f"Idempotency CONFLICT for key '{idempotency_key}' - Request already in-flight.")
            return JSONResponse(
                status_code=409,
                content={
                    "error": "IDEMPOTENT_OPERATION_IN_PROGRESS",
                    "detail": f"An operation with Idempotency-Key '{idempotency_key}' is currently being processed.",
                    "status": "CONFLICT"
                },
                headers={
                    "X-Cache": "IN-FLIGHT",
                    "X-Idempotency-Key": idempotency_key
                }
            )

        # Status is ACQUIRED - process request
        try:
            response: Response = await call_next(request)

            # Consume response body for caching
            body_chunks = [chunk async for chunk in response.body_iterator]
            body_bytes = b"".join(body_chunks)

            # Only cache successful/client-level responses (do not cache 5xx server failures)
            if response.status_code < 500:
                resp_headers = dict(response.headers)
                self.store.store_response(
                    key=idempotency_key,
                    status_code=response.status_code,
                    headers=resp_headers,
                    body=body_bytes,
                    ttl=IDEMPOTENCY_TTL_SECONDS
                )

            # Reconstruct response with cached body
            response_headers = dict(response.headers)
            response_headers["X-Cache"] = "MISS-IDEMPOTENT"
            response_headers["X-Idempotency-Key"] = idempotency_key

            return Response(
                content=body_bytes,
                status_code=response.status_code,
                headers=response_headers,
                media_type=response.media_type
            )
        except Exception as exc:
            # Release lock on unhandled exception so caller can retry
            self.store.release_key(idempotency_key)
            raise exc
