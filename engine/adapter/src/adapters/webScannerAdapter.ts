import dns from 'dns/promises';
import http from 'http';
import https from 'https';
import crypto from 'crypto';
import { SecurityScannerAdapter } from './securityScannerAdapter.js';
import { ScanInput, DiscoverySummary, NormalizedFinding } from '../types.js';

export class WebScannerAdapter extends SecurityScannerAdapter {
  readonly name = 'WebScannerAdapter';

  /**
   * SSRF and IP validator: Rejects loopback, link-local, private RFC 1918, and cloud metadata IPs
   */
  static async validateUrlSecurity(targetUrl: string, allowLocalhost = false): Promise<{ valid: boolean; error?: string; resolvedIp?: string }> {
    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return { valid: false, error: 'Malformed URL structure. Must be a valid http:// or https:// URL.' };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: `Unauthorized protocol '${parsed.protocol}'. Only HTTP and HTTPS are permitted.` };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Rebind protection: resolve hostname to IPv4/IPv6
    let ip = '';
    try {
      const lookup = await dns.lookup(hostname);
      ip = lookup.address;
    } catch (err: any) {
      return { valid: false, error: `DNS resolution failed for host '${hostname}': ${err.message}` };
    }

    if (!allowLocalhost) {
      // Loopback
      if (ip === '127.0.0.1' || ip === '::1' || hostname === 'localhost') {
        return { valid: false, error: `Scanning localhost / loopback addresses (${ip}) is strictly forbidden without local override.` };
      }

      // AWS / Cloud Metadata (169.254.169.254) & Link-Local (169.254.0.0/16)
      if (ip.startsWith('169.254.')) {
        return { valid: false, error: 'Scanning cloud metadata or link-local addresses (169.254.0.0/16) is blocked.' };
      }

      // RFC 1918 Private Subnets
      if (
        ip.startsWith('10.') ||
        ip.startsWith('192.168.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) ||
        ip === '0.0.0.0'
      ) {
        return { valid: false, error: `Scanning internal RFC 1918 private subnets (${ip}) is forbidden.` };
      }
    }

    return { valid: true, resolvedIp: ip };
  }

