import { supabase, serviceRoleSupabase, memoryDb } from '../db/supabase.js';

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY));
}

export function getSupabaseAdmin() {
  return serviceRoleSupabase || supabase;
}

export function getSupabaseForUser() {
  return supabase;
}

export { supabase, serviceRoleSupabase, memoryDb };
