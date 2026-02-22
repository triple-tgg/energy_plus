import { Request, Response, NextFunction } from 'express';
import { BillingService, DemandService } from './billing.service';
import { AuthRequest } from '../../types';
import { successResponse, paginationHelper } from '../../utils/response';

const billingSvc = new BillingService();
const demandSvc = new DemandService();

export class BillingController {
    async getBillingConfigs(req: Request, res: Response, next: NextFunction) {
        try { const r = await billingSvc.getBillingConfigs(req.query); res.json(successResponse(r.data, undefined, paginationHelper(r.page, r.limit, r.total))); } catch (e) { next(e); }
    }
    async createBillingConfig(req: AuthRequest, res: Response, next: NextFunction) {
        try { res.status(201).json(successResponse(await billingSvc.createBillingConfig({ ...req.body, createdBy: req.user?.userName }), 'Created')); } catch (e) { next(e); }
    }
    async updateBillingConfig(req: AuthRequest, res: Response, next: NextFunction) {
        try { res.json(successResponse(await billingSvc.updateBillingConfig(parseInt(req.params.id), { ...req.body, modifiedBy: req.user?.userName }), 'Updated')); } catch (e) { next(e); }
    }
    async deleteBillingConfig(req: Request, res: Response, next: NextFunction) {
        try { await billingSvc.deleteBillingConfig(parseInt(req.params.id)); res.json(successResponse(null, 'Deleted')); } catch (e) { next(e); }
    }

    async getDemandConfigs(req: Request, res: Response, next: NextFunction) {
        try { const r = await demandSvc.getDemandConfigs(req.query); res.json(successResponse(r.data, undefined, paginationHelper(r.page, r.limit, r.total))); } catch (e) { next(e); }
    }
    async createDemandConfig(req: AuthRequest, res: Response, next: NextFunction) {
        try { res.status(201).json(successResponse(await demandSvc.createDemandConfig({ ...req.body, createdBy: req.user?.userName }), 'Created')); } catch (e) { next(e); }
    }
    async updateDemandConfig(req: AuthRequest, res: Response, next: NextFunction) {
        try { res.json(successResponse(await demandSvc.updateDemandConfig(parseInt(req.params.id), { ...req.body, modifiedBy: req.user?.userName }), 'Updated')); } catch (e) { next(e); }
    }
    async deleteDemandConfig(req: Request, res: Response, next: NextFunction) {
        try { await demandSvc.deleteDemandConfig(parseInt(req.params.id)); res.json(successResponse(null, 'Deleted')); } catch (e) { next(e); }
    }
}
