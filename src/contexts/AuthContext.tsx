import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '../lib/supabase';
import { apiLogin, apiRegister, apiLogout, apiGetSession } from '../lib/api-client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Vérifier la session PHP au démarrage (cookie httpOnly)
  useEffect(() => {
    apiGetSession()
      .then((sessionUser) => {
        setUser(sessionUser);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    if (!username || username.trim().length < 2) {
      return { success: false, error: "Le nom d'utilisateur doit contenir au moins 2 caractères" };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'Le mot de passe doit contenir au moins 6 caractères' };
    }

    const result = await apiLogin(username.trim(), password);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    setUser(result.user);
    return { success: true };
  };

  const register = async (username: string, password: string) => {
    if (!username || username.trim().length < 2) {
      return { success: false, error: "Le nom d'utilisateur doit contenir au moins 2 caractères" };
    }
    if (username.trim().length > 50) {
      return { success: false, error: "Le nom d'utilisateur ne peut pas dépasser 50 caractères" };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'Le mot de passe doit contenir au moins 6 caractères' };
    }

    const result = await apiRegister(username.trim(), password);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    setUser(result.user);
    return { success: true };
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
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
