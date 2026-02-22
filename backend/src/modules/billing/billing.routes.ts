import { Router } from 'express';
import { BillingController } from './billing.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const c = new BillingController();

router.get('/configs', authenticate, c.getBillingConfigs);
router.post('/configs', authenticate, c.createBillingConfig);
router.put('/configs/:id', authenticate, c.updateBillingConfig);
router.delete('/configs/:id', authenticate, c.deleteBillingConfig);

router.get('/demand', authenticate, c.getDemandConfigs);
router.post('/demand', authenticate, c.createDemandConfig);
router.put('/demand/:id', authenticate, c.updateDemandConfig);
router.delete('/demand/:id', authenticate, c.deleteDemandConfig);

export default router;
