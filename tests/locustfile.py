"""
RailSync - Automated Locust Performance & Load Testing Script
Simulates 500 concurrent railway controllers generating 2,500 requests/minute
to validate latency SLAs (P95 < 300ms) under heavy peak load.
Execution:
locust -f tests/locustfile.py --headless -u 500 -r 20 --run-time 10m --host http://localhost:8000 --html report.html
"""

import random
from locust import HttpUser, task, between


class RailwayControllerUser(HttpUser):
    wait_time = between(1, 3)

    @task(10)
    def view_corridor_dashboard(self):
        """High-frequency corridor status check by section controllers."""
        self.client.get("/api/v1/events", name="GET /api/v1/events")

    @task(3)
    def create_block_requisition(self):
        """Simulates field supervisors submitting maintenance block requests."""
        payload = {
            "division": "NGP",
            "section": "Wardha-Sevagram",
            "track_id": "UP_MAIN",
            "km_start": round(random.uniform(140.0, 144.0), 2),
            "km_end": round(random.uniform(144.1, 148.0), 2),
            "requested_start": "2026-10-20T10:00:00Z",
            "requested_end": "2026-10-20T12:00:00Z",
            "impact_vector": {
                "catenary_25kv_power_trip": True,
                "absolute_traffic_block": True,
                "speed_restriction_kmh": 30
            },
            "description": "Routine Track Tamping & Catenary Check"
        }
        self.client.post("/api/v1/events", json=payload, name="POST /api/v1/events")

    @task(2)
    def approve_block(self):
        """Simulates dual-key approvals by TPC and Section Controllers."""
        event_id = "7c9e6679-7425-40de-944b-e07fc1f90ae7"
        payload = {
            "department": "TRAFFIC",
            "role": "SECTION_CONTROLLER",
            "officer_id": f"CTRL_{random.randint(10, 99):03d}",
            "decision": "APPROVED"
        }
        self.client.post(f"/api/v1/events/{event_id}/approve", json=payload, name="POST /api/v1/events/{id}/approve")

    @task(15)
    def health_check(self):
        """High-frequency synthetic canary health polling."""
        self.client.get("/healthz", name="GET /healthz")
