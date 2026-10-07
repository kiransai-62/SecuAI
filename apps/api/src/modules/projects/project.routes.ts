import { Router } from 'express';
import { ProjectsController } from './project.controller.js';
import { authMiddleware } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { CreateProjectSchema, UpdateProjectSchema } from '@secuai/shared';

const router = Router();

router.use(authMiddleware);

router.get('/', ProjectsController.list);
router.post('/', validateBody(CreateProjectSchema), ProjectsController.create);
router.get('/:id', ProjectsController.getById);
router.patch('/:id', validateBody(UpdateProjectSchema), ProjectsController.update);
router.delete('/:id', ProjectsController.delete);

export default router;
