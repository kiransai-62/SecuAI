import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, LOCAL_STORAGE_KEY } from '../services/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  register: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to create a structured deterministic JWT for local/offline sessions
function createLocalJwt(userId: string, email: string): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub: userId,
      email,
      role: 'authenticated',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600, // 7 days
    })
  );
  return `${header}.${payload}.secuai_signature`;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize session on mount (refresh keeps session)
  useEffect(() => {
    let mounted = true;

    async function initSession() {
      try {
        // 1. Check supabase-js official session
        const { data, error } = await supabase.auth.getSession();
        if (!error && data.session) {
          if (mounted) {
            setSession(data.session);
            setUser(data.session.user);
            setIsLoading(false);
            return;
          }
        }

        // 2. Fallback to localStorage session check
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.user && parsed.access_token) {
            if (mounted) {
              setSession(parsed);
              setUser(parsed.user);
              setIsLoading(false);
              return;
            }
          }
        }
      } catch (err) {
        console.warn('[AuthContext] Session init note:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    initSession();

    // Listen to real-time auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!mounted) return;
      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentSession));
      } else {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!stored) {
          setSession(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ error: string | null }> => {
    setIsLoading(true);
    try {
      // 1. Attempt official Supabase Auth sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error && data.session) {
        setSession(data.session);
        setUser(data.user);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data.session));
        setIsLoading(false);
        return { error: null };
      }

      // If network/cloud failed, handle local demo auth
      if (error && (error.message.includes('fetch') || error.message.includes('network') || error.status === 0 || error.message.includes('Failed to fetch'))) {
        const mockUserId = '11111111-1111-1111-1111-111111111111';
        const token = createLocalJwt(mockUserId, email);
        const localSession: Session = {
          access_token: token,
          token_type: 'bearer',
          expires_in: 3600 * 24 * 7,
          refresh_token: 'local_refresh_token',
          user: {
            id: mockUserId,
            app_metadata: {},
            user_metadata: { email },
            aud: 'authenticated',
            created_at: new Date().toISOString(),
            email,
          } as User,
        };

        setSession(localSession);
        setUser(localSession.user);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localSession));
        setIsLoading(false);
        return { error: null };
      }

      setIsLoading(false);
      return { error: error?.message || 'Invalid email or password.' };
    } catch (err: any) {
      setIsLoading(false);
      return { error: err.message || 'An unexpected error occurred during login.' };
    }
  };

  const register = async (email: string, password: string): Promise<{ error: string | null }> => {
    setIsLoading(true);
    try {
      // 1. Attempt official Supabase Auth sign up
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (!error && data.user) {
        if (data.session) {
          setSession(data.session);
          setUser(data.user);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data.session));
        } else {
          // If email confirmation is required, create local active session for hackathon demo
          const mockUserId = data.user.id || '11111111-1111-1111-1111-111111111111';
          const token = createLocalJwt(mockUserId, email);
          const localSession: Session = {
            access_token: token,
            token_type: 'bearer',
            expires_in: 3600 * 24 * 7,
            refresh_token: 'local_refresh_token',
            user: data.user,
          };
          setSession(localSession);
          setUser(data.user);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localSession));
        }
        setIsLoading(false);
        return { error: null };
      }

      // If network/cloud failed, handle local demo auth
      if (error && (error.message.includes('fetch') || error.message.includes('network') || error.status === 0 || error.message.includes('Failed to fetch'))) {
        const mockUserId = crypto.randomUUID();
        const token = createLocalJwt(mockUserId, email);
        const localSession: Session = {
          access_token: token,
          token_type: 'bearer',
          expires_in: 3600 * 24 * 7,
          refresh_token: 'local_refresh_token',
          user: {
            id: mockUserId,
            app_metadata: {},
            user_metadata: { email },
            aud: 'authenticated',
            created_at: new Date().toISOString(),
            email,
          } as User,
        };

        setSession(localSession);
        setUser(localSession.user);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localSession));
        setIsLoading(false);
        return { error: null };
      }

      setIsLoading(false);
      return { error: error?.message || 'Failed to create account.' };
    } catch (err: any) {
      setIsLoading(false);
      return { error: err.message || 'An unexpected error occurred during registration.' };
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
    } catch {}
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setSession(null);
    setUser(null);
    setIsLoading(false);
  };

  const token = session?.access_token || null;

  const value = useMemo(
    () => ({
      user,
      session,
      token,
      isLoading,
      login,
      register,
      logout,
    }),
    [user, session, token, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
