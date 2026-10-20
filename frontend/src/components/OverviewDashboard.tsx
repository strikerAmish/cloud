import React from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  MapPin,
  Train,
  Zap,
  Lock
} from 'lucide-react';
import { CORRIDOR_SECTIONS } from '../data/corridorData';

interface OverviewDashboardProps {
  onSelectSectionAndNavigate: (secId: string) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  onSelectSectionAndNavigate,
}) => {
  const sectionsSummary = [
    {
      id: 'DNR_PNBE',
      name: 'Danapur – Patna Junction',
      track: 'UP MAIN (KM 548.00 – 554.00)',
      activeBlocks: 1,
      pendingApprovals: 2,
      powerStatus: 'Normal (Patna TSS FP-02)',
      statusLabel: 'Active Work & Approvals Pending',
      statusColor: '#F59E0B',
    },
    {
      id: 'ARA_DNR',
      name: 'Ara Junction – Danapur',
      track: 'UP MAIN (KM 585.00 – 602.00)',
      activeBlocks: 1,
      pendingApprovals: 2,
      powerStatus: 'Isolated (Danapur Grid FP-03)',
      statusLabel: 'Form3-PTW Possession Active',
      statusColor: '#2563EB',
    },
    {
      id: 'BXR_ARA',
      name: 'Buxar – Ara Junction',
      track: 'UP MAIN (KM 630.00 – 650.00)',
      activeBlocks: 1,
      pendingApprovals: 2,
      powerStatus: 'Normal (Buxar Sub FP-04)',
      statusLabel: 'Axle Counter & Rail Overhaul',
      statusColor: '#3B82F6',
    },
    {
      id: 'DDU_BXR',
      name: 'Pt. Deen Dayal Upadhyaya – Buxar',
      track: 'DN MAIN (KM 670.00 – 690.00)',
      activeBlocks: 1,
      pendingApprovals: 2,
      powerStatus: 'Normal (DDU Marshalling FP-01)',
      statusLabel: 'Bridge Fastening & Track Welds',
      statusColor: '#10B981',
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Top Overview Banner ───────────────────────── */}
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
                background: '#EFF6FF',
                color: '#1D4ED8',
                padding: '3px 8px',
                borderRadius: 4,
                border: '1px solid #BFDBFE',
              }}
            >
              EAST CENTRAL RAILWAY • DANAPUR &amp; DDU DIVISION (PATNA JN)
            </span>
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
              HDN CORRIDOR ACTIVE
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
            Corridor Operations &amp; Statutory Traffic Overview
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
            Real-time status across 4 division corridor sections, active track possessions, and statutory approvals.
          </p>
        </div>

        <button
          onClick={() => onSelectSectionAndNavigate('ALL')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '9px 18px',
            borderRadius: 8,
            border: 'none',
            background: '#2563EB',
            color: '#FFFFFF',
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
          }}
        >
          Open Approval Portal <ArrowRight size={14} />
        </button>
      </div>

      {/* ── Key Metrics Cards ─────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {/* Metric 1 */}
        <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E2E8F0', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Active Track Blocks</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1D4ED8' }}>
              <Activity size={16} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>4 Blocks</div>
          <div style={{ fontSize: 11, color: '#2563EB', marginTop: 6, fontWeight: 600 }}>Currently executing on track</div>
        </div>

        {/* Metric 2 */}
        <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E2E8F0', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Pending Approvals</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B45309' }}>
              <Clock size={16} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>8 Requisitions</div>
          <div style={{ fontSize: 11, color: '#D97706', marginTop: 6, fontWeight: 600 }}>Awaiting dual-key authorization</div>
        </div>

        {/* Metric 3 */}
        <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E2E8F0', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Punctuality / Availability</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A' }}>
              <TrendingUp size={16} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>96.8%</div>
          <div style={{ fontSize: 11, color: '#15803D', marginTop: 6, fontWeight: 600 }}>Division target achieved</div>
        </div>

        {/* Metric 4 */}
        <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E2E8F0', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Speed Restrictions (TSR)</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
              <ShieldAlert size={16} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>3 Zones</div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 6, fontWeight: 600 }}>Caution orders active</div>
        </div>
      </div>

      {/* ── Inter-Departmental Joint Co-Utilization Savings Banner ── */}
      <div
        style={{
          background: '#F0FDF4',
          borderRadius: 10,
          border: '1.5px solid #86EFAC',
          padding: '16px 22px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: '#DCFCE7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#15803D',
              fontSize: 18,
            }}
          >
            🤝
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#14532D' }}>
              Inter-Departmental Joint Block Co-Utilization: 3h 15m Possession Time Saved Today
            </div>
            <div style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>
              Active co-utilization between OHE Traction and P-Way on UP MAIN eliminates duplicate block requests and preserves section capacity.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#166534', background: '#DCFCE7', padding: '4px 10px', borderRadius: 6, border: '1px solid #BBF7D0' }}>
            2 JOINT BLOCKS ACTIVE
          </span>
          <button
            onClick={() => onSelectSectionAndNavigate('ALL')}
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              background: '#15803D',
              color: '#FFFFFF',
              border: 'none',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            View Joint Requisitions
          </button>
        </div>
      </div>

      {/* ── 4 Corridor Sections Grid ──────────────────── */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginBottom: 14 }}>
          Division Corridor Sections (Click to Inspect &amp; Approve)
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {sectionsSummary.map(sec => (
            <div
              key={sec.id}
              style={{
                background: '#FFFFFF',
                borderRadius: 10,
                border: '1px solid #E2E8F0',
                padding: '20px 22px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 16,
                transition: 'box-shadow 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#93C5FD';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,0.06)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#E2E8F0';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MapPin size={15} color="#2563EB" />
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>
                      {sec.name}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: '#EFF6FF',
                      color: '#1D4ED8',
                      border: '1px solid #BFDBFE',
                    }}
                  >
                    {sec.activeBlocks} ACTIVE
                  </span>
                </div>

                <div style={{ fontSize: 11.5, color: '#64748B', marginBottom: 12 }}>
                  {sec.track}
                </div>

                <div
                  style={{
                    background: '#F8FAFC',
                    borderRadius: 8,
                    padding: '10px 12px',
                    border: '1px solid #E2E8F0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Status:</span>
                    <strong style={{ color: sec.statusColor }}>{sec.statusLabel}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Pending Requisitions:</span>
                    <strong style={{ color: '#0F172A' }}>{sec.pendingApprovals} Awaiting</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Traction Power:</span>
                    <span style={{ color: '#334155', fontSize: 11 }}>{sec.powerStatus}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onSelectSectionAndNavigate(sec.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  width: '100%',
                  padding: '9px 14px',
                  borderRadius: 7,
                  border: '1px solid #BFDBFE',
                  background: '#EFF6FF',
                  color: '#1D4ED8',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#2563EB';
                  e.currentTarget.style.color = '#FFFFFF';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#EFF6FF';
                  e.currentTarget.style.color = '#1D4ED8';
                }}
              >
                Inspect Section &amp; Approvals <ArrowRight size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
