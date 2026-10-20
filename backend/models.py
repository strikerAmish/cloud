"""
RailSync - Domain Models & Pydantic v2 Schemas
Covers the OperationalEvent Aggregate Root, Stakeholders, Statutory Permits,
FSM Enums, and Request/Response Payloads.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class EventStatus(str, Enum):
    # 11-Stage FSM Core Lifecycle
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    DEPENDENCY_RESOLVED = "DEPENDENCY_RESOLVED"
    AWAITING_APPROVAL = "AWAITING_APPROVAL"
    APPROVED = "APPROVED"
    SCHEDULED = "SCHEDULED"
    ACTIVE_IN_PROGRESS = "ACTIVE_IN_PROGRESS"
    WORK_COMPLETED = "WORK_COMPLETED"
    SAFETY_VERIFIED = "SAFETY_VERIFIED"
    BLOCK_CLEARED = "BLOCK_CLEARED"
    AUDIT_LOCKED = "AUDIT_LOCKED"

    # Exception States & Safety Interrupts
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"
    ESCALATED_SLA = "ESCALATED_SLA"
    ABORTED_SAFETY_LOCK = "ABORTED_SAFETY_LOCK"


class Department(str, Enum):
    OPERATING = "OPERATING"
    OHE = "OHE"
    CIVIL_P_WAY = "CIVIL_P_WAY"
    S_AND_T = "S_AND_T"
    MECHANICAL_CW = "MECHANICAL_CW"


class ApprovalRole(str, Enum):
    TPC = "TPC"  # Traction Power Controller
    SECTION_CONTROLLER = "SECTION_CONTROLLER"  # Operating Section Controller
    STATION_MASTER = "STATION_MASTER"  # Station Master Interlocking & Points
    FIELD_SUPERVISOR = "FIELD_SUPERVISOR"  # Site OHE / P-Way SSE
    SAFETY_OFFICER = "SAFETY_OFFICER"


class PermitType(str, Enum):
    FORM3_PTW = "FORM3_PTW"  # Form3-PTW: Field Permit-to-Work with Earthing Rods
    ETR_3 = "ETR_3"  # Legacy alias for Form3-PTW
    ETR_1 = "ETR_1"  # Power Block Message (Traction de-energization)
    RECONNECTION = "RECONNECTION"  # Reconnection Memo & Restoration
    CIVIL_TRACK_BLOCK = "CIVIL_TRACK_BLOCK"
    POINT_CLAMP_MEMO = "POINT_CLAMP_MEMO"


class ApprovalStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


# -------------------------------------------------------------
# Impact Vector Model
# -------------------------------------------------------------
class ImpactVector(BaseModel):
    catenary_25kv_power_trip: bool = Field(True, description="25kV Catenary Power Trip required")
    absolute_traffic_block: bool = Field(True, description="Absolute Traffic Block on target line")
    speed_restriction_kmh: Optional[int] = Field(30, description="TSR (Temporary Speed Restriction) on adjacent track")
    feeding_posts: List[str] = Field(default_factory=lambda: ["FP-04", "FP-06"])
    points_clamping_required: bool = True
    track_bonding_notice: bool = True


# -------------------------------------------------------------
# Stakeholder & Permit Models
# -------------------------------------------------------------
class Stakeholder(BaseModel):
    id: str
    event_id: str
    department: Department
    role: ApprovalRole
    officer_id: str
    approval_status: ApprovalStatus = ApprovalStatus.PENDING
    signature_hash: Optional[str] = None
    signed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None


class StatutoryPermit(BaseModel):
    id: str
    event_id: str
    permit_type: str
    earthing_discharged: bool = False
    power_tripped: bool = False
    points_clamped: bool = False
    issued_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    officer_id: str
    notes: Optional[str] = None


# -------------------------------------------------------------
# Operational Event Payloads
# -------------------------------------------------------------
class OperationalEventCreate(BaseModel):
    division: str = Field("DNR", description="Division, e.g., DNR (Danapur)")
    section: str = Field("Danapur–Patna Junction", description="Section, e.g., Danapur–Patna Junction")
    track_id: str = Field("UP_MAIN", description="Target Track: UP_MAIN, DN_MAIN, YARD_01")
    km_start: float = Field(544.10, description="KM Start Geofence boundary")
    km_end: float = Field(545.80, description="KM End Geofence boundary")
    requested_start: datetime
    requested_end: datetime
    impact_vector: ImpactVector = Field(default_factory=ImpactVector)
    description: Optional[str] = "OHE Catenary Inspection and Contact Wire Replacement per ACTM Vol II Sec 20615"
    originator_id: str = "SSE_OHE_DNR_04"


class ApprovalRequest(BaseModel):
    department: Department
    role: ApprovalRole
    officer_id: str
    decision: ApprovalStatus = ApprovalStatus.APPROVED
    rejection_reason: Optional[str] = None
    signature_key: Optional[str] = "ed25519_cert_sim"


class WorkCompletionRequest(BaseModel):
    supervisor_id: str
    tools_cleared: bool = True
    earth_discharge_rods_removed: bool = True
    track_continuity_verified: bool = True
    completion_memo: str = "Work completed satisfactorily. All men and materials cleared from track."


class SafetyVerificationRequest(BaseModel):
    officer_id: str
    department: Department
    overhead_clearance_safe: bool = True
    points_restored: bool = True
    signals_interlocked: bool = True
    verification_memo: str = "Joint safety clearance completed. Track fit for resumption."


class EmergencyAbortRequest(BaseModel):
    officer_id: str
    reason: str
    immediate_power_isolate: bool = True


class OperationalEventResponse(BaseModel):
    id: str
    division: str
    section: str
    track_id: str
    km_start: float
    km_end: float
    status: EventStatus
    requested_start: datetime
    requested_end: datetime
    fencing_token: Optional[int] = None
    impact_vector: ImpactVector
    description: str
    originator_id: str
    stakeholders: List[Stakeholder] = []
    permits: List[StatutoryPermit] = []
    invariants: Optional[Dict[str, Any]] = None
    fsm_stage: int
    status_color: Optional[str] = None
    lock_info: Optional[Any] = None
    field_photo: Optional[Dict[str, Any]] = None
    piggybacked_depts: Optional[List[Dict[str, Any]]] = None
    station_actions: Optional[Dict[str, Any]] = None
    digital_permit: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime


# -------------------------------------------------------------
# Canary, SRE & Chaos Models
# -------------------------------------------------------------
class CanaryHealthResponse(BaseModel):
    status: str
    timestamp: datetime
    database: str
    redis_mesh: str
    active_events: int
    active_locks: int
    uptime_seconds: float
    version: str = "2.0.4"
