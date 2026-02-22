import { query } from '../../config/database';
import { parsePagination } from '../../utils/pagination';
import { AppError } from '../../middleware/errorHandler';

export class SitesService {
    async getSites(queryParams: any) {
        const { page, limit, offset } = parsePagination(queryParams);
        const countResult = await query(`SELECT COUNT(*) FROM sites`);
        const total = parseInt(countResult.rows[0].count);
        const result = await query(`SELECT * FROM sites ORDER BY site_id LIMIT $1 OFFSET $2`, [limit, offset]);
        return { data: result.rows, total, page, limit };
    }

    async getSiteById(siteId: number) {
        const result = await query(`SELECT * FROM sites WHERE site_id = $1`, [siteId]);
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Site not found');
        return result.rows[0];
    }

    async getSiteHierarchy(siteId: number) {
        const site = await this.getSiteById(siteId);
        const buildings = await query(
            `SELECT * FROM buildings WHERE site_id = $1 ORDER BY building_id`, [siteId]
        );
        const zones = await query(
            `SELECT z.*, b.building_id FROM zones z
       JOIN buildings b ON z.building_id = b.building_id
       WHERE b.site_id = $1 ORDER BY z.zone_id`, [siteId]
        );
        const meters = await query(
            `SELECT m.meter_id, m.meter_code, m.meter_name, m.zone_id FROM meter m
       WHERE m.site_id = $1 ORDER BY m.meter_id`, [siteId]
        );

        const buildingsWithZones = buildings.rows.map((b: any) => ({
            ...b,
            zones: zones.rows
                .filter((z: any) => z.building_id === b.building_id)
                .map((z: any) => ({
                    ...z,
                    meters: meters.rows.filter((m: any) => m.zone_id === z.zone_id),
                    meterCount: meters.rows.filter((m: any) => m.zone_id === z.zone_id).length,
                })),
        }));

        return { ...site, buildings: buildingsWithZones };
    }

    async createSite(data: any) {
        const result = await query(
            `INSERT INTO sites (site_name, site_address, site_status, created_by, created_on)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
            [data.siteName, data.siteAddress || null, data.siteStatus !== false, data.createdBy || 'system']
        );
        return result.rows[0];
    }

    async updateSite(siteId: number, data: any) {
        const result = await query(
            `UPDATE sites SET site_name = $1, site_address = $2, site_status = $3,
       last_modified_on = NOW()
       WHERE site_id = $4 RETURNING *`,
            [data.siteName, data.siteAddress || null, data.siteStatus !== false, siteId]
        );
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Site not found');
        return result.rows[0];
    }

    async deleteSite(siteId: number) {
        const result = await query(`DELETE FROM sites WHERE site_id = $1 RETURNING site_id`, [siteId]);
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Site not found');
        return result.rows[0];
    }
}

export class BuildingsService {
    async getBuildings(queryParams: any) {
        const { page, limit, offset } = parsePagination(queryParams);
        const siteId = queryParams.siteId;
        let whereClause = '';
        const params: any[] = [];

        if (siteId) {
            params.push(parseInt(siteId));
            whereClause = `WHERE b.site_id = $${params.length}`;
        }

        const countResult = await query(`SELECT COUNT(*) FROM buildings b ${whereClause}`, params);
        const total = parseInt(countResult.rows[0].count);

        params.push(limit, offset);
        const result = await query(
            `SELECT b.*, s.site_name FROM buildings b
       LEFT JOIN sites s ON b.site_id = s.site_id
       ${whereClause}
       ORDER BY b.building_id
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );
        return { data: result.rows, total, page, limit };
    }

    async getBuildingById(buildingId: number) {
        const result = await query(
            `SELECT b.*, s.site_name FROM buildings b
       LEFT JOIN sites s ON b.site_id = s.site_id
       WHERE b.building_id = $1`, [buildingId]
        );
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Building not found');
        return result.rows[0];
    }

    async createBuilding(data: any) {
        const result = await query(
            `INSERT INTO buildings (building_name, site_id, is_active, created_by, created_on)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
            [data.buildingName, data.siteId, true, data.createdBy]
        );
        return result.rows[0];
    }

    async updateBuilding(buildingId: number, data: any) {
        const result = await query(
            `UPDATE buildings SET building_name = $1, site_id = $2, is_active = $3,
       last_modified_by = $4, last_modified_on = NOW()
       WHERE building_id = $5 RETURNING *`,
            [data.buildingName, data.siteId, data.isActive, data.modifiedBy, buildingId]
        );
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Building not found');
        return result.rows[0];
    }

    async deleteBuilding(buildingId: number) {
        const result = await query(`DELETE FROM buildings WHERE building_id = $1 RETURNING building_id`, [buildingId]);
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Building not found');
        return result.rows[0];
    }
}

export class ZonesService {
    async getZones(queryParams: any) {
        const { page, limit, offset } = parsePagination(queryParams);
        const buildingId = queryParams.buildingId;
        let whereClause = '';
        const params: any[] = [];

        if (buildingId) {
            params.push(parseInt(buildingId));
            whereClause = `WHERE z.building_id = $${params.length}`;
        }

        const countResult = await query(`SELECT COUNT(*) FROM zones z ${whereClause}`, params);
        const total = parseInt(countResult.rows[0].count);

        params.push(limit, offset);
        const result = await query(
            `SELECT z.*, b.building_name, s.site_name FROM zones z
       LEFT JOIN buildings b ON z.building_id = b.building_id
       LEFT JOIN sites s ON b.site_id = s.site_id
       ${whereClause}
       ORDER BY z.zone_id
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );
        return { data: result.rows, total, page, limit };
    }

    async getZoneById(zoneId: number) {
        const result = await query(
            `SELECT z.*, b.building_name FROM zones z
       LEFT JOIN buildings b ON z.building_id = b.building_id
       WHERE z.zone_id = $1`, [zoneId]
        );
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Zone not found');
        return result.rows[0];
    }

    async createZone(data: any) {
        const result = await query(
            `INSERT INTO zones (zone_name, building_id, is_show_dashboard)
       VALUES ($1, $2, $3) RETURNING *`,
            [data.zoneName, data.buildingId, data.isShowDashboard || false]
        );
        return result.rows[0];
    }

    async updateZone(zoneId: number, data: any) {
        const result = await query(
            `UPDATE zones SET zone_name = $1, building_id = $2, is_show_dashboard = $3
       WHERE zone_id = $4 RETURNING *`,
            [data.zoneName, data.buildingId, data.isShowDashboard, zoneId]
        );
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Zone not found');
        return result.rows[0];
    }

    async deleteZone(zoneId: number) {
        const result = await query(`DELETE FROM zones WHERE zone_id = $1 RETURNING zone_id`, [zoneId]);
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Zone not found');
        return result.rows[0];
    }
}
