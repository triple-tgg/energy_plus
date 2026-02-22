import { Request, Response, NextFunction } from 'express';
import { CompanyService } from './company.service';
import { successResponse } from '../../utils/response';

const svc = new CompanyService();

export class CompanyController {
    async getCompany(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await svc.getCompanyInfo())); } catch (e) { next(e); }
    }
    async updateCompany(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await svc.updateCompanyInfo(req.body), 'Company updated')); } catch (e) { next(e); }
    }
}
