import React, { useState, useRef, useEffect } from 'react';
import {
  Smartphone, Camera, MapPin, MessageSquare, Send, CheckCircle2,
  AlertTriangle, FileText, QrCode, Wifi, WifiOff, Plus, Tag,
  RefreshCw, X, Shield, Zap, Clock, Users, ArrowRight, ShieldCheck,
  Check, ChevronRight, UploadCloud, Eye, AlertOctagon, Battery, Signal,
  CheckSquare
} from 'lucide-react';
import { OperationalEvent } from '../types';
import { createEvent, fetchEvents, activateWork, completeWork } from '../api';

interface AndroidFieldAppProps {
  onEventCreated?: () => void;
  onNavigateToPortal?: () => void;
}

interface ChatMessage {
  id: string;
  sender: string;
  role: 'FIELD_SUPERVISOR' | 'STATION_MASTER' | 'TPC' | 'CONTROLLER';
  text: string;
  timestamp: string;
  taggedDepts?: string[];
}

export const AndroidFieldApp: React.FC<AndroidFieldAppProps> = ({
  onEventCreated,
  onNavigateToPortal,
}) => {
  // Mobile device simulator state
  const [deviceFrame, setDeviceFrame] = useState(true);
  const [activeTab, setActiveTab] = useState<'permits' | 'requisition' | 'camera' | 'queries'>('permits');
  const [isOffline, setIsOffline] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  // Events & Data
  const [events, setEvents] = useState<OperationalEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Camera / Geotagged Inspection State
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    'https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=800&q=80'
  );
  const [cameraGeo, setCameraGeo] = useState({
    lat: '25.60214° N',
    lng: '85.12053° E',
    chainage: 'KM 548/14 UP MAIN',
    section: 'Danapur (DNR) ⇄ Patna Jn (PNBE)',
    altitude: '54.2 m AMSL',
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
    hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  });
  const [supervisorNote, setSupervisorNote] = useState(
    'Earthing discharge rod clamped to contact wire. Section de-energized. Tamping rake positioned at crossover.'
  );

  // New Requisition Form State
  const [reqSection, setReqSection] = useState('Danapur-Patna');
  const [reqTrack, setReqTrack] = useState('UP_MAIN');
  const [reqKmStart, setReqKmStart] = useState('548.10');
  const [reqKmEnd, setReqKmEnd] = useState('554.00');
  const [reqDurationHrs, setReqDurationHrs] = useState('2.5');
  const [reqPowerCut, setReqPowerCut] = useState(true);
  const [reqTrafficBlock, setReqTrafficBlock] = useState(true);
  const [reqSpeedRestr, setReqSpeedRestr] = useState(true);
  const [reqPointClamp, setReqPointClamp] = useState(true);
  const [reqDesc, setReqDesc] = useState('Emergency catenary dropper alignment & 25kV insulator inspection per ACTM Vol II.');
  const [submittingReq, setSubmittingReq] = useState(false);

  // Live Clarification Thread (Field Crew <-> Station Master)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'Station Master (PNBE)',
      role: 'STATION_MASTER',
      text: 'Section Controller confirmed path margin. Confirm physical earthing rod clamp deployed on FP-02 catenary.',
      timestamp: '13:02 UTC',
    },
    {
      id: 'msg-2',
      sender: 'SSE / OHE (Field Supervisor)',
      role: 'FIELD_SUPERVISOR',
      text: 'Earthing rods clamped at KM 548/14. Photo evidence uploaded with chainage watermark. Requesting Form ETR-3 token.',
      timestamp: '13:05 UTC',
      taggedDepts: ['@OHE', '@OPERATING'],
    },
    {
      id: 'msg-3',
      sender: 'TPC Danapur Grid',
      role: 'TPC',
      text: 'Circuit breaker CB-204 tripped. 25kV catenary dead. Form ETR-1 clearance issued to SM.',
      timestamp: '13:08 UTC',
    },
  ]);
  const [newChatText, setNewChatText] = useState('');
  const [selectedTaggedDept, setSelectedTaggedDept] = useState('@OPERATING');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load Events
  const loadEventsData = async () => {
    setLoading(true);
    try {
      const data = await fetchEvents();
      if (Array.isArray(data) && data.length > 0) {
        setEvents(data);
        if (!selectedEventId) {
          setSelectedEventId(data[0].id);
        }
      }
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEventsData();
  }, []);

  // Handle Photo File Upload
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
      setCameraGeo({
        lat: '25.60281° N',
        lng: '85.12110° E',
        chainage: `KM ${reqKmStart || '548.10'} UP MAIN`,
        section: reqSection === 'Danapur-Patna' ? 'Danapur (DNR) ⇄ Patna Jn (PNBE)' : reqSection,
        altitude: '53.8 m AMSL',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
        hash: 'a718b958c2199b0c2a71d88206159c41763a826190e8c028e3b1297d028e192c',
      });
      setActionSuccess('Field Photo with GPS Chainage Captured & Watermarked!');
      setTimeout(() => setActionSuccess(null), 3500);
    }
  };

  // Submit New Requisition from Android App
  const handleMobileSubmitRequisition = async () => {
    setSubmittingReq(true);
    try {
      const now = new Date();
      const startTime = now.toISOString();
      const endTime = new Date(now.getTime() + parseFloat(reqDurationHrs) * 60 * 60 * 1000).toISOString();

      const payload = {
        division: 'DNR',
        section: reqSection,
        track_id: reqTrack,
        km_start: parseFloat(reqKmStart),
        km_end: parseFloat(reqKmEnd),
        requested_start: startTime,
        requested_end: endTime,
        impact_vector: {
          catenary_25kv_power_trip: reqPowerCut,
          absolute_traffic_block: reqTrafficBlock,
          speed_restriction_kmh: reqSpeedRestr ? 30 : 0,
          feeding_posts: ['FP-02 (Danapur TSS)'],
          points_clamping_required: reqPointClamp,
          track_bonding_notice: true,
        },
        description: `[ANDROID FIELD APP] ${reqDesc}`,
        originator_id: 'SSE_OHE_PATNA_01',
      };

      await createEvent(payload);
      setActionSuccess('Requisition Dispatched to Station Master Queue!');
      await loadEventsData();
      setActiveTab('permits');
      if (onEventCreated) onEventCreated();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to submit requisition');
    } finally {
      setSubmittingReq(false);
    }
  };

  // Send Chat Query to Station Master
  const handleSendChat = () => {
    if (!newChatText.trim()) return;
    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'SSE / OHE (Field Supervisor)',
      role: 'FIELD_SUPERVISOR',
      text: newChatText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' UTC',
      taggedDepts: [selectedTaggedDept],
    };

    setChatMessages(prev => [...prev, msg]);
    setNewChatText('');

    // Simulate Station Master automated response after 2 seconds
    setTimeout(() => {
      setChatMessages(prev => [
        ...prev,
        {
          id: `msg-${Date.now() + 1}`,
          sender: 'Station Master (PNBE)',
          role: 'STATION_MASTER',
          text: `[ACK] ${msg.taggedDepts?.[0] || '@OPERATING'}: Memo acknowledged on VDU panel. Interlock route padlocked. Fencing token valid.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' UTC',
        },
      ]);
    }, 2000);
  };

  // Field Actions
  const handleActivateWork = async (id: string) => {
    try {
      await activateWork(id);
      setActionSuccess('Work Commenced: Track Custody Handed to Field Crew');
      loadEventsData();
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCompleteWork = async (id: string) => {
    try {
      await completeWork(id, 'SSE_OHE_PATNA_01');
      setActionSuccess('Safety Certified: Track Handed Back to Station Master');
      loadEventsData();
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Top Header Banner (Matching Desktop Web App) ───────────────── */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 12,
          border: '1px solid #E2E8F0',
          padding: '24px 28px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                background: '#ECFDF5',
                color: '#065F46',
                padding: '3px 8px',
                borderRadius: 4,
                border: '1px solid #A7F3D0',
              }}
            >
              INTERFACE 2 • FIELD MOBILE APPLICATION
            </span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                background: '#EFF6FF',
                color: '#1D4ED8',
                padding: '3px 8px',
                borderRadius: 4,
                border: '1px solid #BFDBFE',
              }}
            >
              DANAPUR &amp; PATNA JN CORRIDOR
            </span>
          </div>

          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: '#0F172A',
              margin: '0 0 4px',
              letterSpacing: '-0.01em',
            }}
          >
            RailSync Frontline Field Android Application
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
            Frontline mobile client for track engineers (OHE, P-Way, S&amp;T) featuring GPS geotagged photo evidence, mobile block requisitions, and two-way station master Q&amp;A.
          </p>
        </div>

        {/* View Mode Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setDeviceFrame(!deviceFrame)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              background: deviceFrame ? '#F1F5F9' : '#FFFFFF',
              color: '#0F172A',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Smartphone size={15} color="#2563EB" />
            <span>{deviceFrame ? 'Android Phone Shell' : 'Expanded Responsive View'}</span>
          </button>

          <button
            onClick={() => setIsOffline(!isOffline)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: isOffline ? '1px solid #FCA5A5' : '1px solid #86EFAC',
              background: isOffline ? '#FEF2F2' : '#F0FDF4',
              color: isOffline ? '#991B1B' : '#166534',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            title="Demonstrates offline caching behavior when cellular signal drops in remote track cuttings"
          >
            {isOffline ? <WifiOff size={15} color="#DC2626" /> : <Wifi size={15} color="#16A34A" />}
            <span>{isOffline ? 'Offline (Tier 1 SQLite)' : '4G LTE Connected'}</span>
          </button>

          {onNavigateToPortal && (
            <button
              onClick={onNavigateToPortal}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#2563EB',
                color: '#fff',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>Switch to Decision Portal</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Success Toast ─────────────────────────────────────── */}
      {actionSuccess && (
        <div
          style={{
            background: '#F0FDF4',
            border: '1.5px solid #86EFAC',
            padding: '12px 18px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: '#15803D',
            fontSize: 13,
            fontWeight: 700,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <CheckCircle2 size={18} color="#16A34A" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* ── Main Phone Wrapper (Light / Modern Enterprise) ───── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          paddingBottom: 24,
        }}
      >
        <div
          style={{
            width: deviceFrame ? 418 : '100%',
            maxWidth: deviceFrame ? 418 : 1100,
            minHeight: deviceFrame ? 840 : 'auto',
            background: '#FFFFFF',
            borderRadius: deviceFrame ? 38 : 12,
            border: deviceFrame ? '8px solid #0F172A' : '1px solid #E2E8F0',
            boxShadow: deviceFrame ? '0 25px 60px -15px rgba(15,23,42,0.25)' : '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* ── Android Status Bar ─────────────────────────────── */}
          <div
            style={{
              height: 28,
              background: '#F8FAFC',
              padding: '0 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#334155',
              fontSize: 11,
              fontWeight: 700,
              fontFamily: 'system-ui, sans-serif',
              borderBottom: '1px solid #E2E8F0',
            }}
          >
            <span>{currentTime || '13:25'}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: isOffline ? '#DC2626' : '#15803D' }}>
                {isOffline ? 'OFFLINE' : '4G+'}
              </span>
              <Signal size={12} color={isOffline ? '#DC2626' : '#16A34A'} />
              <Battery size={13} color="#475569" />
            </div>
          </div>

          {/* ── App Top Header (Indian Railways Branding) ─────── */}
          <div
            style={{
              padding: '12px 18px',
              background: '#FFFFFF',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  color: '#fff',
                  fontSize: 13,
                  boxShadow: '0 2px 6px rgba(37,99,235,0.3)',
                }}
              >
                RS
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>
                  RailSync Field Crew
                </div>
                <div style={{ fontSize: 10.5, color: '#64748B', fontWeight: 600 }}>
                  SSE / OHE • Danapur – Patna Section
                </div>
              </div>
            </div>

            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 4,
                background: isOffline ? '#FEF2F2' : '#ECFDF5',
                color: isOffline ? '#991B1B' : '#065F46',
                border: isOffline ? '1px solid #FCA5A5' : '1px solid #A7F3D0',
              }}
            >
              {isOffline ? 'SQLITE QUEUE' : 'CLOUD SYNC'}
            </div>
          </div>

          {/* ── Tab Switcher Bar ──────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              background: '#F8FAFC',
              borderBottom: '1px solid #E2E8F0',
            }}
          >
            {[
              { id: 'permits', label: 'My Permits', icon: QrCode },
              { id: 'camera', label: 'Geo Camera', icon: Camera },
              { id: 'requisition', label: '+ Requisition', icon: Plus },
              { id: 'queries', label: 'SM Desk Q&A', icon: MessageSquare },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    flex: 1,
                    padding: '11px 4px',
                    border: 'none',
                    background: isActive ? '#FFFFFF' : 'transparent',
                    borderBottom: isActive ? '2px solid #2563EB' : '2px solid transparent',
                    color: isActive ? '#1D4ED8' : '#64748B',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3,
                    fontSize: 11,
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={16} color={isActive ? '#2563EB' : '#64748B'} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* ── Tab Content Area ──────────────────────────────── */}
          <div style={{ flex: 1, padding: 16, overflowY: 'auto', background: '#F8FAFC' }}>
            
            {/* ── TAB 1: PERMITS & LIVE STATUS ──────────────────── */}
            {activeTab === 'permits' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Active Track Possessions &amp; Form ETR-3
                  </span>
                  <button
                    onClick={loadEventsData}
                    style={{ background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600 }}
                  >
                    <RefreshCw size={12} />
                    <span>Refresh</span>
                  </button>
                </div>

                {events.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center', color: '#64748B', fontSize: 12 }}>
                    No active track blocks found. Draft a new requisition below.
                  </div>
                ) : (
                  events.slice(0, 4).map((e) => {
                    const isApproved = e.fsm_stage >= 5;
                    const isActiveOnTrack = e.fsm_stage === 6;
                    const isCleared = e.fsm_stage >= 7;

                    return (
                      <div
                        key={e.id}
                        style={{
                          background: '#FFFFFF',
                          borderRadius: 10,
                          border: isActiveOnTrack
                            ? '1.5px solid #2563EB'
                            : isApproved
                            ? '1.5px solid #10B981'
                            : '1px solid #E2E8F0',
                          padding: 15,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, fontWeight: 800, color: '#1D4ED8' }}>
                            {e.id}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: isActiveOnTrack ? '#EFF6FF' : isApproved ? '#ECFDF5' : '#F1F5F9',
                              color: isActiveOnTrack ? '#1D4ED8' : isApproved ? '#065F46' : '#475569',
                              border: isActiveOnTrack ? '1px solid #BFDBFE' : isApproved ? '1px solid #A7F3D0' : '1px solid #E2E8F0',
                            }}
                          >
                            STAGE {e.fsm_stage} • {e.status}
                          </span>
                        </div>

                        <div style={{ fontSize: 12.5, color: '#1E293B', fontWeight: 600, lineHeight: 1.4 }}>
                          {e.description}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11, color: '#64748B' }}>
                          <div>
                            <span style={{ color: '#94A3B8' }}>Track: </span>
                            <span style={{ color: '#0F172A', fontWeight: 700 }}>{e.track_id}</span>
                          </div>
                          <div>
                            <span style={{ color: '#94A3B8' }}>Chainage: </span>
                            <span style={{ color: '#0F172A', fontWeight: 700 }}>KM {e.km_start} – {e.km_end}</span>
                          </div>
                          <div>
                            <span style={{ color: '#94A3B8' }}>25kV Power: </span>
                            <span style={{ color: e.impact_vector?.catenary_25kv_power_trip ? '#DC2626' : '#16A34A', fontWeight: 700 }}>
                              {e.impact_vector?.catenary_25kv_power_trip ? 'POWER CUT' : 'LIVE NORMAL'}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: '#94A3B8' }}>Fencing Token: </span>
                            <span style={{ color: '#2563EB', fontFamily: 'monospace', fontWeight: 700 }}>FT-2026-DNR-892</span>
                          </div>
                        </div>

                        {/* Interactive Field Action Buttons */}
                        <div style={{ display: 'flex', gap: 8, paddingTop: 6, borderTop: '1px solid #F1F5F9' }}>
                          {e.fsm_stage === 5 && (
                            <button
                              onClick={() => handleActivateWork(e.id)}
                              style={{
                                flex: 1,
                                padding: '8px 12px',
                                borderRadius: 6,
                                border: 'none',
                                background: '#16A34A',
                                color: '#fff',
                                fontSize: 11.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                              }}
                            >
                              <Shield size={14} />
                              <span>Commence Work (Step on Track)</span>
                            </button>
                          )}

                          {e.fsm_stage === 6 && (
                            <button
                              onClick={() => handleCompleteWork(e.id)}
                              style={{
                                flex: 1,
                                padding: '8px 12px',
                                borderRadius: 6,
                                border: 'none',
                                background: '#2563EB',
                                color: '#fff',
                                fontSize: 11.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                              }}
                            >
                              <CheckCircle2 size={14} />
                              <span>Work Completed &amp; Safety Cleared</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setSelectedEventId(e.id);
                              setActiveTab('camera');
                            }}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 6,
                              border: '1px solid #CBD5E1',
                              background: '#FFFFFF',
                              color: '#334155',
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                            }}
                          >
                            <Camera size={13} color="#2563EB" />
                            <span>Photo</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── TAB 2: GEOTAGGED CAMERA & EVIDENCE CAPTURE ─────── */}
            {activeTab === 'camera' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Frontline Geotagged Site Photo
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#065F46', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '2px 8px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={11} color="#059669" /> GPS LOCK ACTIVE
                  </span>
                </div>

                {/* Viewfinder & Preview */}
                <div
                  style={{
                    position: 'relative',
                    borderRadius: 10,
                    overflow: 'hidden',
                    border: '1.5px solid #2563EB',
                    height: 240,
                    background: '#0F172A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Track inspection"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ textAlign: 'center', color: '#94A3B8' }}>
                      <Camera size={32} style={{ margin: '0 auto 8px' }} />
                      <div style={{ fontSize: 12 }}>Tap Shutter to Capture Site Viewfinder</div>
                    </div>
                  )}

                  {/* Watermark Overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'linear-gradient(transparent, rgba(15,23,42,0.92))',
                      padding: '10px 12px',
                      fontSize: 10,
                      fontFamily: 'monospace',
                      color: '#F8FAFC',
                      lineHeight: 1.35,
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>📍 {cameraGeo.chainage} • {cameraGeo.section}</div>
                    <div style={{ color: '#CBD5E1' }}>🌐 {cameraGeo.lat}, {cameraGeo.lng} • Alt {cameraGeo.altitude}</div>
                    <div style={{ color: '#93C5FD' }}>⏱ {cameraGeo.timestamp} • SHA-256: {cameraGeo.hash.substring(0, 16)}...</div>
                  </div>
                </div>

                {/* Shutter Button */}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handlePhotoCapture}
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
                  }}
                >
                  <Camera size={18} />
                  <span>Snap Live Viewfinder / Choose Photo</span>
                </button>

                {/* Supervisor Field Note */}
                <div style={{ background: '#FFFFFF', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
                    Site Supervisor Inspection Note:
                  </label>
                  <textarea
                    value={supervisorNote}
                    onChange={e => setSupervisorNote(e.target.value)}
                    rows={3}
                    style={{
                      width: '100%',
                      background: '#F8FAFC',
                      border: '1px solid #CBD5E1',
                      borderRadius: 6,
                      padding: '8px 10px',
                      color: '#0F172A',
                      fontSize: 12,
                      resize: 'none',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            )}

            {/* ── TAB 3: DRAFT NEW BLOCK REQUISITION MEMO ────────── */}
            {activeTab === 'requisition' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Frontline Maintenance Requisition Form
                </div>

                <div style={{ background: '#FFFFFF', padding: 14, borderRadius: 10, border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Section selection */}
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                      Railway Corridor Section:
                    </label>
                    <select
                      value={reqSection}
                      onChange={e => setReqSection(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 6,
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        color: '#0F172A',
                        fontSize: 12,
                      }}
                    >
                      <option value="Danapur-Patna">Danapur (DNR) ⇄ Patna Jn (PNBE)</option>
                      <option value="Ara-Danapur">Ara Junction (ARA) ⇄ Danapur (DNR)</option>
                      <option value="Buxar-Ara">Buxar (BXR) ⇄ Ara Junction (ARA)</option>
                      <option value="DDU-Buxar">Pt. Deen Dayal Upadhyaya ⇄ Buxar</option>
                    </select>
                  </div>

                  {/* Track ID & Geofence KM */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Track Identifier:
                      </label>
                      <select
                        value={reqTrack}
                        onChange={e => setReqTrack(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 6,
                          background: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          color: '#0F172A',
                          fontSize: 12,
                        }}
                      >
                        <option value="UP_MAIN">UP MAIN</option>
                        <option value="DOWN_MAIN">DN MAIN</option>
                        <option value="LOOP_01">LOOP 01</option>
                        <option value="YARD_04">YARD 04</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Duration (Hours):
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={reqDurationHrs}
                        onChange={e => setReqDurationHrs(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 6,
                          background: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          color: '#0F172A',
                          fontSize: 12,
                        }}
                      />
                    </div>
                  </div>

                  {/* Chainage Start and End */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                        KM Start:
                      </label>
                      <input
                        type="text"
                        value={reqKmStart}
                        onChange={e => setReqKmStart(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 6,
                          background: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          color: '#0F172A',
                          fontSize: 12,
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                        KM End:
                      </label>
                      <input
                        type="text"
                        value={reqKmEnd}
                        onChange={e => setReqKmEnd(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 6,
                          background: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          color: '#0F172A',
                          fontSize: 12,
                        }}
                      />
                    </div>
                  </div>

                  {/* Impact Vector Toggles */}
                  <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
                      Statutory Impact Vectors:
                    </span>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#1E293B', cursor: 'pointer' }}>
                      <span>⚡ 25kV Catenary Power Cut (Form ETR-1)</span>
                      <input type="checkbox" checked={reqPowerCut} onChange={e => setReqPowerCut(e.target.checked)} />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#1E293B', cursor: 'pointer' }}>
                      <span>🛑 Absolute Traffic Block (G&amp;SR Chapter IV)</span>
                      <input type="checkbox" checked={reqTrafficBlock} onChange={e => setReqTrafficBlock(e.target.checked)} />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#1E293B', cursor: 'pointer' }}>
                      <span>⚠️ Adjacent Track TSR 30 km/h Caution</span>
                      <input type="checkbox" checked={reqSpeedRestr} onChange={e => setReqSpeedRestr(e.target.checked)} />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#1E293B', cursor: 'pointer' }}>
                      <span>🔒 SM Physical Point Padlocking (#14A/B)</span>
                      <input type="checkbox" checked={reqPointClamp} onChange={e => setReqPointClamp(e.target.checked)} />
                    </label>
                  </div>

                  {/* Description */}
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                      Operational Description &amp; Memo Details:
                    </label>
                    <textarea
                      rows={2}
                      value={reqDesc}
                      onChange={e => setReqDesc(e.target.value)}
                      style={{
                        width: '100%',
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: 6,
                        padding: '8px 10px',
                        color: '#0F172A',
                        fontSize: 12,
                        resize: 'none',
                      }}
                    />
                  </div>

                  <button
                    onClick={handleMobileSubmitRequisition}
                    disabled={submittingReq}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#10B981',
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <Send size={15} />
                    <span>{submittingReq ? 'Validating G&SR Rules...' : 'Submit to Station Master Queue'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* ── TAB 4: INTER-DEPARTMENT LIVE Q&A DESK ──────────── */}
            {activeTab === 'queries' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Two-Way Station Master Clarification Desk
                  </span>
                  <span style={{ fontSize: 10.5, color: '#2563EB', fontWeight: 700 }}>
                    {chatMessages.length} Messages Logged
                  </span>
                </div>

                {/* Chat Stream */}
                <div
                  style={{
                    minHeight: 280,
                    background: '#FFFFFF',
                    borderRadius: 10,
                    border: '1px solid #E2E8F0',
                    padding: 12,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  {chatMessages.map((msg) => {
                    const isMe = msg.role === 'FIELD_SUPERVISOR';
                    return (
                      <div
                        key={msg.id}
                        style={{
                          alignSelf: isMe ? 'flex-end' : 'flex-start',
                          maxWidth: '85%',
                          background: isMe ? '#EFF6FF' : '#F8FAFC',
                          padding: '10px 14px',
                          borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                          border: isMe ? '1px solid #BFDBFE' : '1px solid #E2E8F0',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 3 }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: isMe ? '#1D4ED8' : '#065F46' }}>
                            {msg.sender}
                          </span>
                          <span style={{ fontSize: 9.5, color: '#94A3B8' }}>{msg.timestamp}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#0F172A', lineHeight: 1.4 }}>
                          {msg.text}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Department Tag Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                  <span style={{ fontSize: 10.5, color: '#64748B', fontWeight: 700 }}>Tag:</span>
                  {['@OPERATING', '@OHE', '@S_AND_T', '@CIVIL_P_WAY'].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTaggedDept(tag)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 10.5,
                        fontWeight: 700,
                        border: selectedTaggedDept === tag ? '1px solid #2563EB' : '1px solid #CBD5E1',
                        background: selectedTaggedDept === tag ? '#EFF6FF' : '#FFFFFF',
                        color: selectedTaggedDept === tag ? '#1D4ED8' : '#64748B',
                        cursor: 'pointer',
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>

                {/* Input Bar */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder={`Ask Station Master or tag ${selectedTaggedDept}...`}
                    value={newChatText}
                    onChange={e => setNewChatText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                    style={{
                      flex: 1,
                      background: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      borderRadius: 8,
                      padding: '8px 12px',
                      color: '#0F172A',
                      fontSize: 12,
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleSendChat}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#2563EB',
                      color: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
