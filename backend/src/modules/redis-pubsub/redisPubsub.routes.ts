import { Router } from 'express';
import { publish, subscribe, channels, latest } from './redisPubsub.controller';

const router = Router();

// POST /api/v1/redis/publish — Publish message to channel
router.post('/publish', publish);

// GET /api/v1/redis/subscribe/:channel — SSE real-time subscribe
router.get('/subscribe/:channel', subscribe);

// GET /api/v1/redis/channels — List active channels
router.get('/channels', channels);

// GET /api/v1/redis/latest — Get latest real-time meter readings
router.get('/latest', latest);

export default router;