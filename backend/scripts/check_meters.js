require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        // 1. Check meter_type columns
        const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='meter_type' ORDER BY ordinal_position`);
        console.log('=== meter_type COLUMNS ===');
        console.log(cols.rows.map(r => r.column_name).join(', '));

        // 2. Check meter_type data
        const types = await pool.query('SELECT * FROM meter_type ORDER BY meter_type_id');
        console.log('\n=== METER TYPES ===');
        types.rows.forEach(r => console.log(JSON.stringify(r)));

        // 3. Check meters with their types (first 20)
        const meters = await pool.query(`
            SELECT m.meter_id, m.meter_code, m.meter_name, mt.meter_type_name
            FROM meter m 
            LEFT JOIN meter_type mt ON mt.meter_type_id = m.meter_type_id 
            WHERE m.is_active IS DISTINCT FROM false 
            ORDER BY m.meter_id LIMIT 20
        `);
        console.log('\n=== ACTIVE METERS (first 20) ===');
        meters.rows.forEach(r => console.log(`  ID:${r.meter_id} | Code:"${r.meter_code}" | Name:"${r.meter_name}" | TypeName:"${r.meter_type_name}"`));

        // 4. MDB match count
        const mdbMatch = await pool.query(`
            SELECT COUNT(*) as cnt FROM meter m
            WHERE m.is_active IS DISTINCT FROM false
            AND (
                EXISTS (SELECT 1 FROM meter_type mt WHERE mt.meter_type_id = m.meter_type_id AND mt.meter_type_name ILIKE '%MDB%')
                OR m.meter_name ILIKE '%MDB%'
                OR m.meter_code ILIKE '%MDB%'
            )
        `);
        console.log('\n=== MDB MATCH (TOU filter) === ' + mdbMatch.rows[0].cnt + ' meters');

        // 5. Total active
        const total = await pool.query(`SELECT COUNT(*) as cnt FROM meter WHERE is_active IS DISTINCT FROM false`);
        console.log('=== TOTAL ACTIVE === ' + total.rows[0].cnt + ' meters');

        // 6. TOU tariff
        try {
            const tou = await pool.query('SELECT * FROM tou_tariff_config WHERE is_active = true ORDER BY effective_date DESC LIMIT 3');
            console.log('\n=== TOU TARIFF CONFIG ===');
            tou.rows.forEach(r => console.log(JSON.stringify(r)));
        } catch (e) {
            console.log('\n=== TOU TARIFF CONFIG === Table not exist (defaults used)');
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

check();
