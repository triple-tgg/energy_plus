import pool from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { subClient } from '../../config/redis';
import { getDiscoveryRuntime } from './ingest/discovery';
import { supportedDatatypes } from './ingest/handlers';
import { syncMeterSubscriptions, toMeterKey } from './redisPubsub.service';

/** A channel with no message for this long is shown as offline. */
export const DISCOVERY_STALE_MINUTES = Math.max(1, parseInt(process.env.REDIS_DISCOVERY_STALE_MINUTES || '15', 10) || 15);
const NEW_WITHIN_HOURS = 24;
const BASE_RE = /^\d+_\d+$/;

interface MeterRow {
    meter_id: number;
    meter_code: string | null;
    meter_name: string | null;
    site_el: string | null;
    address: string | null;
    site_id: number | null;
    site_name: string | null;
    is_active: boolean;
    site_status: boolean | null;
    key: string | null;
}

const loadMeters = async (): Promise<MeterRow[]> => {
    const { rows } = await pool.query(
        `SELECT m.meter_id, m.meter_code, m.meter_name, m.site_el::text AS site_el, m.address::text AS address,
                m.site_id, m.is_active, s.site_name, s.site_status
         FROM meter m
         LEFT JOIN sites s ON s.site_id = m.site_id`
    );
    return rows.map((r) => ({ ...r, key: toMeterKey(r.site_el, r.address) }));
};

const meterView = (m: MeterRow, redisRunning: boolean) => ({
    meterId: m.meter_id,
    meterCode: m.meter_code,
    meterName: m.meter_name,
    siteId: m.site_id,
    siteName: m.site_name,
    siteEl: m.site_el,
    address: m.address,
    isActive: m.is_active,
    siteActive: m.site_status !== false,
    /** Same conditions as syncMeterSubscriptions (active meter, active site) + Redis connected. */
    ingesting: redisRunning && m.is_active && m.site_status === true,
});

/** GET /redis/discovery — discovered channels grouped by base channel ({site}_{address}). */
export const listDiscoveredChannels = async () => {
    const runtime = getDiscoveryRuntime();
    const [channelsRes, meters] = await Promise.all([
        pool.query(
            `SELECT channel, base_channel, site_id, address_id, datatype, device, code, handler_supported,
                    first_seen, last_seen, msg_count::float8 AS msg_count, rate_per_min, sample_at, ignored,
                    ignored_by, ignored_at,
                    last_seen > NOW() - make_interval(mins => $1) AS online
             FROM redis_channel_discovery
             ORDER BY site_id, address_id, datatype`,
            [DISCOVERY_STALE_MINUTES]
        ),
        loadMeters(),
    ]);
    const redisRunning = subClient.isReady;

    const metersByKey = new Map<string, MeterRow[]>();
    for (const m of meters) {
        if (!m.key) continue;
        const list = metersByKey.get(m.key) || [];
        list.push(m);
        metersByKey.set(m.key, list);
    }

    // Group channels by base channel
    const groups = new Map<string, any>();
    for (const c of channelsRes.rows) {
        let g = groups.get(c.base_channel);
        if (!g) {
            g = {
                baseChannel: c.base_channel,
                siteId: c.site_id,
                addressId: c.address_id,
                channels: [] as any[],
                firstSeen: c.first_seen,
                lastSeen: c.last_seen,
                online: false,
                ignored: true,
                ratePerMin: 0,
                msgCount: 0,
                devices: new Set<string>(),
            };
            groups.set(c.base_channel, g);
        }
        g.channels.push({
            channel: c.channel,
            datatype: c.datatype,
            device: c.device,
            code: c.code,
            handlerSupported: c.handler_supported,
            firstSeen: c.first_seen,
            lastSeen: c.last_seen,
            msgCount: Number(c.msg_count),
            ratePerMin: c.rate_per_min,
            online: c.online,
        });
        if (c.first_seen < g.firstSeen) g.firstSeen = c.first_seen;
        if (c.last_seen > g.lastSeen) g.lastSeen = c.last_seen;
        g.online = g.online || c.online;
        g.ignored = g.ignored && c.ignored;
        g.ratePerMin += Number(c.rate_per_min || 0);
        g.msgCount += Number(c.msg_count || 0);
        if (c.device) g.devices.add(c.device);
    }

    // Redis site → app sites already linked (used to rank suggestions)
    const appSitesByRedisSite = new Map<number, Set<number>>();
    for (const g of groups.values()) {
        for (const m of metersByKey.get(g.baseChannel) || []) {
            if (m.site_id === null) continue;
            const set = appSitesByRedisSite.get(g.siteId) || new Set<number>();
            set.add(m.site_id);
            appSitesByRedisSite.set(g.siteId, set);
        }
    }
    const liveBases = new Set(groups.keys());
    const newSince = Date.now() - NEW_WITHIN_HOURS * 3_600_000;

    const result = [...groups.values()].map((g) => {
        const linked = (metersByKey.get(g.baseChannel) || []).map((m) => meterView(m, redisRunning));
        let suggestions: any[] = [];
        if (linked.length === 0) {
            const preferredSites = appSitesByRedisSite.get(g.siteId);
            suggestions = meters
                .filter((m) => m.is_active && !(m.key && liveBases.has(m.key)) && Number(m.address) === g.addressId)
                .map((m) => ({
                    ...meterView(m, redisRunning),
                    score: preferredSites?.has(m.site_id as number) ? 2 : 1,
                    reason: preferredSites?.has(m.site_id as number) ? 'same-address-same-site' : 'same-address',
                }))
                .sort((a, b) => b.score - a.score || String(a.meterCode).localeCompare(String(b.meterCode)))
                .slice(0, 5);
        }
        const status = linked.length > 0 ? 'linked' : g.ignored ? 'ignored' : 'new';
        return {
            ...g,
            devices: [...g.devices],
            ratePerMin: Math.round(g.ratePerMin * 10) / 10,
            status,
            isNew: new Date(g.firstSeen).getTime() >= newSince,
            unsupportedDatatypes: g.channels.filter((c: any) => !c.handlerSupported).map((c: any) => c.datatype),
            linkedMeters: linked,
            suggestions,
        };
    });

    const summary = {
        total: result.length,
        linked: result.filter((g) => g.status === 'linked').length,
        unlinked: result.filter((g) => g.status === 'new').length,
        ignored: result.filter((g) => g.status === 'ignored').length,
        offline: result.filter((g) => !g.online && g.status !== 'ignored').length,
        newToday: result.filter((g) => g.isNew && g.status === 'new').length,
        unsupported: result.filter((g) => g.unsupportedDatatypes.length > 0 && g.status !== 'ignored').length,
        channels: channelsRes.rows.length,
    };

    return {
        runtime,
        staleMinutes: DISCOVERY_STALE_MINUTES,
        supportedDatatypes: supportedDatatypes(),
        summary,
        groups: result,
    };
};

