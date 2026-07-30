import { Request, Response, NextFunction } from 'express';
import { AlarmsService } from './alarms.service';
import { alertEngine } from './alert-engine.service';
import { AuthRequest } from '../../types';
import { successResponse, paginationHelper } from '../../utils/response';

const svc = new AlarmsService();

export class AlarmsController {
    async getAlarmConfigs(req: Request, res: Response, next: NextFunction) {
        try { const r = await svc.getAlarmConfigs(req.query); res.json(successResponse(r.data, undefined, paginationHelper(r.page, r.limit, r.total))); } catch (e) { next(e); }
    }
    async createAlarmConfig(req: AuthRequest, res: Response, next: NextFunction) {
        try { res.status(201).json(successResponse(await svc.createAlarmConfig({ ...req.body, createdBy: req.user?.userName }), 'Alarm config created')); } catch (e) { next(e); }
    }
    async updateAlarmConfig(req: AuthRequest, res: Response, next: NextFunction) {
        try { res.json(successResponse(await svc.updateAlarmConfig(parseInt(req.params.id), { ...req.body, modifiedBy: req.user?.userName }), 'Alarm config updated')); } catch (e) { next(e); }
    }
    async deleteAlarmConfig(req: Request, res: Response, next: NextFunction) {
        try { await svc.deleteAlarmConfig(parseInt(req.params.id)); res.json(successResponse(null, 'Alarm config deleted')); } catch (e) { next(e); }
    }

    async getAlarmGroups(req: Request, res: Response, next: NextFunction) {
        try { const r = await svc.getAlarmGroups(req.query); res.json(successResponse(r.data, undefined, paginationHelper(r.page, r.limit, r.total))); } catch (e) { next(e); }
    }
    async createAlarmGroup(req: Request, res: Response, next: NextFunction) {
        try { res.status(201).json(successResponse(await svc.createAlarmGroup(req.body), 'Alarm group created')); } catch (e) { next(e); }
    }
    async updateAlarmGroup(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await svc.updateAlarmGroup(parseInt(req.params.id), req.body), 'Alarm group updated')); } catch (e) { next(e); }
    }
    async deleteAlarmGroup(req: Request, res: Response, next: NextFunction) {
        try { await svc.deleteAlarmGroup(parseInt(req.params.id)); res.json(successResponse(null, 'Alarm group deleted')); } catch (e) { next(e); }
    }
    async testAlarmGroup(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await svc.sendTestMessage(parseInt(req.params.id)), 'Telegram test message sent')); } catch (e) { next(e); }
    }
    async detectTelegramChats(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await svc.detectTelegramChats(req.body?.token))); } catch (e) { next(e); }
    }
    async triggerCheck(req: Request, res: Response, next: NextFunction) {
        try { res.json(successResponse(await alertEngine.manualCheck(), 'Alert check completed')); } catch (e) { next(e); }
    }
    async getRecentAlerts(req: Request, res: Response, next: NextFunction) {
        try { const mins = parseInt(req.query.minutes as string) || 5; res.json(successResponse(await svc.getRecentAlerts(mins))); } catch (e) { next(e); }
    }
    async getRecentMeterData(req: Request, res: Response, next: NextFunction) {
        try {
            const meterId = parseInt(req.params.meterId);
            const mins = parseInt(req.query.minutes as string) || 15;
            res.json(successResponse(await svc.getRecentMeterData(meterId, mins)));
        } catch (e) { next(e); }
    }
}
