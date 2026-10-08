import { Router } from 'express';
import { FindingsController } from './findings.controller.js';
import { authMiddleware } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { ExplainFindingSchema, ProposeDiffSchema, VerifyFindingSchema, ReScanSchema } from '@secuai/shared';

const router = Router();

router.use(authMiddleware);

router.get('/', FindingsController.listAll);
router.get('/:id', FindingsController.getById);
router.get('/:id/analysis', FindingsController.getAiAnalysisById);
router.post('/:id/explain', FindingsController.explainById);
router.post('/explain', validateBody(ExplainFindingSchema), FindingsController.explain);
router.post('/:id/generate-fix', FindingsController.generateFix);
router.post('/generate-fix', FindingsController.generateFix);
router.post('/:id/apply-fix', FindingsController.applyFix);
router.post('/apply-fix', FindingsController.applyFix);
router.post('/propose-diff', validateBody(ProposeDiffSchema), FindingsController.proposeDiff);
router.post('/:id/verify', FindingsController.verifyFinding);
router.post('/verify', validateBody(VerifyFindingSchema), FindingsController.verifyFinding);
router.patch('/:id', FindingsController.updateStatus);

export default router;
