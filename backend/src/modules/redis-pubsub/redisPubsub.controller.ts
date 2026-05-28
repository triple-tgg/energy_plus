import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../../utils/response';
import {
    subscribeChannel,
    publishMessage,
    getActiveChannels,
    getDefaultChannel,
} from './redisPubsub.service';

/**
 * POST /publish
 * Body: { channel?: string, message: string }
 * Publish a message to a Redis channel
 */
export const publish = async (req: Request, res: Response): Promise<void> => {
    try {
        const { channel, message } = req.body;
        const targetChannel = channel || getDefaultChannel();

        if (!message) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'message is required'));
            return;
        }

        const payload = typeof message === 'string' ? message : JSON.stringify(message);
        const receivers = await publishMessage(targetChannel, payload);

        res.json(successResponse({
            channel: targetChannel,
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
        const channel = req.params.channel || getDefaultChannel();

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
            defaultChannel: getDefaultChannel(),
            count: activeChannels.length,
        }));
    } catch (error: any) {
        console.error('Channels error:', error);
        res.status(500).json(errorResponse('CHANNELS_ERROR', error.message));
    }
};
