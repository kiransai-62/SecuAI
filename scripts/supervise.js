#!/usr/bin/env node
/**
 * SecuAI Multi-Process Supervisor
 * Manages the Express API and Background Postgres Polling Worker
 * Handles signal forwarding (SIGTERM/SIGINT) and failure exit propagation
 */

import { spawn } from 'child_process';

console.log('======================================================');
console.log('🛡️  SecuAI Production Process Supervisor');
console.log('🚀  Starting Express API Server and Worker...');
console.log('======================================================');

let isTerminating = false;

// 1. Launch Worker Process
const worker = spawn('node', ['apps/api/dist/worker.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ROLE: 'worker',
  },
});

// 2. Launch API Server Process
const api = spawn('node', ['apps/api/dist/server.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    START_WORKER: 'false',
    ROLE: 'api',
  },
});

function terminateChildren(signal) {
  if (isTerminating) return;
  isTerminating = true;

  console.log(`\n[Supervisor] Received ${signal}. Terminating child processes...`);
  try { worker.kill('SIGTERM'); } catch {}
  try { api.kill('SIGTERM'); } catch {}

  const forceKillTimeout = setTimeout(() => {
    console.warn('[Supervisor] Forcefully killing child processes (SIGKILL)...');
    try { worker.kill('SIGKILL'); } catch {}
    try { api.kill('SIGKILL'); } catch {}
    process.exit(1);
  }, 5000);

  forceKillTimeout.unref();
}

process.on('SIGTERM', () => terminateChildren('SIGTERM'));
process.on('SIGINT', () => terminateChildren('SIGINT'));

worker.on('exit', (code, signal) => {
  console.log(`[Supervisor] Worker process exited with code ${code} (${signal || 'clean'})`);
  if (!isTerminating) {
    console.error('[Supervisor] CRITICAL: Worker process died unexpectedly. Exiting container...');
    terminateChildren('WORKER_FAILURE');
    process.exit(code || 1);
  }
});

api.on('exit', (code, signal) => {
  console.log(`[Supervisor] API server process exited with code ${code} (${signal || 'clean'})`);
  if (!isTerminating) {
    console.error('[Supervisor] CRITICAL: API server process died unexpectedly. Exiting container...');
    terminateChildren('API_FAILURE');
    process.exit(code || 1);
  }
});
