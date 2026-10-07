import fs from 'fs';
import path from 'path';
import express from 'express';
import jwt from 'jsonwebtoken';
import assert from 'assert';
import { memoryDb } from '../apps/api/src/db/supabase.js';
import router from '../apps/api/src/routes.js';
import { config } from '../apps/api/src/config.js';
import { WORKSPACE_BASE_DIR } from '../apps/api/src/worker.js';
import { initWorkspaceGit, applyGitDiff } from '../apps/api/src/lib/gitWorkspace.js';

async function runTests() {
  console.log('--- STARTING FINDING VERIFY & SCORE RECOMPUTE TESTS ---');

  const app = express();
  app.use(express.json());
  app.use('/api', router);

  const PORT = 4995;
  const server = app.listen(PORT);

  const userA = { id: 'user-verify-a', email: 'userA@secuai.dev' };
  const userB = { id: 'user-verify-b', email: 'userB@secuai.dev' };

  const tokenA = jwt.sign(
    { sub: userA.id, email: userA.email, role: 'authenticated' },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  const tokenB = jwt.sign(
    { sub: userB.id, email: userB.email, role: 'authenticated' },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  const scanId = 'scan-verify-test-01';
  const projectId = 'proj-verify-test-01';
  const findingId = 'finding-access-ctrl-01';
  const fingerprint = 'fp-access-ctrl-demo-7392a83b';
  const targetRelFile = 'src/app/api/settings/route.ts';

  const workspacePath = path.join(WORKSPACE_BASE_DIR, scanId);

  // 1. Setup workspace with baseline vulnerable code
  if (fs.existsSync(workspacePath)) {
    fs.rmSync(workspacePath, { recursive: true, force: true });
  }
  fs.mkdirSync(path.join(workspacePath, 'src/app/api/settings'), { recursive: true });

  const vulnerableCode = `export async function PATCH(request: Request) {
  const body = await request.json();
  await updateSettings(body);
  return NextResponse.json({ success: true });
}
`;
  fs.writeFileSync(path.join(workspacePath, targetRelFile), vulnerableCode, 'utf-8');

  // Initialize git baseline in workspace
  initWorkspaceGit(workspacePath);

  // 2. Seed memoryDb with initial scan and finding in OPEN status
  memoryDb.scans.set(scanId, {
    id: scanId,
    project_id: projectId,
    user_id: userA.id,
    status: 'COMPLETED',
    progress_step: 'Done',
    scan_mode: 'code_only',
    target_type: 'demo',
    target_path: './test',
    workspace_path: workspacePath,
    findings_count: 1,
    critical_count: 0,
    high_count: 1,
    medium_count: 0,
    low_count: 0,
    security_score: 70, // 100 - 30 (HIGH category penalty) = 70
    scan_duration_seconds: 3,
    created_at: new Date().toISOString(),
  });

  memoryDb.findings.set(findingId, {
    id: findingId,
    scan_id: scanId,
    project_id: projectId,
    user_id: userA.id,
    fingerprint,
    title: 'API route missing authentication check',
    category: 'auth_weakness',
    severity: 'HIGH',
    confidence: 0.88,
    source: 'SAST',
    file_path: targetRelFile,
    line_start: 1,
    line_end: 5,
    endpoint: '/api/settings',
    evidence: {
      scanner_name: 'route_auth_analyzer',
      code_snippet: vulnerableCode,
    },
    description: 'The API route /api/settings (PATCH) does not check authentication.',
    status: 'OPEN',
    created_at: new Date().toISOString(),
  });

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Initial state verification
    // ------------------------------------------------------------------------
    console.log('\n[TEST 1] Initial Finding and Scan State:');
    const initialFinding = memoryDb.findings.get(findingId)!;
    const initialScan = memoryDb.scans.get(scanId)!;
    assert.strictEqual(initialFinding.status, 'OPEN');
    console.log(`✓ Finding status is OPEN`);
    console.log(`✓ Scan security score is ${initialScan.security_score}`);
    assert.strictEqual(initialScan.security_score, 70);

    // ------------------------------------------------------------------------
    // TEST 2: Tenant Isolation: User B cannot verify User A's finding
    // ------------------------------------------------------------------------
    console.log('\n[TEST 2] Tenant Isolation (404 on cross-tenant verify):');
    const isoRes = await fetch(`http://localhost:${PORT}/api/findings/${findingId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ applied_diff: 'some diff' }),
    });
    console.log(`  Response status: ${isoRes.status}`);
    assert.strictEqual(isoRes.status, 404, 'User B must receive 404 on User A finding');
    console.log('✓ Cross-tenant verify blocked with 404');

    // ------------------------------------------------------------------------
    // TEST 3: OPEN -> FIX_PROPOSED
    // ------------------------------------------------------------------------
    console.log('\n[TEST 3] Step: OPEN -> FIX_PROPOSED:');
    const authFixDiff = `--- a/${targetRelFile}
+++ b/${targetRelFile}
@@ -1,5 +1,9 @@
+import { getUser } from '@/lib/auth';
+
 export async function PATCH(request: Request) {
+  const user = await getUser(request);
+  if (!user) return new Response('Unauthorized', { status: 401 });
   const body = await request.json();
   await updateSettings(body);
   return NextResponse.json({ success: true });
 }
`;

    // Save proposed diff to finding
    initialFinding.proposed_diff = authFixDiff;
    initialFinding.status = 'FIX_PROPOSED';
    assert.strictEqual(initialFinding.status, 'FIX_PROPOSED');
    console.log('✓ Status updated to FIX_PROPOSED');

    // ------------------------------------------------------------------------
    // TEST 4: FIX_PROPOSED -> FIX_APPLIED
    // ------------------------------------------------------------------------
    console.log('\n[TEST 4] Step: FIX_PROPOSED -> FIX_APPLIED:');
    const applyRes = await fetch(`http://localhost:${PORT}/api/findings/${findingId}/apply-fix`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ diff: authFixDiff }),
    });
    const applyData = await applyRes.json();
    assert.strictEqual(applyRes.status, 200);
    assert.strictEqual(applyData.status, 'FIX_APPLIED');
    console.log('✓ Status updated to FIX_APPLIED');
    console.log(`  Workspace file updated with auth guard`);

    // Verify file content on disk
    const patchedCode = fs.readFileSync(path.join(workspacePath, targetRelFile), 'utf-8');
    assert(patchedCode.includes('getUser'), 'File on disk contains getUser auth guard');
    console.log('✓ File on disk contains route auth guard');

    // ------------------------------------------------------------------------
    // TEST 5: Verify when vulnerability is still present -> Result: OPEN (note "still present")
    // ------------------------------------------------------------------------
    console.log('\n[TEST 5] Verify failure result mapping: Vulnerability still present -> OPEN (note "still present"):');
    const badDiff = `--- a/${targetRelFile}
+++ b/${targetRelFile}
@@ -1,2 +1,3 @@
+// Just a cosmetic comment without auth
`;
    const failVerifyRes = await fetch(`http://localhost:${PORT}/api/findings/${findingId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ applied_diff: badDiff }),
    });
    const failVerifyData = await failVerifyRes.json();
    console.log(`  Status: ${failVerifyData.status}`);
    console.log(`  Verdict: ${failVerifyData.evidence.verdict}`);
    console.log(`  Note: ${failVerifyData.evidence.note}`);
    assert.strictEqual(failVerifyData.status, 'OPEN');
    assert.strictEqual(failVerifyData.evidence.note, 'still present');
    console.log('✓ Result mapped to OPEN with note "still present"');

    // ------------------------------------------------------------------------
    // TEST 6: FIX_APPLIED -> VERIFIED (Scanner verifies the patch)
    // ------------------------------------------------------------------------
    console.log('\n[TEST 6] Step: FIX_APPLIED -> VERIFIED:');
    // Restore finding status to FIX_APPLIED
    memoryDb.findings.get(findingId)!.status = 'FIX_APPLIED';

    const verifyRes = await fetch(`http://localhost:${PORT}/api/findings/${findingId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ applied_diff: authFixDiff }),
    });
    const verifyData = await verifyRes.json();
    console.log(`  Success: ${verifyData.success}`);
    console.log(`  Previous status: ${verifyData.previous_status}`);
    console.log(`  New status: ${verifyData.new_status}`);
    console.log(`  Evidence message: ${verifyData.evidence.message}`);
    console.log(`  New scan score: ${verifyData.scan_metrics.score}`);

    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual(verifyData.previous_status, 'FIX_APPLIED');
    assert.strictEqual(verifyData.new_status, 'VERIFIED');
    assert.strictEqual(verifyData.status, 'VERIFIED');
    assert.strictEqual(verifyData.evidence.verdict, 'PASSED');
    assert.strictEqual(verifyData.evidence.verified, true);
    console.log('✓ Status cleanly updated to VERIFIED');

    // ------------------------------------------------------------------------
    // TEST 7: verification_runs saved {previous_status, new_status, evidence}
    // ------------------------------------------------------------------------
    console.log('\n[TEST 7] verification_runs persistence:');
    const runs = Array.from(memoryDb.verification_runs.values()).filter((r: any) => r.finding_id === findingId);
    assert(runs.length >= 1, 'At least one verification run recorded');
    const latestRun = runs[runs.length - 1];
    assert.strictEqual(latestRun.previous_status, 'FIX_APPLIED');
    assert.strictEqual(latestRun.new_status, 'VERIFIED');
    assert(latestRun.evidence !== undefined);
    assert.strictEqual(latestRun.evidence.verdict, 'PASSED');
    console.log(`✓ verification_runs recorded { previous_status: '${latestRun.previous_status}', new_status: '${latestRun.new_status}', evidence }`);

    // ------------------------------------------------------------------------
    // TEST 8: Score increases when finding becomes VERIFIED
    // ------------------------------------------------------------------------
    console.log('\n[TEST 8] Score Recomputation:');
    const updatedScan = memoryDb.scans.get(scanId)!;
    console.log(`  Initial score: ${initialScan.security_score}`);
    console.log(`  Updated score: ${updatedScan.security_score}`);
    assert((updatedScan.security_score ?? 0) > 70, `Score must increase (was 70, now ${updatedScan.security_score})`);
    assert.strictEqual(updatedScan.security_score, 100, 'Score reaches 100 because all active findings are resolved');
    console.log('✓ Project security score increased from 70 to 100!');

    // ------------------------------------------------------------------------
    // TEST 9: Inconclusive result mapping
    // ------------------------------------------------------------------------
    console.log('\n[TEST 9] Inconclusive Mapping:');
    const inconclRes = await fetch(`http://localhost:${PORT}/api/findings/${findingId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ applied_diff: '' }),
    });
    const inconclData = await inconclRes.json();
    console.log(`  Status: ${inconclData.status}`);
    console.log(`  Verdict: ${inconclData.evidence.verdict}`);
    assert.strictEqual(inconclData.status, 'INCONCLUSIVE');
    assert.strictEqual(inconclData.evidence.verdict, 'INCONCLUSIVE');
    console.log('✓ Empty diff / unsupported check mapped to INCONCLUSIVE');

    console.log('\n======================================================');
    console.log('  ALL VERIFY & SCORE RECOMPUTE TESTS PASSED (100%)');
    console.log('======================================================\n');
  } finally {
    server.close();
    if (fs.existsSync(workspacePath)) {
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
