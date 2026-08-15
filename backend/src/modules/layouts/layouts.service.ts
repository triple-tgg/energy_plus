import { query, getClient } from '../../config/database';
import { parsePagination } from '../../utils/pagination';
import { AppError } from '../../middleware/errorHandler';

export class LayoutsService {
    async getLayouts(queryParams: any) {
        const { page, limit, offset } = parsePagination(queryParams);
        const params: any[] = [];
        const filters: string[] = [];
        if (queryParams.siteId || queryParams.site_id) {
            params.push(parseInt(queryParams.siteId || queryParams.site_id, 10));
            filters.push(`l.site_id = $${params.length}`);
        }
        if (queryParams.buildingId || queryParams.building_id) {
            params.push(parseInt(queryParams.buildingId || queryParams.building_id, 10));
            filters.push(`l.building_id = $${params.length}`);
        }
        const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

        const countResult = await query(`SELECT COUNT(*) FROM layouts l ${whereClause}`, params);
        const total = parseInt(countResult.rows[0].count, 10);

        params.push(limit, offset);
        const result = await query(
            `SELECT l.*,
                    s.site_name, s.site_name_th, s.site_name_en,
                    b.building_name, b.building_name_th, b.building_name_en,
                    COALESCE(
                        (SELECT json_agg(json_build_object(
                            'point_type', summary.point_type,
                            'count', summary.meter_count
                         ) ORDER BY summary.point_type)
                         FROM (
                             SELECT CASE
                                      WHEN lp.point_type IN ('meter', 'power') THEN 'power'
                                      WHEN lp.point_type IN ('sensor', 'water') THEN 'water'
                                      WHEN lp.point_type IN ('gen', 'gas') THEN 'gas'
                                      WHEN lp.point_type IN ('ups', 'mdb') THEN 'mdb'
                                      WHEN lp.point_type IN ('temp', 'temperature') THEN 'temp'
                                      WHEN lp.point_type IN ('humidity', 'hum') THEN 'humidity'
                                      ELSE lp.point_type
                                    END AS point_type,
                                     COUNT(*)::int AS meter_count
                             FROM layout_points lp
                             WHERE lp.layout_id = l.id
                               AND lp.meter_id IS NOT NULL
                             GROUP BY 1
                         ) summary
                        ), '[]'::json
                    ) AS point_summary
             FROM layouts l
             LEFT JOIN sites s ON l.site_id = s.site_id
             LEFT JOIN buildings b ON l.building_id = b.building_id
             ${whereClause}
             ORDER BY l.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );
        return { data: result.rows, total, page, limit };
    }

    async getLayoutById(id: number) {
        const result = await query(
            `SELECT l.*,
                    s.site_name, s.site_name_th, s.site_name_en,
                    b.building_name, b.building_name_th, b.building_name_en
             FROM layouts l
             LEFT JOIN sites s ON l.site_id = s.site_id
             LEFT JOIN buildings b ON l.building_id = b.building_id
             WHERE l.id = $1`,
            [id]
        );
        if (result.rows.length === 0) {
            throw new AppError(404, 'NOT_FOUND', 'Layout not found');
        }
        return result.rows[0];
    }

    async createLayout(data: { name: string; position?: string; image_name?: string; image_url?: string; site_id?: number | null; building_id?: number | null }) {
        const result = await query(
            `INSERT INTO layouts (name, position, image_name, image_url, site_id, building_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *`,
            [data.name, data.position || null, data.image_name || null, data.image_url || null, data.site_id || null, data.building_id || null]
        );
        return result.rows[0];
    }

    async updateLayout(id: number, data: { name: string; position?: string; image_name?: string; image_url?: string; site_id?: number | null; building_id?: number | null }) {
        const existing = await this.getLayoutById(id);

        const result = await query(
            `UPDATE layouts 
             SET name = $1, 
                 position = $2, 
                 image_name = COALESCE($3, image_name), 
                 image_url = COALESCE($4, image_url), 
                 site_id = $5,
                 building_id = $6,
                 updated_at = NOW() 
             WHERE id = $7 RETURNING *`,
            [
                data.name,
                data.position || null,
                data.image_name || null,
                data.image_url || null,
                data.site_id !== undefined ? data.site_id : existing.site_id,
                data.building_id !== undefined ? data.building_id : existing.building_id,
                id
            ]
        );
        
        if (result.rows.length === 0) {
            throw new AppError(404, 'NOT_FOUND', 'Layout not found');
        }
        return result.rows[0];
    }

    async deleteLayout(id: number) {
        const existing = await this.getLayoutById(id);

        const result = await query(`DELETE FROM layouts WHERE id = $1 RETURNING id`, [id]);
        if (result.rows.length === 0) {
            throw new AppError(404, 'NOT_FOUND', 'Layout not found');
        }
        return result.rows[0];
    }

    // ═══════════════════════════════════════════════════════
    // Layout Points
    // ═══════════════════════════════════════════════════════

    async getPoints(layoutId: number) {
        // Verify layout exists
        await this.getLayoutById(layoutId);

        // Filter by layout_id in query for safety
        const filtered = await query(
            `SELECT lp.*, m.meter_name, m.meter_code, m.meter_type_id, mt.icon_name
             FROM layout_points lp
             LEFT JOIN meter m ON lp.meter_id = m.meter_id
             LEFT JOIN meter_type mt ON m.meter_type_id = mt.meter_type_id
             WHERE lp.layout_id = $1
             ORDER BY lp.id ASC`,
            [layoutId]
        );
        return filtered.rows;
    }

    async savePoints(layoutId: number, points: Array<{
        point_type: string;
        label?: string;
        x_percent: number;
        y_percent: number;
        meter_id?: number | null;
        config?: any;
    }>) {
        // Verify layout exists
        await this.getLayoutById(layoutId);

        const client = await getClient();
        try {
            await client.query('BEGIN');

            // Delete all existing points for this layout
            await client.query(`DELETE FROM layout_points WHERE layout_id = $1`, [layoutId]);

            // Insert new points
            for (const pt of points) {
                await client.query(
                    `INSERT INTO layout_points (layout_id, point_type, label, x_percent, y_percent, meter_id, config, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
                    [
                        layoutId,
                        pt.point_type,
                        pt.label || null,
                        pt.x_percent,
                        pt.y_percent,
                        pt.meter_id || null,
                        JSON.stringify(pt.config || {}),
                    ]
                );
            }

            await client.query('COMMIT');

            // Return the saved points
            return this.getPoints(layoutId);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async addPoint(layoutId: number, data: {
        point_type: string;
        label?: string;
        x_percent: number;
        y_percent: number;
        meter_id?: number | null;
        config?: any;
    }) {
        await this.getLayoutById(layoutId);

        const result = await query(
            `INSERT INTO layout_points (layout_id, point_type, label, x_percent, y_percent, meter_id, config, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
            [
                layoutId,
                data.point_type,
                data.label || null,
                data.x_percent,
                data.y_percent,
                data.meter_id || null,
                JSON.stringify(data.config || {}),
            ]
        );
        return result.rows[0];
    }

    async updatePoint(pointId: number, data: {
        point_type?: string;
        label?: string;
        x_percent?: number;
        y_percent?: number;
        meter_id?: number | null;
        config?: any;
    }) {
        const existing = await query(`SELECT * FROM layout_points WHERE id = $1`, [pointId]);
        if (existing.rows.length === 0) {
            throw new AppError(404, 'NOT_FOUND', 'Point not found');
        }

        const result = await query(
            `UPDATE layout_points 
             SET point_type = COALESCE($1, point_type),
                 label = COALESCE($2, label),
                 x_percent = COALESCE($3, x_percent),
                 y_percent = COALESCE($4, y_percent),
                 meter_id = $5,
                 config = COALESCE($6, config),
                 updated_at = NOW()
             WHERE id = $7 RETURNING *`,
            [
                data.point_type || null,
                data.label || null,
                data.x_percent || null,
                data.y_percent || null,
                data.meter_id !== undefined ? data.meter_id : existing.rows[0].meter_id,
                data.config ? JSON.stringify(data.config) : null,
                pointId,
            ]
        );
        return result.rows[0];
    }

    async deletePoint(pointId: number) {
        const result = await query(`DELETE FROM layout_points WHERE id = $1 RETURNING id`, [pointId]);
        if (result.rows.length === 0) {
            throw new AppError(404, 'NOT_FOUND', 'Point not found');
        }
        return result.rows[0];
    }
}
