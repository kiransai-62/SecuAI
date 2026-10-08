# Gemini AI Security Assistant Architecture

The SecuAI AI Security Assistant operates as a dedicated security copilot grounded in the specific application context, rather than a generic ungrounded chatbot.

## 1. Core Operating Principles

1. **Server-Side Only**:
   - All Gemini interactions occur exclusively on the backend (`apps/api/src/services/gemini.ts`).
   - The `GEMINI_API_KEY` is strictly confined to server environment variables and is never exposed in client bundles or network traffic.
2. **Evidence-Grounded Explanations**:
   - The assistant only reasons over confirmed findings, code snippets, rule IDs, and discovery summaries passed in its prompt payload.
   - It is prohibited from fabricating non-existent vulnerabilities or claiming that an application is 100% secure when scans are limited in scope.
3. **Structured Schema Validation**:
   - AI outputs are parsed and enforced using Zod schemas (`AiExplanationSchema`, `AiDiffProposalSchema`).
   - If the AI engine is unreachable or returns unparseable markdown, the backend provides an intelligent deterministic fallback synthesized directly from the scanner's rule guidance.

## 2. Injected Context Envelope

When a developer queries the assistant, the prompt envelope automatically aggregates:

```json
{
  "project": {
    "name": "FinTech Core API",
    "framework": "Node.js / Express / PostgreSQL"
  },
  "scan": {
    "id": "scan-12345",
    "score": 68,
    "target_type": "repo",
    "findings_count": 3
  },
  "findings": [
    {
      "fingerprint": "a4b7...",
      "title": "SQL Injection Risk",
      "severity": "CRITICAL",
      "file_path": "src/routes/users.ts",
      "evidence": { "code_snippet": "db.query(`SELECT ... ${req.params.id}`)" }
    }
  ],
  "discovery": {
    "technologies": ["Express", "TypeScript"],
    "routes": ["/api/users", "/api/auth/login"],
    "scanCoverage": { "totalFilesScanned": 42 }
  },
  "user_query": "What should I fix first?"
}
```

## 3. Key Query Handlers

- **"What should I fix first?"**:
  Ranks open findings by severity (`CRITICAL` $\to$ `HIGH` $\to$ `MEDIUM` $\to$ `LOW`), exploitability, and architectural blast radius.
- **"Is my application secure?"**:
  Provides an honest, evidence-based assessment. Cites the deterministic security score, outlines resolved vs. unresolved risks, and explicitly details scan coverage limitations (e.g. unauthenticated surface boundaries).
- **"How do I fix this finding?"**:
  Generates targeted, contextual remediation explanations accompanied by unified git diff proposals.
