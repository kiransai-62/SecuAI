import { Finding, FindingSeverity, FindingSource, RawIsItSecureFinding, RawIsItSecureReport } from '@secuai/shared';
/**
 * List of fields present in upstream isitsecure findings that are unmappable
 * to the core Finding schema (and are preserved in evidence or reported).
 */
export declare const UNMAPPABLE_FIELDS: readonly string[];
/**
 * Computes a stable, deterministic fingerprint:
 * sha256(rule + normalized path + sink/endpoint)
 *
 * CRITICAL RULE: Line numbers are intentionally EXCLUDED to ensure stability
 * across refactors and whitespace changes.
 */
export declare function computeStableFingerprint(rule: string, filePath?: string | null, sinkOrEndpoint?: string | null): string;
/**
 * Normalizes raw severity string into FindingSeverity enum:
 * 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
 */
export declare function normalizeSeverity(rawSeverity?: string): FindingSeverity;
/**
 * Normalizes raw source into FindingSource enum:
 * 'SAST' | 'DAST' | 'SECRETS' | 'DEPS'
 */
export declare function normalizeSource(source?: string, category?: string, scannerName?: string, endpointUrl?: string | null): FindingSource;
/**
 * Normalizes a single raw isitsecure finding into a strictly validated SecuAI Finding.
 */
export declare function normalizeFinding(raw: RawIsItSecureFinding): Finding;
export interface NormalizedScanResult {
    findings: Finding[];
    unmappableFields: readonly string[];
    totalRawFindings: number;
    criticalCount: number;
    highCount: number;
    accessControlCount: number;
}
/**
 * Normalizes an entire isitsecure report into verified SecuAI Findings.
 */
export declare function normalizeReport(rawReport: RawIsItSecureReport): NormalizedScanResult;
/**
 * FALLBACK VERIFICATION STRATEGY:
 * If the scanner CLI cannot target an individual finding or rule directly in isolation,
 * SecuAI re-runs the scanner on the affected file / working tree and compares the stable fingerprints.
 * If the specific fingerprint is no longer present in the fresh scan findings, the finding is verified as neutralized.
 */
export declare function verifyFindingByFingerprintDiff(targetFingerprint: string, freshReport: RawIsItSecureReport): {
    verified: boolean;
    message: string;
};
