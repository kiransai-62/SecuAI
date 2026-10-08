import fs from 'fs';
import path from 'path';
import { SecurityScannerAdapter } from './securityScannerAdapter.js';
import { ScanInput, DiscoverySummary, NormalizedFinding } from '../types.js';
import { secretRules } from '../rules/secretRules.js';
import { FindingNormalizer } from '../normalizer/findingNormalizer.js';
import { RuleMatch } from '../rules/types.js';

export class SecretScannerAdapter extends SecurityScannerAdapter {
  readonly name = 'SecretScannerAdapter';

  async scan(input: ScanInput, discovery: DiscoverySummary): Promise<NormalizedFinding[]> {
    const rawMatches: RuleMatch[] = [];
    const workspace = input.workspacePath;

    // Combine source files, config files, and any .env files
    const candidateFiles = Array.from(
      new Set([...discovery.sourceFiles, ...discovery.configurationFiles])
    );

    for (const relPath of candidateFiles) {
      // Skip package locks and binary files
      if (relPath.includes('package-lock.json') || relPath.includes('pnpm-lock.yaml') || relPath.includes('.min.js')) {
        continue;
      }

      const fullPath = path.join(workspace, relPath);
      let content = '';
      try {
        content = fs.readFileSync(fullPath, 'utf8');
      } catch {
        continue;
      }

      const lines = content.split('\n');

      for (const rule of secretRules) {
        try {
          const matches = rule.execute({
            filePath: relPath,
            fileContent: content,
            workspacePath: workspace,
            lines,
          });
          rawMatches.push(...matches);
        } catch (err: any) {
          console.warn(`[SecretScannerAdapter] Rule ${rule.id} notice on ${relPath}:`, err.message);
        }
      }
    }

    const normalized = rawMatches.map((m) => FindingNormalizer.normalizeRuleMatch(m));
    return FindingNormalizer.deduplicate(normalized);
  }
}
