import dns from 'dns/promises';
import { URL } from 'url';
import net from 'net';
import http from 'http';
import https from 'https';
import { spawn } from 'child_process';
import crypto from 'crypto';
import { config } from '../config.js';
import { Finding } from '@secuai/shared';

/**
 * Prohibited IP ranges (SSRF & Metadata Protection):
 * - 10.0.0.0/8 (Private, RFC 1918)
 * - 172.16.0.0/12 (Private, RFC 1918)
 * - 192.168.0.0/16 (Private, RFC 1918)
 * - 127.0.0.0/8 (Loopback, RFC 1122)
 * - 169.254.0.0/16 (Link-Local & Cloud Metadata e.g. AWS/GCP 169.254.169.254)
 * - 0.0.0.0/8 (Current network)
 * - 100.64.0.0/10 (Carrier-Grade NAT)
 * - IPv6: ::1, fc00::/7 (Unique Local), fe80::/10 (Link-Local)
 */
export function isPrivateOrBlockedIp(ip: string): boolean {
  if (!ip) return true;

  let cleanedIp = ip.trim();

  // Strip IPv4-mapped IPv6 prefix
  if (cleanedIp.startsWith('::ffff:')) {
    cleanedIp = cleanedIp.replace('::ffff:', '');
  }

  // IPv4 inspection
  if (net.isIPv4(cleanedIp)) {
    const octets = cleanedIp.split('.').map((p) => parseInt(p, 10));
    if (octets.length !== 4 || octets.some((o) => isNaN(o) || o < 0 || o > 255)) {
      return true; // Malformed IP -> Block
    }

    const [b0, b1] = octets;

    // 0.0.0.0/8
    if (b0 === 0) return true;

    // 10.0.0.0/8
    if (b0 === 10) return true;

    // 127.0.0.0/8 (Loopback)
    if (b0 === 127) return true;

    // 169.254.0.0/16 (Link-local & AWS/GCP instance metadata 169.254.169.254)
    if (b0 === 169 && b1 === 254) return true;

    // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
    if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

    // 192.168.0.0/16
    if (b0 === 192 && b1 === 168) return true;

    // 100.64.0.0/10 (Shared Address Space / CGNAT)
    if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

    return false;
  }

  // IPv6 inspection
  if (net.isIPv6(cleanedIp)) {
    const normalized = cleanedIp.toLowerCase();
    // Loopback
    if (normalized === '::1' || normalized === '0000:0000:0000:0000:0000:0000:0000:0001') return true;
    // Unspecified
    if (normalized === '::' || normalized === '0000:0000:0000:0000:0000:0000:0000:0000') return true;
    // Link-local: fe80::/10
    if (
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb')
    ) {
      return true;
    }
    // Unique local: fc00::/7
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
      return true;
    }

    return false;
  }

  return true;
}

/**
 * Verifies authorization and security controls for a DAST target URL:
 * 1. Confirms ownership checkbox is explicitly true.
 * 2. Checks host against DAST_ALLOWED_HOSTS allowlist.
 * 3. Resolves DNS at connect time and verifies no private/link-local/metadata IPs.
 */
