# Live Web Endpoint Scanning

The `WebScannerAdapter` provides non-destructive, passive, and safe active Dynamic Application Security Testing (DAST) for authorized web services and APIs.

## 1. Ownership & Authorization Mandate

SecuAI is strictly an authorized application security tool, not an indiscriminate internet scanner.

- The user must explicitly attest to ownership or written testing authorization in the UI:
  > *"I confirm that I own or have authorization to test this application."*
- Unattested scan requests are rejected.

## 2. SSRF & Network Protections

To prevent Server-Side Request Forgery against cloud metadata engines, internal microservices, and management planes:

1. **Protocol Restriction**: Only `http:` and `https:` schemes are permitted.
2. **IP & Hostname Denylist**:
   - Loops: `127.0.0.1`, `localhost`, `::1`
   - Private RFC 1918 subnets: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
   - Link-local & Cloud Metadata services: `169.254.169.254`, `fe80::/10`
   - Loopback & Multicast blocks: `0.0.0.0`, `224.0.0.0/4`
3. **Safe DNS Resolution**: Hostnames are validated to ensure they do not resolve to private or internal addresses before dispatching HTTP requests.
4. **Safety Limits**:
   - Connection timeout: 10,000 ms.
   - Redirect limit: Maximum 5 hops.
   - Response payload size limit: Capped at 5 MB to prevent memory exhaustion.
   - Rate limiting: Requests are paced to prevent denial of service against the target.

## 3. Inspection Stages

1. **Reachability Check**:
   - Performs a lightweight HTTP `HEAD` / `GET` probe.
   - If the target host cannot be reached, transitions to `SCAN_ERROR: Host unreachable`. It **never** reports "0 vulnerabilities" on connection failures.
2. **TLS / SSL Configuration Indicators**:
   - Inspects certificate validity, TLS protocol versions, and HTTPS redirection policies.
3. **HTTP Security Headers Inspection**:
   - `Content-Security-Policy` (CSP)
   - `Strict-Transport-Security` (HSTS)
   - `X-Frame-Options` (Clickjacking defense)
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy`
   - `Permissions-Policy`
4. **CORS Policy Analysis**:
   - Evaluates `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials`.
   - Flags wildcard origin reflections (`*`) combined with credential sharing.
5. **Cookie Security Analysis**:
   - Inspects session cookies for missing `Secure`, `HttpOnly`, and `SameSite` flags.
6. **Technology Fingerprinting**:
   - Extracts server headers (`Server`, `X-Powered-By`) and client framework indicators.
