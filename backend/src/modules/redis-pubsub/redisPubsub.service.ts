import { Response } from 'express';
import { pubClient, subClient, REDIS_ENABLED } from '../../config/redis';
import pool from '../../config/database';

// Track SSE clients per channel
const sseClientsMap: Map<string, Set<Response>> = new Map();
const subscribedChannels = new Set<string>();
const meterChannels = new Set<string>();
let syncPromise: Promise<void> | null = null;

const handleRedisMessage = (channel: string) => async (message: string): Promise<void> => {
    if (meterChannels.has(channel)) {
        await saveMeterDataToDb(channel, message);
    }

    const data = `data: ${JSON.stringify({ channel, message })}\n\n`;
    const clients = sseClientsMap.get(channel);
    if (clients) {
        for (const client of clients) {
            client.write(data);
        }
    }
};

const ensureRedisSubscription = async (channel: string): Promise<void> => {
    if (subscribedChannels.has(channel)) return;
    await subClient.subscribe(channel, handleRedisMessage(channel));
    subscribedChannels.add(channel);
    console.log(`📡 Redis subscribed to channel: ${channel}`);
};

/**
 * Subscribe to a Redis channel and register an SSE client
 */
export const subscribeChannel = async (channel: string, res: Response): Promise<void> => {
    // Initialize client set for this channel if needed
    if (!sseClientsMap.has(channel)) {
        sseClientsMap.set(channel, new Set());
    }
    await ensureRedisSubscription(channel);

    // Add this SSE client
    const clients = sseClientsMap.get(channel)!;
    clients.add(res);
    console.log(`📡 SSE client connected to channel: ${channel} (total: ${clients.size})`);

    // Cleanup when client disconnects
    res.on('close', () => {
        clients.delete(res);
        console.log(`❌ SSE client disconnected from: ${channel} (remaining: ${clients.size})`);

        // Keep meter channels subscribed even when the last SSE client disconnects.
        if (clients.size === 0 && !meterChannels.has(channel)) {
            subClient.unsubscribe(channel).then(() => {
                subscribedChannels.delete(channel);
            }).catch(() => {});
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

/** Latest unacknowledged alarms for the realtime monitoring panel. */
export const getRealtimeAlerts = async (filters?: { siteId?: number; buildingId?: number }): Promise<any[]> => {
    await pool.query(`CREATE TABLE IF NOT EXISTS alarm_log (
        id BIGSERIAL PRIMARY KEY,
        alarm_config_id INTEGER REFERENCES alarm_config(alarm_config_id),
        meter_id INTEGER REFERENCES meter(meter_id),
        alarm_type VARCHAR(100),
        message TEXT NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        acknowledged BOOLEAN NOT NULL DEFAULT false,
        acknowledged_at TIMESTAMPTZ,
        acknowledged_by VARCHAR(255),
        resolved_at TIMESTAMPTZ,
        resolved_by VARCHAR(255),
        metadata JSONB
    )`);

    const params: any[] = [];
    const filtersSql = ['al.acknowledged = false', 'm.is_active = true'];
    if (filters?.siteId) { params.push(filters.siteId); filtersSql.push(`m.site_id = $${params.length}`); }
    if (filters?.buildingId) { params.push(filters.buildingId); filtersSql.push(`m.building_id = $${params.length}`); }

    const result = await pool.query(
        `SELECT al.id, al.message, al.alarm_type, al.occurred_at, al.meter_id,
                m.meter_code, m.meter_name
         FROM alarm_log al
         JOIN meter m ON m.meter_id = al.meter_id
         WHERE ${filtersSql.join(' AND ')}
         ORDER BY al.occurred_at DESC, al.id DESC
         LIMIT 20`,
        params
    );
    return result.rows;
};




/**
 * Save meter data from Redis message to database
 */
const saveMeterDataToDb = async (channel: string, message: string): Promise<void> => {
    try {
        const data = JSON.parse(message);
        const dataChannel = data.channel ?? data.Channel ?? channel;

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
                dataChannel,
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
 * Auto-subscribe to channels derived from the Meter table on server startup.
 * Reads all active meters' site_el + address, builds channel names like "1000_1",
 * and subscribes to each unique channel.
 * Messages will be saved to database and broadcast to SSE clients.
 * Called from server.ts if REDIS_AUTO_SUBSCRIBE=true
 */
export const syncMeterSubscriptions = async (): Promise<void> => {
    if (!REDIS_ENABLED || !subClient.isReady) return;
    if (syncPromise) return syncPromise;

    syncPromise = (async () => {
        const result = await pool.query(
            `SELECT DISTINCT m.site_el, m.address
             FROM meter m
             JOIN sites s ON s.site_id = m.site_id
             WHERE m.site_el IS NOT NULL
               AND m.address IS NOT NULL
               AND m.is_active = true
               AND s.site_status = true
             ORDER BY m.site_el, m.address`
        );
        const desired = new Set<string>(
            result.rows.map((row: any) => `${row.site_el}_${row.address}`)
        );

        const added = [...desired].filter((channel) => !meterChannels.has(channel));
        const removed = [...meterChannels].filter((channel) => !desired.has(channel));

        // Mark first so messages arriving immediately after SUBSCRIBE are persisted.
        added.forEach((channel) => meterChannels.add(channel));
        for (const channel of added) {
            try {
                await ensureRedisSubscription(channel);
            } catch (error) {
                meterChannels.delete(channel);
                throw error;
            }
        }

        for (const channel of removed) {
            meterChannels.delete(channel);
            const hasSseClients = (sseClientsMap.get(channel)?.size ?? 0) > 0;
            if (!hasSseClients && subscribedChannels.has(channel)) {
                await subClient.unsubscribe(channel);
                subscribedChannels.delete(channel);
                sseClientsMap.delete(channel);
            }
        }

        if (added.length || removed.length) {
            console.log(`📡 Meter subscriptions synced (+${added.length}, -${removed.length}, total ${meterChannels.size})`);
        }
    })().finally(() => {
        syncPromise = null;
    });

    return syncPromise;
};

export const autoSubscribeFromMeterTable = syncMeterSubscriptions;

/**
 * Get the latest reading for each meter from meter_data_realtime,
 * enriched with meter metadata (name, location, site, building, zone)
 * via realtime_meter_map + meter table.
 */
export const getLatestRealtimeData = async (filters?: { siteId?: number; buildingId?: number }): Promise<any[]> => {
    const params: any[] = [];
    let whereClause = '';

    if (filters?.siteId) {
        params.push(filters.siteId);
        whereClause += ` AND m.site_id = $${params.length}`;
    }
    if (filters?.buildingId) {
        params.push(filters.buildingId);
        whereClause += ` AND m.building_id = $${params.length}`;
    }

    const result = await pool.query(
        `WITH latest_readings AS (
            SELECT DISTINCT ON (r.site_id, r.address_id)
                r.id, r.channel, r.site_id AS realtime_site_id, r.address_id AS realtime_address_id,
                r.device, r.code, r.type,
                r.vl1, r.vl2, r.vl3, r.vl12, r.vl23, r.vl31,
                r.il1, r.il2, r.il3,
                r.kw1, r.kw2, r.kw3, r.kw_3ph,
                r.kvar1, r.kvar2, r.kvar3, r.kvar_3ph,
                r.kva1, r.kva2, r.kva3, r.kva_3ph,
                r.pf1, r.pf2, r.pf3,
                r.hz, r.import_kwhr,
                r.device_datetime, r.received_at
            FROM meter_data_realtime r
            WHERE r.received_at >= NOW() - INTERVAL '24 hours'
            ORDER BY r.site_id, r.address_id, r.device_datetime DESC
        )
        SELECT
            lr.*,
            m.meter_id, m.meter_code, m.meter_name, m.room_code, m.room_name,
            m.site_id, m.building_id, m.zone_id, m.floor, m.loop_id,
            m.status AS meter_status, m.is_active,
            m.meter_type_id, mt.meter_type_name, mt.icon_name,
            s.site_name,
            b.building_name,
            z.zone_name,
            CASE WHEN COALESCE(lr.vl1,0)=0 AND COALESCE(lr.vl2,0)=0 AND COALESCE(lr.vl3,0)=0
                  AND COALESCE(lr.il1,0)=0 AND COALESCE(lr.il2,0)=0 AND COALESCE(lr.il3,0)=0
                  AND COALESCE(lr.kw_3ph,0)=0 AND COALESCE(lr.kva_3ph,0)=0
                  AND COALESCE(lr.hz,0)=0 AND COALESCE(lr.import_kwhr,0)=0
                 THEN true ELSE false
            END AS is_all_zero
        FROM latest_readings lr
        LEFT JOIN realtime_meter_map rmm
            ON rmm.realtime_site_id = lr.realtime_site_id
           AND rmm.realtime_address_id = lr.realtime_address_id
           AND rmm.is_active = true
        LEFT JOIN meter m_fallback
            ON m_fallback.site_el = lr.realtime_site_id
           AND m_fallback.address::text = lr.realtime_address_id::text
           AND rmm.id IS NULL
        JOIN meter m
            ON m.meter_id = COALESCE(rmm.meter_id, m_fallback.meter_id)
        LEFT JOIN meter_type mt ON m.meter_type_id = mt.meter_type_id
        LEFT JOIN sites s ON m.site_id = s.site_id
        LEFT JOIN buildings b ON m.building_id = b.building_id
        LEFT JOIN zones z ON m.zone_id = z.zone_id
        WHERE 1=1
            ${whereClause}
        ORDER BY s.site_name, b.building_name, COALESCE(m.floor, 0), m.meter_code`,
        params
    );
    return result.rows;
};

/**
 * Get realtime history data for chart display.
 * Returns time-bucketed aggregated data from meter_data_realtime
 * for the last N minutes (default 30).
 */
export const getRealtimeHistory = async (filters?: {
    minutes?: number;
    siteId?: number;
    buildingId?: number;
}): Promise<any[]> => {
    const minutes = filters?.minutes || 30;
    const params: any[] = [minutes];
    let whereClause = '';

    if (filters?.siteId) {
        params.push(filters.siteId);
        whereClause += ` AND m.site_id = $${params.length}`;
    }
    if (filters?.buildingId) {
        params.push(filters.buildingId);
        whereClause += ` AND m.building_id = $${params.length}`;
    }

    const result = await pool.query(
        `WITH mapped_readings AS (
            SELECT
                date_trunc('minute', r.received_at) AS bucket,
                COALESCE(rmm.meter_id, m_fallback.meter_id) AS meter_id,
                r.kw_3ph, r.kva_3ph, r.kvar_3ph,
                r.vl1, r.vl2, r.vl3,
                r.il1, r.il2, r.il3,
                r.pf1, r.pf2, r.pf3,
                r.hz, r.import_kwhr
            FROM meter_data_realtime r
            LEFT JOIN realtime_meter_map rmm
                ON rmm.realtime_site_id = r.site_id
               AND rmm.realtime_address_id = r.address_id
               AND rmm.is_active = true
               AND (rmm.channel IS NULL OR rmm.channel = r.channel)
            LEFT JOIN meter m_fallback
                ON m_fallback.site_el = r.site_id
               AND m_fallback.address::text = r.address_id::text
               AND rmm.id IS NULL
            WHERE r.received_at >= NOW() - ($1 || ' minutes')::interval
              AND COALESCE(rmm.meter_id, m_fallback.meter_id) IS NOT NULL
        )
        SELECT
            mr.bucket AS t,
            m.meter_id, m.meter_code, m.meter_name, m.room_code,
            AVG(mr.kw_3ph) AS kw_3ph,
            AVG(mr.kva_3ph) AS kva_3ph,
            AVG((mr.vl1 + mr.vl2 + mr.vl3) / 3.0) AS avg_voltage,
            AVG((mr.il1 + mr.il2 + mr.il3) / 3.0) AS avg_current,
            AVG((mr.pf1 + mr.pf2 + mr.pf3) / 3.0) AS avg_pf,
            AVG(mr.hz) AS hz,
            COUNT(*)::int AS readings
        FROM mapped_readings mr
        JOIN meter m ON m.meter_id = mr.meter_id
        WHERE m.is_active IS DISTINCT FROM false
            ${whereClause}
        GROUP BY mr.bucket, m.meter_id, m.meter_code, m.meter_name, m.room_code
        ORDER BY mr.bucket, m.meter_code`,
        params
    );
    return result.rows;
};
