import { Router } from 'express';
import { SitesController } from './sites.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new SitesController();

// === Static routes MUST come before parameterized /:id routes ===

// Buildings (static prefix)
router.get('/buildings/list', authenticate, controller.getBuildings);
router.get('/buildings/:id', authenticate, controller.getBuildingById);
router.post('/buildings', authenticate, controller.createBuilding);
router.put('/buildings/:id', authenticate, controller.updateBuilding);
router.delete('/buildings/:id', authenticate, controller.deleteBuilding);

// Zones (static prefix)
router.get('/zones/list', authenticate, controller.getZones);
router.get('/zones/:id', authenticate, controller.getZoneById);
router.post('/zones', authenticate, controller.createZone);
router.put('/zones/:id', authenticate, controller.updateZone);
router.delete('/zones/:id', authenticate, controller.deleteZone);

// Sites (root-level + parameterized)
router.get('/', authenticate, controller.getSites);
router.post('/', authenticate, controller.createSite);
router.get('/:id/hierarchy', authenticate, controller.getSiteHierarchy);
router.get('/:id/buildings', authenticate, controller.getBuildings);
router.get('/:id', authenticate, controller.getSiteById);
router.put('/:id', authenticate, controller.updateSite);
router.delete('/:id', authenticate, controller.deleteSite);

export default router;
