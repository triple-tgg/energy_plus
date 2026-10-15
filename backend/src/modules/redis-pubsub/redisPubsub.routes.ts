import { Router } from 'express';
import { publish, subscribe, channels, latest, realtimeHistory, realtimeAlerts, meterRealtimeHistory } from './redisPubsub.controller';
import { harmonicsHistory, powerQualityLatest, powerQualitySources, thdHistory } from './powerQuality.controller';
import {
    discoveryIgnore, discoveryLink, discoveryList, discoveryMeters, discoverySample, discoverySummary, discoveryUnlink,
} from './discovery.controller';
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
router.get('/meter-history', authenticate, enforceSiteAccess, meterRealtimeHistory);
router.get('/alerts', authenticate, enforceSiteAccess, realtimeAlerts);

// Power quality (Harmonic dashboard): THD, max demand, HD33 harmonic spectra
router.get('/power-quality/sources', authenticate, powerQualitySources);
router.get('/power-quality/latest', authenticate, powerQualityLatest);
router.get('/power-quality/harmonics-history', authenticate, harmonicsHistory);
router.get('/power-quality/thd-history', authenticate, thdHistory);

// Channel auto-discovery (admin): channels seen on Redis, link them to meters to start ingest
router.get('/discovery', authenticate, requireRole('admin'), discoveryList);
router.get('/discovery/summary', authenticate, requireRole('admin'), discoverySummary);
router.get('/discovery/sample', authenticate, requireRole('admin'), discoverySample);
router.get('/discovery/meters', authenticate, requireRole('admin'), discoveryMeters);
router.post('/discovery/link', authenticate, requireRole('admin'), discoveryLink);
router.post('/discovery/unlink', authenticate, requireRole('admin'), discoveryUnlink);
router.post('/discovery/ignore', authenticate, requireRole('admin'), discoveryIgnore);

export default router;
