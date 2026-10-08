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
  repository_url: 'https://github.com/kiransai-62/SecuAI',
  repo_url: 'https://github.com/kiransai-62/SecuAI',
  framework: 'Next.js 15 / Supabase',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

// Seed default demo scan
const defaultScanId = 'scan-demo-001';
memoryDb.scans.set(defaultScanId, {
  id: defaultScanId,
  project_id: defaultProjectId,
  user_id: defaultUserId,
  status: 'COMPLETED',
  scan_mode: 'full_suite',
  target_type: 'repo',
  target_path: 'https://github.com/kiransai-62/SecuAI',
  storage_path: null,
  result_json: null,
  findings_count: 5,
  critical_count: 3,
  high_count: 2,
  medium_count: 0,
  low_count: 0,
  security_score: 35,
  scan_duration_seconds: 4.8,
  created_at: new Date().toISOString(),
});

// Seed demo findings
const demoFindingsList: FindingRecord[] = [
  {
    id: 'f-1',
    scan_id: defaultScanId,
    project_id: defaultProjectId,
    user_id: defaultUserId,
    fingerprint: 'fp-sqli-001',
    title: 'SQL Injection Risk',
    category: 'SQL_INJECTION',
    severity: 'HIGH',
    status: 'OPEN',
    confidence: 0.95,
    source: 'SAST',
    file_path: 'app/routes/user.ts',
    line_start: 2,
    line_end: 4,
    description: 'User input directly concatenated into SQL query string without parameterization',
    evidence: {
      code_snippet: 'const user = await db.query(`SELECT * FROM users WHERE id = ${req.params.id}`);',
    },
    explanation: 'User input from request parameters is concatenated directly into SQL query without sanitization.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'f-2',
    scan_id: defaultScanId,
    project_id: defaultProjectId,
    user_id: defaultUserId,
    fingerprint: 'fp-validation-002',
    title: 'Missing Input Validation',
    category: 'INPUT_VALIDATION',
    severity: 'HIGH',
    status: 'OPEN',
    confidence: 0.90,
    source: 'SAST',
    file_path: 'app/routes/user.ts',
    line_start: 1,
    line_end: 3,
    description: 'No validation on id parameter before database query',
    evidence: {
      code_snippet: 'app.get("/api/user/:id", async (req, res) => { const { id } = req.params; ... });',
    },
    explanation: 'Route parameters lack UUID schema validation before handler execution.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'f-3',
    scan_id: defaultScanId,
    project_id: defaultProjectId,
    user_id: defaultUserId,
    fingerprint: 'fp-cors-003',
    title: 'Overly Permissive CORS',
    category: 'CORS',
    severity: 'MEDIUM',
    status: 'OPEN',
    confidence: 0.88,
    source: 'DAST',
    file_path: 'app/server.ts',
    line_start: 12,
    line_end: 15,
    description: 'CORS allows wildcard origin requests with credentials enabled',
    evidence: {
      code_snippet: 'app.use(cors({ origin: "*", credentials: true }));',
    },
    explanation: 'Wildcard CORS with credentials enabled allows cross-origin requests from any site.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'f-4',
    scan_id: defaultScanId,
    project_id: defaultProjectId,
    user_id: defaultUserId,
    fingerprint: 'fp-secret-004',
    title: 'Exposed Supabase Service Role Key',
    category: 'SECRET_LEAK',
    severity: 'CRITICAL',
    status: 'OPEN',
    confidence: 0.99,
    source: 'SECRETS',
    file_path: 'app/config/supabase.ts',
    line_start: 5,
    line_end: 5,
    description: 'High-privilege Supabase Service Role Key hardcoded in application source code',
    evidence: {
      code_snippet: 'export const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";',
    },
    explanation: 'Service role secret key was committed in plain text.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'f-5',
    scan_id: defaultScanId,
    project_id: defaultProjectId,
    user_id: defaultUserId,
    fingerprint: 'fp-rls-005',
    title: 'PostgreSQL Row Level Security (RLS) Disabled',
    category: 'POSTGRES_RLS',
    severity: 'CRITICAL',
    status: 'OPEN',
    confidence: 0.98,
    source: 'POLICY',
    file_path: 'supabase/migrations/001_accounts.sql',
    line_start: 1,
    line_end: 10,
    description: 'Table accounts created without ALTER TABLE accounts ENABLE ROW LEVEL SECURITY',
    evidence: {
      code_snippet: 'CREATE TABLE public.accounts ( id uuid primary key, user_id uuid, balance numeric );',
    },
    explanation: 'Public database table lacks RLS policies, allowing open tenant reads.',
    created_at: new Date().toISOString(),
  },
];

for (const f of demoFindingsList) {
  memoryDb.findings.set(f.id, f);
  memoryDb.findings.set(f.fingerprint, f);
}

export { supabase, serviceRoleSupabase };
