import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/response';

export class AppError extends Error {
    statusCode: number;
    code: string;

    constructor(statusCode: number, code: string, message: string) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
    }
}

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json(errorResponse(err.code, err.message));
    }

    console.error('Unhandled error:', err);
    return res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error'));
};

export const notFoundHandler = (req: Request, res: Response) => {
    res.status(404).json(errorResponse('NOT_FOUND', `Route ${req.method} ${req.path} not found`));
};
