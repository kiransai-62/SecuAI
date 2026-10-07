import http from 'http';
import assert from 'assert';
import jwt from 'jsonwebtoken';
import app from '../apps/api/src/server.js';
import { config } from '../apps/api/src/config.js';
import { memoryDb } from '../apps/api/src/db/supabase.js';
import { pollAndProcessNextScan } from '../apps/api/src/worker.js';

process.env.NODE_ENV = 'test';

const PORT = 4988;
const USER_ID = 'aaaa1111-aaaa-1111-aaaa-1111aaaa1111';
const token = jwt.sign(
  { sub: USER_ID, email: 'user@secuai.dev', role: 'authenticated', aud: 'authenticated' },
  config.jwtSecret,
  { expiresIn: 3600 }
);

async function runTests() {
  console.log('--- STARTING GITHUB URL SCAN PIPELINE TEST ---');
  const server = app.listen(PORT);

  try {
    // 1. Create a project with GitHub source type
    const projId = 'proj-github-test-' + Date.now();
    memoryDb.projects.set(projId, {
      id: projId,
      user_id: USER_ID,
      name: 'GitHub Pipeline Test Project',
      description: 'End-to-end pipeline test via GitHub clone',
      source_type: 'GITHUB',
      repository_url: 'https://github.com/secuai/demo-app',
      repo_url: 'https://github.com/secuai/demo-app',
      framework: 'Next.js 15 / Supabase',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 2. Reject invalid GitHub URL
    console.log('\n[TEST 1] Invalid GitHub URL format rejection:');
    const invalidRes = await fetch(`http://localhost:${PORT}/api/projects/${projId}/scans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ repository_url: 'https://gitlab.com/attacker/malicious-repo' }),
    });
    assert.strictEqual(invalidRes.status, 400);
    const invalidData = await invalidRes.json();
    assert(invalidData.error.includes('https://github.com'));
    console.log('✓ Invalid repository URL rejected with 400');

    // 3. Enqueue valid GitHub scan
    console.log('\n[TEST 2] Enqueue GitHub scan via POST /api/projects/:id/scans:');
    const enqueueRes = await fetch(`http://localhost:${PORT}/api/projects/${projId}/scans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ repository_url: 'https://github.com/secuai/demo-app' }),
    });
    assert.strictEqual(enqueueRes.status, 201);
    const enqueueData = await enqueueRes.json();
    const scanId = enqueueData.scan.id;
    assert.strictEqual(enqueueData.scan.status, 'QUEUED');
    assert.strictEqual(enqueueData.scan.target_type, 'repo');
    console.log(`✓ GitHub scan enqueued with ID: ${scanId}`);

    // 4. Background Worker processes the GitHub scan through the full pipeline
    console.log('\n[TEST 3] Worker processes GitHub scan through all pipeline steps:');
    const processed = await pollAndProcessNextScan();
    assert.strictEqual(processed, true, 'Worker claimed and executed the scan');

    // 5. Verify completed scan status, security score, and findings
    console.log('\n[TEST 4] Verify completed scan record & metrics:');
    const completedScan = memoryDb.scans.get(scanId)!;
    assert.strictEqual(completedScan.status, 'COMPLETED');
    assert(completedScan.progress_step === 'Done' || completedScan.progress_step === 'Completed', 'Progress step is Done/Completed');
    assert((completedScan.findings_count ?? 0) > 0, 'Scan produced findings');
    console.log(`✓ Scan status: ${completedScan.status}`);
    console.log(`✓ Findings count: ${completedScan.findings_count}`);
    console.log(`✓ Security score: ${completedScan.security_score}`);

    // 6. Verify findings query endpoint
    console.log('\n[TEST 5] GET /api/scans/:id/findings returns detected vulnerabilities:');
    const findingsRes = await fetch(`http://localhost:${PORT}/api/scans/${scanId}/findings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(findingsRes.status, 200);
    const findingsData = await findingsRes.json();
    assert(findingsData.findings.length > 0, 'Findings returned for GitHub scan');
    console.log(`✓ Retrieved ${findingsData.findings.length} findings for GitHub scan`);

    console.log('\n======================================================');
    console.log('  ALL GITHUB SCAN PIPELINE TESTS PASSED (100%)');
    console.log('======================================================\n');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
