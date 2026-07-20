import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { ReportsController } from './reports.controller';

const router = Router();
const controller = new ReportsController();

router.get('/energy-consumption', authenticate, controller.getEnergyConsumption);
router.get('/history', authenticate, controller.getHistory);
router.get('/comparison', authenticate, controller.getComparison);
router.get('/alarms', authenticate, controller.getAlarms);
router.put('/alarms/:id/acknowledge', authenticate, controller.acknowledgeAlarm);

export default router;
