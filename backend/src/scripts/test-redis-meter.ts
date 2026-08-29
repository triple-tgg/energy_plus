import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });
import { pubClient, connectRedis, disconnectRedis } from '../config/redis';
import pool from '../config/database';

async function runTest() {
    try {
        console.log('🔌 Connecting to database & Redis...');
        await connectRedis();

        // 1. Get active meters from DB
        const meterRes = await pool.query(`
            SELECT m.meter_id, m.meter_code, m.meter_name, m.site_el, m.address
            FROM meter m
            WHERE m.is_active = true AND m.site_el IS NOT NULL AND m.address IS NOT NULL
            LIMIT 5
        `);

        if (meterRes.rows.length === 0) {
            console.log('⚠️  No active meters found in DB with site_el and address.');
            console.log('Using default channel: 1000_1');
            meterRes.rows.push({
                meter_id: 1,
                meter_code: 'TEST_01',
                meter_name: 'Test Meter',
                site_el: 1000,
                address: '1'
            });
        }

        console.log(`📡 Testing publish to ${meterRes.rows.length} meters...\n`);

        for (const m of meterRes.rows) {
            const channel = `${m.site_el}_${m.address}`;
            const mockPayload = {
                channel,
                siteID: m.site_el,
                addressID: parseInt(m.address, 10) || 1,
                device: m.meter_name || 'Meter_Device',
                code: m.meter_code,
                type: 'ELE',
                VL1: +(220 + Math.random() * 5).toFixed(2),
                VL2: +(220 + Math.random() * 5).toFixed(2),
                VL3: +(220 + Math.random() * 5).toFixed(2),
                VL12: +(380 + Math.random() * 8).toFixed(2),
                VL23: +(380 + Math.random() * 8).toFixed(2),
                VL31: +(380 + Math.random() * 8).toFixed(2),
                IL1: +(10 + Math.random() * 5).toFixed(2),
                IL2: +(10 + Math.random() * 5).toFixed(2),
                IL3: +(10 + Math.random() * 5).toFixed(2),
                KW1: +(2.2 + Math.random()).toFixed(2),
                KW2: +(2.2 + Math.random()).toFixed(2),
                KW3: +(2.2 + Math.random()).toFixed(2),
                KW_3Ph: +(7.5 + Math.random() * 2).toFixed(2),
                KVA1: 2.3,
                KVA2: 2.3,
                KVA3: 2.3,
                KVA_3Ph: 7.8,
                KVar1: 0.3,
                KVar2: 0.3,
                KVar3: 0.3,
                KVar_3Ph: 0.9,
                PF1: 0.98,
                PF2: 0.98,
                PF3: 0.98,
                Hz: 50.0,
                Import_KWhr: +(1500 + Math.random() * 100).toFixed(2),
                datetime: new Date().toISOString()
            };

            const receivers = await pubClient.publish(channel, JSON.stringify(mockPayload));
            console.log(`✅ [PUBLISH] Channel: "${channel}" -> ${receivers} subscriber(s) received`);
            console.log(`   Data: KW_3Ph=${mockPayload.KW_3Ph} kW, Import_KWhr=${mockPayload.Import_KWhr} kWh\n`);
        }

        console.log('🎉 Publish test completed successfully!');
        process.exit(0);
    } catch (err: any) {
        console.error('❌ Test failed:', err.message);
        process.exit(1);
    }
}

runTest();
