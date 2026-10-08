import { Router } from 'express';
import { ProjectsController } from './controllers/projectsController.js';
import { ScansController } from './controllers/scansController.js';
import { FindingsController } from './controllers/findingsController.js';
import { authMiddleware } from './middleware/auth.js';
import { validateBody, validateParams } from './middleware/validate.js';
import { zipUploadMiddleware } from './middleware/upload.js';
import { 
  CreateProjectSchema, 
  UpdateProjectSchema,
  CreateScanSchema, 
  ExplainFindingSchema, 
  ProposeDiffSchema, 
  VerifyFindingSchema, 
  ReScanSchema 
} from '@secuai/shared';

import { AuthController } from './controllers/authController.js';
import { GeminiSecurityAssistant } from './services/gemini.js';
import { memoryDb } from './db/supabase.js';

const router = Router();

// Health Check
router.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'SecuAI API & Worker',
    scanner: 'isitsecure subprocess',
    gemini_model: 'gemini-3.8-flash (server-side only)',
    architecture: 'Postgres Worker Polling (Zero Redis/BullMQ)',
    timestamp: new Date().toISOString(),
  });
});

// AI Security Assistant Conversational Endpoints (Supports arbitrary developer security questions)
async function handleAssistantChat(req: any, res: any) {
  const { message, finding_id, code_snippet, file_location, project_id, scan_id, model } = req.body || {};
  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Message text is required' });
    return;
  }

  let findingTitle: string | undefined;
  let codeSnippet: string | undefined = code_snippet;
  let fileLocation: string | undefined = file_location;
  let findingEvidence: any = undefined;
  let projectContext: any = undefined;
  let scanContext: any = undefined;
  let findingsList: any[] = [];

  // 1. Finding context if provided
  if (finding_id) {
    const f = memoryDb.findings.get(finding_id);
    if (f) {
      findingTitle = f.title;
      fileLocation = fileLocation || (f.file_path ? `${f.file_path}:${f.line_start || 1}` : undefined);
      codeSnippet = codeSnippet || (f.code_snippet || (f.evidence as any)?.code_snippet);
      findingEvidence = f.evidence;
    }
  }

  // 2. Project context
  const pId = project_id || (finding_id ? memoryDb.findings.get(finding_id)?.project_id : undefined);
  if (pId) {
    const p = memoryDb.projects.get(pId);
    if (p) {
      projectContext = {
        name: p.name,
        framework: p.framework,
        repo_url: p.repository_url || p.repo_url || p.target_url,
        source_type: p.source_type,
      };
    }
  }

  // 3. Scan & findings context
  const sId = scan_id || (finding_id ? memoryDb.findings.get(finding_id)?.scan_id : undefined);
  if (sId) {
    const s = memoryDb.scans.get(sId);
    if (s) {
      scanContext = {
        id: s.id,
        target_type: s.target_type,
        target_path: s.target_path,
        security_score: s.security_score,
        findings_count: s.findings_count,
        discovery_summary: s.discovery_summary,
        status: s.status,
      };
      findingsList = Array.from(memoryDb.findings.values()).filter(f => f.scan_id === s.id);
    }
  } else if (pId) {
    const scans = Array.from(memoryDb.scans.values()).filter(s => s.project_id === pId);
    if (scans.length > 0) {
      const latestScan = scans.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      scanContext = {
        id: latestScan.id,
        target_type: latestScan.target_type,
        target_path: latestScan.target_path,
        security_score: latestScan.security_score,
        findings_count: latestScan.findings_count,
        discovery_summary: latestScan.discovery_summary,
        status: latestScan.status,
      };
      findingsList = Array.from(memoryDb.findings.values()).filter(f => f.scan_id === latestScan.id);
    }
  } else {
    // If no specific project/scan requested, use active findings from memoryDb
    findingsList = Array.from(memoryDb.findings.values());
    const allScans = Array.from(memoryDb.scans.values());
    if (allScans.length > 0) {
      const latestScan = allScans.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      scanContext = {
        id: latestScan.id,
        security_score: latestScan.security_score,
        findings_count: latestScan.findings_count,
        discovery_summary: latestScan.discovery_summary,
        status: latestScan.status,
      };
    }
  }

  try {
    const result = await GeminiSecurityAssistant.chatWithAssistant({
      message,
      findingTitle,
      codeSnippet,
      fileLocation,
      findingEvidence,
      project: projectContext,
      scan: scanContext,
      findings: findingsList,
      model,
    });
    res.json({ success: true, reply: result.reply, model: result.model });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate AI response' });
  }
}

router.post('/ai/chat', handleAssistantChat);
router.post('/assistant/chat', handleAssistantChat);

// Public Authentication Endpoints (custom bcrypt + JWT per hackathon spec)
router.post('/auth/register', AuthController.register);
router.post('/auth/signup', AuthController.register);
router.post('/auth/login', AuthController.login);
router.post('/auth/signin', AuthController.login);

// All protected API routes require auth context
router.use(authMiddleware);

// Authenticated User Context
router.get('/auth/me', AuthController.me);

// Projects Endpoints: GET/POST /api/projects, GET/PATCH/DELETE /api/projects/:id
router.get('/projects', ProjectsController.list);
router.post('/projects', validateBody(CreateProjectSchema), ProjectsController.create);
router.get('/projects/:id', ProjectsController.getById);
router.patch('/projects/:id', validateBody(UpdateProjectSchema), ProjectsController.update);
router.delete('/projects/:id', ProjectsController.delete);

// Project Scans Endpoint: POST /api/projects/:id/scans
router.post('/projects/:id/scans', zipUploadMiddleware, ScansController.createForProject);
router.get('/projects/:id/scans', ScansController.list);

// Scans Endpoints
router.get('/scans', ScansController.list);
router.post('/scans', validateBody(CreateScanSchema), ScansController.create);
router.get('/scans/:id/export.json', ScansController.exportJson);
router.get('/scans/:id/export', ScansController.exportJson);
router.get('/scans/:id/ai-report', ScansController.getAiReport);
router.get('/scans/:id', ScansController.getById);

// Findings & Loop Endpoints: DETECT -> EXPLAIN -> FIX -> VERIFY -> RE-SCAN
router.get('/findings', FindingsController.listAll);
router.get('/scans/:scanId/findings', FindingsController.listByScan);
router.get('/findings/:id', FindingsController.getById);
router.get('/findings/:id/analysis', FindingsController.getAiAnalysisById);
router.get('/ai_analysis/:id', FindingsController.getAiAnalysisById);
router.get('/ai-analysis/:id', FindingsController.getAiAnalysisById);
router.post('/findings/:id/explain', FindingsController.explainById);
router.post('/findings/explain', validateBody(ExplainFindingSchema), FindingsController.explain);
router.post('/findings/:id/generate-fix', FindingsController.generateFix);
router.post('/findings/generate-fix', FindingsController.generateFix);
router.post('/findings/:id/apply-fix', FindingsController.applyFix);
router.post('/findings/apply-fix', FindingsController.applyFix);
router.post('/findings/propose-diff', validateBody(ProposeDiffSchema), FindingsController.proposeDiff);
router.post('/findings/:id/verify', FindingsController.verifyFinding);
router.post('/findings/verify', validateBody(VerifyFindingSchema), FindingsController.verifyFinding);
router.patch('/findings/:id', FindingsController.updateStatus);
router.post('/scans/re-scan', validateBody(ReScanSchema), FindingsController.reScan);

export default router;
