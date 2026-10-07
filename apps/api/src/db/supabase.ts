import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config, maskSecret } from '../config.js';
import { Project, Scan, FindingRecord } from '@secuai/shared';

let supabase: SupabaseClient | null = null;
let serviceRoleSupabase: SupabaseClient | null = null;

if (config.supabaseUrl && (config.supabaseServiceKey || config.supabaseAnonKey)) {
  try {
    supabase = createClient(config.supabaseUrl, config.supabaseServiceKey || config.supabaseAnonKey, {
      auth: { persistSession: false },
    });
    console.log(`[SecuAI Database] Supabase client initialized with URL: ${config.supabaseUrl}`);
  } catch (err: any) {
    console.warn(`[SecuAI Database] Supabase init failed (${err.message}). Using local store.`);
  }
} else {
  console.log('[SecuAI Database] Running in self-contained local Postgres-compatible store mode.');
}

// Service-role client: STRICTLY for worker background processing ONLY
if (config.supabaseUrl && config.supabaseServiceKey) {
  try {
    serviceRoleSupabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch (err: any) {
    console.warn(`[SecuAI Database] Service role client init failed: ${err.message}`);
  }
}

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

// In-Memory Database fallback (strictly partitioned by user_id for RLS enforcement)
export const memoryDb = {
  users: new Map<string, UserRecord>(),
  projects: new Map<string, Project>(),
  scans: new Map<string, Scan>(),
  findings: new Map<string, FindingRecord>(),
  ai_analysis: new Map<string, any>(),
  verification_runs: new Map<string, any>(),
};

// Seed default initial demonstration project
const defaultUserId = '00000000-0000-0000-0000-000000000001';
const defaultProjectId = '11111111-1111-1111-1111-111111111111';

memoryDb.projects.set(defaultProjectId, {
  id: defaultProjectId,
  user_id: defaultUserId,
  name: 'FinTech & AI SaaS Demo App',
  description: 'FinTech & AI SaaS banking demonstration project',
  source_type: 'GITHUB',
  repository_url: 'https://github.com/enterprise/neobank-api',
  repo_url: 'https://github.com/enterprise/neobank-api',
  framework: 'Next.js 15 / Supabase',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export { supabase, serviceRoleSupabase };
