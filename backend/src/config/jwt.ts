import dotenv from 'dotenv';
import { Secret } from 'jsonwebtoken';
dotenv.config();

export const jwtConfig = {
    secret: (process.env.JWT_SECRET || 'change-me-in-env') as Secret,
    expiresIn: (process.env.JWT_EXPIRES_IN || '24h') as string | number,
    refreshExpiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as string | number,
};
