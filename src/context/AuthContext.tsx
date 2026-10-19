import React, { createContext, useContext, useEffect, useState } from 'react';
import { repository } from '../services/repository';
import { AuthSession, UserRecord } from '../types';

interface AuthContextType {
  user: UserRecord | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (usuario: string, password: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  availableUsers: UserRecord[];
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = 'mm_auth_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [availableUsers, setAvailableUsers] = useState<UserRecord[]>([]);

  const loadUsersList = async () => {
    try {
      const users = await repository.getUsers();
      setAvailableUsers(users);
    } catch (e) {
      console.error('Failed to load users from repository', e);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        await loadUsersList();
        const storedSession = localStorage.getItem(SESSION_KEY);
        if (storedSession) {
          const session: AuthSession = JSON.parse(storedSession);
          if (session.expiresAt > Date.now()) {
            setUser(session.user as UserRecord);
          } else {
            localStorage.removeItem(SESSION_KEY);
          }
        }
      } catch (e) {
        console.warn('Session restoration failed:', e);
        localStorage.removeItem(SESSION_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (usuario: string, password: string): Promise<boolean> => {
    setError(null);
    setIsLoading(true);

    try {
      // Step 1: Check against decoupled Sheets / Memory repository
      const authenticatedUser = await repository.authenticate(usuario, password);

      if (!authenticatedUser) {
        setError('Acceso denegado: Usuario o contraseña no coinciden con los registros autorizados en la hoja "Usuarios".');
        setIsLoading(false);
        return false;
      }

      const sessionUser: UserRecord = {
        id: authenticatedUser.id,
        usuario: authenticatedUser.usuario,
        nombre: authenticatedUser.nombre,
        rol: authenticatedUser.rol,
        avatar: authenticatedUser.avatar
      };

      const session: AuthSession = {
        token: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        user: sessionUser,
        expiresAt: Date.now() + 86400000 // 24 hours
      };

      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      setUser(sessionUser);
      setIsLoading(false);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error en la autenticación';
      setError(msg);
      setIsLoading(false);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
    setError(null);
  };

  const clearError = () => setError(null);

  const refreshUsers = async () => {
    await loadUsersList();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        logout,
        clearError,
        availableUsers,
        refreshUsers
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