export async function validateDastTarget(
  targetUrl: string,
  confirmedOwnership: boolean,
  customAllowedHosts?: string[]
): Promise<{ valid: boolean; resolvedIp: string; hostname: string; error?: string }> {
  // 1. Mandatory ownership confirmation
  if (!confirmedOwnership) {
    return {
      valid: false,
      resolvedIp: '',
      hostname: '',
      error: 'Target ownership confirmation required. You must check the authorization checkbox.',
    };
  }

  // 2. Validate URL syntax
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return {
      valid: false,
      resolvedIp: '',
      hostname: '',
      error: 'Invalid target URL format. Must be a valid HTTP or HTTPS address.',
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      resolvedIp: '',
      hostname: parsed.hostname,
      error: `Unsupported protocol '${parsed.protocol}'. DAST scans only support HTTP and HTTPS.`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 3. Check DAST_ALLOWED_HOSTS allowlist
  const allowedHosts = (customAllowedHosts || config.dastAllowedHosts || [])
    .map((h) => h.toLowerCase().trim())
    .filter(Boolean);

  const isAllowedHost = allowedHosts.some((allowed) => {
    if (allowed === hostname) return true;
    if (allowed.startsWith('*.') && hostname.endsWith(allowed.slice(1))) return true;
    return false;
  });

  if (!isAllowedHost) {
    return {
      valid: false,
      resolvedIp: '',
      hostname,
      error: `Host '${hostname}' is not authorized. Target must match DAST_ALLOWED_HOSTS allowlist: [${allowedHosts.join(', ')}].`,
    };
  }

  // 4. If hostname is directly an IP, verify against blocklist
  if (net.isIP(hostname)) {
    if (isPrivateOrBlockedIp(hostname)) {
      return {
        valid: false,
        resolvedIp: hostname,
        hostname,
        error: `SSRF Guard: IP '${hostname}' belongs to a private, loopback, link-local, or cloud metadata range.`,
      };
    }
    return { valid: true, resolvedIp: hostname, hostname };
  }

  // 5. Re-resolve DNS at connect time to block DNS rebinding / private IP resolutions
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      return {
        valid: false,
        resolvedIp: '',
        hostname,
        error: `DNS resolution failed: Host '${hostname}' could not be resolved.`,
      };
    }

    // Verify all resolved IPs
    for (const record of addresses) {
      if (isPrivateOrBlockedIp(record.address)) {
        return {
          valid: false,
          resolvedIp: record.address,
          hostname,
          error: `SSRF Guard: Host '${hostname}' resolved to blocked private/link-local/metadata IP '${record.address}'.`,
        };
      }
    }

    return {
      valid: true,
      resolvedIp: addresses[0].address,
      hostname,
    };
  } catch (dnsErr: any) {
    return {
      valid: false,
      resolvedIp: '',
      hostname,
      error: `DNS lookup error for '${hostname}': ${dnsErr.message}`,
    };
  }
}

/**
 * Checks if the DAST engine browser (Playwright + Chromium) is runnable in the host environment.
 * If the engine cannot run, returns available: false with an explicit diagnostic reason.
 */