/** GET /redis/discovery/summary — counts for the menu badge. */
export const getDiscoverySummary = async () => {
    const { summary, runtime } = await listDiscoveredChannels();
    return { ...summary, running: runtime.running };
};

/** GET /redis/discovery/sample?channel= — latest raw payload of one channel. */
export const getChannelSample = async (channel: string) => {
    const { rows } = await pool.query(
        `SELECT channel, datatype, sample_json, sample_at FROM redis_channel_discovery WHERE channel = $1`,
        [channel]
    );
    if (!rows[0]) throw new AppError(404, 'NOT_FOUND', `Channel ${channel} has not been discovered`);
    return rows[0];
};

/** GET /redis/discovery/meters?q= — meter picker for the link dialog. */
export const searchMetersForLink = async (q: string) => {
    const term = `%${q.trim()}%`;
    const { rows } = await pool.query(
        `SELECT m.meter_id, m.meter_code, m.meter_name, m.site_el::text AS site_el, m.address::text AS address,
                m.site_id, m.is_active, s.site_name, s.site_status
         FROM meter m
         LEFT JOIN sites s ON s.site_id = m.site_id
         WHERE $1 = '%%'
            OR m.meter_code ILIKE $1 OR m.meter_name ILIKE $1 OR s.site_name ILIKE $1
            OR m.site_el::text ILIKE $1 OR m.meter_id::text = $2
         ORDER BY m.is_active DESC, s.site_name NULLS LAST, m.meter_code
         LIMIT 50`,
        [term, q.trim()]
    );
    const redisRunning = subClient.isReady;
    return rows.map((r) => ({ ...meterView({ ...r, key: null }, redisRunning), currentChannel: toMeterKey(r.site_el, r.address) }));
};

const refreshSubscriptions = async (): Promise<void> => {
    try {
        await syncMeterSubscriptions();
    } catch (error: any) {
        // The DB change has already succeeded. Periodic reconciliation will retry.
        console.error('❌ Failed to refresh Redis meter subscriptions:', error.message);
    }
};

/**
 * POST /redis/discovery/link — link a discovered base channel to a meter.
 * meter.site_el = base channel (what syncMeterSubscriptions and the realtime readers use) and
 * realtime_meter_map is upserted; ingest for the channel starts on the next subscription sync (immediately).
 */
