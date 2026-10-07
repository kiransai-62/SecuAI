import http from 'http';
import os from 'os';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import app from '../apps/api/src/server.js';
import { config } from '../apps/api/src/config.js';
import { safeExtractZip } from '../apps/api/src/lib/safeExtract.js';

process.env.NODE_ENV = 'test';

const TEST_PORT = 4997;
let server: http.Server;

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const testResults: TestResult[] = [];

function assert(condition: boolean, name: string, message: string) {
  if (!condition) {
    testResults.push({ name, passed: false, message: `FAILED: ${message}` });
    throw new Error(`[Scans Test Failure] ${name}: ${message}`);
  }
  testResults.push({ name, passed: true, message });
}

/**
 * Creates raw ZIP buffers with custom filenames, file attributes, and sizes.
 * Used to construct realistic zip-slip, symlink, and zip bomb attack vectors.
 */
function createRawZip(
  entries: Array<{
    name: string;
    content?: Buffer;
    externalAttributes?: number;
    uncompressedSizeOverride?: number;
    compressionMethod?: number;
  }>
): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const dataBuf = entry.content || Buffer.from('test data\n', 'utf8');
    const uncompressedSize =
      entry.uncompressedSizeOverride !== undefined
        ? entry.uncompressedSizeOverride
        : dataBuf.length;
    const compressedSize = dataBuf.length;

    const compressionMethod = entry.compressionMethod !== undefined ? entry.compressionMethod : 0;

    // Local File Header (30 bytes + name length)
    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // general purpose flag
    localHeader.writeUInt16LE(compressionMethod, 8); // compression method
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0, 12); // mod date
    localHeader.writeUInt32LE(0, 14); // crc32
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field len
    nameBuf.copy(localHeader, 30);

    const localChunk = Buffer.concat([localHeader, dataBuf]);
    localHeaders.push(localChunk);

    // Central Directory Header (46 bytes + name length)
    const centralHeader = Buffer.alloc(46 + nameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // PK\x01\x02
    centralHeader.writeUInt16LE(0x0314, 4); // version made by (Unix, 20)
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0, 8); // flags
    centralHeader.writeUInt16LE(compressionMethod, 10); // compression method
    centralHeader.writeUInt16LE(0, 12); // mod time
    centralHeader.writeUInt16LE(0, 14); // mod date
    centralHeader.writeUInt32LE(0, 16); // crc32
    centralHeader.writeUInt32LE(compressedSize, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra field len
    centralHeader.writeUInt16LE(0, 32); // comment len
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal file attributes
    // External file attributes (unsigned uint32)
    const extAttr = (entry.externalAttributes !== undefined ? entry.externalAttributes : 0o100644 << 16) >>> 0;
    centralHeader.writeUInt32LE(extAttr, 38);
    centralHeader.writeUInt32LE(offset, 42); // local header relative offset
    nameBuf.copy(centralHeader, 46);

    centralHeaders.push(centralHeader);
    offset += localChunk.length;
  }

  const centralDir = Buffer.concat(centralHeaders);

  // End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // PK\x05\x06
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // start disk
  eocd.writeUInt16LE(entries.length, 8); // records on disk
  eocd.writeUInt16LE(entries.length, 10); // total records
  eocd.writeUInt32LE(centralDir.length, 12); // size of central directory
  eocd.writeUInt32LE(offset, 16); // offset of central directory
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localHeaders, centralDir, eocd]);
}

/**
 * HTTP multipart request helper for uploading files
 */
