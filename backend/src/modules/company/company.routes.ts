import { Router } from 'express';
import { CompanyController } from './company.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const c = new CompanyController();

router.get('/', authenticate, c.getCompany);
router.put('/', authenticate, c.updateCompany);

export default router;
