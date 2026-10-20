import React, { useState } from 'react';
import {
  Shield,
  KeyRound,
  CheckCircle2,
  Lock,
  FileSignature,
  Zap,
  Clock,
  AlertOctagon
} from 'lucide-react';
import { OperationalEvent, ApprovalRole, Department } from '../types';
import { submitApproval } from '../api';

interface DualKeyApprovalPortalProps {
  event: OperationalEvent | null;
  onRefresh: () => void;
}

export const DualKeyApprovalPortal: React.FC<DualKeyApprovalPortalProps> = ({ event, onRefresh }) => {
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!event) {
    return (
      <div className="p-8 text-center text-slate-500 font-mono text-sm bg-[#12161f] rounded-xl border border-slate-800 neo-card">
        Select an operational event to review Dual-Key multi-party statutory sign-offs.
      </div>
    );
  }

  const handleSign = async (role: ApprovalRole, dept: Department, officerId: string) => {
    setLoadingRole(role);
    setErrorMsg(null);
    try {
      await submitApproval(event.id, dept, role, officerId, 'APPROVED');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Statutory sign-off failed');
    } finally {
      setLoadingRole(null);
    }
  };

  const getStakeholder = (role: ApprovalRole) => event.stakeholders.find((s) => s.role === role);

  const tpcStakeholder = getStakeholder('TPC');
  const ctrlStakeholder = getStakeholder('SECTION_CONTROLLER');
  const smStakeholder = getStakeholder('STATION_MASTER');
  const sseStakeholder = getStakeholder('FIELD_SUPERVISOR');

  const dualKeyCleared = tpcStakeholder?.approval_status === 'APPROVED' && ctrlStakeholder?.approval_status === 'APPROVED';

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#12161f] border border-slate-800 rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4 neo-card">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold bg-blue-950 text-blue-300 px-2.5 py-0.5 rounded border border-blue-500/40">
              SCREEN 4 • DUAL-KEY MULTI-PARTY APPROVAL PORTAL
            </span>
            <span className="text-xs font-mono text-slate-400">Event: {event.id.substring(0, 8)}...</span>
          </div>
          <h2 className="text-lg font-bold text-white">
            Synthesized Human-in-the-Loop Decision Boundary (G&SR & ACTM Compliance)
          </h2>
          <p className="text-xs text-slate-400">
            RailSync orchestrates workflow communication; statutory authority rests strictly with certified human officers.
          </p>
        </div>

        {/* Dual-Key Status Badge */}
        <div className={`px-4 py-2 rounded-xl border font-mono text-xs font-bold flex items-center gap-2 ${
          dualKeyCleared
            ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
            : 'bg-blue-950/80 border-blue-500 text-blue-300'
        }`}>
          <KeyRound className="w-4 h-4" />
          <span>{dualKeyCleared ? 'DUAL-KEY QUORUM MET (APPROVED)' : 'DUAL-KEY PENDING SIGN-OFF'}</span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300">
          {errorMsg}
        </div>
      )}

      {/* Role Decision Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: Traction Power Controller (TPC) */}
        <div className="bg-[#12161f] border border-slate-800 rounded-xl p-5 shadow-lg relative flex flex-col justify-between neo-card">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-bold text-blue-400 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-blue-400" />
                KEY 1 • TRACTION POWER CONTROLLER (TPC)
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                tpcStakeholder?.approval_status === 'APPROVED'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                  : 'bg-slate-900 text-blue-300 border border-blue-700'
              }`}>
                {tpcStakeholder?.approval_status || 'PENDING'}
              </span>
            </div>

            <h3 className="font-bold text-sm text-white mb-1">Form ETR-1 Power Block Message</h3>
            <p className="text-xs text-slate-400 mb-3">
              Authorizes 25kV Catenary de-energization from Feeding Post FP-04 to FP-06. Confirms electrical isolation zone.
            </p>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] space-y-1 text-slate-300 mb-4 neo-pressed">
              <div>• Officer ID: <span className="text-blue-400">{tpcStakeholder?.officer_id || 'TPC_DDU_01'}</span></div>
              <div>• Statutory Rule: ACTM Vol. II Section 20615</div>
              <div>• Sub-Station: Danapur Traction Sub-Station (TSS)</div>
              {tpcStakeholder?.signature_hash && (
                <div className="text-[10px] text-emerald-400 truncate">
                  • Sig: {tpcStakeholder.signature_hash}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => handleSign('TPC' as ApprovalRole, 'OHE' as Department, 'TPC_DDU_01')}
            disabled={loadingRole === 'TPC' || tpcStakeholder?.approval_status === 'APPROVED'}
            className={`w-full py-2.5 px-4 text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 ${
              tpcStakeholder?.approval_status === 'APPROVED'
                ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 cursor-default'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25'
            }`}
          >
            <FileSignature className="w-4 h-4" />
            {tpcStakeholder?.approval_status === 'APPROVED' ? '✓ Signed (Form ETR-1 Issued)' : 'Sign TPC ETR-1 Power Block'}
          </button>
        </div>

        {/* Card 2: Operating Section Controller */}
        <div className="bg-[#12161f] border border-slate-800 rounded-xl p-5 shadow-lg relative flex flex-col justify-between neo-card">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-bold text-blue-400 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-400" />
                KEY 2 • SECTION CONTROLLER (OPERATING)
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                ctrlStakeholder?.approval_status === 'APPROVED'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                  : 'bg-slate-900 text-blue-300 border border-blue-700'
              }`}>
                {ctrlStakeholder?.approval_status || 'PENDING'}
              </span>
            </div>

            <h3 className="font-bold text-sm text-white mb-1">Traffic Block Feasibility Grant</h3>
            <p className="text-xs text-slate-400 mb-3">
              Evaluates live train charts in COA, timetables, and passenger rake regulation per G&amp;SR Chapter IV.
            </p>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] space-y-1 text-slate-300 mb-4 neo-pressed">
              <div>• Officer ID: <span className="text-blue-400">{ctrlStakeholder?.officer_id || 'CTRL_SEC_DNR_02'}</span></div>
              <div>• Statutory Rule: G&amp;SR Chapter IV (Line Block Grant)</div>
              <div>• Corridor: Danapur-Patna UP MAIN</div>
              {ctrlStakeholder?.signature_hash && (
                <div className="text-[10px] text-emerald-400 truncate">
                  • Sig: {ctrlStakeholder.signature_hash}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => handleSign('SECTION_CONTROLLER' as ApprovalRole, 'OPERATING' as Department, 'CTRL_SEC_DNR_02')}
            disabled={loadingRole === 'SECTION_CONTROLLER' || ctrlStakeholder?.approval_status === 'APPROVED'}
            className={`w-full py-2.5 px-4 text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 ${
              ctrlStakeholder?.approval_status === 'APPROVED'
                ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 cursor-default'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25'
            }`}
          >
            <FileSignature className="w-4 h-4" />
            {ctrlStakeholder?.approval_status === 'APPROVED' ? '✓ Signed (Traffic Block Granted)' : 'Sign Section Controller Traffic Block'}
          </button>
        </div>

        {/* Card 3: Station Master (Interlocking & Clamping) */}
        <div className="bg-[#12161f] border border-slate-800 rounded-xl p-5 shadow-lg relative flex flex-col justify-between neo-card">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-bold text-blue-400 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-blue-400" />
                STATION MASTER INTERLOCKING &amp; POINT CLAMPING
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                smStakeholder?.approval_status === 'APPROVED'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                  : 'bg-slate-900 text-blue-300 border border-blue-700'
              }`}>
                {smStakeholder?.approval_status || 'PENDING'}
              </span>
            </div>

            <h3 className="font-bold text-sm text-white mb-1">Physical Point Clamping &amp; Padlocking</h3>
            <p className="text-xs text-slate-400 mb-3">
              Verifies electronic route interlocking locked against target track. Confirms physical clamps on points #14A/B.
            </p>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] space-y-1 text-slate-300 mb-4 neo-pressed">
              <div>• Officer ID: <span className="text-blue-400">{smStakeholder?.officer_id || 'SM_PNBE_01'}</span></div>
              <div>• Cabin: Patna Jn RRI Cabin</div>
              <div>• Interlocking State: CLAMPED &amp; PADLOCKED</div>
            </div>
          </div>

          <button
            onClick={() => handleSign('STATION_MASTER' as ApprovalRole, 'OPERATING' as Department, 'SM_PNBE_01')}
            disabled={loadingRole === 'STATION_MASTER' || smStakeholder?.approval_status === 'APPROVED'}
            className={`w-full py-2.5 px-4 text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 ${
              smStakeholder?.approval_status === 'APPROVED'
                ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 cursor-default'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25'
            }`}
          >
            <Lock className="w-4 h-4" />
            {smStakeholder?.approval_status === 'APPROVED' ? '✓ Points Clamped &amp; Verified' : 'Confirm SM Point Clamping'}
          </button>
        </div>

        {/* Card 4: Field Supervisor (SSE OHE / P-Way) */}
        <div className="bg-[#12161f] border border-slate-800 rounded-xl p-5 shadow-lg relative flex flex-col justify-between neo-card">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-bold text-blue-400 flex items-center gap-1.5">
                <FileSignature className="w-4 h-4 text-blue-400" />
                FIELD SUPERVISOR PERMIT-TO-WORK (Form3-PTW)
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                sseStakeholder?.approval_status === 'APPROVED'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                  : 'bg-slate-900 text-blue-300 border border-blue-700'
              }`}>
                {sseStakeholder?.approval_status || 'PENDING'}
              </span>
            </div>

            <h3 className="font-bold text-sm text-white mb-1">Field Earthing Discharge Rods</h3>
            <p className="text-xs text-slate-400 mb-3">
              Field crew attaches physical earth discharge rods to 25kV catenary. Assumes statutory site custody.
            </p>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] space-y-1 text-slate-300 mb-4 neo-pressed">
              <div>• Officer ID: <span className="text-blue-400">{sseStakeholder?.officer_id || 'SSE_OHE_DNR_04'}</span></div>
              <div>• Form Code: Form3-PTW (Permit-to-Work)</div>
              <div>• Rods Applied: 2 Rods (Upstream &amp; Downstream)</div>
            </div>
          </div>

          <button
            onClick={() => handleSign('FIELD_SUPERVISOR' as ApprovalRole, 'OHE' as Department, 'SSE_OHE_DNR_04')}
            disabled={loadingRole === 'FIELD_SUPERVISOR' || sseStakeholder?.approval_status === 'APPROVED'}
            className={`w-full py-2.5 px-4 text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 ${
              sseStakeholder?.approval_status === 'APPROVED'
                ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 cursor-default'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25'
            }`}
          >
            <Zap className="w-4 h-4" />
            {sseStakeholder?.approval_status === 'APPROVED' ? '✓ Permit Form3-PTW Active' : 'Issue Field Permit Form3-PTW'}
          </button>
        </div>
      </div>
    </div>
  );
};
