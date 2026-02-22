import { Request, Response, NextFunction } from 'express';
import { DashboardService } from './dashboard.service';
import { successResponse } from '../../utils/response';

const svc = new DashboardService();

export class DashboardController {
    async getZoneConsumption(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await svc.getZoneConsumption(req.query))); } catch (e) { next(e); }
    }
    async getMdbConsumption(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await svc.getMdbConsumption(req.query))); } catch (e) { next(e); }
    }
    async getDemandData(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await svc.getDemandData(req.query))); } catch (e) { next(e); }
    }
    async getConsumptionTable(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await svc.getConsumptionTable(req.query))); } catch (e) { next(e); }
    }
}
