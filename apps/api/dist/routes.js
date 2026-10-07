"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const projectsController_js_1 = require("./controllers/projectsController.js");
const scansController_js_1 = require("./controllers/scansController.js");
const findingsController_js_1 = require("./controllers/findingsController.js");
const auth_js_1 = require("./middleware/auth.js");
const validate_js_1 = require("./middleware/validate.js");
const upload_js_1 = require("./middleware/upload.js");
const shared_1 = require("@secuai/shared");
const authController_js_1 = require("./controllers/authController.js");
const router = (0, express_1.Router)();
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
// Public Authentication Endpoints (custom bcrypt + JWT per hackathon spec)
router.post('/auth/register', authController_js_1.AuthController.register);
router.post('/auth/signup', authController_js_1.AuthController.register);
router.post('/auth/login', authController_js_1.AuthController.login);
router.post('/auth/signin', authController_js_1.AuthController.login);
// All protected API routes require auth context
router.use(auth_js_1.authMiddleware);
// Authenticated User Context
router.get('/auth/me', authController_js_1.AuthController.me);
// Projects Endpoints: GET/POST /api/projects, GET/PATCH/DELETE /api/projects/:id
router.get('/projects', projectsController_js_1.ProjectsController.list);
router.post('/projects', (0, validate_js_1.validateBody)(shared_1.CreateProjectSchema), projectsController_js_1.ProjectsController.create);
router.get('/projects/:id', projectsController_js_1.ProjectsController.getById);
router.patch('/projects/:id', (0, validate_js_1.validateBody)(shared_1.UpdateProjectSchema), projectsController_js_1.ProjectsController.update);
router.delete('/projects/:id', projectsController_js_1.ProjectsController.delete);
// Project Scans Endpoint: POST /api/projects/:id/scans
router.post('/projects/:id/scans', upload_js_1.zipUploadMiddleware, scansController_js_1.ScansController.createForProject);
router.get('/projects/:id/scans', scansController_js_1.ScansController.list);
// Scans Endpoints
router.get('/scans', scansController_js_1.ScansController.list);
router.post('/scans', (0, validate_js_1.validateBody)(shared_1.CreateScanSchema), scansController_js_1.ScansController.create);
router.get('/scans/:id/export.json', scansController_js_1.ScansController.exportJson);
router.get('/scans/:id/export', scansController_js_1.ScansController.exportJson);
router.get('/scans/:id', scansController_js_1.ScansController.getById);
// Findings & Loop Endpoints: DETECT -> EXPLAIN -> FIX -> VERIFY -> RE-SCAN
router.get('/scans/:scanId/findings', findingsController_js_1.FindingsController.listByScan);
router.get('/findings/:id', findingsController_js_1.FindingsController.getById);
router.get('/findings/:id/analysis', findingsController_js_1.FindingsController.getAiAnalysisById);
router.get('/ai_analysis/:id', findingsController_js_1.FindingsController.getAiAnalysisById);
router.get('/ai-analysis/:id', findingsController_js_1.FindingsController.getAiAnalysisById);
router.post('/findings/:id/explain', findingsController_js_1.FindingsController.explainById);
router.post('/findings/explain', (0, validate_js_1.validateBody)(shared_1.ExplainFindingSchema), findingsController_js_1.FindingsController.explain);
router.post('/findings/:id/generate-fix', findingsController_js_1.FindingsController.generateFix);
router.post('/findings/generate-fix', findingsController_js_1.FindingsController.generateFix);
router.post('/findings/:id/apply-fix', findingsController_js_1.FindingsController.applyFix);
router.post('/findings/apply-fix', findingsController_js_1.FindingsController.applyFix);
router.post('/findings/propose-diff', (0, validate_js_1.validateBody)(shared_1.ProposeDiffSchema), findingsController_js_1.FindingsController.proposeDiff);
router.post('/findings/:id/verify', findingsController_js_1.FindingsController.verifyFinding);
router.post('/findings/verify', (0, validate_js_1.validateBody)(shared_1.VerifyFindingSchema), findingsController_js_1.FindingsController.verifyFinding);
router.patch('/findings/:id', findingsController_js_1.FindingsController.updateStatus);
router.post('/scans/re-scan', (0, validate_js_1.validateBody)(shared_1.ReScanSchema), findingsController_js_1.FindingsController.reScan);
exports.default = router;
