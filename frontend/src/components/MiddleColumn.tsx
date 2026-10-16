import React, { useMemo } from 'react';
import { OperationalEvent } from '../types';
import { MapPin, AlertCircle, Clock, CheckCircle2, Activity } from 'lucide-react';
import { CORRIDOR_SECTIONS, eventMatchesSection } from '../data/corridorData';

interface MiddleColumnProps {
  events: OperationalEvent[];
  selectedEvent: OperationalEvent | null;
  onSelectEvent: (e: OperationalEvent | null) => void;
  activeTab: number;
  setActiveTab: (tab: number) => void;
  selectedSectionId: string;
  onSelectSection: (secId: string) => void;
  selectedDept: string;
  onSelectDept: (dept: string) => void;
}

const TAB_CONFIG = [
  { label: 'Ongoing Work', sublabel: 'Active on Track' },
  { label: 'Pending Approvals', sublabel: 'Awaiting Action' },
  { label: 'History', sublabel: 'All Sealed Records' },
];

export const MiddleColumn: React.FC<MiddleColumnProps> = ({
  events,
  selectedEvent,
  onSelectEvent,
  activeTab,
  setActiveTab,
  selectedSectionId,
  onSelectSection,
  selectedDept,
  onSelectDept,
}) => {
  const [historyScope, setHistoryScope] = React.useState<'ALL' | '30D' | '7D' | '24H'>('ALL');

  // Helper to categorize an event by tab
  const getEventCategory = (e: OperationalEvent): number => {
    if (e.fsm_stage === 5 || e.status === 'ACTIVE_IN_PROGRESS' || e.status === 'WORK_COMPLETED') {
      return 0; // Ongoing Work
    }
    if (e.fsm_stage >= 6 || e.status === 'BLOCK_CLEARED' || e.status === 'AUDIT_LOCKED' || e.status === 'CANCELLED' || e.status === 'REJECTED') {
      return 2; // History
    }
    return 1; // Pending Approvals (Stage 1-4)
  };

  // Helper to get normalized department across all Indian Railways wings
  const getEventDept = (e: OperationalEvent): string => {
    const idU = (e.id || '').toUpperCase();
    const descU = (e.description || '').toUpperCase();
    const origU = (e.originator_id || '').toUpperCase();

    if (
      e.stakeholders?.some(s => s.department === 'MECHANICAL_CW') ||
      idU.includes('-CW-') || idU.includes('-MECH-') ||
      descU.includes('C&W') || descU.includes('WHEEL') || descU.includes('BRAKE') || descU.includes('RAKE') ||
      origU.includes('CW')
    ) {
      return 'MECHANICAL_CW';
    }
    if (
      e.stakeholders?.some(s => s.department === 'SAFETY') ||
      idU.includes('-SAF-') ||
      descU.includes('SAFETY') || descU.includes('RPF') || descU.includes('DETONATOR') ||
      origU.includes('SAF')
    ) {
      return 'SAFETY';
    }
    if (
      e.stakeholders?.some(s => s.department === 'S_AND_T') ||
      idU.includes('-SIG-') || idU.includes('-SNT-') ||
      descU.includes('SIGNAL') || descU.includes('AXLE COUNTER') || descU.includes('INTERLOCKING') ||
      origU.includes('SIG')
    ) {
      return 'S_AND_T';
    }
    if (
      e.stakeholders?.some(s => s.department === 'CIVIL_P_WAY') ||
      idU.includes('-ENG-') || idU.includes('-PWY-') ||
      descU.includes('BALLAST') || descU.includes('P-WAY') || descU.includes('TAMPING') || descU.includes('WELDING') ||
      origU.includes('PWAY')
    ) {
      return 'CIVIL_P_WAY';
    }
    if (
      e.stakeholders?.some(s => s.department === 'OHE') ||
      idU.includes('-OHE-') ||
      e.impact_vector?.catenary_25kv_power_trip ||
      descU.includes('CATENARY') || descU.includes('TRACTION') ||
      origU.includes('OHE') || origU.includes('TPC')
    ) {
      return 'OHE';
    }
    return 'OPERATING';
  };

  // Filter events based on active tab, selected section, department, and history scope
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      // 1. Tab category filter
      const cat = getEventCategory(e);
      if (cat !== activeTab) return false;

      // 2. Section filter
      if (!eventMatchesSection(e.section, selectedSectionId)) {
        return false;
      }

      // 3. Department filter
      if (selectedDept !== 'ALL') {
        const d = getEventDept(e);
        if (d !== selectedDept) return false;
      }

      // 4. History scope filter
      if (activeTab === 2 && historyScope !== 'ALL') {
        const eventDate = new Date(e.created_at || e.requested_start || Date.now()).getTime();
        const now = new Date('2026-10-16T13:24:41+05:30').getTime();
        const diffHours = (now - eventDate) / (1000 * 60 * 60);
        if (historyScope === '24H' && diffHours > 24) return false;
        if (historyScope === '7D' && diffHours > 24 * 7) return false;
        if (historyScope === '30D' && diffHours > 24 * 30) return false;
      }

      return true;
    });
  }, [events, activeTab, selectedSectionId, selectedDept, historyScope]);

  // Counts for all 3 tabs (matching current section & dept filter)
  const tabCounts = useMemo(() => {
    const counts = [0, 0, 0];
    events.forEach(e => {
      if (!eventMatchesSection(e.section, selectedSectionId)) return;
      if (selectedDept !== 'ALL') {
        const d = getEventDept(e);
        if (d !== selectedDept) return;
      }
      const cat = getEventCategory(e);
      counts[cat]++;
    });
    return counts;
  }, [events, selectedSectionId, selectedDept]);

  // Section title based on current active tab
  const queueTitle = useMemo(() => {
    if (activeTab === 0) return 'Ongoing Track Blocks';
    if (activeTab === 1) return 'Pending Statutory Requisitions';
    return 'Archived Statutory Corridor Logs';
  }, [activeTab]);

  return (
    <div
      style={{
        width: '32%',
        minWidth: 320,
        maxWidth: 420,
        flexShrink: 0,
        background: '#F8FAFC',
        borderRight: '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── Top: Department Filter ───────────────── */}
      <div style={{ padding: '14px 16px 0' }}>
        <label
          style={{
            display: 'block',
            fontSize: 10.5,
            fontWeight: 700,
            color: '#64748B',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 6,
          }}
        >
          Department Filter
        </label>
        <select
          className="rs-select"
          value={selectedDept}
          onChange={e => onSelectDept(e.target.value)}
          id="dept-filter"
          style={{ width: '100%', height: 36, fontSize: 12 }}
        >
          <option value="ALL">All Departments (Inter-Departmental Quorum)</option>
          <option value="OPERATING">Operating &amp; Traffic (Control &amp; Stations - G&amp;SR)</option>
          <option value="OHE">Electrical &amp; Traction (OHE / TRD / 25kV Catenary)</option>
          <option value="CIVIL_P_WAY">Civil Engineering (Permanent Way / P-Way &amp; Bridges)</option>
          <option value="S_AND_T">Signal &amp; Telecommunication (S&amp;T &amp; Interlocking)</option>
          <option value="MECHANICAL_CW">Mechanical (Carriage &amp; Wagon / C&amp;W &amp; Rolling Stock)</option>
          <option value="SAFETY">Safety &amp; Security (RPF / Safety Directorate)</option>
        </select>
      </div>

      {/* ── Tabs: Ongoing / Pending / History ───────── */}
      <div
        style={{
          padding: '12px 14px 0',
          display: 'flex',
          borderBottom: '1px solid #E2E8F0',
          gap: 4,
        }}
      >
        {TAB_CONFIG.map((t, idx) => {
          const isActive = activeTab === idx;
          const count = tabCounts[idx];
          return (
            <button
              key={t.label}
              id={`queue-tab-${idx}`}
              onClick={() => {
                setActiveTab(idx);
                // Auto-select first matching event for this tab
                const firstMatch = events.find(e => {
                  if (getEventCategory(e) !== idx) return false;
                  return eventMatchesSection(e.section, selectedSectionId);
                });
                onSelectEvent(firstMatch || null);
              }}
              style={{
                flex: 1,
                padding: '8px 6px 10px',
                border: 'none',
                background: 'transparent',
                borderBottom: isActive ? '2px solid #2563EB' : '2px solid transparent',
                color: isActive ? '#1D4ED8' : '#64748B',
                fontWeight: isActive ? 700 : 500,
                fontSize: 11.5,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span>{t.label}</span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: 99,
                    background: isActive ? '#DBEAFE' : '#E2E8F0',
                    color: isActive ? '#1E40AF' : '#475569',
                  }}
                >
                  {count}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Optional Time Scope Chips (When in History Tab) ── */}
      {activeTab === 2 && (
        <div
          style={{
            padding: '8px 14px',
            background: '#F1F5F9',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            overflowX: 'auto',
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Horizon:
          </span>
          {[
            { id: 'ALL', label: 'All History' },
            { id: '30D', label: 'Past 30 Days' },
            { id: '7D', label: 'Past 7 Days' },
            { id: '24H', label: 'Past 24 Hours' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setHistoryScope(item.id as any)}
              id={`history-scope-${item.id}`}
              style={{
                padding: '3px 8px',
                borderRadius: 4,
                fontSize: 10.5,
                fontWeight: historyScope === item.id ? 700 : 500,
                border: '1px solid',
                borderColor: historyScope === item.id ? '#2563EB' : '#CBD5E1',
                background: historyScope === item.id ? '#EFF6FF' : '#FFFFFF',
                color: historyScope === item.id ? '#1D4ED8' : '#475569',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Middle: List Header & Request Cards ───── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            padding: '12px 16px 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#0F172A',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {queueTitle} ({filteredEvents.length})
          </span>
          {selectedSectionId !== 'ALL' && (
            <span
              style={{
                fontSize: 10,
                color: '#2563EB',
                background: '#EFF6FF',
                padding: '1px 6px',
                borderRadius: 4,
                border: '1px solid #BFDBFE',
                fontWeight: 600,
              }}
            >
              Filtered
            </span>
          )}
        </div>

        {/* List Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0 12px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {filteredEvents.length === 0 ? (
            <div
              style={{
                padding: '36px 16px',
                textAlign: 'center',
                background: '#FFFFFF',
                borderRadius: 8,
                border: '1px dashed #CBD5E1',
                margin: '8px 4px',
              }}
            >
              <AlertCircle size={28} color="#94A3B8" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                No requests found
              </div>
              <div style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.4, marginBottom: 12 }}>
                No entries match the selected section and department under this tab.
              </div>
              <button
                onClick={() => {
                  onSelectSection('ALL');
                  onSelectDept('ALL');
                }}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#2563EB',
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  padding: '5px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Reset Section &amp; Dept Filter
              </button>
            </div>
          ) : (
            filteredEvents.map(item => {
              const isSelected = selectedEvent?.id === item.id;
              const deptLabel = getEventDept(item);

              // Status badge details
              let statusBadgeBg = isSelected ? '#DBEAFE' : '#F1F5F9';
              let statusBadgeColor = isSelected ? '#1D4ED8' : '#475569';
              let statusText = item.status.replace(/_/g, ' ');

              if (activeTab === 0) {
                statusBadgeBg = '#DBEAFE';
                statusBadgeColor = '#1E40AF';
                statusText = 'Stage 5 • Active on Track';
              } else if (activeTab === 1) {
                statusBadgeBg = '#FEF3C7';
                statusBadgeColor = '#B45309';
                statusText = `Stage ${item.fsm_stage} • Awaiting Approvals`;
              } else if (activeTab === 2) {
                statusBadgeBg = '#D1FAE5';
                statusBadgeColor = '#065F46';
                statusText = 'Stage 7 • Sealed & Normalized';
              }

              return (
                <button
                  key={item.id}
                  id={`queue-card-${item.id}`}
                  className={`queue-card${isSelected ? ' selected' : ''}`}
                  onClick={() => onSelectEvent(item)}
                  style={{
                    textAlign: 'left',
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: isSelected ? '#EFF6FF' : '#FFFFFF',
                    border: isSelected ? '1.5px solid #2563EB' : '1px solid #E2E8F0',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 2px 8px rgba(37,99,235,0.08)' : '0 1px 2px rgba(0,0,0,0.02)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Row 1: ID & Dept */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: 'JetBrains Mono, monospace',
                        color: isSelected ? '#1D4ED8' : '#0F172A',
                      }}
                    >
                      {item.id}
                    </span>
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 4,
                        background: isSelected ? '#BFDBFE' : '#F1F5F9',
                        color: isSelected ? '#1E3A8A' : '#475569',
                        border: `1px solid ${isSelected ? '#93C5FD' : '#E2E8F0'}`,
                        letterSpacing: '0.04em',
                      }}
                    >
                      {deptLabel}
                    </span>
                  </div>

                  {/* Row 2: Location */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                    <MapPin size={11} color={isSelected ? '#2563EB' : '#64748B'} />
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: isSelected ? '#1E40AF' : '#334155',
                      }}
                    >
                      {item.section}
                    </span>
                    <span style={{ fontSize: 10.5, color: '#94A3B8' }}>
                      ({item.track_id.replace(/_/g, ' ')})
                    </span>
                  </div>

                  {/* Row 3: Short Description */}
                  <div
                    style={{
                      fontSize: 11,
                      color: isSelected ? '#334155' : '#64748B',
                      lineHeight: 1.3,
                      marginBottom: 6,
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {item.description}
                  </div>

                  {/* Row 4: Status / Stage Badge & Micro-Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: statusBadgeBg,
                          color: statusBadgeColor,
                        }}
                      >
                        {statusText}
                      </span>

                      {/* Photo Badge */}
                      {item.field_photo && (
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: '#EFF6FF',
                            color: '#1D4ED8',
                            border: '1px solid #BFDBFE',
                          }}
                        >
                          📷 GPS Verified
                        </span>
                      )}

                      {/* Piggybacked Block Badge */}
                      {item.piggybacked_depts && item.piggybacked_depts.length > 0 && (
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: '#ECFDF5',
                            color: '#065F46',
                            border: '1px solid #A7F3D0',
                          }}
                        >
                          🤝 Shared ({item.piggybacked_depts.length + 1} Depts)
                        </span>
                      )}
                    </div>

                    {/* Stage icon */}
                    {activeTab === 0 && <Activity size={12} color="#2563EB" style={{ flexShrink: 0 }} />}
                    {activeTab === 1 && <Clock size={12} color="#B45309" style={{ flexShrink: 0 }} />}
                    {activeTab === 2 && <CheckCircle2 size={12} color="#059669" style={{ flexShrink: 0 }} />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Bottom: Target Section Dropdown ──────── */}
      <div
        style={{
          padding: '12px 16px 14px',
          borderTop: '1px solid #E2E8F0',
          background: '#FFFFFF',
          boxShadow: '0 -2px 8px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <label
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: '#0F172A',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Target Section
          </label>
          <span style={{ fontSize: 10, color: '#64748B' }}>
            Nagpur Division (CR)
          </span>
        </div>
        <select
          className="rs-select"
          value={selectedSectionId}
          onChange={e => {
            const nextSec = e.target.value;
            onSelectSection(nextSec);
            // Immediately find an event in this section & tab to select
            const match = events.find(ev => {
              if (getEventCategory(ev) !== activeTab) return false;
              return eventMatchesSection(ev.section, nextSec);
            });
            onSelectEvent(match || null);
          }}
          id="section-filter"
          style={{ width: '100%', height: 38, fontSize: 12, fontWeight: 600 }}
        >
          {CORRIDOR_SECTIONS.map(s => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
