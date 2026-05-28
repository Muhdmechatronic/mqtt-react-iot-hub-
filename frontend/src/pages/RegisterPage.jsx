import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

const s = {
  wrap:  { display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' },
  card:  { background:'#1e293b', padding:32, borderRadius:12, width:360 },
  title: { fontSize:22, fontWeight:700, marginBottom:24, color:'#38bdf8' },
  label: { display:'block', fontSize:13, color:'#94a3b8', marginBottom:4 },
  input: { width:'100%', padding:'10px 12px', background:'#0f172a', border:'1px solid #334155', borderRadius:6, color:'#e2e8f0', fontSize:14, marginBottom:16 },
  btn:   { width:'100%', padding:'10px', background:'#0ea5e9', border:'none', borderRadius:6, color:'#fff', fontSize:15, cursor:'pointer', fontWeight:600 },
  err:   { color:'#f87171', fontSize:13, marginBottom:12 },
  link:  { color:'#38bdf8', fontSize:13 },
};

export default function RegisterPage() {
  const [form, setForm]   = useState({ name:'', email:'', password:'' });
  const [error, setError] = useState('');
  const [ok, setOk]       = useState(false);
  const navigate          = useNavigate();

  function onChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault(); setError('');
    try {
      await api.post('/auth/register', form);
      setOk(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.title}>Create Account</div>
        {error && <div style={s.err}>{error}</div>}
        {ok    && <div style={{ color:'#4ade80', marginBottom:12 }}>Registered! Redirecting…</div>}
        <form onSubmit={handleSubmit}>
          <label style={s.label}>Name</label>
          <input style={s.input} name="name" value={form.name} onChange={onChange} required />
          <label style={s.label}>Email</label>
          <input style={s.input} name="email" type="email" value={form.email} onChange={onChange} required />
          <label style={s.label}>Password</label>
          <input style={s.input} name="password" type="password" value={form.password} onChange={onChange} required />
          <button style={s.btn} type="submit">Register</button>
        </form>
        <p style={{ marginTop:16 }}><Link to="/login" style={s.link}>Back to login</Link></p>
      </div>
    </div>
  );
}
