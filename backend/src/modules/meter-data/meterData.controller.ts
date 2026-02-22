import { Request, Response, NextFunction } from 'express';
import { MeterDataService } from './meterData.service';
import { successResponse, paginationHelper } from '../../utils/response';

const svc = new MeterDataService();

export class MeterDataController {
    async getRealtime(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await svc.getRealtimeData(req.query))); } catch (e) { next(e); }
    }
    async getHistory(req: Request, res: Response, next: NextFunction) {
        try {
            const r = await svc.getHistoryData(req.query);
            res.json(successResponse(r.data, undefined, paginationHelper(r.page, r.limit, r.total)));
        } catch (e) { next(e); }
    }
    async getDaily(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await svc.getDailyData(req.query))); } catch (e) { next(e); }
    }
    async getMonthly(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await svc.getMonthlyData(req.query))); } catch (e) { next(e); }
    }
}
