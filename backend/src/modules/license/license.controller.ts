import { Request, Response, NextFunction } from 'express';
import { licenseService } from './license.service';
import { successResponse } from '../../utils/response';

export class LicenseController {
    /**
     * GET /api/v1/license/status
     * Returns current meter quota and license details
     */
    async getStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const isAdmin = (req as any).user?.role === 'admin';
            const status = await licenseService.getLicenseStatus(isAdmin);
            res.json(successResponse(status));
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/v1/license/verify
     * Verify a license key without activating it
     */
    async verify(req: Request, res: Response, next: NextFunction) {
        try {
            const { licenseKey } = req.body;
            const payload = licenseService.verifyLicenseToken(licenseKey);
            res.json(successResponse({
                isValid: true,
                payload
            }, 'License Key ถูกต้องสมบูรณ์'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/v1/license/activate
     * Activate a new signed license key
     */
    async activate(req: Request, res: Response, next: NextFunction) {
        try {
            const { licenseKey } = req.body;
            const userId = (req as any).user?.userId;
            const newStatus = await licenseService.activateLicense(licenseKey, userId);
            res.json(successResponse(newStatus, 'เปิดใช้งาน License Key ใหม่สำเร็จเรียบร้อยแล้ว'));
        } catch (error) {
            next(error);
        }
    }
}

export const licenseController = new LicenseController();
