import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../../utils/response';
import {
    subscribeChannel,
    publishMessage,
    getActiveChannels,
    getLatestRealtimeData,
    getRealtimeHistory,
    getRealtimeAlerts,
} from './redisPubsub.service';

/**
 * POST /publish
 * Body: { channel?: string, message: string }
 * Publish a message to a Redis channel
 */
export const publish = async (req: Request, res: Response): Promise<void> => {
    try {
        const { channel, message } = req.body;

        if (!channel) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'channel is required'));
            return;
        }

        if (!message) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'message is required'));
            return;
        }

        const payload = typeof message === 'string' ? message : JSON.stringify(message);
        const receivers = await publishMessage(channel, payload);

        res.json(successResponse({
            channel: channel,
            message: payload,
            receivers,
        }, 'Message published successfully'));
    } catch (error: any) {
        console.error('Publish error:', error);
        res.status(500).json(errorResponse('PUBLISH_ERROR', error.message));
    }
};

/**
 * GET /subscribe/:channel
 * SSE endpoint — real-time subscribe to a Redis channel
 */
export const subscribe = async (req: Request, res: Response): Promise<void> => {
    try {
        const channel = req.params.channel;

        if (!channel) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'channel parameter is required'));
            return;
        }

        // SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
        res.flushHeaders();

        // Send connected event
        res.write(`data: ${JSON.stringify({ event: 'connected', channel })}\n\n`);

        // Register this client for the channel
        await subscribeChannel(channel, res);
    } catch (error: any) {
        console.error('Subscribe error:', error);
        res.status(500).json(errorResponse('SUBSCRIBE_ERROR', error.message));
    }
};

/**
 * GET /channels
 * List all active Redis channels
 */
export const channels = async (req: Request, res: Response): Promise<void> => {
    try {
        const activeChannels = await getActiveChannels();
        res.json(successResponse({
            channels: activeChannels,
            count: activeChannels.length,
        }));
    } catch (error: any) {
        console.error('Channels error:', error);
        res.status(500).json(errorResponse('CHANNELS_ERROR', error.message));
    }
};

/**
 * GET /latest
 * Fetch the latest real-time reading for each meter from PostgreSQL,
 * enriched with meter metadata (name, site, building, zone).
 * Optional query params: siteId, buildingId
 */
export const latest = async (req: Request, res: Response): Promise<void> => {
    try {
        const siteId = req.query.siteId ? parseInt(req.query.siteId as string) : undefined;
        const buildingId = req.query.buildingId ? parseInt(req.query.buildingId as string) : undefined;
        const data = await getLatestRealtimeData({ siteId, buildingId });
        res.json(successResponse(data));
    } catch (error: any) {
        console.error('Latest real-time error:', error);
        res.status(500).json(errorResponse('LATEST_REALTIME_ERROR', error.message));
    }
};

/**
 * GET /history
 * Fetch time-bucketed realtime history data for chart display.
 * Optional query params: minutes (default 30), siteId, buildingId
 */
export const realtimeHistory = async (req: Request, res: Response): Promise<void> => {
    try {
        const minutes = req.query.minutes ? parseInt(req.query.minutes as string) : 30;
        const siteId = req.query.siteId ? parseInt(req.query.siteId as string) : undefined;
        const buildingId = req.query.buildingId ? parseInt(req.query.buildingId as string) : undefined;
        const data = await getRealtimeHistory({ minutes, siteId, buildingId });
        res.json(successResponse(data));
    } catch (error: any) {
        console.error('Realtime history error:', error);
        res.status(500).json(errorResponse('REALTIME_HISTORY_ERROR', error.message));
    }
};

/** GET /alerts — unacknowledged alarms for the realtime panel. */
export const realtimeAlerts = async (req: Request, res: Response): Promise<void> => {
    try {
        const siteId = req.query.siteId ? parseInt(req.query.siteId as string) : undefined;
        const buildingId = req.query.buildingId ? parseInt(req.query.buildingId as string) : undefined;
        res.json(successResponse(await getRealtimeAlerts({ siteId, buildingId })));
    } catch (error: any) {
        res.status(500).json(errorResponse('REALTIME_ALERTS_ERROR', error.message));
    }
};
