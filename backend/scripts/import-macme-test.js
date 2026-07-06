const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const XLSX = require('../../frontend/node_modules/xlsx');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const workbookPath = '/Users/taeypro14/Triple-T/EnergyPlus/FileMacMe/import test R1 06072026.xlsx';

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

const readRows = () => {
  const workbook = XLSX.readFile(workbookPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })
    .slice(1)
    .filter((row) => row[2] != null && row[8] != null)
    .map((row) => ({
      address: String(row[2]).trim(),
      circuit: row[4] ? String(row[4]) : null,
      building: String(row[5]).trim(),
      zone: String(row[6]).trim(),
      meterType: String(row[7]).trim(),
      meterCode: String(row[8]).trim(),
      meterName: String(row[9]).trim(),
      roomCode: String(row[10]).trim(),
      roomName: String(row[11]).trim(),
      loop: Number(row[12]),
      model: String(row[13]).trim(),
      siteName: String(row[14]).trim(),
      siteEl: Number(row[15] || 0),
      phase: Number(row[16]),
      floor: Number(row[17]),
      previousKwh: Number(row[18] || 0),
      currentKwh: Number(row[21] || 0),
    }));
};

const getOrCreateOne = async (client, selectSql, insertSql, params) => {
  const existing = await client.query(selectSql, params.slice(0, 1));
  if (existing.rows.length) return existing.rows[0];
  const created = await client.query(insertSql, params);
  return created.rows[0];
};

const getOrCreateSite = async (client, siteName) => {
  return getOrCreateOne(
    client,
    'SELECT site_id FROM sites WHERE site_name = $1',
    `INSERT INTO sites (site_name, site_status, created_by, created_on)
     VALUES ($1, true, $2, NOW())
     RETURNING site_id`,
    [siteName || 'Project 1', 'macme-import']
  );
};

const getOrCreateMeterType = async (client, meterTypeName) => {
  return getOrCreateOne(
    client,
    'SELECT meter_type_id FROM meter_type WHERE meter_type_name = $1',
    `INSERT INTO meter_type (meter_type_name, is_active)
     VALUES ($1, true)
     RETURNING meter_type_id`,
    [meterTypeName || 'ELE']
  );
};

const getOrCreateBrand = async (client, modelName) => {
  return getOrCreateOne(
    client,
    'SELECT meter_brand_id FROM meter_brand WHERE model_name = $1 OR meter_brand_name = $1',
    `INSERT INTO meter_brand (meter_brand_name, model_name, is_active)
     VALUES ($1, $1, true)
     RETURNING meter_brand_id`,
    [modelName || 'MPR-45S']
  );
};

const getOrCreateLoop = async (client, loopNo) => {
  let loop = (await client.query('SELECT loop_id FROM loop WHERE port_no = $1', [loopNo])).rows[0];
  if (!loop) {
    loop = (await client.query(
      `INSERT INTO loop (loop_name, port_no, baudrate, is_active)
       VALUES ($1, $2, 9600, true)
       RETURNING loop_id`,
      [`Loop ${loopNo}`, loopNo]
    )).rows[0];
  }
  return loop;
};

