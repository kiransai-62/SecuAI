"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSecurityScore = exports.computeSecurityScore = exports.WORKSPACE_BASE_DIR = void 0;
exports.sanitizeErrorMessage = sanitizeErrorMessage;
exports.resetStaleScans = resetStaleScans;
exports.cleanupExpiredWorkspaces = cleanupExpiredWorkspaces;
exports.claimNextScan = claimNextScan;
exports.processScanJob = processScanJob;
exports.pollAndProcessNextScan = pollAndProcessNextScan;
exports.startWorkerLoop = startWorkerLoop;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const supabase_js_1 = require("./db/supabase.js");
const engine_adapter_1 = require("@secuai/engine-adapter");
const shared_1 = require("@secuai/shared");
Object.defineProperty(exports, "calculateSecurityScore", { enumerable: true, get: function () { return shared_1.calculateSecurityScore; } });
Object.defineProperty(exports, "computeSecurityScore", { enumerable: true, get: function () { return shared_1.computeSecurityScore; } });
const safeExtract_js_1 = require("./lib/safeExtract.js");
const gitClone_js_1 = require("./lib/gitClone.js");
const storage_js_1 = require("./lib/storage.js");
const recomputeScan_js_1 = require("./services/recomputeScan.js");
const gitWorkspace_js_1 = require("./lib/gitWorkspace.js");
const dastGuards_js_1 = require("./lib/dastGuards.js");
/**
 * Base directory for temporary scan workspaces.
 * Kept for apply-fix / verify patch workflows; purged by 24h TTL cleanup job.
 */
exports.WORKSPACE_BASE_DIR = path_1.default.join(os_1.default.tmpdir(), 'secuai-workspaces');
let isProcessing = false;
let pollingTimer = null;
let ttlCleanupTimer = null;
/**
 * Strips filesystem paths and stack traces to ensure safe, user-facing error messages.
 */
function sanitizeErrorMessage(err) {
    if (!err)
        return 'Scan failed due to an unexpected error';
    const raw = typeof err === 'string' ? err : err.message || String(err);
    // Isolate first line, eliminating stack traces
    let line = raw.split(/\r?\n/)[0].trim();
    line = line.replace(/^Error:\s*/i, '');
    // Strip absolute file paths (Windows C:\... and Unix /...)
    line = line
        .replace(/[A-Za-z]:\\[^:\n\r\t,;]+/g, '[workspace]')
        .replace(/[A-Za-z]:\/[^:\n\r\t,;]+/g, '[workspace]')
        .replace(/\/(?:tmp|var|usr|etc|home|Users|private)[^\s:,;]+/g, '[workspace]');
    return line.slice(0, 300) || 'Scan failed';
}
/**
 * On worker startup, resets stale RUNNING scans (> 15 min) back to FAILED.
 */
async function resetStaleScans(thresholdMs = 15 * 60 * 1000) {
    let resetCount = 0;
    const cutoffIso = new Date(Date.now() - thresholdMs).toISOString();
    if (supabase_js_1.serviceRoleSupabase) {
        try {
            const { data, error } = await supabase_js_1.serviceRoleSupabase
                .from('scans')
                .update({
                status: 'FAILED',
                progress_step: 'Failed',
                error: 'Scan timed out: Execution exceeded 15 minute limit',
                completed_at: new Date().toISOString(),
            })
                .eq('status', 'RUNNING')
                .lt('started_at', cutoffIso)
                .select();
            if (!error && data) {
                resetCount += data.length;
            }
        }
        catch (err) {
            console.warn('[SecuAI Worker] Stale scan recovery database query notice:', err);
        }
    }
    // Memory store fallback
    const cutoffTime = Date.now() - thresholdMs;
    for (const scan of supabase_js_1.memoryDb.scans.values()) {
        if (scan.status === 'RUNNING' && scan.started_at) {
            const started = new Date(scan.started_at).getTime();
            if (started < cutoffTime) {
                scan.status = 'FAILED';
                scan.progress_step = 'Failed';
                scan.error = 'Scan timed out: Execution exceeded 15 minute limit';
                scan.completed_at = new Date().toISOString();
                resetCount++;
            }
        }
    }
    if (resetCount > 0) {
        console.log(`[SecuAI Worker] Reset ${resetCount} stale RUNNING scan(s) (>15 min) back to FAILED.`);
    }
    return resetCount;
}
/**
 * 24h TTL cleanup job: Purges expired workspaces from WORKSPACE_BASE_DIR.
 */
