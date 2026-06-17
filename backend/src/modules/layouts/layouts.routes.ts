import { Router } from 'express';
import { LayoutsController } from './layouts.controller';
import { authenticate } from '../../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
const c = new LayoutsController();

// Ensure public upload target directory exists
const uploadDir = path.join(__dirname, '../../../public/uploads/layouts');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up storage logic
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// Configure upload middleware
const upload = multer({
    storage,
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

// Layouts API Routes
router.get('/', authenticate, c.getLayouts);
router.get('/:id', authenticate, c.getLayoutById);
router.post('/', authenticate, upload.single('image'), c.createLayout);
router.put('/:id', authenticate, upload.single('image'), c.updateLayout);
router.delete('/:id', authenticate, c.deleteLayout);

// Positions and Live stubs
router.get('/:id/positions', authenticate, c.getPositions);
router.put('/:id/positions', authenticate, c.updatePositions);
router.get('/:id/live', authenticate, c.getLiveData);

export default router;
