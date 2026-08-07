import bcrypt from 'bcryptjs';
import { query, getClient } from '../../config/database';
import { parsePagination } from '../../utils/pagination';
import { AppError } from '../../middleware/errorHandler';

export class UsersService {
    async getUsers(queryParams: any) {
        const { page, limit, offset } = parsePagination(queryParams);
        const search = queryParams.search || '';

        let whereClause = '';
        const params: any[] = [];

        if (search) {
            params.push(`%${search}%`);
            whereClause = `WHERE u.user_name ILIKE $${params.length} OR u.display_name ILIKE $${params.length} OR u.email ILIKE $${params.length}`;
        }

        const countResult = await query(`SELECT COUNT(*) FROM app_user u ${whereClause}`, params);
        const total = parseInt(countResult.rows[0].count);

        params.push(limit, offset);
        const result = await query(
            `SELECT u.user_id, u.user_name, u.display_name, u.email, u.is_active,
              u.group_id, g.group_name, u.role, u.site_access_mode,
              COALESCE(array_agg(DISTINCT sum.site_id) FILTER (WHERE sum.site_id IS NOT NULL), '{}') AS site_ids,
              COALESCE(string_agg(DISTINCT s.site_name, ', '), '') AS site_names,
              u.created_by, u.created_on, u.last_modified_by, u.last_modified_on
       FROM app_user u
       LEFT JOIN group_user g ON u.group_id = g.group_id
       LEFT JOIN site_user_map sum ON u.user_id = sum.user_id
       LEFT JOIN sites s ON sum.site_id = s.site_id
       ${whereClause}
       GROUP BY u.user_id, g.group_name
       ORDER BY u.user_id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        return { data: result.rows, total, page, limit };
    }

    async getUserById(userId: number) {
        const result = await query(
            `SELECT u.*, g.group_name
       FROM app_user u
       LEFT JOIN group_user g ON u.group_id = g.group_id
       WHERE u.user_id = $1`,
            [userId]
        );
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'User not found');
        return result.rows[0];
    }

    async createUser(data: any) {
        const client = await getClient();
        try {
            await client.query('BEGIN');
            const result = await client.query(
                `INSERT INTO app_user (user_name, display_name, email, password_hash, group_id, is_active, role, site_access_mode, created_by, created_on)
                 VALUES ($1,$2,$3,$4,$5,true,$6,$7,$8,NOW()) RETURNING *`,
                [data.userName, data.displayName, data.email, data.passwordHash, data.groupId, data.role || 'viewer', data.siteAccessMode || 'assigned', data.createdBy]
            );
            for (const siteId of data.siteIds || []) await client.query(`INSERT INTO site_user_map (site_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [siteId, result.rows[0].user_id]);
            await client.query('COMMIT');
            return result.rows[0];
        } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    }

    async updateUser(userId: number, data: any) {
        const client = await getClient();
        try {
            await client.query('BEGIN');
            const result = await client.query(
                `UPDATE app_user SET display_name=$1,email=$2,group_id=$3,is_active=$4,role=$5,site_access_mode=$6,last_modified_by=$7,last_modified_on=NOW()
                 WHERE user_id=$8 RETURNING *`,
                [data.displayName, data.email, data.groupId, data.isActive, data.role || 'viewer', data.siteAccessMode || 'assigned', data.modifiedBy, userId]
            );
            if (!result.rows.length) throw new AppError(404, 'NOT_FOUND', 'User not found');
            await client.query(`DELETE FROM site_user_map WHERE user_id=$1`, [userId]);
            for (const siteId of data.siteIds || []) await client.query(`INSERT INTO site_user_map (site_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [siteId, userId]);
            await client.query('COMMIT');
            return result.rows[0];
        } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    }

    async deleteUser(userId: number) {
        const result = await query(`DELETE FROM app_user WHERE user_id = $1 RETURNING user_id`, [userId]);
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'User not found');
        return result.rows[0];
    }

    // ===== Groups =====
    async getGroups(queryParams: any) {
        const { page, limit, offset } = parsePagination(queryParams);
        const countResult = await query(`SELECT COUNT(*) FROM group_user`);
        const total = parseInt(countResult.rows[0].count);

        const result = await query(
            `SELECT * FROM group_user ORDER BY group_id LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        return { data: result.rows, total, page, limit };
    }

    async getGroupById(groupId: number) {
        const result = await query(`SELECT * FROM group_user WHERE group_id = $1`, [groupId]);
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Group not found');
        return result.rows[0];
    }

    async createGroup(data: any) {
        const result = await query(
            `INSERT INTO group_user (group_name, description, is_active, created_on)
       VALUES ($1, $2, $3, NOW()) RETURNING *`,
            [data.groupName, data.description || null, data.isActive !== false]
        );
        return result.rows[0];
    }

    async updateGroup(groupId: number, data: any) {
        const result = await query(
            `UPDATE group_user SET group_name = $1, description = $2, is_active = $3
       WHERE group_id = $4 RETURNING *`,
            [data.groupName, data.description || null, data.isActive !== false, groupId]
        );
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Group not found');
        return result.rows[0];
    }

    async deleteGroup(groupId: number) {
        const result = await query(`DELETE FROM group_user WHERE group_id = $1 RETURNING group_id`, [groupId]);
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Group not found');
        return result.rows[0];
    }

    async getGroupPermissions(groupId: number) {
        const result = await query(
            `SELECT * FROM user_permission WHERE group_id = $1`,
            [groupId]
        );
        return result.rows;
    }

    async updateGroupPermissions(groupId: number, permissions: any[]) {
        const client = await getClient();
        try {
            await client.query('BEGIN');
            await client.query(`DELETE FROM user_permission WHERE group_id = $1`, [groupId]);
            for (const perm of permissions) {
                await client.query(
                    `INSERT INTO user_permission (group_id, permission_key, can_view, can_create, can_edit, can_delete)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                        groupId,
                        perm.permission_key || perm.permissionKey,
                        perm.can_view ?? perm.canView ?? false,
                        perm.can_create ?? perm.canCreate ?? false,
                        perm.can_edit ?? perm.canEdit ?? false,
                        perm.can_delete ?? perm.canDelete ?? false
                    ]
                );
            }
            await client.query('COMMIT');
            return { message: 'Permissions updated successfully' };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async resetPassword(userId: number, password: string) {
        const passwordHash = await bcrypt.hash(password, 12);
        const result = await query(
            `UPDATE app_user SET password_hash = $1, last_modified_on = NOW() WHERE user_id = $2 RETURNING user_id`,
            [passwordHash, userId]
        );
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'User not found');
        return result.rows[0];
    }
}
