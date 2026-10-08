import crypto from 'crypto';
import { RuleMatch } from '../rules/types.js';
import { NormalizedFinding, NormalizedSource } from '../types.js';

export class FindingNormalizer {
  /**
   * Deterministically normalizes a rule match into the canonical Finding schema.
   * Generates a stable SHA-256 fingerprint based on Rule ID, File Path, and Normalized Code Trigger.
   */
  static normalizeRuleMatch(match: RuleMatch): NormalizedFinding {
    const normalizedTrigger = (match.trigger || '').replace(/\s+/g, ' ').trim();
    const fpMaterial = `${match.ruleId}:${match.filePath}:${normalizedTrigger}`;
    const fingerprint = crypto.createHash('sha256').update(fpMaterial).digest('hex');

    let source: NormalizedSource = 'SAST';
    if (match.category === 'SECRETS') source = 'SECRETS';
    else if (match.category === 'DEPENDENCIES') source = 'SCA';
    else if (match.category === 'CONFIGURATION') source = 'CONFIG';

    return {
      id: crypto.randomUUID(),
      fingerprint,
      title: match.title,
      category: match.category,
      severity: match.severity,
      confidence: match.confidence,
      source,
      filePath: match.filePath,
      lineStart: match.lineStart,
      lineEnd: match.lineEnd,
      endpoint: match.endpoint || null,
      parameter: match.parameter || null,
      description: match.description,
      evidence: {
        scanner_name: `secuai_${source.toLowerCase()}_engine`,
        rule_id: match.ruleId,
        trigger: match.trigger,
        code_snippet: match.codeSnippet,
        missing_control: match.missingControl,
        potential_impact: match.potentialImpact,
        remediation_guidance: match.remediation,
      },
      remediation: match.remediation,
      status: 'OPEN',
    };
  }

  /**
   * Deduplicates findings having identical fingerprints, preserving the highest confidence one.
   */
  static deduplicate(findings: NormalizedFinding[]): NormalizedFinding[] {
    const map = new Map<string, NormalizedFinding>();
    for (const f of findings) {
      if (!map.has(f.fingerprint)) {
        map.set(f.fingerprint, f);
      }
    }
    return Array.from(map.values());
  }
}
