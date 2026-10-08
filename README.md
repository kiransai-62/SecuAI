# SecuAI 🛡️
> **"Build with AI. Deploy with Confidence."**

SecuAI is an enterprise application security testing (AST) and automated remediation platform. It provides developers and platform engineers with a verified, closed-loop security workflow:

$$\text{DETECT} \longrightarrow \text{EXPLAIN} \longrightarrow \text{FIX} \longrightarrow \text{VERIFY} \longrightarrow \text{SECURE}$$

---

## 🌟 Core Product Workflows

1. **GitHub Repository Scanning**:
   - Automated ingestion and static analysis of remote repositories.
   - Isolated temporary workspace execution (code is never run or installed).
   - Deep discovery: frameworks, package manifests, routes, and authentication middleware.
   - Deterministic AST, secrets, configurations, and dependency scanners.
2. **Source Code / ZIP Archive Scanning**:
   - Defensive archive ingestion pipeline with zip-slip and path traversal protections.
   - Extracts into quarantined workspace and builds a comprehensive component inventory.
   - Scans for vulnerabilities, leaked tokens, and configuration flaws.
3. **Live Web Endpoint Scanning**:
   - Passive & safe active Dynamic Application Security Testing (DAST) for authorized targets.
   - Strict SSRF protection (private IP, loopback, and metadata service blocklist).
   - Header inspection (CSP, HSTS, X-Frame-Options), CORS validation, cookie flags, and TLS checks.
4. **AI Security Assistant (Gemini 2.5 Flash)**:
   - Dedicated security copilot operating **strictly on the backend** (`GEMINI_API_KEY` never leaks to the client).
   - Context-grounded in actual findings, scan coverage, and code snippets.
   - Answers priority queries ("What should I fix first?"), explains blast radius, and suggests unified git diffs.
   - **Zero Hallucination Rule**: AI never invents findings and cannot mark an issue resolved.
5. **Deterministic Verification Engine**:
   - Fix verification is 100% scanner-based using `PatchVerifier` and `EngineVerifier`.
   - Re-evaluates patched files against the exact deterministic rule logic.
   - Automatically recomputes the deterministic security score upon verified patch application.

---

## 🏛️ System Architecture

```text
SecuAI/
├── packages/
│   └── shared/              # Shared types, Zod schemas, Finding contracts & scoring logic
├── engine/
│   └── adapter/             # Unified scanner engine (@secuai/engine-adapter)
│       ├── src/
│       │   ├── pipeline.ts  # UnifiedScanPipeline coordinator
│       │   ├── discovery.ts # DiscoveryEngine (tech, manifests, routes)
│       │   ├── adapters.ts  # GitHub, Source, Web, Secret, Config, Dep adapters
│       │   ├── verifier.ts  # PatchVerifier & EngineVerifier
│       │   ├── normalize.ts # Deterministic SHA-256 fingerprinting & normalizer
│       │   └── rules.ts     # Deterministic AST & regex rules
│       └── __fixtures__/    # Upstream sample fixtures
├── apps/
│   ├── api/                 # Express backend (JWT, RLS, Workers, Gemini Copilot)
│   │   ├── src/
│   │   │   ├── worker.ts    # Background scan worker
│   │   │   ├── routes.ts    # REST API endpoints
│   │   │   ├── controllers/ # Scans, Findings, Projects, AI controllers
│   │   │   └── services/    # Gemini 2.5 SDK integration & prompt engineering
│   └── web/                 # React 19 + TypeScript + Vite + Tailwind CSS SPA
│       └── src/
│           ├── pages/       # NewScan, Findings, ScanDetail, AiAssistant, Projects
│           ├── components/  # Real-time state machine, charts, and diff viewer
│           └── services/    # REST API client
├── test/
│   └── fixtures/
│       └── security/        # Controlled vulnerable & clean test fixtures
│           ├── vulnerable-node-app/  # Known SQLi, Command Injection, CORS, Auth, Secrets
│           └── clean-node-app/       # Parameterized, authenticated, hardened reference app
├── scripts/                 # Master verification scripts (test-unified-scanner, test-verify-finding)
└── docs/                    # Technical architecture & subsystem documentation
```

---

## 📋 Comprehensive Documentation

