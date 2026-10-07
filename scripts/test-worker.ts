import http from 'http';
import os from 'os';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import yazl from 'yazl';
import app from '../apps/api/src/server.js';
import { config } from '../apps/api/src/config.js';
import { memoryDb } from '../apps/api/src/db/supabase.js';
import {
  pollAndProcessNextScan,
  resetStaleScans,
  cleanupExpiredWorkspaces,
  sanitizeErrorMessage,
  computeSecurityScore,
  WORKSPACE_BASE_DIR,
} from '../apps/api/src/worker.js';

process.env.NODE_ENV = 'test';

const TEST_PORT = 4996;
let server: http.Server;

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const testResults: TestResult[] = [];

function assert(condition: boolean, name: string, message: string) {
  if (!condition) {
    testResults.push({ name, passed: false, message: `FAILED: ${message}` });
    throw new Error(`[Worker Test Failure] ${name}: ${message}`);
  }
  testResults.push({ name, passed: true, message });
}

function createToken(sub: string, email: string): string {
  return jwt.sign(
    { sub, email, role: 'authenticated', aud: 'authenticated' },
    config.jwtSecret,
    { expiresIn: 3600 }
  );
}

const USER_A_ID = 'aaaa1111-aaaa-1111-aaaa-1111aaaa1111';
const tokenA = createToken(USER_A_ID, 'user_a@secuai.dev');

function zipDirectory(dir: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const zipfile = new yazl.ZipFile();
    const chunks: Buffer[] = [];

    function addDir(current: string, relative: string) {
      const items = fs.readdirSync(current);
      for (const item of items) {
        const full = path.join(current, item);
        const rel = relative ? `${relative}/${item}` : item;
        const st = fs.statSync(full);
        if (st.isDirectory()) {
          addDir(full, rel);
        } else {
          zipfile.addFile(full, rel);
        }
      }
    }

    addDir(dir, '');
    zipfile.end();
    zipfile.outputStream.on('data', (c) => chunks.push(c));
    zipfile.outputStream.on('end', () => resolve(Buffer.concat(chunks)));
    zipfile.outputStream.on('error', reject);
  });
}

