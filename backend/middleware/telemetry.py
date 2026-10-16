"""
RailSync - OpenTelemetry W3C Traceparent Propagation & AWS X-Ray Telemetry Middleware
Enforces end-to-end distributed tracing across microservices, WebSocket streams, and AWS X-Ray.
Specification: W3C Trace Context (RFC 00-{trace_id}-{parent_id}-{trace_flags}).
"""

import json
import logging
import os
import re
import secrets
import time
import uuid
from datetime import datetime, timezone
from typing import Optional, Tuple, Dict, Any, Callable
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("railsync.telemetry")

# W3C Traceparent regex: 00-{32 hex}-{16 hex}-{2 hex}
W3C_TRACEPARENT_REGEX = re.compile(r"^00-([0-9a-fA-F]{32})-([0-9a-fA-F]{16})-([0-9a-fA-F]{2})$")


def generate_trace_id() -> str:
    """Generates a valid 128-bit (32 hex characters) W3C trace ID."""
    return secrets.token_hex(16)


def generate_span_id() -> str:
    """Generates a valid 64-bit (16 hex characters) W3C span ID."""
    return secrets.token_hex(8)


def parse_or_create_traceparent(raw_header: Optional[str]) -> Tuple[str, str, str, str]:
    """
    Parses an incoming W3C traceparent header or initializes a new root trace context.
    Returns:
        (traceparent, trace_id, span_id, parent_span_id)
    """
    if raw_header:
        raw_header = raw_header.strip()
        match = W3C_TRACEPARENT_REGEX.match(raw_header)
        if match:
            trace_id = match.group(1).lower()
            parent_span_id = match.group(2).lower()
            flags = match.group(3).lower()
            # Generate new child span for current processing context
            new_span_id = generate_span_id()
            traceparent = f"00-{trace_id}-{new_span_id}-{flags}"
            return traceparent, trace_id, new_span_id, parent_span_id

    # Generate new root trace context
    trace_id = generate_trace_id()
    new_span_id = generate_span_id()
    flags = "01"  # Sampled
    traceparent = f"00-{trace_id}-{new_span_id}-{flags}"
    return traceparent, trace_id, new_span_id, ""


def format_aws_xray_trace_id(trace_id: str, span_id: str) -> str:
    """
    Formats W3C trace ID to AWS X-Ray Root header:
    Root=1-{8 hex timestamp}-{24 hex trace ID};Parent={span_id};Sampled=1
    """
    hex_timestamp = f"{int(time.time()):08x}"
    xray_id = trace_id[:24]
    return f"Root=1-{hex_timestamp}-{xray_id};Parent={span_id};Sampled=1"


class TelemetryMiddleware(BaseHTTPMiddleware):
    """
    FastAPI / Starlette Middleware extracting and injecting W3C Trace Context.
    Propagates traceparent across headers, logs structured JSON, and integrates with AWS X-Ray.
    """
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.perf_counter()

        raw_traceparent = request.headers.get("traceparent")
        traceparent, trace_id, span_id, parent_span_id = parse_or_create_traceparent(raw_traceparent)

        # Store in request state for downstream handlers and audit ledgers
        request.state.traceparent = traceparent
        request.state.trace_id = trace_id
        request.state.span_id = span_id
        request.state.parent_span_id = parent_span_id

        # Execute downstream request pipeline
        response: Response = await call_next(request)
        duration_ms = (time.perf_counter() - start_time) * 1000

        # Inject tracing headers into response
        response.headers["traceparent"] = traceparent
        response.headers["X-Trace-ID"] = trace_id
        response.headers["X-Span-ID"] = span_id
        response.headers["X-Amzn-Trace-Id"] = format_aws_xray_trace_id(trace_id, span_id)
        response.headers["X-Response-Time-Ms"] = f"{duration_ms:.2f}"

        # Structured JSON Log with W3C Trace IDs
        client_ip = request.client.host if request.client else "unknown"
        log_payload = {
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "traceparent": traceparent,
            "trace_id": trace_id,
            "span_id": span_id,
            "parent_span_id": parent_span_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "latency_ms": round(duration_ms, 2),
            "client_ip": client_ip
        }
        logger.info(json.dumps(log_payload))

        return response


def get_current_trace_context(request: Request) -> Dict[str, str]:
    """Helper for endpoints to retrieve current W3C trace identifiers."""
    return {
        "traceparent": getattr(request.state, "traceparent", ""),
        "trace_id": getattr(request.state, "trace_id", ""),
        "span_id": getattr(request.state, "span_id", "")
    }