  async scan(input: ScanInput, discovery: DiscoverySummary): Promise<NormalizedFinding[]> {
    const target = input.targetUrl || input.targetPath;
    if (!target) {
      throw new Error('Target URL is required for live endpoint scan.');
    }

    if (!input.confirmedOwnership) {
      throw new Error('Scan aborted: User did not confirm ownership or authorization to test this endpoint.');
    }

    // SSRF Check
    const allowLocal = process.env.NODE_ENV === 'test' || Boolean(process.env.ALLOW_LOCAL_DAST);
    const secCheck = await WebScannerAdapter.validateUrlSecurity(target, allowLocal);
    if (!secCheck.valid) {
      throw new Error(`SSRF Guard Violation: ${secCheck.error}`);
    }

    const findings: NormalizedFinding[] = [];
    const parsed = new URL(target);

    // 1. Probe Root URL
    let rootResponse: { statusCode: number; headers: Record<string, string>; body: string };
    try {
      rootResponse = await this.fetchWithTimeout(target, { timeoutMs: 10000, maxRedirects: 3 });
    } catch (netErr: any) {
      // Per specification: A failed connection is NOT a vulnerability, but a SCAN_ERROR
      throw new Error(`The authorized endpoint could not be reached: ${netErr.message}`);
    }

    const headers = rootResponse.headers;

    // Discovery tracking
    discovery.endpoints.push(target);
    if (headers['server']) discovery.technologies.push(`Server: ${headers['server']}`);
    if (headers['x-powered-by']) discovery.technologies.push(`Engine: ${headers['x-powered-by']}`);

    // Check 1: Missing Content-Security-Policy (CSP)
    if (!headers['content-security-policy']) {
      findings.push(
        this.createWebFinding({
          title: 'Missing Content-Security-Policy (CSP) Header',
          category: 'SECURITY_HEADERS',
          severity: 'MEDIUM',
          confidence: 'HIGH',
          endpoint: target,
          description: `The live endpoint '${target}' does not return a Content-Security-Policy header.`,
          trigger: 'Missing Content-Security-Policy',
          missingControl: 'Content-Security-Policy HTTP response header.',
          potentialImpact: 'Elevated susceptibility to Cross-Site Scripting (XSS) and data injection attacks.',
          remediation: "Configure Content-Security-Policy: default-src 'self'; script-src 'self'",
          evidenceData: { status_code: rootResponse.statusCode, headers },
        })
      );
    }

    // Check 2: Missing Strict-Transport-Security (HSTS) on HTTPS
    if (parsed.protocol === 'https:' && !headers['strict-transport-security']) {
      findings.push(
        this.createWebFinding({
          title: 'Missing HTTP Strict Transport Security (HSTS) Header',
          category: 'SECURITY_HEADERS',
          severity: 'LOW',
          confidence: 'HIGH',
          endpoint: target,
          description: `The HTTPS endpoint '${target}' does not enforce Strict-Transport-Security.`,
          trigger: 'Missing Strict-Transport-Security',
          missingControl: 'Strict-Transport-Security: max-age=31536000; includeSubDomains',
          potentialImpact: 'Vulnerability to SSL-stripping and man-in-the-middle downgrade attacks.',
          remediation: 'Configure HSTS: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
          evidenceData: { status_code: rootResponse.statusCode, headers },
        })
      );
    }

    // Check 3: Overly Permissive CORS (Access-Control-Allow-Origin: *)
    if (headers['access-control-allow-origin'] === '*') {
      findings.push(
        this.createWebFinding({
          title: 'Overly Permissive CORS Wildcard on Live Endpoint',
          category: 'CORS',
          severity: 'HIGH',
          confidence: 'HIGH',
          endpoint: target,
          description: `Endpoint returns Access-Control-Allow-Origin: * permitting any external site to read API responses.`,
          trigger: 'Access-Control-Allow-Origin: *',
          missingControl: 'Explicit CORS origin allowlist.',
          potentialImpact: 'Cross-origin data harvesting by third-party malicious scripts.',
          remediation: 'Restrict Access-Control-Allow-Origin to authorized client origins.',
          evidenceData: { status_code: rootResponse.statusCode, headers },
        })
      );
    }

    // Check 4: Missing X-Content-Type-Options
    if (!headers['x-content-type-options']) {
      findings.push(
        this.createWebFinding({
          title: 'Missing X-Content-Type-Options Header (MIME Sniffing Risk)',
          category: 'SECURITY_HEADERS',
          severity: 'LOW',
          confidence: 'HIGH',
          endpoint: target,
          description: `Missing X-Content-Type-Options header allows browsers to MIME-sniff response payloads.`,
          trigger: 'Missing X-Content-Type-Options: nosniff',
          missingControl: 'X-Content-Type-Options: nosniff',
          potentialImpact: 'User-uploaded files may be executed as executable scripts by browsers.',
          remediation: 'Add header: X-Content-Type-Options: nosniff',
          evidenceData: { status_code: rootResponse.statusCode, headers },
        })
      );
    }

    // Check 5: Sensitive Information Disclosure (Server / X-Powered-By)
    if (headers['x-powered-by']) {
      findings.push(
        this.createWebFinding({
          title: `Server Technology Disclosure in Header (${headers['x-powered-by']})`,
          category: 'CONFIGURATION',
          severity: 'LOW',
          confidence: 'HIGH',
          endpoint: target,
          description: `The live endpoint exposes the exact backend runtime via the X-Powered-By header: '${headers['x-powered-by']}'.`,
          trigger: `X-Powered-By: ${headers['x-powered-by']}`,
          missingControl: 'Suppression of technology disclosure headers (app.disable("x-powered-by")).',
          potentialImpact: 'Provides reconnaissance intelligence to attackers searching for framework-specific vulnerabilities.',
          remediation: 'Disable X-Powered-By header: app.disable("x-powered-by") in Express or configure reverse proxy.',
          evidenceData: { status_code: rootResponse.statusCode, headers },
        })
      );
    }

    // Check 6: Safe Probe for Exposed Sensitive Files (/.env, /.git/HEAD)
    const sensitiveProbes = ['/.env', '/.git/HEAD'];
    for (const probePath of sensitiveProbes) {
      const probeUrl = new URL(probePath, target).toString();
      try {
        const probeRes = await this.fetchWithTimeout(probeUrl, { timeoutMs: 5000, maxRedirects: 1 });
        if (probeRes.statusCode === 200 && probeRes.body.length > 0) {
          const isRealEnv = probePath === '/.env' && (/^[A-Z0-9_]+=.+/m.test(probeRes.body) || probeRes.body.includes('KEY=') || probeRes.body.includes('SECRET='));
          const isRealGit = probePath === '/.git/HEAD' && probeRes.body.startsWith('ref: refs/');

          if (isRealEnv || isRealGit) {
            findings.push(
              this.createWebFinding({
                title: `Critical Sensitive File Exposure: ${probePath}`,
                category: 'SECRETS',
                severity: 'CRITICAL',
                confidence: 'HIGH',
                endpoint: probeUrl,
                description: `Sensitive file '${probePath}' is publicly accessible over the internet without authentication.`,
                trigger: `HTTP 200 at ${probeUrl}`,
                missingControl: 'Web server access controls prohibiting access to dotfiles.',
                potentialImpact: 'Full leak of production credentials, API keys, or version control repositories.',
                remediation: `Configure web server / reverse proxy to block requests to ${probePath} and all hidden files.`,
                evidenceData: { status_code: probeRes.statusCode, snippet: probeRes.body.slice(0, 100) },
              })
            );
          }
        }
      } catch {}
    }

    return findings;
  }

