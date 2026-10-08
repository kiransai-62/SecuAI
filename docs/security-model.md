# SecuAI Security & Isolation Model

SecuAI is built to analyze untrusted third-party code and web applications. As a security product, SecuAI enforces strict self-protection standards across its architecture.

## 1. Authentication & Multi-Tenancy

- **JWT Tokens & Passwords**:
  - Secure bcrypt hashing with work factor $\ge 10$ for local credentials.
  - JWT tokens signed with strong server-side secrets (`JWT_SECRET`).
- **Tenant Isolation**:
  - Every project, scan, finding, and verification run is bound to a specific `user_id`.
  - Database queries enforce Row-Level Security (RLS) policies in PostgreSQL.
  - Cross-tenant data access is blocked at both middleware (`assertTenantOwnership`) and database layers.

## 2. Ingestion Defense & Untrusted Code Isolation

1. **Zero Execution of User Code**:
   - SecuAI never runs arbitrary user code, never evaluates uploaded JavaScript/Python scripts, and never executes `npm install` or `pip install` during scanning.
2. **Path Traversal & Archive Extraction**:
   - Extraction of ZIP archives validates canonical destination paths to prevent zip-slip vulnerabilities.
   - Symlinks pointing outside extraction directories are rejected.
3. **Workspace Segregation**:
   - Temporary workspaces are segregated by project/scan ID within isolated directories.
   - Files are purged following retention schedules.

## 3. Network & SSRF Defenses

- All live web testing is restricted to explicit HTTP/HTTPS targets.
- Localhost, loopback (`127.0.0.0/8`, `::1`), link-local metadata addresses (`169.254.169.254`), and private RFC 1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) are blocked by default.
- Strict request timeouts and response payload bounds prevent denial of service.

## 4. API & Secret Protection

- `GEMINI_API_KEY` and database credentials are strictly isolated to server processes and never delivered to client code or serialized in JSON responses.
- Structured logs sanitize sensitive authentication headers, passwords, and API tokens.
