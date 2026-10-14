import React, { useState } from 'react';
import {
  Workflow,
  Lock,
  Unlock,
  AlertOctagon,
  Flame,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Radio,
  FileCheck2,
  Database
} from 'lucide-react';
import { OperationalEvent, EventStatus } from '../types';
import { acquireFencingToken, activateWork, completeWork, clearBlock, emergencyAbort, escalateSla } from '../api';

interface FsmLifecycleViewProps {
  event: OperationalEvent | null;
  onRefresh: () => void;
}

const FSM_STAGES: Array<{ num: number; key: EventStatus; name: string; color: string; desc: string }> = [
  { num: 1, key: 'DRAFT', name: 'Draft', color: '#718096', desc: 'Initial requisition drafted. No live corridor state altered.' },
  { num: 2, key: 'SUBMITTED', name: 'Submitted', color: '#3182CE', desc: 'Pydantic validation passed. ACTM & G&SR rules checked.' },
  { num: 3, key: 'DEPENDENCY_RESOLVED', name: 'Dependency Resolved', color: '#2B6CB0', desc: 'Topological track graph analyzed. 6 Invariants resolved.' },
  { num: 4, key: 'AWAITING_APPROVAL', name: 'Awaiting Approval', color: '#DD6B20', desc: 'Concurrent payloads dispatched to TPC & Section Controller.' },
  { num: 5, key: 'APPROVED', name: 'Approved', color: '#4C51BF', desc: 'Dual-key statutory sign-offs executed via cryptographic signatures.' },
  { num: 6, key: 'SCHEDULED', name: 'Fenced Token Locked', color: '#805AD5', desc: 'Redis distributed fencing token acquired. Corridor reserved.' },
  { num: 7, key: 'ACTIVE_IN_PROGRESS', name: 'Active In Progress', color: '#38A169', desc: 'SM points clamped; 25kV de-energized (ETR-1); earth rods applied (ETR-3).' },
  { num: 8, key: 'WORK_COMPLETED', name: 'Work Completed', color: '#D69E2E', desc: 'Maintenance finished. Earth rods removed. Memo signed.' },
  { num: 9, key: 'SAFETY_VERIFIED', name: 'Safety Verified', color: '#319795', desc: 'Joint safety clearance verified (Overhead, points, interlocks).' },
  { num: 10, key: 'BLOCK_CLEARED', name: 'Block Cleared', color: '#00A3C4', desc: '25kV re-energized; point clamps removed; traffic resumed.' },
  { num: 11, key: 'AUDIT_LOCKED', name: 'Audit Locked', color: '#1A365D', desc: 'SHA-256 Merkle block permanently sealed into S3 WORM storage.' },
];

