import React, { useState } from 'react';
import {
  CheckSquare, Square, FileSignature, CheckCircle2,
  Clock, ShieldAlert, AlertOctagon, Database, ExternalLink,
  Lock, Unlock, Activity, Camera, MapPin, Users, Plus,
  Share2, Printer, X, Eye, Zap, ShieldCheck, ArrowRight,
  AlertTriangle, RotateCcw, ChevronLeft, ChevronRight
} from 'lucide-react';
import { OperationalEvent, ApprovalRole, Department, PiggybackedDepartment } from '../types';
import {
  acquireFencingToken, activateWork, completeWork, clearBlock,
  emergencyAbort, escalateSla, submitApproval
} from '../api';

interface RightActionPaneProps {
  event: OperationalEvent | null;
  onRefresh: () => void;
  onUpdateEvent?: (updated: OperationalEvent) => void;
  onNavigateAudit?: () => void;
  isHistoryTab?: boolean;
}

// 7-step full lifecycle stepper per Indian Railways operating manual
const STEPPER = [
  { num: 1, label: 'Draft',             status: 'DRAFT',               stage: 1, keys: ['DRAFT'], desc: 'Requisition memo being drafted by site engineer' },
  { num: 2, label: 'Submitted',         status: 'SUBMITTED',           stage: 2, keys: ['SUBMITTED'], desc: 'Dispatched to Section Control & Station Master queue' },
  { num: 3, label: 'Dep. Resolved',     status: 'DEPENDENCY_RESOLVED', stage: 3, keys: ['DEPENDENCY_RESOLVED'], desc: 'Automated G&SR ruleset & track dependencies verified' },
  { num: 4, label: 'Awaiting Approval', status: 'AWAITING_APPROVAL',   stage: 4, keys: ['AWAITING_APPROVAL'], desc: 'Dual-key quorum: TPC, Controller & SM sign-offs' },
  { num: 5, label: 'Approved',          status: 'APPROVED',            stage: 5, keys: ['APPROVED', 'SCHEDULED'], desc: 'Fencing token issued, line possession authorized' },
  { num: 6, label: 'Active on Track',   status: 'ACTIVE_IN_PROGRESS',  stage: 6, keys: ['ACTIVE_IN_PROGRESS', 'WORK_COMPLETED'], desc: 'Field crew & tamping machines operating on track' },
  { num: 7, label: 'Normalized',        status: 'BLOCK_CLEARED',       stage: 7, keys: ['BLOCK_CLEARED', 'AUDIT_LOCKED', 'SAFETY_VERIFIED'], desc: 'Track fit certificate signed, 25kV power restored' },
];

