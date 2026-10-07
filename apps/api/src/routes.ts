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

// All API routes require auth context
router.use(authMiddleware);

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
router.get('/scans/:id', ScansController.getById);

// Findings & Loop Endpoints: DETECT -> EXPLAIN -> FIX -> VERIFY -> RE-SCAN
router.get('/scans/:scanId/findings', FindingsController.listByScan);
router.get('/findings/:id', FindingsController.getById);
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
