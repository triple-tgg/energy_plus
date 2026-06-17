import { query } from '../../config/database';
import { parsePagination } from '../../utils/pagination';
import { AppError } from '../../middleware/errorHandler';
import fs from 'fs';
import path from 'path';

export class LayoutsService {
    private deleteFileFromUrl(imageUrl: string | undefined | null) {
        if (!imageUrl) return;
        try {
            const parts = imageUrl.split('/uploads/layouts/');
            if (parts.length === 2) {
                const filename = parts[1];
                const filepath = path.join(__dirname, '../../../public/uploads/layouts', filename);
                if (fs.existsSync(filepath)) {
                    fs.unlinkSync(filepath);
                }
            }
        } catch (e) {
            console.error('❌ Failed to delete layout image file:', e);
        }
    }

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
        
        // If a new image is provided, delete the old file
        if (data.image_url && existing.image_url) {
            this.deleteFileFromUrl(existing.image_url);
        }

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
        
        // Delete image file
        if (existing.image_url) {
            this.deleteFileFromUrl(existing.image_url);
        }

        const result = await query(`DELETE FROM layouts WHERE id = $1 RETURNING id`, [id]);
        if (result.rows.length === 0) {
            throw new AppError(404, 'NOT_FOUND', 'Layout not found');
        }
        return result.rows[0];
    }
}
