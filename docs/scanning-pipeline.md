# Unified Scanning Pipeline Architecture

Every scan in SecuAI—whether initiated from a GitHub URL, a source code ZIP archive, or an authorized live web URL—flows through the same unified pipeline managed by `UnifiedScanPipeline` in `@secuai/engine-adapter`.

## 1. Pipeline Execution Phases

```
Scan Input (Target & Config)
             |
             v
[Phase 1: Isolation & Preparation]
   - Safe extraction / Git clone / Target reachability
   - Temporary workspace generation under /tmp or os.tmpdir()
             |
             v
[Phase 2: Discovery Engine]
   - Framework & Language identification (Node, Python, Go, Java, PHP, etc.)
   - Manifest parsing (package.json, requirements.txt, go.mod, pom.xml)
   - Route & API endpoint surface discovery (Express, Next.js, FastAPI, Flask)
   - Configuration & Migration inventory (SQL, Dockerfile, .env)
             |
             v
[Phase 3: Deterministic Security Analysis]
   - Source Code AST & Static Analysis
   - Secret & Credential Detection
   - Configuration & RLS Policy Analysis
   - Dependency Vulnerability Matching
   - Passive & Active HTTP/TLS Inspection (Web targets)
             |
             v
[Phase 4: Normalization & Deduplication]
   - Canonical SHA-256 fingerprint generation
   - Evidence binding (code snippet, rule ID, extracted parameter)
   - Severity & Confidence assignment
             |
             v
[Phase 5: Scoring & State Persistence]
   - Deterministic Security Score calculation: Base 100 - (Critical*25 + High*15 + Medium*7 + Low*2)
   - Regression analysis (re-scan comparison against previous state)
   - Database persistence (scans, findings, discovery_summary)
```

## 2. Scan Coverage & Discovery Summary Contract

Every scan produces a structured `discovery_summary` that is displayed transparently to developers:

```typescript
export interface DiscoverySummary {
  technologies: string[];
  frameworks: string[];
  languages: string[];
  packageManagers: string[];
  endpoints: string[];
  apiRoutes: string[];
  authenticationSurfaces: string[];
  sourceFiles: string[];
  configurationFiles: string[];
  manifests: string[];
  scanCoverage: {
    totalFilesScanned: number;
    routesDiscovered: number;
    dependenciesAnalyzed: number;
    rulesExecuted: number;
    durationMs: number;
    skippedAnalyzers?: string[];
  };
}
```

## 3. Finding Normalization Contract

All adapters conform to the standard `FindingRecord` schema:

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Unique database primary key |
| `fingerprint` | string (SHA-256) | Deterministic hash computed from category, file, line, parameter |
| `title` | string | Human-readable finding summary |
| `category` | string | Standardized category (e.g. `INJECTION`, `AUTH`, `SECRETS`, `CORS`) |
| `severity` | `CRITICAL` \| `HIGH` \| `MEDIUM` \| `LOW` \| `INFO` | Standard CVSS-aligned severity |
| `confidence` | number (0.0 - 1.0) | Scanner certainty rating |
| `source` | `SAST` \| `DAST` \| `SECRETS` \| `DEPENDENCY` \| `CONFIG` | Originating scanner adapter |
| `file_path` | string \| null | Relative path to source file |
| `line_start` | number \| null | Starting line number (1-indexed) |
| `line_end` | number \| null | Ending line number (1-indexed) |
| `endpoint` | string \| null | Route or URL if web finding |
| `evidence` | object | Mandatory technical proof (code snippet, rule ID, header, parameter) |
| `status` | `OPEN` \| `PATCH_PROPOSED` \| `VERIFIED` \| `REGRESSED` | Current lifecycle state |

## 4. Status Progression & State Machine

Scans progress through well-defined sequential states:
`QUEUED` $\to$ `INITIALIZING` $\to$ `DISCOVERING` $\to$ `ANALYZING` $\to$ `NORMALIZING` $\to$ `GENERATING_INSIGHTS` $\to$ `COMPLETED` (or `FAILED`).

If any scanner or worker encounters an unrecoverable runtime exception, the scan status transitions directly to `FAILED` with the exact error message recorded. A failure is **never** presented as "0 vulnerabilities".
