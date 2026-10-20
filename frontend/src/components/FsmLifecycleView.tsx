import React, { useState } from 'react';
import {
  Workflow,
  CheckCircle2,
  Clock,
  Lock,
  Flame,
  ShieldAlert,
  AlertOctagon,
  ShieldCheck,
  Database
} from 'lucide-react';
import { OperationalEvent, EventStatus } from '../types';
import { acquireFencingToken, activateWork, completeWork, clearBlock, emergencyAbort, escalateSla } from '../api';

interface FsmLifecycleViewProps {
  event: OperationalEvent | null;
  onRefresh: () => void;
}

// Blue-to-Green progression: Draft/Submitted/Awaiting = Grey/Blue, Approved/Active/Done/Cleared/Audit = Emerald Green
const FSM_STAGES: Array<{ num: number; key: EventStatus; name: string; color: string; desc: string }> = [
  { num: 1, key: 'DRAFT', name: 'Draft', color: '#64748B', desc: 'Initial requisition drafted. No live corridor state altered.' },
  { num: 2, key: 'SUBMITTED', name: 'Submitted', color: '#3B82F6', desc: 'Pydantic validation passed. ACTM & G&SR rules checked.' },
  { num: 3, key: 'DEPENDENCY_RESOLVED', name: 'Dependency Resolved', color: '#2563EB', desc: 'Topological track graph analyzed. 6 Invariants resolved.' },
  { num: 4, key: 'AWAITING_APPROVAL', name: 'Awaiting Approval', color: '#0EA5E9', desc: 'Concurrent payloads dispatched to TPC & Section Controller.' },
  { num: 5, key: 'APPROVED', name: 'Approved', color: '#10B981', desc: 'Dual-key statutory sign-offs executed via cryptographic signatures.' },
  { num: 6, key: 'SCHEDULED', name: 'Fenced Token Locked', color: '#059669', desc: 'Redis distributed fencing token acquired. Corridor reserved.' },
  { num: 7, key: 'ACTIVE_IN_PROGRESS', name: 'Active In Progress', color: '#16A34A', desc: 'SM points clamped; 25kV de-energized (ETR-1); earth rods applied (Form3-PTW).' },
  { num: 8, key: 'WORK_COMPLETED', name: 'Work Completed', color: '#047857', desc: 'Maintenance finished. Earth rods removed. Memo signed.' },
  { num: 9, key: 'SAFETY_VERIFIED', name: 'Safety Verified', color: '#059669', desc: 'Joint safety clearance verified (Overhead, points, interlocks).' },
  { num: 10, key: 'BLOCK_CLEARED', name: 'Block Cleared', color: '#10B981', desc: '25kV re-energized; point clamps removed; traffic resumed.' },
  { num: 11, key: 'AUDIT_LOCKED', name: 'Audit Locked', color: '#065F46', desc: 'SHA-256 Merkle block permanently sealed into S3 WORM storage.' },
];

