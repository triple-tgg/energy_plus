import { Router } from 'express';
import { DashboardController } from './dashboard.controller';
import { authenticate } from '../../middleware/auth';
import { enforceSiteAccess } from '../../middleware/accessControl';

const router = Router();
const c = new DashboardController();

router.use(authenticate, enforceSiteAccess);
router.get('/zone', c.getZoneDashboard);
router.get('/zone-consumption', c.getZoneConsumption);
router.get('/mdb-consumption', c.getMdbConsumption);
router.get('/demand', c.getDemandData);
router.get('/demand-monthly', c.getDemandMonthly);
router.get('/consumption-table', c.getConsumptionTable);
router.get('/consumption-meters', c.getConsumptionMeters);

export default router;
