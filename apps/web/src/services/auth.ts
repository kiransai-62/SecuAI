import { supabase, LOCAL_STORAGE_KEY } from './supabase';

export const authService = {
  async login(email: string, password: string) {
    return supabase.auth.signInWithPassword({ email, password });
  },
  async register(email: string, password: string) {
    return supabase.auth.signUp({ email, password });
  },
  async logout() {
    return supabase.auth.signOut();
  },
  async loginWithOAuth(provider: 'google' | 'github') {
    return supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  },
  getSession() {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY) || localStorage.getItem('secuai_auth_session');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
};

export default authService;
