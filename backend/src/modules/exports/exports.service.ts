import { query } from '../../config/database';
import { parsePagination } from '../../utils/pagination';
import { AppError } from '../../middleware/errorHandler';

export class ExportsService {
    async ensureTable() {
        await query(`
            CREATE TABLE IF NOT EXISTS export_configs (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                export_path VARCHAR(500),
                schedule_every VARCHAR(100),
                is_active BOOLEAN DEFAULT true,
                created_on TIMESTAMPTZ DEFAULT NOW(),
                last_modified_on TIMESTAMPTZ DEFAULT NOW()
            )
        `);
    }

    async getExports(queryParams: any) {
        await this.ensureTable();
        const { page, limit, offset } = parsePagination(queryParams);
        const countRes = await query(`SELECT COUNT(*) FROM export_configs`);
        const total = parseInt(countRes.rows[0].count, 10);
        const res = await query(
            `SELECT * FROM export_configs ORDER BY id DESC LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        return { data: res.rows, total, page, limit };
    }

    async getExportById(id: number) {
        await this.ensureTable();
        const res = await query(`SELECT * FROM export_configs WHERE id = $1`, [id]);
        if (res.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Export config not found');
        return res.rows[0];
    }

    async createExport(data: any) {
        await this.ensureTable();
        const res = await query(
            `INSERT INTO export_configs (name, export_path, schedule_every, is_active, created_on, last_modified_on)
             VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *`,
            [data.name, data.exportPath || null, data.scheduleEvery || null, data.isActive !== false]
        );
        return res.rows[0];
    }

    async updateExport(id: number, data: any) {
        await this.ensureTable();
        const res = await query(
            `UPDATE export_configs SET name = $1, export_path = $2, schedule_every = $3, is_active = $4, last_modified_on = NOW()
             WHERE id = $5 RETURNING *`,
            [data.name, data.exportPath || null, data.scheduleEvery || null, data.isActive !== false, id]
        );
        if (res.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Export config not found');
        return res.rows[0];
    }

    async deleteExport(id: number) {
        await this.ensureTable();
        const res = await query(`DELETE FROM export_configs WHERE id = $1 RETURNING id`, [id]);
        if (res.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Export config not found');
        return res.rows[0];
    }
}

export const exportsService = new ExportsService();
