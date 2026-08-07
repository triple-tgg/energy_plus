import { Router } from 'express';
import { MeterDataController } from './meterData.controller';
import { authenticate } from '../../middleware/auth';
import { enforceSiteAccess } from '../../middleware/accessControl';

const router = Router();
const c = new MeterDataController();

router.use(authenticate, enforceSiteAccess);
router.get('/realtime', c.getRealtime);
router.get('/history', c.getHistory);
router.get('/daily', c.getDaily);
router.get('/monthly', c.getMonthly);

export default router;
