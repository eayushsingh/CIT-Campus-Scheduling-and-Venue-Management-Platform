import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../api/client';

export type Role = 'admin' | 'coordinator' | 'faculty' | 'club_rep';

export interface User {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  department?: string | null;
}

export interface DemoAccount {
  username: string;
  password: string;
  role: Role;
  display_name: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginAsDemo: (account: DemoAccount) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('cit_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('cit_token');
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const verifyAuth = async () => {
      if (token) {
        try {
          const res = await apiClient.get<User>('/auth/me');
          setUser(res.data);
          localStorage.setItem('cit_user', JSON.stringify(res.data));
        } catch {
          logout();
        }
      }
      setIsLoading(false);
    };
    verifyAuth();
  }, [token]);

  const login = async (username: string, password: string) => {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);

    const res = await apiClient.post<{
      access_token: string;
      token_type: string;
      role: Role;
      username: string;
      display_name: string;
    }>('/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const accessToken = res.data.access_token;
    localStorage.setItem('cit_token', accessToken);
    setToken(accessToken);

    const userProfile: User = {
      id: 0,
      username: res.data.username,
      display_name: res.data.display_name,
      role: res.data.role,
    };
    try {
      const meRes = await apiClient.get<User>('/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setUser(meRes.data);
      localStorage.setItem('cit_user', JSON.stringify(meRes.data));
    } catch {
      setUser(userProfile);
      localStorage.setItem('cit_user', JSON.stringify(userProfile));
    }
  };

  const loginAsDemo = async (account: DemoAccount) => {
    await login(account.username, account.password);
  };

  const logout = () => {
    localStorage.removeItem('cit_token');
    localStorage.removeItem('cit_user');
    setToken(null);
    setUser(null);
  };

  const hasRole = (...roles: Role[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        loginAsDemo,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
