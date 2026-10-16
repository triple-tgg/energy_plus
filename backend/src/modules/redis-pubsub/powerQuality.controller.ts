import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../../utils/response';
import { parseSiteIds } from '../../utils/siteFilter';
import pool from '../../config/database';
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

const checkSourceAccess = async (source: SourceKey, req: Request): Promise<boolean> => {
    const user = (req as any).user;
    if (!user) return false;

    // Site 26 (วรรณวนัช เบเกอรี่) has no right to harmonic data
    const requestedSite = parseInt(String(req.query.filterSiteId ?? ''), 10);
    if (requestedSite === 26) return false;

    // Find the meter associated with this source (siteId, addressId)
    const meterRes = await pool.query(
        `SELECT m.meter_id, m.site_id
         FROM meter m
         LEFT JOIN realtime_meter_map rmm ON rmm.meter_id = m.meter_id AND rmm.is_active = true
         WHERE m.is_active IS DISTINCT FROM false
           AND (
                 (rmm.realtime_site_id = $1 AND rmm.realtime_address_id = $2)
              OR TRIM(m.site_el::text) = $1::text || '_' || $2::text
              OR (TRIM(m.site_el::text) = $1::text AND TRIM(m.address::text) = $2::text)
           )
         ORDER BY (rmm.id IS NOT NULL) DESC, m.meter_id
         LIMIT 1`,
        [source.siteId, source.addressId]
    );

    const meterSiteId = meterRes.rows[0]?.site_id;
    // Site 26 (วรรณวนัช เบเกอรี่) has no right to harmonic data
    if (meterSiteId === 26) return false;

    // If user has restricted site access
    if (user.siteAccessMode !== 'all') {
        const allowed = user.siteIds || [];
        if (!meterSiteId || !allowed.includes(meterSiteId) || (allowed.length === 1 && allowed[0] === 26)) {
            return false;
        }
    }
    return true;
};

/** GET /redis/power-quality/sources?days=7 */
export const powerQualitySources = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        const siteIds = parseSiteIds(req.query.filterSiteId || req.query.siteId);

        // If site 26 is requested or user only has site 26
        if ((siteIds && siteIds.length === 1 && siteIds[0] === 26) ||
            (user && user.siteAccessMode !== 'all' && user.siteIds?.length === 1 && user.siteIds[0] === 26)) {
            res.json(successResponse([]));
            return;
        }

        // If user is restricted to certain sites, merge with requested siteIds
        let effectiveSiteIds = siteIds;
        if (user && user.siteAccessMode !== 'all') {
            const userAllowed = user.siteIds || [];
            if (userAllowed.length === 0) {
                res.json(successResponse([]));
                return;
            }
            effectiveSiteIds = siteIds ? siteIds.filter((id: number) => userAllowed.includes(id)) : userAllowed;
            if (effectiveSiteIds.length === 0) {
                res.json(successResponse([]));
                return;
            }
        }

        res.json(successResponse(await getPowerQualitySources(clampInt(req.query.days, 7, 1, 90), effectiveSiteIds)));
    } catch (error: any) {
        console.error('Power quality sources error:', error);
        res.status(500).json(errorResponse('POWER_QUALITY_ERROR', error.message));
    }
};

/** GET /redis/power-quality/latest?siteId=&addressId= */
export const powerQualityLatest = async (req: Request, res: Response): Promise<void> => {
    const source = sourceFromQuery(req, res);
    if (!source) return;

    const allowed = await checkSourceAccess(source, req);
    if (!allowed) {
        res.status(403).json(errorResponse('SITE_ACCESS_DENIED', 'ไม่มีสิทธิเข้าถึงข้อมูลมิเตอร์ฮาร์มอนิก'));
        return;
    }

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

    const allowed = await checkSourceAccess(source, req);
    if (!allowed) {
        res.status(403).json(errorResponse('SITE_ACCESS_DENIED', 'ไม่มีสิทธิเข้าถึงข้อมูลมิเตอร์ฮาร์มอนิก'));
        return;
    }

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

    const allowed = await checkSourceAccess(source, req);
    if (!allowed) {
        res.status(403).json(errorResponse('SITE_ACCESS_DENIED', 'ไม่มีสิทธิเข้าถึงข้อมูลมิเตอร์ฮาร์มอนิก'));
        return;
    }

    try {
        res.json(successResponse(await getThdHistory(source, clampInt(req.query.hours, 24, 1, 24 * 31))));
    } catch (error: any) {
        console.error('THD history error:', error);
        res.status(500).json(errorResponse('POWER_QUALITY_ERROR', error.message));
    }
};
