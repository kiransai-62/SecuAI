/**
 * SecuAI Deterministic Security Score Engine
 * Pure functional scoring and metrics computation
 */

import { FindingSeverity } from './types.js';

export type FindingStatus =
  | 'OPEN'
  | 'FIX_PROPOSED'
  | 'FIX_APPLIED'
  | 'VERIFIED'
  | 'REGRESSED'
  | 'INCONCLUSIVE'
  | 'ACCEPTED_RISK'
  | 'FALSE_POSITIVE';

export type SecurityScoreLabel =
  | 'Excellent'
  | 'Good'
  | 'Needs work'
  | 'At risk'
  | 'Production Ready'
  | 'Ship with Confidence'
  | 'Needs Review'
  | 'Security Gaps'
  | 'High Risk'
  | 'Critical Risk';

/**
 * Penalty weights per severity:
 * CRITICAL 25, HIGH 15, MEDIUM 7, LOW 2, INFO 0
 */
export const SEVERITY_PENALTIES: Record<string, number> = {
  CRITICAL: 25,
  HIGH: 15,
  MEDIUM: 7,
  LOW: 2,
  INFO: 0,
};

/**
 * Active statuses contributing to penalties
 */
export const ACTIVE_FINDING_STATUSES = new Set<string>([
  'OPEN',
  'FIX_PROPOSED',
  'FIX_APPLIED',
  'REGRESSED',
  'INCONCLUSIVE',
]);

/**
 * Excluded statuses contributing zero penalty
 */
export const EXCLUDED_FINDING_STATUSES = new Set<string>([
  'VERIFIED',
  'ACCEPTED_RISK',
  'FALSE_POSITIVE',
]);

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
export function getScoreLabel(score: number): SecurityScoreLabel {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Needs work';
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
export function calculateSecurityScore(findings: ScorableFinding[]): ScoreComputationResult {
  const counts: ScoreCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    total: 0,
  };

  let activeCount = 0;
  let excludedCount = 0;

  // Group active findings by category
  const categoryMap = new Map<string, ScorableFinding[]>();

  for (const f of findings) {
    const rawStatus = (f.status || 'OPEN').trim().toUpperCase();
    const rawSev = (f.severity || '').trim().toUpperCase();

    if (ACTIVE_FINDING_STATUSES.has(rawStatus)) {
      activeCount++;
      if (rawSev === 'CRITICAL') counts.critical++;
      else if (rawSev === 'HIGH') counts.high++;
      else if (rawSev === 'MEDIUM') counts.medium++;
      else if (rawSev === 'LOW') counts.low++;
      counts.total++;

      const categoryKey = (f.category || 'general').trim().toLowerCase();
      if (!categoryMap.has(categoryKey)) {
        categoryMap.set(categoryKey, []);
      }
      categoryMap.get(categoryKey)!.push(f);
    } else {
      excludedCount++;
    }
  }

  let totalPenalty = 0;
  const categoryPenalties: Record<string, number> = {};

  // Compute penalty per category, capped at 2× that severity's single penalty
  for (const [categoryKey, catFindings] of categoryMap.entries()) {
    let rawCategoryPenalty = 0;
    let maxSinglePenalty = 0;

    for (const f of catFindings) {
      const sev = (f.severity || '').trim().toUpperCase();
      const singlePenalty = SEVERITY_PENALTIES[sev] ?? 0;
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
export function computeSecurityScore(findings: ScorableFinding[]): number {
  return calculateSecurityScore(findings).score;
}

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

// In-memory decoupled store hooks for recomputeScan testing
let mockFindingsStore: Map<string, ScorableFinding[]> = new Map();
let mockScanStore: Map<string, ScanScoreUpdates> = new Map();

export function setMockScoreStores(
  findingsStore: Map<string, ScorableFinding[]>,
  scanStore: Map<string, ScanScoreUpdates>
) {
  mockFindingsStore = findingsStore;
  mockScanStore = scanStore;
}

/**
 * recomputeScan(scanId): Updates scans.security_score + counts.
 * Polymorphic: Can be called in tests with custom handlers/mocks or in production.
 */
export async function recomputeScan(
  scanId: string,
  options?: {
    findings?: ScorableFinding[];
    scanRecord?: Record<string, any>;
    fetchFindings?: (scanId: string) => Promise<ScorableFinding[]> | ScorableFinding[];
    updateScan?: (scanId: string, updates: ScanScoreUpdates) => Promise<void> | void;
  }
): Promise<ScoreComputationResult> {
  let findings: ScorableFinding[] = [];

  if (options?.findings) {
    findings = options.findings;
  } else if (options?.fetchFindings) {
    findings = await options.fetchFindings(scanId);
  } else if (mockFindingsStore.has(scanId)) {
    findings = mockFindingsStore.get(scanId) || [];
  }

  const result = calculateSecurityScore(findings);
  const updates: ScanScoreUpdates = {
    security_score: result.score,
    critical_count: result.counts.critical,
    high_count: result.counts.high,
    medium_count: result.counts.medium,
    low_count: result.counts.low,
    findings_count: result.counts.total,
  };

  if (options?.scanRecord) {
    Object.assign(options.scanRecord, updates);
  } else if (options?.updateScan) {
    await options.updateScan(scanId, updates);
  } else if (mockScanStore.has(scanId)) {
    const existing = mockScanStore.get(scanId);
    if (existing) {
      Object.assign(existing, updates);
    } else {
      mockScanStore.set(scanId, updates);
    }
  }

  return result;
}
