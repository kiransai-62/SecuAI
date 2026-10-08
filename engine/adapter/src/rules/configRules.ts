import { SecurityRule, RuleMatch, RuleExecutionContext } from './types.js';

export const configRules: SecurityRule[] = [
  // --------------------------------------------------------------------------
  // 1. Missing PostgreSQL RLS in Migration (SEC-CFG-001)
  // --------------------------------------------------------------------------
  {
    id: 'SEC-CFG-001',
    name: 'PostgreSQL Table Missing Row Level Security (RLS)',
    category: 'CONFIGURATION',
    severity: 'CRITICAL',
    confidence: 'HIGH',
    description: 'PostgreSQL table created in migration without enabling Row Level Security (RLS). Clients with public anon keys can read and write all rows.',
    missingControl: 'ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY; directive.',
    potentialImpact: 'Unrestricted cross-tenant data exfiltration and unauthorized row insertions via public Supabase PostgREST endpoints.',
    remediation: 'Append ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY; and define multi-tenant policies (auth.uid() = user_id).',
    applicableExtensions: ['.sql'],
    execute(ctx: RuleExecutionContext): RuleMatch[] {
      const matches: RuleMatch[] = [];
      const content = ctx.fileContent;
      const lines = ctx.lines;

      const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s*\(/gi;
      let m: RegExpExecArray | null;

      while ((m = createTableRegex.exec(content)) !== null) {
        const tableName = m[1];
        if (tableName.startsWith('auth_') || tableName.startsWith('_')) continue;

        // Check if file contains enable RLS for this specific table
        const enableRlsRegex = new RegExp(`ALTER\\s+TABLE\\s+(?:public\\.)?${tableName}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i');
        if (!enableRlsRegex.test(content)) {
          // Find line number
          const matchIndex = m.index;
          let lineNum = 1;
          for (let i = 0; i < matchIndex; i++) {
            if (content[i] === '\n') lineNum++;
          }

          const start = Math.max(0, lineNum - 1);
          const end = Math.min(lines.length - 1, lineNum + 4);
          const snippet = lines.slice(start, end + 1).join('\n');

          matches.push({
            ruleId: 'SEC-CFG-001',
            title: `Table '${tableName}' Does Not Have Row Level Security Enabled`,
            category: 'CONFIGURATION',
            severity: 'CRITICAL',
            confidence: 'HIGH',
            filePath: ctx.filePath,
            lineStart: lineNum,
            lineEnd: Math.min(lines.length, lineNum + 4),
            trigger: `CREATE TABLE ${tableName}`,
            codeSnippet: snippet,
            description: `The database table '${tableName}' in migration '${ctx.filePath}' is created without Row Level Security enabled.`,
            missingControl: `ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;`,
            potentialImpact: 'Any authenticated or anonymous client with the public anon key can read or mutate records belonging to any user.',
            remediation: `Add to migration: ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY; CREATE POLICY "tenant_isolation" ON ${tableName} FOR ALL USING (auth.uid() = user_id);`,
          });
        }
      }

      return matches;
    },
  },

  // --------------------------------------------------------------------------
  // 2. Overly Permissive CORS (SEC-CFG-002)
  // --------------------------------------------------------------------------
  {
    id: 'SEC-CFG-002',
    name: 'Overly Permissive Wildcard CORS Configuration',
    category: 'CORS',
    severity: 'HIGH',
    confidence: 'HIGH',
    description: 'CORS configuration sets origin: "*" while credentials or authenticated headers are allowed.',
    missingControl: 'Explicit trusted domain allowlist for CORS origins.',
    potentialImpact: 'Arbitrary malicious origins can issue authenticated cross-site requests on behalf of victims.',
    remediation: 'Restrict CORS origins to explicit domains (e.g. https://app.example.com) and disallow wildcards when credentials are true.',
    applicableExtensions: ['.ts', '.js'],
    execute(ctx: RuleExecutionContext): RuleMatch[] {
      const matches: RuleMatch[] = [];
      const lines = ctx.lines;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          /origin\s*:\s*['"]\*['"]/.test(line) &&
          ctx.fileContent.includes('credentials: true')
        ) {
          const start = Math.max(0, i - 1);
          const end = Math.min(lines.length - 1, i + 3);
          const snippet = lines.slice(start, end + 1).join('\n');

          matches.push({
            ruleId: 'SEC-CFG-002',
            title: 'Overly Permissive CORS Wildcard with Credentials Enabled',
            category: 'CORS',
            severity: 'HIGH',
            confidence: 'HIGH',
            filePath: ctx.filePath,
            lineStart: i + 1,
            lineEnd: i + 1,
            trigger: line.trim(),
            codeSnippet: snippet,
            description: `CORS configuration in '${ctx.filePath}' specifies wildcard origin alongside credentials: true.`,
            missingControl: 'Domain allowlisting for cross-origin resource sharing.',
            potentialImpact: 'Cross-origin authenticated session hijacking and credential leakage to third-party domains.',
            remediation: 'Replace wildcard with explicit origins: origin: process.env.ALLOWED_ORIGINS?.split(",")',
          });
        }
      }
      return matches;
    },
  },

  // --------------------------------------------------------------------------
  // 3. Sensitive Data in Production Logger (SEC-CFG-003)
  // --------------------------------------------------------------------------
  {
    id: 'SEC-CFG-003',
    name: 'Plaintext Credentials Output in Log Streams',
    category: 'CONFIGURATION',
    severity: 'MEDIUM',
    confidence: 'HIGH',
    description: 'User passwords or authentication tokens printed to standard console or logger in plain text.',
    missingControl: 'Secret redaction and credential masking before outputting to log aggregators.',
    potentialImpact: 'Plaintext passwords and tokens stored in log storage and monitoring tools, accessible to staff or compromised log systems.',
    remediation: 'Redact password and token fields prior to writing to console.log or logging sinks.',
    applicableExtensions: ['.ts', '.js', '.py'],
    execute(ctx: RuleExecutionContext): RuleMatch[] {
      const matches: RuleMatch[] = [];
      const lines = ctx.lines;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          /(?:console\.log|logger\.info|logger\.debug)\s*\([^)]*(?:password|token|secret|apiKey)\b/i.test(line) &&
          !line.includes('[REDACTED]') &&
          !line.includes('maskSecret')
        ) {
          const start = Math.max(0, i - 1);
          const end = Math.min(lines.length - 1, i + 1);
          const snippet = lines.slice(start, end + 1).join('\n');

          matches.push({
            ruleId: 'SEC-CFG-003',
            title: 'Sensitive Credential Logged in Plain Text',
            category: 'CONFIGURATION',
            severity: 'MEDIUM',
            confidence: 'HIGH',
            filePath: ctx.filePath,
            lineStart: i + 1,
            lineEnd: i + 1,
            trigger: line.trim(),
            codeSnippet: snippet,
            description: `Plaintext credential parameter passed to logger output in '${ctx.filePath}'.`,
            missingControl: 'Log masking and credential filtering.',
            potentialImpact: 'Sensitive credentials exposed to third-party log management infrastructure.',
            remediation: 'Sanitize logs to omit credential fields or use a secure redaction utility.',
          });
        }
      }
      return matches;
    },
  },
];
