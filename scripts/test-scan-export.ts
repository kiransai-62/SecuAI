import http from 'http';
import assert from 'assert';
import jwt from 'jsonwebtoken';
import app from '../apps/api/src/server.js';
import { config } from '../apps/api/src/config.js';
import { memoryDb } from '../apps/api/src/db/supabase.js';

process.env.NODE_ENV = 'test';

const PORT = 4989;
const USER_A_ID = 'user-aaaa-1111-aaaa-1111aaaa1111';
const USER_B_ID = 'user-bbbb-2222-bbbb-2222bbbb2222';

const tokenA = jwt.sign(
  { sub: USER_A_ID, email: 'usera@secuai.dev', role: 'authenticated', aud: 'authenticated' },
  config.jwtSecret,
  { expiresIn: 3600 }
);

const tokenB = jwt.sign(
  { sub: USER_B_ID, email: 'userb@secuai.dev', role: 'authenticated', aud: 'authenticated' },
  config.jwtSecret,
  { expiresIn: 3600 }
);

async function runTests() {
  console.log('--- STARTING JSON SCAN EXPORT (RLS-SCOPED) INTEGRATION TESTS ---');
  const server = app.listen(PORT);

  try {
    const projId = 'proj-export-test-' + Date.now();
    const scanId = 'scan-export-test-' + Date.now();
    const findingId = 'finding-export-test-' + Date.now();

    // Seed User A's project
    memoryDb.projects.set(projId, {
      id: projId,
      user_id: USER_A_ID,
      name: 'Export Test Project',
      description: 'Project for testing RLS-scoped JSON export',
      source_type: 'ZIP',
      repository_url: null,
      framework: 'Next.js 15 / Supabase',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Seed User A's scan
    memoryDb.scans.set(scanId, {
      id: scanId,
      project_id: projId,
      user_id: USER_A_ID,
      status: 'COMPLETED',
      progress_step: 'Done',
      security_score: 85,
      target_type: 'ZIP',
      target_path: 'workspace/repo',
      critical_count: 0,
      high_count: 1,
      medium_count: 1,
      low_count: 0,
      findings_count: 2,
      scan_duration_seconds: 4,
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    // Seed User A's finding
    memoryDb.findings.set(findingId, {
      id: findingId,
      scan_id: scanId,
      user_id: USER_A_ID,
      project_id: projId,
      fingerprint: 'fp-export-001',
      title: 'Missing RLS policy on sensitive table',
      category: 'rls_misconfiguration',
      severity: 'HIGH',
      confidence: 0.95,
      source: 'SAST',
      file_path: 'supabase/migrations/001_tables.sql',
      line_start: 10,
      line_end: 20,
      endpoint: null,
      status: 'OPEN',
      evidence: { scanner_name: 'rls_analyzer', technical_detail: 'Missing policy' },
      description: 'Table lacks row level security',
      created_at: new Date().toISOString(),
    });

    // Test 1: Unauthenticated request -> 401
    console.log('\n[TEST 1] Unauthenticated request:');
    const unauthRes = await fetch(`http://localhost:${PORT}/api/scans/${scanId}/export.json`);
    assert.strictEqual(unauthRes.status, 401, 'Should return 401 without auth header');
    console.log('✓ Unauthenticated request rejected with 401');

    // Test 2: User A exports own scan -> 200, valid export JSON with headers
    console.log('\n[TEST 2] Authorized owner export:');
    const authRes = await fetch(`http://localhost:${PORT}/api/scans/${scanId}/export.json`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(authRes.status, 200, 'Should return 200 for owner');
    
    const contentType = authRes.headers.get('content-type') || '';
    assert(contentType.includes('application/json'), `Content-Type should be JSON, got: ${contentType}`);

    const contentDisp = authRes.headers.get('content-disposition') || '';
    assert(contentDisp.includes(`secuai-scan-${scanId}.json`), `Disposition should specify attachment filename, got: ${contentDisp}`);

    const exportData = await authRes.json();
    assert.strictEqual(exportData.version, '1.0.0');
    assert.strictEqual(exportData.export_type, 'secuai_scan_report');
    assert.strictEqual(exportData.scan.id, scanId);
    assert.strictEqual(exportData.scan.security_score, 85);
    assert.strictEqual(exportData.project.id, projId);
    assert.strictEqual(exportData.findings_count, 1);
    assert.strictEqual(exportData.findings[0].fingerprint, 'fp-export-001');
    console.log('✓ Exported JSON contains accurate metadata, project, and findings');

    // Test 3: User B requests User A's scan -> 404 (RLS-scoped tenant isolation)
    console.log('\n[TEST 3] Cross-tenant access attempt (User B):');
    const crossRes = await fetch(`http://localhost:${PORT}/api/scans/${scanId}/export.json`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.strictEqual(crossRes.status, 404, 'Cross-tenant request should return 404 Not Found');
    console.log('✓ Cross-tenant export blocked with 404 (RLS tenant-isolation preserved)');

    // Test 4: Non-existent scan -> 404
    console.log('\n[TEST 4] Non-existent scan ID:');
    const notFoundRes = await fetch(`http://localhost:${PORT}/api/scans/non-existent-scan/export.json`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(notFoundRes.status, 404);
    console.log('✓ Non-existent scan correctly returns 404');

    console.log('\n--- ALL JSON SCAN EXPORT TESTS PASSED SUCCESSFULLY! ---');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