export const FsmLifecycleView: React.FC<FsmLifecycleViewProps> = ({ event, onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  if (!event) {
    return (
      <div className="p-8 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-xl">
        No Operational Event selected. Select an event from the Corridor Video Wall or create a new requisition.
      </div>
    );
  }

  const currentStageIndex = FSM_STAGES.findIndex((s) => s.key === event.status);
  const isException = ['REJECTED', 'CANCELLED', 'ESCALATED_SLA', 'ABORTED_SAFETY_LOCK'].includes(event.status);

  const handleAcquireLock = async () => {
    setLoading(true);
    setActionMsg(null);
    try {
      const res = await acquireFencingToken(event.id);
      setActionMsg(res.message);
      onRefresh();
    } catch (err: any) {
      setActionMsg(`Lock Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    setLoading(true);
    try {
      await activateWork(event.id);
      setActionMsg('Work activated! 25kV power tripped & Permit ETR-3 active.');
      onRefresh();
    } catch (err: any) {
      setActionMsg(`Activation Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      await completeWork(event.id, 'SSE_OHE_WDA_04');
      setActionMsg('Work completion memo signed. Earth discharge rods removed.');
      onRefresh();
    } catch (err: any) {
      setActionMsg(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    setLoading(true);
    try {
      const res = await clearBlock(event.id);
      setActionMsg(res.message);
      onRefresh();
    } catch (err: any) {
      setActionMsg(`Clear Block Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAbort = async () => {
    const reason = prompt('Enter statutory reason for Emergency Safety Abort:', 'Track circuit shunt detected on Up Main');
    if (!reason) return;
    setLoading(true);
    try {
      const res = await emergencyAbort(event.id, 'CTRL_SEC_WDA_02', reason);
      setActionMsg(res.message);
      onRefresh();
    } catch (err: any) {
      setActionMsg(`Abort Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEscalate = async () => {
    setLoading(true);
    try {
      const res = await escalateSla(event.id, 'TPC response timer exceeded 15 minutes');
      setActionMsg(`Alert Escalated to ${res.escalated_to.join(', ')}`);
      onRefresh();
    } catch (err: any) {
      setActionMsg(`Escalate Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Event Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold bg-slate-800 text-cyan-400 px-2.5 py-0.5 rounded border border-slate-700">
              {event.id}
            </span>
            <span
              className="text-xs font-mono font-bold text-white px-2.5 py-0.5 rounded shadow-sm"
              style={{ backgroundColor: event.status_color || '#3182CE' }}
            >
              Stage {event.fsm_stage}: {event.status}
            </span>
          </div>
          <h2 className="text-lg font-bold text-white">{event.description}</h2>
          <p className="text-xs text-slate-400 font-mono">
            {event.division} • {event.section} • Track: {event.track_id} • KM {event.km_start} to {event.km_end}
          </p>
        </div>

        {/* Fencing Token Badge */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-slate-950 border border-purple-500/40 text-right">
            <div className="text-[10px] font-mono text-purple-400 uppercase tracking-wider">
              Distributed Fencing Token
            </div>
            <div className="text-base font-black font-mono text-purple-300">
              {event.fencing_token ? `FT-2026-10-14-${event.fencing_token.toString().padStart(4, '0')}` : 'UNLOCKED'}
            </div>
            <div className="text-[10px] text-slate-400">Redis Monotonic 64-bit Lock</div>
          </div>
        </div>
      </div>

      {actionMsg && (
        <div className="p-3.5 rounded-lg bg-cyan-950/80 border border-cyan-500/60 text-xs font-mono text-cyan-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{actionMsg}</span>
        </div>
      )}

      {/* 11-Stage Interactive FSM Visual Pipeline */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Workflow className="w-4 h-4 text-cyan-400" />
            11-Stage Finite State Machine (FSM) Lifecycle Progress
          </h3>
          <span className="text-xs font-mono text-slate-400">Strict Railway Manual Sequence (G&SR / ACTM)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {FSM_STAGES.map((stage, idx) => {
            const isCompleted = currentStageIndex > idx;
            const isCurrent = currentStageIndex === idx;

            return (
              <div
                key={stage.key}
                className={`p-3.5 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-slate-950 border-cyan-400 ring-2 ring-cyan-500/30 shadow-lg'
                    : isCompleted
                    ? 'bg-slate-950/90 border-slate-700/80'
                    : 'bg-slate-950/40 border-slate-800 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className="text-[10px] font-mono font-bold px-2 py-0.5 rounded text-white"
                    style={{ backgroundColor: stage.color }}
                  >
                    Stage 0{stage.num}
                  </span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : isCurrent ? (
                    <Clock className="w-4 h-4 text-cyan-400 animate-spin" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-slate-700" />
                  )}
                </div>
                <div className="font-bold text-xs text-white mb-1">{stage.name}</div>
                <div className="text-[11px] text-slate-400 leading-tight">{stage.desc}</div>
              </div>
            );
          })}
        </div>

        {/* Exception State Banner if active */}
        {isException && (
          <div className="mt-4 p-4 rounded-xl bg-red-950/80 border border-red-500 text-red-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertOctagon className="w-6 h-6 text-red-400 animate-pulse" />
              <div>
                <div className="font-bold text-sm">SAFETY INTERRUPT / EXCEPTION ACTIVE: {event.status}</div>
                <div className="text-xs text-red-300">
                  Corridor possession frozen. Emergency audio-visual alerts dispatched to DRM & Section Controllers.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Operational Actions & Safety Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
        <h3 className="font-bold text-sm text-white mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          FSM State Transition Actions & Emergency Safeguards
        </h3>

        <div className="flex flex-wrap items-center gap-3">
          {/* Acquire Distributed Lock */}
          {!event.fencing_token && event.status === 'APPROVED' && (
            <button
              onClick={handleAcquireLock}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg shadow-md shadow-purple-600/30 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              Acquire Redis Fencing Token (Stage 6)
            </button>
          )}

          {/* Activate Work in Progress */}
          {['APPROVED', 'SCHEDULED'].includes(event.status) && (
            <button
              onClick={handleActivate}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-md shadow-emerald-600/30 cursor-pointer"
            >
              <Flame className="w-4 h-4" />
              Activate Work in Progress (Stage 7)
            </button>
          )}

          {/* Complete Work */}
          {event.status === 'ACTIVE_IN_PROGRESS' && (
            <button
              onClick={handleComplete}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg shadow-md shadow-amber-600/30 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Sign Work Completion Memo (Stage 8)
            </button>
          )}

          {/* Clear Block and Lock S3 WORM */}
          {['WORK_COMPLETED', 'SAFETY_VERIFIED'].includes(event.status) && (
            <button
              onClick={handleClear}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg shadow-md shadow-cyan-600/30 cursor-pointer"
            >
              <Database className="w-4 h-4" />
              Clear Block & Seal S3 WORM Ledger (Stage 10/11)
            </button>
          )}

          {/* Emergency Safety Abort */}
          {!['BLOCK_CLEARED', 'AUDIT_LOCKED', 'ABORTED_SAFETY_LOCK'].includes(event.status) && (
            <button
              onClick={handleAbort}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-xs font-bold rounded-lg shadow-md shadow-red-700/30 cursor-pointer"
            >
              <AlertOctagon className="w-4 h-4" />
              Emergency Safety Abort (Hard Fail-Safe)
            </button>
          )}

          {/* SLA Escalation */}
          {['SUBMITTED', 'AWAITING_APPROVAL'].includes(event.status) && (
            <button
              onClick={handleEscalate}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-red-950 hover:bg-red-900 border border-red-700 text-red-200 text-xs font-bold rounded-lg cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4" />
              Escalate SLA to Sr. DOM / DRM
            </button>
          )}
        </div>
      </div>

      {/* 6-Invariant Automated Resolution Card */}
      {event.invariants && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
              The Six Invariants of Operational Awareness (Resolved Automatically)
            </h3>
            <span className="text-xs px-2.5 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-mono">
              ✓ CONFLICT-FREE GUARANTEED
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono">
            {/* Invariant 1 */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-cyan-400 font-bold mb-1">1. Ambient Corridor Awareness</div>
              <ul className="text-slate-300 space-y-1 text-[11px]">
                {event.invariants.invariant_1_ambient_awareness.map((a, i) => (
                  <li key={i}>• {a.role}: {a.action}</li>
                ))}
              </ul>
            </div>

            {/* Invariant 2 */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-cyan-400 font-bold mb-1">2. Statutory Approval Authority</div>
              <ul className="text-slate-300 space-y-1 text-[11px]">
                {event.invariants.invariant_2_statutory_approvers.map((a, i) => (
                  <li key={i}>• {a.role} ({a.department}) — {a.authority_code}</li>
                ))}
              </ul>
            </div>

            {/* Invariant 3 */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-cyan-400 font-bold mb-1">3. Physical Prerequisites</div>
              <ul className="text-slate-300 space-y-1 text-[11px]">
                {event.invariants.invariant_3_physical_prerequisites.map((p, i) => (
                  <li key={i}>• [{p.code}] {p.action}</li>
                ))}
              </ul>
            </div>

            {/* Invariant 4 */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-cyan-400 font-bold mb-1">4. Passive Telemetry Monitoring</div>
              <ul className="text-slate-300 space-y-1 text-[11px]">
                {event.invariants.invariant_4_passive_monitoring.map((m, i) => (
                  <li key={i}>• {m.desk}: {m.mode}</li>
                ))}
              </ul>
            </div>

            {/* Invariant 5 */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-cyan-400 font-bold mb-1">5. Operational Site Custody</div>
              <div className="text-slate-300 text-[11px]">
                {event.invariants.invariant_5_site_custody.title} ({event.invariants.invariant_5_site_custody.officer_id})
                <div className="text-slate-400 text-[10px] mt-0.5">{event.invariants.invariant_5_site_custody.statutory_role}</div>
              </div>
            </div>

            {/* Invariant 6 */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-cyan-400 font-bold mb-1">6. Hierarchical SLA Escalation</div>
              <ul className="text-slate-300 space-y-1 text-[11px]">
                {event.invariants.invariant_6_sla_escalation.map((e, i) => (
                  <li key={i}>• &gt;{e.threshold_minutes} min: {e.escalate_to}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
