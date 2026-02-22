import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { errorResponse } from '../utils/response';

export const validate = (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') => {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req[source]);

        if (!result.success) {
            const errors = result.error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message,
            }));
            return res.status(400).json(errorResponse('VALIDATION_ERROR', 'Request validation failed', errors));
        }

        req[source] = result.data;
        next();
    };
};
