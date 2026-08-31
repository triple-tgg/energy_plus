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
export const getRealtimeAlerts = async (filters?: { siteId?: number; buildingId?: number; floor?: string; zoneId?: number }): Promise<any[]> => {
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
    if (filters?.floor !== undefined && filters?.floor !== '') { params.push(filters.floor); filtersSql.push(`m.floor::text = $${params.length}::text`); }
    if (filters?.zoneId) { params.push(filters.zoneId); filtersSql.push(`m.zone_id = $${params.length}`); }

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
export const getLatestRealtimeData = async (filters?: { siteId?: number; buildingId?: number; floor?: string; zoneId?: number }): Promise<any[]> => {
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
    if (filters?.floor !== undefined && filters?.floor !== '') {
        params.push(filters.floor);
        whereClause += ` AND m.floor::text = $${params.length}::text`;
    }
    if (filters?.zoneId) {
        params.push(filters.zoneId);
        whereClause += ` AND m.zone_id = $${params.length}`;
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
            ORDER BY r.site_id, r.address_id, r.device_datetime DESC
        ),
        latest_nonzero_realtime AS (
            SELECT DISTINCT ON (r.site_id, r.address_id)
                r.site_id AS realtime_site_id, r.address_id AS realtime_address_id,
                r.device_datetime AS last_nonzero_datetime,
                r.received_at AS last_nonzero_received_at
            FROM meter_data_realtime r
            WHERE COALESCE(r.vl1,0) > 0 OR COALESCE(r.vl2,0) > 0 OR COALESCE(r.vl3,0) > 0
               OR COALESCE(r.il1,0) > 0 OR COALESCE(r.il2,0) > 0 OR COALESCE(r.il3,0) > 0
               OR COALESCE(r.kw_3ph,0) > 0 OR COALESCE(r.kva_3ph,0) > 0
               OR COALESCE(r.hz,0) > 0 OR COALESCE(r.import_kwhr,0) > 0
            ORDER BY r.site_id, r.address_id, r.device_datetime DESC
        ),
        latest_nonzero_actual AS (
            SELECT DISTINCT ON (d.meter_id)
                d.meter_id,
                d.date_keep AS last_actual_nonzero_datetime
            FROM actual_meter_data d
            WHERE COALESCE(d.energy_kwh, 0) > 0
               OR COALESCE(d.energy_kw, 0) > 0
               OR COALESCE(d.energy_volt_p1, 0) > 0
               OR COALESCE(d.energy_amp1, 0) > 0
            ORDER BY d.meter_id, d.date_keep DESC
        )
        SELECT
            m.meter_id, m.meter_code, m.meter_name, m.room_code, m.room_name,
            m.site_id, m.building_id, m.zone_id, m.floor, m.loop_id,
            m.status AS meter_status, m.is_active,
            m.meter_type_id, mt.meter_type_name, mt.icon_name,
            s.site_name,
            b.building_name,
            z.zone_name,
            lr.id, lr.channel, lr.device, lr.code, lr.type,
            lr.vl1, lr.vl2, lr.vl3, lr.vl12, lr.vl23, lr.vl31,
            lr.il1, lr.il2, lr.il3,
            lr.kw1, lr.kw2, lr.kw3, lr.kw_3ph,
            lr.kvar1, lr.kvar2, lr.kvar3, lr.kvar_3ph,
            lr.kva1, lr.kva2, lr.kva3, lr.kva_3ph,
            lr.pf1, lr.pf2, lr.pf3,
            lr.hz, lr.import_kwhr,
            lr.device_datetime, lr.received_at,
            COALESCE(
                CASE WHEN (
                    COALESCE(lr.vl1,0) > 0 OR COALESCE(lr.vl2,0) > 0 OR COALESCE(lr.vl3,0) > 0
                    OR COALESCE(lr.il1,0) > 0 OR COALESCE(lr.il2,0) > 0 OR COALESCE(lr.il3,0) > 0
                    OR COALESCE(lr.kw_3ph,0) > 0 OR COALESCE(lr.kva_3ph,0) > 0
                    OR COALESCE(lr.hz,0) > 0 OR COALESCE(lr.import_kwhr,0) > 0
                ) THEN lr.device_datetime
                ELSE lnr.last_nonzero_datetime
                END,
                lna.last_actual_nonzero_datetime
            ) AS last_nonzero_datetime,
            COALESCE(
                CASE WHEN (
                    COALESCE(lr.vl1,0) > 0 OR COALESCE(lr.vl2,0) > 0 OR COALESCE(lr.vl3,0) > 0
                    OR COALESCE(lr.il1,0) > 0 OR COALESCE(lr.il2,0) > 0 OR COALESCE(lr.il3,0) > 0
                    OR COALESCE(lr.kw_3ph,0) > 0 OR COALESCE(lr.kva_3ph,0) > 0
                    OR COALESCE(lr.hz,0) > 0 OR COALESCE(lr.import_kwhr,0) > 0
                ) THEN lr.received_at
                ELSE lnr.last_nonzero_received_at
                END,
                lna.last_actual_nonzero_datetime
            ) AS last_nonzero_received_at,
            CASE WHEN COALESCE(lr.vl1,0)=0 AND COALESCE(lr.vl2,0)=0 AND COALESCE(lr.vl3,0)=0
                  AND COALESCE(lr.il1,0)=0 AND COALESCE(lr.il2,0)=0 AND COALESCE(lr.il3,0)=0
                  AND COALESCE(lr.kw_3ph,0)=0 AND COALESCE(lr.kva_3ph,0)=0
                  AND COALESCE(lr.hz,0)=0 AND COALESCE(lr.import_kwhr,0)=0
                 THEN true ELSE false
            END AS is_all_zero
        FROM meter m
        LEFT JOIN realtime_meter_map rmm
            ON rmm.meter_id = m.meter_id
           AND rmm.is_active = true
        LEFT JOIN latest_readings lr
            ON (rmm.id IS NOT NULL AND lr.realtime_site_id = rmm.realtime_site_id AND lr.realtime_address_id = rmm.realtime_address_id)
            OR (rmm.id IS NULL AND lr.realtime_site_id = m.site_el AND lr.realtime_address_id::text = m.address::text)
        LEFT JOIN latest_nonzero_realtime lnr
            ON (rmm.id IS NOT NULL AND lnr.realtime_site_id = rmm.realtime_site_id AND lnr.realtime_address_id = rmm.realtime_address_id)
            OR (rmm.id IS NULL AND lnr.realtime_site_id = m.site_el AND lnr.realtime_address_id::text = m.address::text)
        LEFT JOIN latest_nonzero_actual lna
            ON lna.meter_id = m.meter_id
        LEFT JOIN meter_type mt ON m.meter_type_id = mt.meter_type_id
        LEFT JOIN sites s ON m.site_id = s.site_id
        LEFT JOIN buildings b ON m.building_id = b.building_id
        LEFT JOIN zones z ON m.zone_id = z.zone_id
        WHERE m.is_active IS DISTINCT FROM false
            ${whereClause}
        ORDER BY s.site_name, b.building_name, COALESCE(m.floor, '0'), m.meter_code`,
        params
    );
    return result.rows;
};

/**
 * Get realtime history data for chart display.
 * Returns time-bucketed aggregated data from meter_data_realtime
 * for the last N minutes (default 1440 minutes / 24h).
 */
export const getRealtimeHistory = async (filters?: {
    minutes?: number;
    siteId?: number;
    buildingId?: number;
    floor?: string;
    zoneId?: number;
}): Promise<any[]> => {
    const minutes = filters?.minutes || 1440;
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
    if (filters?.floor !== undefined && filters?.floor !== '') {
        params.push(filters.floor);
        whereClause += ` AND m.floor::text = $${params.length}::text`;
    }
    if (filters?.zoneId) {
        params.push(filters.zoneId);
        whereClause += ` AND m.zone_id = $${params.length}`;
    }

    // Try actual_meter_data first (15-min summary logs)
    const actualResult = await pool.query(
        `SELECT
            to_char(d.date_keep AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD"T"HH24:MI:SS') AS t,
            to_char(d.date_keep AT TIME ZONE 'Asia/Bangkok', 'HH24:MI') AS time,
            m.meter_id, m.meter_code, m.meter_name, m.room_code,
            ROUND(COALESCE(d.energy_kw, 0)::numeric, 2)::float AS kw_3ph,
            ROUND(COALESCE(d.energy_kva, 0)::numeric, 2)::float AS kva_3ph,
            ROUND(COALESCE(d.energy_volt_p1, 0)::numeric, 1)::float AS vl1,
            ROUND(COALESCE(d.energy_volt_p2, 0)::numeric, 1)::float AS vl2,
            ROUND(COALESCE(d.energy_volt_p3, 0)::numeric, 1)::float AS vl3,
            ROUND(COALESCE(d.energy_amp1, 0)::numeric, 2)::float AS il1,
            ROUND(COALESCE(d.energy_amp2, 0)::numeric, 2)::float AS il2,
            ROUND(COALESCE(d.energy_amp3, 0)::numeric, 2)::float AS il3,
            ROUND(COALESCE(d.energy_pf1, 0)::numeric, 3)::float AS pf1,
            ROUND(COALESCE(d.energy_pf2, 0)::numeric, 3)::float AS pf2,
            ROUND(COALESCE(d.energy_pf3, 0)::numeric, 3)::float AS pf3,
            CASE 
                WHEN COALESCE(d.energy_volt_p2, 0) = 0 AND COALESCE(d.energy_volt_p3, 0) = 0 THEN ROUND(COALESCE(d.energy_volt_p1, 0)::numeric, 1)::float
                ELSE ROUND(((COALESCE(d.energy_volt_p1, 0) + COALESCE(d.energy_volt_p2, 0) + COALESCE(d.energy_volt_p3, 0)) / 3.0)::numeric, 1)::float
            END AS avg_voltage,
            CASE
                WHEN COALESCE(d.energy_amp2, 0) = 0 AND COALESCE(d.energy_amp3, 0) = 0 THEN ROUND(COALESCE(d.energy_amp1, 0)::numeric, 2)::float
                ELSE ROUND(((COALESCE(d.energy_amp1, 0) + COALESCE(d.energy_amp2, 0) + COALESCE(d.energy_amp3, 0)) / 3.0)::numeric, 2)::float
            END AS avg_current,
            CASE
                WHEN COALESCE(d.energy_pf2, 0) = 0 AND COALESCE(d.energy_pf3, 0) = 0 THEN ROUND(COALESCE(d.energy_pf1, 0)::numeric, 3)::float
                ELSE ROUND(((COALESCE(d.energy_pf1, 0) + COALESCE(d.energy_pf2, 0) + COALESCE(d.energy_pf3, 0)) / 3.0)::numeric, 3)::float
            END AS avg_pf,
            ROUND(COALESCE(d.energy_frequency, 0)::numeric, 2)::float AS hz,
            1 AS readings
        FROM actual_meter_data d
        JOIN meter m ON m.meter_id = d.meter_id
        WHERE m.is_active IS DISTINCT FROM false
          AND d.date_keep >= NOW() - ($1 || ' minutes')::interval
          ${whereClause}
        ORDER BY d.date_keep ASC, m.meter_code`,
        params
    );

    if (actualResult.rows.length > 0) {
        return actualResult.rows;
    }

    // Fallback: Aggregate meter_data_realtime into 15-minute summary buckets (900 seconds)
    const result = await pool.query(
        `WITH mapped_readings AS (
            SELECT
                to_timestamp(floor(extract(epoch from r.received_at) / 900) * 900) AS bucket,
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
            to_char(mr.bucket AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD"T"HH24:MI:SS') AS t,
            to_char(mr.bucket AT TIME ZONE 'Asia/Bangkok', 'HH24:MI') AS time,
            m.meter_id, m.meter_code, m.meter_name, m.room_code,
            ROUND(AVG(mr.kw_3ph)::numeric, 2)::float AS kw_3ph,
            ROUND(AVG(mr.kva_3ph)::numeric, 2)::float AS kva_3ph,
            ROUND(AVG(mr.vl1)::numeric, 1)::float AS vl1,
            ROUND(AVG(mr.vl2)::numeric, 1)::float AS vl2,
            ROUND(AVG(mr.vl3)::numeric, 1)::float AS vl3,
            ROUND(AVG(mr.il1)::numeric, 2)::float AS il1,
            ROUND(AVG(mr.il2)::numeric, 2)::float AS il2,
            ROUND(AVG(mr.il3)::numeric, 2)::float AS il3,
            ROUND(AVG(mr.pf1)::numeric, 3)::float AS pf1,
            ROUND(AVG(mr.pf2)::numeric, 3)::float AS pf2,
            ROUND(AVG(mr.pf3)::numeric, 3)::float AS pf3,
            CASE 
                WHEN AVG(mr.vl2) = 0 AND AVG(mr.vl3) = 0 THEN ROUND(AVG(mr.vl1)::numeric, 1)::float
                ELSE ROUND(AVG((mr.vl1 + mr.vl2 + mr.vl3) / 3.0)::numeric, 1)::float
            END AS avg_voltage,
            CASE
                WHEN AVG(mr.il2) = 0 AND AVG(mr.il3) = 0 THEN ROUND(AVG(mr.il1)::numeric, 2)::float
                ELSE ROUND(AVG((mr.il1 + mr.il2 + mr.il3) / 3.0)::numeric, 2)::float
            END AS avg_current,
            CASE
                WHEN AVG(mr.pf2) = 0 AND AVG(mr.pf3) = 0 THEN ROUND(AVG(mr.pf1)::numeric, 3)::float
                ELSE ROUND(AVG((mr.pf1 + mr.pf2 + mr.pf3) / 3.0)::numeric, 3)::float
            END AS avg_pf,
            ROUND(AVG(mr.hz)::numeric, 2)::float AS hz,
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

/**
 * Get 15-minute interval summary history for a specific meter.
 * Fetches 15-minute log records from actual_meter_data or aggregates from meter_data_realtime.
 */
export const getMeterRealtimeHistory = async (filters: {
    meterId: number;
    minutes?: number;
}): Promise<any[]> => {
    const minutes = filters.minutes || 1440;
    const params: any[] = [minutes, filters.meterId];

    // 1. Check actual_meter_data for official 15-minute summary intervals
    const actualResult = await pool.query(
        `SELECT
            to_char(d.date_keep AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD"T"HH24:MI:SS') AS t,
            to_char(d.date_keep AT TIME ZONE 'Asia/Bangkok', 'HH24:MI') AS time,
            to_char(d.date_keep AT TIME ZONE 'Asia/Bangkok', 'DD/MM HH24:MI') AS full_time,
            ROUND(COALESCE(d.energy_kw, 0)::numeric, 2)::float AS kw_3ph,
            ROUND(COALESCE(d.energy_kva, 0)::numeric, 2)::float AS kva_3ph,
            ROUND(COALESCE(d.energy_kvar, 0)::numeric, 2)::float AS kvar_3ph,
            ROUND(COALESCE(d.energy_volt_p1, 0)::numeric, 1)::float AS vl1,
            ROUND(COALESCE(d.energy_volt_p2, 0)::numeric, 1)::float AS vl2,
            ROUND(COALESCE(d.energy_volt_p3, 0)::numeric, 1)::float AS vl3,
            ROUND(((COALESCE(d.energy_volt_p1, 0) + COALESCE(d.energy_volt_p2, 0) + COALESCE(d.energy_volt_p3, 0)) / 3.0)::numeric, 1)::float AS avg_voltage,
            ROUND(COALESCE(d.energy_volt_l1, 0)::numeric, 1)::float AS vl12,
            ROUND(COALESCE(d.energy_volt_l2, 0)::numeric, 1)::float AS vl23,
            ROUND(COALESCE(d.energy_volt_l3, 0)::numeric, 1)::float AS vl31,
            ROUND(COALESCE(d.energy_amp1, 0)::numeric, 2)::float AS il1,
            ROUND(COALESCE(d.energy_amp2, 0)::numeric, 2)::float AS il2,
            ROUND(COALESCE(d.energy_amp3, 0)::numeric, 2)::float AS il3,
            ROUND(((COALESCE(d.energy_amp1, 0) + COALESCE(d.energy_amp2, 0) + COALESCE(d.energy_amp3, 0)) / 3.0)::numeric, 2)::float AS avg_current,
            ROUND(COALESCE(d.energy_pf1, 0)::numeric, 3)::float AS pf1,
            ROUND(COALESCE(d.energy_pf2, 0)::numeric, 3)::float AS pf2,
            ROUND(COALESCE(d.energy_pf3, 0)::numeric, 3)::float AS pf3,
            ROUND(((COALESCE(d.energy_pf1, 0) + COALESCE(d.energy_pf2, 0) + COALESCE(d.energy_pf3, 0)) / 3.0)::numeric, 3)::float AS avg_pf,
            ROUND(COALESCE(d.energy_frequency, 0)::numeric, 2)::float AS hz,
            ROUND(COALESCE(d.energy_kwh, 0)::numeric, 1)::float AS import_kwhr,
            1 AS readings
        FROM actual_meter_data d
        WHERE d.meter_id = $2
          AND d.date_keep >= NOW() - ($1 || ' minutes')::interval
        ORDER BY d.date_keep ASC`,
        params
    );

    if (actualResult.rows.length > 0) {
        return actualResult.rows;
    }

    // 2. Fallback: Aggregate readings into 15-minute summary intervals (900 seconds)
    const fallbackResult = await pool.query(
        `WITH mapped_readings AS (
            SELECT
                r.received_at,
                r.kw1, r.kw2, r.kw3, r.kw_3ph,
                r.kva1, r.kva2, r.kva3, r.kva_3ph,
                r.kvar1, r.kvar2, r.kvar3, r.kvar_3ph,
                r.vl1, r.vl2, r.vl3,
                r.vl12, r.vl23, r.vl31,
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
              AND COALESCE(rmm.meter_id, m_fallback.meter_id) = $2
        )
        SELECT
            to_char((to_timestamp(floor(extract(epoch from mr.received_at) / 900) * 900)) AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD"T"HH24:MI:SS') AS t,
            to_char((to_timestamp(floor(extract(epoch from mr.received_at) / 900) * 900)) AT TIME ZONE 'Asia/Bangkok', 'HH24:MI') AS time,
            to_char((to_timestamp(floor(extract(epoch from mr.received_at) / 900) * 900)) AT TIME ZONE 'Asia/Bangkok', 'DD/MM HH24:MI') AS full_time,
            ROUND(AVG(mr.kw_3ph)::numeric, 2)::float AS kw_3ph,
            ROUND(AVG(mr.kw1)::numeric, 2)::float AS kw1,
            ROUND(AVG(mr.kw2)::numeric, 2)::float AS kw2,
            ROUND(AVG(mr.kw3)::numeric, 2)::float AS kw3,
            ROUND(AVG(mr.kva_3ph)::numeric, 2)::float AS kva_3ph,
            ROUND(AVG(mr.kva1)::numeric, 2)::float AS kva1,
            ROUND(AVG(mr.kva2)::numeric, 2)::float AS kva2,
            ROUND(AVG(mr.kva3)::numeric, 2)::float AS kva3,
            ROUND(AVG(mr.kvar_3ph)::numeric, 2)::float AS kvar_3ph,
            ROUND(AVG(mr.kvar1)::numeric, 2)::float AS kvar1,
            ROUND(AVG(mr.kvar2)::numeric, 2)::float AS kvar2,
            ROUND(AVG(mr.kvar3)::numeric, 2)::float AS kvar3,
            ROUND(AVG(mr.vl1)::numeric, 1)::float AS vl1,
            ROUND(AVG(mr.vl2)::numeric, 1)::float AS vl2,
            ROUND(AVG(mr.vl3)::numeric, 1)::float AS vl3,
            ROUND(AVG((mr.vl1 + mr.vl2 + mr.vl3) / 3.0)::numeric, 1)::float AS avg_voltage,
            ROUND(AVG(mr.vl12)::numeric, 1)::float AS vl12,
            ROUND(AVG(mr.vl23)::numeric, 1)::float AS vl23,
            ROUND(AVG(mr.vl31)::numeric, 1)::float AS vl31,
            ROUND(AVG(mr.il1)::numeric, 2)::float AS il1,
            ROUND(AVG(mr.il2)::numeric, 2)::float AS il2,
            ROUND(AVG(mr.il3)::numeric, 2)::float AS il3,
            ROUND(AVG((mr.il1 + mr.il2 + mr.il3) / 3.0)::numeric, 2)::float AS avg_current,
            ROUND(AVG(mr.pf1)::numeric, 3)::float AS pf1,
            ROUND(AVG(mr.pf2)::numeric, 3)::float AS pf2,
            ROUND(AVG(mr.pf3)::numeric, 3)::float AS pf3,
            ROUND(AVG((mr.pf1 + mr.pf2 + mr.pf3) / 3.0)::numeric, 3)::float AS avg_pf,
            ROUND(AVG(mr.hz)::numeric, 2)::float AS hz,
            ROUND(MAX(mr.import_kwhr)::numeric, 1)::float AS import_kwhr,
            COUNT(*)::int AS readings
        FROM mapped_readings mr
        GROUP BY to_timestamp(floor(extract(epoch from mr.received_at) / 900) * 900)
        ORDER BY t ASC`,
        params
    );

    return fallbackResult.rows;
};

