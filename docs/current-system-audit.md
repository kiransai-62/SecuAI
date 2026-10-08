# SecuAI Full Codebase & Architecture Audit
**Document:** `docs/current-system-audit.md`  
**Date:** October 7, 2026  
**Auditor:** Lead Security Engineer & Backend Architect  
**Project:** SecuAI — *Build with AI. Deploy with Confidence.*

---

## 1. Executive Summary

SecuAI is designed as an application security platform bridging deterministic static analysis (SAST), dynamic endpoint probing (DAST), software composition analysis (SCA), secret scanning, and automated remediation assistance powered by Gemini.

While the frontend presentation layer possesses a polished aesthetic, a comprehensive codebase audit reveals that **the underlying security analysis and verification workflows are either broken, partially mocked, or reliant on hardcoded fallback vectors**:
1. When the external Python scanner (`isitsecure`) is missing from the environment PATH, `engine/adapter/src/runner.ts` silently falls back to returning a static, hardcoded report containing 3 mock findings (`src/lib/supabase.ts`, `credits` table, etc.), irrespective of what repository or archive was scanned.
2. The frontend (`NewScanPage.tsx`) uses client-side `setTimeout` delays (1200ms, 2400ms, 3800ms) to simulate progress, and advances to "COMPLETED" even if the backend scan job crashed or failed (e.g., git clone failure).
3. The AI Security Assistant was previously disconnected or returning canned text, and lacks full structured schema integration with scan discovery and finding evidence.
4. Patch verification relied on external subprocesses or simulated verdicts rather than deterministic AST re-analysis.

This audit documents every layer of the system, inventories working vs. broken components, and establishes the blueprint for the unified, evidence-based security scanning architecture.

---

## 2. Architecture Overview

### 2.1 Workspace Structure (Monorepo)
- **`apps/api`**: Express 4 REST API, background worker polling loop, Supabase / in-memory database store, Gemini AI service.
- **`apps/web`**: Vite + React 19 + TypeScript + Tailwind CSS SPA with TanStack Query and React Router.
- **`packages/shared`**: Shared Zod schemas (`schemas.ts`), TypeScript definitions (`types.ts`), and deterministic scoring algorithm (`score.ts`).
- **`engine/adapter`**: Scanner execution wrapper (`runner.ts`, `run.ts`), normalization (`normalize.ts`), and patch verifier (`verifier.ts`).
- **`engine/isitsecure-src`**: Python source tree for the upstream `isitsecure` engine.
- **`supabase/migrations`**: PostgreSQL schema with RLS policies (`001_secuai_schema.sql`).

### 2.2 Data Flow & Storage
- **Database**: PostgreSQL (via Supabase) or local in-memory store (`memoryDb`) when `SUPABASE_URL` is omitted.
- **Tenancy**: Multi-tenant isolation enforced via `user_id` on projects, scans, findings, AI analyses, and verification runs.
- **Scan Queue**: Background worker polling `scans` table (`status = 'QUEUED'`) every 2000ms.

---

## 3. Component Inventory: Working, Broken & Missing

| Component / Workflow | Status | Description & Root Cause |
| :--- | :--- | :--- |
| **Authentication & JWT** | **WORKING** | Custom bcrypt + JWT with role claims; tested and passing in `scripts/test-auth.ts`. |
| **Tenant Isolation & RLS** | **WORKING** | Row Level Security policies defined in SQL and mirrored in `assertTenantOwnership`. |
| **Security Score Calculation** | **WORKING** | Deterministic score formula (100 base minus severity penalties) in `packages/shared/src/score.ts`. |
| **Safe Archive Extraction** | **WORKING** | `safeExtract.ts` validates zip headers, rejects path traversal (`..`), and isolates to temp folders. |
| **GitHub Repository Scanner** | **BROKEN** | Clones repo via git, but execution delegates to `isitsecure` which fails if Python module is not in PATH. Runner catches failure and returns 3 hardcoded mock findings (`getRealEngineReferenceReport`). |
| **ZIP Upload Scanner** | **BROKEN** | Same failure mode: extracts archive safely, but analysis engine falls back to hardcoded mock findings. |
| **Live Web Endpoint Scanner** | **PARTIAL / BROKEN** | Pre-flight check requires Playwright browser; if missing, aborts. If run, only checks 3 static headers (CSP, HSTS, CORS wildcard) on the root URL; no discovery or active security checks. |
| **Scan State & Progress** | **BROKEN** | Frontend `NewScanPage.tsx` uses simulated `setTimeout` delays rather than polling the real backend scan state (`QUEUED` -> `DISCOVERING` -> `ANALYZING` -> `COMPLETED`). |
| **AI Security Assistant** | **BROKEN** | Client previously lacked real backend chat link; backend lacked structured Zod schema output; Gemini key was unauthenticated; no scan context passed. |
| **Finding Normalization** | **PARTIAL** | Schema exists, but lacks unified coverage metrics (`discovery_summary`, file count, rule count, execution duration). |
| **Verification & Re-Scan** | **BROKEN** | Verifier calls Python subprocess or regex check; fails when scanner is unavailable. Does not re-run full AST checks. |
| **Automated Testing** | **MISSING** | No `npm test` script in root `package.json`; no controlled test fixtures in `test/fixtures/security/`. |

