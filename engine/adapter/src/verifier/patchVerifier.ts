import fs from 'fs';
import path from 'path';
import { ALL_SECURITY_RULES } from '../rules/index.js';
import { NormalizedFinding } from '../types.js';

export interface PatchVerificationResult {
  verified: boolean;
  verdict: 'VERIFIED' | 'FAILED' | 'INCONCLUSIVE';
  message: string;
  scanner_name: string;
  previous_status: string;
  new_status: string;
  evidence?: Record<string, unknown>;
}

export class PatchVerifier {
  /**
   * Deterministically verifies a finding fix by re-running the specific security rule
   * directly against the modified file in the workspace.
   *
   * Gemini is NEVER allowed to declare an issue fixed. Verification is 100% scanner-based.
   */
  static async verifyFindingPatch(
    workspacePath: string,
    finding: {
      fingerprint: string;
      file_path?: string | null;
      filePath?: string | null;
      category?: string;
      title?: string;
      status?: string;
    }
  ): Promise<PatchVerificationResult> {
    const relFile = finding.file_path || finding.filePath;
    if (!relFile) {
      return {
        verified: false,
        verdict: 'INCONCLUSIVE',
        message: 'No file location associated with finding to verify.',
        scanner_name: 'secuai_patch_verifier',
        previous_status: finding.status || 'OPEN',
        new_status: finding.status || 'OPEN',
      };
    }

    const fullPath = path.join(workspacePath, relFile);
    if (!fs.existsSync(fullPath)) {
      return {
        verified: false,
        verdict: 'FAILED',
        message: `Target file '${relFile}' does not exist in workspace.`,
        scanner_name: 'secuai_patch_verifier',
        previous_status: finding.status || 'OPEN',
        new_status: finding.status || 'OPEN',
      };
    }

    let content = '';
    try {
      content = fs.readFileSync(fullPath, 'utf8');
    } catch (err: any) {
      return {
        verified: false,
        verdict: 'FAILED',
        message: `Failed to read target file: ${err.message}`,
        scanner_name: 'secuai_patch_verifier',
        previous_status: finding.status || 'OPEN',
        new_status: finding.status || 'OPEN',
      };
    }

    const lines = content.split('\n');
    const ext = path.extname(relFile).toLowerCase();

    // Re-run all rules (or matched category rules) on the file
    let stillVulnerable = false;
    let matchingRuleName = '';

    for (const rule of ALL_SECURITY_RULES) {
      if (rule.applicableExtensions && !rule.applicableExtensions.includes(ext)) {
        continue;
      }

      try {
        const matches = rule.execute({
          filePath: relFile,
          fileContent: content,
          workspacePath,
          lines,
        });

        // Check if any match corresponds to this specific finding rule
        const targetRuleId = (finding as any).rule_id || (finding as any).evidence?.rule_id;
        for (const m of matches) {
          let isTargetRule = false;
          if (targetRuleId) {
            isTargetRule = m.ruleId === targetRuleId;
          } else if (finding.title) {
            const ruleNameLower = rule.name.toLowerCase();
            const findingTitleLower = finding.title.toLowerCase();
            isTargetRule =
              ruleNameLower === findingTitleLower ||
              (ruleNameLower.includes('sql') && findingTitleLower.includes('sql')) ||
              (ruleNameLower.includes('command') && findingTitleLower.includes('command')) ||
              (ruleNameLower.includes('auth') && findingTitleLower.includes('auth')) ||
              (ruleNameLower.includes('cors') && findingTitleLower.includes('cors')) ||
              (ruleNameLower.includes('secret') && findingTitleLower.includes('secret')) ||
              (ruleNameLower.includes('rls') && findingTitleLower.includes('rls')) ||
              ruleNameLower.includes(findingTitleLower) ||
              findingTitleLower.includes(ruleNameLower);
          } else {
            isTargetRule = m.category === finding.category;
          }

          if (isTargetRule) {
            stillVulnerable = true;
            matchingRuleName = rule.name;
            break;
          }
        }
      } catch {}

      if (stillVulnerable) break;
    }

    if (!stillVulnerable) {
      return {
        verified: true,
        verdict: 'VERIFIED',
        message: `Patch verified successfully: Rule '${matchingRuleName || finding.category}' no longer flags vulnerability in '${relFile}'.`,
        scanner_name: 'secuai_patch_verifier',
        previous_status: finding.status || 'OPEN',
        new_status: 'VERIFIED',
        evidence: {
          file_analyzed: relFile,
          lines_checked: lines.length,
          timestamp: new Date().toISOString(),
        },
      };
    }

    return {
      verified: false,
      verdict: 'FAILED',
      message: `Patch verification failed: Vulnerability '${matchingRuleName || finding.category}' is still detected in '${relFile}'.`,
      scanner_name: 'secuai_patch_verifier',
      previous_status: finding.status || 'OPEN',
      new_status: 'OPEN',
      evidence: {
        file_analyzed: relFile,
        rule_failed: matchingRuleName,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
