# GitHub Repository Scanning

The `GitHubScannerAdapter` automates the secure ingestion and static security evaluation of remote Git repositories.

## 1. Workflow & Lifecycle

1. **URL Validation & Parsing**:
   - Validates that the provided URL adheres to standard GitHub formats (`https://github.com/:owner/:repo` or SSH variants).
   - Rejects non-HTTP schemes or malicious target parameters.
2. **Safe Workspace Isolation**:
   - Creates a temporary directory located inside the isolated workspace base folder (e.g. `apps/api/workspaces/github-:id` or `tmpdir`).
   - Repository source code is never executed, installed, or executed via post-install lifecycle scripts.
3. **Repository Ingestion**:
   - Safely clones the target repository using `git clone --depth 1`.
   - In offline test mode or development environments, if the repository is already present locally or network access is restricted, safely resolves the local mirror.
4. **Repository Inventory & Technology Discovery**:
   - Recursively traverses the working directory using `DiscoveryEngine`.
   - Identifies framework stacks: Next.js, Express, React, FastAPI, Flask, Django, Spring Boot, Go Gin, etc.
   - Detects package managers: `npm`, `yarn`, `pnpm`, `pip`, `poetry`, `maven`, `gradle`, `cargo`, `go modules`.
   - Extracts all API route declarations and authentication middleware.
5. **Security Scanning**:
   - Executes AST and regex analyzers (`SourceScannerAdapter`).
   - Executes secret scanners (`SecretScannerAdapter`) to locate exposed API tokens, private keys, database connection strings, and cloud credentials.
   - Executes configuration scanners (`ConfigurationScannerAdapter`) to detect missing database Row Level Security (RLS), insecure CORS configurations, and exposed debug parameters.
   - Executes dependency scanners (`DependencyScannerAdapter`) against detected manifest files.
6. **Finding Normalization & Persistence**:
   - Each vulnerability detected is assigned a canonical SHA-256 fingerprint.
   - Findings are persisted into the database linked to the project and scan.
7. **Workspace Lifecycle**:
   - Retains the cloned repository workspace during the active scan and subsequent developer patch verification lifecycle so that `PatchVerifier` can validate actual file fixes.
   - Automatically cleans up expired workspaces via scheduled cleanup tasks.