async function uploadMultipart(
  pathUrl: string,
  token: string,
  fieldName: string,
  fileName: string,
  fileBuffer: Buffer
): Promise<{ status: number; body: any }> {
  const boundary = `----SecuAIBoundary${Date.now()}`;
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\nContent-Type: application/zip\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;

  const payload = Buffer.concat([
    Buffer.from(header, 'utf8'),
    fileBuffer,
    Buffer.from(footer, 'utf8'),
  ]);

  return new Promise((resolve, reject) => {
    const req = http.request(
      `http://localhost:${TEST_PORT}${pathUrl}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': payload.length.toString(),
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
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
    req.write(payload);
    req.end();
  });
}

async function requestJson(
  pathUrl: string,
  token: string,
  method: string = 'GET',
  body?: any
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const req = http.request(
      `http://localhost:${TEST_PORT}${pathUrl}`,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData).toString() } : {}),
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
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

async function runWorkerSuite() {
  console.log('======================================================================');
  console.log('⚙️  SecuAI Worker Acceptance & Regression Test Suite');
  console.log('======================================================================\n');

  // Start HTTP server
  await new Promise<void>((resolve) => {
    server = app.listen(TEST_PORT, () => {
      console.log(`✔ API server listening on http://localhost:${TEST_PORT}\n`);
      resolve();
    });
  });

  try {
    // --------------------------------------------------------------------------
    // Test 1: Setup Project
    // --------------------------------------------------------------------------
    console.log('--- Phase 1: Create Test Project ---');
    const createProjectRes = await requestJson('/api/projects', tokenA, 'POST', {
      name: 'Vulnerable Demo Microservice',
      source_type: 'ZIP',
    });
    assert(createProjectRes.status === 201, 'Create Project', `Status ${createProjectRes.status}`);
    const project = createProjectRes.body.project;
    console.log(`✔ Project created: ${project.id} ("${project.name}")\n`);

    // --------------------------------------------------------------------------
    // Test 2: Upload demo ZIP -> Scan reaches COMPLETED with findings
    // --------------------------------------------------------------------------
    console.log('--- Phase 2: Upload Demo ZIP & Process Scan ---');
    const demoDir = path.resolve('demo-vulnerable-app');
    assert(fs.existsSync(demoDir), 'Demo App Exists', `Path: ${demoDir}`);

    const demoZipBuffer = await zipDirectory(demoDir);
    console.log(`✔ Demo app zipped: ${demoZipBuffer.length} bytes`);

    const uploadRes = await uploadMultipart(
      `/api/projects/${project.id}/scans`,
      tokenA,
      'file',
      'demo-app.zip',
      demoZipBuffer
    );
    assert(uploadRes.status === 201, 'Upload ZIP', `Expected 201, got ${uploadRes.status}`);
    const scanId = uploadRes.body.scan.id;
    console.log(`✔ Scan enqueued with status QUEUED: ${scanId}`);

    // Process job with worker
    const processed = await pollAndProcessNextScan();
    assert(processed === true, 'Worker Processed Job', 'Expected worker to claim and process 1 job');

    // Query scan via GET /api/scans/:id
    const scanRes = await requestJson(`/api/scans/${scanId}`, tokenA, 'GET');
    assert(scanRes.status === 200, 'GET /api/scans/:id Status 200', `Status ${scanRes.status}`);

    const { scan, status, progress_step, score, counts } = scanRes.body;
    assert(status === 'COMPLETED', 'Scan Status COMPLETED', `Expected COMPLETED, got ${status}`);
    assert(progress_step === 'Done', 'Progress Step Done', `Expected Done, got ${progress_step}`);
    assert(typeof score === 'number' && score >= 0 && score <= 100, 'Valid Security Score', `Score: ${score}`);
    assert(Boolean(counts), 'Counts Object Present', 'Counts must be returned');
    assert(counts.total > 0, 'Findings Discovered', `Expected >0 findings, got ${counts.total}`);
    assert(counts.critical >= 1 || counts.high >= 1, 'Critical or High Discovered', `Critical: ${counts.critical}, High: ${counts.high}`);

    console.log(`✔ Scan ${scanId} successfully COMPLETED!`);
    console.log(`  - Status: ${status}`);
    console.log(`  - Progress Step: ${progress_step}`);
    console.log(`  - Security Score: ${score}/100`);
    console.log(`  - Counts: Critical=${counts.critical}, High=${counts.high}, Medium=${counts.medium}, Low=${counts.low}, Total=${counts.total}\n`);

    // Verify temp workspace kept on scan record for apply-fix/verify
    assert(Boolean(scan.workspace_path), 'Workspace Path Set', 'workspace_path must be saved on scan');
    assert(fs.existsSync(scan.workspace_path), 'Workspace Directory Kept', `Workspace must exist for verify: ${scan.workspace_path}`);
    console.log(`✔ Workspace directory preserved for apply-fix/verify: ${scan.workspace_path}\n`);

    // Verify findings stored in database
    const scanFindings = Array.from(memoryDb.findings.values()).filter((f) => f.scan_id === scanId);
    assert(scanFindings.length > 0, 'Database Findings Present', `Found ${scanFindings.length} findings`);
    assert(
      scanFindings.every((f) => f.user_id === USER_A_ID && f.project_id === project.id),
      'Findings Tenant Integrity',
      'All findings must match user_id and project_id'
    );
    assert(
      scanFindings.every((f) => f.status === 'OPEN'),
      'First Scan Findings Status OPEN',
      'Findings in initial scan must default to OPEN'
    );
    console.log(`✔ Verified ${scanFindings.length} findings stored in DB with status OPEN and correct user/project IDs.\n`);

    // --------------------------------------------------------------------------
    // Test 3: Regression Detection
    // If a fingerprint was VERIFIED in the previous scan and appears again -> status REGRESSED
    // --------------------------------------------------------------------------
    console.log('--- Phase 3: Regression Detection (VERIFIED -> REGRESSED) ---');
    // Pick the first finding and mark it as VERIFIED
    const targetFinding = scanFindings[0];
    targetFinding.status = 'VERIFIED';
    console.log(`✔ Simulated patch verification: marked finding [${targetFinding.fingerprint.slice(0, 10)}] as VERIFIED.`);

    // Enqueue second scan for the same project
    const secondUploadRes = await uploadMultipart(
      `/api/projects/${project.id}/scans`,
      tokenA,
      'file',
      'demo-app-rescan.zip',
      demoZipBuffer
    );
    assert(secondUploadRes.status === 201, 'Second Scan Enqueued', `Status ${secondUploadRes.status}`);
    const secondScanId = secondUploadRes.body.scan.id;

    // Process second scan with worker
    const secondProcessed = await pollAndProcessNextScan();
    assert(secondProcessed === true, 'Worker Processed Second Scan', 'Expected second scan to be processed');

    // Inspect findings of second scan
    const secondScanFindings = Array.from(memoryDb.findings.values()).filter((f) => f.scan_id === secondScanId);
    const regressedFinding = secondScanFindings.find((f) => f.fingerprint === targetFinding.fingerprint);

    assert(Boolean(regressedFinding), 'Target Fingerprint Re-detected', 'Re-detected same fingerprint in second scan');
    assert(
      regressedFinding!.status === 'REGRESSED',
      'Status Set to REGRESSED',
      `CRITICAL RULE: Re-detected finding with previous VERIFIED status must be REGRESSED, got "${regressedFinding!.status}"`
    );

    // Other findings should remain OPEN
    const nonTargetFindings = secondScanFindings.filter((f) => f.fingerprint !== targetFinding.fingerprint);
    assert(
      nonTargetFindings.every((f) => f.status === 'OPEN'),
      'Other Findings Remain OPEN',
      'Non-verified findings must remain OPEN'
    );

    console.log(`✔ Regression rule verified! Finding [${targetFinding.fingerprint.slice(0, 10)}] transitioned to REGRESSED.\n`);

    // --------------------------------------------------------------------------
    // Test 4: Kill Worker Mid-Scan -> Startup Recovers as FAILED (>15 min)
    // --------------------------------------------------------------------------
    console.log('--- Phase 4: Stale RUNNING Scan Recovery (Killed Worker Mid-Scan) ---');
    // Simulate a scan that was interrupted/killed 20 minutes ago
    const stuckScanId = crypto.randomUUID();
    const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();

    memoryDb.scans.set(stuckScanId, {
      id: stuckScanId,
      project_id: project.id,
      user_id: USER_A_ID,
      status: 'RUNNING',
      progress_step: 'Scanning',
      target_type: 'upload',
      target_path: 'uploads/dummy.zip',
      started_at: twentyMinsAgo,
      findings_count: 0,
      critical_count: 0,
      high_count: 0,
      medium_count: 0,
      low_count: 0,
      security_score: 100,
      created_at: twentyMinsAgo,
    });

    // Simulate worker restarting and executing startup recovery
    const recoveredCount = await resetStaleScans(15 * 60 * 1000);
    assert(recoveredCount >= 1, 'Stale Scan Recovered', `Expected ≥1 recovered scan, got ${recoveredCount}`);

    const stuckScanRecord = memoryDb.scans.get(stuckScanId);
    assert(
      stuckScanRecord?.status === 'FAILED',
      'Stuck Scan Marked FAILED',
      `Expected status FAILED, got ${stuckScanRecord?.status}`
    );
    assert(
      Boolean(stuckScanRecord?.error),
      'Error Message Present',
      `Expected error explanation, got "${stuckScanRecord?.error}"`
    );
    assert(
      Boolean(stuckScanRecord?.error?.includes('15 minute')),
      'Timeout Error Explanatory',
      `Error: ${stuckScanRecord?.error}`
    );

    console.log(`✔ Startup recovery verified: stuck RUNNING scan (>15m) recovered as FAILED: "${stuckScanRecord?.error}"\n`);

    // --------------------------------------------------------------------------
    // Test 5: Safe Error Message Sanitization (No Paths, No Stack Traces)
    // --------------------------------------------------------------------------
    console.log('--- Phase 5: Error Message Sanitization ---');
    const dirtyError = new Error(
      `Failed to compile C:\\Users\\Administrator\\AppData\\Local\\Temp\\secuai-workspaces\\secret\\index.ts: file corrupted\n    at Compiler.run (C:\\Users\\admin\\app.ts:42:15)\n    at Object.eval (eval:1:2)`
    );
    const sanitized = sanitizeErrorMessage(dirtyError);
    assert(!sanitized.includes('C:\\'), 'No Windows Paths', 'Must not contain C:\\ paths');
    assert(!sanitized.includes('at Compiler'), 'No Stack Traces', 'Must not contain stack lines');
    assert(sanitized.includes('[workspace]'), 'Path Replaced with Safe Placeholder', `Sanitized: "${sanitized}"`);
    console.log(`✔ Error message sanitized safely: "${sanitized}"\n`);

    // --------------------------------------------------------------------------
    // Test 6: 24h TTL Workspace Cleanup
    // --------------------------------------------------------------------------
    console.log('--- Phase 6: TTL Workspace Cleanup ---');
    // Create dummy expired directory in WORKSPACE_BASE_DIR
    const expiredDir = path.join(WORKSPACE_BASE_DIR, 'expired-workspace-test');
    if (!fs.existsSync(expiredDir)) {
      fs.mkdirSync(expiredDir, { recursive: true });
    }
    fs.writeFileSync(path.join(expiredDir, 'test.txt'), 'old data');

    // Backdate mtime to 25 hours ago
    const pastTime = (Date.now() - 25 * 60 * 60 * 1000) / 1000;
    fs.utimesSync(expiredDir, pastTime, pastTime);

    const cleanedWorkspaces = await cleanupExpiredWorkspaces(24 * 60 * 60 * 1000);
    assert(cleanedWorkspaces >= 1, 'Cleaned Expired Workspaces', `Cleaned: ${cleanedWorkspaces}`);
    assert(!fs.existsSync(expiredDir), 'Expired Workspace Removed', 'Directory must be deleted');
    console.log(`✔ 24h TTL workspace cleanup verified! Removed expired workspace.\n`);

    console.log('======================================================================');
    console.log('🎉 ALL WORKER ACCEPTANCE & REGRESSION CRITERIA PASSED!');
    console.log('======================================================================\n');
  } finally {
    server.close();
    process.exit(0);
  }
}

runWorkerSuite().catch((err) => {
  console.error('\n❌ Worker Test Suite Failed:', err.message);
  if (server) server.close();
  process.exit(1);
});

