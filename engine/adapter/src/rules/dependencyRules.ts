import { SecurityRule, RuleMatch, RuleExecutionContext } from './types.js';

interface VulnerableDependency {
  package: string;
  maxVulnerableVersion: string;
  cve: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  description: string;
  recommendedVersion: string;
}

const KNOWN_VULNERABLE_PACKAGES: VulnerableDependency[] = [
  {
    package: 'jsonwebtoken',
    maxVulnerableVersion: '9.0.0',
    cve: 'CVE-2022-23529',
    severity: 'HIGH',
    description: 'jsonwebtoken verification flaw allowing arbitrary code execution through crafted key objects.',
    recommendedVersion: '^9.0.2',
  },
  {
    package: 'axios',
    maxVulnerableVersion: '1.7.4',
    cve: 'CVE-2024-39338',
    severity: 'HIGH',
    description: 'Server-Side Request Forgery vulnerability in axios protocol handling.',
    recommendedVersion: '^1.7.7',
  },
  {
    package: 'express',
    maxVulnerableVersion: '4.19.2',
    cve: 'CVE-2024-29041',
    severity: 'MEDIUM',
    description: 'Open redirect and IP parsing bypass vulnerability in express routing.',
    recommendedVersion: '^4.21.2',
  },
  {
    package: 'lodash',
    maxVulnerableVersion: '4.17.21',
    cve: 'CVE-2021-23337',
    severity: 'HIGH',
    description: 'Prototype pollution in lodash template engine leading to command execution.',
    recommendedVersion: '^4.17.21',
  },
];

export const dependencyRules: SecurityRule[] = [
  {
    id: 'SEC-DEP-001',
    name: 'Known Vulnerable Dependency Detected in Manifest',
    category: 'DEPENDENCIES',
    severity: 'HIGH',
    confidence: 'HIGH',
    description: 'Project manifest specifies a package version with published Common Vulnerabilities and Exposures (CVE).',
    missingControl: 'Automated Software Composition Analysis (SCA) dependency updates.',
    potentialImpact: 'Exploitation of public vulnerabilities in third-party library dependencies.',
    remediation: 'Upgrade the affected package to the recommended secure patch version.',
    applicableExtensions: ['.json'],
    execute(ctx: RuleExecutionContext): RuleMatch[] {
      const matches: RuleMatch[] = [];
      if (!ctx.filePath.endsWith('package.json')) return matches;

      try {
        const pkg = JSON.parse(ctx.fileContent);
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

        for (const vuln of KNOWN_VULNERABLE_PACKAGES) {
          const installedVer = deps[vuln.package];
          if (installedVer) {
            const cleanVer = installedVer.replace(/[\^~>=<]/g, '').trim();
            // Simple semver check
            const isVulnerable = cleanVer.localeCompare(vuln.maxVulnerableVersion, undefined, { numeric: true }) < 0;

            if (isVulnerable) {
              const lines = ctx.lines;
              let lineNum = 1;
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(`"${vuln.package}"`)) {
                  lineNum = i + 1;
                  break;
                }
              }

              matches.push({
                ruleId: 'SEC-DEP-001',
                title: `Vulnerable Dependency '${vuln.package}' (${vuln.cve})`,
                category: 'DEPENDENCIES',
                severity: vuln.severity,
                confidence: 'HIGH',
                filePath: ctx.filePath,
                lineStart: lineNum,
                lineEnd: lineNum,
                trigger: `"${vuln.package}": "${installedVer}"`,
                codeSnippet: lines.slice(Math.max(0, lineNum - 1), Math.min(lines.length, lineNum + 1)).join('\n'),
                description: `${vuln.description} Installed version: ${installedVer}.`,
                missingControl: `Upgrade ${vuln.package} to ${vuln.recommendedVersion} or higher.`,
                potentialImpact: 'Known publicly documented exploit payloads targeting this library version.',
                remediation: `npm install ${vuln.package}@latest to remediate ${vuln.cve}.`,
              });
            }
          }
        }
      } catch {}

      return matches;
    },
  },
];
