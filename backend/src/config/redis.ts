import { createClient, RedisClientType } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

// --- Redis Config ---
const REDIS_CONFIG = {
    socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        connectTimeout: 10000,
        reconnectStrategy: (retries: number) =>
        {
            if (retries > 3) {
                console.warn('⚠️  Redis max reconnect attempts reached, giving up');
                return false as unknown as number;
            }
            return Math.min(retries * 1000, 5000);
        },
    },
    password: process.env.REDIS_PASSWORD || undefined,
};

// --- Publisher client (ใช้สำหรับ publish + general commands) ---
export const pubClient: RedisClientType = createClient(REDIS_CONFIG);

// --- Subscriber client (ใช้สำหรับ subscribe — ต้องแยก client) ---
export const subClient: RedisClientType = createClient(REDIS_CONFIG);

// Default channel from env
export const DEFAULT_CHANNEL = process.env.REDIS_DEFAULT_CHANNEL || 'default';

// Auto-subscribe on startup (true/false)
export const AUTO_SUBSCRIBE = process.env.REDIS_AUTO_SUBSCRIBE === 'true';

// Master toggle — skip Redis entirely if false
export const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';

/**
 * Connect both Redis clients
 */
export const connectRedis = async (): Promise<void> =>
{
    try {
        pubClient.on('error', (err: any) => console.error('❌ Redis Publisher Error:', err.message));
        subClient.on('error', (err: any) => console.error('❌ Redis Subscriber Error:', err.message));

        await pubClient.connect();
        console.log('✅ Redis Publisher connected ');

        await subClient.connect();
        console.log('✅ Redis Subscriber connected ');
    } catch (error: any) {
        console.error('❌ Failed to connect to Redis:', error.message);
        throw error;
    }
};

/**
 * Disconnect both Redis clients (graceful shutdown)
 */
export const disconnectRedis = async (): Promise<void> =>
{
    try {
        await subClient.unsubscribe();
        await subClient.quit();
        await pubClient.quit();
        console.log('🔌 Redis connections closed');
    } catch (error: any) {
        console.error('❌ Error disconnecting Redis:', error.message);
    }
};
