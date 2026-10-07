import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { authMiddleware } from '../../middleware/auth.js';

const router = Router();

router.post('/register', AuthController.register);
router.post('/signup', AuthController.register);
router.post('/login', AuthController.login);
router.post('/signin', AuthController.login);
router.get('/me', authMiddleware, AuthController.me);

export default router;
