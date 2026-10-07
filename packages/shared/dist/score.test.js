"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const score_js_1 = require("./score.js");
(0, node_test_1.describe)('SecuAI Security Score Engine (packages/shared/score.ts)', () => {
    // ============================================================================
    // TEST SUITE 1: Clamp at 0
    // ============================================================================
    (0, node_test_1.describe)('Clamp at 0', () => {
        (0, node_test_1.test)('Clean project with 0 findings returns perfect 100 score', () => {
            const result = (0, score_js_1.calculateSecurityScore)([]);
            strict_1.default.equal(result.score, 100);
            strict_1.default.equal(result.label, 'Excellent');
            strict_1.default.equal(result.totalPenalty, 0);
        });
        (0, node_test_1.test)('Penalties exceeding 100 clamp cleanly at 0, never negative', () => {
            // 5 different categories, each with 2 CRITICAL findings (capped at 50 each)
            // Total raw penalty = 5 * 50 = 250
            const findings = [
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
            const result = (0, score_js_1.calculateSecurityScore)(findings);
            strict_1.default.equal(result.totalPenalty, 250);
            strict_1.default.equal(result.score, 0, 'Score must be clamped at 0');
            strict_1.default.equal(result.label, 'At risk');
        });
        (0, node_test_1.test)('Penalty exactly equal to 100 yields score 0', () => {
            // 2 categories with 2 CRITICAL findings each = 50 + 50 = 100 penalty
            const findings = [
                { severity: 'CRITICAL', category: 'cat_a', status: 'OPEN' },
                { severity: 'CRITICAL', category: 'cat_a', status: 'OPEN' },
                { severity: 'CRITICAL', category: 'cat_b', status: 'OPEN' },
                { severity: 'CRITICAL', category: 'cat_b', status: 'OPEN' },
            ];
            const result = (0, score_js_1.calculateSecurityScore)(findings);
            strict_1.default.equal(result.totalPenalty, 100);
            strict_1.default.equal(result.score, 0);
            strict_1.default.equal(result.label, 'At risk');
        });
    });
    // ============================================================================
    // TEST SUITE 2: Category Cap (Cap total penalty per category at 2× that severity)
    // ============================================================================
    (0, node_test_1.describe)('Category Cap', () => {
        (0, node_test_1.test)('CRITICAL (25 pts): 1 finding = 25, 2 findings = 50, 3+ findings capped at 50', () => {
            // 1 CRITICAL: 25 pts
            strict_1.default.equal((0, score_js_1.calculateSecurityScore)([{ severity: 'CRITICAL', category: 'rls', status: 'OPEN' }]).score, 75);
            // 2 CRITICAL: 50 pts
            strict_1.default.equal((0, score_js_1.calculateSecurityScore)([
                { severity: 'CRITICAL', category: 'rls', status: 'OPEN' },
                { severity: 'CRITICAL', category: 'rls', status: 'OPEN' },
            ]).score, 50);
            // 3 CRITICAL: Capped at 2 * 25 = 50 (score 50 instead of 25)
            const res3 = (0, score_js_1.calculateSecurityScore)([
                { severity: 'CRITICAL', category: 'rls', status: 'OPEN' },
                { severity: 'CRITICAL', category: 'rls', status: 'OPEN' },
                { severity: 'CRITICAL', category: 'rls', status: 'OPEN' },
            ]);
            strict_1.default.equal(res3.categoryPenalties['rls'], 50);
            strict_1.default.equal(res3.score, 50);
            // 10 CRITICAL in same category: still capped at 50
            const res10 = (0, score_js_1.calculateSecurityScore)(Array(10).fill({ severity: 'CRITICAL', category: 'rls', status: 'OPEN' }));
            strict_1.default.equal(res10.categoryPenalties['rls'], 50);
            strict_1.default.equal(res10.score, 50);
        });
        (0, node_test_1.test)('HIGH (15 pts): 3 findings in same category capped at 30 (not 45)', () => {
            const findings = [
                { severity: 'HIGH', category: 'sql_injection', status: 'OPEN' },
                { severity: 'HIGH', category: 'sql_injection', status: 'OPEN' },
                { severity: 'HIGH', category: 'sql_injection', status: 'OPEN' },
            ];
            const result = (0, score_js_1.calculateSecurityScore)(findings);
            strict_1.default.equal(result.categoryPenalties['sql_injection'], 30);
            strict_1.default.equal(result.score, 70); // 100 - 30 = 70
        });
        (0, node_test_1.test)('MEDIUM (7 pts): 3 findings in same category capped at 14 (not 21)', () => {
            const findings = [
                { severity: 'MEDIUM', category: 'crypto_weakness', status: 'OPEN' },
                { severity: 'MEDIUM', category: 'crypto_weakness', status: 'OPEN' },
                { severity: 'MEDIUM', category: 'crypto_weakness', status: 'OPEN' },
            ];
            const result = (0, score_js_1.calculateSecurityScore)(findings);
            strict_1.default.equal(result.categoryPenalties['crypto_weakness'], 14);
            strict_1.default.equal(result.score, 86); // 100 - 14 = 86
        });
        (0, node_test_1.test)('LOW (2 pts): 5 findings in same category capped at 4 (not 10)', () => {
            const findings = [
                { severity: 'LOW', category: 'security_headers', status: 'OPEN' },
                { severity: 'LOW', category: 'security_headers', status: 'OPEN' },
                { severity: 'LOW', category: 'security_headers', status: 'OPEN' },
                { severity: 'LOW', category: 'security_headers', status: 'OPEN' },
                { severity: 'LOW', category: 'security_headers', status: 'OPEN' },
            ];
            const result = (0, score_js_1.calculateSecurityScore)(findings);
            strict_1.default.equal(result.categoryPenalties['security_headers'], 4);
            strict_1.default.equal(result.score, 96); // 100 - 4 = 96
        });
        (0, node_test_1.test)('INFO (0 pts): Any number of INFO findings results in 0 penalty', () => {
            const findings = Array(5).fill({
                severity: 'INFO',
                category: 'docs',
                status: 'OPEN',
            });
            const result = (0, score_js_1.calculateSecurityScore)(findings);
            strict_1.default.equal(result.totalPenalty, 0);
            strict_1.default.equal(result.score, 100);
        });
        (0, node_test_1.test)('Independent categories are capped separately', () => {
            const findings = [
                // Category A: 3 CRITICAL -> capped at 50
                { severity: 'CRITICAL', category: 'auth', status: 'OPEN' },
                { severity: 'CRITICAL', category: 'auth', status: 'OPEN' },
                { severity: 'CRITICAL', category: 'auth', status: 'OPEN' },
                // Category B: 3 HIGH -> capped at 30
                { severity: 'HIGH', category: 'injection', status: 'OPEN' },
                { severity: 'HIGH', category: 'injection', status: 'OPEN' },
                { severity: 'HIGH', category: 'injection', status: 'OPEN' },
            ];
            const result = (0, score_js_1.calculateSecurityScore)(findings);
            strict_1.default.equal(result.categoryPenalties['auth'], 50);
            strict_1.default.equal(result.categoryPenalties['injection'], 30);
            strict_1.default.equal(result.totalPenalty, 80);
            strict_1.default.equal(result.score, 20); // 100 - 80 = 20
        });
    });
    // ============================================================================
    // TEST SUITE 3: Excluded Statuses (VERIFIED, ACCEPTED_RISK, FALSE_POSITIVE)
    // ============================================================================
    (0, node_test_1.describe)('Excluded Statuses', () => {
        (0, node_test_1.test)('VERIFIED findings are excluded from penalty', () => {
            const findings = [
                { severity: 'CRITICAL', category: 'rls', status: 'VERIFIED' },
                { severity: 'HIGH', category: 'sql', status: 'VERIFIED' },
            ];
            const result = (0, score_js_1.calculateSecurityScore)(findings);
            strict_1.default.equal(result.totalPenalty, 0);
            strict_1.default.equal(result.score, 100);
            strict_1.default.equal(result.excludedCount, 2);
        });
        (0, node_test_1.test)('ACCEPTED_RISK and FALSE_POSITIVE findings are excluded from penalty', () => {
            const findings = [
                { severity: 'CRITICAL', category: 'infra', status: 'ACCEPTED_RISK' },
                { severity: 'HIGH', category: 'tokens', status: 'FALSE_POSITIVE' },
            ];
            const result = (0, score_js_1.calculateSecurityScore)(findings);
            strict_1.default.equal(result.totalPenalty, 0);
            strict_1.default.equal(result.score, 100);
            strict_1.default.equal(result.excludedCount, 2);
        });
        (0, node_test_1.test)('Active statuses (OPEN, FIX_PROPOSED, FIX_APPLIED, REGRESSED, INCONCLUSIVE) are penalized', () => {
            const activeStatuses = ['OPEN', 'FIX_PROPOSED', 'FIX_APPLIED', 'REGRESSED', 'INCONCLUSIVE'];
            for (const st of activeStatuses) {
                const result = (0, score_js_1.calculateSecurityScore)([
                    { severity: 'HIGH', category: `cat_${st}`, status: st },
                ]);
                strict_1.default.equal(result.score, 85, `Status ${st} must be penalized with 15 pts`);
            }
        });
        (0, node_test_1.test)('Mixed active and excluded findings computes exact delta', () => {
            const findings = [
                { severity: 'CRITICAL', category: 'cat1', status: 'VERIFIED' }, // 0 pts
                { severity: 'HIGH', category: 'cat2', status: 'ACCEPTED_RISK' }, // 0 pts
                { severity: 'MEDIUM', category: 'cat3', status: 'FALSE_POSITIVE' }, // 0 pts
                { severity: 'MEDIUM', category: 'cat4', status: 'OPEN' }, // 7 pts
                { severity: 'LOW', category: 'cat5', status: 'FIX_APPLIED' }, // 2 pts
            ];
            const result = (0, score_js_1.calculateSecurityScore)(findings);
            strict_1.default.equal(result.totalPenalty, 9); // 7 + 2 = 9
            strict_1.default.equal(result.score, 91); // 100 - 9 = 91
            strict_1.default.equal(result.label, 'Excellent');
            strict_1.default.equal(result.activeCount, 2);
            strict_1.default.equal(result.excludedCount, 3);
        });
    });
    // ============================================================================
    // TEST SUITE 4: Label Boundaries (≥90 Excellent, 75–89 Good, 50–74 Needs work, <50 At risk)
    // ============================================================================
    (0, node_test_1.describe)('Label Boundaries', () => {
        (0, node_test_1.test)('Boundary 1: ≥90 -> Excellent', () => {
            strict_1.default.equal((0, score_js_1.getScoreLabel)(100), 'Excellent');
            strict_1.default.equal((0, score_js_1.getScoreLabel)(95), 'Excellent');
            strict_1.default.equal((0, score_js_1.getScoreLabel)(90), 'Excellent');
        });
        (0, node_test_1.test)('Boundary 2: 75–89 -> Good', () => {
            strict_1.default.equal((0, score_js_1.getScoreLabel)(89), 'Good');
            strict_1.default.equal((0, score_js_1.getScoreLabel)(82), 'Good');
            strict_1.default.equal((0, score_js_1.getScoreLabel)(75), 'Good');
        });
        (0, node_test_1.test)('Boundary 3: 50–74 -> Needs work', () => {
            strict_1.default.equal((0, score_js_1.getScoreLabel)(74), 'Needs work');
            strict_1.default.equal((0, score_js_1.getScoreLabel)(65), 'Needs work');
            strict_1.default.equal((0, score_js_1.getScoreLabel)(50), 'Needs work');
        });
        (0, node_test_1.test)('Boundary 4: <50 -> At risk', () => {
            strict_1.default.equal((0, score_js_1.getScoreLabel)(49), 'At risk');
            strict_1.default.equal((0, score_js_1.getScoreLabel)(25), 'At risk');
            strict_1.default.equal((0, score_js_1.getScoreLabel)(0), 'At risk');
        });
    });
    // ============================================================================
    // TEST SUITE 5: recomputeScan(scanId)
    // ============================================================================
    (0, node_test_1.describe)('recomputeScan', () => {
        (0, node_test_1.test)('recomputeScan updates scan security_score and counts', async () => {
            const scanRecord = {
                id: 'scan-123',
                security_score: 100,
                critical_count: 0,
                high_count: 0,
                medium_count: 0,
                low_count: 0,
                findings_count: 0,
            };
            const findings = [
                { severity: 'CRITICAL', category: 'rls', status: 'OPEN' },
                { severity: 'HIGH', category: 'sql', status: 'OPEN' },
            ];
            const res = await (0, score_js_1.recomputeScan)('scan-123', {
                findings,
                scanRecord,
            });
            strict_1.default.equal(res.score, 60); // 100 - (25 + 15) = 60
            strict_1.default.equal(res.label, 'Needs work');
            strict_1.default.equal(scanRecord.security_score, 60);
            strict_1.default.equal(scanRecord.critical_count, 1);
            strict_1.default.equal(scanRecord.high_count, 1);
            strict_1.default.equal(scanRecord.findings_count, 2);
        });
        (0, node_test_1.test)('recomputeScan restores score when finding is updated to VERIFIED', async () => {
            const scanRecord = {
                id: 'scan-456',
                security_score: 60,
            };
            // Initially 1 CRITICAL and 1 HIGH
            const findings = [
                { severity: 'CRITICAL', category: 'rls', status: 'OPEN' },
                { severity: 'HIGH', category: 'sql', status: 'OPEN' },
            ];
            await (0, score_js_1.recomputeScan)('scan-456', { findings, scanRecord });
            strict_1.default.equal(scanRecord.security_score, 60);
            // Verify the CRITICAL finding
            findings[0].status = 'VERIFIED';
            const resAfterVerify = await (0, score_js_1.recomputeScan)('scan-456', { findings, scanRecord });
            strict_1.default.equal(scanRecord.security_score, 85); // 100 - 15 = 85
            strict_1.default.equal(resAfterVerify.label, 'Good');
            strict_1.default.equal(scanRecord.critical_count, 0);
            strict_1.default.equal(scanRecord.high_count, 1);
        });
    });
});
