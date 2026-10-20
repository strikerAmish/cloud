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
  searchQuery?: string;
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
  searchQuery = '',
}) => {
  const [historyScope, setHistoryScope] = React.useState<'ALL' | '30D' | '7D' | '24H'>('ALL');

  // Helper to categorize an event by tab:
  // Tab 0 = Ongoing Work (Stage 6: Active on Track)
  // Tab 1 = Pending Approvals (Stages 1-5: Requisitions and Approvals)
  // Tab 2 = History (Stage 7: Normalized & Sealed)
  const getEventCategory = (e: OperationalEvent): number => {
    if (e.fsm_stage === 7 || e.status === 'BLOCK_CLEARED' || e.status === 'AUDIT_LOCKED' || e.status === 'CANCELLED' || e.status === 'REJECTED') {
      return 2; // History
    }
    if (e.fsm_stage === 6 || e.status === 'ACTIVE_IN_PROGRESS' || e.status === 'WORK_COMPLETED') {
      return 0; // Ongoing Work
    }
    return 1; // Pending Approvals (Stage 1 to 5)
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

  // Helper for real-time search query matching across all railway attributes
  const eventMatchesQuery = (e: OperationalEvent, query: string): boolean => {
    if (!query) return true;
    const q = query.trim().toLowerCase();
    if (!q) return true;

    // Direct identifier and textual match
    if ((e.id || '').toLowerCase().includes(q)) return true;
    if ((e.section || '').toLowerCase().includes(q)) return true;
    if ((e.track_id || '').toLowerCase().includes(q)) return true;
    if ((e.description || '').toLowerCase().includes(q)) return true;
    if ((e.originator_id || '').toLowerCase().includes(q)) return true;
    if ((e.status || '').toLowerCase().includes(q)) return true;
    if (e.field_photo?.gang_supervisor?.toLowerCase().includes(q)) return true;
    if (e.field_photo?.km_chainage?.toLowerCase().includes(q)) return true;

    // Multi-department and stakeholder matches
    if (e.stakeholders?.some(s =>
      (s.officer_id || '').toLowerCase().includes(q) ||
      (s.role || '').toLowerCase().includes(q) ||
      (s.department || '').toLowerCase().includes(q)
    )) return true;

    // Department keyword aliases (e.g. searching "Civil" finds Civil/P-Way events)
    const dept = getEventDept(e);
    if (q === 'civil' || q === 'pway' || q === 'p-way' || q === 'track' || q === 'tamping' || q === 'ballast') {
      if (dept === 'CIVIL_P_WAY') return true;
    }
    if (q === 'ohe' || q === 'electrical' || q === 'traction' || q === 'catenary' || q === 'power' || q === 'tpc') {
      if (dept === 'OHE') return true;
    }
    if (q === 'signal' || q === 's&t' || q === 'snt' || q === 'telecom' || q === 'points' || q === 'interlocking') {
      if (dept === 'S_AND_T') return true;
    }
    if (q === 'mech' || q === 'mechanical' || q === 'c&w' || q === 'wagon' || q === 'rake') {
      if (dept === 'MECHANICAL_CW') return true;
    }
    if (q === 'safety' || q === 'rpf' || q === 'security' || q === 'inspection') {
      if (dept === 'SAFETY') return true;
    }
    if (q === 'operating' || q === 'traffic' || q === 'controller' || q === 'sm') {
      if (dept === 'OPERATING') return true;
    }

    // Corridor station aliases
    if (q.includes('patna') || q.includes('pnbe')) {
      if ((e.section || '').toLowerCase().includes('pnbe') || (e.description || '').toLowerCase().includes('patna')) return true;
    }
    if (q.includes('danapur') || q.includes('dnr')) {
      if ((e.section || '').toLowerCase().includes('dnr') || (e.description || '').toLowerCase().includes('danapur')) return true;
    }
    if (q.includes('ara')) {
      if ((e.section || '').toLowerCase().includes('ara') || (e.description || '').toLowerCase().includes('ara')) return true;
    }
    if (q.includes('buxar') || q.includes('bxr')) {
      if ((e.section || '').toLowerCase().includes('bxr') || (e.description || '').toLowerCase().includes('buxar')) return true;
    }
    if (q.includes('ddu') || q.includes('deen dayal')) {
      if ((e.section || '').toLowerCase().includes('ddu')) return true;
    }

    // Form3-PTW / permit searches
    if (q.includes('form3') || q.includes('ptw') || q.includes('form3-ptw') || q.includes('permit') || q.includes('etr-3')) {
      if (e.permits && e.permits.length > 0) return true;
      if (e.fsm_stage >= 5) return true;
    }

    return false;
  };

  // Filter events based on active tab, selected section, department, search query, and history scope
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

      // 4. Real-time Search Query Filter
      if (searchQuery && !eventMatchesQuery(e, searchQuery)) {
        return false;
      }

      // 5. History scope filter
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
  }, [events, activeTab, selectedSectionId, selectedDept, searchQuery, historyScope]);

  // Auto-select first matching event when searching
  React.useEffect(() => {
    if (searchQuery && searchQuery.trim() && filteredEvents.length > 0) {
      if (!selectedEvent || !filteredEvents.some(e => e.id === selectedEvent.id)) {
        onSelectEvent(filteredEvents[0]);
      }
    }
  }, [searchQuery, filteredEvents, selectedEvent, onSelectEvent]);

  // Counts for all 3 tabs (matching current section, dept, and search query)
  const tabCounts = useMemo(() => {
    const counts = [0, 0, 0];
    events.forEach(e => {
      if (!eventMatchesSection(e.section, selectedSectionId)) return;
      if (selectedDept !== 'ALL') {
        const d = getEventDept(e);
        if (d !== selectedDept) return;
      }
      if (searchQuery && !eventMatchesQuery(e, searchQuery)) return;
      const cat = getEventCategory(e);
      counts[cat]++;
    });
    return counts;
  }, [events, selectedSectionId, selectedDept, searchQuery]);

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
                {searchQuery ? `No results for "${searchQuery}"` : 'No requests found'}
              </div>
              <div style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.4, marginBottom: 12 }}>
                {searchQuery
                  ? `No corridor blocks match "${searchQuery}" under ${TAB_CONFIG[activeTab]?.label}.`
                  : 'No entries match the selected section and department under this tab.'}
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

              // Real-Time Corridor Awareness State
              const isOngoing = item.fsm_stage === 6 || item.status === 'ACTIVE_IN_PROGRESS' || item.status === 'WORK_COMPLETED';
              const isNormalized = item.fsm_stage === 7 || item.status === 'BLOCK_CLEARED' || item.status === 'AUDIT_LOCKED';
              const isApproved = item.fsm_stage === 5 || item.status === 'APPROVED';

              let statusBadgeBg = '#FFFBEB';
              let statusBadgeColor = '#92400E';
              let statusBadgeBorder = '#FCD34D';
              let statusText = `Stage ${item.fsm_stage || 4} • Awaiting Sign-off`;
              let awarenessPill = 'Approvals Pending';

              if (isOngoing) {
                statusBadgeBg = '#FEF2F2';
                statusBadgeColor = '#DC2626';
                statusBadgeBorder = '#FCA5A5';
                statusText = '🔴 ACTIVE ON TRACK';
                awarenessPill = 'Track Possession Active';
              } else if (isNormalized) {
                statusBadgeBg = '#F0FDF4';
                statusBadgeColor = '#166534';
                statusBadgeBorder = '#86EFAC';
                statusText = '🟢 READY FOR TRAFFIC';
                awarenessPill = 'Normalized & Clear';
              } else if (isApproved) {
                statusBadgeBg = '#EFF6FF';
                statusBadgeColor = '#1D4ED8';
                statusBadgeBorder = '#93C5FD';
                statusText = '🔵 APPROVED';
                awarenessPill = 'Ready to Occupy';
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
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: statusBadgeBg,
                          color: statusBadgeColor,
                          border: `1px solid ${statusBadgeBorder}`,
                        }}
                      >
                        {statusText}
                      </span>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 600,
                          padding: '1px 5px',
                          borderRadius: 4,
                          background: isOngoing ? '#FEE2E2' : isNormalized ? '#F0FDF4' : '#F8FAFC',
                          color: isOngoing ? '#B91C1C' : isNormalized ? '#15803D' : '#64748B',
                          border: `1px solid ${isOngoing ? '#FCA5A5' : isNormalized ? '#86EFAC' : '#E2E8F0'}`,
                        }}
                      >
                        {awarenessPill}
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
            Danapur &amp; DDU Division (ECR)
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
