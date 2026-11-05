export const parsePagination = (query: any, defaultLimit: number = 10, maxLimit: number = 5000): { page: number; limit: number; offset: number } => {
    const page = Math.max(1, parseInt(query?.page) || 1);
    const requestedLimit = parseInt(query?.limit) || defaultLimit;
    const limit = Math.min(maxLimit, Math.max(1, requestedLimit));
    const offset = (page - 1) * limit;
    return { page, limit, offset };
};
