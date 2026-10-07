import http from 'http';
import assert from 'assert';
import jwt from 'jsonwebtoken';
import app from '../apps/api/src/server.js';
import { config } from '../apps/api/src/config.js';
import { memoryDb } from '../apps/api/src/db/supabase.js';

process.env.NODE_ENV = 'test';

const PORT = 4985;
const USER_A_ID = 'aaaa0001-aaaa-0001-aaaa-000000000001';
const USER_B_ID = 'bbbb0002-bbbb-0002-bbbb-000000000002';

const tokenUserA = jwt.sign(
  { sub: USER_A_ID, email: 'userA@secuai.dev', role: 'authenticated', aud: 'authenticated' },
  config.jwtSecret,
  { expiresIn: 3600 }
);

const tokenUserB = jwt.sign(
  { sub: USER_B_ID, email: 'userB@secuai.dev', role: 'authenticated', aud: 'authenticated' },
  config.jwtSecret,
  { expiresIn: 3600 }
);

async function request(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: any;
  } = {}
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const postData = options.body ? JSON.stringify(options.body) : '';
    const req = http.request(
      `http://localhost:${PORT}${path}`,
      {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData).toString() } : {}),
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed: any = {};
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = { raw: data };
          }
          resolve({ status: res.statusCode || 0, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('======================================================================');
  console.log('🔒  SecuAI Tenant Isolation: User B Gets 404 for User A Resources   ');
  console.log('======================================================================\n');

  const server = app.listen(PORT);

  try {
    // --------------------------------------------------------------------------
    // Test 0: Custom bcrypt + JWT Auth registration & login endpoints
    // --------------------------------------------------------------------------
    console.log('[TEST 0] Testing custom bcrypt + JWT auth endpoints:');
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: { email: 'custom-auth@secuai.dev', password: 'StrongPassword123!' },
    });
    assert.strictEqual(regRes.status, 201);
    assert(Boolean(regRes.body.token), 'JWT token returned upon registration');
    console.log('✓ POST /api/auth/register succeeds with bcrypt hash + signed JWT');

    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'custom-auth@secuai.dev', password: 'StrongPassword123!' },
    });
    assert.strictEqual(loginRes.status, 200);
    assert(Boolean(loginRes.body.token), 'JWT token returned upon login');
    console.log('✓ POST /api/auth/login succeeds with bcrypt password verification');

    // Invalid password returns 401
    const badLoginRes = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'custom-auth@secuai.dev', password: 'WrongPassword' },
    });
    assert.strictEqual(badLoginRes.status, 401);
    console.log('✓ POST /api/auth/login rejects wrong password with 401');

    // --------------------------------------------------------------------------
    // Setup: User A creates project, scan, finding, and ai_analysis
    // --------------------------------------------------------------------------
    const projAId = 'proj-user-a-' + Date.now();
    const scanAId = 'scan-user-a-' + Date.now();
    const findingAId = 'finding-user-a-' + Date.now();
    const analysisAId = 'analysis-user-a-' + Date.now();

    memoryDb.projects.set(projAId, {
      id: projAId,
      user_id: USER_A_ID,
      name: "User A's Secret Financial API",
      description: "User A's private infrastructure",
      source_type: 'ZIP',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    memoryDb.scans.set(scanAId, {
      id: scanAId,
      project_id: projAId,
      user_id: USER_A_ID,
      status: 'COMPLETED',
      target_type: 'upload',
      target_path: 'uploads/archive.zip',
      security_score: 45,
      findings_count: 1,
      critical_count: 1,
      high_count: 0,
      medium_count: 0,
      low_count: 0,
      created_at: new Date().toISOString(),
    });

    memoryDb.findings.set(findingAId, {
      id: findingAId,
      scan_id: scanAId,
      project_id: projAId,
      user_id: USER_A_ID,
      fingerprint: 'fp-user-a-secret-finding-12345',
      title: 'Exposed Database Credentials in Configuration',
      category: 'exposed_secrets',
      severity: 'CRITICAL',
      confidence: 0.98,
      source: 'SAST',
      file_path: 'config/database.yml',
      status: 'OPEN',
      description: 'Production credentials exposed in source repository.',
      evidence: { scanner_name: 'secret_scanner' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    memoryDb.ai_analysis.set(analysisAId, {
      id: analysisAId,
      finding_id: findingAId,
      user_id: USER_A_ID,
      fingerprint: 'fp-user-a-secret-finding-12345',
      model: config.geminiModel,
      root_cause: 'Hardcoded credentials in version control',
      blast_radius: 'Complete database compromise',
      explanation: 'Detailed AI analysis of database leak',
      created_at: new Date().toISOString(),
    });

    // --------------------------------------------------------------------------
    // TEST 1: User A can read own resources (200 OK)
    // --------------------------------------------------------------------------
    console.log('\n[TEST 1] User A can access own resources:');
    const aProj = await request(`/api/projects/${projAId}`, { token: tokenUserA });
    assert.strictEqual(aProj.status, 200, "User A accesses own project");
    console.log(`✓ User A gets 200 for own project (${projAId})`);

    const aScan = await request(`/api/scans/${scanAId}`, { token: tokenUserA });
    assert.strictEqual(aScan.status, 200, "User A accesses own scan");
    console.log(`✓ User A gets 200 for own scan (${scanAId})`);

    const aFinding = await request(`/api/findings/${findingAId}`, { token: tokenUserA });
    assert.strictEqual(aFinding.status, 200, "User A accesses own finding");
    console.log(`✓ User A gets 200 for own finding (${findingAId})`);

    const aAnalysis = await request(`/api/ai_analysis/${analysisAId}`, { token: tokenUserA });
    assert.strictEqual(aAnalysis.status, 200, "User A accesses own ai_analysis");
    console.log(`✓ User A gets 200 for own ai_analysis (${analysisAId})`);

    // --------------------------------------------------------------------------
    // TEST 2: User B gets 404 for User A's PROJECT
    // --------------------------------------------------------------------------
    console.log("\n[TEST 2] User B gets 404 on User A's project (prevent enumeration):");
    const bProjGet = await request(`/api/projects/${projAId}`, { token: tokenUserB });
    assert.strictEqual(bProjGet.status, 404, `Expected 404, got ${bProjGet.status}`);
    console.log('✓ GET /api/projects/:id strictly returned 404 for User B');

    const bProjPatch = await request(`/api/projects/${projAId}`, {
      method: 'PATCH',
      token: tokenUserB,
      body: { name: 'Compromised Name' },
    });
    assert.strictEqual(bProjPatch.status, 404, `Expected 404, got ${bProjPatch.status}`);
    console.log('✓ PATCH /api/projects/:id strictly returned 404 for User B');

    const bProjDel = await request(`/api/projects/${projAId}`, {
      method: 'DELETE',
      token: tokenUserB,
    });
    assert.strictEqual(bProjDel.status, 404, `Expected 404, got ${bProjDel.status}`);
    console.log('✓ DELETE /api/projects/:id strictly returned 404 for User B');

    // --------------------------------------------------------------------------
    // TEST 3: User B gets 404 for User A's SCAN
    // --------------------------------------------------------------------------
    console.log("\n[TEST 3] User B gets 404 on User A's scan:");
    const bScanGet = await request(`/api/scans/${scanAId}`, { token: tokenUserB });
    assert.strictEqual(bScanGet.status, 404, `Expected 404, got ${bScanGet.status}`);
    console.log('✓ GET /api/scans/:id strictly returned 404 for User B');

    const bScanExport = await request(`/api/scans/${scanAId}/export.json`, { token: tokenUserB });
    assert.strictEqual(bScanExport.status, 404, `Expected 404, got ${bScanExport.status}`);
    console.log('✓ GET /api/scans/:id/export.json strictly returned 404 for User B');

    const bScanFindings = await request(`/api/scans/${scanAId}/findings`, { token: tokenUserB });
    assert.strictEqual(bScanFindings.status, 404, `Expected 404, got ${bScanFindings.status}`);
    console.log('✓ GET /api/scans/:id/findings strictly returned 404 for User B');

    // --------------------------------------------------------------------------
    // TEST 4: User B gets 404 for User A's FINDING
    // --------------------------------------------------------------------------
    console.log("\n[TEST 4] User B gets 404 on User A's finding:");
    const bFindingGet = await request(`/api/findings/${findingAId}`, { token: tokenUserB });
    assert.strictEqual(bFindingGet.status, 404, `Expected 404, got ${bFindingGet.status}`);
    console.log('✓ GET /api/findings/:id strictly returned 404 for User B');

    const bFindingVerify = await request(`/api/findings/${findingAId}/verify`, {
      method: 'POST',
      token: tokenUserB,
      body: { applied_diff: '+ALTER TABLE test;' },
    });
    assert.strictEqual(bFindingVerify.status, 404, `Expected 404, got ${bFindingVerify.status}`);
    console.log('✓ POST /api/findings/:id/verify strictly returned 404 for User B');

    // --------------------------------------------------------------------------
    // TEST 5: User B gets 404 for User A's AI_ANALYSIS
    // --------------------------------------------------------------------------
    console.log("\n[TEST 5] User B gets 404 on User A's ai_analysis:");
    const bAnalysisGet = await request(`/api/ai_analysis/${analysisAId}`, { token: tokenUserB });
    assert.strictEqual(bAnalysisGet.status, 404, `Expected 404, got ${bAnalysisGet.status}`);
    console.log('✓ GET /api/ai_analysis/:id strictly returned 404 for User B');

    const bFindingAnalysis = await request(`/api/findings/${findingAId}/analysis`, { token: tokenUserB });
    assert.strictEqual(bFindingAnalysis.status, 404, `Expected 404, got ${bFindingAnalysis.status}`);
    console.log('✓ GET /api/findings/:id/analysis strictly returned 404 for User B');

    const bExplainPost = await request(`/api/findings/${findingAId}/explain`, {
      method: 'POST',
      token: tokenUserB,
    });
    assert.strictEqual(bExplainPost.status, 404, `Expected 404, got ${bExplainPost.status}`);
    console.log('✓ POST /api/findings/:id/explain strictly returned 404 for User B');

    console.log('\n======================================================================');
    console.log('🎉 ALL TENANT ISOLATION (USER B GETS 404) ACCEPTANCE CHECKS PASSED!   ');
    console.log('======================================================================\n');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test Failure:', err);
  process.exit(1);
});
