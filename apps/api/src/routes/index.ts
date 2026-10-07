import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import projectRoutes from '../modules/projects/project.routes.js';
import scanRoutes from '../modules/scans/scan.routes.js';
import findingRoutes from '../modules/findings/findings.routes.js';
import { zipUploadMiddleware } from '../middleware/upload.js';
import { ScansController } from '../controllers/scansController.js';
import { FindingsController } from '../controllers/findingsController.js';
import { validateBody } from '../middleware/validate.js';
import { ReScanSchema } from '@secuai/shared';

const router = Router();

// Health Check
router.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'SecuAI Modular API & Worker',
    scanner: 'isitsecure subprocess',
    architecture: 'Modular Domain-Driven Architecture (Hexagonal Engine)',
    timestamp: new Date().toISOString(),
  });
});

// Auth Module
router.use('/auth', authRoutes);

// Projects Module
router.use('/projects', projectRoutes);
router.post('/projects/:id/scans', zipUploadMiddleware, ScansController.createForProject);
router.get('/projects/:id/scans', ScansController.list);

// Scans Module
router.use('/scans', scanRoutes);

// Findings Module
router.get('/scans/:scanId/findings', FindingsController.listByScan);
router.use('/findings', findingRoutes);

// Remediation & Loop endpoints
router.post('/scans/re-scan', validateBody(ReScanSchema), FindingsController.reScan);

export default router;
