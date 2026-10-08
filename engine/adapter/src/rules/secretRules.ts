import { SecurityRule, RuleMatch, RuleExecutionContext } from './types.js';

function shannonEntropy(str: string): number {
  const map: Record<string, number> = {};
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    map[c] = (map[c] || 0) + 1;
  }
  let entropy = 0;
  for (const c in map) {
    const p = map[c] / str.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

export const secretRules: SecurityRule[] = [
  // --------------------------------------------------------------------------
  // 1. Supabase Service Role Key Leak (SEC-SEC-001)
  // --------------------------------------------------------------------------
  {
    id: 'SEC-SEC-001',
    name: 'Hardcoded Supabase Service Role Secret Key',
    category: 'SECRETS',
    severity: 'CRITICAL',
    confidence: 'HIGH',
    description: 'Supabase service role JWT key (which completely bypasses Row Level Security) hardcoded in source repository.',
    missingControl: 'Storing administrative database credentials strictly in server-side runtime environment variables.',
    potentialImpact: 'Total database compromise with unrestricted read and write permissions across all tables, bypassing all RLS policies.',
    remediation: 'Immediately revoke the leaked service role key from the Supabase dashboard and inject keys solely via server runtime secrets.',
    execute(ctx: RuleExecutionContext): RuleMatch[] {
      const matches: RuleMatch[] = [];
      const lines = ctx.lines;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match JWT string
        const jwtRegex = /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g;
        let m: RegExpExecArray | null;
        while ((m = jwtRegex.exec(line)) !== null) {
          const rawJwt = m[0];
          try {
            const parts = rawJwt.split('.');
            if (parts.length >= 2) {
              const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
              if (payloadJson.includes('"service_role"') || line.toLowerCase().includes('service_role') || line.toLowerCase().includes('servicekey')) {
                const start = Math.max(0, i - 1);
                const end = Math.min(lines.length - 1, i + 1);
                const snippet = lines.slice(start, end + 1).join('\n');

                matches.push({
                  ruleId: 'SEC-SEC-001',
                  title: 'Hardcoded Supabase Service Role Secret Key Detected',
                  category: 'SECRETS',
                  severity: 'CRITICAL',
                  confidence: 'HIGH',
                  filePath: ctx.filePath,
                  lineStart: i + 1,
                  lineEnd: i + 1,
                  trigger: `${rawJwt.slice(0, 15)}...[REDACTED]`,
                  codeSnippet: snippet.replace(rawJwt, `${rawJwt.slice(0, 12)}...[REDACTED]`),
                  description: `A hardcoded Supabase service role key was detected in '${ctx.filePath}'. Service role keys bypass all RLS policies.`,
                  missingControl: 'Environment variable segregation (process.env.SUPABASE_SERVICE_ROLE_KEY).',
                  potentialImpact: 'Full database takeover with unconditional write access to all multi-tenant tables.',
                  remediation: 'Remove the key from the source tree, rotate it in Supabase Project Settings, and reference it via process.env.',
                });
              }
            }
          } catch {}
        }
      }
      return matches;
    },
  },

  // --------------------------------------------------------------------------
  // 2. Private Key Header Leak (SEC-SEC-002)
  // --------------------------------------------------------------------------
  {
    id: 'SEC-SEC-002',
    name: 'Hardcoded Cryptographic Private Key',
    category: 'SECRETS',
    severity: 'CRITICAL',
    confidence: 'HIGH',
    description: 'Cryptographic private key (RSA, EC, or OpenSSH) committed to repository.',
    missingControl: 'Hardware security modules, KMS, or runtime secret injectors.',
    potentialImpact: 'TLS/SSL impersonation, SSH server infiltration, and cryptographic signature forgery.',
    remediation: 'Remove private keys from repository history and manage keys in a secure secret vault.',
    execute(ctx: RuleExecutionContext): RuleMatch[] {
      const matches: RuleMatch[] = [];
      const lines = ctx.lines;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/.test(line)) {
          const start = Math.max(0, i - 1);
          const end = Math.min(lines.length - 1, i + 3);
          const snippet = lines.slice(start, end + 1).join('\n');

          matches.push({
            ruleId: 'SEC-SEC-002',
            title: 'Hardcoded Private Key Exposed in Repository',
            category: 'SECRETS',
            severity: 'CRITICAL',
            confidence: 'HIGH',
            filePath: ctx.filePath,
            lineStart: i + 1,
            lineEnd: i + 1,
            trigger: '-----BEGIN PRIVATE KEY-----',
            codeSnippet: snippet,
            description: `A private cryptographic key is committed directly into '${ctx.filePath}'.`,
            missingControl: 'Secure secret management and key store.',
            potentialImpact: 'Attackers can forge authorization certificates or authenticate to production infrastructure.',
            remediation: 'Immediately revoke the key, remove it from git history, and deploy using environment secrets.',
          });
        }
      }
      return matches;
    },
  },

  // --------------------------------------------------------------------------
  // 3. AWS Access Key Leak (SEC-SEC-003)
  // --------------------------------------------------------------------------
  {
    id: 'SEC-SEC-003',
    name: 'Hardcoded AWS Access Key ID',
    category: 'SECRETS',
    severity: 'HIGH',
    confidence: 'HIGH',
    description: 'AWS programmatic access key ID (AKIA...) detected in source code.',
    missingControl: 'AWS IAM roles for service accounts or STS temporary credentials.',
    potentialImpact: 'Unauthorized cloud infrastructure manipulation, AWS API billing abuse, and data theft.',
    remediation: 'Rotate the AWS IAM key and adopt IAM Roles / Instance Profiles rather than static credentials.',
    execute(ctx: RuleExecutionContext): RuleMatch[] {
      const matches: RuleMatch[] = [];
      const lines = ctx.lines;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const awsRegex = /\b(AKIA[0-9A-Z]{16})\b/g;
        let m: RegExpExecArray | null;
        while ((m = awsRegex.exec(line)) !== null) {
          const keyId = m[1];
          const start = Math.max(0, i - 1);
          const end = Math.min(lines.length - 1, i + 1);
          const snippet = lines.slice(start, end + 1).join('\n');

          matches.push({
            ruleId: 'SEC-SEC-003',
            title: 'AWS Programmatic Access Key ID Exposed',
            category: 'SECRETS',
            severity: 'HIGH',
            confidence: 'HIGH',
            filePath: ctx.filePath,
            lineStart: i + 1,
            lineEnd: i + 1,
            trigger: `${keyId.slice(0, 8)}...[REDACTED]`,
            codeSnippet: snippet.replace(keyId, `${keyId.slice(0, 8)}...[REDACTED]`),
            description: `An AWS access key identifier was discovered in '${ctx.filePath}'.`,
            missingControl: 'IAM Instance Profiles or environment variable injection.',
            potentialImpact: 'Compromise of cloud infrastructure services associated with this IAM identity.',
            remediation: 'Deactivate the key in the AWS IAM Console and configure AWS_ACCESS_KEY_ID via environment.',
          });
        }
      }
      return matches;
    },
  },

  // --------------------------------------------------------------------------
  // 4. GitHub Token Leak (SEC-SEC-004)
  // --------------------------------------------------------------------------
  {
    id: 'SEC-SEC-004',
    name: 'GitHub Personal Access Token Leak',
    category: 'SECRETS',
    severity: 'HIGH',
    confidence: 'HIGH',
    description: 'GitHub Personal Access Token (ghp_... or github_pat_...) hardcoded in code.',
    missingControl: 'Fine-grained GitHub App installation tokens or secret scanning.',
    potentialImpact: 'Repository code theft, malicious release tampering, and unauthorized CI/CD pipeline triggers.',
    remediation: 'Revoke the personal access token on GitHub and migrate to GitHub Actions secrets.',
    execute(ctx: RuleExecutionContext): RuleMatch[] {
      const matches: RuleMatch[] = [];
      const lines = ctx.lines;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const ghRegex = /\b(ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82})\b/g;
        let m: RegExpExecArray | null;
        while ((m = ghRegex.exec(line)) !== null) {
          const tok = m[1];
          const start = Math.max(0, i - 1);
          const end = Math.min(lines.length - 1, i + 1);
          const snippet = lines.slice(start, end + 1).join('\n');

          matches.push({
            ruleId: 'SEC-SEC-004',
            title: 'GitHub Personal Access Token Exposed',
            category: 'SECRETS',
            severity: 'HIGH',
            confidence: 'HIGH',
            filePath: ctx.filePath,
            lineStart: i + 1,
            lineEnd: i + 1,
            trigger: `${tok.slice(0, 8)}...[REDACTED]`,
            codeSnippet: snippet.replace(tok, `${tok.slice(0, 8)}...[REDACTED]`),
            description: `A GitHub personal access token was discovered committed in '${ctx.filePath}'.`,
            missingControl: 'CI/CD secret store and pre-commit secret hooks.',
            potentialImpact: 'Unauthorized git pushes, private repo access, and workflow modifications.',
            remediation: 'Revoke the token immediately at https://github.com/settings/tokens.',
          });
        }
      }
      return matches;
    },
  },

  // --------------------------------------------------------------------------
  // 5. Generic High-Entropy Token (SEC-SEC-005)
  // --------------------------------------------------------------------------
  {
    id: 'SEC-SEC-005',
    name: 'Generic High-Entropy API Token or Secret',
    category: 'SECRETS',
    severity: 'MEDIUM',
    confidence: 'MEDIUM',
    description: 'High-entropy credential or API token variable hardcoded in source file.',
    missingControl: 'Secret manager (AWS Secrets Manager, Doppler, Vault, or .env files).',
    potentialImpact: 'Third-party service abuse or credential leak in version control.',
    remediation: 'Store credentials in runtime environment variables.',
    execute(ctx: RuleExecutionContext): RuleMatch[] {
      const matches: RuleMatch[] = [];
      const lines = ctx.lines;

      // Ignore non-source or sample/mock files
      if (ctx.filePath.includes('test') || ctx.filePath.includes('mock') || ctx.filePath.endsWith('.example')) {
        return [];
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const secretAssignRegex = /(?:apiKey|api_key|client_secret|clientSecret|secretKey|secret_key|private_key)\s*[:=]\s*['"]([a-zA-Z0-9_\-]{24,})['"]/i;
        const m = line.match(secretAssignRegex);
        if (m) {
          const val = m[1];
          // Shannon entropy check (high randomness)
          if (shannonEntropy(val) > 3.4 && !val.includes('dummy') && !val.includes('test') && !val.includes('placeholder')) {
            const start = Math.max(0, i - 1);
            const end = Math.min(lines.length - 1, i + 1);
            const snippet = lines.slice(start, end + 1).join('\n');

            matches.push({
              ruleId: 'SEC-SEC-005',
              title: 'Hardcoded High-Entropy API Secret Detected',
              category: 'SECRETS',
              severity: 'MEDIUM',
              confidence: 'MEDIUM',
              filePath: ctx.filePath,
              lineStart: i + 1,
              lineEnd: i + 1,
              trigger: `${val.slice(0, 6)}...[REDACTED]`,
              codeSnippet: snippet.replace(val, `${val.slice(0, 6)}...[REDACTED]`),
              description: `A hardcoded high-entropy secret string was discovered in '${ctx.filePath}'.`,
              missingControl: 'External environment variable configuration.',
              potentialImpact: 'Accidental leak of third-party API quotas and services.',
              remediation: 'Migrate secret assignment to process.env and store in secure runtime variables.',
            });
          }
        }
      }
      return matches;
    },
  },
];
