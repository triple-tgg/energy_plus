import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new AuthController();

router.post('/login', controller.login);
router.post('/refresh', controller.refresh);
router.get('/me', authenticate, controller.me);
router.post('/change-password', authenticate, controller.changePassword);

export default router;
