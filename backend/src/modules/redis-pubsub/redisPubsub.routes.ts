import { Router } from 'express';
import { publish, subscribe, channels, latest, realtimeHistory, realtimeAlerts } from './redisPubsub.controller';
import { authenticate } from '../../middleware/auth';
import { enforceSiteAccess, requireRole } from '../../middleware/accessControl';

const router = Router();

// POST /api/v1/redis/publish — Publish message to channel
router.post('/publish', authenticate, requireRole('admin'), publish);

// GET /api/v1/redis/subscribe/:channel — SSE real-time subscribe
router.get('/subscribe/:channel', authenticate, subscribe);

// GET /api/v1/redis/channels — List active channels
router.get('/channels', authenticate, channels);

// GET /api/v1/redis/latest — Get latest real-time meter readings (enriched)
router.get('/latest', authenticate, enforceSiteAccess, latest);

// GET /api/v1/redis/history — Get time-bucketed realtime history for charts
router.get('/history', authenticate, enforceSiteAccess, realtimeHistory);
router.get('/alerts', authenticate, enforceSiteAccess, realtimeAlerts);

export default router;
