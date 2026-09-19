import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser } from '../types';
import { api } from '../lib/api';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'easyea_auth_token';
const USER_KEY = 'easyea_auth_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem(USER_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Validate session and check URL query params for OAuth2 token on mount
  useEffect(() => {
    const initAuth = async () => {
      // 1. Check if OAuth redirect passed ?token=... or ?auth_error=...
      const searchParams = new URLSearchParams(window.location.search);
      const urlToken = searchParams.get('token');
      const urlError = searchParams.get('auth_error');

      if (urlError) {
        setAuthError(decodeURIComponent(urlError));
        // Clean URL query params
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const activeToken = urlToken || localStorage.getItem(TOKEN_KEY);

      if (activeToken) {
        try {
          const freshUser = await api.getCurrentUser(activeToken);
          setToken(activeToken);
          setUser(freshUser);
          localStorage.setItem(TOKEN_KEY, activeToken);
          localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
          setAuthError(null);

          // Clean URL if token was in query parameters
          if (urlToken) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } catch (err) {
          console.warn('Session verification failed, logging out:', err);
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string) => {
    const data = await api.login({ username, password });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setAuthError(null);
  };

  const logout = () => {
    api.logout().catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    setAuthError(null);
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        loading,
        authError,
        clearAuthError,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
