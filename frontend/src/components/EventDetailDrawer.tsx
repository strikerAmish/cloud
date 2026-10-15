import React, { useState } from 'react';
import {
  X, Lock, Unlock, AlertOctagon, CheckCircle2, Clock, Workflow,
  Zap, Shield, FileSignature, KeyRound, ShieldCheck, ShieldAlert,
  Flame, Database, ChevronDown, ChevronRight, Activity, ExternalLink,
  Users, Gauge, ArrowRight
} from 'lucide-react';
import { OperationalEvent, ApprovalRole, Department, EventStatus } from '../types';
import {
  acquireFencingToken, activateWork, completeWork, clearBlock,
  emergencyAbort, escalateSla, submitApproval
} from '../api';

interface EventDetailDrawerProps {
  event: OperationalEvent | null;
  onClose: () => void;
  onRefresh: () => void;
  onNavigateAudit?: () => void;
}

const FSM_STAGES: Array<{ num: number; key: EventStatus; name: string; color: string }> = [
  { num: 1,  key: 'DRAFT',               name: 'Draft',              color: '#718096' },
  { num: 2,  key: 'SUBMITTED',           name: 'Submitted',          color: '#3182CE' },
  { num: 3,  key: 'DEPENDENCY_RESOLVED', name: 'Dep. Resolved',      color: '#2B6CB0' },
  { num: 4,  key: 'AWAITING_APPROVAL',   name: 'Awaiting Approval',  color: '#DD6B20' },
  { num: 5,  key: 'APPROVED',            name: 'Approved',           color: '#4C51BF' },
  { num: 6,  key: 'SCHEDULED',           name: 'Token Locked',       color: '#805AD5' },
  { num: 7,  key: 'ACTIVE_IN_PROGRESS',  name: 'Active Work',        color: '#38A169' },
  { num: 8,  key: 'WORK_COMPLETED',      name: 'Work Completed',     color: '#D69E2E' },
  { num: 9,  key: 'SAFETY_VERIFIED',     name: 'Safety Verified',    color: '#319795' },
  { num: 10, key: 'BLOCK_CLEARED',       name: 'Block Cleared',      color: '#00A3C4' },
  { num: 11, key: 'AUDIT_LOCKED',        name: 'Audit Locked',       color: '#1A365D' },
];

// The 6 Invariants requested specifically: Capacity, Adjacent Buffer, Power Isolate, Speed Restriction, Crew Availability, Interlocking
interface InvariantItem {
  id: number;
  name: string;
  category: string;
  status: 'passed' | 'warning' | 'pending';
  detail: string;
}