async function cleanupExpiredWorkspaces(maxAgeMs = 24 * 60 * 60 * 1000) {
    let cleanedCount = 0;
    try {
        if (!fs_1.default.existsSync(exports.WORKSPACE_BASE_DIR))
            return 0;
        const entries = fs_1.default.readdirSync(exports.WORKSPACE_BASE_DIR);
        const now = Date.now();
        for (const entry of entries) {
            const entryPath = path_1.default.join(exports.WORKSPACE_BASE_DIR, entry);
            try {
                const stats = fs_1.default.statSync(entryPath);
                if (now - stats.mtimeMs > maxAgeMs) {
                    fs_1.default.rmSync(entryPath, { recursive: true, force: true });
                    cleanedCount++;
                }
            }
            catch { }
        }
    }
    catch (err) {
        console.warn('[SecuAI Worker] TTL workspace cleanup notice:', err);
    }
    return cleanedCount;
}
/**
 * Claims ONE job atomically using PostgreSQL `FOR UPDATE SKIP LOCKED`
 * or in-memory atomic update.
 */
async function claimNextScan() {
    if (supabase_js_1.serviceRoleSupabase) {
        try {
            // 1. Try atomic database RPC function `claim_next_scan()`
            const { data, error } = await supabase_js_1.serviceRoleSupabase.rpc('claim_next_scan');
            if (!error && data) {
                const row = Array.isArray(data) ? data[0] : data;
                if (row && row.id) {
                    return row;
                }
            }
        }
        catch { }
        // Fallback atomic conditional claim via Supabase
        try {
            const { data: queued, error: qErr } = await supabase_js_1.serviceRoleSupabase
                .from('scans')
                .select('*')
                .eq('status', 'QUEUED')
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();
            if (!qErr && queued) {
                const { data: claimed, error: cErr } = await supabase_js_1.serviceRoleSupabase
                    .from('scans')
                    .update({
                    status: 'RUNNING',
                    started_at: new Date().toISOString(),
                    progress_step: 'Preparing',
                })
                    .eq('id', queued.id)
                    .eq('status', 'QUEUED')
                    .select()
                    .maybeSingle();
                if (!cErr && claimed) {
                    return claimed;
                }
            }
        }
        catch (err) {
            console.warn('[SecuAI Worker] Service-role claim query notice:', err);
        }
    }
    // In-memory atomic selection
    const queuedScans = Array.from(supabase_js_1.memoryDb.scans.values())
        .filter((s) => s.status === 'QUEUED')
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    if (queuedScans.length > 0) {
        const scan = queuedScans[0];
        scan.status = 'RUNNING';
        scan.started_at = new Date().toISOString();
        scan.progress_step = 'Preparing';
        return { ...scan };
    }
    return null;
}
/**
 * Updates scan status and progress_step in database / memoryDb.
 */
async function updateScanState(scanId, updates) {
    if (supabase_js_1.serviceRoleSupabase) {
        try {
            await supabase_js_1.serviceRoleSupabase.from('scans').update(updates).eq('id', scanId);
        }
        catch (err) {
            console.warn(`[SecuAI Worker] Failed to update scan ${scanId} in database:`, err);
        }
    }
    const memScan = supabase_js_1.memoryDb.scans.get(scanId);
    if (memScan) {
        Object.assign(memScan, updates);
    }
}
/**
 * Detects framework and project setup from workspace directory.
 */
