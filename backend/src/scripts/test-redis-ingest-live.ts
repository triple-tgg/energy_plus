// Live check: route every Redis message for N seconds through the real handlers inside ONE transaction, then ROLLBACK.
//   npx ts-node src/scripts/test-redis-ingest-live.ts 30                                  # verify, rolled back
//   npx ts-node src/scripts/test-redis-ingest-live.ts 3600 --commit --pattern=1005_1_*    # capture real data (dev only)
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });
import { createClient } from 'redis';
import pool from '../config/database';
import { parseRedisMessage } from '../modules/redis-pubsub/ingest/messageParser';
import { getHandler, routeMessage } from '../modules/redis-pubsub/ingest/handlers';
import { ensureRealtimeIngestSchema } from '../modules/redis-pubsub/ingest/schema';

const SECONDS = Number(process.argv[2] || 30);
const COMMIT = process.argv.includes('--commit');
const PATTERN = (process.argv.find((a) => a.startsWith('--pattern=')) || '--pattern=*').slice('--pattern='.length);

const capture = async () => {
    await ensureRealtimeIngestSchema();
    const redis = createClient({
        socket: { host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT) },
        password: process.env.REDIS_PASSWORD || undefined,
    });
    await redis.connect();
    const stats: Record<string, number> = {};
    await redis.pSubscribe(PATTERN, async (message, channel) => {
        const result = await routeMessage(channel, message);
        const key = `${result.status}:${result.status === 'invalid' ? 'error' : result.header.datatype}`;
        stats[key] = (stats[key] || 0) + 1;
    });
    console.log(`📥 Capturing ${PATTERN} for ${SECONDS}s (COMMIT)`);
    const timer = setInterval(() => console.log(new Date().toISOString(), JSON.stringify(stats)), 60000);
    await new Promise((r) => setTimeout(r, SECONDS * 1000));
    clearInterval(timer);
    await redis.pUnsubscribe(PATTERN);
    await redis.quit();
    await pool.end();
    console.log('Done', JSON.stringify(stats));
    process.exit(0);
};

const verify = async () => {
    await ensureRealtimeIngestSchema();
    const db = await pool.connect();
    await db.query('BEGIN');
    const redis = createClient({
        socket: { host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT) },
        password: process.env.REDIS_PASSWORD || undefined,
    });
    await redis.connect();

    const stats: Record<string, { ok: number; fail: number; skipped: number }> = {};
    const errors: string[] = [];
    let queue = Promise.resolve();
    await redis.pSubscribe(PATTERN, (message, channel) => {
        queue = queue.then(async () => {
            let datatype = '(parse-error)';
            try {
                const { header, data } = parseRedisMessage(channel, message);
                datatype = header.datatype;
                const s = (stats[datatype] ??= { ok: 0, fail: 0, skipped: 0 });
                const handler = getHandler(datatype);
                if (!handler) { s.skipped++; return; }
                await db.query('SAVEPOINT m');
                try {
                    await handler.save(db, header, data);
                    await db.query('RELEASE SAVEPOINT m');
                    s.ok++;
                } catch (e: any) {
                    await db.query('ROLLBACK TO SAVEPOINT m');
                    s.fail++;
                    if (errors.length < 10) errors.push(`${channel}: ${e.message}`);
                }
            } catch (e: any) {
                (stats[datatype] ??= { ok: 0, fail: 0, skipped: 0 }).fail++;
                if (errors.length < 10) errors.push(`${channel}: ${e.message}`);
            }
        });
    });

    await new Promise((r) => setTimeout(r, SECONDS * 1000));
    await redis.pUnsubscribe(PATTERN);
    await queue;
    const counts = await db.query(`
        SELECT 'meter_data_realtime' t, COUNT(*)::int n FROM meter_data_realtime WHERE received_at > NOW() - interval '5 minutes'
        UNION ALL SELECT 'meter_max_demand_realtime', COUNT(*)::int FROM meter_max_demand_realtime WHERE received_at > NOW() - interval '5 minutes'
        UNION ALL SELECT 'meter_harmonics_realtime', COUNT(*)::int FROM meter_harmonics_realtime WHERE received_at > NOW() - interval '5 minutes'`);
    await db.query('ROLLBACK');
    db.release();
    await redis.quit();
    await pool.end();

    console.log(`\n== Live ${SECONDS}s (rolled back)`);
    console.table(stats);
    console.table(counts.rows);
    if (errors.length) { console.log('Errors:\n' + errors.join('\n')); process.exit(1); }
    process.exit(0);
};

(COMMIT ? capture() : verify()).catch((e) => { console.error('ERR', e); process.exit(1); });