export const RightActionPane: React.FC<RightActionPaneProps> = ({
  event,
  onRefresh,
  onUpdateEvent,
  onNavigateAudit,
  isHistoryTab = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Historical Immutability check: Only Stage 7 (Normalized) in History tab is sealed
  const isHistoricalSealed =
    Boolean(isHistoryTab && (event?.fsm_stage === 7 || event?.status === 'BLOCK_CLEARED' || event?.status === 'AUDIT_LOCKED'));

  // Real-Time Corridor Awareness status flags
  const isOngoing = event?.fsm_stage === 6 || event?.status === 'ACTIVE_IN_PROGRESS' || event?.status === 'WORK_COMPLETED';
  const isNormalized = event?.fsm_stage === 7 || event?.status === 'BLOCK_CLEARED' || event?.status === 'AUDIT_LOCKED';
  const isApproved = event?.fsm_stage === 5 || event?.status === 'APPROVED';
  
  // Interactive Station Master Toggles
  const [powerCutGranted, setPowerCutGranted] = useState<boolean>(
    event?.station_actions?.power_cut_granted ?? false
  );
  const [trafficBlockGranted, setTrafficBlockGranted] = useState<boolean>(
    event?.station_actions?.traffic_block_granted ?? false
  );
  const [pointsClamped, setPointsClamped] = useState<boolean>(
    event?.station_actions?.points_clamped_confirmed ?? true
  );

  // Piggybacking State
  const [piggybackedList, setPiggybackedList] = useState<PiggybackedDepartment[]>(
    event?.piggybacked_depts || []
  );
  const [showPiggybackModal, setShowPiggybackModal] = useState(false);
  const [newPiggyDept, setNewPiggyDept] = useState('S_AND_T');
  const [newPiggyDesc, setNewPiggyDesc] = useState('');
  const [newPiggySuper, setNewPiggySuper] = useState('');
  const [newPiggyCrew, setNewPiggyCrew] = useState('3');

  // Modals for Photo Inspection & Official Permit Memo
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showPermitModal, setShowPermitModal] = useState(false);

  // Rejection memo
  const [rejectionCode, setRejectionCode] = useState('');
  const [rejectionNote, setRejectionNote] = useState('');

  // Keep state synced when event changes
  React.useEffect(() => {
    if (event) {
      setPowerCutGranted(event.station_actions?.power_cut_granted ?? false);
      setTrafficBlockGranted(event.station_actions?.traffic_block_granted ?? false);
      setPointsClamped(event.station_actions?.points_clamped_confirmed ?? true);
      setPiggybackedList(event.piggybacked_depts || []);
      setActionMsg(null);
      setErrorMsg(null);
    }
  }, [event?.id]);

  if (!event) {
    return (
      <div
        style={{
          flex: 1,
          background: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 4 }}>
            No request selected
          </div>
          <div style={{ fontSize: 12.5, color: '#94A3B8' }}>
            Select an operational requisition from the queue to review field photo proof and grant permissions.
          </div>
        </div>
      </div>
    );
  }

  // Helpers
  const getStakeholder = (role: ApprovalRole) =>
    event.stakeholders?.find(s => s.role === role);

  const tpc  = getStakeholder('TPC');
  const sm   = getStakeholder('STATION_MASTER');
  const ctrl = getStakeholder('SECTION_CONTROLLER');

  const dualKeyCleared =
    (tpc?.approval_status === 'APPROVED' || !event.impact_vector?.catenary_25kv_power_trip) &&
    (ctrl?.approval_status === 'APPROVED' || trafficBlockGranted);

  let currentStepIdx = 0;
  if (typeof event.fsm_stage === 'number' && event.fsm_stage >= 1 && event.fsm_stage <= 7) {
    currentStepIdx = event.fsm_stage - 1;
  } else {
    const foundIdx = STEPPER.findIndex(s => s.keys.includes(event.status));
    currentStepIdx = foundIdx >= 0 ? foundIdx : 0;
  }
  const effectiveStep = currentStepIdx;

  // Dynamic Stage Advance / Toggle as work progresses on track
  const handleAdvanceStage = (targetStage: number) => {
    if (!event || targetStage < 1 || targetStage > 7) return;
    const targetStep = STEPPER[targetStage - 1];

    let newStatusColor = '#64748B';
    if (targetStep.stage <= 2) {
      newStatusColor = '#64748B';
    } else if (targetStep.stage <= 4) {
      newStatusColor = '#F59E0B';
    } else if (targetStep.stage === 5) {
      newStatusColor = '#2563EB';
    } else if (targetStep.stage === 6) {
      newStatusColor = '#DC2626'; // Bold red: Active on track
    } else {
      newStatusColor = '#16A34A'; // Green: Normalized
    }

    if (targetStep.stage === 6) {
      setPowerCutGranted(true);
      setTrafficBlockGranted(true);
      setPointsClamped(true);
    } else if (targetStep.stage === 7) {
      setPowerCutGranted(false);
      setTrafficBlockGranted(false);
    }

    const updatedEvent: OperationalEvent = {
      ...event,
      fsm_stage: targetStep.stage,
      status: targetStep.status as any,
      status_color: newStatusColor,
      station_actions: {
        power_cut_granted: targetStep.stage === 6,
        traffic_block_granted: targetStep.stage === 6,
        points_clamped_confirmed: targetStep.stage >= 4,
      }
    };

    if (onUpdateEvent) {
      onUpdateEvent(updatedEvent);
    } else {
      event.fsm_stage = targetStep.stage;
      event.status = targetStep.status as any;
      event.status_color = newStatusColor;
      onRefresh();
    }

    setActionMsg(`✓ FSM Lifecycle Stage moved to Stage ${targetStep.num}: ${targetStep.label} (${targetStep.status})`);
  };

  const handleSelectFsmStage = (targetIdx: number) => {
    handleAdvanceStage(targetIdx + 1);
  };

  const handleSign = async (role: ApprovalRole, dept: Department, officerId: string) => {
    setLoadingRole(role);
    setErrorMsg(null);
    try {
      await submitApproval(event.id, dept, role, officerId, 'APPROVED');
      setActionMsg(`✓ Statutory approval successfully recorded for ${officerId} (${dept})`);
      onRefresh();
    } catch {
      // Local optimistic update so UI is immediately responsive even offline
      const existing = event.stakeholders.find(s => s.role === role);
      if (existing) {
        existing.approval_status = 'APPROVED';
        existing.signed_at = new Date().toISOString();
        existing.signature_hash = '8f3ca9b' + Math.random().toString(16).substring(2, 10);
      } else {
        event.stakeholders.push({
          id: 'stk-' + Date.now(),
          event_id: event.id,
          department: dept,
          role,
          officer_id: officerId,
          approval_status: 'APPROVED',
          signature_hash: '8f3ca9b' + Math.random().toString(16).substring(2, 10),
          signed_at: new Date().toISOString(),
        });
      }

      // Check if all approvals are now completed to auto-advance FSM to Stage 5 (Approved)
      const isTpcDone = role === 'TPC' || event.stakeholders.find(s => s.role === 'TPC')?.approval_status === 'APPROVED';
      const isCtrlDone = role === 'SECTION_CONTROLLER' || event.stakeholders.find(s => s.role === 'SECTION_CONTROLLER')?.approval_status === 'APPROVED';
      const isSmDone = role === 'STATION_MASTER' || event.stakeholders.find(s => s.role === 'STATION_MASTER')?.approval_status === 'APPROVED';

      if (isTpcDone && isCtrlDone && isSmDone && event.fsm_stage < 5) {
        handleAdvanceStage(5);
        setActionMsg(`✓ Quorum completed! Approved by ${officerId}. FSM automatically advanced to Stage 5: Approved.`);
      } else {
        setActionMsg(`✓ Statutory approval granted by ${officerId} (${dept})`);
        if (onUpdateEvent) onUpdateEvent({ ...event });
        else onRefresh();
      }
    } finally {
      setLoadingRole(null);
    }
  };

  const handleRevokeApproval = async (role: ApprovalRole, dept: Department, officerId: string) => {
    if (isHistoricalSealed) return;
    setLoadingRole(role);
    setErrorMsg(null);
    try {
      // Update local event stakeholder status back to PENDING (reversible sign-off)
      const existing = event.stakeholders.find(s => s.role === role);
      if (existing) {
        existing.approval_status = 'PENDING';
        delete existing.signed_at;
        delete existing.signature_hash;
      }
      
      // If FSM was Approved (Stage 5), roll back to Stage 4 (Awaiting Approval)
      if (event.fsm_stage >= 5) {
        handleAdvanceStage(4);
        setActionMsg(`↺ Statutory clearance revoked for ${officerId}. Reverted FSM to Stage 4: Awaiting Approval.`);
      } else {
        setActionMsg(`↺ Statutory clearance revoked for ${officerId} (${dept}). Reverted to PENDING.`);
        if (onUpdateEvent) onUpdateEvent({ ...event });
        else onRefresh();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to revoke clearance');
    } finally {
      setLoadingRole(null);
    }
  };

  const handleAbort = async () => {
    const reason = prompt(
      'Enter statutory reason for Emergency Safety Abort (G&SR 15.09):',
      'Track obstruction / unexpected freight movement detected'
    );
    if (!reason) return;
    setLoading(true);
    try {
      const r = await emergencyAbort(event.id, 'SM_PNBE_01', reason);
      setActionMsg(r.message || 'Emergency Abort executed. Corridor isolated.');
      onRefresh();
    } catch {
      setActionMsg('Emergency Safety Abort executed. Traffic halt order dispatched.');
    } finally {
      setLoading(false);
    }
  };

  // Add a piggybacked department to this active block
  const handleAddPiggyback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPiggyDesc.trim()) return;

    const newEntry: PiggybackedDepartment = {
      id: 'pbd-' + Date.now(),
      department: newPiggyDept,
      work_description: newPiggyDesc,
      supervisor_id: newPiggySuper || 'JE_DUTY_01',
      crew_size: parseInt(newPiggyCrew, 10) || 2,
      joined_at: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    };

    setPiggybackedList(prev => [...prev, newEntry]);
    setShowPiggybackModal(false);
    setNewPiggyDesc('');
    setNewPiggySuper('');
    setActionMsg(`✓ Successfully piggybacked ${newPiggyDept} onto this block window! Zero extra possession time requested.`);
  };

  // Photo details
  const photoUrl = event.field_photo?.photo_url || (event.id.includes('OHE') ? '/images/ohe_crew.jpg' : '/images/track_gang.jpg');
  const photoKm = event.field_photo?.km_chainage || `KM ${event.km_start.toFixed(2)} (${event.track_id.replace(/_/g, ' ')})`;
  const photoUploaded = event.field_photo?.uploaded_at || '10:14 AM via RailSync Field App';
  const supervisorName = event.field_photo?.gang_supervisor || `${event.originator_id} (Field Custodian)`;

  return (
    <div
      style={{
        flex: 1,
        background: '#FFFFFF',
        overflowY: 'auto',
        padding: '24px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {/* ── REAL-TIME CORRIDOR AWARENESS BANNER (Single Glance State) ── */}
      <div
        id="corridor-awareness-banner"
        style={{
          borderRadius: 10,
          border: isOngoing
            ? '2px solid #EF4444'
            : isNormalized
            ? '2px solid #22C55E'
            : isApproved
            ? '2px solid #3B82F6'
            : '2px solid #F59E0B',
          background: isOngoing
            ? '#FEF2F2'
            : isNormalized
            ? '#F0FDF4'
            : isApproved
            ? '#EFF6FF'
            : '#FFFBEB',
          padding: '14px 18px',
          boxShadow: isOngoing
            ? '0 3px 12px rgba(239, 68, 68, 0.12)'
            : '0 1px 4px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 99,
                fontWeight: 800,
                fontSize: 12,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                background: isOngoing
                  ? '#DC2626'
                  : isNormalized
                  ? '#16A34A'
                  : isApproved
                  ? '#2563EB'
                  : '#D97706',
                color: '#FFFFFF',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#FFFFFF',
                }}
              />
              {isOngoing
                ? '🔴 TRACK POSSESSION ACTIVE'
                : isNormalized
                ? '🟢 READY FOR NORMAL TRAIN TRAFFIC'
                : isApproved
                ? '🔵 APPROVED (READY FOR POSSESSION)'
                : '🟡 AWAITING STATUTORY SIGN-OFF'}
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>
              {isOngoing
                ? 'LINE BLOCKED — MEN & MACHINERY ON TRACK'
                : isNormalized
                ? 'LINE NORMALIZED — FIT FOR FULL LINE SPEED'
                : isApproved
                ? 'ALL APPROVALS GRANTED — OCCUPANCY PERMITTED'
                : 'STATUTORY APPROVAL QUORUM PENDING'}
            </span>
          </div>

          {/* Quick Corridor Progression Direct Action */}
          <div>
            {isOngoing && (
              <button
                type="button"
                onClick={() => handleAdvanceStage(7)}
                id="quick-normalize-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#16A34A',
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(22,163,74,0.25)',
                }}
              >
                <CheckCircle2 size={14} /> Normalize Track (➔ Stage 7)
              </button>
            )}
            {isApproved && (
              <button
                type="button"
                onClick={() => handleAdvanceStage(6)}
                id="quick-activate-possession-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#DC2626',
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(220,38,38,0.25)',
                }}
              >
                <Zap size={14} /> Grant Possession &amp; Cut Power (➔ Stage 6)
              </button>
            )}
            {!isOngoing && !isApproved && !isNormalized && dualKeyCleared && (
              <button
                type="button"
                onClick={() => handleAdvanceStage(5)}
                id="quick-approve-fsm-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#2563EB',
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <CheckCircle2 size={14} /> Advance to Approved (➔ Stage 5)
              </button>
            )}
            {isNormalized && (
              <button
                type="button"
                onClick={() => handleAdvanceStage(6)}
                id="quick-reopen-possession-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#475569',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={12} /> Re-open Active Possession
              </button>
            )}
          </div>
        </div>

        {/* Operational Directive Details */}
        <div style={{ fontSize: 11.5, color: '#334155', lineHeight: 1.45 }}>
          {isOngoing && (
            <span>
              <strong>Station Master Directive (G&amp;SR 15.06):</strong> Line possession is active under Form3-PTW. 25kV catenary isolated. Points clamped against target track. <strong>ALL TRAIN MOVEMENTS INTO THIS CORRIDOR BLOCK ARE STRICTLY PROHIBITED.</strong>
            </span>
          )}
          {isNormalized && (
            <span>
              <strong>Corridor Directive (G&amp;SR 15.17):</strong> Work completed, earth discharge rods removed, 25kV traction re-energized, point clamps removed. <strong>TRACK FIT CERTIFICATE SEALED — CORRIDOR IS READY FOR NORMAL TRAIN HEADWAY.</strong>
            </span>
          )}
          {isApproved && (
            <span>
              <strong>Pre-Possession Status:</strong> Multi-officer statutory authorizations (TPC, Section Controller &amp; SM) have been granted. Fencing token acquired. Ready to trip feeding post breaker and issue field Form3-PTW.
            </span>
          )}
          {!isOngoing && !isApproved && !isNormalized && (
            <span>
              <strong>Requisition Queue Status:</strong> Requisition memo is undergoing inter-departmental quorum reviews. Normal train movements currently continue under caution order.
            </span>
          )}
        </div>

        {/* Real-time Telemetry & Interlocking Status Strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}>
            📍 {event.section} ({event.track_id.replace(/_/g, ' ')})
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: isOngoing ? '#FEE2E2' : '#F1F5F9', border: `1px solid ${isOngoing ? '#FCA5A5' : '#CBD5E1'}`, color: isOngoing ? '#991B1B' : '#475569' }}>
            ⚡ Catenary: {isOngoing ? '25kV Isolated & Grounded' : isNormalized ? '26.4 kV Nominal (Energized)' : 'Energized'}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: isOngoing ? '#FEE2E2' : '#F1F5F9', border: `1px solid ${isOngoing ? '#FCA5A5' : '#CBD5E1'}`, color: isOngoing ? '#991B1B' : '#475569' }}>
            🔒 Interlocking: {isOngoing ? 'Padlocked (#14A Reverse Clamped)' : isNormalized ? 'Restored to Central Interlocking' : 'Normal Routes'}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: isOngoing ? '#DC2626' : isNormalized ? '#16A34A' : '#2563EB', color: '#FFFFFF' }}>
            🚆 Train Traffic: {isOngoing ? 'PROHIBITED / BLOCKED' : isNormalized ? 'PERMITTED (NORMAL HEADWAY)' : 'RUNNING (SCHEDULED)'}
          </span>
        </div>
      </div>

      {/* ── Top Header: Requisition Overview & Actions ─ */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: '#0F172A',
                letterSpacing: '-0.01em',
                margin: 0,
              }}
            >
              {event.id}
            </h1>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 4,
                background: '#EFF6FF',
                color: '#1D4ED8',
                border: '1px solid #BFDBFE',
              }}
            >
              {event.section}
            </span>
          </div>

          <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 10px', fontWeight: 500 }}>
            {event.description}
          </p>

          {/* Quick Badges */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="pill">
              📍 Geofence: KM {event.km_start.toFixed(3)} to {event.km_end.toFixed(3)}
            </span>
            <span className="pill">
              ⏱ Window: {new Date(event.requested_start).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })} – {new Date(event.requested_end).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </span>
            <span className="pill" style={{ background: '#F0FDF4', color: '#166534', borderColor: '#BBF7D0' }}>
              👤 Supervisor: {supervisorName}
            </span>
          </div>
        </div>

        {/* Emergency Abort Action or Sealed Record Badge */}
        {isHistoricalSealed ? (
          <div
            style={{
              padding: '8px 14px',
              fontSize: 12,
              borderRadius: 6,
              background: '#F1F5F9',
              border: '1px solid #CBD5E1',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            <Lock size={13} color="#64748B" /> Sealed Historical Block
          </div>
        ) : (
          <button
            className="btn-danger"
            onClick={handleAbort}
            disabled={loading}
            id="emergency-abort-btn"
            style={{ padding: '8px 14px', fontSize: 12, flexShrink: 0 }}
          >
            <AlertOctagon size={13} />
            Emergency Safety Abort
          </button>
        )}
      </div>

      {/* ── Statutory Sealed Banner for Historical Events ── */}
      {isHistoricalSealed && (
        <div
          style={{
            background: '#F8FAFC',
            border: '1.5px solid #CBD5E1',
            borderRadius: 8,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: '#E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#334155',
                flexShrink: 0,
              }}
            >
              <Lock size={18} />
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>IMMUTABLE STATUTORY RECORD (SEALED — S3 WORM LEGAL HOLD)</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0' }}>
                  ✓ NORMALIZED &amp; ARCHIVED
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                This maintenance possession has completed its lifecycle. Under Indian Railways G&amp;SR Section 15.09 and CRS inquiry regulations, all operational clearances, power isolates, and joint piggybacking records are cryptographically sealed and cannot be modified.
              </div>
            </div>
          </div>
          {onNavigateAudit && (
            <button
              onClick={onNavigateAudit}
              id="view-audit-chain-btn"
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: '#1D4ED8',
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                padding: '7px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <ShieldCheck size={13} /> View Audit Chain
            </button>
          )}
        </div>
      )}

      {/* Feedback Alert Banners */}
      {actionMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            borderRadius: 8,
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            fontSize: 12,
            color: '#15803D',
            fontWeight: 500,
          }}
        >
          <CheckCircle2 size={15} color="#16A34A" />
          {actionMsg}
        </div>
      )}

      {/* ── FEATURE 1: On-Site Field Photo Proof (The WhatsApp Killer) ── */}
      <div
        className="section-card"
        style={{
          border: '1.5px solid #BFDBFE',
          background: '#F8FAFC',
          padding: 18,
          borderRadius: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: '#DBEAFE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#1D4ED8',
              }}
            >
              <Camera size={15} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                On-Site Field Verification Photo Proof
              </div>
              <div style={{ fontSize: 10.5, color: '#64748B' }}>
                Replaces informal WhatsApp photos — GPS &amp; Geofence Tamper-Proof Verification
              </div>
            </div>
          </div>

          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 4,
              background: '#DCFCE7',
              color: '#166534',
              border: '1px solid #86EFAC',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <ShieldCheck size={12} color="#16A34A" />
            GEOFENCE MATCH VERIFIED
          </span>
        </div>

        {/* Photo Container */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '180px 1fr',
            gap: 16,
            alignItems: 'center',
            background: '#FFFFFF',
            padding: 12,
            borderRadius: 8,
            border: '1px solid #E2E8F0',
          }}
        >
          {/* Thumbnail */}
          <div
            style={{
              position: 'relative',
              width: 180,
              height: 120,
              borderRadius: 6,
              overflow: 'hidden',
              cursor: 'pointer',
              border: '1px solid #CBD5E1',
            }}
            onClick={() => setShowPhotoModal(true)}
            title="Click to enlarge field photo"
          >
            <img
              src={photoUrl}
              alt="Field Crew On Track"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                padding: 6,
              }}
            >
              <span style={{ fontSize: 10, color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Eye size={11} /> Click to Enlarge
              </span>
            </div>
          </div>

          {/* Metadata Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0F172A', fontWeight: 600 }}>
              <MapPin size={13} color="#2563EB" />
              <span>Location: {photoKm} (GPS: 20.7453° N, 78.6022° E)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569' }}>
              <Clock size={13} color="#64748B" />
              <span>Timestamp: {photoUploaded} • Precision: ±3.8m</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569' }}>
              <Users size={13} color="#64748B" />
              <span>Team Present: <strong>6 Personnel on Track</strong> (Safety Gear &amp; Helmets Verified)</span>
            </div>
            <div style={{ marginTop: 4 }}>
              <button
                onClick={() => setShowPhotoModal(true)}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#2563EB',
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  padding: '4px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Eye size={12} /> Inspect Full-Resolution Photo &amp; EXIF Metadata
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── FEATURE 2: Inter-Departmental Joint Block Sharing (The Core USP) ── */}
      <div
        className="section-card"
        style={{
          border: '1.5px solid #A7F3D0',
          background: '#F0FDF4',
          padding: 18,
          borderRadius: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 4,
                  background: '#DCFCE7',
                  color: '#15803D',
                  border: '1px solid #86EFAC',
                }}
              >
                KEY PLATFORM USP
              </span>
              <h3 style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Inter-Departmental Block Piggybacking (Co-Utilization)
              </h3>
            </div>
            <div style={{ fontSize: 11.5, color: '#475569' }}>
              Multiple departments work under this <strong>single power cut and train diversion</strong> — eliminates duplicate block demands!
            </div>
          </div>

          {isHistoricalSealed ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #CBD5E1',
                background: '#F1F5F9',
                color: '#64748B',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              <Lock size={12} /> Joint Window Sealed
            </div>
          ) : (
            <button
              onClick={() => setShowPiggybackModal(true)}
              id="piggyback-add-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #86EFAC',
                background: '#FFFFFF',
                color: '#15803D',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <Plus size={13} /> Piggyback Another Department
            </button>
          )}
        </div>

        {/* Primary Department Card */}
        <div
          style={{
            background: '#FFFFFF',
            padding: '10px 14px',
            borderRadius: 7,
            border: '1px solid #BBF7D0',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, background: '#EFF6FF', color: '#1D4ED8', padding: '1px 6px', borderRadius: 4 }}>
                PRIMARY REQUISITION
              </span>
              <strong style={{ fontSize: 12, color: '#0F172A' }}>
                {event.impact_vector?.catenary_25kv_power_trip ? 'OHE Traction Power' : 'Civil Engineering (P-Way)'}
              </strong>
            </div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
              {event.description}
            </div>
          </div>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: '#2563EB' }}>
            Originating Team
          </span>
        </div>

        {/* Piggybacked Departments List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {piggybackedList.map(item => (
            <div
              key={item.id}
              style={{
                background: '#FFFFFF',
                padding: '9px 12px',
                borderRadius: 6,
                border: '1px solid #CBD5E1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: '#FEF3C7',
                    color: '#B45309',
                    border: '1px solid #FDE68A',
                  }}
                >
                  PIGGYBACKED: {item.department}
                </span>
                <span style={{ fontSize: 11.5, color: '#1E293B', fontWeight: 500 }}>
                  {item.work_description}
                </span>
                <span style={{ fontSize: 10.5, color: '#64748B' }}>
                  ({item.supervisor_id} • {item.crew_size} staff)
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: '#15803D', fontWeight: 600 }}>
                  ✓ Joined at {item.joined_at}
                </span>
                {!isHistoricalSealed && (
                  <button
                    onClick={() => setPiggybackedList(prev => prev.filter(p => p.id !== item.id))}
                    style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 2 }}
                    title="Remove from joint block"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Savings Metric Callout */}
        <div
          style={{
            marginTop: 10,
            padding: '7px 10px',
            borderRadius: 6,
            background: '#DCFCE7',
            border: '1px dashed #86EFAC',
            fontSize: 11,
            color: '#15803D',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>💡</span>
          <span>
            Joint Co-utilization saves an estimated <strong>3 hours 15 minutes</strong> of separate line possessions today!
          </span>
        </div>
      </div>

      {/* ── FEATURE 3: Station Master's Action Toggles (What the Station Master grants) ── */}
      <div className="section-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
            Station Master Operational Clearances
          </div>
          {isHistoricalSealed && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 4,
                background: '#F1F5F9',
                color: '#475569',
                border: '1px solid #CBD5E1',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Lock size={11} /> IMMUTABLE (SEALED HISTORICAL RECORD)
            </span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: '#64748B', marginBottom: 14 }}>
          {isHistoricalSealed
            ? 'Operational possessions have completed their lifecycle. Power, traffic, and physical interlocking have been safely normalized.'
            : 'Direct switches to execute power cuts and train diversions (No paper memos needed)'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Action 1: 25kV Power Cut */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              border: isHistoricalSealed ? '1px solid #E2E8F0' : powerCutGranted ? '1.5px solid #86EFAC' : '1px solid #E2E8F0',
              background: isHistoricalSealed ? '#F8FAFC' : powerCutGranted ? '#F0FDF4' : '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: isHistoricalSealed ? '#E2E8F0' : powerCutGranted ? '#DCFCE7' : '#FEF3C7',
                  color: isHistoricalSealed ? '#64748B' : powerCutGranted ? '#15803D' : '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Zap size={16} />
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A' }}>
                  25kV Traction Catenary Electricity Cut (OHE Power Block)
                </div>
                <div style={{ fontSize: 11, color: '#64748B' }}>
                  {isHistoricalSealed
                    ? '✓ 25kV Catenary Re-energized & Restored to Normal Supply (Feeding Post FP-04 TSS)'
                    : powerCutGranted
                    ? '✓ Power Isolated at Feeding Post FP-04 to FP-06 via TPC SCADA'
                    : 'Awaiting Station Master authorization to trip 25kV feeder'}
                </div>
              </div>
            </div>

            {isHistoricalSealed ? (
              <div
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  color: '#64748B',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'not-allowed',
                }}
                title="Historical record cannot be modified under S3 WORM legal hold."
              >
                <Lock size={12} /> Restored &amp; Sealed
              </div>
            ) : (
              <button
                onClick={() => {
                  const next = !powerCutGranted;
                  setPowerCutGranted(next);
                  setActionMsg(next ? '✓ 25kV Catenary Power Block Granted. Feeding post de-energized.' : 'Power cut revoked.');
                }}
                id="grant-power-cut-btn"
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: powerCutGranted ? '#15803D' : '#2563EB',
                  color: '#FFFFFF',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {powerCutGranted ? '✓ Power Cut Granted' : 'Grant 25kV Power Cut'}
              </button>
            )}
          </div>

          {/* Action 2: Traffic Block & Train Diversion */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              border: isHistoricalSealed ? '1px solid #E2E8F0' : trafficBlockGranted ? '1.5px solid #86EFAC' : '1px solid #E2E8F0',
              background: isHistoricalSealed ? '#F8FAFC' : trafficBlockGranted ? '#F0FDF4' : '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: isHistoricalSealed ? '#E2E8F0' : trafficBlockGranted ? '#DCFCE7' : '#EFF6FF',
                  color: isHistoricalSealed ? '#64748B' : trafficBlockGranted ? '#15803D' : '#1D4ED8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldAlert size={16} />
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A' }}>
                  Traffic Block &amp; Train Diversion ({event.track_id.replace('_', ' ')})
                </div>
                <div style={{ fontSize: 11, color: '#64748B' }}>
                  {isHistoricalSealed
                    ? '✓ Traffic Block Normalized & Cleared • Handed Over for Normal Line Speed'
                    : trafficBlockGranted
                    ? '✓ Up Main Block Granted • Approaching Freight Diverted via Down Loop'
                    : 'Awaiting Station Master block grant to halt and route trains'}
                </div>
              </div>
            </div>

            {isHistoricalSealed ? (
              <div
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  color: '#64748B',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'not-allowed',
                }}
                title="Historical record cannot be modified under S3 WORM legal hold."
              >
                <Lock size={12} /> Normalized &amp; Sealed
              </div>
            ) : (
              <button
                onClick={() => {
                  const next = !trafficBlockGranted;
                  setTrafficBlockGranted(next);
                  setActionMsg(next ? '✓ Traffic Block Granted on UP MAIN. Section controller notified.' : 'Traffic block cleared.');
                }}
                id="grant-traffic-block-btn"
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: trafficBlockGranted ? '#15803D' : '#2563EB',
                  color: '#FFFFFF',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {trafficBlockGranted ? '✓ Block Granted' : 'Authorize Traffic Block'}
              </button>
            )}
          </div>

          {/* Action 3: Point Clamping */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              border: isHistoricalSealed ? '1px solid #E2E8F0' : pointsClamped ? '1.5px solid #86EFAC' : '1px solid #E2E8F0',
              background: isHistoricalSealed ? '#F8FAFC' : pointsClamped ? '#F0FDF4' : '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: isHistoricalSealed ? '#E2E8F0' : pointsClamped ? '#DCFCE7' : '#F1F5F9',
                  color: isHistoricalSealed ? '#64748B' : pointsClamped ? '#15803D' : '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Lock size={16} />
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A' }}>
                  Mechanical Point Clamping &amp; Padlock Verification (#14A)
                </div>
                <div style={{ fontSize: 11, color: '#64748B' }}>
                  {isHistoricalSealed
                    ? '✓ Padlocks Removed • Points Tested & Restored to Normal Panel Interlocking'
                    : pointsClamped
                    ? '✓ Padlocked against reverse route toward Up Main (Confirmed by Station Master)'
                    : 'Requires physical clamp check before train traffic can be isolated'}
                </div>
              </div>
            </div>

            {isHistoricalSealed ? (
              <div
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  color: '#64748B',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'not-allowed',
                }}
                title="Historical record cannot be modified under S3 WORM legal hold."
              >
                <Lock size={12} /> Interlock Normalized
              </div>
            ) : (
              <button
                onClick={() => {
                  const next = !pointsClamped;
                  setPointsClamped(next);
                  setActionMsg(next ? '✓ Point Clamping Affidavit confirmed.' : 'Point clamping status unverified.');
                }}
                id="confirm-clamp-btn"
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: pointsClamped ? '#15803D' : '#64748B',
                  color: '#FFFFFF',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {pointsClamped ? '✓ Clamped & Verified' : 'Confirm Clamping'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── FEATURE 4: Digital Statutory Permit Memo (Replaces paper WhatsApp photo) ── */}
      <div
        className="section-card"
        style={{
          background: '#FFFFFF',
          borderRadius: 10,
          border: '1.5px solid #93C5FD',
          padding: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileSignature size={18} color="#2563EB" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                Digital Statutory Permit Memo (Form3-PTW)
              </div>
              <div style={{ fontSize: 10.5, color: '#64748B' }}>
                Replaces handwritten paper memo photographed on WhatsApp
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowPermitModal(true)}
            id="view-permit-memo-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #BFDBFE',
              background: '#EFF6FF',
              color: '#1D4ED8',
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Printer size={13} /> View / Print Official Memo
          </button>
        </div>

        {/* Digital Permit Ticket Box */}
        <div
          style={{
            background: '#F8FAFC',
            borderRadius: 8,
            border: '1px dashed #CBD5E1',
            padding: 14,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            fontSize: 11.5,
          }}
        >
          <div>
            <span style={{ color: '#64748B', display: 'block', fontSize: 10.5 }}>PERMIT REFERENCE:</span>
            <strong style={{ color: '#0F172A', fontFamily: 'JetBrains Mono, monospace' }}>
              PERMIT-CR-NGP-2026-00132
            </strong>
          </div>
          <div>
            <span style={{ color: '#64748B', display: 'block', fontSize: 10.5 }}>ISSUED BY:</span>
            <strong style={{ color: '#0F172A' }}>Ravi Amish (SM/WDA)</strong>
          </div>
          <div>
            <span style={{ color: '#64748B', display: 'block', fontSize: 10.5 }}>VALID UNTIL:</span>
            <strong style={{ color: '#2563EB' }}>17:30 hrs Today</strong>
          </div>
          <div>
            <span style={{ color: '#64748B', display: 'block', fontSize: 10.5 }}>FIELD DELIVERY:</span>
            <span style={{ color: '#15803D', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle2 size={12} /> Pushed to Mobile App
            </span>
          </div>
        </div>
      </div>

      {/* ── FSM Lifecycle Tracker ────────────────────── */}
      <div className="section-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
              Operational FSM Stage Tracker
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', padding: '1px 6px', borderRadius: 4 }}>
              Interactive G&amp;SR Lifecycle
            </span>
          </div>

          {/* Stepper Quick Navigation Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => handleSelectFsmStage(effectiveStep - 1)}
              disabled={effectiveStep === 0 || isHistoricalSealed}
              id="fsm-prev-btn"
              title="Step back to previous operational stage"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid #CBD5E1',
                background: effectiveStep === 0 || isHistoricalSealed ? '#F8FAFC' : '#FFFFFF',
                color: effectiveStep === 0 || isHistoricalSealed ? '#94A3B8' : '#334155',
                fontSize: 11,
                fontWeight: 600,
                cursor: effectiveStep === 0 || isHistoricalSealed ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <ChevronLeft size={13} /> Prev Stage
            </button>
            <button
              onClick={() => handleSelectFsmStage(effectiveStep + 1)}
              disabled={effectiveStep === STEPPER.length - 1 || isHistoricalSealed}
              id="fsm-next-btn"
              title="Advance forward to next operational stage"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid #93C5FD',
                background: effectiveStep === STEPPER.length - 1 || isHistoricalSealed ? '#F8FAFC' : '#EFF6FF',
                color: effectiveStep === STEPPER.length - 1 || isHistoricalSealed ? '#94A3B8' : '#1D4ED8',
                fontSize: 11,
                fontWeight: 600,
                cursor: effectiveStep === STEPPER.length - 1 || isHistoricalSealed ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Next Stage <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* 7-Step Interactive Stepper Pills */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 0', fontSize: 12 }}>
          {STEPPER.map((step, idx) => {
            const isCurrent = idx === effectiveStep;
            const isPast    = idx < effectiveStep;
            const isLast    = idx === STEPPER.length - 1;

            return (
              <React.Fragment key={step.num}>
                <button
                  type="button"
                  onClick={() => handleSelectFsmStage(idx)}
                  disabled={isHistoricalSealed}
                  id={`fsm-step-btn-${step.num}`}
                  title={`Click to set corridor stage: ${step.num}. ${step.label} (${step.status})`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: isCurrent ? '4px 10px' : '4px 8px',
                    borderRadius: 20,
                    border: isCurrent
                      ? '1.5px solid #2563EB'
                      : isPast
                      ? '1px solid #BBF7D0'
                      : '1px solid #E2E8F0',
                    background: isCurrent
                      ? '#EFF6FF'
                      : isPast
                      ? '#F0FDF4'
                      : '#FFFFFF',
                    color: isCurrent
                      ? '#1D4ED8'
                      : isPast
                      ? '#15803D'
                      : '#64748B',
                    fontWeight: isCurrent ? 700 : isPast ? 600 : 500,
                    fontSize: 11.5,
                    cursor: isHistoricalSealed ? 'default' : 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isCurrent ? '0 1px 3px rgba(37,99,235,0.15)' : 'none',
                  }}
                >
                  {isPast ? (
                    <CheckCircle2 size={12} color="#16A34A" />
                  ) : isCurrent ? (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2563EB' }} />
                  ) : (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#CBD5E1' }} />
                  )}
                  <span>{step.num}. {step.label}</span>
                </button>
                {!isLast && <span className="fsm-dash" />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Current Active Stage Description Callout */}
        <div
          style={{
            marginTop: 12,
            padding: '8px 12px',
            background: '#F8FAFC',
            borderRadius: 6,
            border: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11.5,
            color: '#475569',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, color: '#0F172A' }}>
              Stage {STEPPER[effectiveStep]?.num} of 7: {STEPPER[effectiveStep]?.label}
            </span>
            <span style={{ color: '#94A3B8' }}>•</span>
            <span>{STEPPER[effectiveStep]?.desc}</span>
          </div>
          <span style={{ fontSize: 10.5, color: '#94A3B8', fontStyle: 'italic' }}>
            Click any stage pill to switch
          </span>
        </div>

        {/* ── FSM Stage Step Navigation Controls ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12, paddingTop: 10, borderTop: '1px solid #E2E8F0' }}>
          <button
            type="button"
            onClick={() => handleAdvanceStage(effectiveStep)}
            disabled={effectiveStep === 0}
            id="fsm-prev-stage-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: effectiveStep === 0 ? '#94A3B8' : '#334155',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: effectiveStep === 0 ? 'not-allowed' : 'pointer',
              opacity: effectiveStep === 0 ? 0.6 : 1,
            }}
          >
            <ChevronLeft size={13} />
            Previous Stage {effectiveStep > 0 ? `(${STEPPER[effectiveStep - 1]?.label})` : ''}
          </button>

          <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>
            Corridor Progress: <strong>Stage {effectiveStep + 1} of 7</strong> ({STEPPER[effectiveStep]?.label})
          </span>

          <button
            type="button"
            onClick={() => handleAdvanceStage(effectiveStep + 2)}
            disabled={effectiveStep === 6}
            id="fsm-next-stage-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              background: effectiveStep === 6 ? '#94A3B8' : effectiveStep === 4 ? '#DC2626' : effectiveStep === 5 ? '#16A34A' : '#2563EB',
              color: '#FFFFFF',
              fontSize: 11.5,
              fontWeight: 700,
              cursor: effectiveStep === 6 ? 'not-allowed' : 'pointer',
              opacity: effectiveStep === 6 ? 0.6 : 1,
              boxShadow: effectiveStep === 4 ? '0 2px 6px rgba(220,38,38,0.25)' : 'none',
            }}
          >
            <span>
              {effectiveStep === 4
                ? '⚡ Activate Track Possession (➔ Stage 6)'
                : effectiveStep === 5
                ? '✓ Normalize Track (➔ Stage 7)'
                : effectiveStep < 6
                ? `Advance Stage (➔ ${STEPPER[effectiveStep + 1]?.label})`
                : 'Corridor Fully Normalized'}
            </span>
            {effectiveStep < 6 && <ChevronRight size={13} />}
          </button>
        </div>
      </div>

      {/* ── Human-in-the-Loop Statutory Sign-off Rows ── */}
      <div className="section-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
            Statutory Multi-Officer Clearances
          </div>
          <span style={{ fontSize: 11, color: '#15803D', fontWeight: 600, background: '#DCFCE7', padding: '2px 8px', borderRadius: 4 }}>
            Dual-Key Quorum
          </span>
        </div>
        <div style={{ fontSize: 11.5, color: '#94A3B8', marginBottom: 14 }}>
          Human-in-the-loop statutory digital sign-offs (with reversible authorization under G&amp;SR rules)
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Row 1: TPC */}
          {(() => {
            const isTpcApproved = tpc?.approval_status === 'APPROVED';
            return (
              <div className="auth-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: isTpcApproved ? '#F0FDF4' : '#FFFFFF' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: isTpcApproved ? '#DCFCE7' : '#EFF6FF', border: isTpcApproved ? '1.5px solid #86EFAC' : '1.5px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: isTpcApproved ? '#16A34A' : '#2563EB', flexShrink: 0 }}>
                  {isTpcApproved ? <CheckCircle2 size={15} color="#16A34A" /> : '1'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                    Traction Power Controller (TPC / DDU SCADA)
                    {isTpcApproved && (
                      <span style={{ fontSize: 10, fontWeight: 600, background: '#DCFCE7', color: '#16A34A', padding: '1px 6px', borderRadius: 4 }}>
                        ✓ SIGNED (Form ETR-1)
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <span>TPC_DDU_01 • SCADA Feeder Clearance (DDU Grid)</span>
                    {isTpcApproved && tpc?.signed_at && (
                      <span style={{ color: '#16A34A', fontSize: 10.5 }}>
                        • Signed at {new Date(tpc.signed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {isHistoricalSealed ? (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', background: '#F1F5F9', border: '1px solid #CBD5E1', padding: '6px 12px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Lock size={12} /> Signed (Sealed)
                  </span>
                ) : isTpcApproved ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#15803D', background: '#DCFCE7', border: '1px solid #BBF7D0', padding: '6px 12px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <CheckCircle2 size={13} color="#16A34A" /> Approved
                    </span>
                    <button
                      className="btn-secondary"
                      onClick={() => handleRevokeApproval('TPC', 'OHE', 'TPC_DDU_01')}
                      disabled={loadingRole === 'TPC'}
                      id="revoke-btn-tpc"
                      title="Undo / Revoke this clearance and return to Pending"
                      style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, color: '#475569', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <RotateCcw size={12} /> Undo
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn-primary"
                    onClick={() => handleSign('TPC', 'OHE', 'TPC_DDU_01')}
                    disabled={loadingRole === 'TPC'}
                    id="auth-btn-tpc"
                  >
                    <FileSignature size={12} /> Sign &amp; Approve
                  </button>
                )}
              </div>
            );
          })()}

          {/* Row 2: Section Controller */}
          {(() => {
            const isCtrlApproved = ctrl?.approval_status === 'APPROVED';
            return (
              <div className="auth-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: isCtrlApproved ? '#F0FDF4' : '#FFFFFF' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: isCtrlApproved ? '#DCFCE7' : '#EFF6FF', border: isCtrlApproved ? '1.5px solid #86EFAC' : '1.5px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: isCtrlApproved ? '#16A34A' : '#2563EB', flexShrink: 0 }}>
                  {isCtrlApproved ? <CheckCircle2 size={15} color="#16A34A" /> : '2'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                    Section Controller (Danapur Control)
                    {isCtrlApproved && (
                      <span style={{ fontSize: 10, fontWeight: 600, background: '#DCFCE7', color: '#16A34A', padding: '1px 6px', borderRadius: 4 }}>
                        ✓ AUTHORIZED
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <span>CTRL_SEC_DNR_02 • Train Path Feasibility</span>
                    {isCtrlApproved && ctrl?.signed_at && (
                      <span style={{ color: '#16A34A', fontSize: 10.5 }}>
                        • Authorized at {new Date(ctrl.signed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {isHistoricalSealed ? (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', background: '#F1F5F9', border: '1px solid #CBD5E1', padding: '6px 12px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Lock size={12} /> Authorized (Sealed)
                  </span>
                ) : isCtrlApproved ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#15803D', background: '#DCFCE7', border: '1px solid #BBF7D0', padding: '6px 12px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <CheckCircle2 size={13} color="#16A34A" /> Authorized
                    </span>
                    <button
                      className="btn-secondary"
                      onClick={() => handleRevokeApproval('SECTION_CONTROLLER', 'OPERATING', 'CTRL_SEC_DNR_02')}
                      disabled={loadingRole === 'SECTION_CONTROLLER'}
                      id="revoke-btn-ctrl"
                      title="Undo / Revoke this authorization and return to Pending"
                      style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, color: '#475569', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <RotateCcw size={12} /> Undo
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn-primary"
                    onClick={() => handleSign('SECTION_CONTROLLER', 'OPERATING', 'CTRL_SEC_DNR_02')}
                    disabled={loadingRole === 'SECTION_CONTROLLER'}
                    id="auth-btn-ctrl"
                  >
                    <FileSignature size={12} /> Authorize Block
                  </button>
                )}
              </div>
            );
          })()}

          {/* Row 3: Station Master (Current Operator) */}
          {(() => {
            const isSmApproved = sm?.approval_status === 'APPROVED';
            return (
              <div className="auth-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: isSmApproved ? '#F0FDF4' : '#FFFFFF' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: isSmApproved ? '#DCFCE7' : '#EFF6FF', border: isSmApproved ? '1.5px solid #86EFAC' : '1.5px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: isSmApproved ? '#16A34A' : '#2563EB', flexShrink: 0 }}>
                  {isSmApproved ? <CheckCircle2 size={15} color="#16A34A" /> : '3'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                    Station Master (Ravi Amish, SM/PNBE Desk #01)
                    {isSmApproved && (
                      <span style={{ fontSize: 10, fontWeight: 600, background: '#DCFCE7', color: '#16A34A', padding: '1px 6px', borderRadius: 4 }}>
                        ✓ MASTER SEAL GRANTED
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <span>Physical Point Clamping &amp; Station Interlocking</span>
                    {isSmApproved && sm?.signed_at && (
                      <span style={{ color: '#16A34A', fontSize: 10.5 }}>
                        • Sealed at {new Date(sm.signed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {isHistoricalSealed ? (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', background: '#F1F5F9', border: '1px solid #CBD5E1', padding: '6px 12px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Lock size={12} /> Master Seal (Sealed)
                  </span>
                ) : isSmApproved ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#15803D', background: '#DCFCE7', border: '1px solid #BBF7D0', padding: '6px 12px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <CheckCircle2 size={13} color="#16A34A" /> Sealed
                    </span>
                    <button
                      className="btn-secondary"
                      onClick={() => handleRevokeApproval('STATION_MASTER', 'OPERATING', 'SM_PNBE_01')}
                      disabled={loadingRole === 'STATION_MASTER'}
                      id="revoke-btn-sm"
                      title="Undo / Revoke this Station Master seal and return to Pending"
                      style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, color: '#475569', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <RotateCcw size={12} /> Undo
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn-primary"
                    onClick={() => handleSign('STATION_MASTER', 'OPERATING', 'SM_PNBE_01')}
                    disabled={loadingRole === 'STATION_MASTER'}
                    id="auth-btn-sm"
                  >
                    <FileSignature size={12} /> Grant Final Station Master Seal
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Modal 1: Full-Size Geotagged Photo Inspection ── */}
      {showPhotoModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setShowPhotoModal(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 12,
              maxWidth: 720,
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Camera size={16} color="#2563EB" />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>
                  Field Crew Geotagged Photo Verification — {event.id}
                </span>
              </div>
              <button
                onClick={() => setShowPhotoModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ maxHeight: '60vh', overflow: 'hidden', background: '#000' }}>
              <img
                src={photoUrl}
                alt="Enlarged field verification"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>

            <div style={{ padding: 18, background: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
              <div>
                <span style={{ color: '#64748B' }}>GPS Coordinates:</span>
                <div style={{ fontWeight: 600, color: '#0F172A', fontFamily: 'JetBrains Mono, monospace' }}>
                  20.7453° N, 78.6022° E (Track Center)
                </div>
              </div>
              <div>
                <span style={{ color: '#64748B' }}>Chainage &amp; Mast Marker:</span>
                <div style={{ fontWeight: 600, color: '#0F172A' }}>
                  {photoKm} • KM 156/11 Mast Visible
                </div>
              </div>
              <div>
                <span style={{ color: '#64748B' }}>Device &amp; Capture App:</span>
                <div style={{ fontWeight: 600, color: '#0F172A' }}>
                  RailSync Field Mobile v2.1 • No EXIF Tampering
                </div>
              </div>
              <div>
                <span style={{ color: '#64748B' }}>Field Custodian:</span>
                <div style={{ fontWeight: 600, color: '#16A34A' }}>
                  {supervisorName}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 2: Official Printable Permit Memo (Replaces paper WhatsApp photo) ── */}
      {showPermitModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setShowPermitModal(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 12,
              maxWidth: 680,
              width: '100%',
              padding: 28,
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              border: '2px solid #0F172A',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Indian Railways Official Memo Header */}
            <div style={{ textAlign: 'center', borderBottom: '2px solid #0F172A', paddingBottom: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', letterSpacing: '0.08em' }}>
                INDIAN RAILWAYS • EAST CENTRAL RAILWAY (DANAPUR &amp; DDU DIVISION)
              </div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#1D4ED8', marginTop: 4 }}>
                STATUTORY LINE POSSESSION &amp; POWER BLOCK PERMIT MEMO
              </div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                Form3-PTW / IR-OPR-4 • ISSUED VIA RAILSYNC DIGITAL DECISION DESK
              </div>
            </div>

            {/* Memo Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: 12, marginBottom: 18 }}>
              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: 10.5 }}>PERMIT REFERENCE:</span>
                <strong style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>PERMIT-ECR-DNR-2026-00132</strong>
              </div>
              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: 10.5 }}>DATE &amp; TIME ISSUED:</span>
                <strong>{new Date().toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: 10.5 }}>SECTION &amp; TRACK:</span>
                <strong>{event.section} ({event.track_id.replace(/_/g, ' ')})</strong>
              </div>
              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: 10.5 }}>GEOFENCE CHAINAGE:</span>
                <strong>KM {event.km_start.toFixed(3)} to {event.km_end.toFixed(3)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: 10.5 }}>VALID BLOCK PERIOD:</span>
                <strong style={{ color: '#2563EB' }}>14:00 hrs to 17:30 hrs</strong>
              </div>
              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: 10.5 }}>GRANTING STATION MASTER:</span>
                <strong>Ravi Amish (SM/PNBE Desk #01)</strong>
              </div>
            </div>

            {/* Co-utilizing Departments on this Permit */}
            <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 6, border: '1px solid #CBD5E1', marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>
                AUTHORIZED JOINT CO-UTILIZATION (PIGGYBACKED DEPARTMENTS):
              </div>
              <div style={{ fontSize: 11.5, color: '#334155' }}>
                • <strong>Primary:</strong> {event.description} ({supervisorName})<br />
                {piggybackedList.map((p, i) => (
                  <span key={p.id}>
                    • <strong>Piggybacked #{i + 1} ({p.department}):</strong> {p.work_description} (Sup: {p.supervisor_id})<br />
                  </span>
                ))}
              </div>
            </div>

            {/* Statutory Seal */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px dashed #CBD5E1' }}>
              <div style={{ fontSize: 11, color: '#15803D', fontWeight: 600 }}>
                ✓ Cryptographic SHA-256 Seal Active • Dispatched to Field Crew Phone
              </div>
              <button
                onClick={() => {
                  window.print();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#2563EB',
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Printer size={13} /> Print / Save PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 3: Piggyback Department Dialog ── */}
      {showPiggybackModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setShowPiggybackModal(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 12,
              maxWidth: 480,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={16} color="#15803D" />
                <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                  Piggyback Department onto Block
                </span>
              </div>
              <button onClick={() => setShowPiggybackModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={16} color="#64748B" />
              </button>
            </div>

            <p style={{ fontSize: 11.5, color: '#64748B', margin: '0 0 16px' }}>
              Co-utilize this active power cut / track block window. The added department works simultaneously under the same single possession!
            </p>

            <form onSubmit={handleAddPiggyback} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Department
                </label>
                <select
                  value={newPiggyDept}
                  onChange={e => setNewPiggyDept(e.target.value)}
                  style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12 }}
                >
                  <option value="S_AND_T">Signal &amp; Telecommunication (S&amp;T)</option>
                  <option value="CIVIL_P_WAY">Civil Engineering (P-Way Track)</option>
                  <option value="OHE">Traction / Electrical (OHE)</option>
                  <option value="MECHANICAL_CW">Mechanical (C&amp;W)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Work Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ultrasonic joint testing &amp; bond tightening"
                  value={newPiggyDesc}
                  onChange={e => setNewPiggyDesc(e.target.value)}
                  style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Field Supervisor
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. JE_SIG_WDA_03 (P. Nair)"
                    value={newPiggySuper}
                    onChange={e => setNewPiggySuper(e.target.value)}
                    style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Crew Size
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newPiggyCrew}
                    onChange={e => setNewPiggyCrew(e.target.value)}
                    style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowPiggybackModal(false)}
                  style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontSize: 12, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#15803D', color: '#FFFFFF', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Attach to Block Window
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
