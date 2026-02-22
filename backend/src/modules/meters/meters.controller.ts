import { Request, Response, NextFunction } from 'express';
import { MetersService } from './meters.service';
import { AuthRequest } from '../../types';
import { successResponse, paginationHelper } from '../../utils/response';

const svc = new MetersService();

export class MetersController {
    // Meters
    async getMeters(req: Request, res: Response, next: NextFunction) {
        try { const r = await svc.getMeters(req.query); res.json(successResponse(r.data, undefined, paginationHelper(r.page, r.limit, r.total))); } catch (e) { next(e); }
    }
    async getMeterById(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await svc.getMeterById(parseInt(req.params.id)))); } catch (e) { next(e); }
    }
    async createMeter(req: AuthRequest, res: Response, next: NextFunction) {
        try { res.status(201).json(successResponse(await svc.createMeter({ ...req.body, createdBy: req.user?.userName }), 'Meter created')); } catch (e) { next(e); }
    }
    async updateMeter(req: AuthRequest, res: Response, next: NextFunction) {
        try { res.json(successResponse(await svc.updateMeter(parseInt(req.params.id), { ...req.body, modifiedBy: req.user?.userName }), 'Meter updated')); } catch (e) { next(e); }
    }
    async deleteMeter(req: Request, res: Response, next: NextFunction) {
        try { await svc.deleteMeter(parseInt(req.params.id)); res.json(successResponse(null, 'Meter deleted')); } catch (e) { next(e); }
    }

    // Brands
    async getBrands(req: Request, res: Response, next: NextFunction) {
        try { const r = await svc.getBrands(req.query); res.json(successResponse(r.data, undefined, paginationHelper(r.page, r.limit, r.total))); } catch (e) { next(e); }
    }
    async createBrand(req: AuthRequest, res: Response, next: NextFunction) {
        try { res.status(201).json(successResponse(await svc.createBrand({ ...req.body, createdBy: req.user?.userName }), 'Brand created')); } catch (e) { next(e); }
    }
    async updateBrand(req: AuthRequest, res: Response, next: NextFunction) {
        try { res.json(successResponse(await svc.updateBrand(parseInt(req.params.id), { ...req.body, modifiedBy: req.user?.userName }), 'Brand updated')); } catch (e) { next(e); }
    }
    async deleteBrand(req: Request, res: Response, next: NextFunction) {
        try { await svc.deleteBrand(parseInt(req.params.id)); res.json(successResponse(null, 'Brand deleted')); } catch (e) { next(e); }
    }

    // Types
    async getTypes(req: Request, res: Response, next: NextFunction) {
        try { const r = await svc.getTypes(req.query); res.json(successResponse(r.data, undefined, paginationHelper(r.page, r.limit, r.total))); } catch (e) { next(e); }
    }
    async createType(req: AuthRequest, res: Response, next: NextFunction) {
        try { res.status(201).json(successResponse(await svc.createType({ ...req.body, createdBy: req.user?.userName }), 'Type created')); } catch (e) { next(e); }
    }
    async updateType(req: AuthRequest, res: Response, next: NextFunction) {
        try { res.json(successResponse(await svc.updateType(parseInt(req.params.id), { ...req.body, modifiedBy: req.user?.userName }), 'Type updated')); } catch (e) { next(e); }
    }
    async deleteType(req: Request, res: Response, next: NextFunction) {
        try { await svc.deleteType(parseInt(req.params.id)); res.json(successResponse(null, 'Type deleted')); } catch (e) { next(e); }
    }

    // Loops
    async getLoops(req: Request, res: Response, next: NextFunction) {
        try { const r = await svc.getLoops(req.query); res.json(successResponse(r.data, undefined, paginationHelper(r.page, r.limit, r.total))); } catch (e) { next(e); }
    }
    async createLoop(req: Request, res: Response, next: NextFunction) {
        try { res.status(201).json(successResponse(await svc.createLoop(req.body), 'Loop created')); } catch (e) { next(e); }
    }
    async updateLoop(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await svc.updateLoop(parseInt(req.params.id), req.body), 'Loop updated')); } catch (e) { next(e); }
    }
    async deleteLoop(req: Request, res: Response, next: NextFunction) {
        try { await svc.deleteLoop(parseInt(req.params.id)); res.json(successResponse(null, 'Loop deleted')); } catch (e) { next(e); }
    }

    // Energy Values
    async getEnergyValues(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await svc.getEnergyValues())); } catch (e) { next(e); }
    }
}