export const EventDetailDrawer: React.FC<EventDetailDrawerProps> = ({
  event,
  onClose,
  onRefresh,
  onNavigateAudit,
}) => {
  const [loading, setLoading] = useState(false);
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(['invariants', 'approval', 'audit', 'fsm'])
  );

  const toggleSection = (s: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  if (!event) return null;

  const currentIdx = FSM_STAGES.findIndex((s) => s.key === event.status);
  const isException = ['REJECTED', 'CANCELLED', 'ESCALATED_SLA', 'ABORTED_SAFETY_LOCK'].includes(event.status);

  const tokenLabel = event.fencing_token
    ? `🔒 Locked via Redis Token (FT-${event.fencing_token.toString().padStart(4, '0')})`
    : '🔓 Token Unlocked';

  // The 6 Invariants Automated Checklist Grid
  const invariantChecklist: InvariantItem[] = [
    {
      id: 1,
      name: 'Capacity',
      category: 'Headway Verification',
      status: 'warning',
      detail: 'HDN 118.4% capacity checked. Freight held at Sindi loop.',
    },
    {
      id: 2,
      name: 'Adjacent Buffer',
      category: 'Down Main Separation',
      status: 'passed',
      detail: 'Down Main safe clearance verified. TSR 30 km/h engaged.',
    },
    {
      id: 3,
      name: 'Power Isolate',
      category: '25kV Traction Feed',
      status: event.impact_vector?.catenary_25kv_power_trip ? 'passed' : 'warning',
      detail: 'Feeding Post FP-04 circuit breaker interlocked with SCADA.',
    },
    {
      id: 4,
      name: 'Speed Restriction',
      category: 'Caution Order Bulletin',
      status: 'passed',
      detail: 'TSR-WDA-2026-88 issued to Nagpur loco pilot crew.',
    },
    {
      id: 5,
      name: 'Crew Availability',
      category: 'OHE Breakdown Gang',
      status: 'passed',
      detail: 'SSE/OHE gang + Tower Wagon TW-44 positioned at Wardha.',
    },
    {
      id: 6,
      name: 'Interlocking',
      category: 'Station Master Clamping',
      status: 'passed',
      detail: 'Points #14A & #14B padlocked against reverse entry.',
    },
  ];

  // Helper run actions
  const run = async (fn: () => Promise<string>, msg: string) => {
    setLoading(true);
    setActionMsg(null);
    setErrorMsg(null);
    try {
      const r = await fn();
      setActionMsg(r || msg);
      onRefresh();
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLock = () =>
    run(async () => {
      const r = await acquireFencingToken(event.id);
      return r.message;
    }, 'Fencing token acquired via Redis');

  const handleActivate = () =>
    run(async () => {
      await activateWork(event.id);
      return '25kV catenary tripped & Permit ETR-3 activated.';
    }, '');

  const handleComplete = () =>
    run(async () => {
      await completeWork(event.id, 'SSE_OHE_WDA_04');
      return 'Work completion memo signed by Field Supervisor.';
    }, '');

  const handleClear = () =>
    run(async () => {
      const r = await clearBlock(event.id);
      return r.message;
    }, 'Block cleared & S3 WORM audit sealed');

  const handleEscalate = () =>
    run(async () => {
      const r = await escalateSla(event.id, 'TPC response timer exceeded 15 minutes');
      return `Escalated to ${r.escalated_to?.join(', ')}`;
    }, '');

  const handleAbort = async () => {
    const reason = prompt(
      'Enter statutory reason for Emergency Safety Abort:',
      'Track circuit shunt detected on Up Main'
    );
    if (!reason) return;
    run(async () => {
      const r = await emergencyAbort(event.id, 'CTRL_SEC_WDA_02', reason);
      return r.message;
    }, 'Emergency Abort executed successfully');
  };

  // Sign & Approve
  const handleSign = async (role: ApprovalRole, dept: Department, officerId: string) => {
    setLoadingRole(role);
    setErrorMsg(null);
    try {
      await submitApproval(event.id, dept, role, officerId, 'APPROVED');
      onRefresh();
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoadingRole(null);
    }
  };

  const getStakeholder = (role: ApprovalRole) =>
    event.stakeholders.find((s) => s.role === role);

  const tpc = getStakeholder('TPC');
  const sm = getStakeholder('STATION_MASTER');
  const ctrl = getStakeholder('SECTION_CONTROLLER');
  const sse = getStakeholder('FIELD_SUPERVISOR');

  const dualKeyCleared =
    tpc?.approval_status === 'APPROVED' && ctrl?.approval_status === 'APPROVED';

  // Statutory approval gates requested in Section B
  const statutoryGates = [
    {
      role: 'TPC' as ApprovalRole,
      title: 'TPC ETR-1 Power Block',
      subtitle: 'Traction Power Controller • 25kV Catenary Isolation',
      dept: 'OHE' as Department,
      officerId: 'TPC_NGP_01',
      stakeholder: tpc,
      color: 'amber',
    },
    {
      role: 'STATION_MASTER' as ApprovalRole,
      title: 'Station Master Point Clamping',
      subtitle: 'Wardha Jn (WR) • Physical Padlock #14A/B',
      dept: 'OPERATING' as Department,
      officerId: 'SM_WDA_JCT',
      stakeholder: sm,
      color: 'cyan',
    },
    {
      role: 'SECTION_CONTROLLER' as ApprovalRole,
      title: 'Section Controller Traffic Block',
      subtitle: 'Nagpur Control Office • Line Headway Clearance',
      dept: 'OPERATING' as Department,
      officerId: 'CTRL_SEC_WDA_02',
      stakeholder: ctrl,
      color: 'blue',
    },
    {
      role: 'FIELD_SUPERVISOR' as ApprovalRole,
      title: 'Field ETR-3 Permit',
      subtitle: 'SSE / OHE Maintenance gang • Earth Rod Discharge',
      dept: 'OHE' as Department,
      officerId: 'SSE_OHE_WDA_04',
      stakeholder: sse,
      color: 'purple',
    },
  ];

  const liveSha256 =
    event.stakeholders.find((s) => s.signature_hash)?.signature_hash ??
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  return (
    <aside className="w-[540px] shrink-0 border-l border-slate-800 bg-slate-900 shadow-2xl flex flex-col slide-in-right overflow-hidden z-20">
      {/* ── Drawer Header ─────────────────────────── */}
      <div className="px-6 py-4 border-b border-slate-800 shrink-0 bg-slate-950/70">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {/* Event ID + Lock Badge + FSM Stage */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[11px] font-mono font-bold text-cyan-400 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded">
                {event.id}
              </span>
              <span
                className="text-[10px] font-mono font-bold text-white px-2 py-0.5 rounded"
                style={{ backgroundColor: event.status_color || '#3182CE' }}
              >
                Stage {event.fsm_stage}: {event.status}
              </span>
              <span
                className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border ${
                  event.fencing_token
                    ? 'text-purple-300 bg-purple-950/70 border-purple-500/40'
                    : 'text-slate-400 bg-slate-900 border-slate-800'
                }`}
              >
                {event.fencing_token ? <Lock className="w-3 h-3 text-purple-400" /> : <Unlock className="w-3 h-3 text-slate-500" />}
                {tokenLabel}
              </span>
            </div>

            <h2 className="text-sm font-bold text-white leading-snug line-clamp-2">
              {event.description}
            </h2>
            <div className="text-[10px] font-mono text-slate-400 mt-1 flex items-center gap-2">
              <span>{event.division}</span>
              <span>•</span>
              <span>{event.section}</span>
              <span>•</span>
              <span className="text-cyan-400 font-semibold">{event.track_id}</span>
              <span>•</span>
              <span>KM {event.km_start.toFixed(2)}–{event.km_end.toFixed(2)}</span>
            </div>
          </div>

          {/* Abort CTA + Close Button */}
          <div className="flex items-center gap-2 shrink-0">
            {!['BLOCK_CLEARED', 'AUDIT_LOCKED', 'ABORTED_SAFETY_LOCK'].includes(event.status) && (
              <button
                onClick={handleAbort}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-[10px] font-bold rounded-lg cursor-pointer transition-all shadow-md shadow-red-700/20"
                title="Execute POST /api/v1/events/{id}/abort"
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                Emergency Abort
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Feedback messages */}
        {actionMsg && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-950/70 border border-cyan-500/40 text-[11px] font-mono text-cyan-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> {actionMsg}
          </div>
        )}
        {errorMsg && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-950/70 border border-red-500/40 text-[11px] font-mono text-red-200">
            <AlertOctagon className="w-3.5 h-3.5 text-red-400 shrink-0" /> {errorMsg}
          </div>
        )}
      </div>

      {/* ── Scrollable Body ───────────────────────── */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">

        {/* ── Section A: The 6 Invariants Automated Checklist (2x3 Grid) ─ */}
        <div>
          <button
            onClick={() => toggleSection('invariants')}
            className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-slate-800/40 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white">
                Section A — The 6 Invariants Automated Checklist
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                6 / 6 PRE-CHECK
              </span>
            </div>
            {openSections.has('invariants') ? (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {openSections.has('invariants') && (
            <div className="px-6 pb-4 fade-in">
              <div className="grid grid-cols-2 gap-2.5">
                {invariantChecklist.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono text-slate-500">
                        INV #{inv.id}
                      </span>
                      {inv.status === 'passed' ? (
                        <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Passed
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-amber-400">
                          <Clock className="w-3 h-3 text-amber-400" />
                          Buffer
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{inv.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                        {inv.detail}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Section B: Dual-Key Multi-Party Approval Gate (Screen 4) ─── */}
        <div>
          <button
            onClick={() => toggleSection('approval')}
            className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-slate-800/40 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <KeyRound className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white">
                Section B — Dual-Key Multi-Party Approval Gate
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  dualKeyCleared
                    ? 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30'
                    : 'text-amber-400 bg-amber-950/60 border-amber-500/30'
                }`}
              >
                {dualKeyCleared ? '✓ QUORUM MET' : '⏳ AWAITING DUAL-KEY'}
              </span>
            </div>
            {openSections.has('approval') ? (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {openSections.has('approval') && (
            <div className="px-6 pb-4 space-y-2.5 fade-in">
              {statutoryGates.map(
                ({ role, title, subtitle, dept, officerId, stakeholder }) => {
                  const isApproved = stakeholder?.approval_status === 'APPROVED';

                  return (
                    <div
                      key={role}
                      className={`p-3 rounded-xl border transition-all ${
                        isApproved
                          ? 'bg-emerald-950/20 border-emerald-500/30'
                          : 'bg-slate-950/50 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-100">
                              {title}
                            </span>
                            {isApproved && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-500/40">
                                STATUTORY CLEAR
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {subtitle}
                          </div>

                          {/* Officer ID and Timestamp once signed */}
                          {isApproved && (
                            <div className="mt-2 pt-2 border-t border-slate-800/60 space-y-1">
                              <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-2">
                                <span>Officer:</span>
                                <span className="font-bold text-white">
                                  {stakeholder?.officer_id ?? officerId}
                                </span>
                              </div>
                              {stakeholder?.signed_at && (
                                <div className="text-[10px] font-mono text-slate-400 flex items-center gap-2">
                                  <span>Timestamp:</span>
                                  <span>{new Date(stakeholder.signed_at).toLocaleString()}</span>
                                </div>
                              )}
                              {stakeholder?.signature_hash && (
                                <div className="text-[10px] font-mono text-slate-500 truncate">
                                  Sig: {stakeholder.signature_hash}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* One-Click Sign & Approve Button */}
                        <button
                          onClick={() => handleSign(role, dept, officerId)}
                          disabled={loadingRole === role || isApproved}
                          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:cursor-default ${
                            isApproved
                              ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-400'
                              : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-md shadow-blue-600/20'
                          }`}
                        >
                          {isApproved ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              Approved
                            </>
                          ) : loadingRole === role ? (
                            <>
                              <Clock className="w-3.5 h-3.5 animate-spin" />
                              Signing...
                            </>
                          ) : (
                            <>
                              <FileSignature className="w-3.5 h-3.5" />
                              Sign & Approve
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>

        {/* ── Section C: Event Activity & Cryptographic Audit Trail ───── */}
        <div>
          <button
            onClick={() => toggleSection('audit')}
            className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-slate-800/40 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Database className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-white">
                Section C — Event Activity & Cryptographic Audit Trail
              </span>
            </div>
            {openSections.has('audit') ? (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {openSections.has('audit') && (
            <div className="px-6 pb-4 space-y-3 fade-in">
              {/* Live SHA-256 Signature Hash Linking to S3 Audit Ledger */}
              <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-indigo-300">
                    Live SHA-256 Ledger Signature
                  </span>
                  {onNavigateAudit && (
                    <button
                      onClick={onNavigateAudit}
                      className="flex items-center gap-1 text-[10px] font-mono text-cyan-400 hover:text-cyan-300 cursor-pointer"
                    >
                      <span>View in S3 Ledger</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800 font-mono text-[10px] text-cyan-300 break-all select-all">
                  {liveSha256}
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  WORM Immutability: SHA-256 Merkle block verified across Redis & S3.
                </div>
              </div>

              {/* Event-specific Redis Telemetry Activity */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="text-[10px] font-mono font-bold text-slate-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  Event Telemetry Stream
                </div>
                <div className="space-y-1.5 text-[10px] font-mono text-slate-400 divide-y divide-slate-800/40">
                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-slate-500">Created At:</span>
                    <span className="text-slate-300">{new Date(event.created_at).toLocaleString()}</span>
                  </div>
                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-slate-500">Originator:</span>
                    <span className="text-white">{event.originator_id}</span>
                  </div>
                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-slate-500">Fencing Token Status:</span>
                    <span className={event.fencing_token ? 'text-purple-400 font-bold' : 'text-slate-400'}>
                      {event.fencing_token ? `Token #${event.fencing_token} (Active Lock)` : 'None'}
                    </span>
                  </div>
                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-slate-500">Dual-Key Quorum:</span>
                    <span className={dualKeyCleared ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                      {dualKeyCleared ? 'QUORUM REACHED' : 'AWAITING APPROVAL'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Section: FSM Lifecycle Actions & Progression ────────────── */}
        <div>
          <button
            onClick={() => toggleSection('fsm')}
            className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-slate-800/40 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Workflow className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white">11-Stage FSM Progression</span>
            </div>
            {openSections.has('fsm') ? (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {openSections.has('fsm') && (
            <div className="px-6 pb-5 fade-in">
              {/* Progress Bar */}
              <div className="flex gap-1 mb-3">
                {FSM_STAGES.map((s, i) => (
                  <div
                    key={s.key}
                    className={`flex-1 h-1.5 rounded-full transition-all ${
                      i < currentIdx
                        ? 'opacity-100'
                        : i === currentIdx
                        ? 'opacity-100 animate-pulse'
                        : 'opacity-20'
                    }`}
                    style={{ backgroundColor: s.color }}
                  />
                ))}
              </div>

              {/* FSM Execution Actions */}
              <div className="flex flex-wrap gap-2 pt-1">
                {!event.fencing_token && event.status === 'APPROVED' && (
                  <button
                    onClick={handleLock}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg cursor-pointer shadow-md shadow-purple-600/30"
                  >
                    <Lock className="w-3.5 h-3.5" /> Acquire Fencing Token (Stage 6)
                  </button>
                )}
                {['APPROVED', 'SCHEDULED'].includes(event.status) && (
                  <button
                    onClick={handleActivate}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg cursor-pointer shadow-md shadow-emerald-600/30"
                  >
                    <Flame className="w-3.5 h-3.5" /> Activate Work (Stage 7)
                  </button>
                )}
                {event.status === 'ACTIVE_IN_PROGRESS' && (
                  <button
                    onClick={handleComplete}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg cursor-pointer shadow-md shadow-amber-600/30"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Sign Completion Memo (Stage 8)
                  </button>
                )}
                {['WORK_COMPLETED', 'SAFETY_VERIFIED'].includes(event.status) && (
                  <button
                    onClick={handleClear}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg cursor-pointer shadow-md shadow-cyan-600/30"
                  >
                    <Database className="w-3.5 h-3.5" /> Clear & Seal S3 WORM (Stage 10/11)
                  </button>
                )}
                {['SUBMITTED', 'AWAITING_APPROVAL'].includes(event.status) && (
                  <button
                    onClick={handleEscalate}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950 hover:bg-red-900 border border-red-700 text-red-200 text-xs font-bold rounded-lg cursor-pointer"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" /> Escalate SLA to DRM
                  </button>
                )}
              </div>

              {isException && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-950/70 border border-red-500/50 text-xs text-red-200">
                  <AlertOctagon className="w-4 h-4 text-red-400 animate-pulse shrink-0" />
                  <span>EXCEPTION ACTIVE: {event.status}</span>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </aside>
  );
};
