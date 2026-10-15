/**
 * Verify the datatype-based Redis ingest.
 *
 *   npx ts-node src/scripts/test-redis-ingest.ts          # parser + mapping only (no DB)
 *   npx ts-node src/scripts/test-redis-ingest.ts --db     # + insert every sample inside a transaction, read back, ROLLBACK
 *
 * Samples: 1005_1_*.json in the repo root + live PM3 / PM3-THD messages captured from Redis.
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import pool from '../config/database';
import { parseDeviceDatetime, parseRedisMessage, stripDatatypeSuffix } from '../modules/redis-pubsub/ingest/messageParser';
import { getHandler, supportedDatatypes } from '../modules/redis-pubsub/ingest/handlers';
import { buildMaxDemandRow, buildRealtimeRow } from '../modules/redis-pubsub/ingest/handlers/powerMeter.handler';
import { extractHarmonics, floorToBucket } from '../modules/redis-pubsub/ingest/handlers/harmonics.handler';
import { ensureRealtimeIngestSchema } from '../modules/redis-pubsub/ingest/schema';
import { toMeterKey } from '../modules/redis-pubsub/redisPubsub.service';

const ROOT = path.join(__dirname, '../../..');
const fileSample = (name: string) => ({ channel: name, raw: fs.readFileSync(path.join(ROOT, `${name}.json`), 'utf8') });

const samples = [
    fileSample('1005_1_PM3-THD-DEMAND'),
    fileSample('1005_1_HD33-VL'),
    fileSample('1005_1_HD33-VLL'),
    fileSample('1005_1_HD33-IL'),
    {
        channel: '5001_5_PM3',
        raw: '{"datetime":"2026-10-12 02:48:05","siteID":5001,"addressID":5,"device":"MPR45S","code":"$010C","type":"POWER-METER","datatype":"PM3","VL1":229.3,"VL2":231.3,"VL3":231.2,"VL12":398.3,"VL23":401.8,"VL31":398.1,"IL1":5.8,"IL2":7.4,"IL3":5.8,"KW1":0.565,"KW2":0.683,"KW3":0.522,"KVar1":-1.125,"KVar2":-1.473,"KVar3":-1.215,"KVA1":1.330,"KVA2":1.717,"KVA3":1.341,"PF1":-0.425,"PF2":-0.398,"PF3":-0.389,"Hz":50.05,"KW_3Ph":1.771,"KVar_3Ph":-3.813,"KVA_3Ph":4.388,"Import_KWhr":551431.477}',
    },
    {
        channel: '5003_1_PM3-THD',
        raw: '{"datetime":"2026-10-12 03:02:52","siteID":5003,"addressID":1,"device":"MPR47S","code":"$0107","type":"POWER-METER","datatype":"PM3-THD","VL1":229,"VL2":231.5,"VL3":231.2,"VL12":398.5,"VL23":401.9,"VL31":397.9,"IL1":30.4,"IL2":46.4,"IL3":40,"KW1":5.492,"KW2":8.405,"KW3":7.473,"KVar1":-3.771,"KVar2":-5.780,"KVar3":-4.892,"KVA1":6.963,"KVA2":10.819,"KVA3":9.324,"PF1":-0.789,"PF2":-0.777,"PF3":-0.802,"Hz":49.98,"KW_3Ph":21.371,"KVar_3Ph":-14.444,"KVA_3Ph":27.106,"Import_KWhr":3975642.298,"THD_VL1":1.6,"THD_VL2":1.5,"THD_VL3":1.7,"THD_VL12":1.5,"THD_VL23":1.6,"THD_VL31":1.7,"THD_IL1":31.7,"THD_IL2":35.6,"THD_IL3":32.1}',
    },
];

let passed = 0;
const check = (name: string, fn: () => void) => {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
};
const col = (row: { columns: string[]; values: any[] }, name: string) => row.values[row.columns.indexOf(name)];

const offlineTests = () => {
    console.log('\n== Parser / mapping');

    check('datetime without TZ is Asia/Bangkok (+07:00)', () => {
        assert.equal(parseDeviceDatetime('2026-10-12 03:02:52')!.toISOString(), '2026-10-11T20:02:52.000Z');
        assert.equal(parseDeviceDatetime('2026-10-11T20:02:52Z')!.toISOString(), '2026-10-11T20:02:52.000Z');
        assert.equal(parseDeviceDatetime('garbage'), null);
    });

    check('base channel strips datatype suffix only', () => {
        assert.equal(stripDatatypeSuffix('1005_1_HD33-VL', 'HD33-VL'), '1005_1');
        assert.equal(stripDatatypeSuffix('1005_1_PM3-THD-DEMAND', 'PM3-THD-DEMAND'), '1005_1');
        assert.equal(stripDatatypeSuffix('1005_1', 'PM3'), '1005_1');
    });

    check('meter key from site_el / address', () => {
        assert.equal(toMeterKey('1005_1', null), '1005_1');
        assert.equal(toMeterKey('1005_1_PM3', '1'), '1005_1');
        assert.equal(toMeterKey('1005', '1'), '1005_1');
        assert.equal(toMeterKey('1005', null), null);
        assert.equal(toMeterKey('1021_10_55', '55'), '1021_10_55');
        assert.equal(toMeterKey('bad*glob', '1'), null);
        assert.equal(toMeterKey('  ', '1'), null);
    });

    check('every sample datatype has a handler', () => {
        for (const s of samples) {
            const { header } = parseRedisMessage(s.channel, s.raw);
            assert.ok(getHandler(header.datatype), `no handler for ${header.datatype}`);
        }
    });

    check('legacy payload without datatype → PM3 on legacy channel', () => {
        const { header } = parseRedisMessage('1000_1', '{"siteID":1000,"addressID":1,"VL1":230}');
        assert.equal(header.datatype, 'PM3');
        assert.equal(header.baseChannel, '1000_1');
    });

    check('unknown datatype has no handler (skipped, not stored)', () => {
        const { header } = parseRedisMessage('1005_1_WATER', '{"siteID":1005,"addressID":1,"datatype":"WATER"}');
        assert.equal(getHandler(header.datatype), undefined);
    });

    check('PM3-THD-DEMAND → base + THD + 27 max demand values', () => {
        const s = samples[0];
        const { header, data } = parseRedisMessage(s.channel, s.raw);
        assert.equal(header.baseChannel, '1005_1');
        assert.equal(header.deviceDatetime.toISOString(), '2026-10-11T12:24:20.000Z');
        const row = buildRealtimeRow(header, data);
        assert.equal(col(row, 'channel'), '1005_1');
        assert.equal(col(row, 'source_channel'), '1005_1_PM3-THD-DEMAND');
        assert.equal(col(row, 'vl1'), 233.88);
        assert.equal(col(row, 'kva_3ph'), 37.686);
        assert.equal(col(row, 'import_kwhr'), 488.84);
        assert.equal(col(row, 'thd_vl1'), 11.61);
        assert.equal(col(row, 'thd_il3'), 6.63);
        const md = buildMaxDemandRow(header, data, 1);
        assert.equal(md.columns.length - 4, 27);
        assert.ok(md.values.every((v) => v !== null && v !== undefined), 'max demand has nulls');
        assert.equal(col(md, 'il1'), 1552.61);
        assert.equal(col(md, 'kva_3ph'), 1053.9);
    });

    check('PM3 → base only, THD NULL', () => {
        const s = samples[4];
        const { header, data } = parseRedisMessage(s.channel, s.raw);
        const row = buildRealtimeRow(header, data);
        assert.equal(col(row, 'pf1'), -0.425);
        assert.equal(col(row, 'import_kwhr'), 551431.477);
        assert.equal(col(row, 'thd_vl1'), null);
    });

    check('PM3-THD → base + THD', () => {
        const s = samples[5];
        const { header, data } = parseRedisMessage(s.channel, s.raw);
        const row = buildRealtimeRow(header, data);
        assert.equal(col(row, 'thd_il2'), 35.6);
        assert.equal(col(row, 'kvar_3ph'), -14.444);
    });

    check('HD33-* → 3 phases × 32 orders, all present', () => {
        for (const s of samples.slice(1, 4)) {
            const { header, data } = parseRedisMessage(s.channel, s.raw);
            const phases = extractHarmonics(header.datatype, data);
            assert.equal(phases.length, 3);
            phases.forEach((p) => assert.equal(p.length, 32));
            assert.ok(phases.flat().every((v) => v !== null), `${header.datatype} has missing orders`);
        }
        const vl = parseRedisMessage(samples[1].channel, samples[1].raw);
        const [p1] = extractHarmonics('HD33-VL', vl.data);
        assert.equal(p1[0], vl.data.H2_VL1);
        assert.equal(p1[31], vl.data.H33_VL1);
    });

    check('15-minute snapshot bucket', () => {
        assert.equal(floorToBucket(new Date('2026-10-11T20:14:59Z'), 15).toISOString(), '2026-10-11T20:00:00.000Z');
        assert.equal(floorToBucket(new Date('2026-10-11T20:15:00Z'), 15).toISOString(), '2026-10-11T20:15:00.000Z');
    });

    check('corrupt reading (live 5003_32_PM3): out-of-range → NULL, rest kept', () => {
        const raw = '{"datetime":"2026-10-12 03:31:57","siteID":5003,"addressID":32,"device":"MPR45S","code":"$010C","type":"POWER-METER","datatype":"PM3","VL1":229.6,"VL2":231.5,"VL3":231.5,"VL12":3456,"VL23":2816,"VL31":-4352,"IL1":-60.16,"IL2":-49.92,"IL3":31.36,"KW1":0.000,"KW2":0.000,"KW3":0.000,"KVar1":0.000,"KVar2":0.000,"KVar3":0.000,"KVA1":0.000,"KVA2":0.000,"KVA3":0.000,"PF1":0.999,"PF2":0,"PF3":-2117289.492,"Hz":544,"KW_3Ph":0.000,"KVar_3Ph":0.000,"KVA_3Ph":0.000,"Import_KWhr":0}';
        samples.push({ channel: '5003_32_PM3', raw });
        const { header, data } = parseRedisMessage('5003_32_PM3', raw);
        const row = buildRealtimeRow(header, data);
        assert.equal(col(row, 'pf3'), null);
        assert.equal(col(row, 'pf1'), 0.999);
        assert.equal(col(row, 'vl1'), 229.6);
    });

    console.log(`  supported datatypes: ${supportedDatatypes().join(', ')}`);
};

const dbTests = async () => {
    console.log('\n== DB (transaction, rolled back)');
    await ensureRealtimeIngestSchema();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const s of samples) {
            const { header, data } = parseRedisMessage(s.channel, s.raw);
            await getHandler(header.datatype)!.save(client, header, data);
        }
        // second HD33-VL sample in the same bucket → upsert, not a new row
        const again = parseRedisMessage(samples[1].channel, samples[1].raw);
        await getHandler('HD33-VL')!.save(client, again.header, { ...again.data, H2_VL1: 99.5 });

        // Only rows written by this (rolled-back) transaction — live ingest may be writing 1005_1 too.
        const OWN_TX = `xmin::text = (txid_current() % 4294967296)::text`;
        const rt = await client.query(
            `SELECT channel, source_channel, datatype, vl1, thd_vl1, device_datetime
             FROM meter_data_realtime WHERE source_channel = ANY($1) AND ${OWN_TX} ORDER BY id`,
            [samples.map((s) => s.channel)]
        );
        const md = await client.query(
            `SELECT d.kva_3ph, r.source_channel FROM meter_max_demand_realtime d JOIN meter_data_realtime r ON r.id = d.realtime_id
             WHERE r.source_channel = '1005_1_PM3-THD-DEMAND' AND d.${OWN_TX}`
        );
        const hm = await client.query(
            `SELECT datatype, sample_count, phase1[1] AS h2_p1, array_length(phase1, 1) AS orders, bucket_start
             FROM meter_harmonics_realtime WHERE site_id = 1005 AND address_id = 1 AND ${OWN_TX} ORDER BY datatype`
        );

        check('meter_data_realtime: PM3 ×2 (incl. corrupt), PM3-THD, PM3-THD-DEMAND; no HD33 rows', () => {
            assert.deepEqual(rt.rows.map((r) => r.datatype).sort(), ['PM3', 'PM3', 'PM3-THD', 'PM3-THD-DEMAND']);
            assert.ok(rt.rows.every((r) => !String(r.source_channel).includes('HD33')));
            const demand = rt.rows.find((r) => r.datatype === 'PM3-THD-DEMAND');
            assert.equal(demand.channel, '1005_1');
            assert.equal(Number(demand.thd_vl1), 11.61);
            assert.equal(new Date(demand.device_datetime).toISOString(), '2026-10-11T12:24:20.000Z');
        });
        check('meter_max_demand_realtime: linked row', () => {
            assert.equal(md.rows.length, 1);
            assert.equal(Number(md.rows[0].kva_3ph), 1053.9);
        });
        check('meter_harmonics_realtime: 1 snapshot per datatype, upsert keeps latest', () => {
            assert.deepEqual(hm.rows.map((r) => r.datatype), ['HD33-IL', 'HD33-VL', 'HD33-VLL']);
            hm.rows.forEach((r) => assert.equal(r.orders, 32));
            const vl = hm.rows.find((r) => r.datatype === 'HD33-VL');
            assert.equal(vl.sample_count, 2);
            assert.equal(Number(vl.h2_p1), 99.5);
        });
        console.table(rt.rows);
        console.table(hm.rows);
    } finally {
        await client.query('ROLLBACK');
        client.release();
    }
};

(async () => {
    try {
        offlineTests();
        if (process.argv.includes('--db')) await dbTests();
        console.log(`\n🎉 ${passed} checks passed`);
        await pool.end();
        process.exit(0);
    } catch (error: any) {
        console.error('\n❌ FAILED:', error.message);
        await pool.end().catch(() => {});
        process.exit(1);
    }
})();
