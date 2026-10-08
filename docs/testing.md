# SecuAI Testing Strategy & Test Suites

SecuAI adheres to a zero-mock validation standard. We never fake scan progress, fabricate findings, or generate synthetic test scores without underlying evidence.

## 1. Security Test Fixtures

Controlled, intentionally vulnerable and clean applications are maintained under `test/fixtures/security/`:

- **`test/fixtures/security/vulnerable-node-app`**:
  - Express.js application with deliberately seeded security flaws:
    - `SEC-INJ-001`: SQL Injection via string interpolation in raw queries.
    - `SEC-INJ-002`: Command Injection via `child_process.exec(cmd + user_input)`.
    - `SEC-AUTH-001`: Unauthenticated mutating route (`PATCH /api/settings`).
    - `SEC-CFG-002`: Overly permissive CORS wildcard (`*`).
    - `SEC-SEC-001`: Exposed Supabase Service Role JWT token hardcoded in source.
    - `SEC-CFG-003`: Sensitive credentials logged in plaintext (`console.log(password)`).
    - `SEC-CFG-001`: PostgreSQL table lacking Row Level Security (RLS) in migrations.
- **`test/fixtures/security/clean-node-app`**:
  - Hardened reference application:
    - Parameterized database queries (`$1, $2`).
    - Authenticated middleware guarding all administrative routes.
    - Strict origin CORS allowlisting.
    - Secrets accessed strictly via environment variables.
    - Redacted logging and RLS enabled with tenant isolation policies.

## 2. Automated Test Scripts

The test suites validate deterministic detection, fingerprint stability, patch verification, and copilot reasoning:

### Script 1: Master Unified Scanner Validation
File: `scripts/test-unified-scanner.ts`
Runs 7 comprehensive end-to-end verification tests:
1. **TEST A**: Vulnerable Repository Detection (verifies expected findings, scores, and evidence).
2. **TEST B**: Clean Repository Ingestion (verifies 0 findings, 100/100 score, and absence of hallucinations).
3. **TEST C**: ZIP Archive Pipeline (verifies safe extraction and deterministic detection).
4. **TEST D**: Live Web Endpoint Inspection (verifies SSRF guardrails and non-destructive header analysis).
5. **TEST E**: Finding Lifecycle & Verification (proves OPEN $\to$ PATCH APPLIED $\to$ VERIFIED).
6. **TEST F**: AI Assistant Prioritization ("What should I fix first?" ranks real findings).
7. **TEST G**: AI Assistant Posture Assessment ("Is my app secure?" gives evidence-grounded evaluation).

Run command:
```bash
npx tsx scripts/test-unified-scanner.ts
```

### Script 2: Finding Verification Engine Suite
File: `scripts/test-verify-finding.ts`
Executes 9 unit and integration tests across AST and regex re-evaluation:
1. Verifies unpatched code fails verification.
2. Verifies clean parameterized code passes verification.
3. Tests SQL injection patch verification.
4. Tests Missing Authentication patch verification.
5. Tests CORS wildcard patch verification.
6. Tests Leaked Secrets patch verification.
7. Tests Command Injection patch verification.
8. Tests In-Memory Git diff verification (`EngineVerifier`).
9. Tests Security score recomputation on resolution.

Run command:
```bash
npx tsx scripts/test-verify-finding.ts
```

## 3. Production Build Validation

To verify type safety and compilation across all workspaces:
```bash
npm run build
```
Builds `packages/shared`, `engine/adapter`, `apps/api`, and `apps/web`.
