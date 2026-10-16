import React, { useState } from 'react';
import {
  Bell, ChevronDown, FileCheck2,
  ShieldAlert, Filter, LayoutGrid, SplitSquareHorizontal
} from 'lucide-react';
import { OperationalEvent } from '../types';
import { TelemetryBellDrawer } from './TelemetryBellDrawer';

interface TopHeaderProps {
  events: OperationalEvent[];
  selectedDept: string;
  setSelectedDept: (d: string) => void;
  openRequisitionModal: () => void;
  ambientNotifications: string[];
  viewMode: 'board' | 'split';
  setViewMode: (v: 'board' | 'split') => void;
}

const DEPTS = ['ALL', 'OHE', 'OPERATING', 'CIVIL_P_WAY', 'S_AND_T'];

export const TopHeader: React.FC<TopHeaderProps> = ({
  events,
  selectedDept,
  setSelectedDept,
  openRequisitionModal,
  ambientNotifications,
  viewMode,
  setViewMode,
}) => {
  const [bellOpen, setBellOpen] = useState(false);

  // Filter out noise — only operational events (not INITIAL_SNAPSHOT)
  const opNotifs = ambientNotifications.filter(
    (n) => !n.includes('INITIAL_SNAPSHOT')
  );

  return (
    <>
      <header className="h-14 shrink-0 border-b border-slate-800/80 bg-[#12161f]/95 backdrop-blur-sm px-5 flex items-center justify-between gap-4 z-30">
        {/* ── Left: Breadcrumb + Capacity Alert ───── */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>NGP</span>
            <ChevronDown className="w-3 h-3 rotate-[-90deg]" />
            <span className="text-slate-100 font-semibold">Wardha–Sevagram</span>
          </div>

          {/* Capacity Notice: Calm, High-Contrast Blue/Grey Operational Notice */}
          <div className="tooltip-container">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 text-blue-400 border border-blue-500/30 cursor-default neo-pressed">
              <ShieldAlert className="w-3 h-3 text-blue-400" />
              <span className="text-[11px] font-mono font-bold text-blue-300">
                ⚠️ HDN CAP: 118.4% &gt; 100%
              </span>
            </div>
            <div className="tooltip-box" style={{ whiteSpace: 'normal', width: '260px' }}>
              <div className="font-bold text-blue-300 mb-1">High Density Network Notice</div>
              <p className="text-slate-300 leading-relaxed">
                Wardha–Sevagram section operating beyond maximum rated headway capacity.
                Strict inter-departmental interlocking is mandatory before any block grant.
              </p>
            </div>
          </div>
        </div>

        {/* ── Center: Department Filter Chips ──────── */}
        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-lg px-2 py-1 neo-pressed">
          <Filter className="w-3 h-3 text-slate-500 mr-1" />
          {DEPTS.map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
                selectedDept === dept
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>

        {/* ── Right: View Toggle + Bell + CTA ─────── */}
        <div className="flex items-center gap-2 shrink-0">
          {/* View switcher toggle */}
          <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-lg overflow-hidden neo-pressed">
            <button
              onClick={() => setViewMode('board')}
              title="Board View"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-all cursor-pointer ${
                viewMode === 'board'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Board View</span>
            </button>
            <button
              onClick={() => setViewMode('split')}
              title="Split Track View"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-all cursor-pointer border-l border-slate-800 ${
                viewMode === 'split'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <SplitSquareHorizontal className="w-3.5 h-3.5" />
              <span>Split Track View</span>
            </button>
          </div>

          {/* Notification Bell */}
          <button
            onClick={() => setBellOpen(true)}
            className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer neo-button"
            title="Ambient Telemetry Drawer"
          >
            <Bell className="w-4 h-4" />
            {opNotifs.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-600 border border-[#0e1117] text-[9px] font-bold text-white flex items-center justify-center">
                {Math.min(opNotifs.length, 9)}
              </span>
            )}
          </button>

          {/* Primary CTA Button */}
          <button
            onClick={openRequisitionModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-md shadow-blue-600/25 cursor-pointer transition-all"
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            + New Requisition
          </button>
        </div>
      </header>

      {/* Slide-over Ambient Telemetry Drawer */}
      <TelemetryBellDrawer
        isOpen={bellOpen}
        onClose={() => setBellOpen(false)}
        notifications={ambientNotifications}
      />
    </>
  );
};
