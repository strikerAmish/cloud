import React from 'react';
import {
  Train, LayoutDashboard, CheckSquare, ClockIcon, HelpCircle, ArrowRight, Flame
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  setActiveView: (v: 'workspace' | 'audit' | 'overview' | 'chaos') => void;
  isOfflineMode: boolean;
  setIsOfflineMode: (v: boolean) => void;
  wsConnected: boolean;
  canaryHealthy: boolean;
}

const NAV_ITEMS = [
  { id: 'workspace',  label: 'Approval Portal',    icon: CheckSquare     },
  { id: 'audit',      label: 'Audit & History',    icon: ClockIcon       },
  { id: 'overview',   label: 'Corridor Overview',  icon: LayoutDashboard },
  { id: 'chaos',      label: 'SRE & Chaos Suite',  icon: Flame           },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
}) => {
  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        background: '#0F172A',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      {/* ── Brand ──────────────────────────────────── */}
      <div>
        <div
          style={{
            padding: '20px 20px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(37,99,235,0.4)',
            }}
          >
            <Train size={17} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#F8FAFC', letterSpacing: '0.02em', lineHeight: 1.1 }}>
              <span style={{ color: '#60A5FA' }}>Rail</span>Sync
            </div>
            <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 2, letterSpacing: '0.04em', fontWeight: 600 }}>
              ECR Danapur Division
            </div>
          </div>
        </div>

        {/* ── Navigation Items ───────────────────────── */}
        <nav style={{ padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#475569',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '6px 10px 4px',
            }}
          >
            Navigation
          </div>
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = activeView === id;

            return (
              <button
                key={id}
                onClick={() => setActiveView(id as 'workspace' | 'audit' | 'overview' | 'chaos')}
                className={`nav-item${isActive ? ' active' : ''}`}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 7,
                  border: 'none',
                  background: isActive ? 'rgba(37, 99, 235, 0.22)' : 'transparent',
                  color: isActive ? '#93C5FD' : '#94A3B8',
                  fontSize: 12.5,
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.color = '#F1F5F9';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#94A3B8';
                  }
                }}
              >
                <Icon size={15} color={isActive ? '#60A5FA' : '#94A3B8'} />
                <span>{label}</span>
                {isActive && (
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '20%',
                      height: '60%',
                      width: 3,
                      borderRadius: '0 3px 3px 0',
                      background: '#60A5FA',
                    }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Bottom: Support Desk ───────────────────── */}
      <div
        style={{
          padding: '16px 18px 20px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <HelpCircle size={14} color="#94A3B8" />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#CBD5E1', lineHeight: 1.2 }}>
              Support Desk
            </div>
            <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 1 }}>
              Division Control Center
            </div>
            <div
              style={{
                marginTop: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                color: '#60A5FA',
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              Danapur Ext. 4022
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
