import { Router } from 'express';
import { SitesController } from './sites.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/accessControl';

const router = Router();
const controller = new SitesController();

// === Static routes MUST come before parameterized /:id routes ===

// Buildings (static prefix)
router.get('/buildings/list', authenticate, controller.getBuildings);
router.get('/buildings/:id', authenticate, controller.getBuildingById);
router.post('/buildings', authenticate, requireRole('admin'), controller.createBuilding);
router.put('/buildings/:id', authenticate, requireRole('admin'), controller.updateBuilding);
router.delete('/buildings/:id', authenticate, requireRole('admin'), controller.deleteBuilding);

// Zones (static prefix)
router.get('/zones/list', authenticate, controller.getZones);
router.get('/zones/:id', authenticate, controller.getZoneById);
router.post('/zones', authenticate, requireRole('admin'), controller.createZone);
router.put('/zones/:id', authenticate, requireRole('admin'), controller.updateZone);
router.delete('/zones/:id', authenticate, requireRole('admin'), controller.deleteZone);

// Sites (root-level + parameterized)
router.get('/', authenticate, controller.getSites);
router.post('/', authenticate, requireRole('admin'), controller.createSite);
router.get('/:id/hierarchy', authenticate, controller.getSiteHierarchy);
router.get('/:id/buildings', authenticate, controller.getBuildings);
router.get('/:id/users', authenticate, requireRole('admin'), controller.getSiteUsers);
router.put('/:id/users', authenticate, requireRole('admin'), controller.updateSiteUsers);
router.get('/:id', authenticate, controller.getSiteById);
router.put('/:id', authenticate, requireRole('admin'), controller.updateSite);
router.delete('/:id', authenticate, requireRole('admin'), controller.deleteSite);

export default router;
