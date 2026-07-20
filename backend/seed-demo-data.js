/**
 * Seed script: สร้างข้อมูลจำลอง 10 สาขา × 3 Building × 3 ชั้น × 1 Zone × 2 Meter
 * รวม: 10 sites, 30 buildings, 90 zones, 180 meters
 * 
 * IDs เริ่มต้น: site=100, building=100, zone=100, meter=1000
 * เพื่อไม่ชนกับข้อมูลจริง (max: site=12, building=18, zone=43, meter=153)
 * 
 * รัน: node seed-demo-data.js
 * ลบ: node seed-demo-data.js --rollback
 */

const { Pool } = require('pg');

const pool = new Pool({
    host: 'zephyr.proxy.rlwy.net',
    port: 23594,
    database: 'railway',
    user: 'postgres',
    password: 'gVVdmhzrmAZGnJZylnoQzoECjTnrKULm',
    ssl: { rejectUnauthorized: false },
});

const SITE_START = 100;
const BUILDING_START = 100;
const ZONE_START = 100;
const METER_START = 1000;

const SITE_NAMES = [
    { name: 'สาขาสุขุมวิท', addr: '123 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110' },
    { name: 'สาขาพระราม 9', addr: '456 ถ.พระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพฯ 10310' },
    { name: 'สาขาเชียงใหม่', addr: '789 ถ.ห้วยแก้ว ต.สุเทพ อ.เมือง เชียงใหม่ 50200' },
    { name: 'สาขาภูเก็ต', addr: '101 ถ.เทพกษัตรี ต.รัษฎา อ.เมือง ภูเก็ต 83000' },
    { name: 'สาขาขอนแก่น', addr: '202 ถ.มิตรภาพ ต.ในเมือง อ.เมือง ขอนแก่น 40000' },
    { name: 'สาขานครราชสีมา', addr: '303 ถ.สุรนารี ต.ในเมือง อ.เมือง นครราชสีมา 30000' },
    { name: 'สาขาอุดรธานี', addr: '404 ถ.โพศรี ต.หมากแข้ง อ.เมือง อุดรธานี 41000' },
    { name: 'สาขาหาดใหญ่', addr: '505 ถ.เพชรเกษม ต.หาดใหญ่ อ.หาดใหญ่ สงขลา 90110' },
    { name: 'สาขาระยอง', addr: '606 ถ.สุขุมวิท ต.เนินพระ อ.เมือง ระยอง 21000' },
    { name: 'สาขาพัทยา', addr: '707 ถ.สุขุมวิท ต.นาเกลือ อ.บางละมุง ชลบุรี 20150' },
];

const BUILDING_NAMES = ['อาคาร A', 'อาคาร B', 'อาคาร C'];
const ZONE_NAMES = ['MDB', 'ส่วนกลาง', 'สำนักงาน', 'ห้องประชุม', 'พลาซ่า'];

async function seed() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        let siteId = SITE_START;
        let buildingId = BUILDING_START;
        let zoneId = ZONE_START;
        let meterId = METER_START;

        // สร้าง 10 สาขา
        for (let si = 0; si < 10; si++) {
            const s = SITE_NAMES[si];
            await client.query(
                `INSERT INTO sites (site_id, site_name, site_address, site_status) VALUES ($1, $2, $3, true)`,
                [siteId, s.name, s.addr]
            );
            console.log(`✅ Site ${siteId}: ${s.name}`);

            // สร้าง 3 Building ต่อสาขา
            for (let bi = 0; bi < 3; bi++) {
                await client.query(
                    `INSERT INTO buildings (building_id, building_name, site_id, is_active, created_by) VALUES ($1, $2, $3, true, 'seed')`,
                    [buildingId, `${s.name}_${BUILDING_NAMES[bi]}`, siteId]
                );

                // สร้าง 3 ชั้น × 1 Zone ต่อ Building
                for (let fi = 1; fi <= 3; fi++) {
                    const zoneName = ZONE_NAMES[(bi * 3 + fi - 1) % ZONE_NAMES.length];
                    await client.query(
                        `INSERT INTO zones (zone_id, zone_name, building_id, is_show_dashboard) VALUES ($1, $2, $3, true)`,
                        [zoneId, `${zoneName} ชั้น ${fi}`, buildingId]
                    );

                    // สร้าง 2 Meter ต่อ Zone
                    for (let mi = 1; mi <= 2; mi++) {
                        const meterCode = `DEMO-${String(siteId).padStart(3, '0')}-${String(buildingId).padStart(3, '0')}-${fi}-${mi}`;
                        const meterName = `${BUILDING_NAMES[bi]} ชั้น${fi} เครื่อง${mi}`;
                        await client.query(
                            `INSERT INTO meter (meter_id, meter_code, meter_name, site_id, building_id, zone_id, floor, loop_id, address, is_active, status)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, 'Active')`,
                            [meterId, meterCode, meterName, siteId, buildingId, zoneId, fi, 1, String(meterId)]
                        );
                        meterId++;
                    }
                    zoneId++;
                }
                buildingId++;
            }
            siteId++;
        }

        await client.query('COMMIT');
        console.log(`\n🎉 Seed complete!`);
        console.log(`   Sites:     ${SITE_START} → ${siteId - 1} (${siteId - SITE_START} rows)`);
        console.log(`   Buildings: ${BUILDING_START} → ${buildingId - 1} (${buildingId - BUILDING_START} rows)`);
        console.log(`   Zones:     ${ZONE_START} → ${zoneId - 1} (${zoneId - ZONE_START} rows)`);
        console.log(`   Meters:    ${METER_START} → ${meterId - 1} (${meterId - METER_START} rows)`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Seed failed:', err.message);
    } finally {
        client.release();
    }
}

async function rollback() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const r1 = await client.query(`DELETE FROM meter WHERE meter_id >= ${METER_START}`);
        console.log(`🗑️  Deleted ${r1.rowCount} meters`);
        const r2 = await client.query(`DELETE FROM zones WHERE zone_id >= ${ZONE_START}`);
        console.log(`🗑️  Deleted ${r2.rowCount} zones`);
        const r3 = await client.query(`DELETE FROM buildings WHERE building_id >= ${BUILDING_START}`);
        console.log(`🗑️  Deleted ${r3.rowCount} buildings`);
        const r4 = await client.query(`DELETE FROM sites WHERE site_id >= ${SITE_START}`);
        console.log(`🗑️  Deleted ${r4.rowCount} sites`);
        await client.query('COMMIT');
        console.log('✅ Rollback complete — demo data removed!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Rollback failed:', err.message);
    } finally {
        client.release();
    }
}

(async () => {
    if (process.argv.includes('--rollback')) {
        await rollback();
    } else {
        await seed();
    }
    pool.end();
})();
