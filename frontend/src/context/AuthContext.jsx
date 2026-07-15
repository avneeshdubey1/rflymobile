import { useEffect, useState } from 'react';
import { AuthContext } from './authContext';
import { API_URL } from '../config';
import { clearQueuedActions } from '../services/offlineActionQueue';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = sessionStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState(() => sessionStorage.getItem('token'));

  const login = (userData, accessToken) => {
    setUser(userData);
    setToken(accessToken);
    sessionStorage.setItem('user', JSON.stringify(userData));
    sessionStorage.setItem('token', accessToken);
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
