import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import {
  Cpu, Radio, Download, LayoutDashboard, Code2,
  Activity, Layers, LogOut, ChevronLeft, ChevronRight,
  ChevronDown, Plus, X, Check, Sun, Moon, Trash2, Pencil,
} from 'lucide-react';
import VoiceControl from './VoiceControl';

const EXPANDED_W = 232;
const COLLAPSED_W = 64;

function NavItem({ to, icon: Icon, label, collapsed }) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150
        ${isActive
          ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium border border-sky-500/20'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-transparent'}`
      }
    >
      <Icon size={16} className="shrink-0" />
      <span className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${collapsed ? 'opacity-0 max-w-0' : 'opacity-100 max-w-[160px]'}`}>
        {label}
      </span>
    </NavLink>
  );
}

export default function Layout() {
  const { logout, user }   = useAuth();
  const { dark, toggle }   = useTheme();
  const navigate           = useNavigate();
  const location           = useLocation();

  const [collapsed,    setCollapsed]    = useState(false);
  const [dashboards,   setDashboards]   = useState([]);
  const [addingDash,   setAddingDash]   = useState(false);
  const [newDashName,  setNewDashName]  = useState('');
  const [devZoneOpen,  setDevZoneOpen]  = useState(
    () => location.pathname.startsWith('/developer')
  );
  // Tracks whether the currently active dashboard is in edit mode
  const [dashEditing, setDashEditing] = useState(false);

  useEffect(() => {
    const fetchDashboards = () => api.get('/dashboard').then(r => setDashboards(r.data)).catch(() => {});
    fetchDashboards();

    function onDeleted({ detail }) {
      setDashboards(prev => prev.filter(d => d.id !== detail.id));
    }
    function onEditChanged({ detail }) {
      setDashEditing(detail?.editing ?? false);
    }

    window.addEventListener('iot:dashboard-created',      fetchDashboards);
    window.addEventListener('iot:dashboard-deleted',      onDeleted);
    window.addEventListener('iot:dashboard:edit-changed', onEditChanged);
    return () => {
      window.removeEventListener('iot:dashboard-created',      fetchDashboards);
      window.removeEventListener('iot:dashboard-deleted',      onDeleted);
      window.removeEventListener('iot:dashboard:edit-changed', onEditChanged);
    };
  }, []);

  async function deleteDashboard(dashId, dashName) {
    if (!window.confirm(`Delete "${dashName}"?\nAll widgets will be removed. This cannot be undone.`)) return;
    try {
      await api.delete(`/dashboard/${dashId}`);
      setDashboards(prev => prev.filter(d => d.id !== dashId));
      window.dispatchEvent(new CustomEvent('iot:dashboard-deleted', { detail: { id: dashId } }));
      if (location.pathname === `/dashboard/${dashId}`) navigate('/devices');
    } catch { alert('Failed to delete dashboard'); }
  }

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

  const devZoneActive = location.pathname.startsWith('/developer');

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside
        style={{ width: collapsed ? COLLAPSED_W : EXPANDED_W, minWidth: collapsed ? COLLAPSED_W : EXPANDED_W }}
        className="flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-250 overflow-hidden relative z-10 shadow-sm dark:shadow-none h-screen"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center shrink-0">
            <Cpu size={16} className="text-sky-500 dark:text-sky-400" />
          </div>
          <div className={`overflow-hidden transition-all duration-200 ${collapsed ? 'opacity-0 max-w-0' : 'opacity-100 max-w-[160px]'}`}>
            <div className="text-sm font-bold text-slate-900 dark:text-white whitespace-nowrap tracking-tight">IoT Platform</div>
            <div className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">Device Control</div>
          </div>
        </div>

        {/* User profile */}
        {user && (
          <div className={`flex items-center gap-2.5 px-3 py-3 border-b border-slate-200 dark:border-slate-800 overflow-hidden ${collapsed ? 'justify-center' : ''}`}>
            {user.avatar
              ? <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full shrink-0 ring-2 ring-sky-500/30 object-cover" referrerPolicy="no-referrer" />
              : <div className="w-7 h-7 rounded-full shrink-0 bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center text-xs font-bold text-white">
                  {(user.name || user.email || '?')[0].toUpperCase()}
                </div>
            }
            <div className={`overflow-hidden transition-all duration-200 min-w-0 ${collapsed ? 'opacity-0 max-w-0' : 'opacity-100 max-w-[140px]'}`}>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap truncate">{user.name || 'User'}</div>
              <div className="text-[10px] text-slate-400 whitespace-nowrap truncate">{user.email}</div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto overflow-x-hidden scrollbar-thin">
          <NavItem to="/devices" icon={Radio}    label="Devices"     collapsed={collapsed} />
          <NavItem to="/export"  icon={Download} label="Export Data"  collapsed={collapsed} />

          <div className={`overflow-hidden transition-all duration-200 ${collapsed ? 'opacity-0 max-h-0' : 'opacity-100 max-h-8'}`}>
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-600 uppercase tracking-widest px-3 pt-4 pb-1">
              Dashboards
            </p>
          </div>

          {dashboards.map(d => {
            const isCurrentDash = location.pathname === `/dashboard/${d.id}`;
            return (
              <div key={d.id} className="relative group/dash">
                <NavLink
                  to={`/dashboard/${d.id}`}
                  title={collapsed ? d.name : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-150 border overflow-hidden w-full
                    ${isActive
                      ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium border-sky-500/20'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 border-transparent'}`
                  }
                >
                  <LayoutDashboard size={14} className="shrink-0" />
                  <span className={`overflow-hidden whitespace-nowrap text-ellipsis transition-all duration-200 ${collapsed ? 'opacity-0 max-w-0' : 'opacity-100 max-w-[100px]'}`}>
                    {d.name}
                  </span>
                  {/* Edit mode pulse dot */}
                  {isCurrentDash && dashEditing && !collapsed && (
                    <span className="ml-auto mr-1 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                  )}
                </NavLink>

                {/* Hover-reveal action buttons — hidden when sidebar is collapsed */}
                {!collapsed && (
                  <div className="absolute inset-y-0 right-1 flex items-center gap-0.5 opacity-0 group-hover/dash:opacity-100 transition-opacity duration-150 z-10">
                    {/* Add Widget — only for the active dashboard */}
                    {isCurrentDash && (
                      <button
                        title="Add Widget"
                        onClick={e => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('iot:dashboard:add-widget')); }}
                        className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:text-sky-400 hover:bg-sky-500/10 dark:hover:bg-sky-500/15 transition-colors"
                      >
                        <Plus size={11} />
                      </button>
                    )}
                    {/* Edit Layout — only for the active dashboard */}
                    {isCurrentDash && (
                      <button
                        title={dashEditing ? 'Done Editing' : 'Edit Layout'}
                        onClick={e => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('iot:dashboard:toggle-edit')); }}
                        className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                          dashEditing
                            ? 'text-amber-400 hover:bg-amber-500/10'
                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/50'
                        }`}
                      >
                        {dashEditing ? <Check size={11} /> : <Pencil size={11} />}
                      </button>
                    )}
                    {/* Delete — always shown on hover */}
                    <button
                      title="Delete Dashboard"
                      onClick={e => { e.preventDefault(); e.stopPropagation(); deleteDashboard(d.id, d.name); }}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {!collapsed && (
            addingDash ? (
              <div className="flex items-center gap-1.5 px-1 mt-0.5">
                <input
                  autoFocus
                  className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-slate-900 dark:text-slate-200 placeholder-slate-400 px-2.5 py-1.5 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30"
                  placeholder="Dashboard name"
                  value={newDashName}
                  onChange={e => setNewDashName(e.target.value)}
                  onKeyDown={onNewDashKeyDown}
                />
                <button onClick={createDashboard} className="bg-sky-500 hover:bg-sky-400 text-white rounded-md p-1.5 shrink-0 transition-colors">
                  <Check size={13} />
                </button>
                <button onClick={() => { setAddingDash(false); setNewDashName(''); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-md p-1.5 shrink-0 transition-colors">
                  <X size={13} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAddingDash(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 hover:text-sky-500 dark:hover:text-sky-400 rounded-lg transition-colors"
              >
                <Plus size={13} />
                New Dashboard
              </button>
            )
          )}

          {/* Developer Zone */}
          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              title={collapsed ? 'Developer Zone' : undefined}
              onClick={() => {
                if (collapsed) { setCollapsed(false); setDevZoneOpen(true); }
                else setDevZoneOpen(o => !o);
              }}
              className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-all duration-150 border
                ${devZoneActive
                  ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 font-medium border-violet-500/20'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70 border-transparent'}`}
            >
              <Code2 size={16} className="shrink-0" />
              <span className={`flex-1 overflow-hidden whitespace-nowrap text-left transition-all duration-200 ${collapsed ? 'opacity-0 max-w-0' : 'opacity-100 max-w-[120px]'}`}>
                Developer Zone
              </span>
              {!collapsed && (
                <ChevronDown size={13} className={`text-slate-400 dark:text-slate-600 shrink-0 transition-transform duration-200 ${devZoneOpen ? 'rotate-180' : ''}`} />
              )}
            </button>

            <div className={`overflow-hidden transition-all duration-250 pl-3 ${!collapsed && devZoneOpen ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'}`}>
              <NavLink
                to="/developer/datastreams"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] mt-0.5 transition-all duration-150 border
                  ${isActive
                    ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 border-transparent'}`
                }
              >
                <Activity size={14} className="shrink-0" />
                <span>Datastream Engine</span>
              </NavLink>

              <NavLink
                to="/developer/sandbox"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] mt-0.5 transition-all duration-150 border
                  ${isActive
                    ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 border-transparent'}`
                }
              >
                <Layers size={14} className="shrink-0" />
                <span>Dashboard Sandbox</span>
              </NavLink>
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-1">
          {/* Theme toggle */}
          <button
            onClick={toggle}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-transparent transition-all duration-150"
            style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
          >
            {dark
              ? <Sun size={16} className="shrink-0 text-amber-400" />
              : <Moon size={16} className="shrink-0 text-slate-500" />
            }
            <span className={`overflow-hidden whitespace-nowrap transition-all duration-200 text-xs ${collapsed ? 'opacity-0 max-w-0' : 'opacity-100 max-w-[120px]'}`}>
              {dark ? 'Light Mode' : 'Dark Mode'}
            </span>
          </button>

          <button
            onClick={handleLogout}
            title={collapsed ? 'Logout' : undefined}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all duration-150"
          >
            <LogOut size={16} className="shrink-0" />
            <span className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${collapsed ? 'opacity-0 max-w-0' : 'opacity-100 max-w-[120px]'}`}>
              Logout
            </span>
          </button>

          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-transparent transition-all duration-150"
            style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
          >
            {collapsed
              ? <ChevronRight size={16} className="shrink-0" />
              : <><ChevronLeft size={16} className="shrink-0" /><span className="text-xs">Collapse</span></>
            }
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto min-w-0 p-6 bg-slate-50 dark:bg-slate-950">
        <Outlet />
      </main>

      {/* ── Floating voice control button ─────────────────────────────────────── */}
      <VoiceControl />
    </div>
  );
}
