import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const { login } = useAuth();
  const navigate  = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/auth/login', { email, password });
      login(data.token, data.user);
      navigate('/devices');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.title}>IoT Platform</div>
        {error && <div style={s.err}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <label style={s.label}>Email</label>
          <input style={s.input} type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <label style={s.label}>Password</label>
          <input style={s.input} type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          <button style={s.btn} type="submit">Login</button>
        </form>
        <p style={{ marginTop:16 }}><Link to="/register" style={s.link}>Create account</Link></p>
      </div>
    </div>
  );
}
