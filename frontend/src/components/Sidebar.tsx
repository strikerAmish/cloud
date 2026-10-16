import React, { useState } from 'react';
import {
  Train, ChevronDown, ChevronRight,
  Radio, History, Gauge, Wifi, WifiOff,
  Activity, Circle, Info
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  setActiveView: (v: string) => void;
  isOfflineMode: boolean;
  setIsOfflineMode: (v: boolean) => void;
  wsConnected: boolean;
  canaryHealthy: boolean;
}

const VIEWS = [
  {
    id: 'workspace',
    label: 'Corridor Workspace',
    icon: Radio,
    desc: 'Track Visualizer, Kanban & Issue Drawer',
  },
  {
    id: 'audit',
    label: 'S3 Audit Ledger',
    icon: History,
    desc: 'WORM Cryptographic Register',
  },
  {
    id: 'sre',
    label: 'SRE & Chaos Studio',
    icon: Gauge,
    desc: 'Golden Signals, P95 & Chaos Kill',
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  isOfflineMode,
  setIsOfflineMode,
  wsConnected,
  canaryHealthy,
}) => {
  const [hierarchyOpen, setHierarchyOpen] = useState(true);
  const [healthHover, setHealthHover] = useState(false);

  const systemOk = wsConnected && canaryHealthy && !isOfflineMode;

  return (
    <aside className="w-64 shrink-0 border-r border-slate-800/80 bg-[#12161f] flex flex-col justify-between overflow-hidden">
      {/* ── Brand header ─────────────────────────── */}
      <div>
        <div className="px-5 pt-5 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
              <Train className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-black tracking-widest text-blue-400 leading-tight">
                RAILSYNC
              </div>
              <div className="text-[10px] text-slate-400 leading-tight">
                CR • Nagpur Division
              </div>
            </div>
          </div>
        </div>

        {/* ── Corridor Hierarchy ───────────────────── */}
        <div className="px-4 py-3 border-b border-slate-800/80">
          <button
            onClick={() => setHierarchyOpen(!hierarchyOpen)}
            className="flex items-center justify-between w-full text-[10px] font-semibold uppercase tracking-widest text-slate-400 hover:text-slate-200 transition-colors cursor-pointer mb-2"
          >
            <span>HIERARCHY</span>
            {hierarchyOpen
              ? <ChevronDown className="w-3 h-3" />
              : <ChevronRight className="w-3 h-3" />
            }
          </button>

          {hierarchyOpen && (
            <div className="space-y-1 fade-in">
              {/* CR root */}
              <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
                <span>Central Railway (CR)</span>
              </div>
              {/* Division */}
              <div className="flex items-center gap-2 text-xs text-slate-400 py-1 pl-3">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
                <span>Nagpur Division (NGP)</span>
              </div>
              {/* Active corridor */}
              <div className="flex items-center gap-2 text-xs py-1 pl-6">
                <span className="w-1.5 h-1.5 rounded-full status-dot-green shrink-0" />
                <span className="text-slate-100 font-semibold">
                  Wardha–Sevagram
                </span>
                <span className="ml-auto text-[9px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                  ACTIVE
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Navigation ──────────────────────────── */}
        <div className="px-3 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 px-2 mb-2">
            Workspace Views
          </div>
          <nav className="space-y-1">
            {VIEWS.map((v) => {
              const Icon = v.icon;
              const isActive = activeView === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setActiveView(v.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all cursor-pointer group ${
                    isActive
                      ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 neo-pressed'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                  <div className="min-w-0">
                    <div className={`text-xs font-semibold leading-tight ${isActive ? 'text-white' : ''}`}>
                      {v.label}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate mt-0.5">
                      {v.desc}
                    </div>
                  </div>
                  {isActive && (
                    <span className="ml-auto w-1 h-4 rounded-full bg-blue-500 shrink-0" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ── Bottom: System Status + Offline Toggle ── */}
      <div className="px-4 pb-4 pt-2 border-t border-slate-800/80 space-y-3">
        {/* Offline Toggle */}
        <button
          onClick={() => setIsOfflineMode(!isOfflineMode)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
            isOfflineMode
              ? 'bg-slate-900 border-blue-500/40 text-blue-300'
              : 'bg-slate-900/60 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:border-slate-600'
          }`}
        >
          {isOfflineMode
            ? <WifiOff className="w-3.5 h-3.5 text-blue-400" />
            : <Wifi className="w-3.5 h-3.5" />
          }
          <span>{isOfflineMode ? 'OFFLINE (Tier 1 SQLite)' : 'CLOUD CONNECTED'}</span>
        </button>

        {/* Consolidated Health Pill (Strictly Emerald Green for healthy state) */}
        <div
          className="relative tooltip-container"
          onMouseEnter={() => setHealthHover(true)}
          onMouseLeave={() => setHealthHover(false)}
        >
          <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-default neo-card ${
            systemOk
              ? 'border-emerald-500/30'
              : 'border-slate-700/60'
          }`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${systemOk ? 'status-dot-green animate-pulse' : 'status-dot-grey'}`} />
            <div className="flex-1 min-w-0">
              <div className={`text-xs font-semibold ${systemOk ? 'text-emerald-400' : 'text-slate-300'}`}>
                {systemOk ? 'System Healthy' : 'Degraded Mode'}
              </div>
              <div className="text-[10px] font-mono text-slate-400">
                {wsConnected ? 'WSS · 5ms' : 'WSS reconnecting'} · {canaryHealthy ? 'Canary ✓' : 'Canary ✗'}
              </div>
            </div>
            <Info className="w-3 h-3 text-slate-500 shrink-0" />
          </div>

          {/* Hover tooltip with full telemetry */}
          <div className="tooltip-box left-0 transform-none" style={{ left: 0, transform: 'translateX(4px)' }}>
            <div className="space-y-1.5 text-[10px] font-mono">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                <span className="text-slate-300">WSS PUB/SUB</span>
                <span className={wsConnected ? 'text-emerald-400' : 'text-slate-400'}>
                  {wsConnected ? '5ms (CONNECTED)' : 'RECONNECTING'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${canaryHealthy ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                <span className="text-slate-300">CANARY /healthz</span>
                <span className={canaryHealthy ? 'text-emerald-400' : 'text-slate-400'}>
                  {canaryHealthy ? '15s · HEALTHY' : 'PROBE FAILED'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${!isOfflineMode ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                <span className="text-slate-300">SYNC MODE</span>
                <span className={!isOfflineMode ? 'text-emerald-400' : 'text-blue-300'}>
                  {isOfflineMode ? 'SQLite Tier 1' : 'Cloud PostgreSQL'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Version tag */}
        <div className="text-[10px] font-mono text-slate-500 text-center">
          SYS_REV: 2.0.4 | SEC_CLR
        </div>
      </div>
    </aside>
  );
};
