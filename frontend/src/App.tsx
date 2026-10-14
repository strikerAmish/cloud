import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CorridorVideoWall } from './components/CorridorVideoWall';
import { RequisitionModal } from './components/RequisitionModal';
import { FsmLifecycleView } from './components/FsmLifecycleView';
import { DualKeyApprovalPortal } from './components/DualKeyApprovalPortal';
import { AuditLedgerView } from './components/AuditLedgerView';
import { ChaosSreDashboard } from './components/ChaosSreDashboard';
import { MobileOfflineBanner } from './components/MobileOfflineBanner';
import { fetchEvents, fetchHealth } from './api';
import { OperationalEvent } from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('screen1');
  const [events, setEvents] = useState<OperationalEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<OperationalEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [canaryHealthy, setCanaryHealthy] = useState<boolean>(true);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);

  const [ambientNotifications, setAmbientNotifications] = useState<string[]>([
    '23:05:12Z [TPC-NGP]: Circuit breaker trip telemetry verified at Feeding Post FP-04 (Wardha TSS).',
    '23:04:45Z [SM-WDA]: Physical point clamp #14A padlocked. Reverse route locked against Up Main.',
    '23:02:18Z [GSR-INVARIANT]: 6 Invariants evaluated. Dual-key approval matrix dispatched to TPC & Section Controller.',
    '23:00:00Z [COA-FOIS]: Section Controller pacing freight rake N/BOXNHL-243 via Down Main at TSR 30 km/h.',
  ]);

  // Load events from backend
  const loadEvents = async () => {
    try {
      const data = await fetchEvents();
      setEvents(data);
      if (data.length > 0) {
        // If no selected event or selected event was updated, refresh it
        setSelectedEvent((prev) => {
          if (!prev) return data[0];
          const updated = data.find((e) => e.id === prev.id);
          return updated || data[0];
        });
      }
    } catch (err) {
      console.error('Failed to load events', err);
    }
  };

  // Check health canary
  const checkHealth = async () => {
    try {
      const res = await fetchHealth();
      setCanaryHealthy(res.status === 'HEALTHY');
    } catch {
      setCanaryHealthy(false);
    }
  };

  useEffect(() => {
    loadEvents();
    checkHealth();
    const canaryTimer = setInterval(checkHealth, 15000);
    return () => clearInterval(canaryTimer);
  }, []);

  // WebSocket Connection to /ws/corridor
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWs = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/corridor`;

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type) {
              const timeStr = new Date().toLocaleTimeString();
              const newMsg = `${timeStr} [PUB/SUB]: ${data.type} - ${data.message || data.event_id || 'Telemetry update'}`;
              setAmbientNotifications((prev) => [newMsg, ...prev.slice(0, 20)]);
              loadEvents();
            }
          } catch (e) {
            console.error('WS parse error', e);
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          reconnectTimeout = setTimeout(connectWs, 3000);
        };

        ws.onerror = () => {
          setWsConnected(false);
        };
      } catch (err) {
        setWsConnected(false);
        reconnectTimeout = setTimeout(connectWs, 3000);
      }
    };

    connectWs();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  const handleSelectEvent = (event: OperationalEvent) => {
    setSelectedEvent(event);
    setActiveTab('screen3');
  };

  return (
    <div className="min-h-screen bg-[#080d1a] text-slate-100 flex flex-col font-sans">
      {/* Mission-Control Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openRequisitionModal={() => setIsModalOpen(true)}
        wsConnected={wsConnected}
        canaryHealthy={canaryHealthy}
        isOfflineMode={isOfflineMode}
        setIsOfflineMode={setIsOfflineMode}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Mobile Offline Simulation Banner */}
        <MobileOfflineBanner isOffline={isOfflineMode} />

        {/* Dynamic Screen View Switching */}
        {activeTab === 'screen1' && (
          <CorridorVideoWall
            events={events}
            onSelectEvent={handleSelectEvent}
            ambientNotifications={ambientNotifications}
          />
        )}

        {activeTab === 'screen3' && (
          <FsmLifecycleView
            event={selectedEvent}
            onRefresh={loadEvents}
          />
        )}

        {activeTab === 'screen4' && (
          <DualKeyApprovalPortal
            event={selectedEvent}
            onRefresh={loadEvents}
          />
        )}

        {activeTab === 'screen5' && (
          <AuditLedgerView />
        )}

        {activeTab === 'screen6' && (
          <ChaosSreDashboard />
        )}
      </main>

      {/* Screen 2: Requisition Modal */}
      <RequisitionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={(newEvent) => {
          loadEvents();
          setActiveTab('screen3');
        }}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-3 text-center text-xs text-slate-500 font-mono">
        RailSync • Indian Railways Event-Driven Cloud Coordination Layer • Section 14 Evaluation Baseline
      </footer>
    </div>
  );
}

export default App;
