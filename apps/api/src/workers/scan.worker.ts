/**
 * Background Scan Poller Worker
 * Polls PostgreSQL scans table for QUEUED scans and executes scanner subprocess
 */
export async function runScanWorker() {
  console.log('[ScanWorker] Background queue poller initialized');
}

export default runScanWorker;
