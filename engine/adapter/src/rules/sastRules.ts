import { SecurityRule, RuleMatch, RuleExecutionContext } from './types.js';

export const sastRules: SecurityRule[] = [
  // --------------------------------------------------------------------------
  // 1. SQL Injection (SEC-INJ-001)
  // --------------------------------------------------------------------------
  {
    id: 'SEC-INJ-001',
    name: 'SQL Injection via Direct String Concatenation',
    category: 'INJECTION',
    severity: 'CRITICAL',
    confidence: 'HIGH',
    description: 'Dynamic user inputs are directly concatenated or interpolated into SQL query strings without parameterization.',
    missingControl: 'Parameterized SQL queries (prepared statements) with bound variables ($1, ?).',
    potentialImpact: 'Arbitrary database command execution, unauthorized data exfiltration, database tampering, and authentication bypass.',
    remediation: 'Use parameterized queries ($1, ?) or an ORM with type-safe query builders rather than string interpolation.',
    applicableExtensions: ['.ts', '.js', '.tsx', '.jsx', '.py'],
    execute(ctx: RuleExecutionContext): RuleMatch[] {
      const matches: RuleMatch[] = [];
      const lines = ctx.lines;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Pattern 1: Template literal in db.query(`SELECT ... ${...}`)
        const templateSqlRegex = /(?:db|pool|client|connection|prisma\.\$queryRawUnsafe)\.(?:query|execute|\$queryRawUnsafe)\s*\(\s*`[^`]*(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)[^`]*\$\{([^}]+)\}/i;
        // Pattern 2: String concat in query('SELECT ... ' + req.params...)
        const concatSqlRegex = /(?:db|pool|client|connection)\.(?:query|execute)\s*\(\s*['"][^'"]*(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)[^'"]*['"]\s*\+\s*(?:req\.|params|body|query|id)/i;

        let trigger = '';
        if (templateSqlRegex.test(line)) {
          const m = line.match(templateSqlRegex);
          trigger = m ? m[0] : line.trim();
        } else if (concatSqlRegex.test(line)) {
          const m = line.match(concatSqlRegex);
          trigger = m ? m[0] : line.trim();
        }

        // Multi-line template literal check
        if (!trigger && /SELECT|INSERT|UPDATE|DELETE/i.test(line) && /\$\{req\.(?:params|query|body)/.test(line)) {
          trigger = line.trim();
        }

        if (trigger) {
          const start = Math.max(0, i - 1);
          const end = Math.min(lines.length - 1, i + 2);
          const snippet = lines.slice(start, end + 1).join('\n');

          matches.push({
            ruleId: 'SEC-INJ-001',
            title: 'SQL Injection Vulnerability via Unsanitized Input Concatenation',
            category: 'INJECTION',
            severity: 'CRITICAL',
            confidence: 'HIGH',
            filePath: ctx.filePath,
            lineStart: i + 1,
            lineEnd: i + 1,
            trigger,
            codeSnippet: snippet,
            description: `The file '${ctx.filePath}' constructs a dynamic SQL statement using direct interpolation of request variables.`,
            missingControl: 'Parameterized query placeholders ($1, ?) with explicit variable binding.',
            potentialImpact: 'An attacker can supply malicious SQL fragments to read arbitrary tables or delete database records.',
            remediation: 'Replace string templates with prepared statement placeholders: query("SELECT * FROM users WHERE id = $1", [req.params.id])',
          });
        }
      }

      return matches;
    },
  },

  // --------------------------------------------------------------------------
  // 2. Command Injection (SEC-INJ-002)
  // --------------------------------------------------------------------------
  {
    id: 'SEC-INJ-002',
    name: 'Command Injection via child_process.exec',
    category: 'INJECTION',
    severity: 'CRITICAL',
    confidence: 'HIGH',
    description: 'Operating system command constructed dynamically with user-controlled input executed via shell.',
    missingControl: 'Process execution with arguments array (execFile/spawn) and shell: false.',
    potentialImpact: 'Arbitrary remote code execution (RCE) on the host operating system.',
    remediation: 'Use child_process.execFile() or spawn() with strict arguments array and shell: false.',
    applicableExtensions: ['.ts', '.js', '.mjs'],
    execute(ctx: RuleExecutionContext): RuleMatch[] {
      const matches: RuleMatch[] = [];
      const lines = ctx.lines;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/(?:exec|execSync)\s*\(\s*`[^`]*\$\{[^}]+\}/.test(line) || /(?:exec|execSync)\s*\(\s*['"][^'"]*['"]\s*\+\s*(?:req\.|params|input)/.test(line)) {
          const start = Math.max(0, i - 1);
          const end = Math.min(lines.length - 1, i + 2);
          const snippet = lines.slice(start, end + 1).join('\n');

          matches.push({
            ruleId: 'SEC-INJ-002',
            title: 'Remote Command Injection via Unescaped Shell Command',
            category: 'INJECTION',
            severity: 'CRITICAL',
            confidence: 'HIGH',
            filePath: ctx.filePath,
            lineStart: i + 1,
            lineEnd: i + 1,
            trigger: line.trim(),
            codeSnippet: snippet,
            description: `Unsanitized parameters are passed directly to a system shell execution call in '${ctx.filePath}'.`,
            missingControl: 'Disabling shell interpolation (shell: false) and passing distinct argv argument arrays.',
            potentialImpact: 'Full host system takeover and persistent backdoors.',
            remediation: 'Use spawn("command", [arg1, arg2], { shell: false }) without passing strings through a system shell.',
          });
        }
      }
      return matches;
    },
  },

  // --------------------------------------------------------------------------
  // 3. Missing Authentication on Mutating Route (SEC-AUTH-001)
  // --------------------------------------------------------------------------
  {
    id: 'SEC-AUTH-001',
    name: 'Missing Authentication Guard on Mutating Endpoint',
    category: 'AUTHENTICATION',
    severity: 'HIGH',
    confidence: 'HIGH',
    description: 'Destructive deletion or administrative route handler exposed publicly without authentication middleware.',
    missingControl: 'Authentication and session verification middleware (authMiddleware).',
    potentialImpact: 'Unauthenticated callers can delete user accounts, alter tenant configurations, or trigger state mutations.',
    remediation: 'Enforce authentication middleware as a prerequisite handler before processing route logic.',
    applicableExtensions: ['.ts', '.js'],
    execute(ctx: RuleExecutionContext): RuleMatch[] {
      const matches: RuleMatch[] = [];
      const lines = ctx.lines;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match destructive methods like app.delete("/api/...", async (req, res) => ...) with NO auth middleware in between
        const unguardedDelete = /(?:app|router)\.(delete)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(?:async\s*)?\(\s*req/i;
        const unguardedAdmin = /(?:app|router)\.(post|put|patch)\s*\(\s*['"`](\/api\/(?:admin|settings|users|account)[^'"`]*)['"`]\s*,\s*(?:async\s*)?\(\s*req/i;

        let m = line.match(unguardedDelete) || line.match(unguardedAdmin);
        if (m) {
          const endpoint = m[2];
          const start = Math.max(0, i);
          const end = Math.min(lines.length - 1, i + 4);
          const snippet = lines.slice(start, end + 1).join('\n');

          matches.push({
            ruleId: 'SEC-AUTH-001',
            title: `Missing Authentication Middleware on ${m[1].toUpperCase()} ${endpoint}`,
            category: 'AUTHENTICATION',
            severity: 'HIGH',
            confidence: 'HIGH',
            filePath: ctx.filePath,
            lineStart: i + 1,
            lineEnd: i + 1,
            endpoint,
            trigger: line.trim(),
            codeSnippet: snippet,
            description: `The route handler '${endpoint}' performs mutating operations without verifying caller session or token.`,
            missingControl: 'JWT or session authentication middleware protecting endpoint.',
            potentialImpact: 'Unauthenticated users can perform unauthorized deletions or mutations.',
            remediation: `Add authentication guard: router.${m[1]}('${endpoint}', authMiddleware, async (req, res) => ...)`,
          });
        }
      }
      return matches;
    },
  },

  // --------------------------------------------------------------------------
  // 4. Broken Object Level Authorization (IDOR) (SEC-IDOR-001)
  // --------------------------------------------------------------------------
  {
    id: 'SEC-IDOR-001',
    name: 'Broken Object Level Authorization (IDOR) in Resource Retrieval',
    category: 'AUTHORIZATION',
    severity: 'HIGH',
    confidence: 'HIGH',
    description: 'Endpoint fetches tenant resource using request parameter ID without verifying resource ownership or tenant boundary.',
    missingControl: 'Multi-tenant ownership check (user_id = req.user.id or tenant_id check).',
    potentialImpact: 'Horizontal privilege escalation allowing users to view or manipulate other users\' private data by changing numeric/UUID identifiers.',
    remediation: 'Filter resource queries by tenant ownership: WHERE id = $1 AND user_id = $2',
    applicableExtensions: ['.ts', '.js'],
    execute(ctx: RuleExecutionContext): RuleMatch[] {
      const matches: RuleMatch[] = [];
      const lines = ctx.lines;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          /(?:db|database|repository)\.(?:findOne|getById|findById|findUnique)\s*\(\s*(?:req\.params\.id|\{?\s*id:\s*req\.params\.id)/.test(line) &&
          !line.includes('user_id') &&
          !line.includes('tenant_id')
        ) {
          const start = Math.max(0, i - 1);
          const end = Math.min(lines.length - 1, i + 3);
          const snippet = lines.slice(start, end + 1).join('\n');

          matches.push({
            ruleId: 'SEC-IDOR-001',
            title: 'Insecure Direct Object Reference (IDOR) on Resource Lookup',
            category: 'AUTHORIZATION',
            severity: 'HIGH',
            confidence: 'HIGH',
            filePath: ctx.filePath,
            lineStart: i + 1,
            lineEnd: i + 1,
            trigger: line.trim(),
            codeSnippet: snippet,
            description: `Resource retrieval in '${ctx.filePath}' looks up records strictly by client-supplied ID without verifying that the record belongs to the authenticated user.`,
            missingControl: 'Caller tenant ownership validation (WHERE user_id = auth.uid()).',
            potentialImpact: 'Attackers can enumerate sequential or UUID identifiers to access private records of other users.',
            remediation: 'Always include the authenticated user\'s ID in the query filter: findOne({ where: { id: req.params.id, userId: req.user.id } })',
          });
        }
      }
      return matches;
    },
  },

  // --------------------------------------------------------------------------
  // 5. Missing Input Validation (SEC-VAL-001)
  // --------------------------------------------------------------------------
  {
    id: 'SEC-VAL-001',
    name: 'Missing Input Schema Validation on Route Parameters',
    category: 'INPUT_VALIDATION',
    severity: 'HIGH',
    confidence: 'HIGH',
    description: 'Endpoint consumes URL parameters or request bodies without schema validation, allowing unexpected payloads or types.',
    missingControl: 'Zod or Joi schema validation middleware.',
    potentialImpact: 'Unhandled runtime exceptions, type confusion, or unexpected state mutations.',
    remediation: 'Validate all request parameters and body fields against a strict Zod schema before processing.',
    applicableExtensions: ['.ts', '.js'],
    execute(ctx: RuleExecutionContext): RuleMatch[] {
      const matches: RuleMatch[] = [];
      const lines = ctx.lines;

      // Look for functions extracting req.params without any validation library in the file
      const hasValidationLibrary = ctx.fileContent.includes('zod') || ctx.fileContent.includes('validate') || ctx.fileContent.includes('Joi');
      if (hasValidationLibrary) return [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          /(?:const|let)\s*\{\s*id\s*\}\s*=\s*req\.params/.test(line) &&
          lines.slice(i, i + 4).some((l) => /fetchUser|getUser|query|find/.test(l))
        ) {
          const start = Math.max(0, i - 1);
          const end = Math.min(lines.length - 1, i + 3);
          const snippet = lines.slice(start, end + 1).join('\n');

          matches.push({
            ruleId: 'SEC-VAL-001',
            title: 'Missing Schema Validation on Route Parameters',
            category: 'INPUT_VALIDATION',
            severity: 'HIGH',
            confidence: 'HIGH',
            filePath: ctx.filePath,
            lineStart: i + 1,
            lineEnd: i + 1,
            trigger: line.trim(),
            codeSnippet: snippet,
            description: `Route parameters in '${ctx.filePath}' are passed into data processing functions without type or format validation.`,
            missingControl: 'Zod schema validation middleware (validateParams(IdSchema)).',
            potentialImpact: 'Malformed data causes unhandled server exceptions or bypasses internal assertions.',
            remediation: 'Define a Zod validator: const IdSchema = z.string().uuid(); and validate req.params.id.',
          });
        }
      }
      return matches;
    },
  },

  // --------------------------------------------------------------------------
  // 6. Server-Side Request Forgery (SSRF) (SEC-SSRF-001)
  // --------------------------------------------------------------------------
  {
    id: 'SEC-SSRF-001',
    name: 'Server-Side Request Forgery (SSRF) via User-Supplied URL',
    category: 'SSRF',
    severity: 'HIGH',
    confidence: 'HIGH',
    description: 'HTTP client fetches user-supplied URL directly without IP or private network verification.',
    missingControl: 'SSRF guard validating destination host against private IP ranges and cloud metadata services.',
    potentialImpact: 'Access to internal microservices, AWS metadata credentials (169.254.169.254), or local network scanning.',
    remediation: 'Validate hostnames, resolve DNS ahead of connect, and strictly prohibit private IP subnets.',
    applicableExtensions: ['.ts', '.js', '.py'],
    execute(ctx: RuleExecutionContext): RuleMatch[] {
      const matches: RuleMatch[] = [];
      const lines = ctx.lines;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          /(?:axios\.get|axios\.post|fetch|http\.get|request)\s*\(\s*(?:req\.body\.(?:url|target|endpoint)|req\.query\.(?:url|target))/.test(line)
        ) {
          const start = Math.max(0, i - 1);
          const end = Math.min(lines.length - 1, i + 2);
          const snippet = lines.slice(start, end + 1).join('\n');

          matches.push({
            ruleId: 'SEC-SSRF-001',
            title: 'Potential Server-Side Request Forgery (SSRF)',
            category: 'SSRF',
            severity: 'HIGH',
            confidence: 'HIGH',
            filePath: ctx.filePath,
            lineStart: i + 1,
            lineEnd: i + 1,
            trigger: line.trim(),
            codeSnippet: snippet,
            description: `The application issues an outbound HTTP request directly to a client-specified URL in '${ctx.filePath}'.`,
            missingControl: 'Allowlist verification and private subnet / loopback IP blocking.',
            potentialImpact: 'Attacker can probe internal services and query link-local cloud metadata endpoints.',
            remediation: 'Enforce DNS resolution check, block RFC 1918 IPs and 169.254.169.254, or route through an egress proxy.',
          });
        }
      }
      return matches;
    },
  },

  // --------------------------------------------------------------------------
  // 7. Path Traversal (SEC-PATH-001)
  // --------------------------------------------------------------------------
  {
    id: 'SEC-PATH-001',
    name: 'Path Traversal via Unvalidated Filesystem Access',
    category: 'PATH_TRAVERSAL',
    severity: 'HIGH',
    confidence: 'HIGH',
    description: 'Filesystem operation reads or serves file based on user input without path containment validation.',
    missingControl: 'Path normalization and boundary containment checks.',
    potentialImpact: 'Arbitrary file read exposing system files (/etc/passwd, .env, source code).',
    remediation: 'Resolve absolute path and ensure it starts with the designated base directory.',
    applicableExtensions: ['.ts', '.js'],
    execute(ctx: RuleExecutionContext): RuleMatch[] {
      const matches: RuleMatch[] = [];
      const lines = ctx.lines;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          /(?:fs\.readFileSync|fs\.readFile|res\.sendFile)\s*\(\s*(?:path\.join\s*\([^)]*req\.(?:params|query|body)|req\.(?:params|query)\.(?:file|path|filename))/.test(line) &&
          !ctx.fileContent.includes('path.resolve')
        ) {
          const start = Math.max(0, i - 1);
          const end = Math.min(lines.length - 1, i + 2);
          const snippet = lines.slice(start, end + 1).join('\n');

          matches.push({
            ruleId: 'SEC-PATH-001',
            title: 'Path Traversal Vulnerability in File Handler',
            category: 'PATH_TRAVERSAL',
            severity: 'HIGH',
            confidence: 'HIGH',
            filePath: ctx.filePath,
            lineStart: i + 1,
            lineEnd: i + 1,
            trigger: line.trim(),
            codeSnippet: snippet,
            description: `Direct file system access using unvalidated path parameter in '${ctx.filePath}'.`,
            missingControl: 'Path boundary checking (resolvedPath.startsWith(baseDir)).',
            potentialImpact: 'Arbitrary local file disclosure via dot-dot-slash (../) sequences.',
            remediation: 'Validate normalized path with path.resolve() and reject paths outside the authorized root directory.',
          });
        }
      }
      return matches;
    },
  },

  // --------------------------------------------------------------------------
  // 8. Cross-Site Scripting (XSS) (SEC-XSS-001)
  // --------------------------------------------------------------------------
  {
    id: 'SEC-XSS-001',
    name: 'Cross-Site Scripting (XSS) via Unsanitized HTML Insertion',
    category: 'XSS',
    severity: 'MEDIUM',
    confidence: 'HIGH',
    description: 'Raw HTML inserted into DOM using dangerouslySetInnerHTML or innerHTML without HTML sanitization (DOMPurify).',
    missingControl: 'HTML sanitization with DOMPurify or contextual encoding.',
    potentialImpact: 'Session hijacking, credential theft, and unauthorized actions executed in victim browser context.',
    remediation: 'Sanitize HTML with DOMPurify.sanitize() before rendering, or use standard text elements.',
    applicableExtensions: ['.tsx', '.jsx', '.ts', '.js'],
    execute(ctx: RuleExecutionContext): RuleMatch[] {
      const matches: RuleMatch[] = [];
      const lines = ctx.lines;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:\s*(?!DOMPurify\.sanitize)/.test(line) ||
          /(?:\.innerHTML|\.outerHTML)\s*=\s*(?:req\.|props\.|user)/.test(line)
        ) {
          const start = Math.max(0, i - 1);
          const end = Math.min(lines.length - 1, i + 2);
          const snippet = lines.slice(start, end + 1).join('\n');

          matches.push({
            ruleId: 'SEC-XSS-001',
            title: 'Potential Cross-Site Scripting (XSS) via Unsanitized Raw HTML',
            category: 'XSS',
            severity: 'MEDIUM',
            confidence: 'HIGH',
            filePath: ctx.filePath,
            lineStart: i + 1,
            lineEnd: i + 1,
            trigger: line.trim(),
            codeSnippet: snippet,
            description: `Dynamic HTML insertion without sanitization detected in '${ctx.filePath}'.`,
            missingControl: 'DOMPurify sanitization before dangerous HTML injection.',
            potentialImpact: 'Client-side script execution and session cookie leakage.',
            remediation: 'Pass HTML through DOMPurify: dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}',
          });
        }
      }
      return matches;
    },
  },

  // --------------------------------------------------------------------------
  // 9. Weak Cryptography (SEC-CRYPTO-001)
  // --------------------------------------------------------------------------
  {
    id: 'SEC-CRYPTO-001',
    name: 'Use of Insecure or Deprecated Cryptographic Hash Algorithm',
    category: 'CRYPTOGRAPHY',
    severity: 'LOW',
    confidence: 'HIGH',
    description: 'Use of MD5 or SHA1 algorithms susceptible to hash collision attacks.',
    missingControl: 'Modern cryptographic primitives (SHA-256, SHA-512, bcrypt, argon2).',
    potentialImpact: 'Hash collision attacks and pre-image vulnerability.',
    remediation: 'Upgrade to SHA-256 for integrity hashing and bcrypt/argon2 for password hashing.',
    applicableExtensions: ['.ts', '.js', '.py'],
    execute(ctx: RuleExecutionContext): RuleMatch[] {
      const matches: RuleMatch[] = [];
      const lines = ctx.lines;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/createHash\s*\(\s*['"](?:md5|sha1)['"]\s*\)/i.test(line) || /hashlib\.(?:md5|sha1)\s*\(/i.test(line)) {
          const start = Math.max(0, i - 1);
          const end = Math.min(lines.length - 1, i + 2);
          const snippet = lines.slice(start, end + 1).join('\n');

          matches.push({
            ruleId: 'SEC-CRYPTO-001',
            title: 'Deprecated Weak Hash Algorithm (MD5 / SHA1)',
            category: 'CRYPTOGRAPHY',
            severity: 'LOW',
            confidence: 'HIGH',
            filePath: ctx.filePath,
            lineStart: i + 1,
            lineEnd: i + 1,
            trigger: line.trim(),
            codeSnippet: snippet,
            description: `Insecure hashing algorithm detected in '${ctx.filePath}'.`,
            missingControl: 'Cryptographically secure hashing algorithms (SHA-256 or bcrypt).',
            potentialImpact: 'Collision vulnerability allows attackers to forge signatures or hashes.',
            remediation: 'Replace crypto.createHash("md5") with crypto.createHash("sha256").',
          });
        }
      }
      return matches;
    },
  },
];
