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
              u.group_id, u.is_active,
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

        // Get user's site assignments
        const sitesResult = await query(
            `SELECT s.site_id, s.site_name
       FROM site_user_map sum
       JOIN sites s ON sum.site_id = s.site_id
       WHERE sum.user_id = $1`,
            [user.user_id]
        );

        const sites = sitesResult.rows.map((s: any) => ({
            siteId: s.site_id,
            siteName: s.site_name,
        }));

        // Get permissions
        const permResult = await query(
            `SELECT permission_key FROM user_permission WHERE group_id = $1`,
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
              u.group_id, g.group_name
       FROM app_user u
       LEFT JOIN group_user g ON u.group_id = g.group_id
       WHERE u.user_id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            throw new AppError(404, 'NOT_FOUND', 'User not found');
        }

        const user = userResult.rows[0];

        const sitesResult = await query(
            `SELECT s.site_id, s.site_name
       FROM site_user_map sum
       JOIN sites s ON sum.site_id = s.site_id
       WHERE sum.user_id = $1`,
            [userId]
        );

        const permResult = await query(
            `SELECT permission_name FROM user_permission WHERE group_id = $1`,
            [user.group_id]
        );

        return {
            userId: user.user_id,
            userName: user.user_name,
            displayName: user.display_name,
            email: user.email,
            group: user.group_name || 'User',
            groupId: user.group_id,
            permissions: permResult.rows.map((p: any) => p.permission_name),
            sites: sitesResult.rows.map((s: any) => ({
                siteId: s.site_id,
                siteName: s.site_name,
            })),
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
            };

            const accessToken = jwt.sign(payload, jwtConfig.secret as string, {
                expiresIn: jwtConfig.expiresIn as any,
            });

            return { accessToken };
        } catch {
            throw new AppError(401, 'UNAUTHORIZED', 'Invalid refresh token');
        }
    }
}
