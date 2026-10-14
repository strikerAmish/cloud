import React, { useState } from 'react';
import {
  Zap,
  AlertTriangle,
  Layers,
  Bell,
  Clock,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Filter
} from 'lucide-react';
import { OperationalEvent } from '../types';

interface CorridorVideoWallProps {
  events: OperationalEvent[];
  onSelectEvent: (event: OperationalEvent) => void;
  ambientNotifications: string[];
}

export const CorridorVideoWall: React.FC<CorridorVideoWallProps> = ({
  events,
  onSelectEvent,
  ambientNotifications,
}) => {
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(true);

  // Active OHE or Traffic block
  const activeEvent = events.find(
    (e) => !['BLOCK_CLEARED', 'AUDIT_LOCKED', 'REJECTED', 'CANCELLED'].includes(e.status)
  ) || events[0];

  const catenaryTripped = activeEvent?.impact_vector?.catenary_25kv_power_trip &&
    ['APPROVED', 'SCHEDULED', 'ACTIVE_IN_PROGRESS', 'WORK_COMPLETED'].includes(activeEvent?.status);

  return (
    <div className="space-y-6">
      {/* Top Banner: High Density Network Capacity Warning */}
      <div className="bg-gradient-to-r from-red-950/80 via-amber-950/70 to-slate-900 border border-red-500/40 rounded-xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-600/30 border border-red-500 flex items-center justify-center animate-pulse">
            <ShieldAlert className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-red-300 uppercase tracking-wider">
                Critical Line Capacity Utilization Alert
              </span>
              <span className="px-2 py-0.5 rounded text-xs bg-red-500 text-white font-mono font-bold">
                118.4% &gt; 100%
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Wardha–Sevagram HDN section operating beyond maximum rated headway capacity. Strict inter-departmental interlocking required.
            </p>
          </div>
        </div>

        {/* Department Filters */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-lg border border-slate-700/80">
          <Filter className="w-4 h-4 text-slate-400 ml-1.5 mr-1" />
          {['ALL', 'OHE', 'OPERATING', 'CIVIL_P_WAY', 'S_AND_T'].map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-all cursor-pointer ${
                selectedDept === dept
                  ? 'bg-cyan-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {/* Main Track Section Visualizer */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              Real-Time Corridor Section Visualizer: Wardha (WR) ⇄ Sevagram (SEGM)
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Central Railway • Nagpur Division (NGP) • Geofenced Chainage KM 140.000 to KM 148.000
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Normal Traffic
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> TSR 30 km/h Caution
            </span>
            <span className="flex items-center gap-1.5 text-red-400">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Active Safety Block
            </span>
            <span className="flex items-center gap-1.5 text-purple-400">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> Fencing Token Locked
            </span>
          </div>
        </div>

        {/* Interactive SVG / Track Schematic */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-6 overflow-x-auto relative">
          {/* Station Markers */}
          <div className="flex justify-between text-xs font-mono text-slate-400 mb-2 border-b border-slate-800 pb-2">
            <div className="text-left">
              <div className="font-bold text-cyan-400 text-sm">WARDHA JN (WR)</div>
              <div>KM 140.000 • RRI Panel</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-slate-300">LC-64 North Gate</div>
              <div>KM 142.100</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-slate-300">Crossover Pts #14A/B</div>
              <div>KM 143.040</div>
            </div>
            <div className="text-right">
              <div className="font-bold text-cyan-400 text-sm">SEVAGRAM JN (SEGM)</div>
              <div>KM 148.000 • Electronic Interlock</div>
            </div>
          </div>

          {/* Track Lines */}
          <div className="space-y-4 py-4 relative">
            {/* 1. 25kV Catenary Wire */}
            <div className="relative flex items-center">
              <span className="w-28 text-xs font-mono font-semibold text-amber-400 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" /> 25kV OHE
              </span>
              <div className="flex-1 h-2 bg-slate-800 rounded-full relative overflow-hidden">
                {/* Default live catenary */}
                <div className="absolute inset-0 bg-amber-500/40"></div>
                {/* De-energized block segment */}
                <div
                  className={`absolute h-full transition-all duration-700 ${
                    catenaryTripped ? 'bg-red-600 shadow-md shadow-red-500 animate-pulse' : 'bg-amber-400'
                  }`}
                  style={{ left: '26%', width: '22%' }}
                  title="OHE Isolated Segment KM 142.10 - 143.04"
                ></div>
              </div>
              <span className="w-32 text-right text-xs font-mono text-slate-400">
                {catenaryTripped ? '⚡ ISOLATED (FP-04)' : '⚡ ENERGIZED 25kV'}
              </span>
            </div>

            {/* 2. UP MAIN TRACK */}
            <div className="relative flex items-center">
              <span className="w-28 text-xs font-mono text-slate-300 font-semibold">UP MAIN</span>
              <div className="flex-1 h-4 bg-slate-800 rounded relative">
                {/* Normal track bed */}
                <div className="absolute inset-0 bg-blue-900/30 border-y border-blue-500/20"></div>

                {/* Active Block Zone */}
                {activeEvent && (
                  <div
                    onClick={() => onSelectEvent(activeEvent)}
                    className="absolute h-full top-0 bg-red-950/80 border-2 border-red-500 rounded cursor-pointer hover:bg-red-900/80 transition-all flex items-center justify-between px-2 text-xs font-mono text-red-200"
                    style={{ left: '26%', width: '22%' }}
                    title="Click to inspect Operational Event"
                  >
                    <span className="font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-red-400" />
                      BLOCK: KM 142.10-143.04
                    </span>
                    <span className="bg-red-600/80 px-1 py-0.5 rounded text-[10px]">
                      {activeEvent.fencing_token ? `FT-${activeEvent.fencing_token}` : activeEvent.status}
                    </span>
                  </div>
                )}
              </div>
              <span className="w-32 text-right text-xs font-mono text-red-400 font-semibold">
                {activeEvent?.status === 'ACTIVE_IN_PROGRESS' ? 'OCCUPIED (WORK)' : 'RESERVED'}
              </span>
            </div>

            {/* 3. DOWN MAIN TRACK */}
            <div className="relative flex items-center">
              <span className="w-28 text-xs font-mono text-slate-300 font-semibold">DN MAIN</span>
              <div className="flex-1 h-4 bg-slate-800 rounded relative">
                {/* Normal track bed */}
                <div className="absolute inset-0 bg-blue-900/30 border-y border-blue-500/20"></div>

                {/* TSR 30 km/h Caution zone */}
                <div
                  className="absolute h-full top-0 bg-amber-950/70 border-2 border-dashed border-amber-500 rounded flex items-center justify-center px-2 text-xs font-mono text-amber-200"
                  style={{ left: '24%', width: '28%' }}
                  title="Temporary Speed Restriction: 30 km/h due to adjacent catenary work"
                >
                  <span>⚠️ TSR 30 km/h (Adjacent Safety Buffer)</span>
                </div>
              </div>
              <span className="w-32 text-right text-xs font-mono text-amber-400 font-semibold">
                CAUTION 30 KM/H
              </span>
            </div>

            {/* 4. LOOP LINE 01 */}
            <div className="relative flex items-center">
              <span className="w-28 text-xs font-mono text-slate-400">LOOP 01</span>
              <div className="flex-1 h-3 bg-slate-800 rounded relative">
                <div className="absolute inset-0 bg-emerald-950/40 border-y border-emerald-500/20"></div>
              </div>
              <span className="w-32 text-right text-xs font-mono text-emerald-400">CLEAR</span>
            </div>
          </div>

          {/* Bottom KM Markers scale */}
          <div className="flex justify-between text-[11px] font-mono text-slate-500 mt-2 pt-2 border-t border-slate-800">
            <span>KM 140.00</span>
            <span>KM 141.00</span>
            <span className="text-cyan-400 font-bold">KM 142.10 (Start Geofence)</span>
            <span className="text-cyan-400 font-bold">KM 143.04 (End Geofence)</span>
            <span>KM 144.00</span>
            <span>KM 145.00</span>
            <span>KM 146.00</span>
            <span>KM 148.00</span>
          </div>
        </div>

        {/* Active Block Summary Card */}
        {activeEvent && (
          <div className="mt-4 p-4 rounded-lg bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-950 border border-cyan-500/40 text-cyan-400 font-mono text-sm font-bold">
                {activeEvent.fencing_token ? `FT-2026-10-14-${activeEvent.fencing_token}` : 'TOKEN PENDING'}
              </div>
              <div>
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  {activeEvent.description}
                  <span
                    className="px-2 py-0.5 rounded text-xs text-white font-mono"
                    style={{ backgroundColor: activeEvent.status_color || '#3182CE' }}
                  >
                    Stage {activeEvent.fsm_stage}: {activeEvent.status}
                  </span>
                </h4>
                <p className="text-xs text-slate-400 font-mono">
                  Originator: {activeEvent.originator_id} • Track: {activeEvent.track_id} • Geofence KM {activeEvent.km_start} to {activeEvent.km_end}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onSelectEvent(activeEvent)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 rounded-md text-xs font-semibold cursor-pointer transition-all"
              >
                Inspect FSM & Dual-Key State
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Ambient Notification Drawer & Cross-Department Telemetry Stream */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-sm text-white">
              Ambient Corridor Awareness Telemetry Stream (Invariant 1 & 4)
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Redis Pub/Sub sub-5ms Fan-out</span>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
          {ambientNotifications.map((notif, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 font-mono"
            >
              <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
              <span>{notif}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
