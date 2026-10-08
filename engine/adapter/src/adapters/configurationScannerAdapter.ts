import fs from 'fs';
import path from 'path';
import { SecurityScannerAdapter } from './securityScannerAdapter.js';
import { ScanInput, DiscoverySummary, NormalizedFinding } from '../types.js';
import { configRules } from '../rules/configRules.js';
import { FindingNormalizer } from '../normalizer/findingNormalizer.js';
import { RuleMatch } from '../rules/types.js';

export class ConfigurationScannerAdapter extends SecurityScannerAdapter {
  readonly name = 'ConfigurationScannerAdapter';

  async scan(input: ScanInput, discovery: DiscoverySummary): Promise<NormalizedFinding[]> {
    const rawMatches: RuleMatch[] = [];
    const workspace = input.workspacePath;

    // Scan all config files + SQL migrations + source files
    const targets = Array.from(new Set([...discovery.configurationFiles, ...discovery.sourceFiles]));

    for (const relPath of targets) {
      const fullPath = path.join(workspace, relPath);
      let content = '';
      try {
        content = fs.readFileSync(fullPath, 'utf8');
      } catch {
        continue;
      }

      const ext = path.extname(relPath).toLowerCase();
      const lines = content.split('\n');

      for (const rule of configRules) {
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
          console.warn(`[ConfigurationScannerAdapter] Rule ${rule.id} notice on ${relPath}:`, err.message);
        }
      }
    }

    const normalized = rawMatches.map((m) => FindingNormalizer.normalizeRuleMatch(m));
    return FindingNormalizer.deduplicate(normalized);
  }
}
