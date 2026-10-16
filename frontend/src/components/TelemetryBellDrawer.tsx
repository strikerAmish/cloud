import React from 'react';
import { Bell, X, Clock, Radio, Activity, AlertTriangle } from 'lucide-react';

interface TelemetryBellDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: string[];
}

export const TelemetryBellDrawer: React.FC<TelemetryBellDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
}) => {
  if (!isOpen) return null;

  const opNotifs = notifications.filter(n => !n.includes('INITIAL_SNAPSHOT'));

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(15, 23, 42, 0.35)',
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        className="slide-in-right"
        style={{
          width: 380,
          height: '100%',
          background: '#FFFFFF',
          borderLeft: '1px solid #E2E8F0',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            height: 56,
            padding: '0 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            background: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bell size={15} color="#2563EB" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                Live Feed
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#10B981',
                    display: 'inline-block',
                  }}
                />
              </div>
              <div style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace' }}>
                Redis Pub/Sub · /ws/corridor
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748B',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#F8FAFC')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#FFFFFF')}
          >
            <X size={14} />
          </button>
        </div>

        {/* Filter banner */}
        <div
          style={{
            padding: '8px 20px',
            background: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 10.5,
            color: '#94A3B8',
            fontFamily: 'monospace',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Radio size={11} color="#2563EB" /> Operational events only
          </span>
          <span style={{ color: '#2563EB', fontWeight: 700 }}>{opNotifs.length} events</span>
        </div>

        {/* Notifications */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {opNotifs.length === 0 ? (
            <div
              style={{
                height: 200,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                gap: 8,
              }}
            >
              <Activity size={28} color="#CBD5E1" />
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#94A3B8' }}>No operational alerts yet</div>
              <div style={{ fontSize: 11, color: '#CBD5E1', maxWidth: 220 }}>
                Breaker trips, token locks, and invariant dispatches will stream here live.
              </div>
            </div>
          ) : (
            opNotifs.map((item, idx) => {
              const isTrip = item.includes('breaker') || item.includes('trip') || item.includes('FAIL');
              const isLock = item.includes('clamp') || item.includes('locked') || item.includes('token');

              return (
                <div
                  key={idx}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid #E2E8F0',
                    background: '#FFFFFF',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#F8FAFC')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#FFFFFF')}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 5,
                      fontSize: 10,
                      fontFamily: 'monospace',
                      color: '#94A3B8',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={10} color="#2563EB" /> Live
                    </span>
                    {isTrip && (
                      <span
                        style={{
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontSize: 9,
                          background: '#FEF2F2',
                          border: '1px solid #FECACA',
                          color: '#DC2626',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        <AlertTriangle size={9} /> OHE TRIP
                      </span>
                    )}
                    {isLock && !isTrip && (
                      <span
                        style={{
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontSize: 9,
                          background: '#EFF6FF',
                          border: '1px solid #BFDBFE',
                          color: '#2563EB',
                          fontWeight: 700,
                        }}
                      >
                        INTERLOCK
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      fontSize: 11,
                      fontFamily: 'JetBrains Mono, monospace',
                      color: '#374151',
                      lineHeight: 1.6,
                      wordBreak: 'break-word',
                      margin: 0,
                    }}
                  >
                    {item}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '10px 20px',
            borderTop: '1px solid #E2E8F0',
            background: '#F8FAFC',
            textAlign: 'center',
            fontSize: 10,
            fontFamily: 'monospace',
            color: '#94A3B8',
          }}
        >
          Redis 7.0 Cluster · Stream: corridor:events:v1
        </div>
      </div>
    </div>
  );
};
