import React, { useState } from 'react';
import { Train, Lock, User, AlertCircle, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: { username: string; name: string; role: string; station: string }) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    setTimeout(() => {
      // Validate credentials: raviamish / 123456
      if (username.trim().toLowerCase() === 'raviamish' && password === '123456') {
        onLoginSuccess({
          username: 'raviamish',
          name: 'Ravi Amish',
          role: 'Station Master / Junction In-Charge',
          station: 'Wardha Jn (WDA) & Sevagram (SEGM) Control',
        });
      } else {
        setError('Invalid Operator ID or Security PIN. Please verify your credentials or contact Division Operating Control.');
        setLoading(false);
      }
    }, 400);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        background: '#F8FAFC',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      {/* ── Login Card ──────────────────────────────── */}
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: '#FFFFFF',
          borderRadius: 12,
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: '#0F172A',
            padding: '28px 24px 22px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
              boxShadow: '0 2px 10px rgba(37,99,235,0.4)',
            }}
          >
            <Train size={24} color="#FFFFFF" />
          </div>

          <div style={{ fontSize: 20, fontWeight: 800, color: '#F8FAFC', letterSpacing: '-0.01em' }}>
            <span style={{ color: '#60A5FA' }}>Rail</span>Sync
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4, letterSpacing: '0.04em' }}>
            INDIAN RAILWAYS • CENTRAL RAILWAY (NAGPUR DIVISION)
          </div>
        </div>

        {/* Form Body */}
        <div style={{ padding: '28px 28px 24px' }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: '0 0 4px' }}>
              Station Master Decision Terminal
            </h2>
            <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>
              Authorized Station Master &amp; Decision Maker Access
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: '10px 12px',
                borderRadius: 8,
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#DC2626',
                fontSize: 11.5,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Username Input */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#334155',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: 6,
                }}
              >
                Operator Username
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <User size={15} color="#94A3B8" style={{ position: 'absolute', left: 12 }} />
                <input
                  type="text"
                  required
                  placeholder="Enter Operator ID"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  style={{
                    width: '100%',
                    height: 40,
                    paddingLeft: 36,
                    paddingRight: 12,
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    fontSize: 13,
                    color: '#0F172A',
                    outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = '#2563EB';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.15)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = '#CBD5E1';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#334155',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: 6,
                }}
              >
                Security PIN / Password
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={15} color="#94A3B8" style={{ position: 'absolute', left: 12 }} />
                <input
                  type="password"
                  required
                  placeholder="••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    height: 40,
                    paddingLeft: 36,
                    paddingRight: 12,
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    fontSize: 13,
                    color: '#0F172A',
                    outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = '#2563EB';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.15)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = '#CBD5E1';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 6,
                height: 42,
                borderRadius: 8,
                border: 'none',
                background: '#2563EB',
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1D4ED8')}
              onMouseLeave={e => (e.currentTarget.style.background = '#2563EB')}
            >
              {loading ? 'Authenticating Terminal...' : 'Sign In as Station Master ↵'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div
          style={{
            background: '#F8FAFC',
            padding: '12px 24px',
            borderTop: '1px solid #E2E8F0',
            textAlign: 'center',
            fontSize: 10.5,
            color: '#94A3B8',
          }}
        >
          Station Working Rules (SWR Sec 8.4) • General Rules 15.09
        </div>
      </div>
    </div>
  );
};