export const FsmLifecycleView: React.FC<FsmLifecycleViewProps> = ({ event, onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  if (!event) {
    return (
      <div className="p-8 text-center text-slate-400 bg-[#12161f] border border-slate-800 rounded-xl neo-card">
        Select an operational event to inspect its 11-stage Finite State Machine lifecycle.
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
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    setLoading(true);
    setActionMsg(null);
    try {
      await activateWork(event.id);
      setActionMsg('Work activated. 25kV Catenary tripped & Form3-PTW active.');
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    setActionMsg(null);
    try {
      await completeWork(event.id, 'SSE_OHE_WDA_04');
      setActionMsg('Work completed memo signed by Field Supervisor.');
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    setLoading(true);
    setActionMsg(null);
    try {
      const res = await clearBlock(event.id);
      setActionMsg(res.message);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAbort = async () => {
    const reason = prompt('Enter statutory reason for Emergency Safety Abort:', 'Track circuit failure / unauthorized rail occupancy');
    if (!reason) return;
    setLoading(true);
    setActionMsg(null);
    try {
      const res = await emergencyAbort(event.id, 'CTRL_SEC_WDA_02', reason);
      setActionMsg(res.message);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEscalate = async () => {
    setLoading(true);
    setActionMsg(null);
    try {
      const res = await escalateSla(event.id, 'Timeout exceeding statutory SLA matrix');
      setActionMsg(`Escalated to: ${res.escalated_to?.join(', ')}`);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#12161f] border border-slate-800 rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4 neo-card">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold bg-blue-950 text-blue-300 px-2.5 py-0.5 rounded border border-blue-500/40">
              SCREEN 3 • 11-STAGE FSM PIPELINE
            </span>
            <span
              className="text-xs font-mono font-bold px-2.5 py-0.5 rounded text-white"
              style={{ backgroundColor: event.status_color || '#3B82F6' }}
            >
              Stage 0{event.fsm_stage}: {event.status}
            </span>
          </div>
          <h2 className="text-lg font-bold text-white">{event.description}</h2>
          <p className="text-xs text-slate-400 font-mono">
            {event.division} • {event.section} • Track: {event.track_id} • KM {event.km_start} to {event.km_end}
          </p>
        </div>

        {/* Fencing Token Badge */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-slate-950 border border-blue-500/40 text-right neo-pressed">
            <div className="text-[10px] font-mono text-blue-400 uppercase tracking-wider">
              Distributed Fencing Token
            </div>
            <div className="text-base font-black font-mono text-blue-300">
              {event.fencing_token ? `FT-2026-10-14-${event.fencing_token.toString().padStart(4, '0')}` : 'UNLOCKED'}
            </div>
            <div className="text-[10px] text-slate-500">Redis Monotonic 64-bit Lock</div>
          </div>
        </div>
      </div>

      {actionMsg && (
        <div className="p-3.5 rounded-lg bg-blue-950/60 border border-blue-500/40 text-xs font-mono text-blue-200 flex items-center gap-2 neo-card">
          <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
          <span>{actionMsg}</span>
        </div>
      )}

      {/* 11-Stage Interactive FSM Visual Pipeline */}
      <div className="bg-[#12161f] border border-slate-800 rounded-xl p-5 shadow-xl neo-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Workflow className="w-4 h-4 text-blue-400" />
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
                    ? 'bg-slate-950 border-blue-400 ring-2 ring-blue-500/30 shadow-lg'
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
                    <Clock className="w-4 h-4 text-blue-400 animate-spin" />
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
          <div className="mt-4 p-4 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 flex items-center justify-between neo-pressed">
            <div className="flex items-center gap-3">
              <AlertOctagon className="w-6 h-6 text-slate-400" />
              <div>
                <div className="font-bold text-sm">SAFETY INTERRUPT / EXCEPTION ACTIVE: {event.status}</div>
                <div className="text-xs text-slate-400">
                  Corridor possession frozen. Emergency alerts dispatched to DRM & Section Controllers.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Operational Actions & Safety Controls */}
      <div className="bg-[#12161f] border border-slate-800 rounded-xl p-5 shadow-xl neo-card">
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
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-md shadow-blue-600/30 cursor-pointer neo-button"
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
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-md shadow-emerald-600/30 cursor-pointer neo-button"
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
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-md shadow-emerald-600/30 cursor-pointer neo-button"
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
              className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-md shadow-emerald-700/30 cursor-pointer neo-button"
            >
              <Database className="w-4 h-4" />
              Clear Block & Seal S3 WORM Ledger (Stage 10/11)
            </button>
          )}

          {/* Emergency Safety Abort (Professional Dark Grey Button with White/Blue border) */}
          {!['BLOCK_CLEARED', 'AUDIT_LOCKED', 'ABORTED_SAFETY_LOCK'].includes(event.status) && (
            <button
              onClick={handleAbort}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold rounded-lg border border-blue-500/40 hover:border-blue-400 cursor-pointer neo-button"
            >
              <AlertOctagon className="w-4 h-4 text-blue-400" />
              Emergency Safety Abort (Hard Fail-Safe)
            </button>
          )}

          {/* SLA Escalation */}
          {['SUBMITTED', 'AWAITING_APPROVAL'].includes(event.status) && (
            <button
              onClick={handleEscalate}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold rounded-lg cursor-pointer neo-button"
            >
              <ShieldAlert className="w-4 h-4 text-blue-400" />
              Escalate SLA to Sr. DOM / DRM
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
