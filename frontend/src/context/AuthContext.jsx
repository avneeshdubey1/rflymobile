import { useCallback, useEffect, useRef, useState } from 'react';
import i18n from '../i18n';
import { AuthContext } from './authContext';
import { clearQueuedActions } from '../services/offlineActionQueue';
import { apiFetch, AUTH_EXPIRED_EVENT, getCsrfToken, readJson } from '../services/apiClient';

const PENDING_LOGOUT_KEY = 'daasLogoutPending';
const AUTH_CHANNEL = 'daas-auth';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('checking');
  const userRef = useRef(null);
  const channelRef = useRef(null);

  const applyLanguage = useCallback((userData) => {
    const language = userData?.preferredLanguage || userData?.preferences?.language;
    if (!language) return;
    localStorage.setItem('preferredLanguage', language);
    void i18n.changeLanguage(language);
  }, []);

  const setAuthenticatedUser = useCallback((userData) => {
    userRef.current = userData;
    setUser(userData);
    setStatus('authenticated');
    applyLanguage(userData);
  }, [applyLanguage]);

  const clearLocalIdentity = useCallback(() => {
    userRef.current = null;
    setUser(null);
    setStatus('anonymous');
  }, []);

  const finishPendingLogout = useCallback(async () => {
    const pendingScope = localStorage.getItem(PENDING_LOGOUT_KEY);
    if (!pendingScope) return true;
    try {
      const endpoint = pendingScope === 'all' ? '/api/auth/logout-all' : '/api/auth/logout';
      const response = await apiFetch(endpoint, { method: 'POST', authFailure: 'ignore' });
      if (!response.ok && response.status !== 401) return false;
      localStorage.removeItem(PENDING_LOGOUT_KEY);
      return true;
    } catch {
      return false;
    }
  }, []);

  const refreshSession = useCallback(async () => {
    setStatus('checking');
    if (!(await finishPendingLogout())) {
      clearLocalIdentity();
      setStatus('offline');
      return null;
    }
    // The session and readable CSRF cookies are issued and cleared together.
    // With no CSRF cookie this is a first-time or fully signed-out browser, so
    // avoid a noisy unauthenticated /me request on every public page load.
    if (!getCsrfToken()) {
      clearLocalIdentity();
      return null;
    }
    try {
      const response = await apiFetch('/api/auth/me', { authFailure: 'ignore' });
      const data = await readJson(response);
      if (!response.ok || !data.success || !data.user) {
        clearLocalIdentity();
        return null;
      }
      setAuthenticatedUser(data.user);
      return data.user;
    } catch {
      clearLocalIdentity();
      setStatus('offline');
      return null;
    }
  }, [clearLocalIdentity, finishPendingLogout, setAuthenticatedUser]);

  const login = useCallback((userData) => {
    localStorage.removeItem(PENDING_LOGOUT_KEY);
    setAuthenticatedUser(userData);
    channelRef.current?.postMessage({ type: 'login' });
  }, [setAuthenticatedUser]);

  const logout = useCallback(async ({ all = false } = {}) => {
    const currentUserId = userRef.current?.id;
    let serverConfirmed;
    try {
      const response = await apiFetch(all ? '/api/auth/logout-all' : '/api/auth/logout', {
        method: 'POST',
        authFailure: 'ignore',
      });
      serverConfirmed = response.ok || response.status === 401;
    } catch {
      serverConfirmed = false;
    }

    if (serverConfirmed) localStorage.removeItem(PENDING_LOGOUT_KEY);
    else localStorage.setItem(PENDING_LOGOUT_KEY, all ? 'all' : 'current');

    if (currentUserId) {
      try {
        await clearQueuedActions(currentUserId);
      } catch {
        // The identity is still cleared. The user-scoped queue expires after
        // 24 hours and cannot replay under a different account.
      }
    }
    clearLocalIdentity();
    channelRef.current?.postMessage({ type: 'logout' });
    return { serverConfirmed };
  }, [clearLocalIdentity]);

  useEffect(() => {
    // Remove bearer-era data left by an older frontend release. Neither the
    // opaque session credential nor identity is stored in browser storage.
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    localStorage.removeItem('token');
    const timer = window.setTimeout(() => void refreshSession(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshSession]);

  useEffect(() => {
    const handleExpired = () => {
      clearLocalIdentity();
      channelRef.current?.postMessage({ type: 'logout' });
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
  }, [clearLocalIdentity]);

  useEffect(() => {
    if (!('BroadcastChannel' in window)) return undefined;
    const channel = new BroadcastChannel(AUTH_CHANNEL);
    channelRef.current = channel;
    channel.onmessage = (event) => {
      if (event.data?.type === 'logout') clearLocalIdentity();
      if (event.data?.type === 'login') void refreshSession();
    };
    return () => {
      channelRef.current = null;
      channel.close();
    };
  }, [clearLocalIdentity, refreshSession]);

  useEffect(() => {
    const handleOnline = () => {
      if (localStorage.getItem(PENDING_LOGOUT_KEY)) void refreshSession();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [refreshSession]);

  return (
    <AuthContext.Provider value={{ user, status, login, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
};
