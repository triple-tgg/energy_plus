const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '25060', 10),
    database: process.env.DB_DATABASE || 'energy_plus',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
});

async function inspect() {
    const tables = [
        'company',
        'group_user',
        'app_user',
        'user_permission',
        'sites',
        'buildings',
        'zones',
        'site_user_map',
        'meter_brand',
        'meter_type',
        'loop',
        'protocol',
        'energy_value',
        'meter',
        'realtime_meter_map',
        'billing_config',
        'demand_peak_config',
        'demand_meter_config',
        'alarm_group',
        'alarm_config',
        'layouts',
        'layout_points'
    ];

    for (const t of tables) {
        try {
            const countRes = await pool.query(`SELECT COUNT(*) FROM "${t}"`);
            const count = parseInt(countRes.rows[0].count, 10);
            console.log(`\n=================== TABLE: ${t} (Total: ${count}) ===================`);
            const dataRes = await pool.query(`SELECT * FROM "${t}" ORDER BY 1 LIMIT 30`);
            console.table(dataRes.rows);
        } catch (e) {
            console.log(`Table ${t} error:`, e.message);
        }
    }

    await pool.end();
}

inspect().catch(console.error);
