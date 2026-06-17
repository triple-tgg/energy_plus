import { Router } from 'express';
import { LayoutsController } from './layouts.controller';
import { authenticate } from '../../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
const c = new LayoutsController();

// Configure upload middleware with memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp|gif/;
        const mimeTypeAllowed = allowedTypes.test(file.mimetype);
        const extNameAllowed = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (mimeTypeAllowed && extNameAllowed) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed'));
    }
});

// Layouts CRUD
router.get('/', authenticate, c.getLayouts);
router.get('/:id', authenticate, c.getLayoutById);
router.post('/', authenticate, upload.single('image'), c.createLayout);
router.put('/:id', authenticate, upload.single('image'), c.updateLayout);
router.delete('/:id', authenticate, c.deleteLayout);

// Layout Points
router.get('/:id/points', authenticate, c.getPoints);
router.put('/:id/points', authenticate, c.savePoints);        // batch save
router.post('/:id/points', authenticate, c.addPoint);         // add single
router.put('/:id/points/:pointId', authenticate, c.updatePoint);
router.delete('/:id/points/:pointId', authenticate, c.deletePoint);

export default router;