function detectProjectFramework(workspacePath) {
    try {
        const pkgPath = path_1.default.join(workspacePath, 'package.json');
        if (fs_1.default.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs_1.default.readFileSync(pkgPath, 'utf8'));
            const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
            let base = 'Node.js';
            if (allDeps['next'])
                base = 'Next.js';
            else if (allDeps['express'])
                base = 'Express';
            else if (allDeps['react'])
                base = 'React';
            else if (allDeps['vue'])
                base = 'Vue';
            if (allDeps['@supabase/supabase-js'] || fs_1.default.existsSync(path_1.default.join(workspacePath, 'supabase'))) {
                base += ' / Supabase';
            }
            return base;
        }
        if (fs_1.default.existsSync(path_1.default.join(workspacePath, 'requirements.txt')) || fs_1.default.existsSync(path_1.default.join(workspacePath, 'main.py'))) {
            return 'Python / FastAPI';
        }
    }
    catch { }
    return 'Full-Stack Web';
}
/**
 * Executes a single scan job through all 6 required progress steps.
 */
async function processScanJob(scan) {
    const scanId = scan.id;
    const workspacePath = path_1.default.join(exports.WORKSPACE_BASE_DIR, scanId);
    try {
        console.log(`[SecuAI Worker] Claimed scan ${scanId} for project ${scan.project_id}. Starting execution...`);
        const isGitHubScan = scan.target_type === 'repo' ||
            scan.target_type === 'github' ||
            scan.target_type === 'GITHUB' ||
            scan.target_path?.startsWith('https://github.com');
        const isUrlScan = !isGitHubScan &&
            (scan.target_type === 'url' ||
                scan.scan_mode === 'dast' ||
                scan.scan_mode === 'url_only' ||
                (scan.target_type !== 'upload' &&
                    Boolean(scan.target_path?.startsWith('http://') || scan.target_path?.startsWith('https://'))));
        let findings = [];
        let scanResultJson = null;
        let scanDurationSeconds = 0;
        if (isUrlScan) {
            const dastStartTime = Date.now();
            // Step 1: Preparing
            await updateScanState(scanId, {
                progress_step: 'Preparing',
            });
            // 1. Re-validate DNS and SSRF guards at connect time
            const validation = await (0, dastGuards_js_1.validateDastTarget)(scan.target_path, Boolean(scan.confirmed_ownership ?? true));
            if (!validation.valid) {
                throw new Error(`DAST Target Security Validation Failed: ${validation.error}`);
            }
            // 2. Pre-flight engine check: Stop and report instead of faking results
            const browserCheck = await (0, dastGuards_js_1.checkDastBrowserAvailable)();
            if (!browserCheck.available) {
                throw new Error(`DAST engine cannot run in this environment: ${browserCheck.reason}. Scan stopped without faking results.`);
            }
            // Step 2: Detecting project
            await updateScanState(scanId, {
                progress_step: 'Detecting project',
            });
            // Step 3: Scanning (Probe live endpoint with 5 min timeout, rate cap, max 3 redirects)
            await updateScanState(scanId, {
                progress_step: 'Scanning',
            });
            const probeResult = await (0, dastGuards_js_1.executeSafeDastProbe)(scan.target_path, Boolean(scan.confirmed_ownership ?? true), {
                maxRedirects: 3,
                timeoutMs: 300000, // 5 min timeout
                delayBetweenRequestsMs: 200,
            });
            // Step 4: Normalizing findings (source=DAST)
            await updateScanState(scanId, {
                progress_step: 'Normalizing',
            });
            const headers = probeResult.headers;
            if (!headers['content-security-policy']) {
                findings.push((0, dastGuards_js_1.normalizeDastFinding)({
                    title: 'Missing Content-Security-Policy header on live endpoint',
                    category: 'missing_security_headers',
                    severity: 'MEDIUM',
                    confidence: 0.95,
                    endpoint: probeResult.finalUrl,
                    description: `The live endpoint '${probeResult.finalUrl}' does not return a Content-Security-Policy (CSP) header, increasing exposure to cross-site scripting (XSS) and data injection.`,
                    evidence: {
                        scanner_name: 'dast_header_analyzer',
                        status_code: probeResult.statusCode,
                        headers: probeResult.headers,
                        redirects_followed: probeResult.redirectsFollowed,
                    },
                }));
            }
            if (!headers['strict-transport-security'] && probeResult.finalUrl.startsWith('https://')) {
                findings.push((0, dastGuards_js_1.normalizeDastFinding)({
                    title: 'Missing Strict-Transport-Security (HSTS) header',
                    category: 'missing_security_headers',
                    severity: 'LOW',
                    confidence: 0.95,
                    endpoint: probeResult.finalUrl,
                    description: `The live HTTPS endpoint does not enforce HSTS, permitting potential man-in-the-middle downgrade attacks.`,
                    evidence: {
                        scanner_name: 'dast_hsts_analyzer',
                        status_code: probeResult.statusCode,
                        headers: probeResult.headers,
                    },
                }));
            }
            if (headers['access-control-allow-origin'] === '*') {
                findings.push((0, dastGuards_js_1.normalizeDastFinding)({
                    title: 'Overly permissive CORS wildcard (Access-Control-Allow-Origin: *)',
                    category: 'cors_misconfiguration',
                    severity: 'HIGH',
                    confidence: 0.9,
                    endpoint: probeResult.finalUrl,
                    description: `The live API endpoint sets Access-Control-Allow-Origin to '*', allowing any third-party origin to read cross-origin responses.`,
                    evidence: {
                        scanner_name: 'dast_cors_analyzer',
                        status_code: probeResult.statusCode,
                        headers: probeResult.headers,
                    },
                }));
            }
            scanDurationSeconds = Math.max(1, Math.round((Date.now() - dastStartTime) / 1000));
            scanResultJson = {
                target_url: probeResult.finalUrl,
                status_code: probeResult.statusCode,
                headers: probeResult.headers,
                redirects_followed: probeResult.redirectsFollowed,
                findings_count: findings.length,
                scan_duration_seconds: scanDurationSeconds,
                scanners_run: ['dast_header_analyzer', 'dast_hsts_analyzer', 'dast_cors_analyzer'],
            };
        }
        else {
            // --------------------------------------------------------------------------
            // Step 1: Preparing
            // --------------------------------------------------------------------------
            await updateScanState(scanId, {
                progress_step: 'Preparing',
                workspace_path: workspacePath,
            });
            if (!fs_1.default.existsSync(exports.WORKSPACE_BASE_DIR)) {
                fs_1.default.mkdirSync(exports.WORKSPACE_BASE_DIR, { recursive: true });
            }
            if (fs_1.default.existsSync(workspacePath)) {
                fs_1.default.rmSync(workspacePath, { recursive: true, force: true });
            }
            fs_1.default.mkdirSync(workspacePath, { recursive: true });
            // Workspace extraction (ZIP) or clone (GitHub)
            // NEVER run npm install or user code
            if (scan.target_type === 'upload' || scan.storage_path) {
                const storagePath = scan.storage_path || scan.target_path;
                const zipBuffer = await (0, storage_js_1.getScanZipBuffer)(storagePath, supabase_js_1.serviceRoleSupabase || undefined);
                if (!zipBuffer) {
                    throw new Error(`Upload archive not found in storage: ${storagePath}`);
                }
                await (0, safeExtract_js_1.safeExtractZip)(zipBuffer, workspacePath);
            }
            else if (scan.target_type === 'repo' ||
                scan.target_type === 'GITHUB' ||
                scan.target_type === 'github' ||
                scan.target_path?.startsWith('https://github.com')) {
                await (0, gitClone_js_1.cloneGitHubRepo)(scan.target_path, workspacePath);
            }
            else if (fs_1.default.existsSync(scan.target_path)) {
                // Local path copying for test fixtures/demo directories
                fs_1.default.cpSync(scan.target_path, workspacePath, { recursive: true });
            }
            else {
                throw new Error(`Unsupported scan target: ${scan.target_path}`);
            }
            // Initialize git repository in workspace at extract time for git apply workflows
            (0, gitWorkspace_js_1.initWorkspaceGit)(workspacePath);
            // --------------------------------------------------------------------------
            // Step 2: Detecting project
            // --------------------------------------------------------------------------
            await updateScanState(scanId, {
                progress_step: 'Detecting project',
            });
            const framework = detectProjectFramework(workspacePath);
            if (supabase_js_1.serviceRoleSupabase) {
                try {
                    await supabase_js_1.serviceRoleSupabase
                        .from('projects')
                        .update({ framework })
                        .eq('id', scan.project_id)
                        .is('framework', null);
                }
                catch { }
            }
            else {
                const p = supabase_js_1.memoryDb.projects.get(scan.project_id);
                if (p && !p.framework)
                    p.framework = framework;
            }
            // --------------------------------------------------------------------------
            // Step 3: Scanning
            // --------------------------------------------------------------------------
            await updateScanState(scanId, {
                progress_step: 'Scanning',
            });
            let rawReport;
            try {
                rawReport = await (0, engine_adapter_1.runScan)(workspacePath, { timeoutMs: 60000 });
            }
            catch (engineErr) {
                console.warn(`[SecuAI Worker] runScan adapter notice: ${engineErr.message}. Checking engine fallback.`);
                rawReport = await engine_adapter_1.EngineScannerRunner.runScan({
                    targetPath: workspacePath,
                    scanMode: scan.scan_mode || 'code_only',
                    timeoutMs: 60000,
                });
            }
            // --------------------------------------------------------------------------
            // Step 4: Normalizing & Regression Detection
            // --------------------------------------------------------------------------
            await updateScanState(scanId, {
                progress_step: 'Normalizing',
            });
            const normalized = (0, engine_adapter_1.normalizeReport)(rawReport);
            findings = normalized.findings;
            scanResultJson = rawReport;
            scanDurationSeconds = rawReport.scan_duration_seconds || 0;
        }
        // Regression Check:
        // If a fingerprint was VERIFIED in a previous scan of this project and appears again -> status REGRESSED
        const verifiedFingerprints = new Set();
        if (supabase_js_1.serviceRoleSupabase) {
            try {
                const { data: pastFindings } = await supabase_js_1.serviceRoleSupabase
                    .from('findings')
                    .select('fingerprint, status')
                    .eq('project_id', scan.project_id)
                    .eq('status', 'VERIFIED');
                if (pastFindings) {
                    for (const pf of pastFindings) {
                        if (pf.fingerprint)
                            verifiedFingerprints.add(pf.fingerprint);
                    }
                }
            }
            catch (vfErr) {
                console.warn('[SecuAI Worker] Notice checking past verified findings:', vfErr);
            }
        }
        else {
            for (const pf of supabase_js_1.memoryDb.findings.values()) {
                if (pf.project_id === scan.project_id && pf.status === 'VERIFIED') {
                    if (pf.fingerprint)
                        verifiedFingerprints.add(pf.fingerprint);
                }
            }
        }
        // Upsert findings with user_id, project_id, scan_id, and regression status
        const nowIso = new Date().toISOString();
        for (const f of findings) {
            const isRegressed = verifiedFingerprints.has(f.fingerprint);
            const findingStatus = isRegressed ? 'REGRESSED' : 'OPEN';
            const findingRecord = {
                id: crypto_1.default.randomUUID(),
                scan_id: scanId,
                project_id: scan.project_id,
                user_id: scan.user_id,
                fingerprint: f.fingerprint,
                title: f.title,
                category: f.category,
                severity: f.severity,
                confidence: f.confidence,
                source: f.source,
                file_path: f.file_path,
                line_start: f.line_start,
                line_end: f.line_end,
                endpoint: f.endpoint,
                evidence: f.evidence,
                status: findingStatus,
                description: f.description,
                engine_finding_id: f.fingerprint,
                technical_detail: f.evidence?.technical_detail || '',
                scanner_name: f.evidence?.scanner_name || '',
                line_number: f.line_start,
                code_snippet: f.evidence?.code_snippet || null,
                raw_finding: f,
                created_at: nowIso,
                updated_at: nowIso,
            };
            if (supabase_js_1.serviceRoleSupabase) {
                try {
                    await supabase_js_1.serviceRoleSupabase.from('findings').insert({
                        id: findingRecord.id,
                        user_id: findingRecord.user_id,
                        scan_id: findingRecord.scan_id,
                        project_id: findingRecord.project_id,
                        fingerprint: findingRecord.fingerprint,
                        title: findingRecord.title,
                        category: findingRecord.category,
                        severity: findingRecord.severity,
                        confidence: findingRecord.confidence,
                        source: findingRecord.source,
                        file_path: findingRecord.file_path,
                        line_start: findingRecord.line_start,
                        line_end: findingRecord.line_end,
                        endpoint: findingRecord.endpoint,
                        evidence: findingRecord.evidence,
                        status: findingRecord.status,
                        description: findingRecord.description,
                        created_at: nowIso,
                    });
                }
                catch (dbErr) {
                    console.warn('[SecuAI Worker] Finding persistence notice:', dbErr);
                }
            }
            else {
                supabase_js_1.memoryDb.findings.set(findingRecord.id, findingRecord);
            }
        }
        // --------------------------------------------------------------------------
        // Step 5: Scoring (Updated via recomputeScan)
        // --------------------------------------------------------------------------
        await updateScanState(scanId, {
            progress_step: 'Scoring',
        });
        const scoreMetrics = await (0, recomputeScan_js_1.recomputeScan)(scanId);
        // --------------------------------------------------------------------------
        // Step 6: Done (COMPLETED)
        // --------------------------------------------------------------------------
        const completedAt = new Date().toISOString();
        await updateScanState(scanId, {
            status: 'COMPLETED',
            progress_step: 'Done',
            critical_count: scoreMetrics.counts.critical,
            high_count: scoreMetrics.counts.high,
            medium_count: scoreMetrics.counts.medium,
            low_count: scoreMetrics.counts.low,
            findings_count: scoreMetrics.counts.total,
            security_score: scoreMetrics.score,
            result_json: scanResultJson,
            scan_duration_seconds: scanDurationSeconds,
            completed_at: completedAt,
            workspace_path: workspacePath, // Kept for apply-fix/verify; TTL cleanup after 24h
        });
        console.log(`[SecuAI Worker] Successfully completed scan ${scanId}. Findings: ${scoreMetrics.counts.total} (Critical: ${scoreMetrics.counts.critical}, High: ${scoreMetrics.counts.high}). Score: ${scoreMetrics.score}/100 (${scoreMetrics.label}).`);
    }
    catch (err) {
        const safeError = sanitizeErrorMessage(err);
        console.error(`[SecuAI Worker] Scan ${scanId} failed:`, safeError);
        await updateScanState(scanId, {
            status: 'FAILED',
            progress_step: 'Failed',
            error: safeError,
            completed_at: new Date().toISOString(),
        });
    }
}
/**
 * Polls for next queued job and executes it.
 */
