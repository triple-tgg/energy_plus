import pool from '../config/database';
import { aggregationService } from '../modules/aggregation/aggregation.service';
import { aggregationConfig } from '../config/aggregation';

interface TestResult {
    name: string;
    status: 'PASS' | 'FAIL';
    details: Record<string, unknown>;
}

const results: TestResult[] = [];

const record = (name: string, status: 'PASS' | 'FAIL', details: Record<string, unknown> = {}) => {
    results.push({ name, status, details });
};

async function main() {
    await aggregationService.ensureSchema();
    record('schema setup', 'PASS', { message: 'indexes, job log, and realtime mapping table are ready' });

    const schemaCheck = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('aggregation_job_runs', 'realtime_meter_map')
        ORDER BY table_name
    `);
    const tables = schemaCheck.rows.map((row) => row.table_name);
    record('required tables exist', tables.length === 2 ? 'PASS' : 'FAIL', { tables });

    const realtime = await pool.query(`
        SELECT channel, site_id, address_id, date_trunc('minute', max(received_at)) AS to_time
        FROM meter_data_realtime
        GROUP BY channel, site_id, address_id
        ORDER BY max(received_at) DESC
        LIMIT 1
    `);
    if (realtime.rowCount === 0) {
        record('realtime source available', 'FAIL', { message: 'meter_data_realtime has no rows' });
        return;
    }
    record('realtime source available', 'PASS', realtime.rows[0]);

    const meter = await pool.query(`
        SELECT meter_id, meter_code, meter_name
        FROM meter
        ORDER BY meter_id
        LIMIT 1
    `);
    if (meter.rowCount === 0) {
        record('meter master available', 'FAIL', { message: 'meter table has no rows' });
        return;
    }
    record('meter master available', 'PASS', meter.rows[0]);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const source = realtime.rows[0];
        const target = meter.rows[0];
        const toTime = new Date(source.to_time);
        const fromTime = new Date(toTime.getTime() - 10 * 60 * 1000);
        const testDate = toTime.toISOString().slice(0, 10);
        const testMonth = testDate.slice(0, 7);

        await client.query(
            `
            INSERT INTO realtime_meter_map (
                channel, realtime_site_id, realtime_address_id, meter_id
            )
            VALUES ($1, $2, $3, $4)
            `,
            [source.channel, source.site_id, source.address_id, target.meter_id]
        );

        const minuteResult = await client.query(
            `
            WITH raw AS (
                SELECT
                    COALESCE(rmm.meter_id, m.meter_id) AS meter_id,
                    date_trunc('minute', r.received_at) AS date_keep,
                    r.*,
                    row_number() OVER (
                        PARTITION BY COALESCE(rmm.meter_id, m.meter_id), date_trunc('minute', r.received_at)
                        ORDER BY r.received_at DESC, r.id DESC
                    ) AS latest_rank
                FROM meter_data_realtime r
                LEFT JOIN realtime_meter_map rmm
                  ON rmm.realtime_site_id = r.site_id
                 AND rmm.realtime_address_id = r.address_id
                 AND rmm.is_active = true
                 AND (rmm.channel IS NULL OR rmm.channel = r.channel)
                LEFT JOIN meter m
                  ON m.site_id = r.site_id
                 AND m.address::text = r.address_id::text
                 AND rmm.id IS NULL
                WHERE r.received_at >= $1
                  AND r.received_at < $2
                  AND COALESCE(rmm.meter_id, m.meter_id) IS NOT NULL
            ),
            agg AS (
                SELECT
                    latest.meter_id,
                    latest.date_keep,
                    latest.kva_3ph AS energy_kva,
                    latest.kw_3ph AS energy_kw,
                    latest.kvar_3ph AS energy_kvar,
                    latest.hz AS energy_frequency,
                    latest.vl1 AS energy_volt_p1,
                    latest.vl2 AS energy_volt_p2,
                    latest.vl3 AS energy_volt_p3,
                    latest.vl12 AS energy_volt_l1,
                    latest.vl23 AS energy_volt_l2,
                    latest.vl31 AS energy_volt_l3,
                    latest.il1 AS energy_amp1,
                    latest.il2 AS energy_amp2,
                    latest.il3 AS energy_amp3,
                    latest.pf1 AS energy_pf1,
                    latest.pf2 AS energy_pf2,
                    latest.pf3 AS energy_pf3,
                    latest.import_kwhr AS energy_kwh,
                    counts.rows_read
                FROM raw latest
                JOIN (
                    SELECT meter_id, date_keep, COUNT(*)::int AS rows_read
                    FROM raw
                    GROUP BY meter_id, date_keep
                ) counts
                  ON counts.meter_id = latest.meter_id
                 AND counts.date_keep = latest.date_keep
                WHERE latest.latest_rank = 1
            ),
            upserted AS (
                INSERT INTO actual_meter_data (
                    meter_id, date_keep, energy_kva, energy_kw, energy_kvar, energy_frequency,
                    energy_volt_p1, energy_volt_p2, energy_volt_p3,
                    energy_volt_l1, energy_volt_l2, energy_volt_l3,
                    energy_amp1, energy_amp2, energy_amp3,
                    energy_pf1, energy_pf2, energy_pf3,
                    energy_kwh, status
                )
                SELECT
                    meter_id, date_keep, energy_kva, energy_kw, energy_kvar, energy_frequency,
                    energy_volt_p1, energy_volt_p2, energy_volt_p3,
                    energy_volt_l1, energy_volt_l2, energy_volt_l3,
                    energy_amp1, energy_amp2, energy_amp3,
                    energy_pf1, energy_pf2, energy_pf3,
                    energy_kwh, 'online'
                FROM agg
                ON CONFLICT (meter_id, date_keep) DO UPDATE SET
                    energy_kva = EXCLUDED.energy_kva,
                    energy_kw = EXCLUDED.energy_kw,
                    energy_kvar = EXCLUDED.energy_kvar,
                    energy_frequency = EXCLUDED.energy_frequency,
                    energy_volt_p1 = EXCLUDED.energy_volt_p1,
                    energy_volt_p2 = EXCLUDED.energy_volt_p2,
                    energy_volt_p3 = EXCLUDED.energy_volt_p3,
                    energy_volt_l1 = EXCLUDED.energy_volt_l1,
                    energy_volt_l2 = EXCLUDED.energy_volt_l2,
                    energy_volt_l3 = EXCLUDED.energy_volt_l3,
                    energy_amp1 = EXCLUDED.energy_amp1,
                    energy_amp2 = EXCLUDED.energy_amp2,
                    energy_amp3 = EXCLUDED.energy_amp3,
                    energy_pf1 = EXCLUDED.energy_pf1,
                    energy_pf2 = EXCLUDED.energy_pf2,
                    energy_pf3 = EXCLUDED.energy_pf3,
                    energy_kwh = EXCLUDED.energy_kwh,
                    status = EXCLUDED.status
                RETURNING 1
            )
            SELECT
                COALESCE((SELECT SUM(rows_read)::int FROM agg), 0) AS rows_read,
                (SELECT COUNT(*)::int FROM upserted) AS rows_written
            `,
            [fromTime, toTime]
        );
        const minute = minuteResult.rows[0];
        record('minute aggregation rollback test', minute.rows_written > 0 ? 'PASS' : 'FAIL', {
            fromTime,
            toTime,
            rowsRead: minute.rows_read,
            rowsWritten: minute.rows_written,
            temporaryMapping: {
                channel: source.channel,
                realtimeSiteId: source.site_id,
                realtimeAddressId: source.address_id,
                meterId: target.meter_id,
            },
        });

        const dailyResult = await client.query(
            `
            WITH ranked AS (
                SELECT
                    meter_id,
                    $1::date AS date_keep,
                    energy_kwh AS total_kwh,
                    energy_kw AS max_kw,
                    energy_kw AS min_kw,
                    energy_kw AS avg_kw,
                    row_number() OVER (
                        PARTITION BY meter_id
                        ORDER BY date_keep DESC, id DESC
                    ) AS latest_rank
                FROM actual_meter_data
                WHERE (date_keep AT TIME ZONE $2)::date = $1::date
            ),
            agg AS (
                SELECT meter_id, date_keep, total_kwh, max_kw, min_kw, avg_kw
                FROM ranked
                WHERE latest_rank = 1
            ),
            upserted AS (
                INSERT INTO actual_meter_data_daily (
                    meter_id, date_keep, total_kwh, max_kw, min_kw, avg_kw
                )
                SELECT meter_id, date_keep, total_kwh, max_kw, min_kw, avg_kw
                FROM agg
                ON CONFLICT (meter_id, date_keep) DO UPDATE SET
                    total_kwh = EXCLUDED.total_kwh,
                    max_kw = EXCLUDED.max_kw,
                    min_kw = EXCLUDED.min_kw,
                    avg_kw = EXCLUDED.avg_kw
                RETURNING 1
            )
            SELECT
                (SELECT COUNT(*)::int FROM agg) AS rows_read,
                (SELECT COUNT(*)::int FROM upserted) AS rows_written
            `,
            [testDate, aggregationConfig.timezone]
        );
        const daily = dailyResult.rows[0];
        record('daily aggregation rollback test', daily.rows_written > 0 ? 'PASS' : 'FAIL', {
            date: testDate,
            rowsRead: daily.rows_read,
            rowsWritten: daily.rows_written,
        });

        const monthlyResult = await client.query(
            `
            WITH agg AS (
                SELECT
                    meter_id,
                    $1 AS year_month,
                    total_kwh,
                    max_kw,
                    avg_kw
                FROM (
                    SELECT
                        meter_id,
                        date_keep,
                        total_kwh,
                        max_kw,
                        avg_kw,
                        row_number() OVER (
                            PARTITION BY meter_id
                            ORDER BY date_keep DESC, id DESC
                        ) AS latest_rank
                    FROM actual_meter_data_daily
                    WHERE to_char(date_keep, 'YYYY-MM') = $1
                ) ranked
                WHERE latest_rank = 1
            ),
            upserted AS (
                INSERT INTO actual_meter_data_monthly (
                    meter_id, year_month, total_kwh, max_kw, avg_kw
                )
                SELECT meter_id, year_month, total_kwh, max_kw, avg_kw
                FROM agg
                ON CONFLICT (meter_id, year_month) DO UPDATE SET
                    total_kwh = EXCLUDED.total_kwh,
                    max_kw = EXCLUDED.max_kw,
                    avg_kw = EXCLUDED.avg_kw
                RETURNING 1
            )
            SELECT
                (SELECT COUNT(*)::int FROM agg) AS rows_read,
                (SELECT COUNT(*)::int FROM upserted) AS rows_written
            `,
            [testMonth]
        );
        const monthly = monthlyResult.rows[0];
        record('monthly aggregation rollback test', monthly.rows_written > 0 ? 'PASS' : 'FAIL', {
            month: testMonth,
            rowsRead: monthly.rows_read,
            rowsWritten: monthly.rows_written,
        });

        const cleanupDryRun = await client.query(
            `
            SELECT COUNT(*)::int AS rows_older_than_retention
            FROM meter_data_realtime
            WHERE received_at < NOW() - ($1::text || ' months')::interval
            `,
            [aggregationConfig.retentionMonths]
        );
        record('retention dry-run count', 'PASS', {
            retentionMonths: aggregationConfig.retentionMonths,
            rowsOlderThanRetention: cleanupDryRun.rows[0].rows_older_than_retention,
        });

        await client.query('ROLLBACK');
        record('rollback completed', 'PASS', { message: 'temporary mapping and aggregate rows were not persisted' });
    } catch (error: any) {
        await client.query('ROLLBACK');
        record('rollback completed', 'PASS', { message: 'rolled back after test error' });
        throw error;
    } finally {
        client.release();
    }
}

main()
    .then(() => {
        const failed = results.filter((result) => result.status === 'FAIL');
        console.log(JSON.stringify({ status: failed.length === 0 ? 'PASS' : 'FAIL', results }, null, 2));
        process.exitCode = failed.length === 0 ? 0 : 1;
    })
    .catch((error) => {
        record('unexpected error', 'FAIL', { message: error.message });
        console.log(JSON.stringify({ status: 'FAIL', results }, null, 2));
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
