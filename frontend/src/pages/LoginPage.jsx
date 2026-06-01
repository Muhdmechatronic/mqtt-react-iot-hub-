import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { auth, googleProvider, signInWithPopup, isFirebaseConfigured } from '../services/firebase';
import { Cpu, AlertCircle, ArrowRight, Loader2, Wifi, Zap, Shield } from 'lucide-react';

/* ── Google "G" SVG icon ─────────────────────────────────────────────────── */
function GoogleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

/* ── Particle dots (decorative) ──────────────────────────────────────────── */
const DOTS = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  x: `${(i * 23 + 7) % 97}%`,
  y: `${(i * 37 + 11) % 95}%`,
  size: 1.5 + (i % 3),
  opacity: 0.06 + (i % 4) * 0.04,
  duration: `${4 + (i % 5)}s`,
  delay: `${(i * 0.4) % 3}s`,
}));

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  const googleEnabled = isFirebaseConfigured();

  /* ── Firebase Google Sign-In ── */
  async function handleGoogleSignIn() {
    setError('');
    setGLoading(true);
    try {
      const result   = await signInWithPopup(auth, googleProvider);
      const idToken  = await result.user.getIdToken();
      const { data } = await api.post('/auth/google', { idToken });
      login(data.token, data.user);
      navigate('/devices');
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        /* user dismissed — not an error */
      } else {
        setError(
          err.response?.data?.error ||
          err.message ||
          'Google sign-in failed. Please try again.'
        );
      }
    } finally {
      setGLoading(false);
    }
  }

  /* ── Email / password login ── */
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      login(data.token, data.user);
      navigate('/devices');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  /* ── Shared input style helpers ── */
  const baseInput = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    outline: 'none',
  };
  const focusInput = {
    background: 'rgba(14,165,233,0.07)',
    borderColor: 'rgba(14,165,233,0.45)',
    boxShadow: '0 0 0 3px rgba(14,165,233,0.12)',
  };

  return (
    <div className="min-h-screen bg-[#020817] flex items-center justify-center p-4 relative overflow-hidden">

      {/* ─ Background ─ */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-1/4 -left-1/4 w-[700px] h-[700px] rounded-full bg-sky-600/6 blur-[140px]" />
        <div className="absolute -bottom-1/4 -right-1/4 w-[600px] h-[600px] rounded-full bg-violet-600/6 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.022]"
          style={{
            backgroundImage: `linear-gradient(rgba(56,189,248,.9) 1px,transparent 1px),linear-gradient(90deg,rgba(56,189,248,.9) 1px,transparent 1px)`,
            backgroundSize: '52px 52px',
          }}
        />
        <style>{`
          @keyframes rise { 0%{transform:translateY(0)} 100%{transform:translateY(-22px)} }
        `}</style>
        {DOTS.map(d => (
          <div key={d.id} className="absolute rounded-full bg-sky-400"
            style={{ left: d.x, top: d.y, width: d.size, height: d.size, opacity: d.opacity,
              animation: `rise ${d.duration} ${d.delay} ease-in-out infinite alternate` }} />
        ))}
      </div>

      {/* ─ Card ─ */}
      <div className="relative z-10 w-full max-w-[400px]">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-5">
            <div className="absolute inset-0 rounded-2xl bg-sky-500/25 blur-2xl" />
            <div className="relative w-[52px] h-[52px] rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,rgba(14,165,233,.3),rgba(56,189,248,.15))', border: '1px solid rgba(14,165,233,.35)', boxShadow: '0 8px 32px rgba(14,165,233,.2)' }}>
              <Cpu size={24} className="text-sky-400" />
            </div>
          </div>
          <h1 className="text-[22px] font-bold text-white tracking-tight">Welcome back</h1>
          <p className="text-sm text-slate-400 mt-1">Sign in to your IoT control panel</p>
        </div>

        {/* Glass panel */}
        <div className="rounded-2xl overflow-hidden relative"
          style={{ background: 'rgba(255,255,255,0.035)', backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 28px 72px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.07)' }}>

          {/* Top shine line */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent" />

          <div className="p-7 space-y-5">

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl px-4 py-3"
                style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.22)' }}>
                <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
                <span className="text-[13px] text-red-400 leading-relaxed">{error}</span>
              </div>
            )}

            {/* Google button */}
            {googleEnabled ? (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={gLoading || loading}
                className="w-full flex items-center justify-center gap-3 py-[11px] px-4 rounded-xl text-[14px] font-semibold text-slate-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 2px 10px rgba(0,0,0,.35)' }}
                onMouseEnter={e => { if (!gLoading) { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.2)'; } }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.12)'; }}
              >
                {gLoading
                  ? <Loader2 size={17} className="animate-spin text-slate-300" />
                  : <GoogleIcon size={18} />
                }
                {gLoading ? 'Connecting to Google…' : 'Continue with Google'}
              </button>
            ) : (
              <div className="rounded-xl px-4 py-3 text-center text-xs text-slate-600"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                Google Sign-In not configured —{' '}
                <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-sky-500 hover:text-sky-400 underline">
                  set up Firebase
                </a>
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/8" />
              <span className="text-[11px] font-medium text-slate-600 tracking-wide">or continue with email</span>
              <div className="flex-1 h-px bg-white/8" />
            </div>

            {/* Email form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-2 tracking-wide uppercase">Email</label>
                <input
                  type="email" autoComplete="email" required
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl px-4 py-[11px] text-[14px] text-slate-200 placeholder-slate-600 transition-all duration-200"
                  style={baseInput}
                  onFocus={e => Object.assign(e.target.style, { ...baseInput, ...focusInput })}
                  onBlur={e => Object.assign(e.target.style, baseInput)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-2 tracking-wide uppercase">Password</label>
                <input
                  type="password" autoComplete="current-password" required
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl px-4 py-[11px] text-[14px] text-slate-200 placeholder-slate-600 transition-all duration-200"
                  style={baseInput}
                  onFocus={e => Object.assign(e.target.style, { ...baseInput, ...focusInput })}
                  onBlur={e => Object.assign(e.target.style, baseInput)}
                />
              </div>

              <button
                type="submit"
                disabled={loading || gLoading}
                className="w-full flex items-center justify-center gap-2 py-[11px] rounded-xl text-[14px] font-bold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                style={{ background: 'linear-gradient(135deg,#0ea5e9,#38bdf8)', boxShadow: '0 4px 18px rgba(14,165,233,.35)' }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 6px 26px rgba(14,165,233,.5)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 18px rgba(14,165,233,.35)'; }}
              >
                {loading ? <><Loader2 size={15} className="animate-spin" />Signing in…</> : <><span>Sign in</span><ArrowRight size={15} /></>}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[13px] text-slate-600 mt-5">
          No account?{' '}
          <Link to="/register" className="text-sky-400 hover:text-sky-300 font-semibold transition-colors">Create one free</Link>
        </p>

        <div className="flex items-center justify-center gap-5 mt-7">
          {[{ icon: Wifi, label: 'Real-time sync' }, { icon: Zap, label: 'Voice control' }, { icon: Shield, label: 'Secure OAuth' }].map(({ icon: I, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-[11px] text-slate-700">
              <I size={11} className="text-slate-600" />{label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
