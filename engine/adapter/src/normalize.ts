import crypto from 'crypto';
import { 
  Finding, 
  FindingSchema, 
  FindingSeverity, 
  FindingSource, 
  RawIsItSecureFinding, 
  RawIsItSecureReport 
} from '@secuai/shared';

/**
 * List of fields present in upstream isitsecure findings that are unmappable 
 * to the core Finding schema (and are preserved in evidence or reported).
 */
export const UNMAPPABLE_FIELDS: readonly string[] = [
  'id',                         // Upstream run-specific UUID
  'theme_id',                   // Categorical grouping ID in isitsecure
  'related_finding_ids',        // Array of associated finding UUIDs
  'impact',                     // Free-form impact string (often null in raw)
  'likelihood',                 // Qualitative likelihood string
  'priority',                   // Qualitative priority string (e.g. P0/P1)
  'remediation_guidance',       // Raw guidance text
  'http_method',                // HTTP verb
  'request_payload',            // DAST probe request body
  'response_preview',           // DAST probe response body
  'baseline_response_preview',  // DAST baseline diff preview
  'code_location.github_url',   // Deep-link to remote GitHub
];

/**
 * Computes a stable, deterministic fingerprint:
 * sha256(rule + normalized path + sink/endpoint)
 * 
 * CRITICAL RULE: Line numbers are intentionally EXCLUDED to ensure stability
 * across refactors and whitespace changes.
 */
export function computeStableFingerprint(
  rule: string,
  filePath?: string | null,
  sinkOrEndpoint?: string | null
): string {
  const normRule = (rule || 'unknown_rule').trim().toLowerCase();
  const normPath = (filePath || '').replace(/\\/g, '/').trim().toLowerCase();
  const normSink = (sinkOrEndpoint || '').trim().toLowerCase();

  const preimage = `${normRule}::${normPath}::${normSink}`;
  return crypto.createHash('sha256').update(preimage).digest('hex');
}

/**
 * Normalizes raw severity string into FindingSeverity enum:
 * 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
 */
export function normalizeSeverity(rawSeverity?: string): FindingSeverity {
  const s = (rawSeverity || '').toLowerCase().trim();
  switch (s) {
    case 'critical':
      return FindingSeverity.CRITICAL;
    case 'high':
      return FindingSeverity.HIGH;
    case 'medium':
      return FindingSeverity.MEDIUM;
    case 'low':
      return FindingSeverity.LOW;
    default:
      return FindingSeverity.INFO;
  }
}

/**
 * Normalizes raw source into FindingSource enum:
 * 'SAST' | 'DAST' | 'SECRETS' | 'DEPS'
 */
export function normalizeSource(
  source?: string,
  category?: string,
  scannerName?: string,
  endpointUrl?: string | null
): FindingSource {
  const normCat = (category || '').toLowerCase();
  const normScanner = (scannerName || '').toLowerCase();
  const normSrc = (source || '').toLowerCase();

  if (normCat === 'exposed_secrets' || normScanner.includes('secret')) {
    return FindingSource.SECRETS;
  }
  if (normCat === 'dependency_vuln' || normScanner.includes('dependency') || normScanner.includes('osv')) {
    return FindingSource.DEPS;
  }
  if (normSrc.includes('dast') || (endpointUrl !== null && endpointUrl !== undefined && endpointUrl.length > 0)) {
    return FindingSource.DAST;
  }
  return FindingSource.SAST;
}

/**
 * Normalizes a single raw isitsecure finding into a strictly validated SecuAI Finding.
 */
export function normalizeFinding(raw: RawIsItSecureFinding): Finding {
  const normalizedPath = raw.code_location?.file_path
    ? raw.code_location.file_path.replace(/\\/g, '/')
    : null;

  const rule = raw.scanner_name || raw.category;
  const sinkOrEndpoint = raw.endpoint_url || raw.category || raw.title;

  const fingerprint = computeStableFingerprint(rule, normalizedPath, sinkOrEndpoint);
  const severity = normalizeSeverity(raw.severity);
  const source = normalizeSource(raw.source, raw.category, raw.scanner_name, raw.endpoint_url);

  const confidence = typeof raw.confidence === 'number'
    ? Math.max(0, Math.min(1, raw.confidence))
    : 0.8;

  // Preserve all contextual details inside evidence JSON object
  const evidenceRecord: Record<string, unknown> = {
    scanner_name: raw.scanner_name,
    raw_source: raw.source,
    technical_detail: raw.technical_detail || '',
    evidence_text: raw.evidence || '',
    code_snippet: raw.code_location?.code_snippet || '',
    theme_id: raw.theme_id || '',
    probe_captures: raw.probe_captures || [],
    remediation_guidance: raw.remediation_guidance || '',
    unmappable_metadata: {
      raw_id: raw.id,
      priority: raw.priority,
      likelihood: raw.likelihood,
      impact: raw.impact,
      http_method: raw.http_method,
      request_payload: raw.request_payload,
      response_preview: raw.response_preview,
    },
  };

  const findingData = {
    fingerprint,
    title: raw.title,
    category: raw.category,
    severity,
    confidence,
    source,
    file_path: normalizedPath,
    line_start: raw.code_location?.line_number ?? null,
    line_end: raw.code_location?.line_end ?? null,
    endpoint: raw.endpoint_url || null,
    evidence: evidenceRecord,
    description: raw.description,
  };

  // Strictly parse and validate through Zod FindingSchema
  return FindingSchema.parse(findingData);
}

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
export function normalizeReport(rawReport: RawIsItSecureReport): NormalizedScanResult {
  const findings: Finding[] = [];

  for (const rawFinding of rawReport.findings || []) {
    const normalized = normalizeFinding(rawFinding);
    findings.push(normalized);
  }

  const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
  const highCount = findings.filter(f => f.severity === 'HIGH').length;
  
  // Count findings that represent access control weaknesses
  const accessControlCount = findings.filter(f => 
    f.category === 'rls_misconfiguration' ||
    f.category === 'auth_weakness' ||
    f.category === 'access_control' ||
    f.title.toLowerCase().includes('rls') ||
    f.title.toLowerCase().includes('auth') ||
    f.title.toLowerCase().includes('idor')
  ).length;

  return {
    findings,
    unmappableFields: UNMAPPABLE_FIELDS,
    totalRawFindings: rawReport.findings?.length || 0,
    criticalCount,
    highCount,
    accessControlCount,
  };
}

/**
 * FALLBACK VERIFICATION STRATEGY:
 * If the scanner CLI cannot target an individual finding or rule directly in isolation,
 * SecuAI re-runs the scanner on the affected file / working tree and compares the stable fingerprints.
 * If the specific fingerprint is no longer present in the fresh scan findings, the finding is verified as neutralized.
 */
export function verifyFindingByFingerprintDiff(
  targetFingerprint: string,
  freshReport: RawIsItSecureReport
): { verified: boolean; message: string } {
  const normalized = normalizeReport(freshReport);
  const stillExists = normalized.findings.some(f => f.fingerprint === targetFingerprint);

  if (!stillExists) {
    return {
      verified: true,
      message: `Verified: Fingerprint [${targetFingerprint.slice(0, 8)}] no longer present in re-scan.`,
    };
  }

  return {
    verified: false,
    message: `Verification failed: Fingerprint [${targetFingerprint.slice(0, 8)}] still detected in code.`,
  };
}
