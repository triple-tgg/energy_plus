import { Router } from 'express';
import { BillingController } from './billing.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/accessControl';

const router = Router();
const c = new BillingController();

router.get('/configs', authenticate, c.getBillingConfigs);
router.post('/configs', authenticate, requireRole('admin'), c.createBillingConfig);
router.put('/configs/:id', authenticate, requireRole('admin'), c.updateBillingConfig);
router.delete('/configs/:id', authenticate, requireRole('admin'), c.deleteBillingConfig);

router.get('/demand', authenticate, c.getDemandConfigs);
router.post('/demand', authenticate, requireRole('admin'), c.createDemandConfig);
router.put('/demand/:id', authenticate, requireRole('admin'), c.updateDemandConfig);
router.delete('/demand/:id', authenticate, requireRole('admin'), c.deleteDemandConfig);

router.get('/tou-configs', authenticate, c.getTouConfigs);
router.get('/tou-configs/current', authenticate, c.getCurrentTouConfig);
router.post('/tou-configs', authenticate, requireRole('admin'), c.createTouConfig);
router.put('/tou-configs/:id', authenticate, requireRole('admin'), c.updateTouConfig);
router.delete('/tou-configs/:id', authenticate, requireRole('admin'), c.deleteTouConfig);

export default router;
