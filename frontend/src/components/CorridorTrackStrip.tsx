import React, { useState } from 'react';
import {
  ChevronDown, ChevronUp, Zap, AlertTriangle, Lock, Activity, Eye
} from 'lucide-react';
import { OperationalEvent } from '../types';

interface CorridorTrackStripProps {
  events: OperationalEvent[];
  onSelectEvent: (e: OperationalEvent) => void;
}

export const CorridorTrackStrip: React.FC<CorridorTrackStripProps> = ({
  events,
  onSelectEvent,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  // Active OHE / Track event
  const activeEvent = events.find(
    (e) => !['BLOCK_CLEARED', 'AUDIT_LOCKED', 'REJECTED', 'CANCELLED'].includes(e.status)
  ) ?? events[0];

  const catenaryTripped =
    !!activeEvent?.impact_vector?.catenary_25kv_power_trip &&
    ['APPROVED', 'SCHEDULED', 'ACTIVE_IN_PROGRESS', 'WORK_COMPLETED'].includes(activeEvent?.status);

  const hasToken = activeEvent?.fencing_token != null;
  const tokenLabel = activeEvent?.fencing_token != null
    ? `FT-${String(activeEvent.fencing_token).padStart(4, '0')}`
    : 'FT-0892';

  const kmStart = activeEvent?.km_start ?? 142.10;
  const kmEnd = activeEvent?.km_end ?? 143.04;

  // Calculate percentage along KM 140.00 to KM 148.00 (8km range)
  const leftPct = Math.max(0, Math.min(80, ((kmStart - 140.00) / 8.00) * 100));
  const widthPct = Math.max(12, Math.min(40, ((kmEnd - kmStart) / 8.00) * 100 * 2.2));

  return (
    <div
      className={`shrink-0 border-b border-slate-800/80 bg-[#0e1117] transition-all duration-300 overflow-hidden ${
        collapsed ? 'h-10' : 'h-48'
      }`}
    >
      {/* ── Visualizer Header Bar ─────────────────── */}
      <div className="h-9 flex items-center justify-between px-5 border-b border-slate-800/60 bg-[#12161f]">
        <div className="flex items-center gap-3">
          <Activity className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs font-semibold text-slate-200">
            Wardha ⇄ Sevagram Corridor Visualizer
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            KM 140.000 – KM 148.000 • High-Density Network
          </span>
          {!collapsed && (
            <div className="flex items-center gap-3 ml-4 text-[10px] font-mono">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Normal
              </span>
              <span className="flex items-center gap-1.5 text-blue-400">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> TSR 30 km/h
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Active Block
              </span>
              <span className="flex items-center gap-1.5 text-blue-300">
                <span className="w-2 h-2 rounded-full bg-blue-400" /> Token Locked
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-white cursor-pointer transition-colors"
        >
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          <span>{collapsed ? 'Expand Track View' : 'Collapse'}</span>
        </button>
      </div>

      {/* ── Main Track Visualizer Canvas ──────────── */}
      {!collapsed && (
        <div className="px-5 py-2.5 h-[152px] flex flex-col justify-between relative select-none">
          {/* Station Markers (Top Axis) */}
          <div className="flex justify-between items-center text-[10px] font-mono border-b border-slate-800/60 pb-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" />
              <span className="font-bold text-blue-300">WARDHA JN (WR)</span>
              <span className="text-slate-500">KM 140.000</span>
            </div>
            <div className="flex items-center gap-4 text-slate-400">
              <span>LC-64 North (KM 142.100)</span>
              <span>•</span>
              <span>Crossover #14A/B (KM 143.040)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">KM 148.000</span>
              <span className="font-bold text-blue-300">SEVAGRAM JN (SEGM)</span>
              <span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" />
            </div>
          </div>

          {/* Callout Pill with 1px Leader Line (Neatly positioned above UP MAIN track) */}
          {activeEvent && (
            <div
              className="absolute z-20 cursor-pointer group"
              style={{ left: `${leftPct + 3}%`, top: '34px' }}
              onClick={() => onSelectEvent(activeEvent)}
            >
              {/* Leader Line & Callout Badge Container */}
              <div className="relative flex flex-col items-center">
                {/* Pill in Sleek Blue Theme */}
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-mono font-semibold shadow-lg backdrop-blur-xs transition-transform group-hover:scale-105 bg-blue-950/90 border border-blue-500/60 text-blue-200">
                  <Lock className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                  <span>🔒 {tokenLabel} • KM {kmStart.toFixed(2)}–{kmEnd.toFixed(2)}</span>
                  <Eye className="w-2.5 h-2.5 text-slate-400 group-hover:text-white ml-0.5" />
                </div>
                {/* 1px Leader Line */}
                <div className="w-[1px] h-3.5 bg-blue-400/80" />
                {/* Leader dot pin on track */}
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 -mt-0.5" />
              </div>
            </div>
          )}

          {/* ── 4 Track Lines (Blue, Green, Grey Only) ──────── */}
          <div className="space-y-2 flex-1 flex flex-col justify-center mt-1">

            {/* Line 1: 25kV OHE */}
            <div className="flex items-center gap-3">
              <div className="w-24 shrink-0 flex items-center gap-1.5 text-[10px] font-mono font-bold text-blue-400">
                <Zap className="w-3 h-3 text-blue-400 shrink-0" />
                <span>25kV OHE</span>
              </div>
              <div className="flex-1 h-2 bg-slate-800/90 rounded relative overflow-hidden">
                <div className="absolute inset-0 bg-slate-900/40" />
                {/* De-energized / Geofence Section in Blue */}
                <div
                  className={`absolute h-full transition-all duration-500 ${
                    catenaryTripped
                      ? 'bg-blue-500 animate-pulse'
                      : 'bg-emerald-500/80'
                  }`}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                />
              </div>
              <div className="w-36 shrink-0 text-right">
                <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                  catenaryTripped
                    ? 'bg-blue-950/80 border border-blue-500/50 text-blue-300'
                    : 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300'
                }`}>
                  {catenaryTripped ? '⚡ ISOLATED FP-04' : '⚡ ENERGIZED 25KV'}
                </span>
              </div>
            </div>

            {/* Line 2: UP MAIN */}
            <div className="flex items-center gap-3">
              <div className="w-24 shrink-0 text-[10px] font-mono font-bold text-slate-300">
                UP MAIN
              </div>
              <div className="flex-1 h-3.5 bg-slate-800/90 rounded relative overflow-hidden border border-slate-700/60">
                <div className="absolute inset-0 bg-slate-900/60" />
                {/* Colored Geofence Segment (Blue / Emerald Green) */}
                {activeEvent && (
                  <div
                    onClick={() => onSelectEvent(activeEvent)}
                    className="absolute h-full top-0 cursor-pointer transition-all bg-blue-900/40 border-2 border-blue-500"
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    title={`Click to open details: ${activeEvent.id}`}
                  >
                    <div className="w-full h-full bg-stripes opacity-20" />
                  </div>
                )}
              </div>
              <div className="w-36 shrink-0 text-right">
                <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                  activeEvent?.status === 'ACTIVE_IN_PROGRESS'
                    ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300'
                    : 'bg-blue-950/80 border border-blue-500/40 text-blue-300'
                }`}>
                  {activeEvent?.status === 'ACTIVE_IN_PROGRESS' ? 'OCCUPIED (WORK)' : 'RESERVED'}
                </span>
              </div>
            </div>

            {/* Line 3: DN MAIN */}
            <div className="flex items-center gap-3">
              <div className="w-24 shrink-0 text-[10px] font-mono font-bold text-slate-300">
                DN MAIN
              </div>
              <div className="flex-1 h-3.5 bg-slate-800/90 rounded relative overflow-hidden border border-slate-700/60">
                <div className="absolute inset-0 bg-slate-900/60" />
                {/* Blue Dashed TSR 30 km/h buffer */}
                <div
                  className="absolute h-full top-0 bg-blue-950/40 border-2 border-dashed border-blue-500/70 rounded"
                  style={{ left: `${Math.max(0, leftPct - 4)}%`, width: `${widthPct + 8}%` }}
                  title="TSR 30 km/h Adjacent Buffer"
                />
              </div>
              <div className="w-36 shrink-0 text-right">
                <span className="inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-blue-950/80 border border-blue-500/40 text-blue-300">
                  CAUTION 30 KM/H
                </span>
              </div>
            </div>

            {/* Line 4: LOOP 01 */}
            <div className="flex items-center gap-3">
              <div className="w-24 shrink-0 text-[10px] font-mono text-slate-500">
                LOOP 01
              </div>
              <div className="flex-1 h-2.5 bg-slate-800/70 rounded relative overflow-hidden border border-slate-700/40">
                <div className="absolute inset-0 bg-emerald-950/20" />
              </div>
              <div className="w-36 shrink-0 text-right">
                <span className="inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
                  CLEAR
                </span>
              </div>
            </div>

          </div>

          {/* Bottom KM Chainage Scale */}
          <div className="flex justify-between text-[9px] font-mono text-slate-500 pt-1 border-t border-slate-800/60">
            <span>KM 140.00</span>
            <span>KM 141.00</span>
            <span className="text-blue-400 font-bold">KM 142.10 (LC-64)</span>
            <span className="text-blue-300 font-bold">KM 143.04 (#14A)</span>
            <span>KM 144.00</span>
            <span>KM 145.00</span>
            <span>KM 146.00</span>
            <span>KM 147.00</span>
            <span>KM 148.00</span>
          </div>
        </div>
      )}
    </div>
  );
};
