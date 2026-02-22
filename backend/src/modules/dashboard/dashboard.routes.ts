import { Router } from 'express';
import { DashboardController } from './dashboard.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const c = new DashboardController();

router.get('/zone-consumption', authenticate, c.getZoneConsumption);
router.get('/mdb-consumption', authenticate, c.getMdbConsumption);
router.get('/demand', authenticate, c.getDemandData);
router.get('/consumption-table', authenticate, c.getConsumptionTable);

export default router;
