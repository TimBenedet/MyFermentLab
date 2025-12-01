import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface AuthContextType {
  isAuthenticated: boolean;
  role: 'admin' | 'viewer' | null;
  login: (password: string) => Promise<void>;
  loginAsViewer: () => Promise<void>;
  logout: () => void;
  getAuthHeaders: () => HeadersInit;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('authToken'));
  const [role, setRole] = useState<'admin' | 'viewer' | null>(localStorage.getItem('authRole') as 'admin' | 'viewer' | null);

  const isAuthenticated = !!token;

  useEffect(() => {
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }

    if (role) {
      localStorage.setItem('authRole', role);
    } else {
      localStorage.removeItem('authRole');
    }
  }, [token, role]);

  const login = async (password: string) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      throw new Error('Invalid password');
    }

    const data = await response.json();
    setToken(data.token);
    setRole(data.role);
  };

  const loginAsViewer = async () => {
    const response = await fetch(`${API_URL}/api/auth/viewer`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to get viewer session');
    }

    const data = await response.json();
    setToken(data.token);
    setRole(data.role);
  };

  const logout = () => {
    if (token) {
      fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(console.error);
    }

    setToken(null);
    setRole(null);
  };

  const getAuthHeaders = (): HeadersInit => {
    if (!token) return {};
    return {
      Authorization: `Bearer ${token}`,
    };
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, role, login, loginAsViewer, logout, getAuthHeaders }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