  private createWebFinding(params: {
    title: string;
    category: any;
    severity: any;
    confidence: any;
    endpoint: string;
    description: string;
    trigger: string;
    missingControl: string;
    potentialImpact: string;
    remediation: string;
    evidenceData: Record<string, unknown>;
  }): NormalizedFinding {
    const fpMaterial = `${params.category}:${params.endpoint}:${params.trigger}`;
    const fingerprint = crypto.createHash('sha256').update(fpMaterial).digest('hex');

    return {
      id: crypto.randomUUID(),
      fingerprint,
      title: params.title,
      category: params.category,
      severity: params.severity,
      confidence: params.confidence,
      source: 'DAST',
      filePath: null,
      lineStart: null,
      lineEnd: null,
      endpoint: params.endpoint,
      parameter: null,
      description: params.description,
      evidence: {
        scanner_name: 'secuai_web_dast_analyzer',
        trigger: params.trigger,
        missing_control: params.missingControl,
        potential_impact: params.potentialImpact,
        remediation_guidance: params.remediation,
        ...params.evidenceData,
      },
      remediation: params.remediation,
      status: 'OPEN',
    };
  }

  /**
   * Safe HTTP GET probe with strict timeout and redirect limit
   */
  private async fetchWithTimeout(
    targetUrl: string,
    options: { timeoutMs: number; maxRedirects: number }
  ): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> {
    return new Promise((resolve, reject) => {
      let redirectsRemaining = options.maxRedirects;

      const executeRequest = (currentUrl: string) => {
        let parsed: URL;
        try {
          parsed = new URL(currentUrl);
        } catch (err: any) {
          return reject(new Error(`Invalid URL: ${err.message}`));
        }

        const lib = parsed.protocol === 'https:' ? https : http;
        const req = lib.request(
          currentUrl,
          {
            method: 'GET',
            headers: {
              'User-Agent': 'SecuAI-Security-Scanner/1.0 (+https://secuai.dev; security-audit)',
              Accept: '*/*',
            },
            timeout: options.timeoutMs,
          },
          (res) => {
            const statusCode = res.statusCode || 0;

            // Handle redirect
            if (statusCode >= 300 && statusCode < 400 && res.headers.location && redirectsRemaining > 0) {
              redirectsRemaining--;
              const nextUrl = new URL(res.headers.location, currentUrl).toString();
              res.resume();
              return executeRequest(nextUrl);
            }

            const headerMap: Record<string, string> = {};
            for (const key in res.headers) {
              const val = res.headers[key];
              if (val) headerMap[key.toLowerCase()] = Array.isArray(val) ? val.join(', ') : val;
            }

            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
              if (body.length < 50000) body += chunk;
            });
            res.on('end', () => {
              resolve({ statusCode, headers: headerMap, body });
            });
          }
        );

        req.on('timeout', () => {
          req.destroy(new Error(`Connection timed out after ${options.timeoutMs}ms`));
        });

        req.on('error', (err) => {
          reject(err);
        });

        req.end();
      };

      executeRequest(targetUrl);
    });
  }
}