async function uploadMultipart(
  pathUrl: string,
  token: string,
  fieldName: string,
  fileName: string,
  fileBuffer: Buffer
): Promise<{ status: number; body: any }> {
  const boundary = `----SecuAIBoundary${Date.now()}`;
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\nContent-Type: application/zip\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;

  const payload = Buffer.concat([
    Buffer.from(header, 'utf8'),
    fileBuffer,
    Buffer.from(footer, 'utf8'),
  ]);

  return new Promise((resolve, reject) => {
    const req = http.request(
      `http://localhost:${TEST_PORT}${pathUrl}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': payload.length.toString(),
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let parsed: any = {};
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = { raw: data };
          }
          resolve({ status: res.statusCode || 0, body: parsed });
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function requestJson(
  pathUrl: string,
  token: string,
  method: string = 'GET',
  body?: any
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const req = http.request(
      `http://localhost:${TEST_PORT}${pathUrl}`,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData).toString() } : {}),
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let parsed: any = {};
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = { raw: data };
          }
          resolve({ status: res.statusCode || 0, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function createToken(sub: string, email: string): string {
  return jwt.sign(
    { sub, email, role: 'authenticated', aud: 'authenticated' },
    config.jwtSecret,
    { expiresIn: 3600 }
  );
}

const USER_A_ID = 'aaaa1111-aaaa-1111-aaaa-1111aaaa1111';
const USER_B_ID = 'bbbb2222-bbbb-2222-bbbb-2222bbbb2222';
const tokenA = createToken(USER_A_ID, 'user_a@secuai.dev');
const tokenB = createToken(USER_B_ID, 'user_b@secuai.dev');

async function runScansSuite() {
  console.log('======================================================================');
  console.log('🔒  SecuAI Scans & Malicious Extraction Attack Vector Test Suite');
  console.log('======================================================================\n');

  // Start test server
  await new Promise<void>((resolve) => {
    server = app.listen(TEST_PORT, () => {
      console.log(`✔ API server listening on http://localhost:${TEST_PORT}\n`);
      resolve();
    });
  });

  try {
    // --------------------------------------------------------------------------
    // Test 1: Malicious Case 1 - Zip-Slip Archive Rejected
    // --------------------------------------------------------------------------
    console.log('--- Test 1: Attack Vector - Zip-Slip Archive (Must be Rejected) ---');
    const zipSlipBuffer = createRawZip([
      { name: '../../etc/passwd', content: Buffer.from('malicious payload') },
      { name: 'app/index.js', content: Buffer.from('console.log("hello");') },
    ]);

    const slipTempDir = path.join(os.tmpdir(), `secuai-test-slip-${Date.now()}`);
    let slipError: Error | null = null;
    try {
      await safeExtractZip(zipSlipBuffer, slipTempDir);
    } catch (err: any) {
      slipError = err;
    }

    assert(Boolean(slipError), 'Zip Slip Throws Error', 'Expected error for Zip Slip archive');
    assert(
      slipError!.message.toLowerCase().includes('zip slip') ||
        slipError!.message.toLowerCase().includes('traversal'),
      'Zip Slip Error Message',
      `Expected Zip Slip rejection message, got: ${slipError!.message}`
    );
    assert(
      !fs.existsSync(slipTempDir),
      'Zip Slip Clean Failure Cleanup',
      'Destination directory must be completely deleted on failure'
    );
    console.log(`✔ Zip-Slip attack successfully neutralized: "${slipError!.message}"\n`);

    // --------------------------------------------------------------------------
    // Test 2: Malicious Case 2 - Symlink Archive Rejected
    // --------------------------------------------------------------------------
    console.log('--- Test 2: Attack Vector - Symlink Archive (Must be Rejected) ---');
    // External attribute with POSIX S_IFLNK (0o120000 | 0o777) shifted by 16 bits
    const symlinkAttr = (0o120777 << 16) >>> 0;
    const symlinkBuffer = createRawZip([
      {
        name: 'symlink_to_root',
        content: Buffer.from('/etc/shadow'),
        externalAttributes: symlinkAttr,
      },
    ]);

    const symlinkTempDir = path.join(os.tmpdir(), `secuai-test-symlink-${Date.now()}`);
    let symlinkError: Error | null = null;
    try {
      await safeExtractZip(symlinkBuffer, symlinkTempDir);
    } catch (err: any) {
      symlinkError = err;
    }

    assert(Boolean(symlinkError), 'Symlink Throws Error', 'Expected error for symlink in archive');
    assert(
      symlinkError!.message.toLowerCase().includes('symlink'),
      'Symlink Error Message',
      `Expected Symlink rejection message, got: ${symlinkError!.message}`
    );
    assert(
      !fs.existsSync(symlinkTempDir),
      'Symlink Clean Failure Cleanup',
      'Destination directory must be deleted on symlink failure'
    );
    console.log(`✔ Symlink attack successfully neutralized: "${symlinkError!.message}"\n`);

    // --------------------------------------------------------------------------
    // Test 3: Malicious Case 3 - Zip Bomb Rejected (> 150MB uncompressed)
    // --------------------------------------------------------------------------
    console.log('--- Test 3: Attack Vector - Zip Bomb (Must be Rejected) ---');
    const zipBombBuffer = createRawZip([
      {
        name: 'huge_file.dat',
        content: Buffer.from('small compressed content'),
        uncompressedSizeOverride: 160 * 1024 * 1024, // 160MB claimed uncompressed
        compressionMethod: 8,
      },
    ]);

    const bombTempDir = path.join(os.tmpdir(), `secuai-test-bomb-${Date.now()}`);
    let bombError: Error | null = null;
    try {
      await safeExtractZip(zipBombBuffer, bombTempDir);
    } catch (err: any) {
      bombError = err;
    }

    assert(Boolean(bombError), 'Zip Bomb Throws Error', 'Expected error for 160MB zip bomb');
    assert(
      bombError!.message.toLowerCase().includes('zip bomb') ||
        bombError!.message.toLowerCase().includes('150mb'),
      'Zip Bomb Error Message',
      `Expected Zip Bomb rejection message, got: ${bombError!.message}`
    );
    assert(
      !fs.existsSync(bombTempDir),
      'Zip Bomb Clean Failure Cleanup',
      'Destination directory must be deleted on zip bomb failure'
    );
    console.log(`✔ Zip Bomb attack successfully neutralized: "${bombError!.message}"\n`);

    // --------------------------------------------------------------------------
    // Test 4: Setup Project for API Scan Tests
    // --------------------------------------------------------------------------
    console.log('--- Test 4: Create User A Project ---');
    const createProjectRes = await requestJson('/api/projects', tokenA, 'POST', {
      name: 'Scan Test Target Project',
      source_type: 'ZIP',
    });
    assert(createProjectRes.status === 201, 'Project Creation', `Expected 201, got ${createProjectRes.status}`);
    const projectA = createProjectRes.body.project;
    console.log(`✔ Project created: ${projectA.id}\n`);

    // --------------------------------------------------------------------------
    // Test 5: Malicious Case 4 - Non-GitHub URLs Rejected with 400
    // --------------------------------------------------------------------------
    console.log('--- Test 5: Non-GitHub URLs Rejected with 400 ---');
    const invalidUrls = [
      'http://github.com/org/repo', // non-https
      'https://gitlab.com/org/repo', // non-github
      'https://evil.com/fake-repo.git', // untrusted host
      'https://github.com/missing-repo', // incomplete path
      'https://github.com/org/repo/extra/path', // extraneous path
      'not-a-valid-url', // garbage string
    ];

    for (const badUrl of invalidUrls) {
      const res = await requestJson(`/api/projects/${projectA.id}/scans`, tokenA, 'POST', {
        repository_url: badUrl,
      });
      assert(
        res.status === 400,
        `Reject Invalid URL: ${badUrl}`,
        `Expected 400 for "${badUrl}", got ${res.status}`
      );
      assert(
        res.body.error && res.body.error.includes('https://github.com/<owner>/<repo>'),
        `Error mentions GitHub format for "${badUrl}"`,
        `Expected error message with format requirements, got: ${JSON.stringify(res.body)}`
      );
    }
    console.log(`✔ All ${invalidUrls.length} invalid/non-GitHub URLs rejected with clean 400 errors.\n`);

    // --------------------------------------------------------------------------
    // Test 6: Valid ZIP creates a QUEUED Scan
    // --------------------------------------------------------------------------
    console.log('--- Test 6: Valid ZIP Upload Creates QUEUED Scan ---');
    const validZipBuffer = createRawZip([
      { name: 'src/index.js', content: Buffer.from('console.log("Safe Code");') },
      { name: 'package.json', content: Buffer.from('{"name": "test-app", "version": "1.0.0"}') },
    ]);

    const uploadRes = await uploadMultipart(
      `/api/projects/${projectA.id}/scans`,
      tokenA,
      'file',
      'app-code.zip',
      validZipBuffer
    );

    assert(
      uploadRes.status === 201,
      'Valid ZIP Scan Creation',
      `Expected 201, got ${uploadRes.status}: ${JSON.stringify(uploadRes.body)}`
    );

    const scan = uploadRes.body.scan;
    assert(Boolean(scan?.id), 'Scan ID Generated', 'Scan must have an ID');
    assert(
      scan.status === 'QUEUED',
      'Scan Status QUEUED',
      `CRITICAL RULE: Scan status must be "QUEUED", got "${scan.status}"`
    );
    assert(
      scan.target_type === 'upload',
      'Scan target_type is upload',
      `Expected target_type "upload", got "${scan.target_type}"`
    );
    assert(
      scan.storage_path.startsWith(`uploads/${USER_A_ID}/${scan.id}`),
      'Storage path matches uploads/{user_id}/{scan_id}.zip',
      `Expected path prefix uploads/${USER_A_ID}/${scan.id}, got "${scan.storage_path}"`
    );
    console.log(`✔ Valid ZIP successfully uploaded and queued: Scan ID ${scan.id} (Status: ${scan.status})\n`);

    // --------------------------------------------------------------------------
    // Test 7: Strict Tenant Isolation on POST /api/projects/:id/scans
    // User B gets 404 (not 403) on User A's project id
    // --------------------------------------------------------------------------
    console.log('--- Test 7: STRICT TENANT ISOLATION - User B gets 404 on User A Project ---');
    const userBScanRes = await requestJson(`/api/projects/${projectA.id}/scans`, tokenB, 'POST', {
      repository_url: 'https://github.com/valid/repo',
    });

    assert(
      userBScanRes.status === 404,
      'User B POST /api/projects/:id/scans -> 404',
      `CRITICAL RULE: Expected 404 (not 403), got ${userBScanRes.status}`
    );
    console.log(`✔ POST /api/projects/${projectA.id}/scans strictly returned 404 for User B.\n`);

    // --------------------------------------------------------------------------
    // Test 8: Valid GitHub URL Creates QUEUED Scan
    // --------------------------------------------------------------------------
    console.log('--- Test 8: Valid GitHub URL Creates QUEUED Scan ---');
    const githubScanRes = await requestJson(`/api/projects/${projectA.id}/scans`, tokenA, 'POST', {
      repository_url: 'https://github.com/secuai-org/safe-sample-repo',
    });

    assert(githubScanRes.status === 201, 'GitHub Scan Creation', `Expected 201, got ${githubScanRes.status}`);
    const ghScan = githubScanRes.body.scan;
    assert(
      ghScan.status === 'QUEUED',
      'GitHub Scan Status QUEUED',
      `Expected status QUEUED, got "${ghScan.status}"`
    );
    assert(
      ghScan.target_type === 'repo',
      'Target type repo',
      `Expected target_type "repo", got "${ghScan.target_type}"`
    );
    console.log(`✔ GitHub scan successfully queued: Scan ID ${ghScan.id} (Status: ${ghScan.status})\n`);

    console.log('======================================================================');
    console.log('🎉 ALL 4 MALICIOUS ATTACK CASES REJECTED & QUEUED SCANS VERIFIED!');
    console.log('======================================================================\n');
  } finally {
    server.close();
  }
}

runScansSuite().catch((err) => {
  console.error('\n❌ Scan Test Suite Failed:', err.message);
  if (server) server.close();
  process.exit(1);
});
