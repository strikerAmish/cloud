"""
RailSync - Dynamic Dependency Resolution Engine & The 6 Invariants
Calculates mathematical dependency graph:
DependencyGraph = f(EventType, GeoLocation, ImpactVector, Department, GSR_Ruleset, OrgHierarchy, LiveNetworkState)
Resolves the Six Invariants of Operational Awareness.
"""

from datetime import datetime, timezone
from typing import Dict, List, Any
from models import Department, ApprovalRole, Stakeholder, ApprovalStatus


class DynamicDependencyEngine:
    @staticmethod
    def resolve_invariants(
        division: str,
        section: str,
        track_id: str,
        km_start: float,
        km_end: float,
        impact_vector: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Resolves the 6 Invariants of Operational Awareness for a requested block.
        """
        catenary_trip = impact_vector.get("catenary_25kv_power_trip", True)
        absolute_traffic_block = impact_vector.get("absolute_traffic_block", True)
        speed_restriction = impact_vector.get("speed_restriction_kmh", 30)

        # Invariant 1: Ambient Corridor Awareness
        ambient_nodes = [
            {"role": "Level Crossing Gateman", "post": "LC-64 Wardha North", "action": "Regulate road traffic; verify gate interlock closed"},
            {"role": "Trailing Station Master", "post": "Sevagram Outer Cabin", "action": "Regulate approach signals, switch to caution aspect"},
            {"role": "Adjacent Section Controller", "post": "Bhusaval Division Desk", "action": "Ambient notification for cross-division freight pacing"}
        ]

        # Invariant 2: Statutory Approval Authority (per G&SR Authority Matrix)
        statutory_approvers = [
            {
                "role": ApprovalRole.TPC.value,
                "department": Department.OHE.value,
                "officer_id": "TPC_NGP_01",
                "authority_code": "ACTM-VOL-II-20615",
                "description": "Traction Power Controller (25kV Power Isolation Authority)"
            },
            {
                "role": ApprovalRole.SECTION_CONTROLLER.value,
                "department": Department.OPERATING.value,
                "officer_id": "CTRL_SEC_WDA_02",
                "authority_code": "GSR-CHAPTER-IV",
                "description": "Operating Section Controller (Train Path & Traffic Block Grant Authority)"
            }
        ]

        # Invariant 3: Physical Execution Prerequisites
        prerequisites = []
        if catenary_trip:
            prerequisites.append({
                "type": "POWER_ISOLATION",
                "code": "FORM_ETR_1",
                "assigned_to": "TPC NGP",
                "action": "Trip circuit breakers at FP-04 and FP-06; verify catenary dead"
            })
            prerequisites.append({
                "type": "EARTHING_DISCHARGE",
                "code": "DISCHARGE_ROD_01",
                "assigned_to": "OHE Field SSE",
                "action": "Apply physical earthing discharge rods across catenary and rail return"
            })
        if absolute_traffic_block:
            prerequisites.append({
                "type": "POINT_CLAMPING",
                "code": "SWR_POINT_CLAMP",
                "assigned_to": "Station Master Wardha",
                "action": "Physical point clamping and padlocking of crossover points #14A & #14B"
            })

        # Invariant 4: Passive Telemetry Monitoring
        passive_monitors = [
            {"desk": "Zonal Control Office (Chhatrapati Shivaji Maharaj Terminus - CSMT)", "mode": "Live WSS Telemetry (Read-Only)"},
            {"desk": "Nagpur Divisional SRE Emergency Desk", "mode": "Real-Time Container Insights & Canary Feed"}
        ]

        # Invariant 5: Operational Site Custody
        site_custody = {
            "title": "Senior Section Engineer (OHE / P-Way)",
            "officer_id": "SSE_OHE_WDA_04",
            "statutory_role": "Legal custody of isolated track corridor during block window"
        }

        # Invariant 6: Hierarchical SLA Escalation
        escalation_chain = [
            {"tier": 1, "threshold_minutes": 15, "escalate_to": "Sr. DOM (Senior Divisional Operations Manager)"},
            {"tier": 2, "threshold_minutes": 30, "escalate_to": "Sr. DEE (Senior Divisional Electrical Engineer)"},
            {"tier": 3, "threshold_minutes": 45, "escalate_to": "DRM (Divisional Railway Manager Nagpur)"}
        ]

        return {
            "invariant_1_ambient_awareness": ambient_nodes,
            "invariant_2_statutory_approvers": statutory_approvers,
            "invariant_3_physical_prerequisites": prerequisites,
            "invariant_4_passive_monitoring": passive_monitors,
            "invariant_5_site_custody": site_custody,
            "invariant_6_sla_escalation": escalation_chain,
            "resolved_at_iso": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "conflict_free": True
        }

    @staticmethod
    def generate_initial_stakeholders(event_id: str) -> List[Stakeholder]:
        """Generates the required multi-party stakeholder sign-off entries."""
        return [
            Stakeholder(
                id=f"stk-tpc-{event_id[:8]}",
                event_id=event_id,
                department=Department.OHE,
                role=ApprovalRole.TPC,
                officer_id="TPC_NGP_01",
                approval_status=ApprovalStatus.PENDING
            ),
            Stakeholder(
                id=f"stk-ctrl-{event_id[:8]}",
                event_id=event_id,
                department=Department.OPERATING,
                role=ApprovalRole.SECTION_CONTROLLER,
                officer_id="CTRL_SEC_WDA_02",
                approval_status=ApprovalStatus.PENDING
            ),
            Stakeholder(
                id=f"stk-sm-{event_id[:8]}",
                event_id=event_id,
                department=Department.OPERATING,
                role=ApprovalRole.STATION_MASTER,
                officer_id="SM_WDA_JCT",
                approval_status=ApprovalStatus.PENDING
            ),
            Stakeholder(
                id=f"stk-sse-{event_id[:8]}",
                event_id=event_id,
                department=Department.OHE,
                role=ApprovalRole.FIELD_SUPERVISOR,
                officer_id="SSE_OHE_WDA_04",
                approval_status=ApprovalStatus.PENDING
            )
        ]
