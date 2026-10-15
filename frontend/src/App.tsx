import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar }             from './components/Sidebar';
import { TopHeader }           from './components/TopHeader';
import { CorridorTrackStrip }  from './components/CorridorTrackStrip';
import { FsmKanbanBoard }      from './components/FsmKanbanBoard';
import { EventDetailDrawer }   from './components/EventDetailDrawer';
import { AuditLedgerView }     from './components/AuditLedgerView';
import { ChaosSreDashboard }   from './components/ChaosSreDashboard';
import { RequisitionModal }    from './components/RequisitionModal';
import { MobileOfflineBanner } from './components/MobileOfflineBanner';
import { fetchEvents, fetchHealth } from './api';
import { OperationalEvent } from './types';
import {
  Activity, Zap, Lock, ShieldAlert, CheckCircle2,
  Clock, MapPin, Gauge, Layers
} from 'lucide-react';

type View = 'workspace' | 'audit' | 'sre';

export function App() {
  // ── Core state ──────────────────────────────────
  const [activeView,     setActiveView]     = useState<View>('workspace');
  const [events,         setEvents]         = useState<OperationalEvent[]>([]);
  const [selectedEvent,  setSelectedEvent]  = useState<OperationalEvent | null>(null);
  const [drawerOpen,     setDrawerOpen]     = useState(false);
  const [isModalOpen,    setIsModalOpen]    = useState(false);
  const [wsConnected,    setWsConnected]    = useState(false);
  const [canaryHealthy,  setCanaryHealthy]  = useState(true);
  const [isOfflineMode,  setIsOfflineMode]  = useState(false);
  const [selectedDept,   setSelectedDept]   = useState('ALL');
  const [viewMode,       setViewMode]       = useState<'board' | 'split'>('board');
  const [ambientNotifs,  setAmbientNotifs]  = useState<string[]>([
    '23:05:12Z [TPC-NGP]: Circuit breaker trip telemetry verified at Feeding Post FP-04 (Wardha TSS).',
    '23:04:45Z [SM-WDA]: Physical point clamp #14A padlocked. Reverse route locked against Up Main.',
    '23:02:18Z [GSR-INVARIANT]: 6 Invariants evaluated. Dual-key approval matrix dispatched.',
    '23:00:00Z [COA-FOIS]: Section Controller pacing freight rake N/BOXNHL-243 via Down Main at TSR 30 km/h.',
  ]);

  // ── Load events ─────────────────────────────────
  const loadEvents = useCallback(async () => {
    try {
      const data = await fetchEvents();
      setEvents(data);
      setSelectedEvent((prev) => {
        if (!prev) return data[0] ?? null;
        return data.find((e) => e.id === prev.id) ?? data[0] ?? null;
      });
    } catch (err) {
      console.error('Failed to load events', err);
    }
  }, []);

  // ── Health canary ────────────────────────────────
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetchHealth();
      setCanaryHealthy(res.status === 'HEALTHY');
    } catch {
      setCanaryHealthy(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
    checkHealth();
    const t = setInterval(checkHealth, 15_000);
    return () => clearInterval(t);
  }, [loadEvents, checkHealth]);

  // ── WebSocket /ws/corridor ───────────────────────
  useEffect(() => {
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      try {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${proto}//${window.location.host}/ws/corridor`);

        ws.onopen  = () => setWsConnected(true);
        ws.onclose = () => { setWsConnected(false); retryTimer = setTimeout(connect, 3000); };
        ws.onerror = () => setWsConnected(false);

        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            // Filter noise – skip raw snapshots
            if (data.type && data.type !== 'INITIAL_SNAPSHOT') {
              const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
              setAmbientNotifs((prev) => [
                `${ts}Z [PUB/SUB]: ${data.type} — ${data.event_id ?? data.message ?? 'Telemetry update'}`,
                ...prev.slice(0, 30),
              ]);
              loadEvents();
            }
          } catch (_) { /* ignore parse errors */ }
        };
      } catch {
        setWsConnected(false);
        retryTimer = setTimeout(connect, 3000);
      }
    };

    connect();
    return () => {
      if (ws) ws.close();
      clearTimeout(retryTimer);
    };
  }, [loadEvents]);

  // ── Event selection ──────────────────────────────
  const handleSelectEvent = (event: OperationalEvent) => {
    setSelectedEvent(event);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => setDrawerOpen(false);

  // ── Render: Workspace view ───────────────────────
  const renderWorkspace = () => (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Offline banner (inline in workspace) */}
      {isOfflineMode && (
        <div className="shrink-0 px-4 pt-3">
          <MobileOfflineBanner isOffline={isOfflineMode} />
        </div>
      )}

      {/* Track strip (collapsible) */}
      <CorridorTrackStrip
        events={events}
        onSelectEvent={handleSelectEvent}
      />

      {/* Main area: Kanban + Split Panel (if split mode active) + Detail Drawer */}
      <div className="flex flex-1 overflow-hidden">
        {/* Split View Left Track Scheme (Only when split mode is active) */}
        {viewMode === 'split' && (
          <div className="w-[380px] shrink-0 border-r border-slate-800 bg-[#050914] flex flex-col overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Track Interlocking Scheme
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                LIVE SCADA
              </span>
            </div>

            {/* Axle Counter & Block Sections */}
            <div className="space-y-2">
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                Axle Counter Track Sections
              </div>
              {[
                { name: '140T (Wardha Outer)', status: 'CLEAR', track: 'UP MAIN', color: 'emerald' },
                { name: '142T (LC-64 North)',  status: 'OCCUPIED (FT-0892)', track: 'UP MAIN', color: 'red' },
                { name: '143T (Crossover #14A)', status: 'CLAMP LOCKED', track: 'UP MAIN', color: 'purple' },
                { name: '146T (Sevagram Approach)', status: 'CLEAR (TSR 30)', track: 'DN MAIN', color: 'amber' },
              ].map((sec) => (
                <div
                  key={sec.name}
                  className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-mono font-semibold text-slate-200">{sec.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{sec.track}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-${sec.color}-950/80 border border-${sec.color}-500/40 text-${sec.color}-400`}>
                    {sec.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Traction Feeder Telemetry */}
            <div className="space-y-2">
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                25kV Traction Feeding Post FP-04
              </div>
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2 text-[11px] font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">UP MAIN Feeder:</span>
                  <span className="text-red-400 font-bold">⚡ TRIPPED / ISOLATED</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">DN MAIN Feeder:</span>
                  <span className="text-emerald-400 font-bold">⚡ 25.4 kV ACTIVE</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Earth Discharge:</span>
                  <span className="text-purple-300 font-bold">RODS CLAMPED (KM 142.1)</span>
                </div>
              </div>
            </div>

            {/* Quick Inspect Active Event */}
            {selectedEvent && (
              <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-500/30 space-y-2">
                <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  Selected Ticket Location
                </div>
                <div className="text-xs text-slate-200 font-medium">
                  {selectedEvent.description}
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  {selectedEvent.track_id} • KM {selectedEvent.km_start.toFixed(2)}–{selectedEvent.km_end.toFixed(2)}
                </div>
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="w-full py-1.5 text-center bg-cyan-600/80 hover:bg-cyan-500 text-white rounded text-xs font-bold transition-all cursor-pointer"
                >
                  Open Ticket Drawer
                </button>
              </div>
            )}
          </div>
        )}

        {/* FSM Kanban Board */}
        <FsmKanbanBoard
          events={events}
          selectedEvent={selectedEvent}
          onSelectEvent={handleSelectEvent}
          openRequisitionModal={() => setIsModalOpen(true)}
          selectedDept={selectedDept}
        />

        {/* Event Detail Drawer (Slide-over panel on the right) */}
        {drawerOpen && selectedEvent && (
          <EventDetailDrawer
            event={selectedEvent}
            onClose={handleCloseDrawer}
            onRefresh={loadEvents}
            onNavigateAudit={() => setActiveView('audit')}
          />
        )}
      </div>
    </div>
  );

  // ── Render: Audit Ledger view ────────────────────
  const renderAudit = () => (
    <div className="flex-1 overflow-y-auto p-6 bg-[#020509]">
      <AuditLedgerView />
    </div>
  );

  // ── Render: SRE & Chaos view ─────────────────────
  const renderSre = () => (
    <div className="flex-1 overflow-y-auto p-6 bg-[#020509]">
      <ChaosSreDashboard />
    </div>
  );

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-[#020509]">
      {/* ── Left Sidebar ────────────────────────── */}
      <Sidebar
        activeView={activeView}
        setActiveView={(v) => setActiveView(v as View)}
        isOfflineMode={isOfflineMode}
        setIsOfflineMode={setIsOfflineMode}
        wsConnected={wsConnected}
        canaryHealthy={canaryHealthy}
      />

      {/* ── Main workspace column ────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top action bar */}
        <TopHeader
          events={events}
          selectedDept={selectedDept}
          setSelectedDept={setSelectedDept}
          openRequisitionModal={() => setIsModalOpen(true)}
          ambientNotifications={ambientNotifs}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />

        {/* Active view content */}
        {activeView === 'workspace' && renderWorkspace()}
        {activeView === 'audit'     && renderAudit()}
        {activeView === 'sre'       && renderSre()}
      </div>

      {/* ── Requisition Modal (Screen 2) ─────────── */}
      <RequisitionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={() => { loadEvents(); setIsModalOpen(false); }}
      />
    </div>
  );
}

export default App;