export const linkChannelToMeter = async (baseChannel: string, meterId: number) => {
    if (!BASE_RE.test(baseChannel)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'baseChannel must look like {siteID}_{addressID}, e.g. 1005_1');
    }
    const discovered = await pool.query(`SELECT 1 FROM redis_channel_discovery WHERE base_channel = $1 LIMIT 1`, [baseChannel]);
    if (!discovered.rows.length) throw new AppError(404, 'NOT_FOUND', `Channel ${baseChannel} has not been discovered`);

    const meters = await loadMeters();
    const meter = meters.find((m) => m.meter_id === meterId);
    if (!meter) throw new AppError(404, 'NOT_FOUND', `Meter ${meterId} not found`);
    const others = meters.filter((m) => m.meter_id !== meterId && m.key === baseChannel);
    if (others.length) {
        throw new AppError(409, 'CHANNEL_ALREADY_LINKED',
            `${baseChannel} is already linked to meter ${others.map((m) => m.meter_code || m.meter_id).join(', ')} — unlink it first`);
    }

    const [siteId, addressId] = baseChannel.split('_').map(Number);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`UPDATE meter SET site_el = $1 WHERE meter_id = $2`, [baseChannel, meterId]);
        // Retire old mappings of this meter and stale mappings of this channel to other meters
        await client.query(
            `UPDATE realtime_meter_map SET is_active = false, updated_at = NOW()
             WHERE is_active = true AND ((meter_id = $1 AND channel <> $2) OR (channel = $2 AND meter_id <> $1))`,
            [meterId, baseChannel]
        );
        const existing = await client.query(
            `SELECT id FROM realtime_meter_map WHERE channel = $1 AND meter_id = $2 ORDER BY id LIMIT 1`,
            [baseChannel, meterId]
        );
        if (existing.rows.length) {
            await client.query(
                `UPDATE realtime_meter_map
                 SET realtime_site_id = $1, realtime_address_id = $2, is_active = true, updated_at = NOW()
                 WHERE id = $3`,
                [siteId, addressId, existing.rows[0].id]
            );
        } else {
            await client.query(
                `INSERT INTO realtime_meter_map (channel, realtime_site_id, realtime_address_id, meter_id, is_active, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
                [baseChannel, siteId, addressId, meterId]
            );
        }
        await client.query(
            `UPDATE redis_channel_discovery SET ignored = false, ignored_by = NULL, ignored_at = NULL, updated_at = NOW()
             WHERE base_channel = $1 AND ignored = true`,
            [baseChannel]
        );
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }

    await refreshSubscriptions();
    console.log(`🔗 Redis channel ${baseChannel} linked to meter ${meter.meter_code || meterId} (was site_el=${meter.site_el ?? 'NULL'})`);
    const redisRunning = subClient.isReady;
    return {
        baseChannel,
        previousSiteEl: meter.site_el,
        meter: meterView({ ...meter, site_el: baseChannel, key: baseChannel }, redisRunning),
    };
};

/** POST /redis/discovery/unlink — stop ingesting a meter's channel (meter.site_el = NULL, mapping deactivated). */
export const unlinkMeter = async (meterId: number) => {
    const { rows } = await pool.query(`SELECT meter_id, meter_code, site_el::text AS site_el FROM meter WHERE meter_id = $1`, [meterId]);
    if (!rows[0]) throw new AppError(404, 'NOT_FOUND', `Meter ${meterId} not found`);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`UPDATE meter SET site_el = NULL WHERE meter_id = $1`, [meterId]);
        await client.query(
            `UPDATE realtime_meter_map SET is_active = false, updated_at = NOW() WHERE meter_id = $1 AND is_active = true`,
            [meterId]
        );
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }

    await refreshSubscriptions();
    console.log(`⛓️‍💥 Meter ${rows[0].meter_code || meterId} unlinked from Redis channel (was site_el=${rows[0].site_el ?? 'NULL'})`);
    return { meterId, previousSiteEl: rows[0].site_el };
};

/** POST /redis/discovery/ignore — hide / unhide all channels of a base channel. */
export const setChannelIgnored = async (baseChannel: string, ignored: boolean, userName: string | null) => {
    const { rowCount } = await pool.query(
        `UPDATE redis_channel_discovery
         SET ignored = $2, ignored_by = CASE WHEN $2 THEN $3 ELSE NULL END,
             ignored_at = CASE WHEN $2 THEN NOW() ELSE NULL END, updated_at = NOW()
         WHERE base_channel = $1`,
        [baseChannel, ignored, userName]
    );
    if (!rowCount) throw new AppError(404, 'NOT_FOUND', `Channel ${baseChannel} has not been discovered`);
    return { baseChannel, ignored, channels: rowCount };
};
