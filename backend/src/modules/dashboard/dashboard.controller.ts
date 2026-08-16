import { Request, Response, NextFunction } from 'express';
import { DashboardService } from './dashboard.service';
import { paginationHelper, successResponse } from '../../utils/response';

const svc = new DashboardService();

export class DashboardController {
    async getZoneDashboard(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await svc.getZoneDashboardData(req.query))); } catch (e) { next(e); }
    }
    async getZoneConsumption(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await svc.getZoneConsumption(req.query))); } catch (e) { next(e); }
    }
    async getMdbConsumption(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await svc.getMdbConsumption(req.query))); } catch (e) { next(e); }
    }
    async getDemandData(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await svc.getDemandData(req.query))); } catch (e) { next(e); }
    }
    async getDemandMonthly(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await svc.getDemandMonthly(req.query))); } catch (e) { next(e); }
    }
    async getConsumptionTable(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await svc.getConsumptionTable(req.query);
            res.json(successResponse(
                result.data,
                undefined,
                paginationHelper(result.page, result.limit, result.total)
            ));
        } catch (e) { next(e); }
    }
    async getConsumptionMeters(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await svc.getConsumptionMeters(req.query))); } catch (e) { next(e); }
    }
}
