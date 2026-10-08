import fs from 'fs';
import path from 'path';
import { SecurityScannerAdapter } from './securityScannerAdapter.js';
import { ScanInput, DiscoverySummary, NormalizedFinding } from '../types.js';
import { dependencyRules } from '../rules/dependencyRules.js';
import { FindingNormalizer } from '../normalizer/findingNormalizer.js';
import { RuleMatch } from '../rules/types.js';

export class DependencyScannerAdapter extends SecurityScannerAdapter {
  readonly name = 'DependencyScannerAdapter';

  async scan(input: ScanInput, discovery: DiscoverySummary): Promise<NormalizedFinding[]> {
    const rawMatches: RuleMatch[] = [];
    const workspace = input.workspacePath;

    for (const relPath of discovery.manifests) {
      const fullPath = path.join(workspace, relPath);
      let content = '';
      try {
        content = fs.readFileSync(fullPath, 'utf8');
      } catch {
        continue;
      }

      const lines = content.split('\n');

      for (const rule of dependencyRules) {
        try {
          const matches = rule.execute({
            filePath: relPath,
            fileContent: content,
            workspacePath: workspace,
            lines,
          });
          rawMatches.push(...matches);
        } catch (err: any) {
          console.warn(`[DependencyScannerAdapter] Rule ${rule.id} notice on ${relPath}:`, err.message);
        }
      }
    }

    const normalized = rawMatches.map((m) => FindingNormalizer.normalizeRuleMatch(m));
    return FindingNormalizer.deduplicate(normalized);
  }
}
