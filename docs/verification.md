# Verification Engine

Verification is the cornerstone of SecuAI's **DETECT $\to$ EXPLAIN $\to$ FIX $\to$ VERIFY $\to$ SECURE** loop.

## 1. Scanner-Based Verification vs. AI Claims

**Rule**: An AI model is NEVER allowed to declare a security finding resolved.

In legacy or shallow tools, a large language model is asked: *"Did the developer fix this code?"*, which frequently results in hallucinations or false negatives.

In SecuAI, verification is strictly **engine-driven**:
- The patched file or proposed git diff is re-analyzed by `PatchVerifier` and `EngineVerifier` using the exact deterministic rule logic that originally triggered the finding.
- A finding only transitions to `VERIFIED` status if the underlying deterministic vulnerability pattern is genuinely absent.

## 2. Verification Workflows

SecuAI supports two complementary verification paths:

### Path A: Live Workspace Patch Verification (`PatchVerifier`)
1. The developer edits the source code in their workspace or applies an AI-generated patch diff via `POST /api/findings/:id/apply-fix`.
2. The developer triggers `POST /api/findings/:id/verify`.
3. The server locates the updated file in the isolated workspace on disk.
4. `PatchVerifier` executes the matching deterministic rule against the file content:
   - For `SEC-INJ-001` (SQL Injection): Verifies that dynamic string concatenation or template literal interpolation into query statements has been replaced with parameterized `$1, $2` binds.
   - For `SEC-AUTH-001` (Missing Auth): Verifies that session or JWT authentication middleware has been added before the handler.
   - For `SEC-CFG-002` (CORS Wildcard): Verifies that origin reflection (`*`) is replaced with strict allowed origins.
5. If clean: Returns `{ verified: true, status: 'VERIFIED' }`, records a `verification_run`, and increments the project security score.
6. If the vulnerability persists: Returns `{ verified: false, status: 'OPEN', reason: 'Vulnerability pattern still detected' }`.

### Path B: In-Memory Diff Verification (`EngineVerifier`)
1. The developer submits a unified git diff patch directly via `POST /api/findings/verify`.
2. `EngineVerifier` applies the diff to the base code snippet in a virtual buffer.
3. The modified content is inspected by the target rule logic.
4. Results are returned immediately without modifying disk state.

## 3. Score Recomputation Upon Verification

When a finding is marked `VERIFIED`:
1. The scan's finding counts are updated (`critical_count`, `high_count`, etc. decrement).
2. The deterministic score is recomputed:
   $$\text{Score} = \max\left(0, 100 - \sum \text{penalties}\right)$$
3. The delta is displayed on the dashboard (e.g. `+25 points from auto-fix`).
