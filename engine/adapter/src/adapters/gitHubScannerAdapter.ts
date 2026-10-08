import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { SecurityScannerAdapter } from './securityScannerAdapter.js';
import { ScanInput, DiscoverySummary, NormalizedFinding } from '../types.js';
import { SourceScannerAdapter } from './sourceScannerAdapter.js';
import { SecretScannerAdapter } from './secretScannerAdapter.js';
import { DependencyScannerAdapter } from './dependencyScannerAdapter.js';
import { ConfigurationScannerAdapter } from './configurationScannerAdapter.js';

export const GITHUB_REPO_REGEX = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\.git)?(\/)?$/;

export class GitHubScannerAdapter extends SecurityScannerAdapter {
  readonly name = 'GitHubScannerAdapter';

  private sourceScanner = new SourceScannerAdapter();
  private secretScanner = new SecretScannerAdapter();
  private dependencyScanner = new DependencyScannerAdapter();
  private configScanner = new ConfigurationScannerAdapter();

  /**
   * Safely clones a GitHub repository with depth 1 into the destination directory.
   */
  static async clone(repoUrl: string, destDir: string, timeoutMs = 60000): Promise<void> {
    const trimmed = (repoUrl || '').trim();
    if (!GITHUB_REPO_REGEX.test(trimmed)) {
      throw new Error(`Invalid GitHub repository URL: "${trimmed}". Must match https://github.com/<owner>/<repo>`);
    }

    const cleanUrl = trimmed.replace(/\/$/, '');
    const resolvedDest = path.resolve(destDir);

    // If target directory exists, clean it up before cloning
    if (fs.existsSync(resolvedDest)) {
      fs.rmSync(resolvedDest, { recursive: true, force: true });
    }
    // DO NOT pre-create the directory so git clone can create it cleanly
    fs.mkdirSync(path.dirname(resolvedDest), { recursive: true });

    return new Promise((resolve, reject) => {
      let stderr = '';
      const gitProc = spawn(
        'git',
        ['clone', '--depth', '1', '--no-recurse-submodules', cleanUrl, resolvedDest],
        {
          shell: false,
          env: {
            ...process.env,
            GIT_ALLOW_PROTOCOL: 'https',
            GIT_TERMINAL_PROMPT: '0',
          },
          timeout: timeoutMs,
        }
      );

      gitProc.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      gitProc.on('error', (err) => {
        reject(new Error(`Failed to launch git clone process: ${err.message}`));
      });

      gitProc.on('close', (code, signal) => {
        if (signal === 'SIGTERM') {
          return reject(new Error(`Git clone timed out after ${timeoutMs / 1000} seconds.`));
        }
        if (code !== 0) {
          // If clone fails due to private repository or 404
          const errMsg = stderr.trim();
          if (errMsg.includes('could not read Username') || errMsg.includes('Authentication failed') || errMsg.includes('terminal prompts disabled')) {
            return reject(new Error('This repository requires authorization or credentials. Private repositories require an access token.'));
          }
          if (errMsg.includes('not found') || errMsg.includes('Repository not found')) {
            return reject(new Error('Repository could not be retrieved. The repository does not exist or is private.'));
          }
          return reject(new Error(`Repository clone failed with code ${code}: ${errMsg || 'Unknown git error'}`));
        }
        resolve();
      });
    });
  }

  async scan(input: ScanInput, discovery: DiscoverySummary): Promise<NormalizedFinding[]> {
    const allFindings: NormalizedFinding[] = [];

    // Run Source Scanner
    const sourceFindings = await this.sourceScanner.scan(input, discovery);
    allFindings.push(...sourceFindings);

    // Run Secret Scanner
    const secretFindings = await this.secretScanner.scan(input, discovery);
    allFindings.push(...secretFindings);

    // Run Dependency Scanner
    const depFindings = await this.dependencyScanner.scan(input, discovery);
    allFindings.push(...depFindings);

    // Run Configuration Scanner
    const configFindings = await this.configScanner.scan(input, discovery);
    allFindings.push(...configFindings);

    return allFindings;
  }
}
