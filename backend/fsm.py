"""
RailSync - 11-Stage Finite State Machine (FSM) Lifecycle Engine
Governs operational lifecycle, statutory sequence enforcement per ACTM & G&SR,
and safety exception interrupts.
"""

from typing import Dict, List, Optional, Tuple, Any
from models import EventStatus, ApprovalStatus, ApprovalRole, Department


STAGE_MAPPING: Dict[EventStatus, int] = {
    EventStatus.DRAFT: 1,
    EventStatus.SUBMITTED: 2,
    EventStatus.DEPENDENCY_RESOLVED: 3,
    EventStatus.AWAITING_APPROVAL: 4,
    EventStatus.APPROVED: 5,
    EventStatus.SCHEDULED: 6,
    EventStatus.ACTIVE_IN_PROGRESS: 7,
    EventStatus.WORK_COMPLETED: 8,
    EventStatus.SAFETY_VERIFIED: 9,
    EventStatus.BLOCK_CLEARED: 10,
    EventStatus.AUDIT_LOCKED: 11,
    # Exception states mapped to negative or high indices
    EventStatus.REJECTED: 90,
    EventStatus.CANCELLED: 91,
    EventStatus.ESCALATED_SLA: 92,
    EventStatus.ABORTED_SAFETY_LOCK: 99,
}

STATUS_COLOR_MAP: Dict[EventStatus, str] = {
    EventStatus.DRAFT: "#718096",               # Gray
    EventStatus.SUBMITTED: "#3182CE",           # Blue
    EventStatus.DEPENDENCY_RESOLVED: "#2B6CB0", # Darker Blue
    EventStatus.AWAITING_APPROVAL: "#DD6B20",   # Amber
    EventStatus.APPROVED: "#4C51BF",            # Indigo
    EventStatus.SCHEDULED: "#805AD5",           # Purple / Fenced Token Locked
    EventStatus.ACTIVE_IN_PROGRESS: "#38A169",  # Green
    EventStatus.WORK_COMPLETED: "#D69E2E",      # Yellow
    EventStatus.SAFETY_VERIFIED: "#319795",     # Teal
    EventStatus.BLOCK_CLEARED: "#00A3C4",       # Cyan
    EventStatus.AUDIT_LOCKED: "#1A365D",        # Dark Indigo / Immutable
    EventStatus.REJECTED: "#E53E3E",            # Red
    EventStatus.CANCELLED: "#718096",           # Muted Gray
    EventStatus.ESCALATED_SLA: "#9B2C2C",       # Dark Red
    EventStatus.ABORTED_SAFETY_LOCK: "#E53E3E", # Bright Red Emergency
}


class RailwayFSM:
    @staticmethod
    def get_stage_number(status: EventStatus) -> int:
        return STAGE_MAPPING.get(status, 1)

    @staticmethod
    def get_color(status: EventStatus) -> str:
        return STATUS_COLOR_MAP.get(status, "#718096")

    @staticmethod
    def validate_transition(
        current_status: EventStatus,
        target_status: EventStatus,
        event_data: Dict[str, Any]
    ) -> Tuple[bool, Optional[str]]:
        """
        Validates if transitioning from current_status to target_status is valid
        per statutory railway safety regulations.
        """
        # Universal emergency safety interlock can be triggered from active work
        if target_status == EventStatus.ABORTED_SAFETY_LOCK:
            if current_status in [EventStatus.ACTIVE_IN_PROGRESS, EventStatus.SCHEDULED, EventStatus.APPROVED]:
                return True, None
            return False, f"Cannot trigger Emergency Safety Abort from state '{current_status.value}'"

        # Universal SLA Escalation can occur during pending approvals
        if target_status == EventStatus.ESCALATED_SLA:
            if current_status in [EventStatus.SUBMITTED, EventStatus.AWAITING_APPROVAL]:
                return True, None
            return False, f"SLA Escalation only valid during pending approvals, currently in '{current_status.value}'"

        # Sequential Statutory Lifecycle
        valid_transitions = {
            EventStatus.DRAFT: [EventStatus.SUBMITTED, EventStatus.CANCELLED],
            EventStatus.SUBMITTED: [EventStatus.DEPENDENCY_RESOLVED, EventStatus.REJECTED, EventStatus.CANCELLED],
            EventStatus.DEPENDENCY_RESOLVED: [EventStatus.AWAITING_APPROVAL, EventStatus.REJECTED, EventStatus.CANCELLED],
            EventStatus.AWAITING_APPROVAL: [EventStatus.APPROVED, EventStatus.REJECTED, EventStatus.ESCALATED_SLA],
            EventStatus.APPROVED: [EventStatus.SCHEDULED, EventStatus.ABORTED_SAFETY_LOCK, EventStatus.CANCELLED],
            EventStatus.SCHEDULED: [EventStatus.ACTIVE_IN_PROGRESS, EventStatus.ABORTED_SAFETY_LOCK, EventStatus.CANCELLED],
            EventStatus.ACTIVE_IN_PROGRESS: [EventStatus.WORK_COMPLETED, EventStatus.ABORTED_SAFETY_LOCK],
            EventStatus.WORK_COMPLETED: [EventStatus.SAFETY_VERIFIED, EventStatus.ABORTED_SAFETY_LOCK],
            EventStatus.SAFETY_VERIFIED: [EventStatus.BLOCK_CLEARED],
            EventStatus.BLOCK_CLEARED: [EventStatus.AUDIT_LOCKED],
            EventStatus.AUDIT_LOCKED: [],  # Terminal immutable state
        }

        allowed = valid_transitions.get(current_status, [])
        if target_status not in allowed:
            return False, f"Illegal state transition from '{current_status.value}' to '{target_status.value}'"

        # Additional Statutory Guard Conditions
        if target_status == EventStatus.APPROVED:
            stakeholders = event_data.get("stakeholders", [])
            tpc_approved = any(
                s.get("role") == ApprovalRole.TPC.value and s.get("approval_status") == ApprovalStatus.APPROVED.value
                for s in stakeholders
            )
            ctrl_approved = any(
                s.get("role") == ApprovalRole.SECTION_CONTROLLER.value and s.get("approval_status") == ApprovalStatus.APPROVED.value
                for s in stakeholders
            )
            if not (tpc_approved and ctrl_approved):
                return False, "Dual-Key Sign-off Incomplete: Both TPC and Section Controller must formally approve per G&SR."

        if target_status == EventStatus.ACTIVE_IN_PROGRESS:
            permits = event_data.get("permits", [])
            has_etr1 = any(p.get("permit_type") == "ETR_1" for p in permits)
            has_etr3 = any(p.get("permit_type") == "ETR_3" for p in permits)
            if not (has_etr1 and has_etr3):
                return False, "Safety Prerequisite Incomplete: Active work requires Traction Isolation (ETR-1) and Field Permit-to-Work (ETR-3)."

        return True, None
