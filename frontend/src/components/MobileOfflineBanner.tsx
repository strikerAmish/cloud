import React from 'react';
import { WifiOff, ShieldAlert, CheckCircle2, XCircle, Info } from 'lucide-react';

interface MobileOfflineBannerProps {
  isOffline: boolean;
}

export const MobileOfflineBanner: React.FC<MobileOfflineBannerProps> = ({ isOffline }) => {
  if (!isOffline) return null;

  return (
    <div className="bg-purple-950/90 border border-purple-500 rounded-xl p-4 shadow-xl text-purple-100 space-y-3 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <WifiOff className="w-5 h-5 text-purple-400" />
          <span className="font-bold text-sm text-white">
            Mobile Offline Boundary Active (Simulated Remote Track / Tunnel Blackout)
          </span>
        </div>
        <span className="text-[10px] font-mono bg-purple-900 border border-purple-500 px-2 py-0.5 rounded text-purple-200">
          STRICT CP / FAIL-CLOSED STANCE
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {/* Tier 1 */}
        <div className="p-3 rounded-lg bg-slate-900/90 border border-emerald-500/40">
          <div className="font-bold text-emerald-400 flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Tier 1: Informational Tasks (ALLOWED OFFLINE)
          </div>
          <p className="text-slate-300 text-[11px] mb-1.5">
            Queues in local encrypted SQLite cache and synchronizes via CRDTs upon cloud reconnect.
          </p>
          <ul className="text-slate-400 text-[10px] space-y-0.5 list-disc pl-4 font-mono">
            <li>Site arrival confirmation & progress notes</li>
            <li>Digital photo inspection evidence</li>
            <li>Equipment checklists and tool counts</li>
          </ul>
        </div>

        {/* Tier 2 */}
        <div className="p-3 rounded-lg bg-slate-900/90 border border-red-500/40">
          <div className="font-bold text-red-400 flex items-center gap-1.5 mb-1">
            <XCircle className="w-4 h-4 text-red-400" />
            Tier 2: Safety-Critical Tasks (STRICTLY FORBIDDEN OFFLINE)
          </div>
          <p className="text-slate-300 text-[11px] mb-1.5">
            Hard Fail-Closed safety boundary. Offline bypass of railway interlocking is strictly forbidden.
          </p>
          <ul className="text-slate-400 text-[10px] space-y-0.5 list-disc pl-4 font-mono">
            <li>Permit ETR-3 issuance & 25kV power cut</li>
            <li>Point clamping & interlocking line block grant</li>
            <li>Block clearance and train resumption sign-off</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
