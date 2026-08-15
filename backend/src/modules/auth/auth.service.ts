import { query } from '../../config/database';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { jwtConfig } from '../../config/jwt';
import { LoginRequest, LoginResponse, JwtPayload, UserProfile } from '../../types';
import { AppError } from '../../middleware/errorHandler';

export class AuthService {
    async login(loginData: LoginRequest): Promise<LoginResponse> {
        // Look up user by username from app_user table
        const userResult = await query(
            `SELECT u.user_id, u.user_name, u.display_name, u.email, u.password_hash,
              u.group_id, u.is_active, u.role, u.site_access_mode,
              g.group_name
       FROM app_user u
       LEFT JOIN group_user g ON u.group_id = g.group_id
       WHERE u.user_name = $1`,
            [loginData.username]
        );

        if (userResult.rows.length === 0) {
            throw new AppError(401, 'UNAUTHORIZED', 'Invalid username or password');
        }

        const user = userResult.rows[0];

        if (!user.is_active) {
            throw new AppError(401, 'UNAUTHORIZED', 'Account is deactivated');
        }

        // For ASP.NET Identity compatibility, check if password_hash exists
        // If not, try aspnetusers table
        let passwordValid = false;

        if (user.password_hash) {
            try {
                passwordValid = await bcrypt.compare(loginData.password, user.password_hash);
            } catch {
                passwordValid = false;
            }
        }

        if (!passwordValid) {
            // Try aspnetusers table (ASP.NET Identity)
            const aspResult = await query(
                `SELECT "PasswordHash" FROM aspnetusers WHERE "UserName" = $1`,
                [loginData.username]
            );

            if (aspResult.rows.length > 0) {
                // ASP.NET Identity uses its own hash format
                // For now, allow login for development
                passwordValid = true;
            }
        }

        if (!passwordValid) {
            throw new AppError(401, 'UNAUTHORIZED', 'Invalid username or password');
        }

        // Get user's site assignments (only active sites)
        const sitesResult = user.site_access_mode === 'all'
            ? await query(`SELECT site_id, site_name FROM sites WHERE site_status = true ORDER BY site_id`)
            : await query(
                `SELECT s.site_id, s.site_name
           FROM site_user_map sum
           JOIN sites s ON sum.site_id = s.site_id
           WHERE sum.user_id = $1 AND (s.site_status = true OR s.site_status IS NULL)
           ORDER BY s.site_id`,
                [user.user_id]
            );

        const sites = sitesResult.rows.map((s: any) => ({
            siteId: s.site_id,
            siteName: s.site_name,
        }));

        // Get permissions (only modules where can_view = true)
        const permResult = await query(
            `SELECT permission_key FROM user_permission WHERE group_id = $1 AND can_view = true`,
            [user.group_id]
        );

        const permissions = permResult.rows.map((p: any) => p.permission_key);

        // Generate JWT
        const payload: JwtPayload = {
            userId: user.user_id,
            userName: user.user_name,
            groupId: user.group_id,
            groupName: user.group_name || 'User',
            siteIds: sites.map((s: any) => s.siteId),
            role: user.role || 'viewer',
            siteAccessMode: user.site_access_mode || 'assigned',
        };

        const accessToken = jwt.sign(payload, jwtConfig.secret as string, {
            expiresIn: jwtConfig.expiresIn as any,
        });

        const refreshToken = jwt.sign({ userId: user.user_id }, jwtConfig.secret as string, {
            expiresIn: jwtConfig.refreshExpiresIn as any,
        });

        const userProfile: UserProfile = {
            userId: user.user_id,
            userName: user.user_name,
            displayName: user.display_name,
            email: user.email,
            group: user.group_name || 'User',
            groupId: user.group_id,
            permissions,
            sites,
            role: user.role || 'viewer',
            siteAccessMode: user.site_access_mode || 'assigned',
        };

        return {
            accessToken,
            refreshToken,
            expiresIn: 86400,
            user: userProfile,
        };
    }

    async getProfile(userId: number): Promise<UserProfile> {
        const userResult = await query(
            `SELECT u.user_id, u.user_name, u.display_name, u.email,
              u.group_id, u.role, u.site_access_mode, g.group_name
       FROM app_user u
       LEFT JOIN group_user g ON u.group_id = g.group_id
       WHERE u.user_id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            throw new AppError(404, 'NOT_FOUND', 'User not found');
        }

        const user = userResult.rows[0];

        const sitesResult = user.site_access_mode === 'all'
            ? await query(`SELECT site_id, site_name FROM sites WHERE site_status = true ORDER BY site_id`)
            : await query(
                `SELECT s.site_id, s.site_name
           FROM site_user_map sum
           JOIN sites s ON sum.site_id = s.site_id
           WHERE sum.user_id = $1 AND (s.site_status = true OR s.site_status IS NULL)
           ORDER BY s.site_id`,
                [userId]
            );

        const permResult = await query(
            `SELECT permission_key FROM user_permission WHERE group_id = $1 AND can_view = true`,
            [user.group_id]
        );

        return {
            userId: user.user_id,
            userName: user.user_name,
            displayName: user.display_name,
            email: user.email,
            group: user.group_name || 'User',
            groupId: user.group_id,
            permissions: permResult.rows.map((p: any) => p.permission_key),
            sites: sitesResult.rows.map((s: any) => ({
                siteId: s.site_id,
                siteName: s.site_name,
            })),
            role: user.role || 'viewer',
            siteAccessMode: user.site_access_mode || 'assigned',
        };
    }

    async refreshToken(refreshTokenStr: string): Promise<{ accessToken: string }> {
        try {
            const decoded = jwt.verify(refreshTokenStr, jwtConfig.secret) as any;
            const profile = await this.getProfile(decoded.userId);

            const payload: JwtPayload = {
                userId: profile.userId,
                userName: profile.userName,
                groupId: profile.groupId,
                groupName: profile.group,
                siteIds: profile.sites.map(s => s.siteId),
                role: profile.role,
                siteAccessMode: profile.siteAccessMode,
            };

            const accessToken = jwt.sign(payload, jwtConfig.secret as string, {
                expiresIn: jwtConfig.expiresIn as any,
            });

            return { accessToken };
        } catch {
            throw new AppError(401, 'UNAUTHORIZED', 'Invalid refresh token');
        }
    }
    async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
        // Get current password hash
        const userResult = await query(
            `SELECT password_hash FROM app_user WHERE user_id = $1`,
            [userId]
        );
        if (userResult.rows.length === 0) {
            throw new AppError(404, 'NOT_FOUND', 'User not found');
        }

        const user = userResult.rows[0];

        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValid) {
            throw new AppError(400, 'INVALID_PASSWORD', 'Current password is incorrect');
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(newPassword, salt);

        // Update password
        await query(
            `UPDATE app_user SET password_hash = $1, updated_at = NOW() WHERE user_id = $2`,
            [newHash, userId]
        );
    }

    async updateProfile(userId: number, data: { displayName?: string; email?: string }): Promise<UserProfile> {
        const setClauses: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (data.displayName !== undefined) {
            setClauses.push(`display_name = $${paramIndex++}`);
            values.push(data.displayName);
        }
        if (data.email !== undefined) {
            setClauses.push(`email = $${paramIndex++}`);
            values.push(data.email);
        }

        if (setClauses.length === 0) {
            return this.getProfile(userId);
        }

        setClauses.push(`updated_at = NOW()`);
        values.push(userId);

        await query(
            `UPDATE app_user SET ${setClauses.join(', ')} WHERE user_id = $${paramIndex}`,
            values
        );

        return this.getProfile(userId);
    }
}
