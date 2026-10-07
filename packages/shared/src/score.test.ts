import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSecurityScore,
  computeSecurityScore,
  getScoreLabel,
  recomputeScan,
  ScorableFinding,
} from './score.js';

describe('SecuAI Security Score Engine (packages/shared/score.ts)', () => {
  // ============================================================================
  // TEST SUITE 1: Clamp at 0
  // ============================================================================
  describe('Clamp at 0', () => {
    test('Clean project with 0 findings returns perfect 100 score', () => {
      const result = calculateSecurityScore([]);
      assert.equal(result.score, 100);
      assert.equal(result.label, 'Excellent');
      assert.equal(result.totalPenalty, 0);
    });

    test('Penalties exceeding 100 clamp cleanly at 0, never negative', () => {
      // 5 different categories, each with 2 CRITICAL findings (capped at 50 each)
      // Total raw penalty = 5 * 50 = 250
      const findings: ScorableFinding[] = [
        { severity: 'CRITICAL', category: 'cat1', status: 'OPEN' },
        { severity: 'CRITICAL', category: 'cat1', status: 'OPEN' },
        { severity: 'CRITICAL', category: 'cat2', status: 'OPEN' },
        { severity: 'CRITICAL', category: 'cat2', status: 'OPEN' },
        { severity: 'CRITICAL', category: 'cat3', status: 'OPEN' },
        { severity: 'CRITICAL', category: 'cat3', status: 'OPEN' },
        { severity: 'CRITICAL', category: 'cat4', status: 'OPEN' },
        { severity: 'CRITICAL', category: 'cat4', status: 'OPEN' },
        { severity: 'CRITICAL', category: 'cat5', status: 'OPEN' },
        { severity: 'CRITICAL', category: 'cat5', status: 'OPEN' },
      ];

      const result = calculateSecurityScore(findings);
      assert.equal(result.totalPenalty, 250);
      assert.equal(result.score, 0, 'Score must be clamped at 0');
      assert.equal(result.label, 'At risk');
    });

    test('Penalty exactly equal to 100 yields score 0', () => {
      // 2 categories with 2 CRITICAL findings each = 50 + 50 = 100 penalty
      const findings: ScorableFinding[] = [
        { severity: 'CRITICAL', category: 'cat_a', status: 'OPEN' },
        { severity: 'CRITICAL', category: 'cat_a', status: 'OPEN' },
        { severity: 'CRITICAL', category: 'cat_b', status: 'OPEN' },
        { severity: 'CRITICAL', category: 'cat_b', status: 'OPEN' },
      ];

      const result = calculateSecurityScore(findings);
      assert.equal(result.totalPenalty, 100);
      assert.equal(result.score, 0);
      assert.equal(result.label, 'At risk');
    });
  });

  // ============================================================================
  // TEST SUITE 2: Category Cap (Cap total penalty per category at 2× that severity)
  // ============================================================================
  describe('Category Cap', () => {
    test('CRITICAL (25 pts): 1 finding = 25, 2 findings = 50, 3+ findings capped at 50', () => {
      // 1 CRITICAL: 25 pts
      assert.equal(
        calculateSecurityScore([{ severity: 'CRITICAL', category: 'rls', status: 'OPEN' }]).score,
        75
      );

      // 2 CRITICAL: 50 pts
      assert.equal(
        calculateSecurityScore([
          { severity: 'CRITICAL', category: 'rls', status: 'OPEN' },
          { severity: 'CRITICAL', category: 'rls', status: 'OPEN' },
        ]).score,
        50
      );

      // 3 CRITICAL: Capped at 2 * 25 = 50 (score 50 instead of 25)
      const res3 = calculateSecurityScore([
        { severity: 'CRITICAL', category: 'rls', status: 'OPEN' },
        { severity: 'CRITICAL', category: 'rls', status: 'OPEN' },
        { severity: 'CRITICAL', category: 'rls', status: 'OPEN' },
      ]);
      assert.equal(res3.categoryPenalties['rls'], 50);
      assert.equal(res3.score, 50);

      // 10 CRITICAL in same category: still capped at 50
      const res10 = calculateSecurityScore(
        Array(10).fill({ severity: 'CRITICAL', category: 'rls', status: 'OPEN' })
      );
      assert.equal(res10.categoryPenalties['rls'], 50);
      assert.equal(res10.score, 50);
    });

    test('HIGH (15 pts): 3 findings in same category capped at 30 (not 45)', () => {
      const findings: ScorableFinding[] = [
        { severity: 'HIGH', category: 'sql_injection', status: 'OPEN' },
        { severity: 'HIGH', category: 'sql_injection', status: 'OPEN' },
        { severity: 'HIGH', category: 'sql_injection', status: 'OPEN' },
      ];
      const result = calculateSecurityScore(findings);
      assert.equal(result.categoryPenalties['sql_injection'], 30);
      assert.equal(result.score, 70); // 100 - 30 = 70
    });

    test('MEDIUM (7 pts): 3 findings in same category capped at 14 (not 21)', () => {
      const findings: ScorableFinding[] = [
        { severity: 'MEDIUM', category: 'crypto_weakness', status: 'OPEN' },
        { severity: 'MEDIUM', category: 'crypto_weakness', status: 'OPEN' },
        { severity: 'MEDIUM', category: 'crypto_weakness', status: 'OPEN' },
      ];
      const result = calculateSecurityScore(findings);
      assert.equal(result.categoryPenalties['crypto_weakness'], 14);
      assert.equal(result.score, 86); // 100 - 14 = 86
    });

    test('LOW (2 pts): 5 findings in same category capped at 4 (not 10)', () => {
      const findings: ScorableFinding[] = [
        { severity: 'LOW', category: 'security_headers', status: 'OPEN' },
        { severity: 'LOW', category: 'security_headers', status: 'OPEN' },
        { severity: 'LOW', category: 'security_headers', status: 'OPEN' },
        { severity: 'LOW', category: 'security_headers', status: 'OPEN' },
        { severity: 'LOW', category: 'security_headers', status: 'OPEN' },
      ];
      const result = calculateSecurityScore(findings);
      assert.equal(result.categoryPenalties['security_headers'], 4);
      assert.equal(result.score, 96); // 100 - 4 = 96
    });

    test('INFO (0 pts): Any number of INFO findings results in 0 penalty', () => {
      const findings: ScorableFinding[] = Array(5).fill({
        severity: 'INFO',
        category: 'docs',
        status: 'OPEN',
      });
      const result = calculateSecurityScore(findings);
      assert.equal(result.totalPenalty, 0);
      assert.equal(result.score, 100);
    });

    test('Independent categories are capped separately', () => {
      const findings: ScorableFinding[] = [
        // Category A: 3 CRITICAL -> capped at 50
        { severity: 'CRITICAL', category: 'auth', status: 'OPEN' },
        { severity: 'CRITICAL', category: 'auth', status: 'OPEN' },
        { severity: 'CRITICAL', category: 'auth', status: 'OPEN' },
        // Category B: 3 HIGH -> capped at 30
        { severity: 'HIGH', category: 'injection', status: 'OPEN' },
        { severity: 'HIGH', category: 'injection', status: 'OPEN' },
        { severity: 'HIGH', category: 'injection', status: 'OPEN' },
      ];
      const result = calculateSecurityScore(findings);
      assert.equal(result.categoryPenalties['auth'], 50);
      assert.equal(result.categoryPenalties['injection'], 30);
      assert.equal(result.totalPenalty, 80);
      assert.equal(result.score, 20); // 100 - 80 = 20
    });
  });

  // ============================================================================
  // TEST SUITE 3: Excluded Statuses (VERIFIED, ACCEPTED_RISK, FALSE_POSITIVE)
  // ============================================================================
  describe('Excluded Statuses', () => {
    test('VERIFIED findings are excluded from penalty', () => {
      const findings: ScorableFinding[] = [
        { severity: 'CRITICAL', category: 'rls', status: 'VERIFIED' },
        { severity: 'HIGH', category: 'sql', status: 'VERIFIED' },
      ];
      const result = calculateSecurityScore(findings);
      assert.equal(result.totalPenalty, 0);
      assert.equal(result.score, 100);
      assert.equal(result.excludedCount, 2);
    });

    test('ACCEPTED_RISK and FALSE_POSITIVE findings are excluded from penalty', () => {
      const findings: ScorableFinding[] = [
        { severity: 'CRITICAL', category: 'infra', status: 'ACCEPTED_RISK' },
        { severity: 'HIGH', category: 'tokens', status: 'FALSE_POSITIVE' },
      ];
      const result = calculateSecurityScore(findings);
      assert.equal(result.totalPenalty, 0);
      assert.equal(result.score, 100);
      assert.equal(result.excludedCount, 2);
    });

    test('Active statuses (OPEN, FIX_PROPOSED, FIX_APPLIED, REGRESSED, INCONCLUSIVE) are penalized', () => {
      const activeStatuses = ['OPEN', 'FIX_PROPOSED', 'FIX_APPLIED', 'REGRESSED', 'INCONCLUSIVE'];

      for (const st of activeStatuses) {
        const result = calculateSecurityScore([
          { severity: 'HIGH', category: `cat_${st}`, status: st },
        ]);
        assert.equal(result.score, 85, `Status ${st} must be penalized with 15 pts`);
      }
    });

    test('Mixed active and excluded findings computes exact delta', () => {
      const findings: ScorableFinding[] = [
        { severity: 'CRITICAL', category: 'cat1', status: 'VERIFIED' }, // 0 pts
        { severity: 'HIGH', category: 'cat2', status: 'ACCEPTED_RISK' }, // 0 pts
        { severity: 'MEDIUM', category: 'cat3', status: 'FALSE_POSITIVE' }, // 0 pts
        { severity: 'MEDIUM', category: 'cat4', status: 'OPEN' }, // 7 pts
        { severity: 'LOW', category: 'cat5', status: 'FIX_APPLIED' }, // 2 pts
      ];
      const result = calculateSecurityScore(findings);
      assert.equal(result.totalPenalty, 9); // 7 + 2 = 9
      assert.equal(result.score, 91); // 100 - 9 = 91
      assert.equal(result.label, 'Excellent');
      assert.equal(result.activeCount, 2);
      assert.equal(result.excludedCount, 3);
    });
  });

  // ============================================================================
  // TEST SUITE 4: Label Boundaries (≥90 Excellent, 75–89 Good, 50–74 Needs work, <50 At risk)
  // ============================================================================
  describe('Label Boundaries', () => {
    test('Boundary 1: ≥90 -> Excellent', () => {
      assert.equal(getScoreLabel(100), 'Excellent');
      assert.equal(getScoreLabel(95), 'Excellent');
      assert.equal(getScoreLabel(90), 'Excellent');
    });

    test('Boundary 2: 75–89 -> Good', () => {
      assert.equal(getScoreLabel(89), 'Good');
      assert.equal(getScoreLabel(82), 'Good');
      assert.equal(getScoreLabel(75), 'Good');
    });

    test('Boundary 3: 50–74 -> Needs work', () => {
      assert.equal(getScoreLabel(74), 'Needs work');
      assert.equal(getScoreLabel(65), 'Needs work');
      assert.equal(getScoreLabel(50), 'Needs work');
    });

    test('Boundary 4: <50 -> At risk', () => {
      assert.equal(getScoreLabel(49), 'At risk');
      assert.equal(getScoreLabel(25), 'At risk');
      assert.equal(getScoreLabel(0), 'At risk');
    });
  });

  // ============================================================================
  // TEST SUITE 5: recomputeScan(scanId)
  // ============================================================================
  describe('recomputeScan', () => {
    test('recomputeScan updates scan security_score and counts', async () => {
      const scanRecord: Record<string, any> = {
        id: 'scan-123',
        security_score: 100,
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        findings_count: 0,
      };

      const findings: ScorableFinding[] = [
        { severity: 'CRITICAL', category: 'rls', status: 'OPEN' },
        { severity: 'HIGH', category: 'sql', status: 'OPEN' },
      ];

      const res = await recomputeScan('scan-123', {
        findings,
        scanRecord,
      });

      assert.equal(res.score, 60); // 100 - (25 + 15) = 60
      assert.equal(res.label, 'Needs work');
      assert.equal(scanRecord.security_score, 60);
      assert.equal(scanRecord.critical_count, 1);
      assert.equal(scanRecord.high_count, 1);
      assert.equal(scanRecord.findings_count, 2);
    });

    test('recomputeScan restores score when finding is updated to VERIFIED', async () => {
      const scanRecord: Record<string, any> = {
        id: 'scan-456',
        security_score: 60,
      };

      // Initially 1 CRITICAL and 1 HIGH
      const findings: ScorableFinding[] = [
        { severity: 'CRITICAL', category: 'rls', status: 'OPEN' },
        { severity: 'HIGH', category: 'sql', status: 'OPEN' },
      ];

      await recomputeScan('scan-456', { findings, scanRecord });
      assert.equal(scanRecord.security_score, 60);

      // Verify the CRITICAL finding
      findings[0].status = 'VERIFIED';

      const resAfterVerify = await recomputeScan('scan-456', { findings, scanRecord });
      assert.equal(scanRecord.security_score, 85); // 100 - 15 = 85
      assert.equal(resAfterVerify.label, 'Good');
      assert.equal(scanRecord.critical_count, 0);
      assert.equal(scanRecord.high_count, 1);
    });
  });
});
