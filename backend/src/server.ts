import { createApp } from './config/app';
import express from 'express';
import path from 'path';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import pool from './config/database';
import { connectRedis, disconnectRedis, pubClient, REDIS_ENABLED } from './config/redis';
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
import layoutRoutes from './modules/layouts/layouts.routes';
import reportsRoutes from './modules/reports/reports.routes';
import dataCleanupRoutes from './modules/data-cleanup/dataCleanup.routes';
import licenseRoutes from './modules/license/license.routes';
import exportsRoutes from './modules/exports/exports.routes';
import { autoSubscribeFromMeterTable, syncMeterSubscriptions } from './modules/redis-pubsub/redisPubsub.service';
import { aggregationScheduler } from './modules/aggregation/aggregation.scheduler';
import { ensureAccessControlSchema } from './config/accessControl';
import swaggerUi from 'swagger-ui-express';
import { swaggerDocument } from './config/swagger';
import { alertEngine } from './modules/alarms/alert-engine.service';

const app = createApp();
const PORT = process.env.PORT || 3003;
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
app.use(`${API_PREFIX}/layouts`, layoutRoutes);
app.use(`${API_PREFIX}/reports`, reportsRoutes);
app.use(`${API_PREFIX}/data-cleanup`, dataCleanupRoutes);
app.use(`${API_PREFIX}/license`, licenseRoutes);
app.use(`${API_PREFIX}/exports`, exportsRoutes);

// Swagger API Documentation
app.use(`${API_PREFIX}/docs`, swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));



