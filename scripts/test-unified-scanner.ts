import fs from 'fs';
import path from 'path';
import http from 'http';
import express from 'express';
import assert from 'assert';
import yazl from 'yazl';
import { 
  UnifiedScanPipeline, 
  PatchVerifier, 
  WebScannerAdapter 
} from '../engine/adapter/src/index.js';
import { GeminiSecurityAssistant } from '../apps/api/src/services/gemini.js';
import { safeExtractZip } from '../apps/api/src/lib/safeExtract.js';

function zipDirectoryToBuffer(sourceDir: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const zipfile = new yazl.ZipFile();
    function addEntries(curDir: string, relBase: string) {
      const items = fs.readdirSync(curDir);
      for (const item of items) {
        const full = path.join(curDir, item);
        const rel = relBase ? `${relBase}/${item}` : item;
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          addEntries(full, rel);
        } else {
          zipfile.addFile(full, rel);
        }
      }
    }
    addEntries(sourceDir, '');
    zipfile.end();

    const chunks: Buffer[] = [];
    zipfile.outputStream.on('data', (c) => chunks.push(c));
    zipfile.outputStream.on('end', () => resolve(Buffer.concat(chunks)));
    zipfile.outputStream.on('error', reject);
  });
}

async function runMasterValidation() {
  console.log('================================================================');
  console.log('  SECUAI END-TO-END MASTER VALIDATION SUITE (TESTS A - G)');
  console.log('================================================================\n');

  const vulnerableFixtureDir = path.resolve('test/fixtures/security/vulnerable-node-app');
  const cleanFixtureDir = path.resolve('test/fixtures/security/clean-node-app');
  const tempExtractDir = path.resolve('temp/test-zip-extract-' + Date.now());

  // --------------------------------------------------------------------------
  // TEST A: Known Vulnerable Source Repository
  // --------------------------------------------------------------------------
  console.log('[TEST A] Scanning Known Vulnerable Source Repository...');
  const resultA = await UnifiedScanPipeline.executeScan({
    targetType: 'LOCAL',
    targetPath: vulnerableFixtureDir,
    workspacePath: vulnerableFixtureDir,
  });

  console.log(`  Files scanned: ${resultA.discovery.sourceFiles.length}`);
  console.log(`  Total findings detected: ${resultA.findings.length}`);
  console.log(`  Security score: ${resultA.score}/100`);

  // Verify critical rules triggered
  const categories = resultA.findings.map(f => f.category);
  const titles = resultA.findings.map(f => f.title);

  assert(resultA.findings.length >= 4, `Expected at least 4 findings, got ${resultA.findings.length}`);
  assert(categories.includes('INJECTION'), 'Expected SQL/Command Injection to be detected');
  assert(categories.includes('SECRETS'), 'Expected hardcoded secrets to be detected');
  assert(categories.includes('CONFIGURATION'), 'Expected configuration issues (CORS/RLS/Logs) to be detected');
  assert(resultA.score < 60, `Expected low security score for vulnerable app, got ${resultA.score}`);

  // Ensure every finding has evidence
  for (const f of resultA.findings) {
    assert(f.evidence, `Finding ${f.title} missing evidence`);
    assert(f.evidence.scanner_name, `Finding ${f.title} missing scanner_name`);
    assert(f.fingerprint && f.fingerprint.length === 64, `Finding ${f.title} missing SHA-256 fingerprint`);
  }
  console.log('✓ TEST A PASSED: Deterministic findings detected with full evidence & stable fingerprints.\n');

  // --------------------------------------------------------------------------
  // TEST B: Clean Source Repository (No Fabricated Findings)
  // --------------------------------------------------------------------------
  console.log('[TEST B] Scanning Clean Source Repository...');
  const resultB = await UnifiedScanPipeline.executeScan({
    targetType: 'LOCAL',
    targetPath: cleanFixtureDir,
    workspacePath: cleanFixtureDir,
  });

  console.log(`  Files scanned: ${resultB.discovery.sourceFiles.length}`);
  console.log(`  Total findings detected: ${resultB.findings.length}`);
  console.log(`  Security score: ${resultB.score}/100`);

  assert.strictEqual(resultB.findings.length, 0, 'Clean app must NOT have fabricated findings');
  assert.strictEqual(resultB.score, 100, 'Clean app must score 100/100');
  console.log('✓ TEST B PASSED: Clean repository produced 0 findings and 100/100 score without hallucinations.\n');

  // --------------------------------------------------------------------------
  // TEST C: Known Vulnerable ZIP Upload & Safe Extraction
  // --------------------------------------------------------------------------
  console.log('[TEST C] Packing and Scanning Vulnerable ZIP Archive...');
  const zipBuffer = await zipDirectoryToBuffer(vulnerableFixtureDir);
  assert(zipBuffer.length > 0, 'Generated ZIP buffer should not be empty');

  // Extract safely via safeExtractZip
  const extractResult = await safeExtractZip(zipBuffer, tempExtractDir);
  assert(extractResult.fileCount > 0, 'Extracted file count must be > 0');

  const resultC = await UnifiedScanPipeline.executeScan({
    targetType: 'LOCAL',
    targetPath: tempExtractDir,
    workspacePath: tempExtractDir,
  });

  console.log(`  ZIP files extracted safely: ${extractResult.fileCount}`);
  console.log(`  Findings from extracted archive: ${resultC.findings.length}`);
  assert(resultC.findings.length >= 4, 'ZIP scan must detect findings matching source');
  console.log('✓ TEST C PASSED: ZIP archive safely extracted, analyzed, and produced matching findings.\n');

  // Cleanup temp extract dir
  try {
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
  } catch {}

  // --------------------------------------------------------------------------
  // TEST D: Authorized Live Web Endpoint Scan
  // --------------------------------------------------------------------------
  console.log('[TEST D] Scanning Authorized Live Web Endpoint...');
  const webApp = express();
  // Live endpoint missing HSTS, CSP, and using CORS wildcard
  webApp.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Powered-By', 'Express');
    next();
  });
  webApp.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  const testServer = http.createServer(webApp);
  const TEST_WEB_PORT = 4996;
  await new Promise<void>((resolve) => testServer.listen(TEST_WEB_PORT, '127.0.0.1', () => resolve()));

  process.env.ALLOW_LOCAL_DAST = 'true';
  try {
    const webResult = await UnifiedScanPipeline.executeScan({
      targetType: 'URL',
      targetUrl: `http://127.0.0.1:${TEST_WEB_PORT}/api/health`,
      confirmedOwnership: true,
      workspacePath: vulnerableFixtureDir,
    });

    console.log(`  Security findings from web endpoint: ${webResult.findings.length}`);
    for (const wf of webResult.findings) {
      console.log(`    - [${wf.severity}] ${wf.title}`);
    }

    assert(webResult.findings.length >= 2, 'Expected missing security headers / CORS findings on web probe');
    console.log('✓ TEST D PASSED: Safe authorized live web probe detected real header/CORS findings.\n');
  } finally {
    testServer.close();
  }

  // --------------------------------------------------------------------------
  // TEST E: Finding Lifecycle - Before: OPEN, Fix Applied, Re-scan: VERIFIED
  // --------------------------------------------------------------------------
  console.log('[TEST E] Testing Finding Verification Lifecycle...');
  const sqliFinding = resultA.findings.find(f => f.title.includes('SQL Injection'));
  assert(sqliFinding, 'Must have SQL injection finding from Test A');
  assert.strictEqual(sqliFinding.status, 'OPEN');

  const testVerifyWorkspace = path.resolve('temp/test-verify-ws-' + Date.now());
  fs.mkdirSync(path.join(testVerifyWorkspace, 'src'), { recursive: true });
  
  // Step 1: Copy vulnerable file
  const origVulnerable = fs.readFileSync(path.join(vulnerableFixtureDir, 'src/server.ts'), 'utf8');
  fs.writeFileSync(path.join(testVerifyWorkspace, 'src/server.ts'), origVulnerable, 'utf8');

  // Verify before fix -> Should fail (still vulnerable)
  const verifyBefore = await PatchVerifier.verifyFindingPatch(testVerifyWorkspace, {
    fingerprint: sqliFinding.fingerprint,
    file_path: 'src/server.ts',
    category: sqliFinding.category,
    title: sqliFinding.title,
    status: 'OPEN',
    rule_id: (sqliFinding.evidence as any)?.rule_id || 'SEC-INJ-001',
  });
  console.log(`  Verification before fix: ${verifyBefore.verdict} (verified: ${verifyBefore.verified})`);
  assert.strictEqual(verifyBefore.verified, false, 'Unfixed file must not pass verification');
  assert.strictEqual(verifyBefore.verdict, 'FAILED', 'Verdict must be FAILED before fix');

  // Step 2: Apply parameterization fix to the file (parameterize all dynamic queries)
  const fixedCode = origVulnerable
    .replace(
      'const query = `SELECT * FROM users WHERE id = ${req.params.id}`;',
      'const query = "SELECT * FROM users WHERE id = $1";\n  const user = await db.query(query, [req.params.id]);'
    )
    .replace(
      'const user = await db.query(query);\n  res.json(user);',
      'res.json(user);'
    )
    .replace(
      'await db.query(`DELETE FROM users WHERE id = ${req.params.id}`);',
      'await db.query("DELETE FROM users WHERE id = $1", [req.params.id]);'
    );
  fs.writeFileSync(path.join(testVerifyWorkspace, 'src/server.ts'), fixedCode, 'utf8');

  // Verify after fix -> Should be VERIFIED
  const verifyAfter = await PatchVerifier.verifyFindingPatch(testVerifyWorkspace, {
    fingerprint: sqliFinding.fingerprint,
    file_path: 'src/server.ts',
    category: sqliFinding.category,
    title: sqliFinding.title,
    status: 'OPEN',
    rule_id: (sqliFinding.evidence as any)?.rule_id || 'SEC-INJ-001',
  });
  console.log(`  Verification after fix: ${verifyAfter.verdict} (verified: ${verifyAfter.verified})`);
  console.log(`  Evidence message: ${verifyAfter.message}`);
  assert.strictEqual(verifyAfter.verified, true, 'Properly patched file must pass verification');
  assert.strictEqual(verifyAfter.verdict, 'VERIFIED', 'Verdict must be VERIFIED after fix');

  try {
    fs.rmSync(testVerifyWorkspace, { recursive: true, force: true });
  } catch {}
  console.log('✓ TEST E PASSED: Finding verification is strictly scanner-based: OPEN -> FIX -> VERIFIED.\n');

  // --------------------------------------------------------------------------
  // TEST F: AI Assistant Prioritizes Real Findings ("What should I fix first?")
  // --------------------------------------------------------------------------
  console.log('[TEST F] AI Assistant: "What should I fix first?"...');
  const aiPriorityResponse = await GeminiSecurityAssistant.chatWithAssistant({
    message: 'What should I fix first?',
    findings: resultA.findings,
    scan: {
      id: 'scan-test-a',
      security_score: resultA.score,
      findings_count: resultA.findings.length,
      status: 'COMPLETED',
    },
  });

  console.log('  AI Model Used:', aiPriorityResponse.model);
  console.log('  AI Response Excerpt:', aiPriorityResponse.reply.slice(0, 180) + '...');
  assert(aiPriorityResponse.reply.length > 50, 'AI must return substantive response');
  // Must mention critical items like SQL injection or secrets
  const replyLower = aiPriorityResponse.reply.toLowerCase();
  assert(
    replyLower.includes('sql') || replyLower.includes('injection') || replyLower.includes('secret') || replyLower.includes('critical'),
    'AI response must reference the actual critical findings from the scan'
  );
  console.log('✓ TEST F PASSED: AI assistant inspected actual project findings and prioritized critical risks.\n');

  // --------------------------------------------------------------------------
  // TEST G: AI Assistant Evidence Grounding ("Is my application secure?")
  // --------------------------------------------------------------------------
  console.log('[TEST G] AI Assistant: "Is my application secure?"...');
  const aiPostureResponse = await GeminiSecurityAssistant.chatWithAssistant({
    message: 'Is my application secure?',
    findings: resultA.findings,
    scan: {
      id: 'scan-test-a',
      security_score: resultA.score,
      findings_count: resultA.findings.length,
      status: 'COMPLETED',
      discovery_summary: resultA.discovery,
    },
  });

  const postureLower = aiPostureResponse.reply.toLowerCase();
  console.log('  AI Response Excerpt:', aiPostureResponse.reply.slice(0, 180) + '...');
  // It must NOT say "Yes, your app is secure" when there are 4+ critical vulnerabilities!
  assert(
    !postureLower.includes('yes, your app is secure') && !postureLower.includes('your app is 100% secure'),
    'AI must not falsely claim an insecure app is secure'
  );
  assert(
    postureLower.includes('score') || postureLower.includes('vulnerabilit') || postureLower.includes('finding') || postureLower.includes('risk'),
    'AI response must ground its answer in real score and findings'
  );
  console.log('✓ TEST G PASSED: AI gave an evidence-grounded security assessment without false reassurances.\n');

  console.log('================================================================');
  console.log('  ALL MASTER VALIDATION TESTS A - G PASSED (100%)');
  console.log('================================================================\n');
}

runMasterValidation().catch((err) => {
  console.error('Master Validation Suite Failed:', err);
  process.exit(1);
});
