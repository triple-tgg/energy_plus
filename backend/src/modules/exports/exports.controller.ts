import { Request, Response, NextFunction } from 'express';
import { exportsService } from './exports.service';
import { successResponse, paginationHelper } from '../../utils/response';

export class ExportsController {
    async getExports(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await exportsService.getExports(req.query);
            res.json(successResponse(
                result.data,
                undefined,
                paginationHelper(result.page, result.limit, result.total)
            ));
        } catch (error) { next(error); }
    }

    async getExportById(req: Request, res: Response, next: NextFunction) {
        try {
            const data = await exportsService.getExportById(parseInt(req.params.id, 10));
            res.json(successResponse(data));
        } catch (error) { next(error); }
    }

    async createExport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = await exportsService.createExport(req.body);
            res.status(201).json(successResponse(data, 'Export config created successfully'));
        } catch (error) { next(error); }
    }

    async updateExport(req: Request, res: Response, next: NextFunction) {
        try {
            const data = await exportsService.updateExport(parseInt(req.params.id, 10), req.body);
            res.json(successResponse(data, 'Export config updated successfully'));
        } catch (error) { next(error); }
    }

    async deleteExport(req: Request, res: Response, next: NextFunction) {
        try {
            await exportsService.deleteExport(parseInt(req.params.id, 10));
            res.json(successResponse(null, 'Export config deleted successfully'));
        } catch (error) { next(error); }
    }
}

export const exportsController = new ExportsController();
