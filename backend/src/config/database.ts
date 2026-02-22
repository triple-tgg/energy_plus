import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const poolConfig: PoolConfig = {
    user: process.env.DB_USER || 'energyadmin',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_DATABASE || 'energy_plus',
    password: process.env.DB_PASSWORD || '',
    port: parseInt(process.env.DB_PORT || '25060', 10),
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: {
        rejectUnauthorized: false,
    },
};

const pool = new Pool(poolConfig);

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
