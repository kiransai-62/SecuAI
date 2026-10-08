# SecuAI Architecture Overview

SecuAI is an enterprise-grade Application Security Testing (AST) and Automated Remediation platform designed around the five-stage lifecycle:

$$\text{DETECT} \longrightarrow \text{EXPLAIN} \longrightarrow \text{FIX} \longrightarrow \text{VERIFY} \longrightarrow \text{SECURE}$$

## 1. High-Level System Topology

```
+-------------------------------------------------------------------------+
|                              Web Frontend                               |
|          React 19 + TypeScript + Vite + Tailwind CSS + Lucide           |
+-------------------------------------------------------------------------+
                                     |
                                     | REST API / SSE (JWT Auth)
                                     v
+-------------------------------------------------------------------------+
|                           Backend API Server                            |
|             Express.js + TypeScript (Port 4000) / Supabase RLS          |
+-------------------------------------------------------------------------+
                                     |
              +----------------------+----------------------+
              |                                             |
              v                                             v
+-----------------------------+               +---------------------------+
|    Asynchronous Workers     |               |   AI Assistant Service    |
|   (BullMQ / Direct Async)   |               |   (Gemini 2.5 Flash SDK)  |
+-----------------------------+               +---------------------------+
              |                                             |
              v                                             |
+-----------------------------------------------------------+-------------+
|                     Unified Security Engine (@secuai/engine-adapter)    |
|  - DiscoveryEngine (Frameworks, Manifests, Routes, Inventory)           |
|  - SecurityScannerAdapter (GitHub, ZIP, Web, Secrets, Deps, Config)     |
|  - Deterministic AST Rules (SQLi, Auth, IDOR, SSRF, Traversal, RLS)     |
|  - PatchVerifier & EngineVerifier (Deterministic Proof)                 |
+-------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                           Data Persistence                              |
|           PostgreSQL / Supabase (RLS Isolated) + Disk Workspaces        |
+-------------------------------------------------------------------------+
```

## 2. Monorepo Structure

- **`packages/shared`**: Shared TypeScript types, Zod schemas, Finding contracts, and security score algorithms.
- **`engine/adapter`**: Deterministic scanner engine containing:
  - `UnifiedScanPipeline`: Master coordinator for all scan modalities.
  - `DiscoveryEngine`: Language, framework, route, and package manager detector.
  - Scanner Adapters: `GitHubScannerAdapter`, `SourceScannerAdapter`, `WebScannerAdapter`, `SecretScannerAdapter`, `DependencyScannerAdapter`, `ConfigurationScannerAdapter`.
  - `PatchVerifier`: AST and pattern re-evaluation engine for deterministic patch verification.
  - `FindingNormalizer`: Deduplication, canonical hashing, and SHA-256 fingerprint generation.
- **`apps/api`**: REST API endpoints, JWT authentication, worker orchestration, rate limiting, and Gemini copilot service.
- **`apps/web`**: Single-Page Application (SPA) providing real-time scan state visualization, discovery metrics, interactive finding diffs, and verification controls.

## 3. Strict Separation of Concerns: Detection vs. AI

A critical architectural mandate of SecuAI is the separation of **Deterministic Security Analysis** from **AI Assistance**:

1. **Deterministic Security Engines**:
   - Primary detection is 100% deterministic using AST analysis, regex heuristics, header inspections, and dependency manifests.
   - Every finding contains concrete, verifiable evidence (file path, line range, code snippet, extracted parameter, and rule ID).
   - Gemini is **NEVER** permitted to invent, fabricate, or hallucinate vulnerabilities.
2. **AI Copilot (Gemini 2.5 Flash)**:
   - Interprets verified evidence produced by deterministic scanners.
   - Explains the architectural blast radius and root cause.
   - Formulates patch suggestions and automated diffs.
   - Runs strictly server-side (`GEMINI_API_KEY` is never leaked to the client).
3. **Deterministic Verification**:
   - Verification is performed exclusively by `PatchVerifier` and `EngineVerifier`.
   - The scanner re-evaluates the patched file or diff against the exact rule specification.
   - AI is never allowed to unilaterally mark a finding as `RESOLVED`.
