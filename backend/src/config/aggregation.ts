import dotenv from 'dotenv';

dotenv.config();

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
    if (value === undefined) {
        return fallback;
    }
    return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
};

const parseNumber = (value: string | undefined, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const aggregationConfig = {
    enabled: parseBoolean(process.env.AGGREGATION_ENABLED, false),
    minuteCron: process.env.AGGREGATION_MINUTE_CRON || '* * * * *',
    dailyCron: process.env.AGGREGATION_DAILY_CRON || '5 0 * * *',
    monthlyCron: process.env.AGGREGATION_MONTHLY_CRON || '15 0 1 * *',
    retentionCron: process.env.AGGREGATION_RETENTION_CRON || '30 2 * * *',
    retentionMonths: parseNumber(process.env.AGGREGATION_RETENTION_MONTHS, 3),
    timezone: process.env.AGGREGATION_TIMEZONE || 'Asia/Bangkok',
    lookbackMinutes: parseNumber(process.env.AGGREGATION_LOOKBACK_MINUTES, 5),
    cleanupBatchSize: parseNumber(process.env.AGGREGATION_CLEANUP_BATCH_SIZE, 10000),
};

