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
                image_name = req.file.originalname;
                const protocol = req.protocol;
                const host = req.get('host');
                image_url = `${protocol}://${host}/uploads/layouts/${req.file.filename}`;
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
                image_name = req.file.originalname;
                const protocol = req.protocol;
                const host = req.get('host');
                image_url = `${protocol}://${host}/uploads/layouts/${req.file.filename}`;
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

    // Dummy Stubs for positions and live endpoints to prevent frontend breakage
    async getPositions(req: Request, res: Response, next: NextFunction) {
        try {
            res.json(successResponse([]));
        } catch (e) {
            next(e);
        }
    }

    async updatePositions(req: Request, res: Response, next: NextFunction) {
        try {
            res.json(successResponse(null, 'Positions updated successfully'));
        } catch (e) {
            next(e);
        }
    }

    async getLiveData(req: Request, res: Response, next: NextFunction) {
        try {
            res.json(successResponse([]));
        } catch (e) {
            next(e);
        }
    }
}
