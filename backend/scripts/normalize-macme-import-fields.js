const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000,
});

const buildRealtimeChannel = (project, siteEl, loopNo) => {
  const projectKey = String(project || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  return `${projectKey || 'project'}_${siteEl}_${loopNo || 1}`;
};

const main = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const meters = await client.query(`
      SELECT m.meter_id, m.address::int AS address_id, s.site_name, l.port_no AS loop_no
      FROM meter m
      JOIN sites s ON s.site_id = m.site_id
      LEFT JOIN loop l ON l.loop_id = m.loop_id
      WHERE m.is_active IS DISTINCT FROM false
      ORDER BY m.address::int
    `);

    for (const meter of meters.rows) {
      const siteEl = 1000;
      const realtimeChannel = buildRealtimeChannel(meter.site_name, siteEl, meter.loop_no);
      await client.query(
        `UPDATE realtime_meter_map
         SET is_active = false, updated_at = NOW()
         WHERE meter_id = $1`,
        [meter.meter_id]
      );

      const existing = await client.query(
        `SELECT id
         FROM realtime_meter_map
         WHERE realtime_site_id = $1
           AND realtime_address_id = $2
           AND channel = $3
         LIMIT 1`,
        [siteEl, meter.address_id, realtimeChannel]
      );

      if (existing.rows.length > 0) {
        await client.query(
          `UPDATE realtime_meter_map
           SET meter_id = $1, is_active = true, updated_at = NOW()
           WHERE id = $2`,
          [meter.meter_id, existing.rows[0].id]
        );
      } else {
        await client.query(
          `INSERT INTO realtime_meter_map (
            channel, realtime_site_id, realtime_address_id, meter_id, is_active, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
          [realtimeChannel, siteEl, meter.address_id, meter.meter_id]
        );
      }
    }

    const result = await client.query(`
      SELECT
        m.meter_code,
        m.address,
        s.site_name AS project,
        latest.energy_kwh::float AS previous_kwh,
        rmm.channel,
        rmm.realtime_site_id AS site_el,
        rmm.realtime_address_id
      FROM meter m
      JOIN sites s ON s.site_id = m.site_id
      LEFT JOIN LATERAL (
        SELECT energy_kwh
        FROM actual_meter_data d
        WHERE d.meter_id = m.meter_id
        ORDER BY d.date_keep DESC, d.id DESC
        LIMIT 1
      ) latest ON true
      LEFT JOIN realtime_meter_map rmm
        ON rmm.meter_id = m.meter_id
       AND rmm.is_active = true
      WHERE m.is_active IS DISTINCT FROM false
      ORDER BY m.address::int
    `);

    await client.query('COMMIT');
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
