import { Router, json } from 'express';
import { MetersController } from './meters.controller';
import { authenticate } from '../../middleware/auth';
import { enforceMeterSiteAccess, enforceSiteAccess, requireRole } from '../../middleware/accessControl';

const router = Router();
const c = new MetersController();

// Static routes must precede /:id.
router.get('/energy-values', authenticate, c.getEnergyValues);
router.post('/import', authenticate, requireRole('admin'), json({ limit: '10mb' }), c.importMeters);

router.get('/brands/list', authenticate, c.getBrands);
router.post('/brands', authenticate, requireRole('admin'), c.createBrand);
router.put('/brands/:id', authenticate, requireRole('admin'), c.updateBrand);
router.delete('/brands/:id', authenticate, requireRole('admin'), c.deleteBrand);

router.get('/types/list', authenticate, c.getTypes);
router.post('/types', authenticate, requireRole('admin'), c.createType);
router.put('/types/:id', authenticate, requireRole('admin'), c.updateType);
router.delete('/types/:id', authenticate, requireRole('admin'), c.deleteType);

router.get('/loops/list', authenticate, c.getLoops);
router.post('/loops', authenticate, requireRole('admin'), c.createLoop);
router.put('/loops/:id', authenticate, requireRole('admin'), c.updateLoop);
router.delete('/loops/:id', authenticate, requireRole('admin'), c.deleteLoop);

router.get('/', authenticate, enforceSiteAccess, c.getMeters);
router.post('/', authenticate, requireRole('admin'), c.createMeter);
router.get('/:id', authenticate, enforceMeterSiteAccess, c.getMeterById);
router.put('/:id', authenticate, requireRole('admin'), c.updateMeter);
router.post('/:id/manual-reading', authenticate, requireRole('operator', 'admin'), enforceMeterSiteAccess, c.addManualReading);
router.delete('/:id', authenticate, requireRole('admin'), c.deleteMeter);

export default router;
