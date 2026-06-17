import { query, getClient } from '../../config/database';
import { parsePagination } from '../../utils/pagination';
import { AppError } from '../../middleware/errorHandler';

export class LayoutsService {
    async getLayouts(queryParams: any) {
        const { page, limit, offset } = parsePagination(queryParams);
        const countResult = await query(`SELECT COUNT(*) FROM layouts`);
        const total = parseInt(countResult.rows[0].count, 10);
        const result = await query(
            `SELECT * FROM layouts ORDER BY id DESC LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        return { data: result.rows, total, page, limit };
    }

    async getLayoutById(id: number) {
        const result = await query(`SELECT * FROM layouts WHERE id = $1`, [id]);
        if (result.rows.length === 0) {
            throw new AppError(404, 'NOT_FOUND', 'Layout not found');
        }
        return result.rows[0];
    }

    async createLayout(data: { name: string; position?: string; image_name?: string; image_url?: string }) {
        const result = await query(
            `INSERT INTO layouts (name, position, image_name, image_url, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *`,
            [data.name, data.position || null, data.image_name || null, data.image_url || null]
        );
        return result.rows[0];
    }

    async updateLayout(id: number, data: { name: string; position?: string; image_name?: string; image_url?: string }) {
        const existing = await this.getLayoutById(id);

        const result = await query(
            `UPDATE layouts 
             SET name = $1, 
                 position = $2, 
                 image_name = COALESCE($3, image_name), 
                 image_url = COALESCE($4, image_url), 
                 updated_at = NOW() 
             WHERE id = $5 RETURNING *`,
            [
                data.name,
                data.position || null,
                data.image_name || null,
                data.image_url || null,
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

        const result = await query(
            `SELECT lp.*, m.meter_name, m.meter_code
             FROM layout_points lp
             LEFT JOIN meter m ON lp.meter_id = m.meter_id
             ORDER BY lp.id ASC`,
            []
        );
        // Filter by layout_id in query for safety
        const filtered = await query(
            `SELECT lp.*, m.meter_name, m.meter_code
             FROM layout_points lp
             LEFT JOIN meter m ON lp.meter_id = m.meter_id
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
