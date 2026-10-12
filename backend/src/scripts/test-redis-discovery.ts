/**
 * Tests for Redis channel auto-discovery.
 *
 *   npx ts-node src/scripts/test-redis-discovery.ts                 # unit tests (no Redis/DB)
 *   REDIS_ENABLED=true REDIS_DISCOVERY_FLUSH_MS=10000 \
 *     npx ts-node src/scripts/test-redis-discovery.ts --live 45     # listen 45 s, write redis_channel_discovery, print summary
 *
 * --live writes only to redis_channel_discovery (discovery stats). No realtime data is stored.
 *
 *   REDIS_ENABLED=true npx ts-node src/scripts/test-redis-discovery.ts --e2e <meterId> [1005_1]
 *     link channel → ingest rows appear without restart → unlink → no new rows; meter.site_el and
 *     realtime_meter_map are restored afterwards (rows ingested during the test are kept).
 */
import assert from 'node:assert/strict';
import { classifyChannel, DiscoveryAggregator } from '../modules/redis-pubsub/ingest/discovery';

let passed = 0;
const check = (name: string, fn: () => void) => {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
};

const unitTests = () => {
    console.log('== Discovery unit tests');
    check('classifyChannel: new format', () => {
        assert.deepEqual(classifyChannel('1005_1_HD33-VL'), {
            channel: '1005_1_HD33-VL', baseChannel: '1005_1', siteId: 1005, addressId: 1, datatype: 'HD33-VL',
        });
        assert.equal(classifyChannel('5003_32_pm3-thd')?.datatype, 'PM3-THD');
    });
    check('classifyChannel: legacy channel → datatype null', () => {
        assert.deepEqual(classifyChannel('1005_01'), {
            channel: '1005_01', baseChannel: '1005_01', siteId: 1005, addressId: 1, datatype: null,
        });
    });
    check('classifyChannel: non-meter channels ignored', () => {
        for (const ch of ['msoft_1005_1', 'test', '1005', '1005_x', '1021_10_55', 'abc_1_PM3', '']) {
            assert.equal(classifyChannel(ch), null, ch);
        }
    });
    check('aggregator: counts, rate, sample fields, first-seen flag', () => {
        const t0 = Date.parse('2026-10-12T00:00:00Z');
        const agg = new DiscoveryAggregator(t0);
        const msg = (dt: string, extra = {}) => JSON.stringify({ siteID: 1005, addressID: 1, device: 'DMG7500', code: '$0305', datatype: dt, ...extra });
        assert.equal(agg.record('1005_1_HD33-VL', msg('HD33-VL'), new Date(t0 + 1000)), true);
        assert.equal(agg.record('1005_1_HD33-VL', msg('HD33-VL', { n: 2 }), new Date(t0 + 5000)), false);
        assert.equal(agg.record('1005_1', msg('PM3'), new Date(t0 + 2000)), true);
        assert.equal(agg.record('2001_3', '{"siteID":2001}', new Date(t0 + 2000)), true); // legacy, no datatype → PM3
        assert.equal(agg.record('9_9_WATER', 'not json', new Date(t0 + 2000)), true);
        assert.equal(agg.record('foo', '{}'), false);
        assert.equal(agg.size, 4);

        const rows = agg.drain(t0 + 60_000);
        const vl = rows.find((r) => r.channel === '1005_1_HD33-VL')!;
        assert.equal(vl.base_channel, '1005_1');
        assert.equal(vl.msg_delta, 2);
        assert.equal(vl.rate_per_min, 2);
        assert.equal(vl.device, 'DMG7500');
        assert.equal(vl.handler_supported, true);
        assert.equal((vl.sample_json as any).n, 2, 'latest sample kept');
        assert.equal(vl.first_seen, new Date(t0 + 1000).toISOString());
        assert.equal(vl.last_seen, new Date(t0 + 5000).toISOString());
        assert.equal(rows.find((r) => r.channel === '2001_3')!.datatype, 'PM3');
        const water = rows.find((r) => r.channel === '9_9_WATER')!;
        assert.equal(water.datatype, 'WATER');
        assert.equal(water.handler_supported, false);
        assert.equal(water.sample_json, null);
        assert.equal(agg.size, 0, 'drain resets');
        assert.equal(agg.drain(t0 + 90_000).length, 0);
    });
    console.log(`🎉 ${passed} unit checks passed`);
};

const liveTest = async (seconds: number) => {
    const { connectRedis, disconnectRedis } = await import('../config/redis');
    const { startChannelDiscovery, stopChannelDiscovery, getDiscoveryRuntime } = await import('../modules/redis-pubsub/ingest/discovery');
    const { listDiscoveredChannels } = await import('../modules/redis-pubsub/discovery.service');
    const pool = (await import('../config/database')).default;

    console.log(`\n== Live discovery (${seconds}s)`);
    await connectRedis();
    await startChannelDiscovery();
    assert.ok(getDiscoveryRuntime().running, 'discovery should be running (REDIS_ENABLED=true?)');
    await new Promise((r) => setTimeout(r, seconds * 1000));
    await stopChannelDiscovery();

    const { summary, groups } = await listDiscoveredChannels();
    console.log('summary', summary);
    console.table(groups.slice(0, 15).map((g) => ({
        base: g.baseChannel,
        datatypes: g.channels.map((c: any) => c.datatype).join(','),
        status: g.status,
        online: g.online,
        rate: g.ratePerMin,
        linked: g.linkedMeters.map((m: any) => m.meterCode).join(','),
        suggest: g.suggestions.map((m: any) => `${m.meterCode}(${m.score})`).join(','),
    })));
    assert.ok(summary.total > 0, 'expected at least one discovered channel');
    await disconnectRedis();
    await pool.end();
};

