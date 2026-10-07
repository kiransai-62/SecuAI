"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScansController = void 0;
const supabase_js_1 = require("../db/supabase.js");
const tenant_js_1 = require("../middleware/tenant.js");
const storage_js_1 = require("../lib/storage.js");
const gitClone_js_1 = require("../lib/gitClone.js");
class ScansController {
    /**
     * GET /api/scans or GET /api/projects/:id/scans
     * List scans for the authenticated user
     */
    static async list(req, res) {
        const userId = req.user.id;
        const projectId = req.params.id || req.query.project_id;
        const db = req.supabase;
        if (db) {
            // Per-request Supabase client automatically applies RLS
            let query = db.from('scans').select('*').order('created_at', { ascending: false });
            if (projectId)
                query = query.eq('project_id', projectId);
            const { data, error } = await query;
            if (error) {
                res.status(500).json({ error: error.message });
                return;
            }
            res.json({ scans: data });
            return;
        }
        let scans = Array.from(supabase_js_1.memoryDb.scans.values()).filter((s) => s.user_id === userId);
        if (projectId)
            scans = scans.filter((s) => s.project_id === projectId);
        scans.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        res.json({ scans });
    }
    /**
     * POST /api/projects/:id/scans
     * Primary scan initiation endpoint.
     * Handles:
     * 1. ZIP upload (via multer, max 25MB): validated, uploaded to uploads/{user_id}/{scan_id}.zip, scan status QUEUED.
     * 2. GitHub: strictly https://github.com/<owner>/<repo>, scan status QUEUED.
     * STRICT TENANT RULE: 404 (not 403) on other users' projects.
     */
    static async createForProject(req, res) {
        const userId = req.user.id;
        const { id: projectId } = req.params;
        const db = req.supabase;
        // 1. Verify project ownership (404 if not found or not owner)
        let project = null;
        if (db) {
            const { data } = await db.from('projects').select('*').eq('id', projectId).maybeSingle();
            project = data;
        }
        else {
            project = supabase_js_1.memoryDb.projects.get(projectId) || null;
        }
        if (!(0, tenant_js_1.assertTenantOwnership)(project, userId, res))
            return;
        // 2. Case A: ZIP Archive Upload
        if (req.file) {
            const buf = req.file.buffer;
            const isValidMagic = buf &&
                buf.length >= 4 &&
                buf[0] === 0x50 &&
                buf[1] === 0x4b &&
                (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07);
            if (!isValidMagic) {
                res.status(400).json({
                    error: 'Invalid file format: Uploaded file is not a valid ZIP archive (missing PK signature)',
                });
                return;
            }
            const scanId = crypto.randomUUID();
            const storagePath = await (0, storage_js_1.uploadScanZip)(userId, scanId, buf, db);
            const newScan = {
                id: scanId,
                project_id: projectId,
                user_id: userId,
                status: 'QUEUED',
                scan_mode: req.body?.scan_mode || 'code_only',
                target_type: 'upload',
                target_path: storagePath,
                storage_path: storagePath,
                result_json: null,
                findings_count: 0,
                critical_count: 0,
                high_count: 0,
                medium_count: 0,
                low_count: 0,
                security_score: 100,
                scan_duration_seconds: 0,
                created_at: new Date().toISOString(),
            };
            if (db) {
                const { error: insertError } = await db.from('scans').insert(newScan);
                if (insertError) {
                    res.status(500).json({ error: insertError.message });
                    return;
                }
            }
            else {
                supabase_js_1.memoryDb.scans.set(newScan.id, newScan);
            }
            res.status(201).json({
                message: 'ZIP archive uploaded to storage and scan enqueued.',
                scan: newScan,
            });
            return;
        }
        // 3. Case B: GitHub Repository URL
        const repoUrl = req.body?.repository_url ||
            req.body?.repo_url ||
            project.repository_url ||
            project.repo_url;
        if (!repoUrl) {
            res.status(400).json({
                error: 'Either a valid ZIP archive (.zip) or a GitHub repository URL is required to start a scan',
            });
            return;
        }
        const trimmedUrl = String(repoUrl).trim();
        if (!gitClone_js_1.GITHUB_REPO_REGEX.test(trimmedUrl)) {
            res.status(400).json({
                error: 'Repository URL must follow the exact format https://github.com/<owner>/<repo>',
            });
            return;
        }
        const scanId = crypto.randomUUID();
        const newScan = {
            id: scanId,
            project_id: projectId,
            user_id: userId,
            status: 'QUEUED',
            scan_mode: req.body?.scan_mode || 'code_only',
            target_type: 'repo',
            target_path: trimmedUrl,
            storage_path: null,
            result_json: null,
            findings_count: 0,
            critical_count: 0,
            high_count: 0,
            medium_count: 0,
            low_count: 0,
            security_score: 100,
            scan_duration_seconds: 0,
            created_at: new Date().toISOString(),
        };
        if (db) {
            const { error: insertError } = await db.from('scans').insert(newScan);
            if (insertError) {
                res.status(500).json({ error: insertError.message });
                return;
            }
        }
        else {
            supabase_js_1.memoryDb.scans.set(newScan.id, newScan);
        }
        res.status(201).json({
            message: 'GitHub repository scan enqueued.',
            scan: newScan,
        });
    }
    /**
     * Legacy POST /api/scans
     */
    static async create(req, res) {
        const userId = req.user.id;
        const { project_id, target_type, target_path, scan_mode } = req.body;
        const db = req.supabase;
        let project = null;
        if (db) {
            const { data } = await db.from('projects').select('*').eq('id', project_id).maybeSingle();
            project = data;
        }
        else {
            project = supabase_js_1.memoryDb.projects.get(project_id);
        }
        if (!(0, tenant_js_1.assertTenantOwnership)(project, userId, res))
            return;
        const newScan = {
            id: crypto.randomUUID(),
            project_id,
            user_id: userId,
            status: 'QUEUED',
            scan_mode: scan_mode || 'code_only',
            target_type,
            target_path,
            result_json: null,
            findings_count: 0,
            critical_count: 0,
            high_count: 0,
            medium_count: 0,
            low_count: 0,
            security_score: 100,
            scan_duration_seconds: 0,
            created_at: new Date().toISOString(),
        };
        if (db) {
            const { error } = await db.from('scans').insert(newScan);
            if (error) {
                res.status(500).json({ error: error.message });
                return;
            }
        }
        else {
            supabase_js_1.memoryDb.scans.set(newScan.id, newScan);
        }
        res.status(201).json({
            message: 'Scan job successfully enqueued.',
            scan: newScan,
        });
    }
    /**
     * GET /api/scans/:id
     */
    static async getById(req, res) {
        const userId = req.user.id;
        const { id } = req.params;
        const db = req.supabase;
        let scan = null;
        if (db) {
            const { data } = await db.from('scans').select('*').eq('id', id).maybeSingle();
            scan = data;
        }
        else {
            scan = supabase_js_1.memoryDb.scans.get(id) || null;
        }
        if (!(0, tenant_js_1.assertTenantOwnership)(scan, userId, res))
            return;
        const criticalCount = scan.critical_count ?? 0;
        const highCount = scan.high_count ?? 0;
        const mediumCount = scan.medium_count ?? 0;
        const lowCount = scan.low_count ?? 0;
        const totalCount = scan.findings_count ?? (criticalCount + highCount + mediumCount + lowCount);
        const score = scan.security_score ?? 100;
        const counts = {
            critical: criticalCount,
            high: highCount,
            medium: mediumCount,
            low: lowCount,
            total: totalCount,
        };
        res.json({
            scan,
            status: scan.status,
            progress_step: scan.progress_step || null,
            score,
            counts,
        });
    }
}
exports.ScansController = ScansController;
