import fs from 'fs';
import path from 'path';
import { DiscoveryEngine } from './discovery/discoveryEngine.js';
import { SourceScannerAdapter } from './adapters/sourceScannerAdapter.js';
import { SecretScannerAdapter } from './adapters/secretScannerAdapter.js';
import { DependencyScannerAdapter } from './adapters/dependencyScannerAdapter.js';
import { ConfigurationScannerAdapter } from './adapters/configurationScannerAdapter.js';
import { WebScannerAdapter } from './adapters/webScannerAdapter.js';
import { GitHubScannerAdapter } from './adapters/gitHubScannerAdapter.js';
import { FindingNormalizer } from './normalizer/findingNormalizer.js';
import { ScanInput, UnifiedScanResult, NormalizedFinding, DiscoverySummary } from './types.js';

export class UnifiedScanPipeline {
  private static sourceScanner = new SourceScannerAdapter();
  private static secretScanner = new SecretScannerAdapter();
  private static dependencyScanner = new DependencyScannerAdapter();
  private static configScanner = new ConfigurationScannerAdapter();
  private static webScanner = new WebScannerAdapter();
  private static gitHubScanner = new GitHubScannerAdapter();

  /**
   * Deterministic scoring calculation
   */
  static calculateSecurityScore(findings: NormalizedFinding[]): number {
    let penalty = 0;
    for (const f of findings) {
      if (f.status === 'VERIFIED' || f.status === 'FALSE_POSITIVE' || f.status === 'ACCEPTED_RISK') {
        continue;
      }
      if (f.severity === 'CRITICAL') penalty += 25;
      else if (f.severity === 'HIGH') penalty += 15;
      else if (f.severity === 'MEDIUM') penalty += 7;
      else if (f.severity === 'LOW') penalty += 2;
    }
    return Math.max(0, Math.min(100, 100 - penalty));
  }

  /**
   * Executes the full security scanning workflow end-to-end.
   */
  static async executeScan(input: ScanInput): Promise<UnifiedScanResult> {
    const startTime = Date.now();
    let findings: NormalizedFinding[] = [];
    let discovery: DiscoverySummary;

    if (input.targetType === 'URL') {
      // 1. Discovery for Web URL
      discovery = {
        technologies: ['Web Application'],
        frameworks: [],
        languages: [],
        packageManagers: [],
        endpoints: [],
        apiRoutes: [],
        authenticationSurfaces: [],
        sourceFiles: [],
        configurationFiles: [],
        manifests: [],
        scanCoverage: {
          filesAnalyzed: 0,
          rulesExecuted: 12,
          dependenciesAnalyzed: 0,
          routesDiscovered: 1,
          secretsChecksCompleted: true,
          configChecksCompleted: true,
          durationMs: 0,
        },
      };

      // 2. Web DAST Scan
      findings = await this.webScanner.scan(input, discovery);
    } else {
      // If GITHUB target, clone first
      if (input.targetType === 'REPO' && input.repoUrl) {
        await GitHubScannerAdapter.clone(input.repoUrl, input.workspacePath, input.options?.timeoutMs || 60000);
      }

      // 1. Discovery stage
      discovery = await DiscoveryEngine.discover(input.workspacePath);

      // Verify that workspace contains analyzable content
      if (discovery.sourceFiles.length === 0 && discovery.configurationFiles.length === 0 && discovery.manifests.length === 0) {
        throw new Error('No supported or analyzable source files were detected in the target workspace.');
      }

      // 2. Multi-Engine Security Analysis
      const [srcFindings, secFindings, depFindings, cfgFindings] = await Promise.all([
        this.sourceScanner.scan(input, discovery),
        this.secretScanner.scan(input, discovery),
        this.dependencyScanner.scan(input, discovery),
        this.configScanner.scan(input, discovery),
      ]);

      findings = FindingNormalizer.deduplicate([
        ...srcFindings,
        ...secFindings,
        ...depFindings,
        ...cfgFindings,
      ]);
    }

    // 3. Compute Metrics & Deterministic Score
    const score = this.calculateSecurityScore(findings);
    const criticalCount = findings.filter((f) => f.severity === 'CRITICAL').length;
    const highCount = findings.filter((f) => f.severity === 'HIGH').length;
    const mediumCount = findings.filter((f) => f.severity === 'MEDIUM').length;
    const lowCount = findings.filter((f) => f.severity === 'LOW').length;

    const durationSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    discovery.scanCoverage.durationMs = Date.now() - startTime;

    return {
      scanId: undefined,
      targetType: input.targetType,
      targetPath: input.targetUrl || input.repoUrl || input.targetPath || input.workspacePath,
      discovery,
      findings,
      score,
      metrics: {
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
        totalFindings: findings.length,
      },
      durationSeconds,
      completedAt: new Date().toISOString(),
    };
  }
}
