import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { ReportsController } from './reports.controller';
import { enforceSiteAccess, requireRole } from '../../middleware/accessControl';

const router = Router();
const controller = new ReportsController();

router.use(authenticate, enforceSiteAccess);
router.get('/energy-consumption', controller.getEnergyConsumption);
router.get('/tou', controller.getTouReport);
router.get('/history', controller.getHistory);
router.get('/comparison', controller.getComparison);
router.get('/alarms', controller.getAlarms);
router.put('/alarms/:id/acknowledge', requireRole('operator', 'admin'), controller.acknowledgeAlarm);

export default router;
