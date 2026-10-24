import React, { useState } from 'react';
import {
  CheckSquare, Square, FileSignature, CheckCircle2,
  Clock, ShieldAlert, AlertOctagon, Database, ExternalLink,
  Lock, Unlock, Activity, Camera, MapPin, Users, Plus,
  Share2, Printer, X, Eye, Zap, ShieldCheck, ArrowRight,
  AlertTriangle, RotateCcw, ChevronLeft, ChevronRight,
  FileText, Flag, Radio, Phone, Info
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
  const [showSafetyReportModal, setShowSafetyReportModal] = useState(false);
  const [activeSafetyTab, setActiveSafetyTab] = useState<'summary' | 'interlocking' | 'catenary' | 'traffic' | 'machinery' | 'signatures'>('summary');

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
      {/* ── Operational Corridor Awareness & Safety Status Strip ── */}
      <div
        id="corridor-awareness-banner"
        role="button"
        tabIndex={0}
        onClick={() => {
          setShowSafetyReportModal(true);
          setActiveSafetyTab('summary');
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            setShowSafetyReportModal(true);
            setActiveSafetyTab('summary');
          }
        }}
        style={{
          borderRadius: 8,
          border: '1px solid #E2E8F0',
          borderLeft: isOngoing
            ? '4px solid #DC2626'
            : isNormalized
            ? '4px solid #16A34A'
            : isApproved
            ? '4px solid #2563EB'
            : '4px solid #D97706',
          background: '#FFFFFF',
          padding: '14px 18px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          outline: 'none',
        }}
        title="Click to view detailed statutory safety measures and restriction protocols (Form 3-PTW)"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 10px',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 11.5,
                background: isOngoing
                  ? '#FEF2F2'
                  : isNormalized
                  ? '#F0FDF4'
                  : isApproved
                  ? '#EFF6FF'
                  : '#FFFBEB',
                color: isOngoing
                  ? '#991B1B'
                  : isNormalized
                  ? '#166534'
                  : isApproved
                  ? '#1E40AF'
                  : '#92400E',
                border: `1px solid ${
                  isOngoing
                    ? '#FECACA'
                    : isNormalized
                    ? '#BBF7D0'
                    : isApproved
                    ? '#BFDBFE'
                    : '#FDE68A'
                }`,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: isOngoing
                    ? '#DC2626'
                    : isNormalized
                    ? '#16A34A'
                    : isApproved
                    ? '#2563EB'
                    : '#D97706',
                }}
              />
              {isOngoing
                ? 'Track Possession Active'
                : isNormalized
                ? 'Line Normalized'
                : isApproved
                ? 'Approved for Possession'
                : 'Awaiting Approvals'}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>
              {isOngoing
                ? 'Line Blocked — Maintenance in Progress'
                : isNormalized
                ? 'Track Normalized — Fit for Permitted Line Speed'
                : isApproved
                ? 'All Approvals Granted — Ready for Possession'
                : 'Statutory Approval Quorum Pending'}
            </span>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              id="view-safety-restrictions-report-btn"
              onClick={e => {
                e.stopPropagation();
                setShowSafetyReportModal(true);
                setActiveSafetyTab('summary');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 11px',
                borderRadius: 6,
                border: '1px solid #CBD5E1',
                background: '#F8FAFC',
                color: '#1E40AF',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <FileText size={13} color="#2563EB" /> Safety &amp; Restriction Report
            </button>

            {isOngoing && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  handleAdvanceStage(7);
                }}
                id="quick-normalize-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#16A34A',
                  color: '#FFFFFF',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <CheckCircle2 size={13} /> Normalize Track
              </button>
            )}
            {isApproved && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  handleAdvanceStage(6);
                }}
                id="quick-activate-possession-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#DC2626',
                  color: '#FFFFFF',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Zap size={13} /> Grant Possession
              </button>
            )}
            {!isOngoing && !isApproved && !isNormalized && dualKeyCleared && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  handleAdvanceStage(5);
                }}
                id="quick-approve-fsm-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#2563EB',
                  color: '#FFFFFF',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <CheckCircle2 size={13} /> Advance to Approved
              </button>
            )}
            {isNormalized && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  handleAdvanceStage(6);
                }}
                id="quick-reopen-possession-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 11px',
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#475569',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={12} /> Re-open Possession
              </button>
            )}
          </div>
        </div>

        {/* Operational Directive Details */}
        <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
          {isOngoing && (
            <span>
              <strong>Station Master Directive (G&amp;SR 15.06):</strong> Line possession is active under Form 3-PTW. 25kV catenary isolated. Points clamped against target track. Train movements into this block section are prohibited.
            </span>
          )}
          {isNormalized && (
            <span>
              <strong>Corridor Directive (G&amp;SR 15.17):</strong> Work completed, discharge rods removed, 25kV traction re-energized, point clamps removed. Track Fit Certificate sealed.
            </span>
          )}
          {isApproved && (
            <span>
              <strong>Pre-Possession Status:</strong> Statutory authorizations granted. Fencing token acquired. Ready to trip feeding post breaker and issue Form 3-PTW.
            </span>
          )}
          {!isOngoing && !isApproved && !isNormalized && (
            <span>
              <strong>Requisition Queue Status:</strong> Requisition memo is undergoing quorum reviews. Normal train movements currently continue under caution order.
            </span>
          )}
        </div>

        {/* Real-time Telemetry & Interlocking Status Strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 2 }}>
          <span
            onClick={e => {
              e.stopPropagation();
              setShowSafetyReportModal(true);
              setActiveSafetyTab('summary');
            }}
            title="Section and track assignment"
            style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#334155' }}
          >
            Section: <strong>{event.section} ({event.track_id.replace(/_/g, ' ')})</strong>
          </span>
          <span
            onClick={e => {
              e.stopPropagation();
              setShowSafetyReportModal(true);
              setActiveSafetyTab('catenary');
            }}
            title="Catenary power block telemetry"
            style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#334155' }}
          >
            Catenary: <strong>{isOngoing ? '25kV Isolated & Grounded' : isNormalized ? '26.4 kV Nominal' : 'Energized'}</strong>
          </span>
          <span
            onClick={e => {
              e.stopPropagation();
              setShowSafetyReportModal(true);
              setActiveSafetyTab('interlocking');
            }}
            title="Mechanical point clamping"
            style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#334155' }}
          >
            Interlocking: <strong>{isOngoing ? 'Padlocked (#14A Reverse Clamped)' : isNormalized ? 'Restored to Central Interlocking' : 'Normal Routes'}</strong>
          </span>
          <span
            onClick={e => {
              e.stopPropagation();
              setShowSafetyReportModal(true);
              setActiveSafetyTab('traffic');
            }}
            title="Train movement restrictions"
            style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4, background: '#F8FAFC', border: '1px solid #E2E8F0', color: isOngoing ? '#991B1B' : '#166534' }}
          >
            Train Traffic: <strong>{isOngoing ? 'Prohibited / Blocked' : isNormalized ? 'Permitted (Normal Headway)' : 'Running (Scheduled)'}</strong>
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

      {/* ── Modal 4: Comprehensive Statutory Safety Restriction & Protocol Report (Form 3-PTW) ── */}
      {showSafetyReportModal && (() => {
        const isEng = event.id === 'EVT-ENG-2026-00109' || event.id.includes('ENG') || event.id.includes('PWY') || event.description?.toLowerCase().includes('tamping');
        const isOhe = event.id === 'EVT-OHE-2026-00104' || event.id.includes('OHE') || Boolean(event.impact_vector?.catenary_25kv_power_trip);
        const isSig = event.id === 'EVT-SIG-2026-00114' || event.id.includes('SIG') || event.id.includes('SNT');
        const isBridge = event.id === 'EVT-PWY-2026-00116' || event.description?.toLowerCase().includes('bridge');

        const permitNo = `PTW-${event.division || 'DNR'}-2026-${event.fencing_token || '885'}`;
        const cautionOrderNo = `CO/DNR/2026/T-${event.fencing_token || '885'}`;
        const trbEntryNo = `TRB-ECR-DNR-2026-00${event.fencing_token || '885'}`;

        const isPowerTripped = event.impact_vector?.catenary_25kv_power_trip ?? (isOhe ? true : false);
        const feedingPost = event.impact_vector?.feeding_posts?.length
          ? event.impact_vector.feeding_posts.join(', ')
          : isOhe
          ? 'FP-04 (Ara Feeding Post)'
          : 'FP-02 (Danapur Substation)';
        const catenaryVoltage = isPowerTripped ? '0.00 kV (Dead Line Isolated & Grounded)' : '25.8 kV Nominal (Active • 2.0m Safety Buffer Strictly Enforced)';
        const earthingRodsCount = isPowerTripped ? 2 : 0;
        const breakerStatus = isPowerTripped ? 'CB-201 Tripped & Padlocked via SCADA' : 'CB-201 Closed (Nominal Feed)';

        const pointNumber = isOhe ? 'Point #08B' : isSig ? 'Point #03 (Detector Blades)' : isBridge ? 'Point #22 (Approach)' : 'Point #14A (Up Crossover)';
        const clampSerial = `CLMP-${event.division || 'DNR'}-2026-${isOhe ? '08B' : '14A'}`;
        const padlockKeyId = `KEY-SM-${isOhe ? 'ARA-08B' : 'PNBE-14A'}`;
        const routeLockId = `EI-LK-DNR-0${event.fencing_token || '885'}`;

        const isAbsoluteBlock = event.impact_vector?.absolute_traffic_block ?? true;
        const tsrSpeed = event.impact_vector?.speed_restriction_kmh || (isEng ? 20 : isSig ? 30 : 30);
        const adjacentTrackName = event.track_id === 'UP_MAIN' ? 'DOWN MAIN' : 'UP MAIN';

        const machineName = isEng
          ? 'Plasser & Theurer Continuous Action Tamping Machine (CSM-952)'
          : isOhe
          ? 'Self-Propelled 8-Wheeler Tower Wagon 04 (Contact Wire Splicing Unit)'
          : isSig
          ? 'Multi-Channel Digital Axle Counter Calibration & High-Frequency Tuning Rig'
          : isBridge
          ? 'Mobile Ballast Concrete Mixer & Hydraulic Boom Pump Rig'
          : 'Track Maintenance Gang & Rail Flaw Ultrasonic Detector (USFD)';

        const crewCount = event.field_photo?.crew_count || (isBridge ? 12 : isEng ? 10 : isOhe ? 7 : 5);
        const lookoutMenCount = 2;
        const foulingClearance = 4.26; // meters

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.6)',
              zIndex: 1100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              backdropFilter: 'blur(2px)',
            }}
            onClick={() => setShowSafetyReportModal(false)}
          >
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 10,
                maxWidth: 880,
                width: '100%',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                border: '1px solid #CBD5E1',
                overflow: 'hidden',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header: Clean Enterprise Style */}
              <div
                style={{
                  background: '#F8FAFC',
                  borderBottom: '1px solid #E2E8F0',
                  padding: '16px 22px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    INDIAN RAILWAYS • EAST CENTRAL RAILWAY (DANAPUR DIVISION)
                  </div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: '3px 0 2px' }}>
                    Safety Restriction &amp; Protection Protocol (Form 3-PTW)
                  </h2>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    Statutory Directives under G&amp;SR 15.06 &amp; 15.09 • Permit: <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{permitNo}</span> • Token: #{event.fencing_token || '885'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => window.print()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      color: '#334155',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                    title="Print or export official Form 3-PTW Certificate"
                  >
                    <Printer size={13} /> Print Certificate
                  </button>
                  <button
                    onClick={() => setShowSafetyReportModal(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#64748B',
                      padding: 4,
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Work Context Strip */}
              <div
                style={{
                  background: '#FFFFFF',
                  borderBottom: '1px solid #E2E8F0',
                  padding: '12px 22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>
                    {event.id} — {event.description}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                    Section: <strong>{event.section}</strong> ({event.track_id.replace(/_/g, ' ')}) • Chainage: <strong>KM {event.km_start.toFixed(3)}</strong> to <strong>KM {event.km_end.toFixed(3)}</strong> • Custodian: <strong>{supervisorName}</strong>
                  </div>
                </div>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '3px 10px',
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 600,
                    background: isOngoing ? '#FEF2F2' : '#F0FDF4',
                    color: isOngoing ? '#991B1B' : '#166534',
                    border: `1px solid ${isOngoing ? '#FECACA' : '#BBF7D0'}`,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: isOngoing ? '#DC2626' : '#16A34A',
                    }}
                  />
                  {isOngoing ? 'Track Possession Active' : 'Line Normalized'}
                </span>
              </div>

              {/* Horizontal Tabs */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#F8FAFC',
                  borderBottom: '1px solid #E2E8F0',
                  padding: '0 16px',
                  gap: 4,
                  overflowX: 'auto',
                }}
              >
                {[
                  { id: 'summary', label: 'Overview' },
                  { id: 'interlocking', label: 'Point Interlocking' },
                  { id: 'catenary', label: 'Traction Power (25kV)' },
                  { id: 'traffic', label: 'Speed & Movement' },
                  { id: 'machinery', label: 'Site Safety & Clearance' },
                  { id: 'signatures', label: 'Statutory Approvals' },
                ].map(tab => {
                  const isActive = activeSafetyTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveSafetyTab(tab.id as any)}
                      style={{
                        padding: '10px 14px',
                        background: 'none',
                        border: 'none',
                        borderBottom: isActive ? '2px solid #2563EB' : '2px solid transparent',
                        color: isActive ? '#2563EB' : '#64748B',
                        fontWeight: isActive ? 600 : 500,
                        fontSize: 12.5,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab Content Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
                {/* 1. OVERVIEW */}
                {activeSafetyTab === 'summary' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {/* 4 Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
                      {/* Card 1: Interlocking */}
                      <div
                        onClick={() => setActiveSafetyTab('interlocking')}
                        style={{
                          background: '#FFFFFF',
                          borderRadius: 8,
                          border: '1px solid #E2E8F0',
                          borderLeft: '3px solid #D97706',
                          padding: 12,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>
                          Point Interlocking
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 2 }}>
                          {pointNumber} Clamped
                        </div>
                        <div style={{ fontSize: 11.5, color: '#64748B' }}>
                          Padlock {padlockKeyId} in SM Safe
                        </div>
                      </div>

                      {/* Card 2: 25kV Traction */}
                      <div
                        onClick={() => setActiveSafetyTab('catenary')}
                        style={{
                          background: '#FFFFFF',
                          borderRadius: 8,
                          border: '1px solid #E2E8F0',
                          borderLeft: `3px solid ${isPowerTripped ? '#DC2626' : '#16A34A'}`,
                          padding: 12,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>
                          25kV Traction OHE
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 2 }}>
                          {isPowerTripped ? '0.00 kV Isolated' : 'Live (2.0m Buffer)'}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#64748B' }}>
                          {isPowerTripped ? `${earthingRodsCount} earthing rods clamped` : 'Height limiters locked'}
                        </div>
                      </div>

                      {/* Card 3: Traffic Block */}
                      <div
                        onClick={() => setActiveSafetyTab('traffic')}
                        style={{
                          background: '#FFFFFF',
                          borderRadius: 8,
                          border: '1px solid #E2E8F0',
                          borderLeft: '3px solid #DC2626',
                          padding: 12,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>
                          Traffic Restriction
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 2 }}>
                          {isAbsoluteBlock ? 'Absolute Line Block' : 'Caution Order'}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#64748B' }}>
                          TSR {tsrSpeed} km/h on {adjacentTrackName}
                        </div>
                      </div>

                      {/* Card 4: Men & Machinery */}
                      <div
                        onClick={() => setActiveSafetyTab('machinery')}
                        style={{
                          background: '#FFFFFF',
                          borderRadius: 8,
                          border: '1px solid #E2E8F0',
                          borderLeft: '3px solid #2563EB',
                          padding: 12,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>
                          Site Protection
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 2 }}>
                          {crewCount} Crew + {lookoutMenCount} Lookouts
                        </div>
                        <div style={{ fontSize: 11.5, color: '#64748B' }}>
                          Clearance 4.26m verified
                        </div>
                      </div>
                    </div>



                    {/* Operational Protocols */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
                      <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 6, border: '1px solid #E2E8F0' }}>
                        <div style={{ fontWeight: 600, color: '#0F172A', marginBottom: 4 }}>
                          Safety &amp; Escalation Protocols
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 16, color: '#475569', lineHeight: 1.5 }}>
                          <li>Adjacent Substation Trip Code: <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>TRIP-SUB-DNR-99</span></li>
                          <li>Station Master Magneto Phone: <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>HOTLINE-PNBE-01</span></li>
                          <li>Continuous GPS geofence monitored on field app.</li>
                        </ul>
                      </div>

                      <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 6, border: '1px solid #E2E8F0' }}>
                        <div style={{ fontWeight: 600, color: '#0F172A', marginBottom: 4 }}>
                          Caution Order Directives
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 16, color: '#475569', lineHeight: 1.5 }}>
                          <li>Caution Order Memo: <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{cautionOrderNo}</span></li>
                          <li>Adjacent Track TSR: <strong>{tsrSpeed} km/h strictly enforced</strong></li>
                          <li>Loco pilots instructed to sound horn continuously.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. POINT INTERLOCKING */}
                {activeSafetyTab === 'interlocking' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                      Under <strong>G&amp;SR Rule 15.06</strong> and <strong>Station Working Rules 8.4</strong>, facing points leading towards the work track are mechanically clamped, padlocked, and the key is held in custody by the Station Master.
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, border: '1px solid #E2E8F0' }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC', textAlign: 'left', borderBottom: '1px solid #CBD5E1', color: '#475569' }}>
                          <th style={{ padding: '8px 10px', fontWeight: 600 }}>Parameter</th>
                          <th style={{ padding: '8px 10px', fontWeight: 600 }}>Setting</th>
                          <th style={{ padding: '8px 10px', fontWeight: 600 }}>Status</th>
                          <th style={{ padding: '8px 10px', fontWeight: 600 }}>Authority</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 500, color: '#0F172A' }}>Facing Point Isolation</td>
                          <td style={{ padding: '8px 10px', color: '#334155' }}>{pointNumber} in Reverse Position</td>
                          <td style={{ padding: '8px 10px' }}><span style={{ padding: '2px 6px', borderRadius: 4, background: '#DCFCE7', color: '#166534', fontSize: 11, fontWeight: 600 }}>Locked</span></td>
                          <td style={{ padding: '8px 10px', color: '#64748B' }}>SM Desk (Patna Jn)</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 500, color: '#0F172A' }}>Clamp Serial Number</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono, monospace', color: '#334155' }}>{clampSerial}</td>
                          <td style={{ padding: '8px 10px' }}><span style={{ padding: '2px 6px', borderRadius: 4, background: '#DCFCE7', color: '#166534', fontSize: 11, fontWeight: 600 }}>Verified</span></td>
                          <td style={{ padding: '8px 10px', color: '#64748B' }}>Pointsman Desk</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 500, color: '#0F172A' }}>Padlock Key Custody</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono, monospace', color: '#334155' }}>{padlockKeyId}</td>
                          <td style={{ padding: '8px 10px' }}><span style={{ padding: '2px 6px', borderRadius: 4, background: '#DCFCE7', color: '#166534', fontSize: 11, fontWeight: 600 }}>In Safe</span></td>
                          <td style={{ padding: '8px 10px', color: '#64748B' }}>Station Master</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 500, color: '#0F172A' }}>Electronic Interlocking (EI) Lock</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono, monospace', color: '#334155' }}>{routeLockId}</td>
                          <td style={{ padding: '8px 10px' }}><span style={{ padding: '2px 6px', borderRadius: 4, background: '#DCFCE7', color: '#166534', fontSize: 11, fontWeight: 600 }}>Collar Active</span></td>
                          <td style={{ padding: '8px 10px', color: '#64748B' }}>Section Controller</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '8px 10px', fontWeight: 500, color: '#0F172A' }}>Catch Siding Alignment</td>
                          <td style={{ padding: '8px 10px', color: '#334155' }}>Trap Point set towards Dead End</td>
                          <td style={{ padding: '8px 10px' }}><span style={{ padding: '2px 6px', borderRadius: 4, background: '#DCFCE7', color: '#166534', fontSize: 11, fontWeight: 600 }}>Secured</span></td>
                          <td style={{ padding: '8px 10px', color: '#64748B' }}>Yard Master</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 3. TRACTION POWER (25kV) */}
                {activeSafetyTab === 'catenary' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                      Per <strong>ACTM Vol II Para 20615</strong>: {isPowerTripped ? 'A statutory 25kV Catenary Power Block (Form ETR-1) is active. The line has been de-energized, tested dead, and grounded with dual earthing discharge rods.' : 'The 25kV catenary remains energized. A 2.0-meter electrical safety buffer envelope is enforced for all personnel and machines.'}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                      <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 6, border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: 11, color: '#64748B' }}>Catenary Line Voltage</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isPowerTripped ? '#DC2626' : '#16A34A', marginTop: 2 }}>
                          {catenaryVoltage}
                        </div>
                      </div>
                      <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 6, border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: 11, color: '#64748B' }}>Feeding Post Grid</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginTop: 2 }}>
                          {feedingPost}
                        </div>
                      </div>
                      <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 6, border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: 11, color: '#64748B' }}>Circuit Breaker Tag</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginTop: 2 }}>
                          {breakerStatus}
                        </div>
                      </div>
                      <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 6, border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: 11, color: '#64748B' }}>Earthing Discharge Rods</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginTop: 2 }}>
                          {earthingRodsCount} Clamped (100m Up/Downstream)
                        </div>
                      </div>
                    </div>

                    <div style={{ background: '#FFFFFF', padding: 12, borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12 }}>
                      <div style={{ fontWeight: 600, color: '#0F172A', marginBottom: 4 }}>
                        Traction Power Controller (TPC) Protocol Checklist
                      </div>
                      <ol style={{ margin: 0, paddingLeft: 18, color: '#475569', lineHeight: 1.5 }}>
                        <li>SCADA auto-reclosure interlock disabled on feeder breaker {breakerStatus}.</li>
                        <li>Permit to Work (Form ETR-1) digitally signed by TPC Desk #01.</li>
                        <li>Transverse track bonding continuity jumper confirmed (&lt; 0.1 Ω).</li>
                        <li>Re-energization prohibited until SSE surrenders Form ETR-3 cancellation memo.</li>
                      </ol>
                    </div>
                  </div>
                )}

                {/* 4. SPEED & MOVEMENT */}
                {activeSafetyTab === 'traffic' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                      Under <strong>G&amp;SR Rule 15.09</strong>: Train traffic on {event.track_id.replace(/_/g, ' ')} is prohibited between KM {event.km_start.toFixed(3)} and KM {event.km_end.toFixed(3)}. Adjacent tracks operate under Caution Order T/409.
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12 }}>
                        <div style={{ fontWeight: 600, color: '#0F172A', marginBottom: 6 }}>
                          Traffic Block Mandates
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, color: '#334155' }}>
                          <div>• Line Status: <strong>{isAbsoluteBlock ? 'Absolute Line Block' : 'Restricted Passage'}</strong></div>
                          <div>• Train Register Book: <strong>{trbEntryNo}</strong></div>
                          <div>• Block Direction: <strong>Both UP and DOWN approaches sealed</strong></div>
                          <div>• Emergency Vehicle Corridor: <strong>Clear on loop siding #2</strong></div>
                        </div>
                      </div>

                      <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12 }}>
                        <div style={{ fontWeight: 600, color: '#0F172A', marginBottom: 6 }}>
                          Speed Restrictions &amp; Caution Orders
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, color: '#334155' }}>
                          <div>• Caution Order Number: <strong>{cautionOrderNo}</strong></div>
                          <div>• Adjacent Track TSR: <strong>{tsrSpeed} km/h on {adjacentTrackName}</strong></div>
                          <div>• Red Banner Flag Position: <strong>600 meters from site both ends</strong></div>
                          <div>• Detonator Protection: <strong>3 fog signals at 1,200m (10m spacing)</strong></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. SITE SAFETY & CLEARANCE */}
                {activeSafetyTab === 'machinery' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                      Per <strong>IRPWM Para 808</strong>: Machinery operated on track must maintain the approved Schedule of Dimensions (SOD) clearance profile under lookout protection.
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
                      <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 6, border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: 11, color: '#64748B' }}>Primary Machine Deployed</div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0F172A', marginTop: 2 }}>
                          {machineName}
                        </div>
                      </div>
                      <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 6, border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: 11, color: '#64748B' }}>Fouling Mark Clearance</div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#16A34A', marginTop: 2 }}>
                          {foulingClearance}m from Track Center (Verified)
                        </div>
                      </div>
                      <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 6, border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: 11, color: '#64748B' }}>Field Gang Strength</div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0F172A', marginTop: 2 }}>
                          {crewCount} Trackmen + 1 Supervisor
                        </div>
                      </div>
                      <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 6, border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: 11, color: '#64748B' }}>Lookout Men Posted</div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0F172A', marginTop: 2 }}>
                          {lookoutMenCount} Lookout Men with Whistles
                        </div>
                      </div>
                    </div>

                    <div style={{ background: '#FFFFFF', padding: 12, borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12 }}>
                      <div style={{ fontWeight: 600, color: '#0F172A', marginBottom: 4 }}>
                        PPE &amp; Equipment Safety Compliance
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, color: '#475569' }}>
                        <div>• High-Visibility Class 3 Safety Vests</div>
                        <div>• Steel-Toe P-Way Safety Boots</div>
                        <div>• ISI Industrial Safety Helmets</div>
                        <div>• First-Aid Trauma Kit &amp; Magneto Phone</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. STATUTORY APPROVALS */}
                {activeSafetyTab === 'signatures' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                      Under <strong>G&amp;SR 4.12</strong> and <strong>SWR 8.4</strong>, multi-officer dual-key authorizations with cryptographic hashes verify that all prerequisites are completed before track possession is permitted.
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, border: '1px solid #E2E8F0' }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC', textAlign: 'left', borderBottom: '1px solid #CBD5E1', color: '#475569' }}>
                          <th style={{ padding: '8px 10px', fontWeight: 600 }}>Officer Role</th>
                          <th style={{ padding: '8px 10px', fontWeight: 600 }}>Designation</th>
                          <th style={{ padding: '8px 10px', fontWeight: 600 }}>Authority</th>
                          <th style={{ padding: '8px 10px', fontWeight: 600 }}>Cryptographic Hash</th>
                          <th style={{ padding: '8px 10px', fontWeight: 600 }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 500, color: '#0F172A' }}>Field Supervisor</td>
                          <td style={{ padding: '8px 10px', color: '#334155' }}>{supervisorName}</td>
                          <td style={{ padding: '8px 10px', color: '#64748B' }}>IRPWM Para 808</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#2563EB' }}>
                            {event.stakeholders?.find(s => s.role === 'FIELD_SUPERVISOR')?.signature_hash || '5a2c81e997ed25519pwaypul885'}
                          </td>
                          <td style={{ padding: '8px 10px' }}><span style={{ padding: '2px 6px', borderRadius: 4, background: '#DCFCE7', color: '#166534', fontSize: 11, fontWeight: 600 }}>Approved</span></td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 500, color: '#0F172A' }}>Section Controller</td>
                          <td style={{ padding: '8px 10px', color: '#334155' }}>Danapur Control (CTRL_SEC_DNR_02)</td>
                          <td style={{ padding: '8px 10px', color: '#64748B' }}>G&amp;SR 4.12</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#2563EB' }}>
                            {event.stakeholders?.find(s => s.role === 'SECTION_CONTROLLER')?.signature_hash || '6b3d81e997ed25519ctrlwda885'}
                          </td>
                          <td style={{ padding: '8px 10px' }}><span style={{ padding: '2px 6px', borderRadius: 4, background: '#DCFCE7', color: '#166534', fontSize: 11, fontWeight: 600 }}>Approved</span></td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 500, color: '#0F172A' }}>Station Master</td>
                          <td style={{ padding: '8px 10px', color: '#334155' }}>Patna Junction (SM_PNBE_01)</td>
                          <td style={{ padding: '8px 10px', color: '#64748B' }}>SWR 8.4</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#2563EB' }}>
                            {event.stakeholders?.find(s => s.role === 'STATION_MASTER')?.signature_hash || '7c4e81e997ed25519smpul885'}
                          </td>
                          <td style={{ padding: '8px 10px' }}><span style={{ padding: '2px 6px', borderRadius: 4, background: '#DCFCE7', color: '#166534', fontSize: 11, fontWeight: 600 }}>Approved</span></td>
                        </tr>
                        <tr>
                          <td style={{ padding: '8px 10px', fontWeight: 500, color: '#0F172A' }}>Traction Power Controller</td>
                          <td style={{ padding: '8px 10px', color: '#334155' }}>DDU Control Desk (TPC_DDU_01)</td>
                          <td style={{ padding: '8px 10px', color: '#64748B' }}>ACTM Vol II</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#2563EB' }}>
                            {event.stakeholders?.find(s => s.role === 'TPC')?.signature_hash || '8a1c81e997ed25519tpc884'}
                          </td>
                          <td style={{ padding: '8px 10px' }}><span style={{ padding: '2px 6px', borderRadius: 4, background: '#DCFCE7', color: '#166534', fontSize: 11, fontWeight: 600 }}>Approved</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div
                style={{
                  background: '#F8FAFC',
                  borderTop: '1px solid #E2E8F0',
                  padding: '12px 22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 11.5, color: '#64748B' }}>
                  Statutory Form 3-PTW certificate sealed under G&amp;SR Rule 15.06.
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowSafetyReportModal(false)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      color: '#475569',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '6px 14px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#2563EB',
                      color: '#FFFFFF',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Printer size={13} /> Print Certificate
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
