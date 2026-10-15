import pool from '../../../../config/database';
import { MessageParseError, ParsedHeader, parseRedisMessage } from '../messageParser';
import { harmonicsHandler } from './harmonics.handler';
import { powerMeterHandler } from './powerMeter.handler';
import { DatatypeHandler } from './types';

/** Register new datatype handlers here. */
const HANDLERS: DatatypeHandler[] = [powerMeterHandler, harmonicsHandler];

const registry = new Map<string, DatatypeHandler>();
for (const handler of HANDLERS) {
    for (const datatype of handler.datatypes) {
        const key = datatype.toUpperCase();
        const existing = registry.get(key);
        if (existing) {
            throw new Error(`Datatype ${key} registered by both ${existing.name} and ${handler.name}`);
        }
        registry.set(key, handler);
    }
}

export const getHandler = (datatype: string): DatatypeHandler | undefined => registry.get(datatype.toUpperCase());
export const supportedDatatypes = (): string[] => [...registry.keys()];

const warnedUnknown = new Set<string>();

export type RouteResult =
    | { status: 'saved'; header: ParsedHeader; handler: string }
    | { status: 'skipped'; header: ParsedHeader; reason: 'unknown-datatype' }
    | { status: 'invalid'; error: string };

/** Parse a Redis message and persist it through the handler for its datatype. Never throws. */
export const routeMessage = async (channel: string, raw: string): Promise<RouteResult> => {
    let header: ParsedHeader;
    let data: Record<string, any>;
    try {
        ({ header, data } = parseRedisMessage(channel, raw));
    } catch (error: any) {
        if (!(error instanceof MessageParseError)) throw error;
        console.warn(`⚠️  Redis ingest: ${error.message}`);
        return { status: 'invalid', error: error.message };
    }

    const handler = registry.get(header.datatype);
    if (!handler) {
        if (!warnedUnknown.has(header.datatype)) {
            warnedUnknown.add(header.datatype);
            console.warn(`⚠️  Redis ingest: unknown datatype "${header.datatype}" (first seen on ${channel}) — not stored`);
        }
        return { status: 'skipped', header, reason: 'unknown-datatype' };
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await handler.save(client, header, data);
        await client.query('COMMIT');
        return { status: 'saved', header, handler: handler.name };
    } catch (error: any) {
        await client.query('ROLLBACK').catch(() => {});
        console.error(`❌ Redis ingest: failed to save ${header.datatype} from ${channel}:`, error.message);
        return { status: 'invalid', error: error.message };
    } finally {
        client.release();
    }
};
