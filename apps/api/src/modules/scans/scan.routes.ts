import { Router } from 'express';
import { ScansController } from './scan.controller.js';
import { authMiddleware } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { CreateScanSchema } from '@secuai/shared';

const router = Router();

router.use(authMiddleware);

router.get('/', ScansController.list);
router.post('/', validateBody(CreateScanSchema), ScansController.create);
router.get('/:id', ScansController.getById);
router.get('/:id/export.json', ScansController.exportJson);
router.get('/:id/export', ScansController.exportJson);
router.get('/:id/ai-report', ScansController.getAiReport);

export default router;
