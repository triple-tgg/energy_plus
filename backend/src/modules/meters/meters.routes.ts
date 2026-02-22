import { Router } from 'express';
import { MetersController } from './meters.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const c = new MetersController();

// Meters
router.get('/', authenticate, c.getMeters);
router.get('/energy-values', authenticate, c.getEnergyValues);
router.get('/:id', authenticate, c.getMeterById);
router.post('/', authenticate, c.createMeter);
router.put('/:id', authenticate, c.updateMeter);
router.delete('/:id', authenticate, c.deleteMeter);

// Brands
router.get('/brands/list', authenticate, c.getBrands);
router.post('/brands', authenticate, c.createBrand);
router.put('/brands/:id', authenticate, c.updateBrand);
router.delete('/brands/:id', authenticate, c.deleteBrand);

// Types
router.get('/types/list', authenticate, c.getTypes);
router.post('/types', authenticate, c.createType);
router.put('/types/:id', authenticate, c.updateType);
router.delete('/types/:id', authenticate, c.deleteType);

// Loops
router.get('/loops/list', authenticate, c.getLoops);
router.post('/loops', authenticate, c.createLoop);
router.put('/loops/:id', authenticate, c.updateLoop);
router.delete('/loops/:id', authenticate, c.deleteLoop);

export default router;