Detailed specifications and architectural guides are available in [`docs/`](file:///c:/PROJECTS/SecuAI/docs):

- [Current System Audit](file:///c:/PROJECTS/SecuAI/docs/current-system-audit.md) - Deep codebase audit, broken components identified, and remediation strategy.
- [System Architecture](file:///c:/PROJECTS/SecuAI/docs/architecture.md) - High-level topology, monorepo breakdown, and separation of detection vs. AI.
- [Scanning Pipeline](file:///c:/PROJECTS/SecuAI/docs/scanning-pipeline.md) - Unified 5-phase pipeline, state machine, and discovery summary.
- [GitHub Repository Scanning](file:///c:/PROJECTS/SecuAI/docs/github-scanning.md) - Ingestion, safe shallow clone, discovery, and AST rules.
- [Source & ZIP Upload Scanning](file:///c:/PROJECTS/SecuAI/docs/upload-scanning.md) - Safe archive handling, size limits, and zip-slip prevention.
- [Live Web Endpoint Scanning](file:///c:/PROJECTS/SecuAI/docs/web-scanning.md) - Authorization checks, SSRF guardrails, passive and active checks.
- [AI Assistant Architecture](file:///c:/PROJECTS/SecuAI/docs/ai-assistant.md) - Server-side Gemini copilot, context payload, and structured output.
- [Verification Engine](file:///c:/PROJECTS/SecuAI/docs/verification.md) - Engine-based patch verification and score recomputation.
- [Security Model](file:///c:/PROJECTS/SecuAI/docs/security-model.md) - Multi-tenancy, RLS policies, code execution safety, and secret handling.
- [Testing Strategy](file:///c:/PROJECTS/SecuAI/docs/testing.md) - Fixtures, automated test runners, and zero-mock standards.

---

## ⚙️ Environment Variables

Create `.env` in `apps/api/`:

```bash
# Server Port
PORT=4000
NODE_ENV=development

# JWT Authentication
JWT_SECRET=your_super_secret_jwt_key_at_least_32_chars_long

# Gemini AI (Server-Side Only)
GEMINI_API_KEY=AIzaSy...

# Optional: Supabase PostgreSQL (Falls back to in-memory DB if omitted)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJh...
```

Create `.env` in `apps/web/`:

```bash
VITE_API_URL=http://localhost:4000/api
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0

### Installation
```bash
# Clone the repository
git clone https://github.com/kiransai-62/SecuAI.git
cd SecuAI

# Install all dependencies across workspaces
npm install

# Build all packages
npm run build
```

### Running Locally
```bash
# Terminal 1: Start Backend API (Port 4000)
npm --workspace=apps/api run dev

# Terminal 2: Start Frontend Web App (Port 5173)
npm --workspace=apps/web run dev
```

Visit `http://localhost:5173` in your browser.

---

## 🧪 Automated Testing & Validation

SecuAI comes with full test suites validating the end-to-end scanner against real fixtures:

```bash
# 1. Run Master Scanner Pipeline Test (Tests A through G)
npx tsx scripts/test-unified-scanner.ts

# 2. Run Finding Verification Suite (Tests 1 through 9)
npx tsx scripts/test-verify-finding.ts

# 3. Run Upstream Adapter Unit Tests
npm --workspace=engine/adapter test
```

### Master Validation Summary:
- **TEST A**: Vulnerable Repository $\longrightarrow$ Real findings detected, zero score, full evidence.
- **TEST B**: Clean Repository $\longrightarrow$ 0 findings, 100 score, no hallucinations.
- **TEST C**: ZIP Archive Ingestion $\longrightarrow$ Safe extraction, findings detected and persisted.
- **TEST D**: Live Web Scanning $\longrightarrow$ SSRF protections active, real security header findings.
- **TEST E**: Finding Lifecycle $\longrightarrow$ OPEN $\to$ Patch Applied $\to$ VERIFIED by scanner.
- **TEST F**: AI Assistant Prioritization $\longrightarrow$ Correctly ranks detected findings.
- **TEST G**: AI Assistant Posture Assessment $\longrightarrow$ Evidence-grounded posture appraisal with limitations.

---

## 🔒 Security Principles

- **No Mock Security Results**: No hardcoded findings or synthetic vulnerabilities in production workflows.
- **No Fake Progress**: All progress indicators reflect real backend worker states.
- **Deterministic Scores**: Score = 100 - (Critical $\times$ 25 + High $\times$ 15 + Medium $\times$ 7 + Low $\times$ 2).
- **Scanner-Driven Verification**: Only the deterministic security engine can verify patches.
