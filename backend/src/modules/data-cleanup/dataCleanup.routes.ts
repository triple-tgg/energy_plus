import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/accessControl';
import { DataCleanupController } from './dataCleanup.controller';

const router = Router();
const controller = new DataCleanupController();

// Admin only
router.use(authenticate, requireRole('admin'));
router.get('/realtime-stats', controller.getRealtimeStats);
router.post('/purge-realtime', controller.purgeRealtimeData);

export default router;
