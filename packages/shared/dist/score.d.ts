/**
 * SecuAI Deterministic Security Score Engine
 * Pure functional scoring and metrics computation
 */
export type FindingStatus = 'OPEN' | 'FIX_PROPOSED' | 'FIX_APPLIED' | 'VERIFIED' | 'REGRESSED' | 'INCONCLUSIVE' | 'ACCEPTED_RISK' | 'FALSE_POSITIVE';
export type SecurityScoreLabel = 'Excellent' | 'Good' | 'Needs work' | 'At risk' | 'Production Ready' | 'Ship with Confidence' | 'Needs Review' | 'Security Gaps' | 'High Risk' | 'Critical Risk';
/**
 * Penalty weights per severity:
 * CRITICAL 25, HIGH 15, MEDIUM 7, LOW 2, INFO 0
 */
export declare const SEVERITY_PENALTIES: Record<string, number>;
/**
 * Active statuses contributing to penalties
 */
export declare const ACTIVE_FINDING_STATUSES: Set<string>;
/**
 * Excluded statuses contributing zero penalty
 */
export declare const EXCLUDED_FINDING_STATUSES: Set<string>;
export interface ScorableFinding {
    severity: string;
    category?: string | null;
    status?: string | null;
}
export interface ScoreCounts {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
}
export interface ScoreComputationResult {
    score: number;
    label: SecurityScoreLabel;
    totalPenalty: number;
    categoryPenalties: Record<string, number>;
    counts: ScoreCounts;
    activeCount: number;
    excludedCount: number;
}
/**
 * Map numerical security score to categorical label:
 * ≥90 Excellent, 75–89 Good, 50–74 Needs work, <50 At risk.
 */
export declare function getScoreLabel(score: number): SecurityScoreLabel;
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
export declare function calculateSecurityScore(findings: ScorableFinding[]): ScoreComputationResult;
/**
 * Returns numeric score directly for quick usage
 */
export declare function computeSecurityScore(findings: ScorableFinding[]): number;
/**
 * Scan update payload produced by recomputeScan
 */
export interface ScanScoreUpdates {
    security_score: number;
    critical_count: number;
    high_count: number;
    medium_count: number;
    low_count: number;
    findings_count: number;
}
export declare function setMockScoreStores(findingsStore: Map<string, ScorableFinding[]>, scanStore: Map<string, ScanScoreUpdates>): void;
/**
 * recomputeScan(scanId): Updates scans.security_score + counts.
 * Polymorphic: Can be called in tests with custom handlers/mocks or in production.
 */
export declare function recomputeScan(scanId: string, options?: {
    findings?: ScorableFinding[];
    scanRecord?: Record<string, any>;
    fetchFindings?: (scanId: string) => Promise<ScorableFinding[]> | ScorableFinding[];
    updateScan?: (scanId: string, updates: ScanScoreUpdates) => Promise<void> | void;
}): Promise<ScoreComputationResult>;
