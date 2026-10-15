import { RedisClientType } from 'redis';
import pool from '../../../config/database';
import { subClient, REDIS_ENABLED } from '../../../config/redis';
import { getHandler } from './handlers';
import { LEGACY_DATATYPE } from './messageParser';
import { ensureRealtimeIngestSchema } from './schema';

/**
 * Auto-discovery of Redis meter channels.
 *
 * A dedicated connection PSUBSCRIBEs every `{siteID}_{addressID}[_{datatype}]` channel and keeps
 * cheap in-memory stats (count, last seen, latest raw sample). Every DISCOVERY_FLUSH_MS the stats
 * are upserted into redis_channel_discovery. Payloads are NOT parsed per message and nothing is
 * written to the realtime tables — ingest only happens for channels linked to a meter
 * (see syncMeterSubscriptions).
 *
 * Env:
 *   REDIS_CHANNEL_DISCOVERY=false   disable
 *   REDIS_DISCOVERY_FLUSH_MS=30000  flush interval
 */
export const DISCOVERY_ENABLED = process.env.REDIS_CHANNEL_DISCOVERY !== 'false';
const FLUSH_MS = Math.max(5_000, parseInt(process.env.REDIS_DISCOVERY_FLUSH_MS || '30000', 10) || 30_000);
/** Redis glob pre-filter (first char a digit); exact format is checked with DISCOVERY_CHANNEL_RE. */
const DISCOVERY_PATTERN = '[0-9]*_[0-9]*';
const DISCOVERY_CHANNEL_RE = /^(\d+)_(\d+)(?:_([A-Za-z][\w-]*))?$/;
const MAX_SAMPLE_BYTES = 16_384;

export interface ChannelInfo {
    channel: string;
    baseChannel: string;
    siteId: number;
    addressId: number;
    /** Datatype from the channel suffix (null for legacy `{site}_{address}` channels). */
    datatype: string | null;
}

/** "1005_1_HD33-VL" → { baseChannel: "1005_1", siteId: 1005, addressId: 1, datatype: "HD33-VL" }; null if not a meter channel. */
export const classifyChannel = (channel: string): ChannelInfo | null => {
    const m = DISCOVERY_CHANNEL_RE.exec(channel);
    if (!m) return null;
    return {
        channel,
        baseChannel: `${m[1]}_${m[2]}`, // literal: must match the PSUBSCRIBE pattern `{base}_*`
        siteId: Number(m[1]),
        addressId: Number(m[2]),
        datatype: m[3] ? m[3].toUpperCase() : null,
    };
};

interface ChannelStats {
    info: ChannelInfo;
    count: number;
    firstSeen: Date;
    lastSeen: Date;
    sample: string;
}

export interface DiscoveryRow {
    channel: string;
    base_channel: string;
    site_id: number;
    address_id: number;
    datatype: string;
    device: string | null;
    code: string | null;
    handler_supported: boolean;
    first_seen: string;
    last_seen: string;
    msg_delta: number;
    rate_per_min: number;
    sample_json: Record<string, unknown> | null;
}

const text = (v: unknown, max: number): string | null =>
    v === undefined || v === null || v === '' ? null : String(v).slice(0, max);

/** Pure in-memory aggregation (unit-testable without Redis/DB). */
export class DiscoveryAggregator {
    private stats = new Map<string, ChannelStats>();
    private windowStart: number;

    constructor(now = Date.now()) {
        this.windowStart = now;
    }

    /** Returns true the first time a channel is seen by this aggregator. */
    record(channel: string, raw: string, now = new Date()): boolean {
        const existing = this.stats.get(channel);
        if (existing) {
            existing.count++;
            existing.lastSeen = now;
            existing.sample = raw;
            return false;
        }
        const info = classifyChannel(channel);
        if (!info) return false;
        this.stats.set(channel, { info, count: 1, firstSeen: now, lastSeen: now, sample: raw });
        return true;
    }

    get size(): number {
        return this.stats.size;
    }

    /** Take the accumulated stats as DB rows and reset the window. */
    drain(now = Date.now()): DiscoveryRow[] {
        const minutes = Math.max((now - this.windowStart) / 60_000, 1 / 60);
        this.windowStart = now;
        const rows: DiscoveryRow[] = [];
        for (const s of this.stats.values()) {
            let sample: Record<string, unknown> | null = null;
            if (s.sample.length <= MAX_SAMPLE_BYTES) {
                try {
                    const parsed = JSON.parse(s.sample);
                    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) sample = parsed;
                } catch { /* non-JSON payload: keep stats only */ }
            }
            const datatype = (s.info.datatype ?? text(sample?.datatype, 30) ?? LEGACY_DATATYPE).toUpperCase();
            rows.push({
                channel: s.info.channel,
                base_channel: s.info.baseChannel,
                site_id: s.info.siteId,
                address_id: s.info.addressId,
                datatype,
                device: text(sample?.device, 80),
                code: text(sample?.code, 30),
                handler_supported: !!getHandler(datatype),
                first_seen: s.firstSeen.toISOString(),
                last_seen: s.lastSeen.toISOString(),
                msg_delta: s.count,
                rate_per_min: Math.round((s.count / minutes) * 10) / 10,
                sample_json: sample,
            });
        }
        this.stats.clear();
        return rows;
    }
}

