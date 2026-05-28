import { Router } from 'express';
import { publish, subscribe, channels } from './redisPubsub.controller';

const router = Router();

// POST /api/v1/redis/publish — Publish message to channel
router.post('/publish', publish);

// GET /api/v1/redis/subscribe/:channel — SSE real-time subscribe
router.get('/subscribe/:channel', subscribe);

// GET /api/v1/redis/channels — List active channels
router.get('/channels', channels);

export default router;