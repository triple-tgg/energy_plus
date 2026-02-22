import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { UsersService } from './users.service';
import { AuthRequest } from '../../types';
import { successResponse, paginationHelper } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';

const usersService = new UsersService();

export class UsersController {
    // ===== Users =====
    async getUsers(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await usersService.getUsers(req.query);
            res.json(successResponse(result.data, undefined, paginationHelper(result.page, result.limit, result.total)));
        } catch (error) { next(error); }
    }

    async getUserById(req: Request, res: Response, next: NextFunction) {
        try {
            const user = await usersService.getUserById(parseInt(req.params.id));
            res.json(successResponse(user));
        } catch (error) { next(error); }
    }

    async createUser(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            if (!req.body.password || req.body.password.length < 6) {
                throw new AppError(400, 'VALIDATION_ERROR', 'Password must be at least 6 characters');
            }
            const passwordHash = await bcrypt.hash(req.body.password, 12);
            const data = { ...req.body, passwordHash, createdBy: req.user?.userName };
            const user = await usersService.createUser(data);
            res.status(201).json(successResponse(user, 'User created'));
        } catch (error) { next(error); }
    }

    async updateUser(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const data = { ...req.body, modifiedBy: req.user?.userName };
            const user = await usersService.updateUser(parseInt(req.params.id), data);
            res.json(successResponse(user, 'User updated'));
        } catch (error) { next(error); }
    }

    async deleteUser(req: Request, res: Response, next: NextFunction) {
        try {
            await usersService.deleteUser(parseInt(req.params.id));
            res.json(successResponse(null, 'User deleted'));
        } catch (error) { next(error); }
    }

    // ===== Groups =====
    async getGroups(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await usersService.getGroups(req.query);
            res.json(successResponse(result.data, undefined, paginationHelper(result.page, result.limit, result.total)));
        } catch (error) { next(error); }
    }

    async getGroupById(req: Request, res: Response, next: NextFunction) {
        try {
            const group = await usersService.getGroupById(parseInt(req.params.id));
            res.json(successResponse(group));
        } catch (error) { next(error); }
    }

    async createGroup(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const data = { ...req.body, createdBy: req.user?.userName };
            const group = await usersService.createGroup(data);
            res.status(201).json(successResponse(group, 'Group created'));
        } catch (error) { next(error); }
    }

    async updateGroup(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const data = { ...req.body, modifiedBy: req.user?.userName };
            const group = await usersService.updateGroup(parseInt(req.params.id), data);
            res.json(successResponse(group, 'Group updated'));
        } catch (error) { next(error); }
    }

    async deleteGroup(req: Request, res: Response, next: NextFunction) {
        try {
            await usersService.deleteGroup(parseInt(req.params.id));
            res.json(successResponse(null, 'Group deleted'));
        } catch (error) { next(error); }
    }
}
