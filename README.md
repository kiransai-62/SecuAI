# SecuAI 🛡️

**SecuAI** is an autonomous AppSec feedback platform engineered for AI-generated applications. It introduces a closed security engineering loop:

$$\text{DETECT} \longrightarrow \text{EXPLAIN} \longrightarrow \text{FIX} \longrightarrow \text{VERIFY} \longrightarrow \text{RE-SCAN}$$

---

## 🌟 Upstream Engine Attribution

SecuAI relies on **[`isitsecure`](https://github.com/jaurakunal/isitsecure)** by **Kunal Jaura** as its core static and dynamic security analysis engine.
All vulnerability detection and verification across SAST, DAST, secrets, and PostgreSQL/Supabase RLS policies are performed via the `isitsecure` engine subprocess.

---

## 🏛️ Architecture & Principles

1. **Strict Division of Responsibility**:
   - **Scanner Engine (`isitsecure`)**: Performs **100%** of vulnerability detection and patch verification.
   - **AI Assistant (`Gemini 3.8`)**: Operates **strictly server-side**. Gemini only explains root causes and blast radii and proposes unified git diffs; it **never** sets finding statuses or security scores.
2. **Zero Redis / BullMQ**:
   - Background jobs are managed via a Node.js polling worker querying Supabase/Postgres (`WHERE status = 'queued'`).
3. **Multi-Tenant Security**:
   - Supabase PostgreSQL with strict Row Level Security (RLS) policies.
   - Unauthorized attempts to access other users' resources return **`404 Not Found`** (not `403 Forbidden`) to prevent resource enumeration.
4. **Code Execution Safety**:
   - Uploaded or scanned code is **never executed** — only static AST, taint, and policy checks are performed.
5. **Deterministic Fingerprints**:
   - Findings are tracked via deterministic SHA-256 fingerprints: `sha256(rule + normalized_path + sink_or_endpoint)`. Line numbers are intentionally excluded to ensure persistence across refactors and whitespace changes.

---

## 📂 Monorepo Structure

```text
SecuAI/
├── apps/
│   ├── api/                 # Express + TS backend (Helmet, Zod, Gemini server-side, worker)
│   └── web/                 # React 19 + Vite + Tailwind CSS + TanStack Query dashboard
├── packages/
│   └── shared/              # Zod schemas (FindingSchema, etc.) & TypeScript contracts
├── engine/
│   └── adapter/             # isitsecure subprocess runner, normalizer, and fixtures
│       ├── __fixtures__/    # Authentic sample.json from demo app scan
│       ├── run.ts           # Non-shell process spawn with timeout
│       ├── normalize.ts     # Field mapper & stable SHA-256 fingerprinting
│       └── adapter.test.ts  # Test suite verifying acceptance criteria
├── supabase/
│   └── migrations/          # 001_secuai_schema.sql (RLS enabled on all tables)
├── demo-vulnerable-app/     # Sample app with RLS weaknesses, secrets, and auth issues
└── Dockerfile               # Single container packaging Node.js + Python + isitsecure
```

---

## 🧪 Testing the Engine Adapter

To execute the unit tests against the real fixture:

```bash
npx tsx --test engine/adapter/adapter.test.ts
```

All 6 test suites pass with:

- `≥ 1 CRITICAL / HIGH` findings validated.
- Access control (`rls_misconfiguration`, `auth_weakness`) findings confirmed.
- Strict `FindingSchema` Zod validation enforced on every finding.
- Stable fingerprints independent of line numbers.
- Unmappable upstream fields documented.
- Fallback verification by fingerprint diff verified.

---

## 🚀 Running Locally

```bash
# Install dependencies across monorepo
npm install

# Build all packages
npm run build

# Start API & Postgres worker
npm run dev:api

# Start Web Dashboard
npm run dev:web
```

---

## 🐳 Docker Deployment

A single multi-runtime container packages Node.js 22, Python 3.11, and `isitsecure`:

```bash
docker build -t secuai .
docker run -p 4000:4000 secuai
```
