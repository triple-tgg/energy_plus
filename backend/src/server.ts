import { createApp } from './config/app';
import express from 'express';
import path from 'path';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import pool from './config/database';
import { connectRedis, disconnectRedis, pubClient } from './config/redis';
import { successResponse } from './utils/response';

// Import routes
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import sitesRoutes from './modules/sites/sites.routes';
import metersRoutes from './modules/meters/meters.routes';
import meterDataRoutes from './modules/meter-data/meterData.routes';
import companyRoutes from './modules/company/company.routes';
import alarmsRoutes from './modules/alarms/alarms.routes';
import billingRoutes from './modules/billing/billing.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import redisPubsubRoutes from './modules/redis-pubsub/redisPubsub.routes';
import { autoSubscribeDefaultChannel, isAutoSubscribeEnabled } from './modules/redis-pubsub/redisPubsub.service';

const app = createApp();
const PORT = process.env.PORT || 3000;
const API_PREFIX = '/api/v1';

// Health check
app.get(`${API_PREFIX}/health`, async (req, res) => {
    const redisStatus = pubClient.isReady ? 'connected' : 'disconnected';
    try {
        const dbResult = await pool.query('SELECT NOW()');
        res.json(successResponse({
            status: redisStatus === 'connected' ? 'ok' : 'degraded',
            timestamp: new Date().toISOString(),
            database: 'connected',
            dbTime: dbResult.rows[0].now,
            redis: redisStatus,
            redisHost: process.env.REDIS_HOST || 'localhost',
        }));
    } catch (error) {
        res.status(503).json(successResponse({
            status: 'error',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            redis: redisStatus,
        }));
    }
});

// API Routes
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/users`, usersRoutes);
app.use(`${API_PREFIX}/sites`, sitesRoutes);
app.use(`${API_PREFIX}/meters`, metersRoutes);
app.use(`${API_PREFIX}/meter-data`, meterDataRoutes);
app.use(`${API_PREFIX}/company`, companyRoutes);
app.use(`${API_PREFIX}/alarms`, alarmsRoutes);
app.use(`${API_PREFIX}/billing`, billingRoutes);
app.use(`${API_PREFIX}/dashboard`, dashboardRoutes);
app.use(`${API_PREFIX}/redis`, redisPubsubRoutes);

// DEBUG: List databases and tables
app.get(`${API_PREFIX}/debug/tables`, async (req, res) => {
    const dbs = await pool.query(`SELECT datname FROM pg_database WHERE datistemplate = false`);
    const schemas = await pool.query(`SELECT schema_name FROM information_schema.schemata`);
    const tables = await pool.query(`SELECT schemaname, tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')`);
    res.json({ databases: dbs.rows, schemas: schemas.rows, tables: tables.rows });
});

app.get(`${API_PREFIX}/debug/users`, async (req, res) => {
    try {
        const r = await pool.query(`SELECT "Id","UserName","Email" FROM "AspNetUsers" LIMIT 10`);
        res.json(r.rows);
    } catch (e: any) {
        try {
            const r2 = await pool.query(`SELECT * FROM aspnetusers LIMIT 10`);
            res.json(r2.rows);
        } catch (e2: any) {
            res.json({ error1: e.message, error2: e2.message });
        }
    }
});

// ── Production: serve frontend static files ──
const frontendPath = path.join(__dirname, '..', 'public');
app.use(express.static(frontendPath));

// SPA fallback — any non-API route serves index.html
app.get(/^(?!\/api).*/, (req, res) => {
    const indexPath = path.join(frontendPath, 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            // If frontend is not built (dev mode), fall through to 404
            res.status(404).json({ success: false, error: { message: 'Frontend not built. Run npm run build in frontend/' } });
        }
    });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server with Redis connection
const startServer = async () => {
    try {
        // Connect to Redis
        await connectRedis();
        console.log('📡 Redis Pub/Sub ready');

        // Auto-subscribe to default channel if enabled
        if (isAutoSubscribeEnabled()) {
            await autoSubscribeDefaultChannel();
        }
    } catch (error) {
        console.warn('⚠️  Redis connection failed, server will start without Redis');
    }

    const server = app.listen(PORT, () => {
        console.log(`\n🚀 EnergyPlus API Server running on port ${PORT}`);
        console.log(`📡 API Base URL: http://localhost:${PORT}${API_PREFIX}`);
        console.log(`💚 Health check: http://localhost:${PORT}${API_PREFIX}/health`);
        console.log(`📡 Redis Pub/Sub: http://localhost:${PORT}${API_PREFIX}/redis/channels\n`);
    });

    // Graceful shutdown
    const shutdown = async () => {
        console.log('\n🔄 Shutting down gracefully...');
        await disconnectRedis();
        server.close(() => {
            console.log('👋 Server closed');
            process.exit(0);
        });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
};

startServer();

export default app;