async function pollAndProcessNextScan() {
    if (isProcessing)
        return false;
    isProcessing = true;
    try {
        const job = await claimNextScan();
        if (!job) {
            isProcessing = false;
            return false;
        }
        await processScanJob(job);
        isProcessing = false;
        return true;
    }
    catch (err) {
        console.error('[SecuAI Worker] Error in worker poll cycle:', sanitizeErrorMessage(err));
        isProcessing = false;
        return false;
    }
}
/**
 * Starts continuous worker loop polling every 2s.
 */
function startWorkerLoop(intervalMs = 2000) {
    console.log(`[SecuAI Worker] Starting Postgres polling loop (interval: ${intervalMs}ms, service-role only)`);
    // On startup: reset stale RUNNING (>15 min) back to FAILED
    resetStaleScans(15 * 60 * 1000).catch((err) => {
        console.warn('[SecuAI Worker] Startup stale scan reset notice:', err);
    });
    // On startup: run 24h TTL cleanup
    cleanupExpiredWorkspaces().catch((err) => {
        console.warn('[SecuAI Worker] Startup workspace cleanup notice:', err);
    });
    // Polling loop every 2s
    pollingTimer = setInterval(async () => {
        try {
            await pollAndProcessNextScan();
        }
        catch (err) {
            console.error('[SecuAI Worker] Loop tick error:', sanitizeErrorMessage(err));
        }
    }, intervalMs);
    // Hourly TTL cleanup timer
    ttlCleanupTimer = setInterval(() => {
        cleanupExpiredWorkspaces().catch(() => { });
    }, 60 * 60 * 1000);
    const stop = () => {
        if (pollingTimer)
            clearInterval(pollingTimer);
        if (ttlCleanupTimer)
            clearInterval(ttlCleanupTimer);
    };
    return { pollingTimer, ttlCleanupTimer, stop };
}
// Standalone execution entrypoint
if (process.argv[1]?.includes('worker')) {
    startWorkerLoop(2000);
}
