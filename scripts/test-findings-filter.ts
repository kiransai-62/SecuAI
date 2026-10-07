import express from 'express';
import { memoryDb } from '../apps/api/src/db/supabase.js';
import router from '../apps/api/src/routes.js';
import jwt from 'jsonwebtoken';
import { config } from '../apps/api/src/config.js';

async function main() {
  const app = express();
  app.use(express.json());
  app.use('/api', router);

  const server = app.listen(4996);
  const userA = { id: 'test-user-filter-a', email: 'userA@secuai.dev' };
  const tokenA = jwt.sign(
    { sub: userA.id, email: userA.email, role: 'authenticated' },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  const scanId = 'scan-filter-test-01';
  const projectId = 'proj-filter-test-01';

  // Seed scan
  memoryDb.scans.set(scanId, {
    id: scanId,
    project_id: projectId,
    user_id: userA.id,
    status: 'COMPLETED',
    progress_step: 'Done',
    scan_mode: 'code_only',
    target_type: 'demo',
    target_path: './test',
    findings_count: 3,
    critical_count: 1,
    high_count: 1,
    medium_count: 1,
    low_count: 0,
    security_score: 53,
    scan_duration_seconds: 2,
    created_at: new Date().toISOString(),
  });

  // Seed findings
  memoryDb.findings.set('f1', {
    id: 'f1',
    scan_id: scanId,
    project_id: projectId,
    user_id: userA.id,
    fingerprint: 'fp-crit-open',
    title: 'Critical RLS Issue',
    category: 'rls_misconfiguration',
    severity: 'CRITICAL',
    confidence: 0.9,
    source: 'SAST',
    file_path: 'migrations/001.sql',
    line_start: 10,
    line_end: 20,
    endpoint: null,
    evidence: {},
    description: 'Test crit',
    status: 'OPEN',
    created_at: new Date().toISOString(),
  });

  memoryDb.findings.set('f2', {
    id: 'f2',
    scan_id: scanId,
    project_id: projectId,
    user_id: userA.id,
    fingerprint: 'fp-high-verified',
    title: 'High Auth Weakness',
    category: 'auth_weakness',
    severity: 'HIGH',
    confidence: 0.85,
    source: 'SAST',
    file_path: 'api/route.ts',
    line_start: 5,
    line_end: 15,
    endpoint: '/api/test',
    evidence: {},
    description: 'Test high',
    status: 'VERIFIED',
    created_at: new Date().toISOString(),
  });

  memoryDb.findings.set('f3', {
    id: 'f3',
    scan_id: scanId,
    project_id: projectId,
    user_id: userA.id,
    fingerprint: 'fp-med-open',
    title: 'Medium Config Warning',
    category: 'config',
    severity: 'MEDIUM',
    confidence: 0.7,
    source: 'SAST',
    file_path: 'config.ts',
    line_start: 1,
    line_end: 5,
    endpoint: null,
    evidence: {},
    description: 'Test med',
    status: 'OPEN',
    created_at: new Date().toISOString(),
  });

  const baseUrl = 'http://localhost:4996/api';

  try {
    // 1. All findings (no filter)
    const resAll = await fetch(`${baseUrl}/scans/${scanId}/findings`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const dataAll = await resAll.json();
    console.log('Test All Findings count:', dataAll.findings.length);
    if (dataAll.findings.length !== 3) throw new Error('Expected 3 findings');

    // 2. Filter severity=CRITICAL
    const resCrit = await fetch(`${baseUrl}/scans/${scanId}/findings?severity=CRITICAL`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const dataCrit = await resCrit.json();
    console.log('Test severity=CRITICAL count:', dataCrit.findings.length);
    if (dataCrit.findings.length !== 1 || dataCrit.findings[0].severity !== 'CRITICAL') {
      throw new Error('Expected 1 CRITICAL finding');
    }

    // 3. Filter status=VERIFIED
    const resVer = await fetch(`${baseUrl}/scans/${scanId}/findings?status=VERIFIED`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const dataVer = await resVer.json();
    console.log('Test status=VERIFIED count:', dataVer.findings.length);
    if (dataVer.findings.length !== 1 || dataVer.findings[0].status !== 'VERIFIED') {
      throw new Error('Expected 1 VERIFIED finding');
    }

    // 4. Filter status=OPEN
    const resOpen = await fetch(`${baseUrl}/scans/${scanId}/findings?status=OPEN`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const dataOpen = await resOpen.json();
    console.log('Test status=OPEN count:', dataOpen.findings.length);
    if (dataOpen.findings.length !== 2) throw new Error('Expected 2 OPEN findings');

    // 5. Combined filter: severity=CRITICAL&status=OPEN
    const resBoth = await fetch(`${baseUrl}/scans/${scanId}/findings?severity=CRITICAL&status=OPEN`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const dataBoth = await resBoth.json();
    console.log('Test severity=CRITICAL&status=OPEN count:', dataBoth.findings.length);
    if (dataBoth.findings.length !== 1) throw new Error('Expected 1 match for combined filter');

    console.log('✔ All findings filter tests passed!');
  } finally {
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
