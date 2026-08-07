import { useEffect, useState } from 'react';
import { AuthContext } from './authContext';
import { API_URL } from '../config';
import { clearQueuedActions } from '../services/offlineActionQueue';
import { csrfToken } from '../utils/csrf';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = sessionStorage.getItem('user');
      return savedUser && savedUser !== 'undefined' ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => sessionStorage.getItem('token'));

  const login = (userData) => {
    setUser(userData);
    setToken(null);
    sessionStorage.setItem('user', JSON.stringify(userData));
    sessionStorage.removeItem('token');
    
    // Sync language from backend
    fetch(`${API_URL}/api/users/preferences`, {
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.preferences?.language) {
          localStorage.setItem('preferredLanguage', data.preferences.language);
          window.dispatchEvent(new Event('storage')); // trigger updates if necessary
        }
      })
      .catch(console.error);
  };

  const logout = async () => {
    const currentUserId = user?.id;
    try {
      await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {
      // Local state must still be cleared if the server is temporarily unavailable.
    }
    setUser(null);
    setToken(null);
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    if (currentUserId) void clearQueuedActions(currentUserId);
  };

  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      if (!url.startsWith(`${API_URL}/api/`)) return originalFetch(input, init);
      const headers = new Headers(init.headers || (typeof input === 'string' ? undefined : input.headers));
      const method = String(init.method || (typeof input === 'string' ? 'GET' : input.method) || 'GET').toUpperCase();
      const proof = csrfToken();
      if (!SAFE_METHODS.has(method) && proof && !headers.has('X-CSRF-Token')) headers.set('X-CSRF-Token', proof);
      if (!headers.has('Accept')) headers.set('Accept', 'application/json');
      return originalFetch(input, { ...init, method, headers, credentials: 'include' });
    };
    return () => { window.fetch = originalFetch; };
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
