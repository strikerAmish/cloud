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

const DEPT_COLORS: Record<string, string> = {
  OHE:          'bg-amber-950/60 text-amber-400 border-amber-500/30',
  OPERATING:    'bg-blue-950/60  text-blue-400  border-blue-500/30',
  CIVIL_P_WAY:  'bg-green-950/60 text-green-400 border-green-500/30',
  S_AND_T:      'bg-purple-950/60 text-purple-400 border-purple-500/30',
  MECHANICAL_CW:'bg-orange-950/60 text-orange-400 border-orange-500/30',
};

const STATUS_RING: Record<string, string> = {
  DRAFT:                'border-slate-600',
  SUBMITTED:            'border-blue-500/60',
  DEPENDENCY_RESOLVED:  'border-blue-600/60',
  AWAITING_APPROVAL:    'border-amber-500/60',
  APPROVED:             'border-indigo-500/60',
  SCHEDULED:            'border-purple-500/60',
  ACTIVE_IN_PROGRESS:   'border-emerald-500/70',
  WORK_COMPLETED:       'border-yellow-500/60',
  SAFETY_VERIFIED:      'border-teal-500/60',
  BLOCK_CLEARED:        'border-cyan-500/60',
  AUDIT_LOCKED:         'border-slate-500/40',
  REJECTED:             'border-red-500/60',
  ABORTED_SAFETY_LOCK:  'border-red-600/70',
};

export const EventTicketCard: React.FC<EventTicketCardProps> = ({
  event, isSelected, onClick
}) => {
  const approvedCount  = event.stakeholders.filter((s) => s.approval_status === 'APPROVED').length;
  const pendingCount   = event.stakeholders.filter((s) => s.approval_status === 'PENDING').length;
  const deptColor      = DEPT_COLORS[event.stakeholders[0]?.department ?? 'OHE'] ?? DEPT_COLORS.OHE;
  const borderClass    = STATUS_RING[event.status] ?? 'border-slate-700';
  const hasPower       = event.impact_vector?.catenary_25kv_power_trip;
  const hasTraffic     = event.impact_vector?.absolute_traffic_block;

  const tokenLabel = event.fencing_token
    ? `FT-${event.fencing_token.toString().padStart(4, '0')}`
    : null;

  return (
    <div
      onClick={onClick}
      className={`group p-3.5 rounded-xl border cursor-pointer transition-all duration-150 hover:border-slate-600 hover:bg-[#111827] ${
        isSelected
          ? 'bg-[#0d1929] border-cyan-500/60 ring-1 ring-cyan-500/20 shadow-lg shadow-cyan-500/5'
          : `bg-[#0c1120] ${borderClass}`
      }`}
    >
      {/* Top row: Token ID + Dept badge */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[10px] font-mono font-bold text-cyan-300 bg-slate-900/80 border border-slate-700/60 px-2 py-0.5 rounded">
          {event.id.substring(0, 18)}
        </span>
        <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${deptColor}`}>
          {event.stakeholders[0]?.department ?? 'OHE'}
        </span>
      </div>

      {/* Title */}
      <div className="text-xs font-semibold text-slate-100 leading-snug mb-2.5 line-clamp-2">
        {event.description}
      </div>

      {/* Metadata pills */}
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        <span className="flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-slate-900/60 border border-slate-800 px-1.5 py-0.5 rounded">
          <MapPin className="w-2.5 h-2.5" />
          KM {event.km_start}–{event.km_end}
        </span>
        <span className="text-[10px] font-mono text-slate-400 bg-slate-900/60 border border-slate-800 px-1.5 py-0.5 rounded">
          {event.track_id}
        </span>
        {hasPower && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-amber-400 bg-amber-950/30 border border-amber-500/20 px-1.5 py-0.5 rounded">
            <Zap className="w-2.5 h-2.5" /> 25kV Cut
          </span>
        )}
        {hasTraffic && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-red-400 bg-red-950/30 border border-red-500/20 px-1.5 py-0.5 rounded">
            <AlertTriangle className="w-2.5 h-2.5" /> Traffic Block
          </span>
        )}
        {tokenLabel && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-purple-400 bg-purple-950/30 border border-purple-500/20 px-1.5 py-0.5 rounded">
            <Lock className="w-2.5 h-2.5" /> {tokenLabel}
          </span>
        )}
      </div>

      {/* Footer: Stakeholder sign-off status */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1">
          {event.stakeholders.slice(0, 4).map((s, i) => (
            <div
              key={i}
              title={`${s.role}: ${s.approval_status}`}
              className={`w-5 h-5 rounded-full border flex items-center justify-center text-[8px] font-bold transition-all ${
                s.approval_status === 'APPROVED'
                  ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                  : s.approval_status === 'REJECTED'
                  ? 'bg-red-950 border-red-500 text-red-300'
                  : 'bg-slate-800 border-slate-600 text-slate-400'
              }`}
            >
              {s.role.charAt(0)}
            </div>
          ))}
          {event.stakeholders.length > 4 && (
            <span className="text-[9px] text-slate-600 ml-0.5">
              +{event.stakeholders.length - 4}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono">
          {approvedCount > 0 && (
            <span className="flex items-center gap-0.5 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />{approvedCount}
            </span>
          )}
          {pendingCount > 0 && (
            <span className="flex items-center gap-0.5 text-amber-400">
              <Clock className="w-3 h-3" />{pendingCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
