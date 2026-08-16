import { Request, Response, NextFunction } from 'express';
import { ReportsService } from './reports.service';
import { paginationHelper, successResponse } from '../../utils/response';
import { AuthRequest } from '../../types';

const svc = new ReportsService();

export class ReportsController {
    async getAlarms(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await svc.getAlarms(req.query);
            res.json(successResponse(result.data, undefined, paginationHelper(result.page, result.limit, result.total)));
        } catch (e) { next(e); }
    }

    async acknowledgeAlarm(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const siteId = req.query.siteId ? parseInt(String(req.query.siteId)) : undefined;
            res.json(successResponse(await svc.acknowledgeAlarm(parseInt(req.params.id), req.user?.userName, siteId), 'Alarm acknowledged'));
        } catch (e) { next(e); }
    }

    async getComparison(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await svc.getComparison(req.query);
            res.json(successResponse(result.data, undefined, paginationHelper(result.page, result.limit, result.total)));
        } catch (e) { next(e); }
    }

    async getHistory(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await svc.getHistory(req.query);
            res.json(successResponse(result.data, undefined, paginationHelper(result.page, result.limit, result.total)));
        } catch (e) { next(e); }
    }

    async getEnergyConsumption(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await svc.getEnergyConsumption(req.query);
            res.json(successResponse(result.data, undefined, paginationHelper(result.page, result.limit, result.total)));
        } catch (e) { next(e); }
    }

    async getTouReport(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await svc.getTouReport(req.query);
            res.json(successResponse(result.data, undefined, paginationHelper(result.page, result.limit, result.total)));
        } catch (e) { next(e); }
    }
}
