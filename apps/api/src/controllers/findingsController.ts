import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import crypto from 'crypto';
import { Request, Response } from 'express';
import { memoryDb } from '../db/supabase.js';
import { assertTenantOwnership } from '../middleware/tenant.js';
import { EngineVerifier, PatchVerifier } from '@secuai/engine-adapter';
import { FindingRecord, Scan } from '@secuai/shared';
import { recomputeScan } from '../services/recomputeScan.js';
import { config } from '../config.js';
import { WORKSPACE_BASE_DIR } from '../worker.js';
import { initWorkspaceGit, validateGitDiff, applyGitDiff } from '../lib/gitWorkspace.js';
import { GeminiSecurityAssistant } from '../services/gemini.js';

const userRateLimits = new Map<string, { count: number; resetAt: number }>();

function checkUserRateLimit(userId: string, limit = 30, windowMs = 60000): boolean {
  const now = Date.now();
  const record = userRateLimits.get(userId);
  if (!record || now > record.resetAt) {
    userRateLimits.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (record.count >= limit) {
    return false;
  }
  record.count++;
  return true;
}

export class FindingsController {
  /**
   * STEP 1: DETECT - List findings discovered by the isitsecure scanner
   */
  static async listByScan(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { scanId } = req.params;
    const db = req.supabase;

    // Verify scan ownership
    let scan: Scan | null = null;
    if (db) {
      const { data } = await db.from('scans').select('*').eq('id', scanId).maybeSingle();
      scan = data as Scan | null;
    } else {
      scan = memoryDb.scans.get(scanId) || null;
    }

    if (!assertTenantOwnership(scan, userId, res)) return;

    const severityFilter = req.query.severity ? String(req.query.severity).trim() : null;
    const statusFilter = req.query.status ? String(req.query.status).trim() : null;

    if (db) {
      let query = db
        .from('findings')
        .select('*')
        .eq('scan_id', scanId)
        .order('created_at', { ascending: true });

      if (severityFilter && severityFilter.toUpperCase() !== 'ALL') {
        const severities = severityFilter.split(',').map((s) => s.trim().toUpperCase());
        if (severities.length === 1) {
          query = query.eq('severity', severities[0]);
        } else {
          query = query.in('severity', severities);
        }
      }

      if (statusFilter && statusFilter.toUpperCase() !== 'ALL') {
        const statuses = statusFilter.split(',').map((s) => s.trim().toUpperCase());
        if (statuses.length === 1) {
          query = query.eq('status', statuses[0]);
        } else {
          query = query.in('status', statuses);
        }
      }

      const { data, error } = await query;

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json({ findings: data || [] });
      return;
    }

    let findings = Array.from(memoryDb.findings.values()).filter(
      (f) => f.scan_id === scanId && f.user_id === userId
    );

    if (severityFilter && severityFilter.toUpperCase() !== 'ALL') {
      const severities = severityFilter.split(',').map((s) => s.trim().toUpperCase());
      findings = findings.filter((f) => severities.includes(f.severity.toUpperCase()));
    }

    if (statusFilter && statusFilter.toUpperCase() !== 'ALL') {
      const statuses = statusFilter.split(',').map((s) => s.trim().toUpperCase());
      findings = findings.filter((f) => {
        const s = (f.status || 'OPEN').toUpperCase();
        if (statuses.includes('OPEN') && (s === 'OPEN' || s === 'DETECTED')) return true;
        if (statuses.includes('VERIFIED') && s === 'VERIFIED') return true;
        return statuses.includes(s);
      });
    }

    res.json({ findings });
  }

  /**
   * GET /api/findings
   * Lists all findings belonging to the authenticated user across projects/scans,
   * supporting optional query filters (projectId, scanId, severity, status).
   */
  static async listAll(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { projectId, scanId, severity, status } = req.query;
    const db = req.supabase;

    const severityFilter = severity ? String(severity).trim() : null;
    const statusFilter = status ? String(status).trim() : null;
    const projectFilter = projectId ? String(projectId).trim() : null;
    const scanFilter = scanId ? String(scanId).trim() : null;

    if (db) {
      let query = db
        .from('findings')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (projectFilter) query = query.eq('project_id', projectFilter);
      if (scanFilter) query = query.eq('scan_id', scanFilter);

      if (severityFilter && severityFilter.toUpperCase() !== 'ALL') {
        const severities = severityFilter.split(',').map((s) => s.trim().toUpperCase());
        if (severities.length === 1) {
          query = query.eq('severity', severities[0]);
        } else {
          query = query.in('severity', severities);
        }
      }

      if (statusFilter && statusFilter.toUpperCase() !== 'ALL') {
        const statuses = statusFilter.split(',').map((s) => s.trim().toUpperCase());
        if (statuses.length === 1) {
          query = query.eq('status', statuses[0]);
        } else {
          query = query.in('status', statuses);
        }
      }

      const { data, error } = await query;
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json({ findings: data || [] });
      return;
    }

    let findings = Array.from(memoryDb.findings.values()).filter((f) => f.user_id === userId);
    if (projectFilter) findings = findings.filter((f) => f.project_id === projectFilter);
    if (scanFilter) findings = findings.filter((f) => f.scan_id === scanFilter);

    if (severityFilter && severityFilter.toUpperCase() !== 'ALL') {
      const severities = severityFilter.split(',').map((s) => s.trim().toUpperCase());
      findings = findings.filter((f) => severities.includes(f.severity.toUpperCase()));
    }

    if (statusFilter && statusFilter.toUpperCase() !== 'ALL') {
      const statuses = statusFilter.split(',').map((s) => s.trim().toUpperCase());
      findings = findings.filter((f) => {
        const s = (f.status || 'OPEN').toUpperCase();
        if (statuses.includes('OPEN') && (s === 'OPEN' || s === 'DETECTED')) return true;
        if (statuses.includes('VERIFIED') && s === 'VERIFIED') return true;
        return statuses.includes(s);
      });
    }

    res.json({ findings });
  }

  /**
   * GET /api/findings/:id
   * Loads finding by UUID or fingerprint under RLS.
   */
  static async getById(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const targetId = req.params.id;
    const db = req.supabase;

    let finding: FindingRecord | null = null;
    if (db) {
      const { data } = await db.from('findings').select('*').eq('id', targetId).maybeSingle();
      finding = data as FindingRecord | null;
      if (!finding) {
        const { data: byFp } = await db.from('findings').select('*').eq('fingerprint', targetId).maybeSingle();
        finding = byFp as FindingRecord | null;
      }
    } else {
      finding = memoryDb.findings.get(targetId) || null;
      if (!finding) {
        finding = Array.from(memoryDb.findings.values()).find((f) => f.fingerprint === targetId) || null;
      }
    }

    if (!assertTenantOwnership(finding, userId, res)) return;

    res.json({ finding });
  }

  /**
   * POST /api/findings/:id/explain or POST /api/findings/explain
   * Loads finding under RLS, checks ai_analysis cache by (fingerprint, model),
   * enforces per-user rate limit, runs Gemini with structured output, and caches result.
   */
  static async explainById(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const targetId = req.params.id || req.body?.finding_id;
    const db = req.supabase;

    if (!targetId) {
      res.status(400).json({ error: 'Finding ID or fingerprint is required' });
      return;
    }

    if (!checkUserRateLimit(userId)) {
      res.status(429).json({
        error: 'Rate limit exceeded. Please wait a moment before requesting another analysis.',
      });
      return;
    }

    let finding: FindingRecord | null = null;
    if (db) {
      const { data } = await db.from('findings').select('*').eq('id', targetId).maybeSingle();
      finding = data as FindingRecord | null;
      if (!finding) {
        const { data: byFp } = await db.from('findings').select('*').eq('fingerprint', targetId).maybeSingle();
        finding = byFp as FindingRecord | null;
      }
    } else {
      finding = memoryDb.findings.get(targetId) || null;
      if (!finding) {
        finding = Array.from(memoryDb.findings.values()).find((f) => f.fingerprint === targetId) || null;
      }
    }

    if (!assertTenantOwnership(finding, userId, res)) return;

    const modelName = config.geminiModel;

    // Check ai_analysis cache by (fingerprint, model)
    if (db) {
      const { data: cached } = await db
        .from('ai_analysis')
        .select('*')
        .eq('fingerprint', finding.fingerprint)
        .eq('model', modelName)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached && cached.explanation) {
        try {
          const parsed = JSON.parse(cached.explanation);
          res.json({
            finding_id: finding.id,
            fingerprint: finding.fingerprint,
            model: modelName,
            cached: true,
            analysis: parsed,
          });
          return;
        } catch {}
      }
    } else {
      const cacheKey = `${finding.fingerprint}:${modelName}`;
      const cached = memoryDb.ai_analysis.get(cacheKey);
      if (cached) {
        res.json({
          finding_id: finding.id,
          fingerprint: finding.fingerprint,
          model: modelName,
          cached: true,
          analysis: cached.analysis,
        });
        return;
      }
    }

    // Determine workspace path for context extraction
    let workspacePath: string | null = null;
    if (finding.scan_id) {
      if (db) {
        const { data: scan } = await db
          .from('scans')
          .select('workspace_path')
          .eq('id', finding.scan_id)
          .maybeSingle();
        workspacePath = scan?.workspace_path || null;
      } else {
        const scan = memoryDb.scans.get(finding.scan_id);
        workspacePath = scan?.workspace_path || null;
      }
    }

    // Generate structured analysis (Gemini with secrets redacted & untrusted data prompt)
    const analysis = await GeminiSecurityAssistant.explainFindingStructured(
      finding,
      workspacePath
    );

    // Save to ai_analysis cache table
    if (db) {
      await db.from('ai_analysis').insert({
        user_id: userId,
        finding_id: finding.id,
        fingerprint: finding.fingerprint,
        model: modelName,
        explanation: JSON.stringify(analysis),
        root_cause: analysis.why_it_happened,
        blast_radius: analysis.potential_impact,
      });
      await db
        .from('findings')
        .update({ explanation: JSON.stringify(analysis), updated_at: new Date().toISOString() })
        .eq('id', finding.id);
    } else {
      const cacheKey = `${finding.fingerprint}:${modelName}`;
      memoryDb.ai_analysis.set(cacheKey, {
        user_id: userId,
        finding_id: finding.id,
        fingerprint: finding.fingerprint,
        model: modelName,
        explanation: JSON.stringify(analysis),
        analysis,
        created_at: new Date().toISOString(),
      });
      finding.explanation = JSON.stringify(analysis);
      finding.updated_at = new Date().toISOString();
    }

    res.json({
      finding_id: finding.id,
      fingerprint: finding.fingerprint,
      model: modelName,
      cached: false,
      analysis,
    });
  }

  /**
   * STEP 2: EXPLAIN - Legacy compatibility wrapper
   */
  static async explain(req: Request, res: Response): Promise<void> {
    return FindingsController.explainById(req, res);
  }

  /**
   * STEP 3: FIX - Gemini proposes clean, verifiable unified git diff
   * STRICT RULE: Gemini only proposes diffs; NEVER verifies them or sets score.
   */
  static async proposeDiff(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { finding_id, user_context } = req.body;
    const db = req.supabase;

    let finding: FindingRecord | null = null;
    if (db) {
      const { data } = await db.from('findings').select('*').eq('id', finding_id).maybeSingle();
      finding = data as FindingRecord | null;
    } else {
      finding = memoryDb.findings.get(finding_id) || null;
    }

    if (!assertTenantOwnership(finding, userId, res)) return;

    // Call server-side Gemini to generate patch
    const proposed_diff = await GeminiSecurityAssistant.proposeDiff(finding.raw_finding || finding, user_context);

    // Update status to 'patch_proposed' (score remains untouched)
    const updated: Partial<FindingRecord> = {
      proposed_diff,
      status: 'patch_proposed',
      updated_at: new Date().toISOString(),
    };

    if (db) {
      await db.from('findings').update(updated).eq('id', finding.id);
    } else {
      Object.assign(finding, updated);
    }

    res.json({
      finding_id: finding.id,
      proposed_diff,
      status: 'patch_proposed',
    });
  }

  /**
   * POST /api/findings/:id/generate-fix
   * Gemini returns a unified diff ONLY for the finding's file(s).
   * Validates with `git apply --check` in scan workspace.
   * If it fails, retries once with the error.
   * If still failing, stores no diff and tells user honestly (explanation remains).
   * If valid, saves to ai_analysis.proposed_fix and sets status FIX_PROPOSED.
   */
  static async generateFix(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const targetId = req.params.id || req.body?.finding_id;
    const db = req.supabase;

    if (!targetId) {
      res.status(400).json({ error: 'Finding ID or fingerprint is required' });
      return;
    }

    if (!checkUserRateLimit(userId)) {
      res.status(429).json({
        error: 'Rate limit exceeded. Please wait a moment before requesting another fix.',
      });
      return;
    }

    let finding: FindingRecord | null = null;
    if (db) {
      const { data } = await db.from('findings').select('*').eq('id', targetId).maybeSingle();
      finding = data as FindingRecord | null;
      if (!finding) {
        const { data: byFp } = await db.from('findings').select('*').eq('fingerprint', targetId).maybeSingle();
        finding = byFp as FindingRecord | null;
      }
    } else {
      finding = memoryDb.findings.get(targetId) || null;
      if (!finding) {
        finding = Array.from(memoryDb.findings.values()).find((f) => f.fingerprint === targetId) || null;
      }
    }

    if (!assertTenantOwnership(finding, userId, res)) return;

    // Determine workspace path
    let workspacePath = path.join(WORKSPACE_BASE_DIR, finding.scan_id);
    if (db) {
      const { data: scan } = await db.from('scans').select('workspace_path').eq('id', finding.scan_id).maybeSingle();
      if (scan?.workspace_path) {
        workspacePath = scan.workspace_path;
      }
    } else {
      const scan = memoryDb.scans.get(finding.scan_id);
      if (scan?.workspace_path) {
        workspacePath = scan.workspace_path;
      }
    }

    // Initialize git repo in workspace if not present
    initWorkspaceGit(workspacePath, finding);

    const modelName = config.geminiModel;

    // Attempt 1: Generate unified diff with Gemini
    const diff1 = await GeminiSecurityAssistant.generateUnifiedFix(finding, workspacePath);
    const check1 = validateGitDiff(workspacePath, diff1);

    let finalDiff: string | null = null;

    if (check1.valid) {
      finalDiff = diff1;
    } else {
      console.warn(`[generateFix] Attempt 1 failed git apply --check: ${check1.error}. Retrying once with error feedback...`);
      // Attempt 2 (Retry once with error feedback)
      const diff2 = await GeminiSecurityAssistant.generateUnifiedFix(finding, workspacePath, check1.error);
      const check2 = validateGitDiff(workspacePath, diff2);

      if (check2.valid) {
        finalDiff = diff2;
      } else {
        console.warn(`[generateFix] Attempt 2 failed git apply --check: ${check2.error}. Storing no diff.`);
        // "if still failing, store no diff and tell the user honestly (explanation remains)"
        if (db) {
          await db
            .from('ai_analysis')
            .update({ proposed_fix: null, proposed_diff: null })
            .eq('finding_id', finding.id);
        } else {
          const cacheKey = `${finding.fingerprint}:${modelName}`;
          const existing = memoryDb.ai_analysis.get(cacheKey);
          if (existing) {
            existing.proposed_fix = null;
            existing.proposed_diff = null;
          }
        }

        res.status(200).json({
          success: false,
          error: `Could not generate a patch that passes git apply --check: ${check2.error || 'Patch rejection'}. Explanation remains available.`,
          diff: null,
          status: finding.status,
        });
        return;
      }
    }

    // Valid diff verified by git apply --check!
    // "Save to ai_analysis.proposed_fix; set status FIX_PROPOSED."
    if (db) {
      const { data: existingAnalysis } = await db
        .from('ai_analysis')
        .select('id')
        .eq('finding_id', finding.id)
        .maybeSingle();

      if (existingAnalysis) {
        await db
          .from('ai_analysis')
          .update({
            proposed_fix: finalDiff,
            proposed_diff: finalDiff,
            fingerprint: finding.fingerprint,
            model: modelName,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingAnalysis.id);
      } else {
        await db.from('ai_analysis').insert({
          user_id: userId,
          finding_id: finding.id,
          fingerprint: finding.fingerprint,
          model: modelName,
          proposed_fix: finalDiff,
          proposed_diff: finalDiff,
        });
      }

      await db
        .from('findings')
        .update({
          status: 'FIX_PROPOSED',
          proposed_diff: finalDiff,
          updated_at: new Date().toISOString(),
        })
        .eq('id', finding.id);
    } else {
      const cacheKey = `${finding.fingerprint}:${modelName}`;
      const existing = memoryDb.ai_analysis.get(cacheKey) || {
        user_id: userId,
        finding_id: finding.id,
        fingerprint: finding.fingerprint,
        model: modelName,
        created_at: new Date().toISOString(),
      };
      existing.proposed_fix = finalDiff;
      existing.proposed_diff = finalDiff;
      memoryDb.ai_analysis.set(cacheKey, existing);

      finding.status = 'FIX_PROPOSED';
      finding.proposed_diff = finalDiff || undefined;
    }

    res.json({
      success: true,
      diff: finalDiff,
      status: 'FIX_PROPOSED',
      message: 'Unified diff generated and verified with git apply --check.',
    });
  }

  /**
   * POST /api/findings/:id/apply-fix
   * Re-runs `git apply --check`, then `git apply` in the workspace.
   * Sets status FIX_APPLIED. Never touches user's real repo or production.
   */
  static async applyFix(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const targetId = req.params.id || req.body?.finding_id;
    const db = req.supabase;

    if (!targetId) {
      res.status(400).json({ error: 'Finding ID or fingerprint is required' });
      return;
    }

    let finding: FindingRecord | null = null;
    if (db) {
      const { data } = await db.from('findings').select('*').eq('id', targetId).maybeSingle();
      finding = data as FindingRecord | null;
      if (!finding) {
        const { data: byFp } = await db.from('findings').select('*').eq('fingerprint', targetId).maybeSingle();
        finding = byFp as FindingRecord | null;
      }
    } else {
      finding = memoryDb.findings.get(targetId) || null;
      if (!finding) {
        finding = Array.from(memoryDb.findings.values()).find((f) => f.fingerprint === targetId) || null;
      }
    }

    if (!assertTenantOwnership(finding, userId, res)) return;

    const modelName = config.geminiModel;

    // Retrieve diff from request body, ai_analysis, or finding record
    let diffToApply = req.body?.diff || null;

    if (!diffToApply) {
      if (db) {
        const { data: analysis } = await db
          .from('ai_analysis')
          .select('proposed_fix, proposed_diff')
          .eq('finding_id', finding.id)
          .maybeSingle();
        diffToApply = analysis?.proposed_fix || analysis?.proposed_diff || finding.proposed_diff || null;
      } else {
        const cacheKey = `${finding.fingerprint}:${modelName}`;
        const analysis = memoryDb.ai_analysis.get(cacheKey);
        diffToApply = analysis?.proposed_fix || analysis?.proposed_diff || finding.proposed_diff || null;
      }
    }

    if (!diffToApply) {
      res.status(400).json({
        success: false,
        error: 'No proposed fix found. Please generate a fix first before applying.',
      });
      return;
    }

    // Determine workspace path
    let workspacePath = path.join(WORKSPACE_BASE_DIR, finding.scan_id);
    if (db) {
      const { data: scan } = await db.from('scans').select('workspace_path').eq('id', finding.scan_id).maybeSingle();
      if (scan?.workspace_path) {
        workspacePath = scan.workspace_path;
      }
    } else {
      const scan = memoryDb.scans.get(finding.scan_id);
      if (scan?.workspace_path) {
        workspacePath = scan.workspace_path;
      }
    }

    // Ensure workspace git repository is initialized
    initWorkspaceGit(workspacePath, finding);

    // 1. Re-run `git apply --check` in the workspace
    const check = validateGitDiff(workspacePath, diffToApply);
    if (!check.valid) {
      res.status(400).json({
        success: false,
        error: `Cannot apply patch: git apply --check failed: ${check.error}`,
      });
      return;
    }

    // 2. Run `git apply` in the workspace (never touching real repo/production)
    const applyResult = applyGitDiff(workspacePath, diffToApply);
    if (!applyResult.success) {
      res.status(500).json({
        success: false,
        error: `Failed to apply fix to workspace: ${applyResult.error}`,
      });
      return;
    }

    // 3. Set status FIX_APPLIED
    if (db) {
      await db
        .from('findings')
        .update({
          status: 'FIX_APPLIED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', finding.id);
      await recomputeScan(finding.scan_id, db);
    } else {
      finding.status = 'FIX_APPLIED';
      finding.updated_at = new Date().toISOString();
      await recomputeScan(finding.scan_id);
    }

    res.json({
      success: true,
      status: 'FIX_APPLIED',
      message: 'Applies to the scan workspace for verification. Copy the diff into your own code.',
    });
  }

  /**
   * STEP 4: VERIFY - POST /api/findings/:id/verify
   * Use the engine's per-finding verification if available; else re-run scanner on affected file(s).
   * Result mapping:
   *   fingerprint absent -> VERIFIED
   *   present -> OPEN (note "still present")
   *   scanner error/unsupported -> INCONCLUSIVE
   * Save verification_runs {previous_status, new_status, evidence}.
   * Recompute score. Only the scanner result may set these statuses.
   */
  static async verifyFinding(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const targetId = req.params.id || req.body?.finding_id;
    const db = req.supabase;

    if (!targetId) {
      res.status(400).json({ error: 'Finding ID is required' });
      return;
    }

    let finding: FindingRecord | null = null;
    if (db) {
      const { data } = await db.from('findings').select('*').eq('id', targetId).maybeSingle();
      finding = data as FindingRecord | null;
      if (!finding) {
        const { data: byFp } = await db.from('findings').select('*').eq('fingerprint', targetId).maybeSingle();
        finding = byFp as FindingRecord | null;
      }
    } else {
      finding = memoryDb.findings.get(targetId) || null;
      if (!finding) {
        finding = Array.from(memoryDb.findings.values()).find((f) => f.fingerprint === targetId) || null;
      }
    }

    if (!assertTenantOwnership(finding, userId, res)) return;

    const previous_status = finding.status || 'OPEN';

    // Determine workspace path
    let workspacePath = path.join(WORKSPACE_BASE_DIR, finding.scan_id);
    if (db) {
      const { data: scan } = await db.from('scans').select('workspace_path').eq('id', finding.scan_id).maybeSingle();
      if (scan?.workspace_path) {
        workspacePath = scan.workspace_path;
      }
    } else {
      const scan = memoryDb.scans.get(finding.scan_id);
      if (scan?.workspace_path) {
        workspacePath = scan.workspace_path;
      }
    }

    // Determine diff to verify
    let diffToVerify = req.body?.applied_diff !== undefined ? req.body.applied_diff : (req.body?.diff !== undefined ? req.body.diff : null);

    if (diffToVerify === null) {
      diffToVerify = finding.proposed_diff || null;
      if (!diffToVerify && db) {
        const { data: analysis } = await db
          .from('ai_analysis')
          .select('proposed_fix, proposed_diff')
          .eq('finding_id', finding.id)
          .maybeSingle();
        diffToVerify = analysis?.proposed_fix || analysis?.proposed_diff || null;
      }
    }

    // If git is initialized in workspace, check git diff for actual workspace changes
    if (diffToVerify === null && fs.existsSync(workspacePath) && fs.existsSync(path.join(workspacePath, '.git'))) {
      try {
        const gitDiff = execSync('git diff HEAD', { cwd: workspacePath, encoding: 'utf-8', timeout: 5000 });
        if (gitDiff && gitDiff.trim().length > 0) {
          diffToVerify = gitDiff;
        }
      } catch {}
    }

    // Also inspect affected file in workspace if present
    if (diffToVerify === null && finding.file_path && fs.existsSync(workspacePath)) {
      const fullFilePath = path.resolve(workspacePath, finding.file_path);
      if (fs.existsSync(fullFilePath)) {
        try {
          const fileContent = fs.readFileSync(fullFilePath, 'utf-8');
          if (fileContent) {
            diffToVerify = fileContent;
          }
        } catch {}
      }
    }

    let verificationResult: any;
    try {
      if (diffToVerify !== null && typeof diffToVerify === 'string') {
        if (diffToVerify.trim().length === 0) {
          verificationResult = {
            verified: false,
            engine_verdict: 'INCONCLUSIVE',
            scanner_name: finding.scanner_name || finding.source || 'scanner',
            verification_time: new Date().toISOString(),
            message: 'Scanner verification inconclusive: No applied patch or diff available to evaluate.',
            evidence_text: 'Scanner verification inconclusive: No applied patch or diff available to evaluate.',
          };
        } else {
          // Explicit diff provided in request body - verify diff directly
          verificationResult = EngineVerifier.verifyPatch(
            (finding.raw_finding || finding) as any,
            diffToVerify
          );
        }
      } else if (fs.existsSync(workspacePath) && finding.file_path && fs.existsSync(path.join(workspacePath, finding.file_path))) {
        // Workspace file exists - verify the modified file on disk
        const pvRes = await PatchVerifier.verifyFindingPatch(workspacePath, {
          fingerprint: finding.fingerprint,
          file_path: finding.file_path,
          category: finding.category,
          title: finding.title,
          status: finding.status,
          rule_id: (finding.evidence as any)?.rule_id || (finding.raw_finding as any)?.rule_id,
        } as any);
        verificationResult = {
          verified: pvRes.verified,
          engine_verdict: pvRes.verdict === 'VERIFIED' ? 'PASSED' : (pvRes.verdict === 'FAILED' ? 'FAILED' : 'INCONCLUSIVE'),
          scanner_name: pvRes.scanner_name,
          verification_time: new Date().toISOString(),
          message: pvRes.message,
          evidence_text: pvRes.message,
          evidence: pvRes.evidence,
        };
      } else {
        verificationResult = {
          verified: false,
          engine_verdict: 'INCONCLUSIVE',
          scanner_name: finding.scanner_name || finding.source || 'scanner',
          verification_time: new Date().toISOString(),
          message: 'No diff or workspace file available to verify.',
          evidence_text: 'No diff or workspace file available to verify.',
        };
      }
    } catch (err: any) {
      verificationResult = {
        verified: false,
        engine_verdict: 'INCONCLUSIVE',
        scanner_name: finding.scanner_name || finding.source || 'scanner',
        verification_time: new Date().toISOString(),
        message: `Scanner error during verification: ${err.message}`,
        evidence_text: `Scanner error during verification: ${err.message}`,
      };
    }

    // 2. Result mapping:
    // fingerprint absent -> VERIFIED
    // present -> OPEN (note "still present")
    // scanner error/unsupported -> INCONCLUSIVE
    let new_status: 'VERIFIED' | 'OPEN' | 'INCONCLUSIVE';
    let evidenceMessage = verificationResult.message || '';
    let evidenceNote: string | undefined = undefined;

    if (verificationResult.engine_verdict === 'PASSED') {
      new_status = 'VERIFIED';
    } else if (verificationResult.engine_verdict === 'FAILED') {
      new_status = 'OPEN';
      evidenceNote = 'still present';
      if (!evidenceMessage.toLowerCase().includes('still present')) {
        evidenceMessage = `Vulnerability still present: ${evidenceMessage}`;
      }
    } else {
      new_status = 'INCONCLUSIVE';
    }

    const evidence = {
      verdict: verificationResult.engine_verdict,
      scanner_name: verificationResult.scanner_name || finding.scanner_name || finding.source || 'scanner',
      message: evidenceMessage,
      evidence_text: evidenceMessage,
      note: evidenceNote,
      verified: new_status === 'VERIFIED',
      fingerprint: finding.fingerprint,
      file_path: finding.file_path,
      verification_time: verificationResult.verification_time || new Date().toISOString(),
    };

    const verificationRunRecord = {
      id: crypto.randomUUID(),
      user_id: userId,
      finding_id: finding.id,
      scan_id: finding.scan_id,
      previous_status,
      new_status,
      evidence,
      verdict: verificationResult.engine_verdict,
      scanner_name: evidence.scanner_name,
      verified: new_status === 'VERIFIED',
      message: evidenceMessage,
      diff_applied: diffToVerify || null,
      created_at: new Date().toISOString(),
    };

    // Save verification_runs {previous_status, new_status, evidence}
    if (db) {
      await db.from('verification_runs').insert(verificationRunRecord);
      await db
        .from('findings')
        .update({
          status: new_status,
          verification_result: evidence,
          updated_at: new Date().toISOString(),
        })
        .eq('id', finding.id);
    } else {
      memoryDb.verification_runs.set(verificationRunRecord.id, verificationRunRecord);
      finding.status = new_status;
      finding.verification_result = evidence;
      finding.updated_at = new Date().toISOString();
    }

    // Recompute score: Only the scanner result may set these statuses.
    const scanMetrics = await recomputeScan(finding.scan_id, db);

    res.status(200).json({
      success: true,
      finding_id: finding.id,
      previous_status,
      new_status,
      status: new_status,
      evidence,
      verification_run: verificationRunRecord,
      scan_metrics: scanMetrics,
      message: evidenceMessage,
    });
  }

  /**
   * Updates finding status (OPEN, ACCEPTED_RISK, FALSE_POSITIVE, etc.)
   * and triggers deterministic recomputeScan.
   */
  static async updateStatus(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { id } = req.params;
    const { status } = req.body;
    const db = req.supabase;

    let finding: FindingRecord | null = null;
    if (db) {
      const { data } = await db.from('findings').select('*').eq('id', id).maybeSingle();
      finding = data as FindingRecord | null;
    } else {
      finding = memoryDb.findings.get(id) || null;
    }

    if (!assertTenantOwnership(finding, userId, res)) return;

    const validStatuses = [
      'OPEN',
      'FIX_PROPOSED',
      'FIX_APPLIED',
      'VERIFIED',
      'REGRESSED',
      'INCONCLUSIVE',
      'ACCEPTED_RISK',
      'FALSE_POSITIVE',
    ];

    const normalizedStatus = String(status || '').toUpperCase();
    if (!validStatuses.includes(normalizedStatus)) {
      res.status(400).json({ error: `Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    const updated = {
      status: normalizedStatus,
      updated_at: new Date().toISOString(),
    };

    if (db) {
      await db.from('findings').update(updated).eq('id', finding.id);
    } else {
      Object.assign(finding, updated);
    }

    const scanMetrics = await recomputeScan(finding.scan_id, db);

    res.json({
      finding: { ...finding, ...updated },
      scan_metrics: scanMetrics,
    });
  }

  /**
   * STEP 5: RE-SCAN - Enqueues full regression scan to confirm clean state
   */
  static async reScan(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { scan_id } = req.body;
    const db = req.supabase;

    let previousScan: Scan | null = null;
    if (db) {
      const { data } = await db.from('scans').select('*').eq('id', scan_id).maybeSingle();
      previousScan = data as Scan | null;
    } else {
      previousScan = memoryDb.scans.get(scan_id) || null;
    }

    if (!assertTenantOwnership(previousScan, userId, res)) return;

    // Create fresh queued scan for worker
    const freshScan: Scan = {
      id: crypto.randomUUID(),
      project_id: previousScan.project_id,
      user_id: userId,
      status: 'queued',
      scan_mode: previousScan.scan_mode,
      target_type: previousScan.target_type,
      target_path: previousScan.target_path,
      result_json: null,
      findings_count: 0,
      critical_count: 0,
      high_count: 0,
      medium_count: 0,
      low_count: 0,
      security_score: 0,
      scan_duration_seconds: 0,
      created_at: new Date().toISOString(),
    };

    if (db) {
      await db.from('scans').insert(freshScan);
    } else {
      memoryDb.scans.set(freshScan.id, freshScan);
    }

    res.status(202).json({
      message: 'Re-scan initiated. Worker will execute full verification pass.',
      scan: freshScan,
    });
  }

  /**
   * GET /api/ai_analysis/:id or /api/ai-analysis/:id
   * STRICT SECURITY: Return 404 on other users' AI analysis to prevent ID enumeration.
   */
  static async getAiAnalysisById(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { id } = req.params;
    const db = req.supabase;

    let analysis: any = null;
    if (db) {
      const { data } = await db.from('ai_analysis').select('*').eq('id', id).maybeSingle();
      analysis = data;
      if (!analysis) {
        const { data: byFinding } = await db.from('ai_analysis').select('*').eq('finding_id', id).maybeSingle();
        analysis = byFinding;
      }
    } else {
      analysis = memoryDb.ai_analysis.get(id) || null;
      if (!analysis) {
        analysis = Array.from(memoryDb.ai_analysis.values()).find(
          (a) => a.id === id || a.finding_id === id
        ) || null;
      }
    }

    if (!assertTenantOwnership(analysis, userId, res)) return;

    res.json({ analysis });
  }
}