---

## 4. Detailed Audit of Problem Areas

### 4.1 Mock & Fake Security Results (Critical Violation)
- **`engine/adapter/src/runner.ts` (lines 101-240)**:
  ```typescript
  private static getRealEngineReferenceReport(targetPath: string): IsItSecureReport { ... }
  ```
  Returns hardcoded findings for `src/lib/supabase.ts` (service role key leak) and `supabase/migrations/001_create_tables.sql` (missing RLS on `credits` table). If a user scans a clean repository or a Python project, it still reports these identical Supabase vulnerabilities.
- **`apps/web/src/services/api.ts` (lines 10-108)**:
  `SAMPLE_FINDINGS` and `currentScanState` are hardcoded in the frontend and used as fallbacks whenever API responses are empty or fail.
- **`apps/web/src/pages/AiAssistantPage.tsx`**:
  Contained hardcoded `SAMPLE_FINDINGS` array and mock responses for question answering.

### 4.2 Simulated Progress Timers (Critical Violation)
- **`apps/web/src/pages/NewScanPage.tsx` (lines 197-233)**:
  ```typescript
  onSuccess: async (newScan) => {
    setActiveScan(newScan);
    setScanStepIndex(1);
    setTimeout(() => { setScanStepIndex(2); }, 1200);
    setTimeout(() => { setScanStepIndex(3); }, 2400);
    setTimeout(async () => {
      setViewState('report'); // Advances to report even if scan failed!
    }, 3800);
  }
  ```
  This creates an illusion of scanning while the backend job may be stuck, queued, or failed with Git error 128.

### 4.3 Subprocess Dependency Failure
The backend worker assumes `isitsecure` is an executable CLI or installed Python module. In environments where Python dependencies are not globally installed, every static code scan fails. Because of the fallback in `runner.ts`, the failure was disguised rather than surfaced or handled by a native deterministic engine.

### 4.4 Web Scanner Limitations
The URL scan path in `worker.ts`:
- Rejects targets unless Playwright browser is detected (`checkDastBrowserAvailable`).
- Probes only the provided URL and inspects response headers (`Content-Security-Policy`, `Strict-Transport-Security`, `Access-Control-Allow-Origin: *`).
- Does not perform safe endpoint mapping, form detection, or protocol analysis.

### 4.5 AI Assistant Isolation
- The AI assistant did not receive the active project context, tech stack, scan coverage, or actual findings.
- Failed to validate Gemini responses with structured Zod schemas, risking hallucinations or invented vulnerabilities.

---

## 5. Security & Architectural Risks in SecuAI Itself

1. **SSRF in Web Scanner**:
   Must enforce strict private subnet rejection (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16, AWS metadata `169.254.169.254`, IPv6 `::1`, loopbacks).
2. **Command Injection in Git Clone**:
   Currently safe (uses `spawn('git', args, { shell: false })`), but must ensure branch names and submodules cannot be exploited.
3. **Zip Slip / Path Traversal**:
   `safeExtract.ts` validates that extracted paths remain inside the target directory, but symlink dereferencing must be strictly disabled.
4. **Credential Leakage**:
   Gemini API keys must never be returned to the client or logged. Secret masking must be applied to all log outputs.

---

## 6. Recommended Target Architecture

### 6.1 Unified Scanner Adapter Interface
```
ScanInput (GitHub URL / ZIP Buffer / Web URL)
   ↓
Discovery Engine (Tech, Manifests, Routes, Configs)
   ↓
SecurityScannerAdapter
   ├── SourceScannerAdapter (Native AST & Static Taint Analysis)
   ├── SecretScannerAdapter (High-entropy token & credential detection)
   ├── DependencyScannerAdapter (Known vulnerable package audit)
   ├── ConfigurationScannerAdapter (CORS, RLS, TLS, Auth middleware audit)
   └── WebScannerAdapter (Safe passive/active HTTP/TLS probing)
   ↓
Finding Normalizer (Fingerprint, Severity, Confidence, Evidence)
   ↓
Deterministic Score Calculator (100 - Severity Penalties)
   ↓
Database Persistence (Scans, Findings, Discovery Summary)
   ↓
Gemini Security Assistant (Explains evidence, proposes verified diffs)
   ↓
Verification Engine (Scanner-based AST re-check)
```

### 6.2 Key Architectural Principles
1. **Zero Fake Findings**: If 0 vulnerabilities are found in a clean repository, report 0 vulnerabilities with full scan coverage transparency.
2. **Zero Fake Progress**: Frontend polls `/api/scans/:id` and updates progress directly from backend worker `progress_step` and `status`.
3. **Native Node.js Security Engine**: Implement a deterministic static analysis and discovery engine directly in TypeScript so scanning is 100% reliable without external Python environment dependencies, while supporting external engines when available.
4. **Evidence-First Findings**: Every finding must capture exact file path, line numbers, code snippet, trigger pattern, and architectural explanation.
5. **Deterministic Verification**: Verify fixes by re-running the specific scanner rule against the modified file in the workspace.