/**
 * --e2e <meterId> <baseChannel>: link → sync → ingest rows appear → unlink → no new rows.
 * The meter's site_el and its realtime_meter_map rows are restored afterwards (ingested test rows are kept).
 */
const e2eTest = async (meterId: number, baseChannel: string) => {
    const { connectRedis, disconnectRedis } = await import('../config/redis');
    const { syncMeterSubscriptions } = await import('../modules/redis-pubsub/redisPubsub.service');
    const { linkChannelToMeter, unlinkMeter, listDiscoveredChannels } = await import('../modules/redis-pubsub/discovery.service');
    const pool = (await import('../config/database')).default;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const countSince = async (since: Date) => Number((await pool.query(
        `SELECT count(*) FROM meter_data_realtime WHERE channel = $1 AND received_at > $2`, [baseChannel, since]
    )).rows[0].count);

    console.log(`\n== E2E link/unlink (meter ${meterId} ↔ ${baseChannel})`);
    const meterBefore = (await pool.query(`SELECT site_el FROM meter WHERE meter_id = $1`, [meterId])).rows[0];
    assert.ok(meterBefore, `meter ${meterId} not found`);
    const mapsBefore = (await pool.query(
        `SELECT id, channel, realtime_site_id, realtime_address_id, meter_id, is_active, updated_at
         FROM realtime_meter_map WHERE meter_id = $1 OR channel = $2`, [meterId, baseChannel]
    )).rows;
    const mapIdsBefore = new Set(mapsBefore.map((r) => r.id));

    await connectRedis();
    try {
        // Link
        const linked = await linkChannelToMeter(baseChannel, meterId);
        check('link: meter.site_el = base channel, realtime_meter_map active', () => {
            assert.equal(linked.meter.siteEl, baseChannel);
        });
        const after = (await pool.query(`SELECT site_el FROM meter WHERE meter_id = $1`, [meterId])).rows[0];
        const activeMaps = (await pool.query(
            `SELECT meter_id FROM realtime_meter_map WHERE channel = $1 AND is_active = true`, [baseChannel]
        )).rows;
        check('link: DB state', () => {
            assert.equal(after.site_el, baseChannel);
            assert.deepEqual(activeMaps.map((r) => r.meter_id), [meterId]);
        });
        const list = await listDiscoveredChannels();
        check('discovery list shows group as linked', () => {
            const g = list.groups.find((x) => x.baseChannel === baseChannel)!;
            assert.equal(g.status, 'linked');
            assert.equal(g.linkedMeters[0].meterId, meterId);
        });

        // Ingest starts without restart (linkChannelToMeter already called syncMeterSubscriptions)
        const linkedAt = new Date();
        await syncMeterSubscriptions();
        await sleep(20_000);
        const ingested = await countSince(linkedAt);
        check(`ingest started after link (${ingested} rows in 20 s)`, () => assert.ok(ingested > 0));

        // Unlink
        await unlinkMeter(meterId);
        await sleep(3_000); // let in-flight messages settle
        const unlinkedAt = new Date();
        await sleep(15_000);
        const afterUnlink = await countSince(unlinkedAt);
        check(`ingest stopped after unlink (${afterUnlink} rows in 15 s)`, () => assert.equal(afterUnlink, 0));
    } finally {
        // Restore original meter / mapping state
        await pool.query(`UPDATE meter SET site_el = $1 WHERE meter_id = $2`, [meterBefore.site_el, meterId]);
        const mapsNow = (await pool.query(`SELECT id FROM realtime_meter_map WHERE meter_id = $1 OR channel = $2`, [meterId, baseChannel])).rows;
        for (const r of mapsNow) {
            if (!mapIdsBefore.has(r.id)) await pool.query(`DELETE FROM realtime_meter_map WHERE id = $1`, [r.id]);
        }
        for (const m of mapsBefore) {
            await pool.query(
                `UPDATE realtime_meter_map SET channel = $2, realtime_site_id = $3, realtime_address_id = $4, meter_id = $5,
                        is_active = $6, updated_at = $7 WHERE id = $1`,
                [m.id, m.channel, m.realtime_site_id, m.realtime_address_id, m.meter_id, m.is_active, m.updated_at]
            );
        }
        await syncMeterSubscriptions().catch(() => {});
        console.log(`  ↩️  restored meter ${meterId} site_el=${meterBefore.site_el} and ${mapsBefore.length} mapping row(s)`);
        await disconnectRedis();
        await pool.end();
    }
};

(async () => {
    unitTests();
    const i = process.argv.indexOf('--live');
    if (i >= 0) await liveTest(Number(process.argv[i + 1]) || 45);
    const e = process.argv.indexOf('--e2e');
    if (e >= 0) await e2eTest(Number(process.argv[e + 1]), process.argv[e + 2] || '1005_1');
    console.log(`🎉 ${passed} checks passed`);
    process.exit(0);
})().catch((error) => {
    console.error('\n❌ FAILED:', error.message);
    process.exit(1);
});
