import { Router } from 'express';
import { exportsController } from './exports.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.get('/', authenticate, exportsController.getExports);
router.get('/:id', authenticate, exportsController.getExportById);
router.post('/', authenticate, exportsController.createExport);
router.put('/:id', authenticate, exportsController.updateExport);
router.delete('/:id', authenticate, exportsController.deleteExport);

export default router;
