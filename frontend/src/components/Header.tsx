import React from 'react';
import {
  Train,
  ShieldAlert,
  Activity,
  History,
  Workflow,
  KeyRound,
  Gauge,
  Radio,
  FileCheck2,
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
  setIsOfflineMode: (offline: boolean) => void;
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
    <header className="border-b border-slate-800 bg-[#12161f] sticky top-0 z-40 backdrop-blur-md">
      {/* Top Bar: Mission Critical Branding & SRE Status */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Train className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-wider text-white">
                RAILSYNC
              </h1>
              <span className="text-[10px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded">
                MISSION-CRITICAL
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
              : 'bg-slate-900 border-slate-700 text-slate-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span>{wsConnected ? 'WSS PUB/SUB 5ms' : 'WSS RECONNECTING'}</span>
          </div>

          {/* Synthetic Canary /healthz */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
            canaryHealthy
              ? 'bg-blue-950/60 border-blue-500/40 text-blue-400'
              : 'bg-slate-900 border-slate-700 text-slate-400'
          }`}>
            <Activity className="w-3.5 h-3.5" />
            <span>CANARY /healthz (15s)</span>
          </div>

          {/* Line Capacity Alert */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-blue-500/30 text-blue-300">
            <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
            <span>HDN CAP: 118.4% &gt; 100%</span>
          </div>

          {/* Mobile Offline Simulator Toggle */}
          <button
            onClick={() => setIsOfflineMode(!isOfflineMode)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all cursor-pointer ${
              isOfflineMode
                ? 'bg-slate-900 border-blue-500/40 text-blue-300 font-semibold'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Simulates Mobile Offline Boundary behavior"
          >
            {isOfflineMode ? <WifiOff className="w-3.5 h-3.5 text-blue-400" /> : <Wifi className="w-3.5 h-3.5" />}
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
                  className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <button
            onClick={openRequisitionModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-md shadow-blue-600/25 cursor-pointer transition-all shrink-0 ml-4"
          >
            <FileCheck2 className="w-4 h-4" />
            + New Requisition
          </button>
        </div>
      </div>
    </header>
  );
};
