import { useEffect, useState } from 'react';
import { AuthContext } from './authContext';
import { API_URL } from '../config';
import { clearQueuedActions } from '../services/offlineActionQueue';

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

  const login = (userData, accessToken) => {
    setUser(userData);
    setToken(accessToken);
    sessionStorage.setItem('user', JSON.stringify(userData));
    sessionStorage.setItem('token', accessToken);
    
    // Sync language from backend
    fetch(`${API_URL}/api/users/preferences`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
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

  const logout = () => {
    const currentUserId = user?.id;
    setUser(null);
    setToken(null);
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    if (currentUserId) void clearQueuedActions(currentUserId);
  };

  useEffect(() => {
    if (!token) return undefined;
    const originalFetch = window.fetch;
    window.fetch = (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      if (!url.startsWith(`${API_URL}/api/`)) return originalFetch(input, init);
      const headers = new Headers(init.headers || (typeof input === 'string' ? undefined : input.headers));
      if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
      return originalFetch(input, { ...init, headers });
    };
    return () => { window.fetch = originalFetch; };
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
