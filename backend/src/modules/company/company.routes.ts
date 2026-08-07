import { Router } from 'express';
import { CompanyController } from './company.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/accessControl';

const router = Router();
const c = new CompanyController();

router.get('/', authenticate, c.getCompany);
router.put('/', authenticate, requireRole('admin'), c.updateCompany);

export default router;
