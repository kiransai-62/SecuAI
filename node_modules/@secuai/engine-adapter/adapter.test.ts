import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { RawIsItSecureReport, FindingSchema } from '../../packages/shared/src/index.js';
import { 
  normalizeReport, 
  normalizeFinding, 
  computeStableFingerprint, 
  verifyFindingByFingerprintDiff,
  UNMAPPABLE_FIELDS 
} from './normalize.js';

describe('SecuAI Engine Adapter Test Suite', () => {
  const fixturePath = path.resolve('engine/adapter/__fixtures__/sample.json');

  test('Fixture exists and contains real isitsecure JSON report', () => {
    assert.ok(fs.existsSync(fixturePath), 'sample.json fixture must exist');
    const content = fs.readFileSync(fixturePath, 'utf8');
    const report: RawIsItSecureReport = JSON.parse(content);
    
    assert.ok(Array.isArray(report.findings), 'report.findings must be an array');
    assert.ok(report.findings.length > 0, 'report must contain at least 1 finding');
    assert.ok(Array.isArray(report.scanners_run), 'report.scanners_run must be an array');
  });

  test('Acceptance: Demo app yields ≥1 CRITICAL/HIGH finding and ≥1 access-control-type finding', () => {
    const rawReport: RawIsItSecureReport = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const result = normalizeReport(rawReport);

    console.log(`[Adapter Test] Total findings normalized: ${result.findings.length}`);
    console.log(`[Adapter Test] Critical findings: ${result.criticalCount}, High findings: ${result.highCount}`);
    console.log(`[Adapter Test] Access control findings: ${result.accessControlCount}`);

    // Criteria: ≥ 1 CRITICAL or HIGH finding
    assert.ok(
      result.criticalCount >= 1 || result.highCount >= 1,
      `Expected ≥1 CRITICAL or HIGH finding, got critical: ${result.criticalCount}, high: ${result.highCount}`
    );

    // Criteria: ≥ 1 access-control-type finding (e.g. RLS misconfiguration, auth weakness, IDOR)
    assert.ok(
      result.accessControlCount >= 1,
      `Expected ≥1 access-control-type finding, got ${result.accessControlCount}`
    );
  });

  test('Acceptance: Every normalized finding strictly conforms to Zod FindingSchema', () => {
    const rawReport: RawIsItSecureReport = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const result = normalizeReport(rawReport);

    for (const finding of result.findings) {
      // Must not throw Zod validation error
      const parsed = FindingSchema.parse(finding);
      assert.ok(parsed.fingerprint.length > 0);
      assert.ok(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].includes(parsed.severity));
      assert.ok(['SAST', 'DAST', 'SECRETS', 'DEPS'].includes(parsed.source));
      assert.ok(typeof parsed.evidence === 'object' && parsed.evidence !== null);
    }
  });

  test('Acceptance: Stable fingerprint does NOT depend on line numbers', () => {
    const raw = {
      id: 'test-1',
      source: 'sast_code',
      category: 'rls_misconfiguration',
      severity: 'critical',
      title: 'Table credits lacks RLS',
      description: 'RLS missing',
      technical_detail: '',
      evidence: '',
      confidence: 0.95,
      scanner_name: 'rls_policy_analyzer',
      impact: null,
      likelihood: null,
      priority: null,
      remediation_guidance: '',
      endpoint_url: null,
      http_method: null,
      request_payload: null,
      response_preview: null,
      code_location: {
        file_path: 'supabase\\migrations\\001_create_tables.sql',
        line_number: 14, // Line 14
        line_end: null,
        code_snippet: 'CREATE TABLE credits',
        github_url: '',
      },
      theme_id: '',
      probe_captures: [],
      related_finding_ids: [],
    };

    const findingAtLine14 = normalizeFinding(raw);

    // Simulate code shift: file edited, finding now at line 99
    const rawShifted = {
      ...raw,
      code_location: {
        ...raw.code_location,
        line_number: 99,
        line_end: 105,
      },
    };
    const findingAtLine99 = normalizeFinding(rawShifted);

    // Fingerprints MUST be identical
    assert.equal(
      findingAtLine14.fingerprint,
      findingAtLine99.fingerprint,
      'Fingerprint must remain identical regardless of line number changes'
    );
  });

  test('Acceptance: Reports unmappable fields from upstream engine', () => {
    const rawReport: RawIsItSecureReport = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const result = normalizeReport(rawReport);

    console.log('[Adapter Test] Unmappable fields reported:');
    console.log(result.unmappableFields);

    assert.ok(result.unmappableFields.length > 0, 'Must report unmappable fields');
    assert.ok(result.unmappableFields.includes('id'), 'Must report id as unmappable');
    assert.ok(result.unmappableFields.includes('theme_id'), 'Must report theme_id as unmappable');
    assert.ok(result.unmappableFields.includes('priority'), 'Must report priority as unmappable');
  });

  test('Acceptance: Fallback verification by fingerprint diff works when rule cannot be re-run in isolation', () => {
    const rawReport: RawIsItSecureReport = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const targetFingerprint = computeStableFingerprint(
      'rls_policy_analyzer',
      'supabase/migrations/001_create_tables.sql',
      'rls_misconfiguration'
    );

    // 1. When finding is still present in fresh report -> verify fails
    const failResult = verifyFindingByFingerprintDiff(targetFingerprint, rawReport);
    assert.equal(failResult.verified, false);

    // 2. When finding is eliminated in fresh report -> verify succeeds
    const filteredReport: RawIsItSecureReport = {
      ...rawReport,
      findings: rawReport.findings.filter(f => f.scanner_name !== 'rls_policy_analyzer'),
    };
    const passResult = verifyFindingByFingerprintDiff(targetFingerprint, filteredReport);
    assert.equal(passResult.verified, true);
    assert.ok(passResult.message.includes('no longer present'));
  });
});