export async function checkDastBrowserAvailable(): Promise<{ available: boolean; reason?: string }> {
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

  return new Promise((resolve) => {
    // Probe Playwright and Chromium executable in Python
    const script = `
import sys
try:
    from playwright.sync_api import sync_playwright
    p = sync_playwright().start()
    try:
        path = p.chromium.executable_path
        p.stop()
        print("OK:" + str(path))
    except Exception as e:
        p.stop()
        print("NO_BROWSER:" + str(e))
except ImportError as e:
    print("NO_PLAYWRIGHT:" + str(e))
except Exception as e:
    print("ERROR:" + str(e))
`;

    const child = spawn(pythonCmd, ['-c', script], {
      env: process.env,
      timeout: 10000,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (err) => {
      resolve({
        available: false,
        reason: `Python runtime unavailable: ${err.message}`,
      });
    });

    child.on('close', (code) => {
      const output = stdout.trim();
      if (output.startsWith('OK:')) {
        resolve({ available: true });
        return;
      }

      if (output.startsWith('NO_PLAYWRIGHT:')) {
        resolve({
          available: false,
          reason: 'Playwright Python package is not installed in the container environment.',
        });
        return;
      }

      if (output.startsWith('NO_BROWSER:')) {
        resolve({
          available: false,
          reason: 'Chromium browser binaries are not installed or cannot run in this container environment.',
        });
        return;
      }

      resolve({
        available: false,
        reason: output || stderr.trim() || 'DAST browser environment verification failed',
      });
    });
  });
}

/**
 * Safely executes HTTP DAST probe:
 * - Cap redirects at 3
 * - Rate limit / sleep delay between requests
 * - 5 min maximum timeout
 * - Re-resolves DNS at each redirect hop and re-validates against SSRF rules
 */
export async function executeSafeDastProbe(
  targetUrl: string,
  confirmedOwnership: boolean,
  options: {
    maxRedirects?: number;
    timeoutMs?: number;
    delayBetweenRequestsMs?: number;
    customAllowedHosts?: string[];
  } = {}
): Promise<{
  statusCode: number;
  finalUrl: string;
  headers: http.IncomingHttpHeaders;
  redirectsFollowed: number;
}> {
  const maxRedirects = options.maxRedirects ?? 3;
  const timeoutMs = options.timeoutMs ?? 300000; // 5 min timeout
  const delayMs = options.delayBetweenRequestsMs ?? 200; // Request rate cap delay

  let currentUrl = targetUrl;
  let redirectsCount = 0;

  const startTime = Date.now();

  while (true) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`DAST execution exceeded 5 minute timeout (${timeoutMs}ms)`);
    }

    // Validate target & re-resolve DNS at connect time
    const validation = await validateDastTarget(
      currentUrl,
      confirmedOwnership,
      options.customAllowedHosts
    );

    if (!validation.valid) {
      throw new Error(`DAST SSRF Guard: ${validation.error}`);
    }

    // Rate limiting delay
    if (delayMs > 0 && redirectsCount > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }

    // Execute probe
    const parsed = new URL(currentUrl);
    const transport = parsed.protocol === 'https:' ? https : http;

    const res = await new Promise<{
      statusCode: number;
      headers: http.IncomingHttpHeaders;
    }>((resolve, reject) => {
      const req = transport.request(
        parsed,
        {
          method: 'GET',
          timeout: 15000,
          headers: {
            'User-Agent': 'SecuAI-DAST-Scanner/1.0 (+https://secuai.dev)',
            Accept: 'text/html,application/xhtml+xml,application/json,*/*',
          },
        },
        (response) => {
          response.resume(); // Discard body
          resolve({
            statusCode: response.statusCode || 200,
            headers: response.headers,
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Connection to '${parsed.hostname}' timed out`));
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.end();
    });

    // Check for redirect (301, 302, 303, 307, 308)
    const isRedirect =
      [301, 302, 303, 307, 308].includes(res.statusCode) &&
      Boolean(res.headers.location);

    if (isRedirect) {
      redirectsCount++;
      if (redirectsCount > maxRedirects) {
        throw new Error(
          `Redirect limit exceeded: Max ${maxRedirects} redirects allowed (attempted redirect #${redirectsCount})`
        );
      }

      const redirectLocation = String(res.headers.location);
      currentUrl = new URL(redirectLocation, currentUrl).toString();
      continue;
    }

    return {
      statusCode: res.statusCode,
      finalUrl: currentUrl,
      headers: res.headers,
      redirectsFollowed: redirectsCount,
    };
  }
}

/**
 * Normalizes live DAST scanner results into the platform Finding schema.
 */
export function normalizeDastFinding(dastResult: {
  title: string;
  category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  confidence: number;
  endpoint: string;
  description: string;
  evidence: Record<string, unknown>;
}): Finding {
  const fingerprintInput = `${dastResult.category}:${dastResult.endpoint}:${dastResult.title}`;
  const fingerprint = crypto.createHash('sha256').update(fingerprintInput).digest('hex');

  return {
    fingerprint,
    title: dastResult.title,
    category: dastResult.category,
    severity: dastResult.severity,
    confidence: Math.max(0, Math.min(1, dastResult.confidence)),
    source: 'DAST',
    file_path: null,
    line_start: null,
    line_end: null,
    endpoint: dastResult.endpoint,
    description: dastResult.description,
    evidence: dastResult.evidence,
  };
}
