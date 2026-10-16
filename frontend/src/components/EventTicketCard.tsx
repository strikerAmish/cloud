import React from 'react';
import {
  Zap, AlertTriangle, Lock, Clock, CheckCircle2, MapPin
} from 'lucide-react';
import { OperationalEvent } from '../types';

interface EventTicketCardProps {
  event: OperationalEvent;
  isSelected: boolean;
  onClick: () => void;
}

// Strict Blue, Green, Grey for departments
const DEPT_COLORS: Record<string, string> = {
  OHE:           'bg-blue-950/60 text-blue-300 border-blue-800/40',
  OPERATING:     'bg-blue-950/60 text-blue-400 border-blue-500/30',
  CIVIL_P_WAY:   'bg-emerald-950/60 text-emerald-400 border-emerald-500/30',
  S_AND_T:       'bg-slate-900 text-blue-300 border-blue-700/40',
  MECHANICAL_CW: 'bg-slate-900 text-slate-300 border-slate-700',
};

// Blue-to-Green progression for status border rings
const STATUS_RING: Record<string, string> = {
  DRAFT:                'border-slate-700',
  SUBMITTED:            'border-blue-500/50',
  DEPENDENCY_RESOLVED:  'border-blue-600/50',
  AWAITING_APPROVAL:    'border-sky-500/50',
  APPROVED:             'border-emerald-500/50',
  SCHEDULED:            'border-emerald-600/50',
  ACTIVE_IN_PROGRESS:   'border-green-500/60',
  WORK_COMPLETED:       'border-emerald-500/50',
  SAFETY_VERIFIED:      'border-emerald-600/50',
  BLOCK_CLEARED:        'border-green-500/50',
  AUDIT_LOCKED:         'border-slate-700',
  REJECTED:             'border-slate-700',
  ABORTED_SAFETY_LOCK:  'border-slate-700',
};

export const EventTicketCard: React.FC<EventTicketCardProps> = ({
  event, isSelected, onClick
}) => {
  const approvedCount  = event.stakeholders.filter((s) => s.approval_status === 'APPROVED').length;
  const pendingCount   = event.stakeholders.filter((s) => s.approval_status === 'PENDING').length;
  const deptColor      = DEPT_COLORS[event.stakeholders[0]?.department ?? 'OHE'] ?? DEPT_COLORS.OHE;
  const borderClass    = STATUS_RING[event.status] ?? 'border-slate-800';
  const hasPower       = event.impact_vector?.catenary_25kv_power_trip;
  const hasTraffic     = event.impact_vector?.absolute_traffic_block;

  // Sleek Blue theme for Fencing Token badges
  const tokenLabel = event.fencing_token
    ? `FT-${event.fencing_token.toString().padStart(4, '0')}`
    : null;

  return (
    <div
      onClick={onClick}
      className={`group p-3.5 rounded-xl border cursor-pointer transition-all duration-150 hover:border-slate-600 neo-card ${
        isSelected
          ? 'bg-[#151d2d] border-blue-500 ring-1 ring-blue-500/30 shadow-lg shadow-blue-500/10'
          : `bg-[#12161f] ${borderClass}`
      }`}
    >
      {/* Top row: Monospace Event ID + Dept tag */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono font-bold text-blue-300 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded">
          {event.id.substring(0, 18)}
        </span>
        <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${deptColor}`}>
          {event.stakeholders[0]?.department ?? 'OHE'}
        </span>
      </div>

      {/* Title: Bold Crisp White */}
      <div className="text-xs font-semibold text-slate-100 leading-snug mb-2.5 line-clamp-2">
        {event.description}
      </div>

      {/* Metadata pills (Blue / Slate Grey) */}
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        <span className="flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-slate-900/90 border border-slate-800 px-1.5 py-0.5 rounded">
          <MapPin className="w-2.5 h-2.5 text-slate-500" />
          KM {event.km_start}–{event.km_end}
        </span>
        <span className="text-[10px] font-mono text-slate-400 bg-slate-900/90 border border-slate-800 px-1.5 py-0.5 rounded">
          {event.track_id}
        </span>
        {hasPower && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-blue-400 bg-blue-950/40 border border-blue-500/30 px-1.5 py-0.5 rounded">
            <Zap className="w-2.5 h-2.5" /> 25kV Cut
          </span>
        )}
        {hasTraffic && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-blue-300 bg-slate-900 border border-blue-500/30 px-1.5 py-0.5 rounded">
            <AlertTriangle className="w-2.5 h-2.5 text-blue-400" /> Traffic Block
          </span>
        )}
        {tokenLabel && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-blue-300 bg-blue-950/50 border border-blue-800/40 px-1.5 py-0.5 rounded">
            <Lock className="w-2.5 h-2.5 text-blue-400" /> {tokenLabel}
          </span>
        )}
      </div>

      {/* Footer: Stakeholder sign-off status (Green for signed, Grey for pending) */}
      <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-slate-800/60">
        <div className="flex items-center gap-1">
          {event.stakeholders.slice(0, 4).map((s, i) => (
            <div
              key={i}
              title={`${s.role}: ${s.approval_status}`}
              className={`w-5 h-5 rounded-full border flex items-center justify-center text-[8px] font-bold transition-all ${
                s.approval_status === 'APPROVED'
                  ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              {s.role.charAt(0)}
            </div>
          ))}
          {event.stakeholders.length > 4 && (
            <span className="text-[9px] text-slate-500 ml-0.5">
              +{event.stakeholders.length - 4}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono">
          {approvedCount > 0 && (
            <span className="flex items-center gap-0.5 text-emerald-400 font-bold">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />{approvedCount}
            </span>
          )}
          {pendingCount > 0 && (
            <span className="flex items-center gap-0.5 text-slate-400 font-medium">
              <Clock className="w-3 h-3 text-slate-500" />{pendingCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
