"use strict";
/**
 * SecuAI Deterministic Security Score Engine
 * Pure functional scoring and metrics computation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXCLUDED_FINDING_STATUSES = exports.ACTIVE_FINDING_STATUSES = exports.SEVERITY_PENALTIES = void 0;
exports.getScoreLabel = getScoreLabel;
exports.calculateSecurityScore = calculateSecurityScore;
exports.computeSecurityScore = computeSecurityScore;
exports.setMockScoreStores = setMockScoreStores;
exports.recomputeScan = recomputeScan;
/**
 * Penalty weights per severity:
 * CRITICAL 25, HIGH 15, MEDIUM 7, LOW 2, INFO 0
 */
exports.SEVERITY_PENALTIES = {
    CRITICAL: 25,
    HIGH: 15,
    MEDIUM: 7,
    LOW: 2,
    INFO: 0,
};
/**
 * Active statuses contributing to penalties
 */
exports.ACTIVE_FINDING_STATUSES = new Set([
    'OPEN',
    'FIX_PROPOSED',
    'FIX_APPLIED',
    'REGRESSED',
    'INCONCLUSIVE',
]);
/**
 * Excluded statuses contributing zero penalty
 */
exports.EXCLUDED_FINDING_STATUSES = new Set([
    'VERIFIED',
    'ACCEPTED_RISK',
    'FALSE_POSITIVE',
]);
/**
 * Map numerical security score to categorical label:
 * ≥90 Excellent, 75–89 Good, 50–74 Needs work, <50 At risk.
 */
function getScoreLabel(score) {
    if (score >= 90)
        return 'Excellent';
    if (score >= 75)
        return 'Good';
    if (score >= 50)
        return 'Needs work';
    return 'At risk';
}
/**
 * Pure function: Computes security score and metrics over a list of findings.
 *
 * Rules:
 * 1. score = max(0, 100 − Σ penalty)
 * 2. Only findings with status in OPEN, FIX_PROPOSED, FIX_APPLIED, REGRESSED, INCONCLUSIVE are penalized.
 * 3. VERIFIED, ACCEPTED_RISK, FALSE_POSITIVE are excluded.
 * 4. Penalties: CRITICAL 25, HIGH 15, MEDIUM 7, LOW 2, INFO 0.
 * 5. Cap total penalty per category at 2× that severity's single penalty.
 */
function calculateSecurityScore(findings) {
    const counts = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        total: 0,
    };
    let activeCount = 0;
    let excludedCount = 0;
    // Group active findings by category
    const categoryMap = new Map();
    for (const f of findings) {
        const rawStatus = (f.status || 'OPEN').trim().toUpperCase();
        const rawSev = (f.severity || '').trim().toUpperCase();
        if (exports.ACTIVE_FINDING_STATUSES.has(rawStatus)) {
            activeCount++;
            if (rawSev === 'CRITICAL')
                counts.critical++;
            else if (rawSev === 'HIGH')
                counts.high++;
            else if (rawSev === 'MEDIUM')
                counts.medium++;
            else if (rawSev === 'LOW')
                counts.low++;
            counts.total++;
            const categoryKey = (f.category || 'general').trim().toLowerCase();
            if (!categoryMap.has(categoryKey)) {
                categoryMap.set(categoryKey, []);
            }
            categoryMap.get(categoryKey).push(f);
        }
        else {
            excludedCount++;
        }
    }
    let totalPenalty = 0;
    const categoryPenalties = {};
    // Compute penalty per category, capped at 2× that severity's single penalty
    for (const [categoryKey, catFindings] of categoryMap.entries()) {
        let rawCategoryPenalty = 0;
        let maxSinglePenalty = 0;
        for (const f of catFindings) {
            const sev = (f.severity || '').trim().toUpperCase();
            const singlePenalty = exports.SEVERITY_PENALTIES[sev] ?? 0;
            rawCategoryPenalty += singlePenalty;
            if (singlePenalty > maxSinglePenalty) {
                maxSinglePenalty = singlePenalty;
            }
        }
        // Cap total penalty per category at 2× that severity's single penalty
        const categoryCap = 2 * maxSinglePenalty;
        const cappedCategoryPenalty = Math.min(rawCategoryPenalty, categoryCap);
        categoryPenalties[categoryKey] = cappedCategoryPenalty;
        totalPenalty += cappedCategoryPenalty;
    }
    // score = max(0, 100 - sum(penalty)), clamped between 0 and 100
    const score = Math.max(0, Math.min(100, 100 - totalPenalty));
    const label = getScoreLabel(score);
    return {
        score,
        label,
        totalPenalty,
        categoryPenalties,
        counts,
        activeCount,
        excludedCount,
    };
}
/**
 * Returns numeric score directly for quick usage
 */
function computeSecurityScore(findings) {
    return calculateSecurityScore(findings).score;
}
// In-memory decoupled store hooks for recomputeScan testing
let mockFindingsStore = new Map();
let mockScanStore = new Map();
function setMockScoreStores(findingsStore, scanStore) {
    mockFindingsStore = findingsStore;
    mockScanStore = scanStore;
}
/**
 * recomputeScan(scanId): Updates scans.security_score + counts.
 * Polymorphic: Can be called in tests with custom handlers/mocks or in production.
 */
async function recomputeScan(scanId, options) {
    let findings = [];
    if (options?.findings) {
        findings = options.findings;
    }
    else if (options?.fetchFindings) {
        findings = await options.fetchFindings(scanId);
    }
    else if (mockFindingsStore.has(scanId)) {
        findings = mockFindingsStore.get(scanId) || [];
    }
    const result = calculateSecurityScore(findings);
    const updates = {
        security_score: result.score,
        critical_count: result.counts.critical,
        high_count: result.counts.high,
        medium_count: result.counts.medium,
        low_count: result.counts.low,
        findings_count: result.counts.total,
    };
    if (options?.scanRecord) {
        Object.assign(options.scanRecord, updates);
    }
    else if (options?.updateScan) {
        await options.updateScan(scanId, updates);
    }
    else if (mockScanStore.has(scanId)) {
        const existing = mockScanStore.get(scanId);
        if (existing) {
            Object.assign(existing, updates);
        }
        else {
            mockScanStore.set(scanId, updates);
        }
    }
    return result;
}
