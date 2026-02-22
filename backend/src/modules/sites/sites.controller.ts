import { Request, Response, NextFunction } from 'express';
import { SitesService, BuildingsService, ZonesService } from './sites.service';
import { AuthRequest } from '../../types';
import { successResponse, paginationHelper } from '../../utils/response';

const sitesService = new SitesService();
const buildingsService = new BuildingsService();
const zonesService = new ZonesService();

export class SitesController {
    // Sites
    async getSites(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await sitesService.getSites(req.query);
            res.json(successResponse(result.data, undefined, paginationHelper(result.page, result.limit, result.total)));
        } catch (error) { next(error); }
    }
    async getSiteById(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await sitesService.getSiteById(parseInt(req.params.id)))); } catch (error) { next(error); }
    }
    async getSiteHierarchy(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await sitesService.getSiteHierarchy(parseInt(req.params.id)))); } catch (error) { next(error); }
    }
    async createSite(req: AuthRequest, res: Response, next: NextFunction) {
        try { res.status(201).json(successResponse(await sitesService.createSite(req.body), 'Site created')); } catch (error) { next(error); }
    }
    async updateSite(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await sitesService.updateSite(parseInt(req.params.id), req.body), 'Site updated')); } catch (error) { next(error); }
    }
    async deleteSite(req: Request, res: Response, next: NextFunction) {
        try { await sitesService.deleteSite(parseInt(req.params.id)); res.json(successResponse(null, 'Site deleted')); } catch (error) { next(error); }
    }

    // Buildings
    async getBuildings(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await buildingsService.getBuildings(req.query);
            res.json(successResponse(result.data, undefined, paginationHelper(result.page, result.limit, result.total)));
        } catch (error) { next(error); }
    }
    async getBuildingById(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await buildingsService.getBuildingById(parseInt(req.params.id)))); } catch (error) { next(error); }
    }
    async createBuilding(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const data = { ...req.body, createdBy: req.user?.userName };
            res.status(201).json(successResponse(await buildingsService.createBuilding(data), 'Building created'));
        } catch (error) { next(error); }
    }
    async updateBuilding(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const data = { ...req.body, modifiedBy: req.user?.userName };
            res.json(successResponse(await buildingsService.updateBuilding(parseInt(req.params.id), data), 'Building updated'));
        } catch (error) { next(error); }
    }
    async deleteBuilding(req: Request, res: Response, next: NextFunction) {
        try { await buildingsService.deleteBuilding(parseInt(req.params.id)); res.json(successResponse(null, 'Building deleted')); } catch (error) { next(error); }
    }

    // Zones
    async getZones(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await zonesService.getZones(req.query);
            res.json(successResponse(result.data, undefined, paginationHelper(result.page, result.limit, result.total)));
        } catch (error) { next(error); }
    }
    async getZoneById(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await zonesService.getZoneById(parseInt(req.params.id)))); } catch (error) { next(error); }
    }
    async createZone(req: Request, res: Response, next: NextFunction) {
        try { res.status(201).json(successResponse(await zonesService.createZone(req.body), 'Zone created')); } catch (error) { next(error); }
    }
    async updateZone(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await zonesService.updateZone(parseInt(req.params.id), req.body), 'Zone updated')); } catch (error) { next(error); }
    }
    async deleteZone(req: Request, res: Response, next: NextFunction) {
        try { await zonesService.deleteZone(parseInt(req.params.id)); res.json(successResponse(null, 'Zone deleted')); } catch (error) { next(error); }
    }
}
