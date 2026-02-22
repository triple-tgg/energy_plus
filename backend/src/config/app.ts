import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

export const createApp = (): Application => {
    const app = express();

    // Security
    app.use(helmet());

    // CORS
    app.use(cors({
        origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    // Rate limiting
    const limiter = rateLimit({
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 100,
        message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
    });
    app.use(limiter);

    // Body parsing
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Logging
    if (process.env.NODE_ENV !== 'production') {
        app.use(morgan('dev'));
    }

    return app;
};
