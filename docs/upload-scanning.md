# Source Code & ZIP Upload Scanning

The ZIP upload pipeline enables developers to scan arbitrary project archives without connecting third-party VCS accounts. Because archive extraction is historically a major attack vector, SecuAI implements defensive containment controls.

## 1. Archive Ingestion Security Controls

To prevent path traversal, zip bombs, and remote code execution:

1. **Size Limits**:
   - Maximum upload archive size capped at 50 MB (`MAX_FILE_SIZE`).
2. **MIME & Header Verification**:
   - Validates `application/zip`, `application/x-zip-compressed`, and magic bytes (`PK\x03\x04`).
3. **Safe Extraction (`safeExtractZip`)**:
   - Utilizes `adm-zip` entries inspection before extraction.
   - Rejects entries with path traversal sequences (`../`, `..\\`).
   - Rejects absolute paths (`/etc/passwd`, `C:\Windows`).
   - Resolves target extraction paths and verifies `path.resolve(dest, entryName).startsWith(dest)`.
   - Disallows extraction of symlinks pointing outside the workspace.
4. **Execution Prevention**:
   - Archive contents are never compiled, run, or evaluated.
   - Package manager installation (`npm install`, `pip install`) is **strictly forbidden**.

## 2. Inventory & Scanning Architecture

Once safely extracted:
1. `DiscoveryEngine` crawls the directory structure and constructs the full inventory.
2. The extracted directory is fed to `SourceScannerAdapter`, `SecretScannerAdapter`, `ConfigurationScannerAdapter`, and `DependencyScannerAdapter`.
3. Deterministic findings are generated with line numbers, code snippets, and evidence.
4. The workspace is preserved under `apps/api/workspaces/upload-:id` so that the user can propose diffs and verify them on the extracted codebase using `PatchVerifier`.
