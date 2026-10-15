import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../../utils/response';
import {
    getHarmonicsHistory,
    getPowerQualityLatest,
    getPowerQualitySources,
    getThdHistory,
    SourceKey,
} from './powerQuality.service';

const clampInt = (value: unknown, def: number, min: number, max: number): number => {
    const n = parseInt(String(value ?? ''), 10);
    return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : def;
};

const sourceFromQuery = (req: Request, res: Response): SourceKey | null => {
    const siteId = parseInt(String(req.query.siteId ?? ''), 10);
    const addressId = parseInt(String(req.query.addressId ?? ''), 10);
    if (!Number.isFinite(siteId) || !Number.isFinite(addressId)) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'siteId and addressId are required'));
        return null;
    }
    return { siteId, addressId };
};

/** GET /redis/power-quality/sources?days=7 */
export const powerQualitySources = async (req: Request, res: Response): Promise<void> => {
    try {
        res.json(successResponse(await getPowerQualitySources(clampInt(req.query.days, 7, 1, 90))));
    } catch (error: any) {
        console.error('Power quality sources error:', error);
        res.status(500).json(errorResponse('POWER_QUALITY_ERROR', error.message));
    }
};

/** GET /redis/power-quality/latest?siteId=&addressId= */
export const powerQualityLatest = async (req: Request, res: Response): Promise<void> => {
    const source = sourceFromQuery(req, res);
    if (!source) return;
    try {
        res.json(successResponse(await getPowerQualityLatest(source)));
    } catch (error: any) {
        console.error('Power quality latest error:', error);
        res.status(500).json(errorResponse('POWER_QUALITY_ERROR', error.message));
    }
};

/** GET /redis/power-quality/harmonics-history?siteId=&addressId=&datatype=HD33-VL&hours=24 */
export const harmonicsHistory = async (req: Request, res: Response): Promise<void> => {
    const source = sourceFromQuery(req, res);
    if (!source) return;
    const datatype = String(req.query.datatype || 'HD33-VL').toUpperCase();
    try {
        res.json(successResponse(await getHarmonicsHistory(source, datatype, clampInt(req.query.hours, 24, 1, 24 * 31))));
    } catch (error: any) {
        const status = /datatype must be/.test(error.message) ? 400 : 500;
        res.status(status).json(errorResponse(status === 400 ? 'VALIDATION_ERROR' : 'POWER_QUALITY_ERROR', error.message));
    }
};

/** GET /redis/power-quality/thd-history?siteId=&addressId=&hours=24 */
export const thdHistory = async (req: Request, res: Response): Promise<void> => {
    const source = sourceFromQuery(req, res);
    if (!source) return;
    try {
        res.json(successResponse(await getThdHistory(source, clampInt(req.query.hours, 24, 1, 24 * 31))));
    } catch (error: any) {
        console.error('THD history error:', error);
        res.status(500).json(errorResponse('POWER_QUALITY_ERROR', error.message));
    }
};
