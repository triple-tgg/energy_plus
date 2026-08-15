import { Response } from 'express';
import { AuthRequest } from '../../types';
import { DataCleanupService } from './dataCleanup.service';
import { successResponse, errorResponse } from '../../utils/response';

const service = new DataCleanupService();

export class DataCleanupController {
    async getRealtimeStats(req: AuthRequest, res: Response) {
        try {
            const stats = await service.getRealtimeStats();
            res.json(successResponse(stats));
        } catch (err: any) {
            res.status(500).json(errorResponse('INTERNAL_ERROR', err.message));
        }
    }

    async purgeRealtimeData(req: AuthRequest, res: Response) {
        try {
            const retentionHours = parseInt(req.body.retentionHours, 10);
            if (!retentionHours || retentionHours < 1) {
                return res.status(400).json(errorResponse('INVALID_INPUT', 'retentionHours must be at least 1'));
            }
            const result = await service.purgeRealtimeData(retentionHours);
            res.json(successResponse(result));
        } catch (err: any) {
            res.status(500).json(errorResponse('INTERNAL_ERROR', err.message));
        }
    }
}
