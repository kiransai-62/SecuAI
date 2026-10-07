import fs from 'fs';
import path from 'path';
import express from 'express';
import jwt from 'jsonwebtoken';
import { memoryDb } from '../apps/api/src/db/supabase.js';
import router from '../apps/api/src/routes.js';
import { config } from '../apps/api/src/config.js';
import { WORKSPACE_BASE_DIR } from '../apps/api/src/worker.js';
import { initWorkspaceGit, validateGitDiff, applyGitDiff } from '../apps/api/src/lib/gitWorkspace.js';

async function runTests() {
  console.log('--- STARTING GENERATE-FIX & APPLY-FIX INTEGRATION TESTS ---');

  const app = express();
  app.use(express.json());
  app.use('/api', router);

  const PORT = 4994;
  const server = app.listen(PORT);

  const userA = { id: 'user-fix-a', email: 'userA@secuai.dev' };
  const userB = { id: 'user-fix-b', email: 'userB@secuai.dev' };

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

  const scanId = 'scan-fix-test-01';
  const projectId = 'proj-fix-test-01';
  const findingId = 'finding-fix-01';
  const fingerprint = 'fp-fix-test-12345';
  const targetRelFile = 'supabase/migrations/002_transactions.sql';

  const workspacePath = path.join(WORKSPACE_BASE_DIR, scanId);

  // Setup initial workspace with baseline code
  if (fs.existsSync(workspacePath)) {
    fs.rmSync(workspacePath, { recursive: true, force: true });
  }
  fs.mkdirSync(path.join(workspacePath, 'supabase/migrations'), { recursive: true });

  const initialCode = 'CREATE TABLE public.transactions (\n  id uuid PRIMARY KEY,\n  amount int\n);\n';
  fs.writeFileSync(path.join(workspacePath, targetRelFile), initialCode, 'utf-8');

  // Initialize git repo in workspace at extract time
  initWorkspaceGit(workspacePath);

  // Seed memoryDb
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
    critical_count: 1,
    high_count: 0,
    medium_count: 0,
    low_count: 0,
    security_score: 75,
    scan_duration_seconds: 2,
    created_at: new Date().toISOString(),
  });

  memoryDb.findings.set(findingId, {
    id: findingId,
    scan_id: scanId,
    project_id: projectId,
    user_id: userA.id,
    fingerprint,
    title: 'PostgreSQL Table Missing Row Level Security',
    category: 'rls_misconfiguration',
    severity: 'CRITICAL',
    confidence: 0.95,
    source: 'isitsecure',
    file_path: targetRelFile,
    line_start: 1,
    line_end: 4,
    endpoint: null,
    evidence: {
      scanner_name: 'isitsecure_ast',
      code_snippet: initialCode,
    },
    description: 'Table public.transactions lacks ENABLE ROW LEVEL SECURITY',
    status: 'OPEN',
    created_at: new Date().toISOString(),
  });

  try {
    // Test 1: Workspace Git Initialization Verification
    console.log('\n[TEST 1] Workspace Git Initialization:');
    const gitDirExists = fs.existsSync(path.join(workspacePath, '.git'));
    if (!gitDirExists) {
      throw new Error('Workspace git repository was not initialized!');
    }
    console.log('✓ Workspace git repo initialized with baseline commit.');

    // Test 2: Cross-Tenant Isolation (User B cannot call generate-fix on User A finding)
    console.log('\n[TEST 2] Tenant Isolation on generate-fix:');
    const resB = await fetch(`http://localhost:${PORT}/api/findings/${findingId}/generate-fix`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenB}`,
        'Content-Type': 'application/json',
      },
    });
    if (resB.status !== 404) {
      throw new Error(`Expected 404 for User B, got ${resB.status}`);
    }
    console.log('✓ Cross-tenant isolation verified: User B gets 404 on User A finding.');

    // Test 3: POST /api/findings/:id/generate-fix (Valid Patch Generation & Validation)
    console.log('\n[TEST 3] POST /api/findings/:id/generate-fix:');
    const genRes = await fetch(`http://localhost:${PORT}/api/findings/${findingId}/generate-fix`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
    });
    if (!genRes.ok) {
      const err = await genRes.text();
      throw new Error(`Generate-fix failed (${genRes.status}): ${err}`);
    }
    const genData = await genRes.json();
    console.log('  Success:', genData.success);
    console.log('  Status:', genData.status);
    console.log('  Diff:\n' + genData.diff);

    if (!genData.success || !genData.diff) {
      throw new Error('Expected successful diff generation');
    }
    if (genData.status !== 'FIX_PROPOSED') {
      throw new Error(`Expected status FIX_PROPOSED, got ${genData.status}`);
    }

    // Verify finding status updated in database/memoryDb
    const findingRecord = memoryDb.findings.get(findingId);
    if (findingRecord?.status !== 'FIX_PROPOSED') {
      throw new Error(`Finding status in store is ${findingRecord?.status}, expected FIX_PROPOSED`);
    }

    // Verify saved to ai_analysis.proposed_fix
    const analysisRecord = memoryDb.ai_analysis.get(`${fingerprint}:${config.geminiModel}`);
    if (!analysisRecord?.proposed_fix) {
      throw new Error('Patch was not saved to ai_analysis.proposed_fix');
    }
    console.log('✓ Status updated to FIX_PROPOSED and saved to ai_analysis.proposed_fix.');

    // Test 4: Verify generated diff passes git apply --check in workspace
    console.log('\n[TEST 4] Validate generated diff with git apply --check:');
    const checkResult = validateGitDiff(workspacePath, genData.diff);
    if (!checkResult.valid) {
      throw new Error(`Generated diff failed git apply --check: ${checkResult.error}`);
    }
    console.log('✓ Diff verified cleanly with git apply --check.');

    // Test 5: Rejection of Malformed / Invalid Diff
    console.log('\n[TEST 5] Invalid Diff Rejection:');
    const corruptDiff = `--- a/${targetRelFile}\n+++ b/${targetRelFile}\n@@ -99,10 +99,10 @@\n-NON_EXISTENT_CONTENT_12345\n+REPLACEMENT_CODE\n`;
    const corruptCheck = validateGitDiff(workspacePath, corruptDiff);
    if (corruptCheck.valid) {
      throw new Error('Expected invalid diff to fail git apply --check, but it passed!');
    }
    console.log(`✓ Invalid diff rejected cleanly by git apply --check: ${corruptCheck.error}`);

    // Test 6: POST /api/findings/:id/apply-fix with invalid diff fails
    console.log('\n[TEST 6] POST /api/findings/:id/apply-fix with invalid diff:');
    const invalidApplyRes = await fetch(`http://localhost:${PORT}/api/findings/${findingId}/apply-fix`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ diff: corruptDiff }),
    });
    if (invalidApplyRes.status !== 400) {
      throw new Error(`Expected 400 for corrupt patch apply, got ${invalidApplyRes.status}`);
    }
    const invalidApplyData = await invalidApplyRes.json();
    console.log(`✓ Applying invalid diff rejected: ${invalidApplyData.error}`);

    // Test 7: POST /api/findings/:id/apply-fix (Valid Patch Application)
    console.log('\n[TEST 7] POST /api/findings/:id/apply-fix:');
    const applyRes = await fetch(`http://localhost:${PORT}/api/findings/${findingId}/apply-fix`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ diff: genData.diff }),
    });
    if (!applyRes.ok) {
      const err = await applyRes.text();
      throw new Error(`Apply-fix failed (${applyRes.status}): ${err}`);
    }
    const applyData = await applyRes.json();
    console.log('  Success:', applyData.success);
    console.log('  Status:', applyData.status);
    console.log('  Message:', applyData.message);

    if (!applyData.success || applyData.status !== 'FIX_APPLIED') {
      throw new Error(`Expected status FIX_APPLIED, got ${applyData.status}`);
    }

    // Verify file content in workspace was modified
    const modifiedFileContent = fs.readFileSync(path.join(workspacePath, targetRelFile), 'utf-8');
    if (!modifiedFileContent.includes('ROW LEVEL SECURITY')) {
      throw new Error('Workspace file was not updated by git apply!');
    }
    console.log('✓ Patch applied to workspace file directly:');
    console.log(modifiedFileContent.trim());

    // Verify status updated in database/memoryDb
    const updatedFinding = memoryDb.findings.get(findingId);
    if (updatedFinding?.status !== 'FIX_APPLIED') {
      throw new Error(`Finding status in store is ${updatedFinding?.status}, expected FIX_APPLIED`);
    }
    console.log('✓ Finding status successfully updated to FIX_APPLIED.');

    console.log('\n======================================================');
    console.log('  ALL GENERATE-FIX & APPLY-FIX TESTS PASSED (100%)');
    console.log('======================================================\n');
  } finally {
    server.close();
    // Cleanup test workspace
    try {
      if (fs.existsSync(workspacePath)) {
        fs.rmSync(workspacePath, { recursive: true, force: true });
      }
    } catch {}
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
