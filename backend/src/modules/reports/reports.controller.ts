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
            res.json(successResponse(await svc.acknowledgeAlarm(parseInt(req.params.id), req.user?.userName, req.query.siteId || req.body?.siteId), 'Alarm acknowledged'));
        } catch (e) { next(e); }
    }

    async clearAlarms(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const result = await svc.clearAlarms({ ...req.query, ...req.body, siteId: req.body?.siteId || req.query.siteId });
            res.json(successResponse(result, `Cleared ${result.deletedCount} alarm records`));
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

    async getEnergyMonthlyReport(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await svc.getEnergyMonthlyReport(req.query);
            res.json(successResponse(result.data, undefined, paginationHelper(result.page, result.limit, result.total)));
        } catch (e) { next(e); }
    }

    async getTouMonthlyReport(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await svc.getTouMonthlyReport(req.query);
            res.json(successResponse(result.data, undefined, paginationHelper(result.page, result.limit, result.total)));
        } catch (e) { next(e); }
    }

    /**
     * ดึงข้อมูลมิเตอร์ไฟฟ้า-น้ำ ตามรูปแบบมาตรฐาน (CSV / JSON)
     */
    getMeterReadingsReport = async (req: Request, res: Response, next: NextFunction) => {
        return this.getChodReport(req, res, next);
    };

    /**
     * ดาวน์โหลดไฟล์ CSV รูปแบบมาตรฐานโดยตรง
     */
    getMeterReadingsReportCsv = async (req: Request, res: Response, next: NextFunction) => {
        return this.getChodReportCsv(req, res, next);
    };

    /**
     * ดึงข้อมูลมิเตอร์ไฟฟ้า-น้ำ ตามรูปแบบมาตรฐาน (ตามตัวอย่างใน PDF)
     * รองรับ ?format=csv (ดาวน์โหลดไฟล์) และ ?format=json
     */
    async getChodReport(req: Request, res: Response, next: NextFunction) {
        try {
            const requestedFormat = String(req.query.format || (req.headers.accept?.includes('text/csv') ? 'csv' : 'csv')).toLowerCase();
            const result = await svc.getChodReport(req.query);

            if (requestedFormat === 'csv') {
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
                return res.send('\uFEFF' + result.csv);
            }

            res.json(successResponse(result.data, undefined, paginationHelper(result.page, result.limit, result.total)));
        } catch (e) { next(e); }
    }

    /**
     * ดาวน์โหลดไฟล์ CSV รูปแบบมาตรฐานโดยตรง
     */
    async getChodReportCsv(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await svc.getChodReport({ ...req.query, format: 'csv' });
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
            res.send('\uFEFF' + result.csv);
        } catch (e) { next(e); }
    }

    /**
     * ดาวน์โหลดรายงานเป็นไฟล์ CSV ทั่วไป
     */
    async exportReportCsv(req: Request, res: Response, next: NextFunction) {
        try {
            const reportType = req.params.reportType;
            const result = await svc.exportReportCsv(reportType, req.query);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
            res.send('\uFEFF' + result.csv);
        } catch (e) { next(e); }
    }

    /**
     * ดาวน์โหลดรายงานเป็นไฟล์ Excel (.xlsx)
     */
    async exportReportExcel(req: Request, res: Response, next: NextFunction) {
        try {
            const reportType = req.params.reportType;
            const result = await svc.exportReportExcel(reportType, req.query);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
            res.send(result.buffer);
        } catch (e) { next(e); }
    }
}

