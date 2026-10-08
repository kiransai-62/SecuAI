import fs from 'fs';
import path from 'path';
import { SecurityScannerAdapter } from './securityScannerAdapter.js';
import { ScanInput, DiscoverySummary, NormalizedFinding } from '../types.js';
import { sastRules } from '../rules/sastRules.js';
import { FindingNormalizer } from '../normalizer/findingNormalizer.js';
import { RuleMatch } from '../rules/types.js';

export class SourceScannerAdapter extends SecurityScannerAdapter {
  readonly name = 'SourceScannerAdapter';

  async scan(input: ScanInput, discovery: DiscoverySummary): Promise<NormalizedFinding[]> {
    const rawMatches: RuleMatch[] = [];
    const workspace = input.workspacePath;

    for (const relPath of discovery.sourceFiles) {
      const fullPath = path.join(workspace, relPath);
      let content = '';
      try {
        content = fs.readFileSync(fullPath, 'utf8');
      } catch {
        continue;
      }

      const ext = path.extname(relPath).toLowerCase();
      const lines = content.split('\n');

      for (const rule of sastRules) {
        if (rule.applicableExtensions && !rule.applicableExtensions.includes(ext)) {
          continue;
        }

        try {
          const matches = rule.execute({
            filePath: relPath,
            fileContent: content,
            workspacePath: workspace,
            lines,
          });
          rawMatches.push(...matches);
        } catch (err: any) {
          console.warn(`[SourceScannerAdapter] Rule ${rule.id} execution notice on ${relPath}:`, err.message);
        }
      }
    }

    const normalized = rawMatches.map((m) => FindingNormalizer.normalizeRuleMatch(m));
    return FindingNormalizer.deduplicate(normalized);
  }
}
