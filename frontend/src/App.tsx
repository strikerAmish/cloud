import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sidebar }           from './components/Sidebar';
import { TopHeader }         from './components/TopHeader';
import { MiddleColumn }      from './components/MiddleColumn';
import { RightActionPane }   from './components/RightActionPane';
import { AuditLedgerView }   from './components/AuditLedgerView';
import { OverviewDashboard } from './components/OverviewDashboard';
import { LoginView }         from './components/LoginView';
import { RequisitionModal }  from './components/RequisitionModal';
import { fetchEvents, fetchHealth, getOrCreateTraceparent } from './api';
import { OperationalEvent }  from './types';
import { INITIAL_OPERATIONAL_EVENTS, eventMatchesSection } from './data/corridorData';

export type View = 'workspace' | 'audit' | 'overview';

export function App() {
  const [isAuthenticated,   setIsAuthenticated]   = useState(true);
  const [currentUser,       setCurrentUser]       = useState({
    username: 'raviamish',
    name: 'Ravi Amish',
    role: 'Station Master / Junction In-Charge',
    station: 'Wardha Jn (WDA) & Sevagram (SEGM) Control',
  });
  const [activeView,        setActiveView]        = useState<View>('workspace');
  const [events,            setEvents]            = useState<OperationalEvent[]>(INITIAL_OPERATIONAL_EVENTS);
  const [selectedEvent,     setSelectedEvent]     = useState<OperationalEvent | null>(INITIAL_OPERATIONAL_EVENTS[0]);
  const [activeTab,         setActiveTab]         = useState(1); // 1 = Pending Approvals
  const [selectedSectionId, setSelectedSectionId] = useState('ALL');
  const [selectedDept,      setSelectedDept]      = useState('ALL');
  const [isModalOpen,       setIsModalOpen]       = useState(false);
  const [wsConnected,       setWsConnected]       = useState(false);
  const [canaryHealthy,     setCanaryHealthy]     = useState(true);
  const [isOfflineMode,     setIsOfflineMode]     = useState(false);
  const [ambientNotifs,     setAmbientNotifs]     = useState<string[]>([
    '23:05:12Z [TPC-NGP]: Circuit breaker trip telemetry verified at Feeding Post FP-04 (Wardha TSS).',
    '23:04:45Z [SM-WDA]: Physical point clamp #14A padlocked. Reverse route locked against Up Main.',
    '23:02:18Z [GSR-INVARIANT]: 6 Invariants evaluated. Dual-key approval matrix dispatched.',
    '23:00:00Z [COA-FOIS]: Section Controller pacing freight rake N/BOXNHL-243 via Down Main at TSR 30 km/h.',
  ]);

  // ── Load events from backend & merge with corridor dataset ──
  const loadEvents = useCallback(async () => {
    try {
      const data = await fetchEvents();
      if (Array.isArray(data) && data.length > 0) {
        // Merge fetched events with baseline so all sections remain available
        setEvents(prev => {
          const fetchedIds = new Set(data.map(d => d.id));
          const nonOverlapping = INITIAL_OPERATIONAL_EVENTS.filter(e => !fetchedIds.has(e.id));
          return [...data, ...nonOverlapping];
        });
      }
    } catch (err) {
      // Graceful offline fallback: baseline INITIAL_OPERATIONAL_EVENTS remain active
      console.log('Operating with full offline corridor dataset');
    }
  }, []);

  // ── Health canary ─────────────────────────────────
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetchHealth();
      setCanaryHealthy(res.status === 'HEALTHY');
    } catch {
      setCanaryHealthy(true); // default healthy for UI preview
    }
  }, []);

  useEffect(() => {
    loadEvents();
    checkHealth();
    const t = setInterval(checkHealth, 20_000);
    return () => clearInterval(t);
  }, [loadEvents, checkHealth]);

  // ── WebSocket for ambient telemetry ───────────────
  useEffect(() => {
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      try {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const tp    = encodeURIComponent(getOrCreateTraceparent());
        ws = new WebSocket(`${proto}//${window.location.host}/ws/corridor?traceparent=${tp}`);

        ws.onopen  = () => setWsConnected(true);
        ws.onclose = () => { setWsConnected(false); retryTimer = setTimeout(connect, 5000); };
        ws.onerror = () => setWsConnected(false);

        ws.onmessage = ev => {
          try {
            const data = JSON.parse(ev.data);
            if (data.type && data.type !== 'INITIAL_SNAPSHOT') {
              const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
              setAmbientNotifs(prev => [
                `${ts}Z [PUB/SUB]: ${data.type} — ${data.event_id ?? data.message ?? 'Telemetry update'}`,
                ...prev.slice(0, 30),
              ]);
              loadEvents();
            }
          } catch (_) { /* ignore */ }
        };
      } catch {
        setWsConnected(false);
        retryTimer = setTimeout(connect, 5000);
      }
    };

    connect();
    return () => {
      if (ws) ws.close();
      clearTimeout(retryTimer);
    };
  }, [loadEvents]);

  // ── Ensure selectedEvent always belongs to the current section filter ──
  useEffect(() => {
    if (selectedSectionId !== 'ALL' && selectedEvent) {
      if (!eventMatchesSection(selectedEvent.section, selectedSectionId)) {
        // Find first event matching the new section
        const match = events.find(e => eventMatchesSection(e.section, selectedSectionId));
        setSelectedEvent(match || null);
      }
    }
  }, [selectedSectionId, events]);

  // ── Handle local signing action to immediately reflect in state ──
  const handleLocalSign = (updatedEvent: OperationalEvent) => {
    setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
    setSelectedEvent(updatedEvent);
  };

  if (!isAuthenticated) {
    return (
      <LoginView
        onLoginSuccess={(u) => {
          setCurrentUser(u);
          setIsAuthenticated(true);
        }}
      />
    );
  }

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        display: 'flex',
        background: '#F8FAFC',
      }}
    >
      {/* ── Left Sidebar (3 items: Approval Portal, Audit & History, Overview) ── */}
      <Sidebar
        activeView={activeView}
        setActiveView={v => setActiveView(v)}
        isOfflineMode={isOfflineMode}
        setIsOfflineMode={setIsOfflineMode}
        wsConnected={wsConnected}
        canaryHealthy={canaryHealthy}
      />

      {/* ── Main Content Area ──────────────────────── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {/* Dynamic Clutter-Free Top Header */}
        <TopHeader
          events={events}
          selectedEvent={selectedEvent}
          ambientNotifications={ambientNotifs}
          activeView={activeView}
          selectedSectionId={selectedSectionId}
          onSelectSection={setSelectedSectionId}
          onLogout={() => setIsAuthenticated(false)}
        />

        {/* ── Active View Rendering ──────────────────── */}
        {activeView === 'workspace' && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              overflow: 'hidden',
              background: '#F8FAFC',
            }}
          >
            {/* Middle Column — Queue with Section & Tab Filtering */}
            <MiddleColumn
              events={events}
              selectedEvent={selectedEvent}
              onSelectEvent={setSelectedEvent}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              selectedSectionId={selectedSectionId}
              onSelectSection={setSelectedSectionId}
              selectedDept={selectedDept}
              onSelectDept={setSelectedDept}
            />

            {/* Right Action Pane — Detailed Review, Authorizations & Seal */}
            <RightActionPane
              event={selectedEvent}
              onRefresh={loadEvents}
              onNavigateAudit={() => setActiveView('audit')}
              isHistoryTab={activeTab === 2}
            />
          </div>
        )}

        {activeView === 'audit' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', background: '#F8FAFC' }}>
            <AuditLedgerView />
          </div>
        )}

        {activeView === 'overview' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', background: '#F8FAFC' }}>
            <OverviewDashboard
              onSelectSectionAndNavigate={(secId) => {
                setSelectedSectionId(secId);
                setActiveView('workspace');
              }}
            />
          </div>
        )}
      </div>

      {/* ── Requisition Modal ──────────────────────── */}
      <RequisitionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={() => { loadEvents(); setIsModalOpen(false); }}
      />
    </div>
  );
}

export default App;
