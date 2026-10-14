import React from 'react';
import {
  Train,
  Activity,
  ShieldAlert,
  Radio,
  FileCheck2,
  Workflow,
  KeyRound,
  History,
  Gauge,
  Wifi,
  WifiOff
} from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  openRequisitionModal: () => void;
  wsConnected: boolean;
  canaryHealthy: boolean;
  isOfflineMode: boolean;
  setIsOfflineMode: (val: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  openRequisitionModal,
  wsConnected,
  canaryHealthy,
  isOfflineMode,
  setIsOfflineMode,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40 shadow-xl">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Division */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-600/30">
            <Train className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-xl tracking-wider text-cyan-400">RAILSYNC</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono border border-slate-700">
                SYS_REV: 2.0.4 | SEC_CLR
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Indian Railways — Central Railway (CR) • Nagpur Division (NGP) • Wardha–Sevagram Corridor
            </p>
          </div>
        </div>

        {/* Live Cloud Status Telemetry Badges */}
        <div className="flex items-center gap-2 text-xs font-mono">
          {/* WebSocket Status */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
            wsConnected
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
              : 'bg-red-950/60 border-red-500/40 text-red-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <span>{wsConnected ? 'WSS PUB/SUB 5ms' : 'WSS RECONNECTING'}</span>
          </div>

          {/* Synthetic Canary /healthz */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
            canaryHealthy
              ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-400'
              : 'bg-amber-950/60 border-amber-500/40 text-amber-400'
          }`}>
            <Activity className="w-3.5 h-3.5" />
            <span>CANARY /healthz (15s)</span>
          </div>

          {/* Line Capacity Alert */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-500/40 text-amber-300">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>HDN CAP: 118.4% &gt; 100%</span>
          </div>

          {/* Mobile Offline Simulator Toggle */}
          <button
            onClick={() => setIsOfflineMode(!isOfflineMode)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all cursor-pointer ${
              isOfflineMode
                ? 'bg-purple-950 border-purple-500 text-purple-300 font-semibold'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Simulates Mobile Offline Boundary behavior"
          >
            {isOfflineMode ? <WifiOff className="w-3.5 h-3.5 text-purple-400" /> : <Wifi className="w-3.5 h-3.5" />}
            <span>{isOfflineMode ? 'OFFLINE (Tier 1 SQLite)' : 'CLOUD CONNECTED'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-t border-slate-800/80 bg-slate-950/60">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between overflow-x-auto">
          <nav className="flex space-x-1 py-1.5">
            {[
              { id: 'screen1', label: '1. Corridor Video Wall', icon: Radio },
              { id: 'screen3', label: '3. 11-Stage FSM Engine', icon: Workflow },
              { id: 'screen4', label: '4. Dual-Key Decision Portal', icon: KeyRound },
              { id: 'screen5', label: '5. S3 Audit Ledger', icon: History },
              { id: 'screen6', label: '6. Live SRE & Chaos Dashboard', icon: Gauge },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/40 font-semibold shadow-inner'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* New Requisition Action Button (Screen 2 Modal Trigger) */}
          <button
            onClick={openRequisitionModal}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold rounded-md shadow-md shadow-cyan-600/20 cursor-pointer transition-all ml-4"
          >
            <FileCheck2 className="w-4 h-4" />
            + New Requisition (Screen 2)
          </button>
        </div>
      </div>
    </header>
  );
};
