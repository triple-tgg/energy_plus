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

const main = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const active = await client.query(`
      SELECT meter_id, meter_code, site_id, address::int AS address_id
      FROM meter
      WHERE is_active IS DISTINCT FROM false
      ORDER BY meter_id
    `);
    const activeIds = active.rows.map((row) => row.meter_id);
    const activeAddresses = active.rows.map((row) => row.address_id);
    const realtimeSiteIds = [1000, ...new Set(active.rows.map((row) => row.site_id))];

    const before = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM meter_data_realtime)::int AS realtime,
        (SELECT COUNT(*) FROM actual_meter_data)::int AS actual,
        (SELECT COUNT(*) FROM actual_meter_data_daily)::int AS daily,
        (SELECT COUNT(*) FROM actual_meter_data_monthly)::int AS monthly
    `);

    const deletedActual = await client.query(
      'DELETE FROM actual_meter_data WHERE NOT (meter_id = ANY($1::int[]))',
      [activeIds]
    );
    const deletedDaily = await client.query(
      'DELETE FROM actual_meter_data_daily WHERE NOT (meter_id = ANY($1::int[]))',
      [activeIds]
    );
    const deletedMonthly = await client.query(
      'DELETE FROM actual_meter_data_monthly WHERE NOT (meter_id = ANY($1::int[]))',
      [activeIds]
    );

    const deletedRealtime = await client.query(
      `
      DELETE FROM meter_data_realtime r
      WHERE NOT (
        EXISTS (
          SELECT 1
          FROM realtime_meter_map rmm
          WHERE rmm.is_active = true
            AND rmm.meter_id = ANY($1::int[])
            AND rmm.realtime_site_id = r.site_id
            AND rmm.realtime_address_id = r.address_id
            AND (rmm.channel IS NULL OR rmm.channel = r.channel)
        )
        OR (
          r.site_id = ANY($2::int[])
          AND r.address_id = ANY($3::int[])
        )
      )
      `,
      [activeIds, realtimeSiteIds, activeAddresses]
    );

    const after = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM meter_data_realtime)::int AS realtime,
        (SELECT COUNT(*) FROM actual_meter_data)::int AS actual,
        (SELECT COUNT(*) FROM actual_meter_data_daily)::int AS daily,
        (SELECT COUNT(*) FROM actual_meter_data_monthly)::int AS monthly,
        (SELECT COALESCE(SUM(energy_kwh), 0)::float FROM actual_meter_data)::float AS actual_kwh
    `);

    const realtimeBreakdown = await client.query(`
      SELECT site_id, address_id, COUNT(*)::int AS rows, MAX(received_at) AS latest
      FROM meter_data_realtime
      GROUP BY site_id, address_id
      ORDER BY site_id, address_id
    `);

    await client.query('COMMIT');
    console.log(JSON.stringify({
      activeMeters: active.rows,
      preservedRealtimeSiteIds: realtimeSiteIds,
      before: before.rows[0],
      deleted: {
        realtime: deletedRealtime.rowCount,
        actual: deletedActual.rowCount,
        daily: deletedDaily.rowCount,
        monthly: deletedMonthly.rowCount,
      },
      after: after.rows[0],
      realtimeBreakdown: realtimeBreakdown.rows,
    }, null, 2));
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
