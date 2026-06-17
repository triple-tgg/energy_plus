import { Request, Response, NextFunction } from 'express';
import { LayoutsService } from './layouts.service';
import { successResponse, paginationHelper } from '../../utils/response';

const svc = new LayoutsService();

export class LayoutsController {
    async getLayouts(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await svc.getLayouts(req.query);
            res.json(successResponse(result.data, undefined, paginationHelper(result.page, result.limit, result.total)));
        } catch (e) {
            next(e);
        }
    }

    async getLayoutById(req: Request, res: Response, next: NextFunction) {
        try {
            const id = parseInt(req.params.id, 10);
            res.json(successResponse(await svc.getLayoutById(id)));
        } catch (e) {
            next(e);
        }
    }

    async createLayout(req: Request, res: Response, next: NextFunction) {
        try {
            const { name, position } = req.body;
            let image_name = undefined;
            let image_url = undefined;

            if (req.file) {
                // Fix Thai filename encoding from multer (latin1 -> utf8)
                image_name = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
                image_url = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
            }

            const newLayout = await svc.createLayout({
                name,
                position,
                image_name,
                image_url
            });

            res.status(201).json(successResponse(newLayout, 'Layout created successfully'));
        } catch (e) {
            next(e);
        }
    }

    async updateLayout(req: Request, res: Response, next: NextFunction) {
        try {
            const id = parseInt(req.params.id, 10);
            const { name, position } = req.body;
            let image_name = undefined;
            let image_url = undefined;

            if (req.file) {
                // Fix Thai filename encoding from multer (latin1 -> utf8)
                image_name = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
                image_url = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
            }

            const updatedLayout = await svc.updateLayout(id, {
                name,
                position,
                image_name,
                image_url
            });

            res.json(successResponse(updatedLayout, 'Layout updated successfully'));
        } catch (e) {
            next(e);
        }
    }

    async deleteLayout(req: Request, res: Response, next: NextFunction) {
        try {
            const id = parseInt(req.params.id, 10);
            await svc.deleteLayout(id);
            res.json(successResponse(null, 'Layout deleted successfully'));
        } catch (e) {
            next(e);
        }
    }

    // ═══════════════════════════════════════════════════════
    // Layout Points
    // ═══════════════════════════════════════════════════════

    async getPoints(req: Request, res: Response, next: NextFunction) {
        try {
            const layoutId = parseInt(req.params.id, 10);
            const points = await svc.getPoints(layoutId);
            res.json(successResponse(points));
        } catch (e) {
            next(e);
        }
    }

    async savePoints(req: Request, res: Response, next: NextFunction) {
        try {
            const layoutId = parseInt(req.params.id, 10);
            const { points } = req.body;
            if (!Array.isArray(points)) {
                return res.status(400).json({ success: false, error: { message: 'points must be an array' } });
            }
            const saved = await svc.savePoints(layoutId, points);
            res.json(successResponse(saved, 'Points saved successfully'));
        } catch (e) {
            next(e);
        }
    }

    async addPoint(req: Request, res: Response, next: NextFunction) {
        try {
            const layoutId = parseInt(req.params.id, 10);
            const point = await svc.addPoint(layoutId, req.body);
            res.status(201).json(successResponse(point, 'Point added successfully'));
        } catch (e) {
            next(e);
        }
    }

    async updatePoint(req: Request, res: Response, next: NextFunction) {
        try {
            const pointId = parseInt(req.params.pointId, 10);
            const point = await svc.updatePoint(pointId, req.body);
            res.json(successResponse(point, 'Point updated successfully'));
        } catch (e) {
            next(e);
        }
    }

    async deletePoint(req: Request, res: Response, next: NextFunction) {
        try {
            const pointId = parseInt(req.params.pointId, 10);
            await svc.deletePoint(pointId);
            res.json(successResponse(null, 'Point deleted successfully'));
        } catch (e) {
            next(e);
        }
    }
}
