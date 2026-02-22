import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt';
import { AuthRequest, JwtPayload } from '../types';
import { errorResponse } from '../utils/response';

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json(errorResponse('UNAUTHORIZED', 'Access token is required'));
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, jwtConfig.secret) as JwtPayload;
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json(errorResponse('UNAUTHORIZED', 'Invalid or expired access token'));
    }
};

export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, jwtConfig.secret) as JwtPayload;
            req.user = decoded;
        } catch (error) {
            // Token invalid, continue without auth
        }
    }

    next();
};