const main = async () => {
  const rows = readRows();
  if (rows.length !== 6) {
    throw new Error(`Expected 6 meter rows, found ${rows.length}`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`ALTER TABLE meter ADD COLUMN IF NOT EXISTS site VARCHAR(200)`);
    await client.query(`ALTER TABLE meter ADD COLUMN IF NOT EXISTS site_el INTEGER`);

    const before = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM meter WHERE is_active IS DISTINCT FROM false)::int AS active_meters,
        (SELECT COUNT(*) FROM meter)::int AS total_meters,
        (SELECT COUNT(*) FROM actual_meter_data)::int AS readings
    `);

    const buildingIds = new Map();
    const zoneIds = new Map();
    const importedMeterIds = [];

    for (const row of rows) {
      const site = await getOrCreateSite(client, row.siteName);
      const siteId = site.site_id;
      const meterType = await getOrCreateMeterType(client, row.meterType);
      const brand = await getOrCreateBrand(client, row.model);
      const loop = await getOrCreateLoop(client, row.loop || 1);

      await client.query(
        `INSERT INTO site_user_map (site_id, user_id)
         SELECT $1, user_id FROM app_user WHERE is_active IS DISTINCT FROM false
         ON CONFLICT DO NOTHING`,
        [siteId]
      );

      const buildingKey = `${siteId}::${row.building}`;
      if (!buildingIds.has(buildingKey)) {
        const existingBuilding = await client.query(
          'SELECT building_id FROM buildings WHERE building_name = $1 AND site_id = $2',
          [row.building, siteId]
        );
        const resolved = existingBuilding.rows[0] || (await client.query(
          `INSERT INTO buildings (building_name, site_id, is_active, created_by, created_on)
           VALUES ($1, $2, true, 'macme-import', NOW())
           RETURNING building_id`,
          [row.building, siteId]
        )).rows[0];
        buildingIds.set(buildingKey, resolved.building_id);
      }

      const zoneKey = `${buildingIds.get(buildingKey)}::${row.zone}`;
      if (!zoneIds.has(zoneKey)) {
        const existingZone = await client.query(
          'SELECT zone_id FROM zones WHERE zone_name = $1 AND building_id = $2',
          [row.zone, buildingIds.get(buildingKey)]
        );
        const resolved = existingZone.rows[0] || (await client.query(
          `INSERT INTO zones (zone_name, building_id, is_show_dashboard, created_on)
           VALUES ($1, $2, true, NOW())
           RETURNING zone_id`,
          [row.zone, buildingIds.get(buildingKey)]
        )).rows[0];
        zoneIds.set(zoneKey, resolved.zone_id);
      }

      const existing = await client.query('SELECT meter_id FROM meter WHERE meter_code = $1', [row.meterCode]);
      let meterId;
      if (existing.rows.length) {
        meterId = existing.rows[0].meter_id;
        await client.query(
          `UPDATE meter
           SET meter_name = $2, address = $3, meter_brand_id = $4, meter_type_id = $5, loop_id = $6,
               site_id = $7, building_id = $8, zone_id = $9, is_active = true, room_code = $10,
               room_name = $11, phase = $12, circuit = $13, floor = $14, status = 'Imported',
               site = $15, site_el = $16, last_modified_by = 'macme-import', last_modified_on = NOW()
           WHERE meter_id = $1`,
          [
            meterId,
            row.meterName,
            row.address,
            brand.meter_brand_id,
            meterType.meter_type_id,
            loop.loop_id,
            siteId,
            buildingIds.get(buildingKey),
            zoneIds.get(zoneKey),
            row.roomCode,
            row.roomName,
            row.phase,
            row.circuit,
            row.floor,
            row.siteName,
            Number.isFinite(row.siteEl) ? row.siteEl : null,
          ]
        );
      } else {
        const inserted = await client.query(
          `INSERT INTO meter (
             meter_code, meter_name, address, meter_brand_id, meter_type_id, loop_id,
             site_id, building_id, zone_id, is_active, room_code, room_name,
             phase, circuit, floor, site, site_el, status, created_by, created_on
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11, $12, $13, $14, $15, $16, 'Imported', 'macme-import', NOW())
           RETURNING meter_id`,
          [
            row.meterCode,
            row.meterName,
            row.address,
            brand.meter_brand_id,
            meterType.meter_type_id,
            loop.loop_id,
            siteId,
            buildingIds.get(buildingKey),
            zoneIds.get(zoneKey),
            row.roomCode,
            row.roomName,
            row.phase,
            row.circuit,
            row.floor,
            row.siteName,
            Number.isFinite(row.siteEl) ? row.siteEl : null,
          ]
        );
        meterId = inserted.rows[0].meter_id;
      }

      importedMeterIds.push(meterId);
      if (row.siteEl > 0) {
        const realtimeChannel = buildRealtimeChannel(row.siteName, row.siteEl, row.loop);
        await client.query(
          `UPDATE realtime_meter_map
           SET is_active = false, updated_at = NOW()
           WHERE meter_id = $1
             AND NOT (realtime_site_id = $2 AND realtime_address_id = $3 AND channel = $4)`,
          [meterId, row.siteEl, Number(row.address), realtimeChannel]
        );
        const existingMap = await client.query(
          `SELECT id FROM realtime_meter_map
           WHERE realtime_site_id = $1
             AND realtime_address_id = $2
             AND channel = $3
           LIMIT 1`,
          [row.siteEl, Number(row.address), realtimeChannel]
        );
        if (existingMap.rows.length > 0) {
          await client.query(
            `UPDATE realtime_meter_map
             SET meter_id = $1, is_active = true, updated_at = NOW()
             WHERE id = $2`,
            [meterId, existingMap.rows[0].id]
          );
        } else {
          await client.query(
            `INSERT INTO realtime_meter_map (
              channel, realtime_site_id, realtime_address_id, meter_id, is_active, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
            [realtimeChannel, row.siteEl, Number(row.address), meterId]
          );
        }
      }

      const reading = row.currentKwh > 0 ? row.currentKwh : row.previousKwh;
      await client.query('DELETE FROM actual_meter_data WHERE meter_id = $1', [meterId]);
      await client.query('DELETE FROM actual_meter_data_daily WHERE meter_id = $1', [meterId]);
      await client.query('DELETE FROM actual_meter_data_monthly WHERE meter_id = $1', [meterId]);
      if (reading > 0) {
        await client.query(
          `INSERT INTO actual_meter_data (meter_id, date_keep, energy_kwh, status)
           VALUES ($1, NOW(), $2, 'online')`,
          [meterId, reading]
        );
        await client.query(
          `INSERT INTO actual_meter_data_daily (meter_id, date_keep, total_kwh, max_kw, min_kw, avg_kw)
           VALUES ($1, CURRENT_DATE, $2, 0, 0, 0)`,
          [meterId, reading]
        );
        await client.query(
          `INSERT INTO actual_meter_data_monthly (meter_id, year_month, total_kwh, max_kw, avg_kw)
           VALUES ($1, to_char(CURRENT_DATE, 'YYYY-MM'), $2, 0, 0)`,
          [meterId, reading]
        );
      }
    }

    const after = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM meter WHERE is_active IS DISTINCT FROM false)::int AS active_meters,
        (SELECT COUNT(*) FROM meter)::int AS total_meters,
        (SELECT COUNT(*) FROM actual_meter_data WHERE meter_id = ANY($1::int[]))::int AS imported_readings,
        (SELECT COALESCE(SUM(energy_kwh), 0)::float FROM actual_meter_data WHERE meter_id = ANY($1::int[])) AS imported_kwh
    `, [importedMeterIds]);

    const detail = await client.query(
      `SELECT m.meter_code, m.meter_name, m.address, m.floor, m.room_code, m.room_name,
              s.site_name, b.building_name, z.zone_name, amd.energy_kwh::float
       FROM meter m
       JOIN sites s ON s.site_id = m.site_id
       JOIN buildings b ON b.building_id = m.building_id
       JOIN zones z ON z.zone_id = m.zone_id
       LEFT JOIN actual_meter_data amd ON amd.meter_id = m.meter_id
       WHERE m.meter_id = ANY($1::int[])
       ORDER BY m.address::int`,
      [importedMeterIds]
    );

    await client.query('COMMIT');
    console.log(JSON.stringify({
      fileRows: rows.length,
      before: before.rows[0],
      after: after.rows[0],
      meters: detail.rows,
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
