import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { auth, googleProvider, signInWithPopup, isFirebaseConfigured } from '../services/firebase';
import { Cpu, AlertCircle, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';

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

export default function RegisterPage() {
  const [form,    setForm]    = useState({ name: '', email: '', password: '' });
  const [error,   setError]   = useState('');
  const [ok,      setOk]      = useState(false);
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const { login }  = useAuth();
  const navigate   = useNavigate();

  const googleEnabled = isFirebaseConfigured();

  function onChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); }

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
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
      setError(err.response?.data?.error || err.message || 'Google sign-in failed.');
    } finally {
      setGLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/register', form);
      setOk(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  const baseInput = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', outline: 'none' };
  const focusInput = { background: 'rgba(139,92,246,0.07)', borderColor: 'rgba(139,92,246,0.45)', boxShadow: '0 0 0 3px rgba(139,92,246,0.12)' };

  return (
    <div className="min-h-screen bg-[#020817] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-1/4 -right-1/4 w-[700px] h-[700px] rounded-full bg-violet-600/6 blur-[140px]" />
        <div className="absolute -bottom-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-sky-600/5 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.022]"
          style={{ backgroundImage: `linear-gradient(rgba(139,92,246,.9) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,.9) 1px,transparent 1px)`, backgroundSize: '52px 52px' }} />
      </div>

      <div className="relative z-10 w-full max-w-[400px]">

        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-5">
            <div className="absolute inset-0 rounded-2xl bg-violet-500/25 blur-2xl" />
            <div className="relative w-[52px] h-[52px] rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,rgba(139,92,246,.3),rgba(167,139,250,.15))', border: '1px solid rgba(139,92,246,.35)', boxShadow: '0 8px 32px rgba(139,92,246,.2)' }}>
              <Cpu size={24} className="text-violet-400" />
            </div>
          </div>
          <h1 className="text-[22px] font-bold text-white tracking-tight">Create account</h1>
          <p className="text-sm text-slate-400 mt-1">Join the IoT Platform — it's free</p>
        </div>

        <div className="rounded-2xl overflow-hidden relative"
          style={{ background: 'rgba(255,255,255,0.035)', backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 28px 72px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.07)' }}>

          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-400/40 to-transparent" />

          <div className="p-7 space-y-5">

            {error && (
              <div className="flex items-start gap-2.5 rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.22)' }}>
                <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
                <span className="text-[13px] text-red-400 leading-relaxed">{error}</span>
              </div>
            )}
            {ok && (
              <div className="flex items-center gap-2.5 rounded-xl px-4 py-3" style={{ background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.22)' }}>
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                <span className="text-[13px] text-emerald-400">Account created! Redirecting…</span>
              </div>
            )}

            {googleEnabled && (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={gLoading || loading}
                className="w-full flex items-center justify-center gap-3 py-[11px] px-4 rounded-xl text-[14px] font-semibold text-slate-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 2px 10px rgba(0,0,0,.35)' }}
                onMouseEnter={e => { if (!gLoading) { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.2)'; } }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.12)'; }}
              >
                {gLoading ? <Loader2 size={17} className="animate-spin" /> : <GoogleIcon size={18} />}
                {gLoading ? 'Connecting to Google…' : 'Sign up with Google'}
              </button>
            )}

            {googleEnabled && (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/8" />
                <span className="text-[11px] font-medium text-slate-600 tracking-wide">or register with email</span>
                <div className="flex-1 h-px bg-white/8" />
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {[
                { name: 'name',     type: 'text',     label: 'Full name',     placeholder: 'Your name',       auto: 'name' },
                { name: 'email',    type: 'email',    label: 'Email address', placeholder: 'you@example.com', auto: 'email' },
                { name: 'password', type: 'password', label: 'Password',      placeholder: '8+ characters',   auto: 'new-password', min: 8 },
              ].map(f => (
                <div key={f.name}>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-2 tracking-wide uppercase">{f.label}</label>
                  <input
                    name={f.name} type={f.type} autoComplete={f.auto} required
                    minLength={f.min} value={form[f.name]} onChange={onChange}
                    placeholder={f.placeholder}
                    className="w-full rounded-xl px-4 py-[11px] text-[14px] text-slate-200 placeholder-slate-600 transition-all duration-200"
                    style={baseInput}
                    onFocus={e => Object.assign(e.target.style, { ...baseInput, ...focusInput })}
                    onBlur={e => Object.assign(e.target.style, baseInput)}
                  />
                </div>
              ))}

              <button
                type="submit"
                disabled={loading || ok || gLoading}
                className="w-full flex items-center justify-center gap-2 py-[11px] rounded-xl text-[14px] font-bold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                style={{ background: 'linear-gradient(135deg,#8b5cf6,#a78bfa)', boxShadow: '0 4px 18px rgba(139,92,246,.35)' }}
                onMouseEnter={e => { if (!loading && !ok) e.currentTarget.style.boxShadow = '0 6px 26px rgba(139,92,246,.5)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 18px rgba(139,92,246,.35)'; }}
              >
                {loading ? <><Loader2 size={15} className="animate-spin" />Creating…</> : <><span>Create account</span><ArrowRight size={15} /></>}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-[13px] text-slate-600 mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-violet-400 hover:text-violet-300 font-semibold transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
