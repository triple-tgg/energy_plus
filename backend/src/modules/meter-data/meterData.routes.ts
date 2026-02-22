import { Router } from 'express';
import { MeterDataController } from './meterData.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const c = new MeterDataController();

router.get('/realtime', authenticate, c.getRealtime);
router.get('/history', authenticate, c.getHistory);
router.get('/daily', authenticate, c.getDaily);
router.get('/monthly', authenticate, c.getMonthly);

export default router;
