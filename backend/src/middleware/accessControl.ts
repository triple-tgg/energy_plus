import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { errorResponse } from '../utils/response';
import { query } from '../config/database';

export const requireRole = (...roles: Array<'viewer' | 'operator' | 'admin'>) =>
    (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json(errorResponse('FORBIDDEN', 'You do not have permission to perform this action'));
        }
        next();
    };

export const enforceSiteAccess = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json(errorResponse('UNAUTHORIZED', 'Authentication required'));
    if (req.user.siteAccessMode === 'all') return next();

    const allowed = req.user.siteIds || [];
    if (allowed.length === 0) {
        return res.status(403).json(errorResponse('SITE_ACCESS_DENIED', 'No site has been assigned to this account'));
    }

    const requestedRaw = req.query.siteId ?? req.body?.siteId;
    const hasRequest = !(requestedRaw == null || requestedRaw === '' || requestedRaw === 'all');

    if (hasRequest) {
        // Accept a single id or a comma-separated list; every id must be assigned to the user
        const parts = String(requestedRaw).split(',').map((p) => p.trim()).filter(Boolean);
        const requested = parts.map(Number);
        if (!requested.length || requested.some((id) => !Number.isInteger(id) || !allowed.includes(id))) {
            return res.status(403).json(errorResponse('SITE_ACCESS_DENIED', 'You do not have access to this site'));
        }
        return next();
    }

    // No site selected ("all sites"): scope the request to the user's assigned sites only.
    // Services parse this with parseSiteIds() and filter with `site_id = ANY(...)`.
    req.query.siteId = allowed.join(',');
    next();
};

export const enforceMeterSiteAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json(errorResponse('UNAUTHORIZED', 'Authentication required'));
    if (req.user.siteAccessMode === 'all') return next();
    const meterId = Number(req.params.id || req.body?.meterId);
    if (!Number.isInteger(meterId)) return res.status(400).json(errorResponse('INVALID_METER', 'Invalid meter'));
    const result = await query(`SELECT site_id FROM meter WHERE meter_id=$1`, [meterId]);
    if (!result.rows.length || !req.user.siteIds.includes(result.rows[0].site_id)) {
        return res.status(403).json(errorResponse('SITE_ACCESS_DENIED', 'You do not have access to this meter'));
    }
    next();
};
