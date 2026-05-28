import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const EXPANDED_W = 224;
const COLLAPSED_W = 64;

function NavItem({ to, icon, label, collapsed, extra }) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      style={({ isActive }) => ({
        display:        'flex',
        alignItems:     'center',
        gap:            10,
        padding:        '9px 12px',
        borderRadius:   8,
        color:          isActive ? '#e2e8f0' : '#94a3b8',
        background:     isActive ? '#0f172a' : 'none',
        textDecoration: 'none',
        fontSize:       14,
        fontWeight:     isActive ? 600 : 400,
        whiteSpace:     'nowrap',
        overflow:       'hidden',
        transition:     'background 0.15s, color 0.15s',
        ...(extra || {}),
      })}
    >
      <span style={{ fontSize: 17, flexShrink: 0, lineHeight: 1 }}>{icon}</span>
      <span style={{
        opacity:    collapsed ? 0 : 1,
        maxWidth:   collapsed ? 0 : 160,
        overflow:   'hidden',
        transition: 'opacity 0.2s ease, max-width 0.2s ease',
      }}>
        {label}
      </span>
    </NavLink>
  );
}

export default function Layout() {
  const { logout } = useAuth();
  const navigate   = useNavigate();
  const location   = useLocation();

  const [collapsed,       setCollapsed]       = useState(false);
  const [dashboards,      setDashboards]      = useState([]);
  const [addingDash,      setAddingDash]      = useState(false);
  const [newDashName,     setNewDashName]     = useState('');
  const [devZoneOpen,     setDevZoneOpen]     = useState(
    () => location.pathname.startsWith('/developer')
  );

  useEffect(() => {
    const fetchDashboards = () => api.get('/dashboard').then(r => setDashboards(r.data)).catch(() => {});
    fetchDashboards();

    function onDeleted({ detail }) {
      setDashboards(prev => prev.filter(d => d.id !== detail.id));
    }

    window.addEventListener('iot:dashboard-created', fetchDashboards);
    window.addEventListener('iot:dashboard-deleted', onDeleted);
    return () => {
      window.removeEventListener('iot:dashboard-created', fetchDashboards);
      window.removeEventListener('iot:dashboard-deleted', onDeleted);
    };
  }, []);

  // Keep Developer Zone expanded when navigating within it
  useEffect(() => {
    if (location.pathname.startsWith('/developer')) setDevZoneOpen(true);
  }, [location.pathname]);

  function handleLogout() { logout(); navigate('/login'); }

  async function createDashboard() {
    const name = newDashName.trim();
    if (!name) return;
    try {
      const { data } = await api.post('/dashboard', { name });
      setDashboards(prev => [...prev, { id: data.id, name }]);
      setAddingDash(false);
      setNewDashName('');
      navigate(`/dashboard/${data.id}`);
    } catch {
      alert('Failed to create dashboard');
    }
  }

  function onNewDashKeyDown(e) {
    if (e.key === 'Enter')  createDashboard();
    if (e.key === 'Escape') { setAddingDash(false); setNewDashName(''); }
  }

  const W = collapsed ? COLLAPSED_W : EXPANDED_W;
  const devZoneActive = location.pathname.startsWith('/developer');

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside style={{
        width:          W,
        minWidth:       W,
        background:     '#111827',
        borderRight:    '1px solid #1e293b',
        display:        'flex',
        flexDirection:  'column',
        transition:     'width 0.25s cubic-bezier(.4,0,.2,1), min-width 0.25s cubic-bezier(.4,0,.2,1)',
        overflow:       'hidden',
        position:       'relative',
        zIndex:         10,
      }}>
        {/* Logo row */}
        <div style={{
          display:     'flex',
          alignItems:  'center',
          gap:         10,
          padding:     '20px 14px 16px',
          borderBottom:'1px solid #1e293b',
          whiteSpace:  'nowrap',
          overflow:    'hidden',
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>🌐</span>
          <span style={{
            fontSize:   16,
            fontWeight: 800,
            color:      '#38bdf8',
            opacity:    collapsed ? 0 : 1,
            maxWidth:   collapsed ? 0 : 160,
            overflow:   'hidden',
            transition: 'opacity 0.2s ease, max-width 0.2s ease',
          }}>
            IoT Platform
          </span>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', overflowX: 'hidden' }}>
          <NavItem to="/devices" icon="📡" label="Devices"     collapsed={collapsed} />
          <NavItem to="/export"  icon="📥" label="Export Data" collapsed={collapsed} />

          {/* Dashboards section */}
          <div style={{
            fontSize:   10,
            color:      '#334155',
            padding:    '10px 12px 4px',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            overflow:   'hidden',
            opacity:    collapsed ? 0 : 1,
            maxHeight:  collapsed ? 0 : 30,
            transition: 'opacity 0.2s ease, max-height 0.2s ease',
          }}>
            Dashboards
          </div>

          {dashboards.map(d => (
            <NavLink
              key={d.id}
              to={`/dashboard/${d.id}`}
              title={collapsed ? d.name : undefined}
              style={({ isActive }) => ({
                display:        'flex',
                alignItems:     'center',
                gap:            10,
                padding:        '8px 12px',
                borderRadius:   8,
                color:          isActive ? '#e2e8f0' : '#64748b',
                background:     isActive ? '#0f172a' : 'none',
                textDecoration: 'none',
                fontSize:       13,
                whiteSpace:     'nowrap',
                overflow:       'hidden',
                transition:     'background 0.15s, color 0.15s',
              })}
            >
              <span style={{ fontSize: 14, flexShrink: 0 }}>📋</span>
              <span style={{
                opacity:    collapsed ? 0 : 1,
                maxWidth:   collapsed ? 0 : 160,
                overflow:   'hidden',
                transition: 'opacity 0.2s ease, max-width 0.2s ease',
                textOverflow: 'ellipsis',
              }}>
                {d.name}
              </span>
            </NavLink>
          ))}

          {!collapsed && (
            addingDash ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px' }}>
                <input
                  autoFocus
                  style={{
                    flex: 1, background: '#0f172a', border: '1px solid #334155',
                    borderRadius: 6, color: '#e2e8f0', padding: '5px 8px',
                    fontSize: 12, outline: 'none',
                  }}
                  placeholder="Dashboard name"
                  value={newDashName}
                  onChange={e => setNewDashName(e.target.value)}
                  onKeyDown={onNewDashKeyDown}
                />
                <button
                  onClick={createDashboard}
                  style={{ background: '#0ea5e9', border: 'none', borderRadius: 6, color: '#fff', padding: '5px 9px', cursor: 'pointer', fontSize: 13, fontWeight: 700, flexShrink: 0 }}
                >+</button>
              </div>
            ) : (
              <button
                onClick={() => setAddingDash(true)}
                style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: 12, padding: '6px 12px', textAlign: 'left', borderRadius: 8 }}
              >
                + New Dashboard
              </button>
            )
          )}

          {/* ── Developer Zone ────────────────────────────────────────────────── */}
          <div style={{ marginTop: 8, borderTop: '1px solid #1e293b', paddingTop: 8 }}>
            {/* Developer Zone toggle button */}
            <button
              title={collapsed ? 'Developer Zone' : undefined}
              onClick={() => {
                if (collapsed) {
                  setCollapsed(false);
                  setDevZoneOpen(true);
                } else {
                  setDevZoneOpen(o => !o);
                }
              }}
              style={{
                display:       'flex',
                alignItems:    'center',
                gap:           10,
                width:         '100%',
                padding:       '9px 12px',
                borderRadius:  8,
                background:    devZoneActive ? '#0f172a' : 'none',
                border:        'none',
                color:         devZoneActive ? '#a78bfa' : '#94a3b8',
                fontSize:      14,
                fontWeight:    devZoneActive ? 600 : 400,
                cursor:        'pointer',
                whiteSpace:    'nowrap',
                overflow:      'hidden',
                textAlign:     'left',
                transition:    'background 0.15s, color 0.15s',
              }}
            >
              <span style={{ fontSize: 17, flexShrink: 0 }}>🛠</span>
              <span style={{
                flex:       1,
                opacity:    collapsed ? 0 : 1,
                maxWidth:   collapsed ? 0 : 160,
                overflow:   'hidden',
                transition: 'opacity 0.2s ease, max-width 0.2s ease',
              }}>
                Developer Zone
              </span>
              {!collapsed && (
                <span style={{
                  fontSize:   11,
                  color:      '#475569',
                  transition: 'transform 0.2s',
                  transform:  devZoneOpen ? 'rotate(90deg)' : 'none',
                  flexShrink: 0,
                }}>▶</span>
              )}
            </button>

            {/* Sub-items */}
            <div style={{
              overflow:   'hidden',
              maxHeight:  (!collapsed && devZoneOpen) ? 120 : 0,
              opacity:    (!collapsed && devZoneOpen) ? 1 : 0,
              transition: 'max-height 0.25s ease, opacity 0.2s ease',
              paddingLeft: 12,
            }}>
              <NavLink
                to="/developer/datastreams"
                style={({ isActive }) => ({
                  display:        'flex',
                  alignItems:     'center',
                  gap:            10,
                  padding:        '7px 12px',
                  borderRadius:   8,
                  color:          isActive ? '#c4b5fd' : '#64748b',
                  background:     isActive ? '#1e1b4b' : 'none',
                  textDecoration: 'none',
                  fontSize:       13,
                  whiteSpace:     'nowrap',
                  transition:     'background 0.15s, color 0.15s',
                  marginTop:      2,
                })}
              >
                <span style={{ fontSize: 14, flexShrink: 0 }}>⚡</span>
                <span>Datastream Engine</span>
              </NavLink>

              <NavLink
                to="/developer/sandbox"
                style={({ isActive }) => ({
                  display:        'flex',
                  alignItems:     'center',
                  gap:            10,
                  padding:        '7px 12px',
                  borderRadius:   8,
                  color:          isActive ? '#c4b5fd' : '#64748b',
                  background:     isActive ? '#1e1b4b' : 'none',
                  textDecoration: 'none',
                  fontSize:       13,
                  whiteSpace:     'nowrap',
                  transition:     'background 0.15s, color 0.15s',
                  marginTop:      2,
                })}
              >
                <span style={{ fontSize: 14, flexShrink: 0 }}>🎨</span>
                <span>Dashboard Sandbox</span>
              </NavLink>
            </div>
          </div>
        </nav>

        {/* Collapse toggle + logout */}
        <div style={{ padding: '10px 8px', borderTop: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button
            onClick={handleLogout}
            title={collapsed ? 'Logout' : undefined}
            style={{
              display:     'flex',
              alignItems:  'center',
              gap:         10,
              background:  'none',
              border:      '1px solid #1e293b',
              borderRadius: 8,
              color:       '#64748b',
              padding:     '8px 12px',
              cursor:      'pointer',
              fontSize:    13,
              whiteSpace:  'nowrap',
              overflow:    'hidden',
              width:       '100%',
            }}
          >
            <span style={{ fontSize: 16, flexShrink: 0 }}>⏻</span>
            <span style={{
              opacity:    collapsed ? 0 : 1,
              maxWidth:   collapsed ? 0 : 120,
              overflow:   'hidden',
              transition: 'opacity 0.2s ease, max-width 0.2s ease',
            }}>
              Logout
            </span>
          </button>

          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap:            10,
              background:     'none',
              border:         '1px solid #1e293b',
              borderRadius:   8,
              color:          '#475569',
              padding:        '7px 12px',
              cursor:         'pointer',
              fontSize:       13,
              whiteSpace:     'nowrap',
              overflow:       'hidden',
              width:          '100%',
              transition:     'color 0.15s',
            }}
          >
            <span style={{ fontSize: 16, flexShrink: 0, transform: collapsed ? 'scaleX(-1)' : 'none', transition: 'transform 0.25s' }}>
              ◀
            </span>
            <span style={{
              opacity:    collapsed ? 0 : 1,
              maxWidth:   collapsed ? 0 : 120,
              overflow:   'hidden',
              transition: 'opacity 0.2s ease, max-width 0.2s ease',
            }}>
              Collapse
            </span>
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: 24, overflowY: 'auto', minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  );
}