/* ------------------------------------------------------------------ runtime */

let client: RedisClientType | null = null;
let flushTimer: NodeJS.Timeout | null = null;
let aggregator = new DiscoveryAggregator();
const knownChannels = new Set<string>();
let startedAt: Date | null = null;
let lastFlushAt: Date | null = null;
let lastFlushError: string | null = null;
let flushing: Promise<void> | null = null;

const onMessage = (message: string, channel: string): void => {
    if (aggregator.record(channel, message) && !knownChannels.has(channel)) {
        knownChannels.add(channel);
        console.log(`🆕 New Redis channel discovered: ${channel}`);
    }
};

export const flushDiscovery = (): Promise<void> => {
    if (flushing) return flushing;
    const rows = aggregator.drain();
    if (rows.length === 0) return Promise.resolve();
    flushing = (async () => {
        try {
            await pool.query(
                `INSERT INTO redis_channel_discovery AS d (
                    channel, base_channel, site_id, address_id, datatype, device, code, handler_supported,
                    first_seen, last_seen, msg_count, rate_per_min, sample_json, sample_at, updated_at
                 )
                 SELECT r.channel, r.base_channel, r.site_id, r.address_id, r.datatype, r.device, r.code,
                        r.handler_supported, r.first_seen, r.last_seen, r.msg_delta, r.rate_per_min,
                        r.sample_json, r.last_seen, NOW()
                 FROM jsonb_to_recordset($1::jsonb) AS r(
                    channel text, base_channel text, site_id int, address_id int, datatype text, device text,
                    code text, handler_supported boolean, first_seen timestamptz, last_seen timestamptz,
                    msg_delta bigint, rate_per_min real, sample_json jsonb
                 )
                 ON CONFLICT (channel) DO UPDATE SET
                    datatype          = EXCLUDED.datatype,
                    device            = COALESCE(EXCLUDED.device, d.device),
                    code              = COALESCE(EXCLUDED.code, d.code),
                    handler_supported = EXCLUDED.handler_supported,
                    last_seen         = GREATEST(d.last_seen, EXCLUDED.last_seen),
                    msg_count         = d.msg_count + EXCLUDED.msg_count,
                    rate_per_min      = EXCLUDED.rate_per_min,
                    sample_json       = COALESCE(EXCLUDED.sample_json, d.sample_json),
                    sample_at         = CASE WHEN EXCLUDED.sample_json IS NULL THEN d.sample_at ELSE EXCLUDED.sample_at END,
                    updated_at        = NOW()`,
                [JSON.stringify(rows)]
            );
            lastFlushAt = new Date();
            lastFlushError = null;
        } catch (error: any) {
            lastFlushError = error.message;
            console.error('❌ Redis channel discovery flush failed:', error.message);
        } finally {
            flushing = null;
        }
    })();
    return flushing;
};

export const startChannelDiscovery = async (): Promise<void> => {
    if (!DISCOVERY_ENABLED) {
        console.log('⏸️  Redis channel discovery disabled (REDIS_CHANNEL_DISCOVERY=false)');
        return;
    }
    if (!REDIS_ENABLED || !subClient.isReady || client) return;

    await ensureRealtimeIngestSchema();
    const known = await pool.query(`SELECT channel FROM redis_channel_discovery`);
    known.rows.forEach((r) => knownChannels.add(r.channel));

    const dup = subClient.duplicate() as RedisClientType;
    dup.on('error', (err: any) => console.error('❌ Redis discovery client error:', err.message));
    await dup.connect();
    await dup.pSubscribe(DISCOVERY_PATTERN, onMessage);
    client = dup;
    aggregator = new DiscoveryAggregator();
    startedAt = new Date();

    flushTimer = setInterval(() => { void flushDiscovery(); }, FLUSH_MS);
    flushTimer.unref();
    console.log(`🔎 Redis channel discovery started (pattern "${DISCOVERY_PATTERN}", flush ${FLUSH_MS / 1000}s, ${knownChannels.size} known)`);
};

export const stopChannelDiscovery = async (): Promise<void> => {
    if (flushTimer) clearInterval(flushTimer);
    flushTimer = null;
    if (!client) return;
    try {
        await flushDiscovery();
        await client.pUnsubscribe();
        await client.quit();
    } catch (error: any) {
        console.error('❌ Error stopping Redis channel discovery:', error.message);
    } finally {
        client = null;
    }
};

export const getDiscoveryRuntime = () => ({
    enabled: DISCOVERY_ENABLED,
    redisEnabled: REDIS_ENABLED,
    running: !!client?.isReady,
    startedAt,
    lastFlushAt,
    lastFlushError,
    flushIntervalMs: FLUSH_MS,
    pendingChannels: aggregator.size,
});
