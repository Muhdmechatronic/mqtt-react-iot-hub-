import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Cpu, AlertCircle, CheckCircle2, ArrowRight, Loader2, ArrowLeft, Mail, Lock, KeyRound } from 'lucide-react';

const baseInput  = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', outline: 'none' };
const focusInput = { background: 'rgba(14,165,233,0.07)', borderColor: 'rgba(14,165,233,0.45)', boxShadow: '0 0 0 3px rgba(14,165,233,0.12)' };

/* ── OTP digit boxes ─────────────────────────────────────────────────────── */
function OTPInput({ value, onChange }) {
  const digits = value.split('');
  const refs   = Array.from({ length: 6 }, () => useRef(null));

  function handleKey(i, e) {
    if (e.key === 'Backspace') {
      const next = digits.slice();
      next[i]    = '';
      onChange(next.join(''));
      if (i > 0) refs[i - 1].current?.focus();
      return;
    }
    if (!/^\d$/.test(e.key)) return;
    const next = digits.slice();
    next[i]    = e.key;
    onChange(next.join(''));
    if (i < 5) refs[i + 1].current?.focus();
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted.padEnd(6, '').slice(0, 6));
    refs[Math.min(pasted.length, 5)].current?.focus();
    e.preventDefault();
  }

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={refs[i]}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] || ''}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          onChange={() => {}}
          className="rounded-xl text-center text-xl font-bold text-slate-200 transition-all duration-200"
          style={{
            width: 44, height: 52,
            ...baseInput,
            ...(digits[i] ? { borderColor: 'rgba(14,165,233,0.5)', background: 'rgba(14,165,233,0.08)' } : {}),
          }}
          onFocus={e => Object.assign(e.target.style, { ...baseInput, ...focusInput })}
          onBlur={e  => Object.assign(e.target.style, digits[i]
            ? { ...baseInput, borderColor: 'rgba(14,165,233,0.5)', background: 'rgba(14,165,233,0.08)' }
            : baseInput
          )}
        />
      ))}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  // step: 'email' → 'otp' → 'password' → 'done'
  const [step,       setStep]       = useState('email');
  const [email,      setEmail]      = useState('');
  const [otp,        setOtp]        = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password,   setPassword]   = useState('');
  const [confirm,    setConfirm]    = useState('');
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);

  async function handleSendOTP(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send code. Check the email address.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP(e) {
    e.preventDefault();
    if (otp.length < 6) { setError('Enter all 6 digits.'); return; }
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { email, otp });
      setResetToken(data.resetToken);
      setStep('password');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email, resetToken, newPassword: password });
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  }

  const stepLabels = ['Email', 'Verify Code', 'New Password'];
  const stepIndex  = { email: 0, otp: 1, password: 2, done: 2 }[step];

  return (
    <div className="min-h-screen bg-[#020817] flex items-center justify-center p-4 relative overflow-hidden">

      {/* Background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-1/4 -left-1/4 w-[700px] h-[700px] rounded-full bg-sky-600/6 blur-[140px]" />
        <div className="absolute -bottom-1/4 -right-1/4 w-[600px] h-[600px] rounded-full bg-violet-600/6 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.022]"
          style={{ backgroundImage: `linear-gradient(rgba(56,189,248,.9) 1px,transparent 1px),linear-gradient(90deg,rgba(56,189,248,.9) 1px,transparent 1px)`, backgroundSize: '52px 52px' }} />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-5">
            <div className="absolute inset-0 rounded-2xl bg-sky-500/25 blur-2xl" />
            <div className="relative w-[52px] h-[52px] rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,rgba(14,165,233,.3),rgba(56,189,248,.15))', border: '1px solid rgba(14,165,233,.35)', boxShadow: '0 8px 32px rgba(14,165,233,.2)' }}>
              <Cpu size={24} className="text-sky-400" />
            </div>
          </div>
          <h1 className="text-[22px] font-bold text-white tracking-tight">Reset Password</h1>
          <p className="text-sm text-slate-400 mt-1">We'll send a code to your email</p>
        </div>

        {/* Step indicator */}
        {step !== 'done' && (
          <div className="flex items-center justify-center gap-2 mb-6">
            {stepLabels.map((label, i) => (
              <React.Fragment key={label}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all
                    ${i <= stepIndex ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                    {i < stepIndex ? '✓' : i + 1}
                  </div>
                  <span className={`text-[11px] font-medium ${i <= stepIndex ? 'text-sky-400' : 'text-slate-600'}`}>
                    {label}
                  </span>
                </div>
                {i < stepLabels.length - 1 && <div className="flex-1 max-w-[30px] h-px bg-slate-800" />}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Card */}
        <div className="rounded-2xl overflow-hidden relative"
          style={{ background: 'rgba(255,255,255,0.035)', backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 28px 72px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.07)' }}>
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent" />

          <div className="p-7 space-y-5">

            {error && (
              <div className="flex items-start gap-2.5 rounded-xl px-4 py-3"
                style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.22)' }}>
                <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
                <span className="text-[13px] text-red-400 leading-relaxed">{error}</span>
              </div>
            )}

            {/* ── Step 1: Email ── */}
            {step === 'email' && (
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-2 tracking-wide uppercase">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                      type="email" autoComplete="email" required
                      value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-xl pl-9 pr-4 py-[11px] text-[14px] text-slate-200 placeholder-slate-600 transition-all duration-200"
                      style={baseInput}
                      onFocus={e => Object.assign(e.target.style, { ...baseInput, ...focusInput })}
                      onBlur={e  => Object.assign(e.target.style, baseInput)}
                    />
                  </div>
                  <p className="text-[12px] text-slate-600 mt-2">
                    Enter the email linked to your account. We'll send a 6-digit code.
                  </p>
                </div>
                <button
                  type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-[11px] rounded-xl text-[14px] font-bold text-white transition-all duration-200 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#0ea5e9,#38bdf8)', boxShadow: '0 4px 18px rgba(14,165,233,.35)' }}
                >
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <Mail size={14} />}
                  {loading ? 'Sending…' : 'Send Code'}
                </button>
              </form>
            )}

            {/* ── Step 2: OTP ── */}
            {step === 'otp' && (
              <form onSubmit={handleVerifyOTP} className="space-y-5">
                <div>
                  <p className="text-[13px] text-slate-400 text-center mb-4">
                    Enter the 6-digit code sent to<br />
                    <span className="text-sky-400 font-semibold">{email}</span>
                  </p>
                  <OTPInput value={otp} onChange={setOtp} />
                  <p className="text-[12px] text-slate-600 text-center mt-3">
                    Code expires in 10 minutes.
                  </p>
                </div>
                <button
                  type="submit" disabled={loading || otp.length < 6}
                  className="w-full flex items-center justify-center gap-2 py-[11px] rounded-xl text-[14px] font-bold text-white transition-all duration-200 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#0ea5e9,#38bdf8)', boxShadow: '0 4px 18px rgba(14,165,233,.35)' }}
                >
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={14} />}
                  {loading ? 'Verifying…' : 'Verify Code'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('email'); setOtp(''); setError(''); }}
                  className="w-full text-center text-[12px] text-slate-600 hover:text-slate-400 transition-colors"
                >
                  ← Change email address
                </button>
              </form>
            )}

            {/* ── Step 3: New password ── */}
            {step === 'password' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-2 tracking-wide uppercase">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                      type="password" autoComplete="new-password" required minLength={8}
                      value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full rounded-xl pl-9 pr-4 py-[11px] text-[14px] text-slate-200 placeholder-slate-600 transition-all duration-200"
                      style={baseInput}
                      onFocus={e => Object.assign(e.target.style, { ...baseInput, ...focusInput })}
                      onBlur={e  => Object.assign(e.target.style, baseInput)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-2 tracking-wide uppercase">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                      type="password" autoComplete="new-password" required
                      value={confirm} onChange={e => setConfirm(e.target.value)}
                      placeholder="Repeat your password"
                      className="w-full rounded-xl pl-9 pr-4 py-[11px] text-[14px] text-slate-200 placeholder-slate-600 transition-all duration-200"
                      style={baseInput}
                      onFocus={e => Object.assign(e.target.style, { ...baseInput, ...focusInput })}
                      onBlur={e  => Object.assign(e.target.style, baseInput)}
                    />
                  </div>
                </div>
                <button
                  type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-[11px] rounded-xl text-[14px] font-bold text-white transition-all duration-200 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#0ea5e9,#38bdf8)', boxShadow: '0 4px 18px rgba(14,165,233,.35)' }}
                >
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={14} />}
                  {loading ? 'Saving…' : 'Set New Password'}
                </button>
              </form>
            )}

            {/* ── Done ── */}
            {step === 'done' && (
              <div className="text-center space-y-5">
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 size={32} className="text-emerald-400" />
                  </div>
                </div>
                <div>
                  <p className="text-white font-bold text-lg">Password updated!</p>
                  <p className="text-slate-400 text-[13px] mt-1">You can now sign in with your new password.</p>
                </div>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full flex items-center justify-center gap-2 py-[11px] rounded-xl text-[14px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#0ea5e9,#38bdf8)', boxShadow: '0 4px 18px rgba(14,165,233,.35)' }}
                >
                  <ArrowRight size={14} />
                  Back to Sign In
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-[13px] text-slate-600 mt-5">
          <Link to="/login" className="text-sky-400 hover:text-sky-300 font-semibold transition-colors flex items-center justify-center gap-1.5">
            <ArrowLeft size={12} />Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
