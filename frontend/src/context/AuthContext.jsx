import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const AuthContext = createContext(null);

// How long to wait without any user activity before forcing logout.
const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes

// Activity events that reset the inactivity timer.
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'pointerdown', 'scroll', 'touchstart'];

// Decode the JWT payload (no verification — the backend does that).
// Returns the exp field in milliseconds, or null if the token is malformed.
function getTokenExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function isExpired(token) {
  const exp = getTokenExpiry(token);
  return exp === null || Date.now() >= exp;
}

// On first load, discard any token that is already past its expiry time
// so the user is not silently treated as logged in with a dead token.
function loadStoredToken() {
  const stored = localStorage.getItem('iot_token');
  if (!stored || isExpired(stored)) {
    localStorage.removeItem('iot_token');
    localStorage.removeItem('iot_user');
    return null;
  }
  return stored;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(loadStoredToken);
  const [user,  setUser]  = useState(() => {
    const stored = localStorage.getItem('iot_user');
    return stored ? JSON.parse(stored) : null;
  });

  const inactivityTimer = useRef(null);

  // ── Core auth actions ──────────────────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem('iot_token');
    localStorage.removeItem('iot_user');
    setToken(null);
    setUser(null);
    // Revoke Google session so user sees the account picker on next login
    try { window.google?.accounts?.id?.disableAutoSelect(); } catch {}
  }, []);

  function login(tokenVal, userVal) {
    localStorage.setItem('iot_token', tokenVal);
    localStorage.setItem('iot_user', JSON.stringify(userVal));
    setToken(tokenVal);
    setUser(userVal);
    // Revoke any previous Google session so the picker re-shows on next logout
    try { window.google?.accounts?.id?.disableAutoSelect(); } catch {}
  }

  // ── Periodic expiry check ──────────────────────────────────────────────────
  // Catches the case where the app stays open and the JWT reaches its exp
  // while the tab is visible (e.g. user left it open overnight).
  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => {
      if (isExpired(token)) logout();
    }, 60_000); // poll every minute — well below any meaningful token lifetime
    return () => clearInterval(id);
  }, [token, logout]);

  // ── Inactivity timeout ─────────────────────────────────────────────────────
  // Reset a 30-minute countdown on every recorded user gesture.
  // If the timer fires, the session is ended silently; PrivateRoute then
  // redirects to /login on the next render.
  useEffect(() => {
    if (!token) return;

    function schedule() {
      clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(logout, INACTIVITY_MS);
    }

    schedule(); // arm immediately on login / page load
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, schedule, { passive: true }));

    return () => {
      clearTimeout(inactivityTimer.current);
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, schedule));
    };
  }, [token, logout]);

  // ── 401 listener (from api.js interceptor) ────────────────────────────────
  // Any protected API call that returns 401 (expired/invalid token) dispatches
  // 'iot:unauthorized'. Logout clears state; PrivateRoute handles the redirect.
  useEffect(() => {
    window.addEventListener('iot:unauthorized', logout);
    return () => window.removeEventListener('iot:unauthorized', logout);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
