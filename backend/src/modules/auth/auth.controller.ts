import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { AuthRequest } from '../../types';
import { successResponse, errorResponse } from '../../utils/response';

const authService = new AuthService();

export class AuthController {
    async login(req: Request, res: Response, next: NextFunction) {
        try {
            const { username, password, siteId } = req.body;
            const result = await authService.login({ username, password, siteId });
            res.json(successResponse(result, 'Login successful'));
        } catch (error) {
            next(error);
        }
    }

    async me(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const profile = await authService.getProfile(req.user!.userId);
            res.json(successResponse(profile));
        } catch (error) {
            next(error);
        }
    }

    async refresh(req: Request, res: Response, next: NextFunction) {
        try {
            const { refreshToken } = req.body;
            const result = await authService.refreshToken(refreshToken);
            res.json(successResponse(result));
        } catch (error) {
            next(error);
        }
    }

    async changePassword(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { currentPassword, newPassword } = req.body;
            if (!currentPassword || !newPassword) {
                return res.status(400).json(errorResponse('VALIDATION', 'Current password and new password are required'));
            }
            if (newPassword.length < 6) {
                return res.status(400).json(errorResponse('VALIDATION', 'New password must be at least 6 characters'));
            }
            await authService.changePassword(req.user!.userId, currentPassword, newPassword);
            res.json(successResponse(null, 'Password changed successfully'));
        } catch (error) {
            next(error);
        }
    }

    async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { displayName, email } = req.body;
            const profile = await authService.updateProfile(req.user!.userId, { displayName, email });
            res.json(successResponse(profile, 'Profile updated successfully'));
        } catch (error) {
            next(error);
        }
    }
}
