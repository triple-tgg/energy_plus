import { Response } from 'express';
import { pubClient, subClient, DEFAULT_CHANNEL, AUTO_SUBSCRIBE } from '../../config/redis';
import pool from '../../config/database';

// Track SSE clients per channel
const sseClientsMap: Map<string, Set<Response>> = new Map();

/**
 * Subscribe to a Redis channel and register an SSE client
 */
export const subscribeChannel = async (channel: string, res: Response): Promise<void> => {
    // Initialize client set for this channel if needed
    if (!sseClientsMap.has(channel)) {
        sseClientsMap.set(channel, new Set());

        // Subscribe to Redis channel (only once per channel)
        await subClient.subscribe(channel, (message) => {
            const data = `data: ${JSON.stringify({ channel, message })}\n\n`;
            const clients = sseClientsMap.get(channel);
            if (clients) {
                for (const client of clients) {
                    client.write(data);
                }
            }
        });
        console.log(`📡 Redis subscribed to channel: ${channel}`);
    }

    // Add this SSE client
    const clients = sseClientsMap.get(channel)!;
    clients.add(res);
    console.log(`📡 SSE client connected to channel: ${channel} (total: ${clients.size})`);

    // Cleanup when client disconnects
    res.on('close', () => {
        clients.delete(res);
        console.log(`❌ SSE client disconnected from: ${channel} (remaining: ${clients.size})`);

        // Optionally unsubscribe if no more clients
        if (clients.size === 0) {
            subClient.unsubscribe(channel).catch(() => {});
            sseClientsMap.delete(channel);
            console.log(`🔕 Unsubscribed from channel: ${channel} (no more clients)`);
        }
    });
};

/**
 * Publish a message to a Redis channel
 */
export const publishMessage = async (channel: string, message: string): Promise<number> => {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    const receivers = await pubClient.publish(channel, payload);
    return receivers;
};

/**
 * Get list of active channels (channels that have subscribers)
 */
export const getActiveChannels = async (): Promise<string[]> => {
    const channels = await pubClient.sendCommand(['PUBSUB', 'CHANNELS', '*']);
    if (Array.isArray(channels)) {
        return channels as string[];
    }
    return channels ? [String(channels)] : [];
};

/**
 * Get default channel name
 */
export const getDefaultChannel = (): string => {
    return DEFAULT_CHANNEL;
};

/**
 * Check if auto-subscribe is enabled
 */
export const isAutoSubscribeEnabled = (): boolean => {
    return AUTO_SUBSCRIBE;
};

/**
 * Save meter data from Redis message to database
 */
const saveMeterDataToDb = async (channel: string, message: string): Promise<void> => {
    try {
        const data = JSON.parse(message);

        await pool.query(
            `INSERT INTO meter_data_realtime (
                channel, site_id, address_id, device, code, type,
                vl1, vl2, vl3, vl12, vl23, vl31,
                il1, il2, il3,
                kw1, kw2, kw3, kw_3ph,
                kvar1, kvar2, kvar3, kvar_3ph,
                kva1, kva2, kva3, kva_3ph,
                pf1, pf2, pf3,
                hz, import_kwhr,
                device_datetime, raw_json
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10, $11, $12,
                $13, $14, $15,
                $16, $17, $18, $19,
                $20, $21, $22, $23,
                $24, $25, $26, $27,
                $28, $29, $30,
                $31, $32,
                $33, $34
            )`,
            [
                channel,
                data.siteID ?? null,
                data.addressID ?? null,
                data.device ?? null,
                data.code ?? null,
                data.type ?? null,
                data.VL1 ?? 0, data.VL2 ?? 0, data.VL3 ?? 0,
                data.VL12 ?? 0, data.VL23 ?? 0, data.VL31 ?? 0,
                data.IL1 ?? 0, data.IL2 ?? 0, data.IL3 ?? 0,
                data.KW1 ?? 0, data.KW2 ?? 0, data.KW3 ?? 0, data.KW_3Ph ?? 0,
                data.KVar1 ?? 0, data.KVar2 ?? 0, data.KVar3 ?? 0, data.KVar_3Ph ?? 0,
                data.KVA1 ?? 0, data.KVA2 ?? 0, data.KVA3 ?? 0, data.KVA_3Ph ?? 0,
                data.PF1 ?? 0, data.PF2 ?? 0, data.PF3 ?? 0,
                data.Hz ?? 0,
                data.Import_KWhr ?? 0,
                data.datetime ? new Date(data.datetime) : new Date(),
                JSON.stringify(data),
            ]
        );
    } catch (error: any) {
        console.error('❌ Failed to save meter data to DB:', error.message);
    }
};

/**
 * Auto-subscribe to the default channel on server startup.
 * Messages will be saved to database and broadcast to SSE clients.
 * Called from server.ts if REDIS_AUTO_SUBSCRIBE=true
 */
export const autoSubscribeDefaultChannel = async (): Promise<void> => {
    const channel = DEFAULT_CHANNEL;

    // Ensure the channel entry exists in the map
    if (!sseClientsMap.has(channel)) {
        sseClientsMap.set(channel, new Set());
    }

    // Subscribe to Redis — save to DB + broadcast to SSE clients
    await subClient.subscribe(channel, async (message) => {
        // 1. Save to database
        await saveMeterDataToDb(channel, message);

        // 2. Broadcast to SSE clients
        const data = `data: ${JSON.stringify({ channel, message })}\n\n`;
        const clients = sseClientsMap.get(channel);
        if (clients) {
            for (const client of clients) {
                client.write(data);
            }
        }
    });

    console.log(`📡 Auto-subscribed to default channel: ${channel} (with DB save)`);
};
