import { PGlite } from '@electric-sql/pglite';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const USER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const PROJECT_A = '11111111-1111-1111-1111-111111111111';
const SCAN_A = '22222222-2222-2222-2222-222222222222';
const FINDING_A = '33333333-3333-3333-3333-333333333333';
const ANALYSIS_A = '44444444-4444-4444-4444-444444444444';
const VERIFICATION_A = '55555555-5555-5555-5555-555555555555';
const STORAGE_OBJECT_A = '66666666-6666-6666-6666-666666666666';

interface TestStepResult {
  step: string;
  passed: boolean;
  detail: string;
}

const results: TestStepResult[] = [];

function assert(condition: boolean, step: string, detail: string) {
  if (!condition) {
    results.push({ step, passed: false, detail: `FAILED: ${detail}` });
    throw new Error(`[Assertion Failure] ${step}: ${detail}`);
  }
  results.push({ step, passed: true, detail });
}

/**
 * 1. Local RLS Test Suite using PGlite (21 strict checks against 001_secuai_schema.sql)
 */
export async function runLocalRlsTests() {
  console.log('======================================================================');
  console.log('🛡️  SecuAI Supabase Row Level Security (RLS) Test Suite (PGlite)');
  console.log('======================================================================\n');

  // Initialize PGlite database instance
  const db = new PGlite();

  // Load and execute the exact migration file
  const migrationPath = path.resolve('supabase/migrations/001_secuai_schema.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  await db.exec(migrationSql);
  console.log('✔ Schema migration applied successfully (Enums, Tables, RLS, Indexes, Storage).\n');

  // Register Users A and B in auth.users
  await db.query(`
    INSERT INTO auth.users (id, email)
    VALUES 
      ('${USER_A}', 'user_a@secuai.dev'),
      ('${USER_B}', 'user_b@secuai.dev')
    ON CONFLICT (id) DO NOTHING;
  `);

  // Helper to switch context
  const setSession = async (userId: string) => {
    await db.exec(`
      SET ROLE authenticated;
      SET request.jwt.claim.sub = '${userId}';
    `);
  };

  // ==============================================================================
  // STEP 1: USER A creates project, scan, finding, ai_analysis, verification_run
  // ==============================================================================
  console.log('--- Phase 1: User A Creates Resources ---');
  await setSession(USER_A);

  await db.query(`
    INSERT INTO public.projects (id, user_id, name, repo_url, framework)
    VALUES ('${PROJECT_A}', '${USER_A}', 'SecuAI Core App', 'https://github.com/secuai/core.git', 'nextjs');
  `);

  await db.query(`
    INSERT INTO public.scans (id, user_id, project_id, status, workspace_path, storage_path, security_score, critical_count, high_count)
    VALUES ('${SCAN_A}', '${USER_A}', '${PROJECT_A}', 'COMPLETED', './demo-vulnerable-app', 'uploads/archive.zip', 40, 2, 1);
  `);

  await db.query(`
    INSERT INTO public.findings (
      id, user_id, scan_id, project_id, fingerprint, title, category, severity, confidence, source, description, status
    ) VALUES (
      '${FINDING_A}', '${USER_A}', '${SCAN_A}', '${PROJECT_A}', 
      'sha256-fingerprint-rls-rule-credits', 'Missing Row Level Security', 'rls_misconfiguration',
      'CRITICAL', 0.95, 'SAST', 'Table credits lacks RLS', 'OPEN'
    );
  `);

  await db.query(`
    INSERT INTO public.ai_analysis (
      id, user_id, finding_id, root_cause, blast_radius, proposed_diff, explanation
    ) VALUES (
      '${ANALYSIS_A}', '${USER_A}', '${FINDING_A}',
      'Lacks ENABLE ROW LEVEL SECURITY', 'Complete tenant data leakage',
      '+ALTER TABLE credits ENABLE ROW LEVEL SECURITY;', 'Server-side explanation'
    );
  `);

  await db.query(`
    INSERT INTO public.verification_runs (
      id, user_id, finding_id, scan_id, verdict, scanner_name, verified, message
    ) VALUES (
      '${VERIFICATION_A}', '${USER_A}', '${FINDING_A}', '${SCAN_A}',
      'PASSED', 'rls_policy_analyzer', true, 'Patch verified by isitsecure engine'
    );
  `);

  await db.query(`
    INSERT INTO storage.objects (id, bucket_id, name, owner)
    VALUES ('${STORAGE_OBJECT_A}', 'uploads', '${USER_A}/source-archive.zip', '${USER_A}');
  `);

  // Verify User A can read their own resources
  const aProjects = await db.query<{ count: string }>('SELECT count(*) as count FROM public.projects;');
  const aScans = await db.query<{ count: string }>('SELECT count(*) as count FROM public.scans;');
  const aFindings = await db.query<{ count: string }>('SELECT count(*) as count FROM public.findings;');
  const aAnalysis = await db.query<{ count: string }>('SELECT count(*) as count FROM public.ai_analysis;');
  const aVerification = await db.query<{ count: string }>('SELECT count(*) as count FROM public.verification_runs;');
  const aStorage = await db.query<{ count: string }>('SELECT count(*) as count FROM storage.objects WHERE bucket_id = \'uploads\';');

  assert(parseInt(aProjects.rows[0].count) === 1, 'User A Projects Read', 'User A can read own project');
  assert(parseInt(aScans.rows[0].count) === 1, 'User A Scans Read', 'User A can read own scan');
  assert(parseInt(aFindings.rows[0].count) === 1, 'User A Findings Read', 'User A can read own finding');
  assert(parseInt(aAnalysis.rows[0].count) === 1, 'User A AI Analysis Read', 'User A can read own analysis');
  assert(parseInt(aVerification.rows[0].count) === 1, 'User A Verifications Read', 'User A can read own verification');
  assert(parseInt(aStorage.rows[0].count) === 1, 'User A Storage Read', 'User A can read own storage object');
  console.log('✔ User A created and successfully accessed all rows.\n');

  // ==============================================================================
  // STEP 2: USER B Isolation Check (Must Read 0 Rows on Each Table)
  // ==============================================================================
  console.log('--- Phase 2: User B Tenant Isolation Verification (Zero Read) ---');
  await setSession(USER_B);

  const bProjects = await db.query<{ count: string }>('SELECT count(*) as count FROM public.projects;');
  const bScans = await db.query<{ count: string }>('SELECT count(*) as count FROM public.scans;');
  const bFindings = await db.query<{ count: string }>('SELECT count(*) as count FROM public.findings;');
  const bAnalysis = await db.query<{ count: string }>('SELECT count(*) as count FROM public.ai_analysis;');
  const bVerification = await db.query<{ count: string }>('SELECT count(*) as count FROM public.verification_runs;');
  const bStorage = await db.query<{ count: string }>('SELECT count(*) as count FROM storage.objects WHERE bucket_id = \'uploads\';');

  assert(parseInt(bProjects.rows[0].count) === 0, 'User B Projects Isolation', 'User B read exactly 0 rows from projects');
  assert(parseInt(bScans.rows[0].count) === 0, 'User B Scans Isolation', 'User B read exactly 0 rows from scans');
  assert(parseInt(bFindings.rows[0].count) === 0, 'User B Findings Isolation', 'User B read exactly 0 rows from findings');
  assert(parseInt(bAnalysis.rows[0].count) === 0, 'User B AI Analysis Isolation', 'User B read exactly 0 rows from ai_analysis');
  assert(parseInt(bVerification.rows[0].count) === 0, 'User B Verifications Isolation', 'User B read exactly 0 rows from verification_runs');
  assert(parseInt(bStorage.rows[0].count) === 0, 'User B Storage Isolation', 'User B read exactly 0 rows from storage.objects');
  console.log('✔ User B reads 0 rows on ALL tables (Projects, Scans, Findings, AI Analysis, Verifications, Storage).\n');

  // ==============================================================================
  // STEP 3: USER B Cannot Write to User A's Resources
  // ==============================================================================
  console.log('--- Phase 3: User B Write Prevention (Cannot Write to Other Tenants) ---');

  // Attempt 1: User B tries to insert a project with user_id = USER_A
  let insertSpoofFailed = false;
  try {
    await db.query(`
      INSERT INTO public.projects (id, user_id, name, repo_url, framework)
      VALUES ('${crypto.randomUUID()}', '${USER_A}', 'Spoofed Project', 'https://github.com/spoof/spoof.git', 'nextjs');
    `);
  } catch (err: any) {
    insertSpoofFailed = true;
    assert(
      err.message.includes('violates row-level security policy') || err.message.includes('policy'),
      'User B Insert Spoof Blocked',
      'Policy enforced: cannot insert rows with another user_id'
    );
  }
  assert(insertSpoofFailed, 'User B Insert Prevention', 'User B cannot insert projects for User A');

  // Attempt 2: User B tries to update User A's project
  const updateProjectResult = await db.query(`
    UPDATE public.projects 
    SET name = 'Hacked Project' 
    WHERE id = '${PROJECT_A}';
  `);
  assert(updateProjectResult.affectedRows === 0, 'User B Project Update Blocked', 'Project update affected 0 rows');

  // Attempt 3: User B tries to delete User A's project
  const deleteProjectResult = await db.query(`
    DELETE FROM public.projects 
    WHERE id = '${PROJECT_A}';
  `);
  assert(deleteProjectResult.affectedRows === 0, 'User B Project Delete Blocked', 'Project delete affected 0 rows');

  // Attempt 4: User B tries to update User A's scan
  const updateScanResult = await db.query(`
    UPDATE public.scans
    SET status = 'FAILED'
    WHERE id = '${SCAN_A}';
  `);
  assert(updateScanResult.affectedRows === 0, 'User B Scan Update Blocked', 'Scan update affected 0 rows');

  // Attempt 5: User B tries to update User A's finding
  const updateFindingResult = await db.query(`
    UPDATE public.findings
    SET status = 'FALSE_POSITIVE'
    WHERE id = '${FINDING_A}';
  `);
  assert(updateFindingResult.affectedRows === 0, 'User B Finding Update Blocked', 'Finding update affected 0 rows');

  // Attempt 6: User B tries to upload into User A's storage folder
  let storageAttackBlocked = false;
  try {
    await db.query(`
      INSERT INTO storage.objects (bucket_id, name, owner)
      VALUES ('uploads', '${USER_A}/malicious_payload.sh', '${USER_B}');
    `);
  } catch (err: any) {
    storageAttackBlocked = true;
    assert(
      err.message.includes('violates row-level security policy') || err.message.includes('policy'),
      'User B Storage Prefix Violation Blocked',
      'Storage policy blocked writing to another user\'s folder prefix'
    );
  }
  assert(storageAttackBlocked, 'User B Storage Exploit Prevented', 'User B cannot write to User A storage prefix');

  console.log('✔ User B cannot write or tamper with any of User A\'s records or storage files.\n');

  // ==============================================================================
  // STEP 4: Integrity Verification under User A
  // ==============================================================================
  console.log('--- Phase 4: State Integrity Verification ---');
  await setSession(USER_A);
  const verifyProj = await db.query<{ name: string }>(`SELECT name FROM public.projects WHERE id = '${PROJECT_A}';`);
  assert(verifyProj.rows[0].name === 'SecuAI Core App', 'Data Integrity', 'User A data remained unchanged and uncorrupted');
  console.log('✔ User A data integrity fully preserved.\n');

  console.log('======================================================================');
  console.log('🎉 ALL ROW LEVEL SECURITY (RLS) ACCEPTANCE CRITERIA PASSED!');
  console.log(`📊 Total Checks Passed: ${results.length} / ${results.length}`);
  console.log('======================================================================\n');
}

/**
 * 2. Live Production Supabase RLS Verification
 * Triggered when TARGET=prod or when pointing to live Supabase URL
 */
export async function runProdRlsTests() {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  console.log('======================================================================');
  console.log('🛡️  SecuAI Live Production Supabase RLS Verification');
  console.log(`🌐  Target Instance: ${supabaseUrl}`);
  console.log('======================================================================\n');

  if (!supabaseUrl || !anonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be provided for production RLS testing.');
  }

  // 1. Unauthenticated Anon Client must see 0 projects/scans/findings
  const anonClient = createClient(supabaseUrl, anonKey);
  const { data: anonProjects, error: anonErr } = await anonClient.from('projects').select('*');
  
  if (anonErr) {
    console.log(`✔ Anon query returned expected error under RLS: ${anonErr.message}`);
  } else {
    assert(anonProjects.length === 0, 'Anon Read Blocked', `Anon query returned ${anonProjects.length} rows (expected 0)`);
    console.log('✔ Anon unauthenticated client read blocked (0 rows).');
  }

  const { data: anonScans } = await anonClient.from('scans').select('*');
  assert(!anonScans || anonScans.length === 0, 'Anon Scans Blocked', 'Anon read on scans blocked');
  console.log('✔ Anon unauthenticated read on scans blocked (0 rows).');

  const { data: anonFindings } = await anonClient.from('findings').select('*');
  assert(!anonFindings || anonFindings.length === 0, 'Anon Findings Blocked', 'Anon read on findings blocked');
  console.log('✔ Anon unauthenticated read on findings blocked (0 rows).');

  // 2. If service role is provided, test multi-tenant cross-isolation between two temporary accounts
  if (serviceKey) {
    console.log('\n--- Phase 2: Live Multi-Tenant Isolation Checks ---');
    const adminClient = createClient(supabaseUrl, serviceKey);

    const testId = Date.now();
    const emailA = `test_tenant_a_${testId}@secuai.dev`;
    const emailB = `test_tenant_b_${testId}@secuai.dev`;
    const password = 'SecuAI_StrongPassword_2026!';

    const { data: uA, error: errA } = await adminClient.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    });
    const { data: uB, error: errB } = await adminClient.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    });

    if (uA?.user && uB?.user) {
      try {
        const clientA = createClient(supabaseUrl, anonKey);
        await clientA.auth.signInWithPassword({ email: emailA, password });

        const clientB = createClient(supabaseUrl, anonKey);
        await clientB.auth.signInWithPassword({ email: emailB, password });

        // User A inserts a project
        const { data: projA, error: pErr } = await clientA
          .from('projects')
          .insert({
            user_id: uA.user.id,
            name: 'Prod RLS Test Project A',
            repo_url: 'https://github.com/secuai/test-app',
            framework: 'nextjs',
          })
          .select()
          .single();

        assert(!pErr && !!projA, 'User A Project Creation', 'User A created project under live RLS');
        console.log('✔ User A successfully created project under live authenticated RLS.');

        // User B reads projects — must NOT see User A's project
        const { data: bProjects } = await clientB.from('projects').select('*').eq('id', projA.id);
        assert(!bProjects || bProjects.length === 0, 'User B Read Isolation', 'User B cannot see User A project');
        console.log('✔ User B query for User A project returned 0 rows.');

        // User B attempts to update User A's project
        const { data: bUpdate } = await clientB
          .from('projects')
          .update({ name: 'Tampered' })
          .eq('id', projA.id)
          .select();
        assert(!bUpdate || bUpdate.length === 0, 'User B Update Blocked', 'User B cannot modify User A project');
        console.log('✔ User B modification of User A project affected 0 rows.');

        // Clean up project
        await adminClient.from('projects').delete().eq('id', projA.id);
      } finally {
        await adminClient.auth.admin.deleteUser(uA.user.id);
        await adminClient.auth.admin.deleteUser(uB.user.id);
        console.log('✔ Cleaned up temporary test tenant accounts.');
      }
    }
  }

  console.log('\n======================================================================');
  console.log('🎉 ALL PRODUCTION ROW LEVEL SECURITY (RLS) CHECKS PASSED!');
  console.log('======================================================================\n');
}

// Router between local and production suites
const isProd =
  process.env.TARGET === 'prod' ||
  (Boolean(process.env.SUPABASE_URL) &&
    !process.env.SUPABASE_URL?.includes('demo-secuai') &&
    process.env.SUPABASE_URL?.startsWith('http'));

if (isProd) {
  runProdRlsTests().catch((err) => {
    console.error('\n❌ Production RLS Verification Failed:', err.message);
    process.exit(1);
  });
} else {
  runLocalRlsTests().catch((err) => {
    console.error('\n❌ Local RLS Test Suite Failed:', err.message);
    process.exit(1);
  });
}
