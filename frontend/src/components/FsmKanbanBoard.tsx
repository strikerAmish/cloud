import React from 'react';
import { OperationalEvent, EventStatus } from '../types';
import { EventTicketCard } from './EventTicketCard';
import { Plus } from 'lucide-react';

interface FsmKanbanBoardProps {
  events: OperationalEvent[];
  selectedEvent: OperationalEvent | null;
  onSelectEvent: (e: OperationalEvent) => void;
  openRequisitionModal: () => void;
  selectedDept: string;
}

const COLUMNS: Array<{
  key: EventStatus | string;
  label: string;
  color: string;
  bgDot: string;
  statuses: EventStatus[];
}> = [
  {
    key: 'DRAFT',
    label: 'Draft',
    color: 'text-slate-400',
    bgDot: 'bg-slate-500',
    statuses: ['DRAFT'],
  },
  {
    key: 'SUBMITTED',
    label: 'Submitted',
    color: 'text-blue-400',
    bgDot: 'bg-blue-500',
    statuses: ['SUBMITTED', 'DEPENDENCY_RESOLVED'],
  },
  {
    key: 'AWAITING_APPROVAL',
    label: 'Awaiting Approval',
    color: 'text-amber-400',
    bgDot: 'bg-amber-500',
    statuses: ['AWAITING_APPROVAL'],
  },
  {
    key: 'APPROVED',
    label: 'Approved',
    color: 'text-indigo-400',
    bgDot: 'bg-indigo-500',
    statuses: ['APPROVED', 'SCHEDULED'],
  },
  {
    key: 'ACTIVE_IN_PROGRESS',
    label: 'Active Work',
    color: 'text-emerald-400',
    bgDot: 'bg-emerald-500',
    statuses: ['ACTIVE_IN_PROGRESS'],
  },
  {
    key: 'WORK_COMPLETED',
    label: 'Work Done',
    color: 'text-yellow-400',
    bgDot: 'bg-yellow-500',
    statuses: ['WORK_COMPLETED', 'SAFETY_VERIFIED'],
  },
  {
    key: 'BLOCK_CLEARED',
    label: 'Block Cleared',
    color: 'text-cyan-400',
    bgDot: 'bg-cyan-500',
    statuses: ['BLOCK_CLEARED'],
  },
  {
    key: 'AUDIT_LOCKED',
    label: 'Audit Locked',
    color: 'text-slate-500',
    bgDot: 'bg-slate-600',
    statuses: ['AUDIT_LOCKED'],
  },
];

const EXCEPTION_COL = {
  key: 'EXCEPTION',
  label: 'Exception',
  color: 'text-red-400',
  bgDot: 'bg-red-500',
  statuses: ['REJECTED', 'CANCELLED', 'ESCALATED_SLA', 'ABORTED_SAFETY_LOCK'] as EventStatus[],
};

export const FsmKanbanBoard: React.FC<FsmKanbanBoardProps> = ({
  events,
  selectedEvent,
  onSelectEvent,
  openRequisitionModal,
  selectedDept,
}) => {
  const filteredEvents = selectedDept === 'ALL'
    ? events
    : events.filter((e) =>
        e.stakeholders.some((s) => s.department === selectedDept)
      );

  const allCols = [...COLUMNS, EXCEPTION_COL];

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Scrollable kanban track */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden kanban-scroll">
        <div className="flex gap-3.5 p-4 h-full min-w-max items-start">
          {allCols.map((col) => {
            const colEvents = filteredEvents.filter((e) =>
              (col.statuses as string[]).includes(e.status)
            );

            return (
              <div
                key={col.key}
                className="flex flex-col w-56 shrink-0 rounded-xl border border-slate-800/60 bg-[#0a0f1d]/80 overflow-hidden"
              >
                {/* Column header */}
                <div className="px-3 py-2.5 border-b border-slate-800/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${col.bgDot}`} />
                    <span className={`text-[11px] font-semibold ${col.color}`}>
                      {col.label}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-600 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded-full">
                    {colEvents.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-32">
                  {colEvents.map((e) => (
                    <EventTicketCard
                      key={e.id}
                      event={e}
                      isSelected={selectedEvent?.id === e.id}
                      onClick={() => onSelectEvent(e)}
                    />
                  ))}

                  {colEvents.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-6 text-[10px] text-slate-700 text-center gap-1">
                      <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-1">
                        <span className="text-slate-700">—</span>
                      </div>
                      No events
                    </div>
                  )}
                </div>

                {/* "Add" shortcut on DRAFT column */}
                {col.key === 'DRAFT' && (
                  <button
                    onClick={openRequisitionModal}
                    className="mx-2 mb-2 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-slate-700 text-[11px] text-slate-600 hover:text-slate-300 hover:border-slate-600 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Requisition
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
