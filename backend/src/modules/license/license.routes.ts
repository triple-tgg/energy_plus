import { Router } from 'express';
import { licenseController } from './license.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/accessControl';

const router = Router();

// Get license status (any authenticated user can check meter quota)
router.get('/status', authenticate, licenseController.getStatus);

// Verify license key (admin only)
router.post('/verify', authenticate, requireRole('admin'), licenseController.verify);

// Activate new license key (admin only)
router.post('/activate', authenticate, requireRole('admin'), licenseController.activate);

export default router;
