import http from 'http';
import jwt from 'jsonwebtoken';
import app from '../apps/api/src/server.js';
import { config } from '../apps/api/src/config.js';

process.env.NODE_ENV = 'test';

const TEST_PORT = 4998;
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
    throw new Error(`[Projects Test Failure] ${name}: ${message}`);
  }
  testResults.push({ name, passed: true, message });
}

async function request(
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {}
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const postData = options.body ? JSON.stringify(options.body) : '';
    const req = http.request(
      `http://localhost:${TEST_PORT}${path}`,
      {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData).toString() } : {}),
          ...options.headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
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

function createTestToken(sub: string, email: string): string {
  return jwt.sign(
    {
      sub,
      email,
      role: 'authenticated',
      aud: 'authenticated',
    },
    config.jwtSecret,
    { expiresIn: 3600 }
  );
}

const USER_A_ID = 'aaaa1111-aaaa-1111-aaaa-1111aaaa1111';
const USER_B_ID = 'bbbb2222-bbbb-2222-bbbb-2222bbbb2222';

const tokenA = createTestToken(USER_A_ID, 'user_a@secuai.dev');
const tokenB = createTestToken(USER_B_ID, 'user_b@secuai.dev');

async function runProjectsTests() {
  console.log('======================================================================');
  console.log('🚀  SecuAI Projects Module & Tenant Isolation Test Suite');
  console.log('======================================================================\n');

  // Start API server on isolated test port
  await new Promise<void>((resolve) => {
    server = app.listen(TEST_PORT, () => {
      console.log(`✔ Test API server listening on http://localhost:${TEST_PORT}\n`);
      resolve();
    });
  });

  try {
    // --------------------------------------------------------------------------
    // Test 1: Zod Validation on POST /api/projects
    // --------------------------------------------------------------------------
    console.log('--- Test 1: Zod Schema Validation ---');

    // 1a. Missing / Empty Name
    const resEmptyName = await request('/api/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { name: '', source_type: 'ZIP' },
    });
    assert(
      resEmptyName.status === 400,
      'Reject Empty Name',
      `Expected 400 for empty name, got ${resEmptyName.status}`
    );

    // 1b. Name exceeding 80 characters
    const resLongName = await request('/api/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { name: 'A'.repeat(81), source_type: 'ZIP' },
    });
    assert(
      resLongName.status === 400,
      'Reject Name > 80 chars',
      `Expected 400 for name > 80 chars, got ${resLongName.status}`
    );

    // 1c. Description exceeding 300 characters
    const resLongDesc = await request('/api/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { name: 'Valid Name', description: 'D'.repeat(301), source_type: 'ZIP' },
    });
    assert(
      resLongDesc.status === 400,
      'Reject Description > 300 chars',
      `Expected 400 for description > 300 chars, got ${resLongDesc.status}`
    );

    // 1d. Invalid source_type enum
    const resBadSource = await request('/api/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { name: 'Valid Name', source_type: 'BITBUCKET' },
    });
    assert(
      resBadSource.status === 400,
      'Reject Invalid source_type',
      `Expected 400 for invalid source_type, got ${resBadSource.status}`
    );

    // 1e. source_type GITHUB without repository_url
    const resGithubNoUrl = await request('/api/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { name: 'Github Project', source_type: 'GITHUB' },
    });
    assert(
      resGithubNoUrl.status === 400,
      'Reject GITHUB without repository_url',
      `Expected 400 for GITHUB without repo url, got ${resGithubNoUrl.status}`
    );

    // 1f. source_type GITHUB with invalid repository_url format
    const resGithubBadUrl = await request('/api/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        name: 'Github Project',
        source_type: 'GITHUB',
        repository_url: 'http://github.com/owner/repo', // not https
      },
    });
    assert(
      resGithubBadUrl.status === 400,
      'Reject non-https GitHub URL',
      `Expected 400 for non-https GitHub URL, got ${resGithubBadUrl.status}`
    );

    const resGithubNonGithub = await request('/api/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        name: 'Github Project',
        source_type: 'GITHUB',
        repository_url: 'https://gitlab.com/owner/repo',
      },
    });
    assert(
      resGithubNonGithub.status === 400,
      'Reject non-github host',
      `Expected 400 for non-github host, got ${resGithubNonGithub.status}`
    );

    console.log('✔ All Zod validations strictly enforced on project creation.\n');

    // --------------------------------------------------------------------------
    // Test 2: User A creates a valid GitHub project
    // --------------------------------------------------------------------------
    console.log('--- Test 2: User A Creates Project ---');
    const createRes = await request('/api/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        name: 'Payment Gateway Microservice',
        description: 'PCI-DSS scoped microservice with AI payment scoring',
        source_type: 'GITHUB',
        repository_url: 'https://github.com/fintech-corp/payment-service',
        framework: 'Node.js / Express',
      },
    });

    assert(
      createRes.status === 201,
      'User A Project Creation',
      `Expected 201, got ${createRes.status}`
    );
    const projectA = createRes.body.project;
    assert(Boolean(projectA?.id), 'Project ID generated', 'Project must have an id');
    assert(projectA.user_id === USER_A_ID, 'Project belongs to User A', `Expected user_id ${USER_A_ID}, got ${projectA.user_id}`);
    console.log(`✔ User A successfully created project: ${projectA.id} (${projectA.name})\n`);

    // --------------------------------------------------------------------------
    // Test 3: User A gets own project
    // --------------------------------------------------------------------------
    console.log('--- Test 3: User A Retrieves Own Project ---');
    const getResA = await request(`/api/projects/${projectA.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(getResA.status === 200, 'User A GET own project', `Expected 200, got ${getResA.status}`);
    assert(getResA.body.project.id === projectA.id, 'User A project ID match', 'Returned correct project');
    console.log('✔ User A successfully retrieved own project.\n');

    // --------------------------------------------------------------------------
    // Test 4: STRICT TENANT ISOLATION - User B gets 404 for User A's project
    // (GET, PATCH, DELETE must all return 404, NEVER 403)
    // --------------------------------------------------------------------------
    console.log('--- Test 4: STRICT ACCEPTANCE CRITERIA - User B gets 404 on User A Project ---');

    // 4a. User B GET /api/projects/:projectA_id -> 404
    const resB_GET = await request(`/api/projects/${projectA.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(
      resB_GET.status === 404,
      'User B GET User A Project -> 404',
      `CRITICAL RULE: Expected 404 (not 403), got ${resB_GET.status}`
    );
    console.log(`✔ GET /api/projects/${projectA.id} returned 404 for User B`);

    // 4b. User B PATCH /api/projects/:projectA_id -> 404
    const resB_PATCH = await request(`/api/projects/${projectA.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: { name: 'Hacked by User B' },
    });
    assert(
      resB_PATCH.status === 404,
      'User B PATCH User A Project -> 404',
      `CRITICAL RULE: Expected 404 (not 403), got ${resB_PATCH.status}`
    );
    console.log(`✔ PATCH /api/projects/${projectA.id} returned 404 for User B`);

    // 4c. User B DELETE /api/projects/:projectA_id -> 404
    const resB_DELETE = await request(`/api/projects/${projectA.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(
      resB_DELETE.status === 404,
      'User B DELETE User A Project -> 404',
      `CRITICAL RULE: Expected 404 (not 403), got ${resB_DELETE.status}`
    );
    console.log(`✔ DELETE /api/projects/${projectA.id} returned 404 for User B\n`);

    // --------------------------------------------------------------------------
    // Test 5: User B lists projects - User A's project is not in User B's list
    // --------------------------------------------------------------------------
    console.log('--- Test 5: List Isolation ---');
    const resListB = await request('/api/projects', {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(resListB.status === 200, 'User B list projects', `Expected 200, got ${resListB.status}`);
    const userBProjects = resListB.body.projects || [];
    const foundProjectAInB = userBProjects.some((p: any) => p.id === projectA.id);
    assert(
      !foundProjectAInB,
      'User A project hidden from User B list',
      'User B must NOT see User A project in list'
    );
    console.log('✔ User B project list is strictly isolated.\n');

    // --------------------------------------------------------------------------
    // Test 6: User A updates own project (PATCH)
    // --------------------------------------------------------------------------
    console.log('--- Test 6: User A Updates Own Project ---');
    const patchResA = await request(`/api/projects/${projectA.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        name: 'Payment Service v2',
        description: 'Updated description <= 300 chars',
      },
    });
    assert(patchResA.status === 200, 'User A PATCH own project', `Expected 200, got ${patchResA.status}`);
    assert(
      patchResA.body.project.name === 'Payment Service v2',
      'Project name updated',
      `Expected updated name, got ${patchResA.body.project.name}`
    );
    console.log('✔ User A successfully updated project.\n');

    // --------------------------------------------------------------------------
    // Test 7: User A deletes own project (DELETE)
    // --------------------------------------------------------------------------
    console.log('--- Test 7: User A Deletes Own Project ---');
    const deleteResA = await request(`/api/projects/${projectA.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(deleteResA.status === 200, 'User A DELETE own project', `Expected 200, got ${deleteResA.status}`);

    // Confirm it is now gone for User A too (404)
    const getDeletedRes = await request(`/api/projects/${projectA.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(
      getDeletedRes.status === 404,
      'Deleted project returns 404 for User A',
      `Expected 404, got ${getDeletedRes.status}`
    );
    console.log('✔ User A successfully deleted project.\n');

    console.log('======================================================================');
    console.log('🎉 ALL PROJECT ACCEPTANCE TESTS PASSED SUCCESSFULLY!');
    console.log('======================================================================\n');
  } finally {
    server.close();
  }
}

runProjectsTests().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err.message);
  if (server) server.close();
  process.exit(1);
});