// Serve uploaded files statically
const uploadsPath = path.join(__dirname, '..', 'public/uploads');
app.use('/uploads', express.static(uploadsPath));

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
    // Ensure meter table has all columns that services expect.
    // Safe to run every startup – ADD COLUMN IF NOT EXISTS is a no-op when the column already exists.
    try {
        await pool.query(`ALTER TABLE IF EXISTS meter ADD COLUMN IF NOT EXISTS phase VARCHAR(50)`);
        await pool.query(`ALTER TABLE IF EXISTS meter ALTER COLUMN phase TYPE VARCHAR(50) USING phase::varchar`);
        await pool.query(`ALTER TABLE IF EXISTS meter ADD COLUMN IF NOT EXISTS circuit VARCHAR(100)`);
        await pool.query(`ALTER TABLE IF EXISTS meter ADD COLUMN IF NOT EXISTS floor VARCHAR(50)`);
        await pool.query(`ALTER TABLE IF EXISTS meter ALTER COLUMN floor TYPE VARCHAR(50) USING floor::varchar`);
        await pool.query(`ALTER TABLE IF EXISTS meter ADD COLUMN IF NOT EXISTS meter_group VARCHAR(100)`);
        await pool.query(`ALTER TABLE IF EXISTS meter ADD COLUMN IF NOT EXISTS max_kwh DECIMAL(18,2)`);
        await pool.query(`ALTER TABLE IF EXISTS meter ADD COLUMN IF NOT EXISTS subaddress INTEGER`);
        await pool.query(`ALTER TABLE IF EXISTS meter ADD COLUMN IF NOT EXISTS converter VARCHAR(100)`);

        await pool.query(`ALTER TABLE IF EXISTS sites ADD COLUMN IF NOT EXISTS site_name_th VARCHAR(200)`);
        await pool.query(`ALTER TABLE IF EXISTS sites ADD COLUMN IF NOT EXISTS site_name_en VARCHAR(200)`);
        await pool.query(`ALTER TABLE IF EXISTS buildings ADD COLUMN IF NOT EXISTS building_name_th VARCHAR(200)`);
        await pool.query(`ALTER TABLE IF EXISTS buildings ADD COLUMN IF NOT EXISTS building_name_en VARCHAR(200)`);
        await pool.query(`ALTER TABLE IF EXISTS buildings ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);

        await pool.query(`ALTER TABLE IF EXISTS aggregation_job_runs ADD COLUMN IF NOT EXISTS job_name VARCHAR(100) NOT NULL DEFAULT 'job'`);
        await pool.query(`ALTER TABLE IF EXISTS aggregation_job_runs ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'success'`);
        await pool.query(`ALTER TABLE IF EXISTS aggregation_job_runs ADD COLUMN IF NOT EXISTS rows_read INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE IF EXISTS aggregation_job_runs ADD COLUMN IF NOT EXISTS rows_written INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE IF EXISTS aggregation_job_runs ADD COLUMN IF NOT EXISTS rows_skipped INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE IF EXISTS aggregation_job_runs ADD COLUMN IF NOT EXISTS bucket_start TIMESTAMPTZ`);
        await pool.query(`ALTER TABLE IF EXISTS aggregation_job_runs ADD COLUMN IF NOT EXISTS bucket_end TIMESTAMPTZ`);
        await pool.query(`ALTER TABLE IF EXISTS aggregation_job_runs ADD COLUMN IF NOT EXISTS error_message TEXT`);
        await pool.query(`ALTER TABLE IF EXISTS aggregation_job_runs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW()`);
        await pool.query(`ALTER TABLE IF EXISTS aggregation_job_runs ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ`);

        // Ensure standard 7 meter types exist
        const standardTypes = [
            { id: 1, name: 'ELE', icon: 'fa fa-bolt' },
            { id: 2, name: 'WAT', icon: 'fa fa-tint' },
            { id: 3, name: 'GAS', icon: 'fa fa-fire' },
            { id: 4, name: 'MDB', icon: 'fa fa-plug' },
            { id: 5, name: 'SOL', icon: 'fa fa-solar-panel' },
            { id: 6, name: 'Humidity', icon: 'fa fa-smog' },
            { id: 7, name: 'Temperature', icon: 'fa fa-thermometer-half' },
        ];
        for (const t of standardTypes) {
            await pool.query(
                `INSERT INTO meter_type (meter_type_id, meter_type_name, icon_name, is_active) VALUES ($1, $2, $3, true)
                 ON CONFLICT (meter_type_id) DO UPDATE SET meter_type_name = $2, icon_name = $3, is_active = true`,
                [t.id, t.name, t.icon]
            );
        }
    } catch (e: any) {
        console.warn('⚠️  Schema patch (meter columns / types) skipped:', e.message);
    }

    await ensureAccessControlSchema();
    let meterSubscriptionSyncTimer: NodeJS.Timeout | null = null;

    if (REDIS_ENABLED) {
        try {
            await connectRedis();
            console.log('📡 Redis Pub/Sub ready');

            // Auto-subscribe to channels from Meter table
            await autoSubscribeFromMeterTable();
            const syncIntervalMs = parseInt(process.env.REDIS_SUBSCRIPTION_SYNC_MS || '30000', 10);
            meterSubscriptionSyncTimer = setInterval(() => {
                syncMeterSubscriptions().catch((error: any) => {
                    console.error('❌ Periodic Redis subscription sync failed:', error.message);
                });
            }, syncIntervalMs);
            meterSubscriptionSyncTimer.unref();
        } catch (error) {
            console.warn('⚠️  Redis connection failed, server will start without Redis');
        }
    } else {
        console.log('⏸️  Redis is DISABLED (REDIS_ENABLED=false)');
    }

    try {
        await aggregationScheduler.start();
    } catch (error: any) {
        console.warn('⚠️  Aggregation scheduler failed to start:', error.message);
    }

    try {
        alertEngine.start();
    } catch (error: any) {
        console.warn('⚠️  Alert Engine failed to start:', error.message);
    }

    const server = app.listen(PORT, () => {
        console.log(`\n🚀 Energy Monitoring API Server running on port ${PORT}`);
        console.log(`📡 API Base URL: http://localhost:${PORT}${API_PREFIX}`);
        console.log(`📖 Swagger API Docs: http://localhost:${PORT}${API_PREFIX}/docs`);
        console.log(`💚 Health check: http://localhost:${PORT}${API_PREFIX}/health`);
        console.log(`📡 Redis Pub/Sub: http://localhost:${PORT}${API_PREFIX}/redis/channels\n`);
    });

    // Graceful shutdown
    const shutdown = async () => {
        console.log('\n🔄 Shutting down gracefully...');
        aggregationScheduler.stop();
        alertEngine.stop();
        if (meterSubscriptionSyncTimer) clearInterval(meterSubscriptionSyncTimer);
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
