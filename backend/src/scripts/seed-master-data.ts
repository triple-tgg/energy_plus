import pool, { query } from '../config/database';
import { ensureMeterMasterData } from '../config/meterMasterData';

async function runSeedMasterData() {
    console.log('\n🌱 Starting Master Data Seeding & Migration...\n');
    try {
        await ensureMeterMasterData();
        const typesRes = await query(`SELECT meter_type_id, meter_type_name, is_active FROM meter_type ORDER BY meter_type_id`);
        console.log('\n📋 Active Meter Types:', typesRes.rows.map((r: any) => `[${r.meter_type_id}] ${r.meter_type_name}`).join(', '));
        const subTypesRes = await query(`
            SELECT mst.meter_sub_type_id, mst.sub_type_name, COUNT(m.meter_id)::int AS meter_count
            FROM meter_sub_type mst
            LEFT JOIN meter m ON m.meter_sub_type_id = mst.meter_sub_type_id
            WHERE mst.meter_type_id = 1
            GROUP BY mst.meter_sub_type_id, mst.sub_type_name, mst.sort_order
            ORDER BY mst.sort_order, mst.meter_sub_type_id
        `);
        console.log('⚡ Power Sub-Types & Meter Counts:');
        subTypesRes.rows.forEach((r: any) => {
            console.log(`   - ${r.sub_type_name} (id=${r.meter_sub_type_id}): ${r.meter_count} meter(s)`);
        });
        console.log('\n✅ Master Data Seeding & Migration completed successfully!\n');
    } catch (error: any) {
        console.error('❌ Master Data Seeding failed:', error.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    runSeedMasterData();
}

export { runSeedMasterData };

