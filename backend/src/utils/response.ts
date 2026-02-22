import { ApiResponse, Pagination } from '../types';

export const successResponse = <T>(data: T, message?: string, pagination?: Pagination): ApiResponse<T> => {
    return {
        success: true,
        data,
        message,
        pagination,
        meta: {
            timestamp: new Date().toISOString(),
        },
    };
};

export const errorResponse = (code: string, message: string, details?: any[]): ApiResponse<null> => {
    return {
        success: false,
        message,
        errors: details,
        meta: {
            timestamp: new Date().toISOString(),
        },
    };
};

export const paginationHelper = (page: number, limit: number, total: number): Pagination => {
    return {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    };
};
