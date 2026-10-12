/**
 * Parser for meter messages published to Redis.
 *
 * Channel format (current):  {siteID}_{addressID}_{datatype}   e.g. "1005_1_PM3-THD-DEMAND"
 * Channel format (legacy):   {siteID}_{addressID}              e.g. "1005_1"  (no datatype → treated as PM3)
 *
 * Payload header (all datatypes):
 *   { datetime, siteID, addressID, device, code, type, datatype, ...values }
 *
 * `datetime` is local device time WITHOUT timezone (observed: Asia/Bangkok, UTC+7).
 */

export const LEGACY_DATATYPE = 'PM3';

/** Offset applied to device `datetime` strings that carry no timezone. */
export const DEVICE_TZ_OFFSET = process.env.REDIS_DATETIME_TZ_OFFSET || '+07:00';

const CHANNEL_RE = /^(\d+)_(\d+)(?:_(.+))?$/;
const NAIVE_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?$/;
const HAS_TZ_RE = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;

export interface ParsedHeader {
    siteId: number;
    addressId: number;
    datatype: string;
    /**
     * Source channel without the `_{datatype}` suffix (e.g. "1005_1_PM3" → "1005_1"; legacy "1005_1" stays).
     * Stored in meter_data_realtime.channel so joins on `r.channel = meter.site_el` and
     * realtime_meter_map.channel keep working.
     */
    baseChannel: string;
    /** Actual Redis channel the message arrived on. */
    sourceChannel: string;
    deviceDatetime: Date;
    device: string | null;
    code: string | null;
    type: string | null;
}

export interface ParsedMessage {
    header: ParsedHeader;
    data: Record<string, any>;
}

export class MessageParseError extends Error {}

/** Parse a channel name into its parts (null if it does not follow `{site}_{address}[_{datatype}]`). */
export const parseChannel = (channel: string): { siteId: number; addressId: number; datatype: string | null } | null => {
    const match = CHANNEL_RE.exec(channel);
    if (!match) return null;
    return { siteId: Number(match[1]), addressId: Number(match[2]), datatype: match[3] ?? null };
};

/** Convert device datetime to a Date. Strings without timezone are interpreted with DEVICE_TZ_OFFSET. */
export const parseDeviceDatetime = (value: unknown): Date | null => {
    if (value === undefined || value === null || value === '') return null;
    const text = String(value).trim();

    let date: Date;
    const naive = NAIVE_DATETIME_RE.exec(text);
    if (naive) {
        const [, y, mo, d, h, mi, s, frac] = naive;
        date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s ?? '00'}${frac ?? ''}${DEVICE_TZ_OFFSET}`);
    } else if (HAS_TZ_RE.test(text)) {
        date = new Date(text);
    } else {
        return null;
    }
    return Number.isNaN(date.getTime()) ? null : date;
};

/** Finite number or null. */
export const num = (value: unknown): number | null => {
    if (value === undefined || value === null || value === '') return null;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
};

const toInt = (value: unknown): number | null => {
    const n = num(value);
    return n !== null && Number.isInteger(n) ? n : null;
};

const str = (value: unknown): string | null =>
    value === undefined || value === null || value === '' ? null : String(value);

/** "1005_1_HD33-VL" + "HD33-VL" → "1005_1". Channels without that suffix are returned unchanged. */
export const stripDatatypeSuffix = (channel: string, datatype: string): string => {
    const suffix = `_${datatype}`;
    return channel.length > suffix.length && channel.toUpperCase().endsWith(suffix.toUpperCase())
        ? channel.slice(0, -suffix.length)
        : channel;
};

export const parseRedisMessage = (channel: string, raw: string): ParsedMessage => {
    let data: any;
    try {
        data = JSON.parse(raw);
    } catch {
        throw new MessageParseError(`Invalid JSON on channel ${channel}`);
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new MessageParseError(`Payload on channel ${channel} is not a JSON object`);
    }

    const fromChannel = parseChannel(channel);
    const siteId = toInt(data.siteID) ?? fromChannel?.siteId ?? null;
    const addressId = toInt(data.addressID) ?? fromChannel?.addressId ?? null;
    if (siteId === null || addressId === null) {
        throw new MessageParseError(`Missing siteID/addressID on channel ${channel}`);
    }

    const datatype = String(data.datatype ?? fromChannel?.datatype ?? LEGACY_DATATYPE).trim().toUpperCase();

    return {
        header: {
            siteId,
            addressId,
            datatype,
            baseChannel: stripDatatypeSuffix(channel, datatype),
            sourceChannel: channel,
            deviceDatetime: parseDeviceDatetime(data.datetime) ?? new Date(),
            device: str(data.device),
            code: str(data.code),
            type: str(data.type),
        },
        data,
    };
};
