import { Pool, PoolConfig } from 'pg';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const useSsl = process.env.DB_SSL === 'true';

const poolConfig: PoolConfig = {
    user: process.env.DB_USER || 'energyadmin',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_DATABASE || 'energy_plus',
    password: process.env.DB_PASSWORD || '',
    port: parseInt(process.env.DB_PORT || '25060', 10),
    max: 20,
    ssl: useSsl
        ? {
            rejectUnauthorized: false,
        }
        : false,
};

const pool = new Pool(poolConfig);

console.log(`🔌 Database initialized -> Host: ${poolConfig.host}, Port: ${poolConfig.port}, DB: ${poolConfig.database}`);

pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('❌ PostgreSQL pool error:', err.message);
});

export const query = (text: string, params?: any[]) => {
    return pool.query(text, params);
};

export const getClient = () => {
    return pool.connect();
};

export default pool;
