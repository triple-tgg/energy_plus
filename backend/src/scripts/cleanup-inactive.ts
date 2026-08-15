/**
 * Cleanup Script: Delete inactive sites & buildings from DB
 * Cascading delete order (bottom-up to respect FK constraints):
 *
 * For INACTIVE SITES (site_status = false):
 *   1. alarm_log (via meter_id)
 *   2. alarm_config (via meter_id)
 *   3. alarm_group_mapping (via meter_id)
 *   4. demand_meter_config (via meter_id)
 *   5. saving_meter_config (via meter_id)
 *   6. energy_daily_usage (via meter_id)
 *   7. layout_points (via meter_id)
 *   8. realtime_meter_map (via meter_id)
 *   9. actual_meter_data_monthly (via meter_id)
 *  10. actual_meter_data_daily (via meter_id)
 *  11. actual_meter_data (via meter_id)
 *  12. write_log (via meter_id)
 *  13. meter (via site_id)
 *  14. zones (via building_id → buildings in inactive sites)
 *  15. buildings (via site_id)
 *  16. site_user_map (via site_id)
 *  17. sites (site_id)
 *
 * For INACTIVE BUILDINGS (is_active = false, but site is still active):
 *   Same meter cascade, then zones, then buildings
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
    user: process.env.DB_USER || 'energyadmin',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_DATABASE || 'energy_plus',
    password: process.env.DB_PASSWORD || '',
    port: parseInt(process.env.DB_PORT || '25060', 10),
    ssl: { rejectUnauthorized: false },
});

async function main() {
    const client = await pool.connect();
    try {
        // ── 1. Preview ──────────────────────────────────────────────
        console.log('\n══════════════════════════════════════════════════════════');
        console.log('  🔍  DRY RUN — Preview data to be deleted');
        console.log('══════════════════════════════════════════════════════════\n');

        // Inactive sites
        const inactiveSites = await client.query(
            `SELECT site_id, site_name, site_status FROM sites WHERE site_status = false`
        );
        console.log(`🏢 Inactive Sites: ${inactiveSites.rows.length}`);
        inactiveSites.rows.forEach((s: any) => console.log(`   • [${s.site_id}] ${s.site_name}`));

        // Inactive buildings (in ACTIVE sites only — buildings in inactive sites will be deleted with the site)
        const inactiveBuildings = await client.query(
            `SELECT b.building_id, b.building_name, b.site_id, s.site_name
             FROM buildings b
             JOIN sites s ON b.site_id = s.site_id
             WHERE b.is_active = false AND s.site_status = true`
        );
        console.log(`\n🏗️  Inactive Buildings (in active sites): ${inactiveBuildings.rows.length}`);
        inactiveBuildings.rows.forEach((b: any) => console.log(`   • [${b.building_id}] ${b.building_name} (Site: ${b.site_name})`));

        // Collect all site_ids and building_ids to delete
        const siteIds = inactiveSites.rows.map((s: any) => s.site_id);
        const buildingIds = inactiveBuildings.rows.map((b: any) => b.building_id);

        // All buildings in inactive sites
        const buildingsInInactiveSites = siteIds.length > 0
            ? (await client.query(`SELECT building_id FROM buildings WHERE site_id = ANY($1::int[])`, [siteIds])).rows.map((r: any) => r.building_id)
            : [];

        // All buildings to delete (inactive site buildings + standalone inactive buildings)
        const allBuildingIds = [...new Set([...buildingsInInactiveSites, ...buildingIds])];

        // All zones in those buildings
        const allZoneIds = allBuildingIds.length > 0
            ? (await client.query(`SELECT zone_id FROM zones WHERE building_id = ANY($1::int[])`, [allBuildingIds])).rows.map((r: any) => r.zone_id)
            : [];

        // All meters in those sites or buildings
        const meterFilter: string[] = [];
        const meterParams: any[] = [];
        if (siteIds.length > 0) {
            meterParams.push(siteIds);
            meterFilter.push(`site_id = ANY($${meterParams.length}::int[])`);
        }
        if (buildingIds.length > 0) {
            meterParams.push(buildingIds);
            meterFilter.push(`building_id = ANY($${meterParams.length}::int[])`);
        }
        const allMeterIds = meterFilter.length > 0
            ? (await client.query(`SELECT meter_id FROM meter WHERE ${meterFilter.join(' OR ')}`, meterParams)).rows.map((r: any) => r.meter_id)
            : [];

        console.log(`\n📊 Cascade impact:`);
        console.log(`   Sites to delete:     ${siteIds.length}`);
        console.log(`   Buildings to delete:  ${allBuildingIds.length}`);
        console.log(`   Zones to delete:      ${allZoneIds.length}`);
        console.log(`   Meters to delete:     ${allMeterIds.length}`);

        if (siteIds.length === 0 && buildingIds.length === 0) {
            console.log('\n✅ Nothing to delete — no inactive sites or buildings found.');
            return;
        }

        // Count related data
        if (allMeterIds.length > 0) {
            const counts = await Promise.all([
                client.query(`SELECT COUNT(*)::int AS c FROM actual_meter_data WHERE meter_id = ANY($1::int[])`, [allMeterIds]),
                client.query(`SELECT COUNT(*)::int AS c FROM actual_meter_data_daily WHERE meter_id = ANY($1::int[])`, [allMeterIds]),
                client.query(`SELECT COUNT(*)::int AS c FROM actual_meter_data_monthly WHERE meter_id = ANY($1::int[])`, [allMeterIds]),
                client.query(`SELECT COUNT(*)::int AS c FROM alarm_config WHERE meter_id = ANY($1::int[])`, [allMeterIds]),
                client.query(`SELECT COUNT(*)::int AS c FROM alarm_group_mapping WHERE meter_id = ANY($1::int[])`, [allMeterIds]),
                client.query(`SELECT COUNT(*)::int AS c FROM energy_daily_usage WHERE meter_id = ANY($1::int[])`, [allMeterIds]),
                client.query(`SELECT COUNT(*)::int AS c FROM layout_points WHERE meter_id = ANY($1::int[])`, [allMeterIds]),
            ]);
            console.log(`   actual_meter_data:    ${counts[0].rows[0].c} rows`);
            console.log(`   actual_meter_data_daily: ${counts[1].rows[0].c} rows`);
            console.log(`   actual_meter_data_monthly: ${counts[2].rows[0].c} rows`);
            console.log(`   alarm_config:         ${counts[3].rows[0].c} rows`);
            console.log(`   alarm_group_mapping:  ${counts[4].rows[0].c} rows`);
            console.log(`   energy_daily_usage:   ${counts[5].rows[0].c} rows`);
            console.log(`   layout_points:        ${counts[6].rows[0].c} rows`);
        }

        if (siteIds.length > 0) {
            const sumCount = await client.query(`SELECT COUNT(*)::int AS c FROM site_user_map WHERE site_id = ANY($1::int[])`, [siteIds]);
            console.log(`   site_user_map:        ${sumCount.rows[0].c} rows`);
        }

        // ── 2. Execute ──────────────────────────────────────────────
        console.log('\n══════════════════════════════════════════════════════════');
        console.log('  🗑️  EXECUTING DELETE — within transaction');
        console.log('══════════════════════════════════════════════════════════\n');

        await client.query('BEGIN');

        // Delete meter-related data (bottom-up)
        if (allMeterIds.length > 0) {
            const mids = allMeterIds;
            const tables = [
                'alarm_log',
                'alarm_config',
                'alarm_group_mapping',
                'demand_meter_config',
                'saving_meter_config',
                'energy_daily_usage',
                'layout_points',
                'realtime_meter_map',
                'actual_meter_data_monthly',
                'actual_meter_data_daily',
                'actual_meter_data',
                'write_log',
            ];

            for (const table of tables) {
                try {
                    const res = await client.query(`DELETE FROM ${table} WHERE meter_id = ANY($1::int[])`, [mids]);
                    if (res.rowCount && res.rowCount > 0) {
                        console.log(`   ✅ ${table}: ${res.rowCount} rows deleted`);
                    }
                } catch (err: any) {
                    // Table might not exist
                    if (err.code !== '42P01') throw err;
                    console.log(`   ⚠️  ${table}: table does not exist, skipping`);
                }
            }

            // Delete meters themselves (handle parent_meter_id self-reference)
            await client.query(`UPDATE meter SET parent_meter_id = NULL WHERE parent_meter_id = ANY($1::int[])`, [mids]);
            const meterDel = await client.query(`DELETE FROM meter WHERE meter_id = ANY($1::int[])`, [mids]);
            console.log(`   ✅ meter: ${meterDel.rowCount} rows deleted`);
        }

        // Delete zones
        if (allZoneIds.length > 0) {
            const zoneDel = await client.query(`DELETE FROM zones WHERE zone_id = ANY($1::int[])`, [allZoneIds]);
            console.log(`   ✅ zones: ${zoneDel.rowCount} rows deleted`);
        }

        // Delete buildings
        if (allBuildingIds.length > 0) {
            const buildDel = await client.query(`DELETE FROM buildings WHERE building_id = ANY($1::int[])`, [allBuildingIds]);
            console.log(`   ✅ buildings: ${buildDel.rowCount} rows deleted`);
        }

        // Delete site_user_map
        if (siteIds.length > 0) {
            const sumDel = await client.query(`DELETE FROM site_user_map WHERE site_id = ANY($1::int[])`, [siteIds]);
            console.log(`   ✅ site_user_map: ${sumDel.rowCount} rows deleted`);
        }

        // Delete sites
        if (siteIds.length > 0) {
            const siteDel = await client.query(`DELETE FROM sites WHERE site_id = ANY($1::int[])`, [siteIds]);
            console.log(`   ✅ sites: ${siteDel.rowCount} rows deleted`);
        }

        await client.query('COMMIT');
        console.log('\n✅ Done! All inactive sites and buildings have been removed.\n');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ Error — ROLLBACK executed. No data was deleted.\n', err);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
