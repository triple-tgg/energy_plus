import { PoolClient } from 'pg';
import pool from '../../config/database';
import { aggregationConfig } from '../../config/aggregation';

type JobStatus = 'success' | 'skipped' | 'failed';

interface JobLogInput {
    jobName: string;
    bucketStart?: Date | string | null;
    bucketEnd?: Date | string | null;
    status: JobStatus;
    rowsRead?: number;
    rowsWritten?: number;
    rowsSkipped?: number;
    errorMessage?: string | null;
    startedAt: Date;
}

const advisoryLockIds: Record<string, number> = {
    minute: 9101001,
    daily: 9101002,
    monthly: 9101003,
    retention: 9101004,
    compaction: 9101005,
};

export interface CompactionResult {
    retentionMonths: number;
    dailyBackfilled: number;
    deletedKwhRows: number;
    deletedEleRows: number;
    deletedWaterRows: number;
    totalCompacted: number;
}

const floorToInterval = (date: Date, intervalMinutes: number): Date => {
    const next = new Date(date);
    const flooredMinute = Math.floor(next.getUTCMinutes() / intervalMinutes) * intervalMinutes;
    next.setUTCMinutes(flooredMinute, 0, 0);
    return next;
};

const addMinutes = (date: Date, minutes: number): Date => {
    return new Date(date.getTime() + minutes * 60 * 1000);
};

const formatDateKey = (date: Date, timeZone: string): string => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
};

const formatMonthKey = (date: Date, timeZone: string): string => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}`;
};

const previousDayKey = (timeZone: string): string => {
    return formatDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000), timeZone);
};

const currentMonthKey = (timeZone: string): string => {
    return formatMonthKey(new Date(), timeZone);
};

export class AggregationService {
    async ensureSchema(): Promise<void> {
        await pool.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS uq_actual_meter_data_meter_date
            ON actual_meter_data (meter_id, date_keep)
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_actual_meter_data_date_keep
            ON actual_meter_data (date_keep, meter_id)
        `);

        try {
            await pool.query(`ALTER TABLE IF EXISTS actual_meter_data ALTER COLUMN energy_kwh TYPE DECIMAL(18,3)`);
            await pool.query(`ALTER TABLE IF EXISTS actual_meter_data ALTER COLUMN water_value TYPE DECIMAL(18,3)`);
            await pool.query(`ALTER TABLE IF EXISTS actual_meter_data ALTER COLUMN gas_value TYPE DECIMAL(18,3)`);
            await pool.query(`ALTER TABLE IF EXISTS actual_meter_data_daily ALTER COLUMN total_kwh TYPE DECIMAL(18,3)`);
            await pool.query(`ALTER TABLE IF EXISTS actual_meter_data_daily ALTER COLUMN total_water TYPE DECIMAL(18,3)`);
            await pool.query(`ALTER TABLE IF EXISTS actual_meter_data_daily ALTER COLUMN total_gas TYPE DECIMAL(18,3)`);
            await pool.query(`ALTER TABLE IF EXISTS actual_meter_data_monthly ALTER COLUMN total_kwh TYPE DECIMAL(18,3)`);
            await pool.query(`ALTER TABLE IF EXISTS actual_meter_data_monthly ALTER COLUMN total_water TYPE DECIMAL(18,3)`);
            await pool.query(`ALTER TABLE IF EXISTS actual_meter_data_monthly ALTER COLUMN total_gas TYPE DECIMAL(18,3)`);
        } catch (_) {
            // Ignore if a view depends on the column
        }

        await pool.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS uq_actual_meter_data_daily_meter_date
            ON actual_meter_data_daily (meter_id, date_keep)
        `);

        await pool.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS uq_actual_meter_data_monthly_meter_month
            ON actual_meter_data_monthly (meter_id, year_month)
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_meter_realtime_received_bucket
            ON meter_data_realtime (received_at, site_id, address_id)
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_meter_site_address
            ON meter (site_el, address)
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS realtime_meter_map (
                id SERIAL PRIMARY KEY,
                channel VARCHAR(100),
                realtime_site_id INTEGER NOT NULL,
                realtime_address_id INTEGER NOT NULL,
                meter_id INTEGER NOT NULL REFERENCES meter(meter_id),
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        await pool.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS uq_realtime_meter_map_active
            ON realtime_meter_map (
                COALESCE(channel, ''),
                realtime_site_id,
                realtime_address_id
            )
            WHERE is_active = true
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS aggregation_job_runs (
                id BIGSERIAL PRIMARY KEY,
                job_name VARCHAR(100) NOT NULL,
                bucket_start TIMESTAMPTZ,
                bucket_end TIMESTAMPTZ,
                status VARCHAR(20) NOT NULL,
                rows_read INTEGER DEFAULT 0,
                rows_written INTEGER DEFAULT 0,
                rows_skipped INTEGER DEFAULT 0,
                error_message TEXT,
                started_at TIMESTAMPTZ DEFAULT NOW(),
                finished_at TIMESTAMPTZ
            )
        `);

        await pool.query(`ALTER TABLE IF EXISTS aggregation_job_runs ADD COLUMN IF NOT EXISTS job_name VARCHAR(100) NOT NULL DEFAULT 'job'`);
        await pool.query(`ALTER TABLE IF EXISTS aggregation_job_runs ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'success'`);
        await pool.query(`ALTER TABLE IF EXISTS aggregation_job_runs ADD COLUMN IF NOT EXISTS rows_read INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE IF EXISTS aggregation_job_runs ADD COLUMN IF NOT EXISTS rows_written INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE IF EXISTS aggregation_job_runs ADD COLUMN IF NOT EXISTS rows_skipped INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE IF EXISTS aggregation_job_runs ADD COLUMN IF NOT EXISTS bucket_start TIMESTAMPTZ`);
        await pool.query(`ALTER TABLE IF EXISTS aggregation_job_runs ADD COLUMN IF NOT EXISTS bucket_end TIMESTAMPTZ`);
        await pool.query(`ALTER TABLE IF EXISTS aggregation_job_runs ADD COLUMN IF NOT EXISTS error_message TEXT`);
        await pool.query(`ALTER TABLE IF EXISTS aggregation_job_runs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW()`);
        await pool.query(`ALTER TABLE IF EXISTS aggregation_job_runs ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ`);
    }

    async aggregateRecentMinutes(now = new Date()): Promise<void> {
        const toTime = floorToInterval(now, aggregationConfig.intervalMinutes);
        const fromTime = addMinutes(toTime, -aggregationConfig.lookbackMinutes);
        await this.aggregateMinuteRange(fromTime, toTime);
    }

    async aggregateMinuteRange(fromTime: Date, toTime: Date): Promise<void> {
        await this.runWithLock('minute', async (client) => {
            const startedAt = new Date();
            try {
                const result = await client.query(
                    `
                    WITH raw AS (
                        SELECT
                            COALESCE(rmm.meter_id, m.meter_id) AS meter_id,
                            date_trunc('hour', r.received_at)
                              + (floor(extract(minute from r.received_at) / $3::int) * $3::int) * interval '1 minute'
                              AS date_keep,
                            r.*,
                            row_number() OVER (
                                PARTITION BY
                                    COALESCE(rmm.meter_id, m.meter_id),
                                    date_trunc('hour', r.received_at)
                                      + (floor(extract(minute from r.received_at) / $3::int) * $3::int) * interval '1 minute'
                                ORDER BY r.received_at DESC, r.id DESC
                            ) AS latest_rank
                        FROM meter_data_realtime r
                        LEFT JOIN realtime_meter_map rmm
                          ON rmm.realtime_site_id = r.site_id
                         AND rmm.realtime_address_id = r.address_id
                         AND rmm.is_active = true
                         AND (rmm.channel IS NULL OR rmm.channel = r.channel)
                        LEFT JOIN meter m
                          ON (m.site_el::text = r.channel OR (m.site_el::text = r.site_id::text AND m.address::text = r.address_id::text))
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
                            CASE
                                WHEN mt_info.meter_type_id = 2
                                  OR COALESCE(mt_info.meter_type_name, '') ILIKE '%water%'
                                  OR COALESCE(mt_info.meter_type_name, '') ILIKE '%wtr%'
                                  OR COALESCE(mt_info.meter_type_name, '') ILIKE '%น้ำ%'
                                THEN latest.import_kwhr
                                ELSE NULL
                            END AS water_value,
                            counts.rows_read
                        FROM raw latest
                        LEFT JOIN meter m_info ON m_info.meter_id = latest.meter_id
                        LEFT JOIN meter_type mt_info ON mt_info.meter_type_id = m_info.meter_type_id
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
                            energy_kwh, water_value, status
                        )
                        SELECT
                            meter_id, date_keep, energy_kva, energy_kw, energy_kvar, energy_frequency,
                            energy_volt_p1, energy_volt_p2, energy_volt_p3,
                            energy_volt_l1, energy_volt_l2, energy_volt_l3,
                            energy_amp1, energy_amp2, energy_amp3,
                            energy_pf1, energy_pf2, energy_pf3,
                            energy_kwh, water_value, 'online'
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
                            water_value = COALESCE(EXCLUDED.water_value, actual_meter_data.water_value),
                            status = EXCLUDED.status
                        RETURNING 1
                    ),
                    skipped AS (
                        SELECT COUNT(*)::int AS rows_skipped
                        FROM meter_data_realtime r
                        LEFT JOIN realtime_meter_map rmm
                          ON rmm.realtime_site_id = r.site_id
                         AND rmm.realtime_address_id = r.address_id
                         AND rmm.is_active = true
                         AND (rmm.channel IS NULL OR rmm.channel = r.channel)
                        LEFT JOIN meter m
                          ON (m.site_el::text = r.channel OR (m.site_el::text = r.site_id::text AND m.address::text = r.address_id::text))
                         AND rmm.id IS NULL
                        WHERE r.received_at >= $1
                          AND r.received_at < $2
                          AND COALESCE(rmm.meter_id, m.meter_id) IS NULL
                    )
                    SELECT
                        COALESCE((SELECT SUM(rows_read)::int FROM agg), 0) AS rows_read,
                        (SELECT COUNT(*)::int FROM upserted) AS rows_written,
                        (SELECT rows_skipped FROM skipped) AS rows_skipped
                    `,
                    [fromTime, toTime, aggregationConfig.intervalMinutes]
                );

                await this.logJob({
                    jobName: 'minute',
                    bucketStart: fromTime,
                    bucketEnd: toTime,
                    status: 'success',
                    rowsRead: result.rows[0]?.rows_read || 0,
                    rowsWritten: result.rows[0]?.rows_written || 0,
                    rowsSkipped: result.rows[0]?.rows_skipped || 0,
                    startedAt,
                });
            } catch (error: any) {
                await this.logJob({
                    jobName: 'minute',
                    bucketStart: fromTime,
                    bucketEnd: toTime,
                    status: 'failed',
                    errorMessage: error.message,
                    startedAt,
                });
                throw error;
            }
        });
    }

    async aggregatePreviousDay(): Promise<void> {
        await this.aggregateDaily(previousDayKey(aggregationConfig.timezone));
    }

    async aggregateDaily(targetDate: string): Promise<void> {
        await this.runWithLock('daily', async (client) => {
            const startedAt = new Date();
            try {
                const result = await client.query(
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
                    [targetDate, aggregationConfig.timezone]
                );

                await this.logJob({
                    jobName: 'daily',
                    bucketStart: targetDate,
                    bucketEnd: targetDate,
                    status: 'success',
                    rowsRead: result.rows[0]?.rows_read || 0,
                    rowsWritten: result.rows[0]?.rows_written || 0,
                    startedAt,
                });
            } catch (error: any) {
                await this.logJob({
                    jobName: 'daily',
                    bucketStart: targetDate,
                    bucketEnd: targetDate,
                    status: 'failed',
                    errorMessage: error.message,
                    startedAt,
                });
                throw error;
            }
        });
    }

    async aggregateCurrentMonth(): Promise<void> {
        await this.aggregateMonthly(currentMonthKey(aggregationConfig.timezone));
    }

    async aggregateMonthly(yearMonth: string): Promise<void> {
        await this.runWithLock('monthly', async (client) => {
            const startedAt = new Date();
            try {
                const result = await client.query(
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
                    [yearMonth]
                );

                await this.logJob({
                    jobName: 'monthly',
                    bucketStart: `${yearMonth}-01`,
                    bucketEnd: `${yearMonth}-01`,
                    status: 'success',
                    rowsRead: result.rows[0]?.rows_read || 0,
                    rowsWritten: result.rows[0]?.rows_written || 0,
                    startedAt,
                });
            } catch (error: any) {
                await this.logJob({
                    jobName: 'monthly',
                    bucketStart: `${yearMonth}-01`,
                    bucketEnd: `${yearMonth}-01`,
                    status: 'failed',
                    errorMessage: error.message,
                    startedAt,
                });
                throw error;
            }
        });
    }

    async cleanupRealtimeData(retentionHours = aggregationConfig.retentionHours): Promise<void> {
        await this.runWithLock('retention', async (client) => {
            const startedAt = new Date();
            let totalDeleted = 0;

            try {
                while (true) {
                    const result = await client.query(
                        `
                        WITH deleted AS (
                            DELETE FROM meter_data_realtime
                            WHERE id IN (
                                SELECT id
                                FROM meter_data_realtime
                                WHERE received_at < NOW() - ($1::text || ' hours')::interval
                                ORDER BY received_at
                                LIMIT $2
                            )
                            RETURNING 1
                        )
                        SELECT COUNT(*)::int AS deleted_count FROM deleted
                        `,
                        [retentionHours, aggregationConfig.cleanupBatchSize]
                    );
                    const deletedCount = result.rows[0]?.deleted_count || 0;
                    totalDeleted += deletedCount;
                    if (deletedCount < aggregationConfig.cleanupBatchSize) {
                        break;
                    }
                }

                // Also clean up any orphaned max demand realtime records older than retentionHours
                try {
                    await client.query(
                        `DELETE FROM meter_max_demand_realtime WHERE received_at < NOW() - ($1::text || ' hours')::interval`,
                        [retentionHours]
                    );
                } catch (_) {
                    // Ignore if table does not exist yet
                }

                if (totalDeleted > 0) {
                    console.log(`🗑️  Retention cleanup: deleted ${totalDeleted} realtime records older than ${retentionHours}h`);
                }

                await this.logJob({
                    jobName: 'retention',
                    status: 'success',
                    rowsWritten: totalDeleted,
                    startedAt,
                });
            } catch (error: any) {
                await this.logJob({
                    jobName: 'retention',
                    status: 'failed',
                    rowsWritten: totalDeleted,
                    errorMessage: error.message,
                    startedAt,
                });
                throw error;
            }
        });

        // After cleaning up realtime data (> 24h), compact historical actual_meter_data (> 3 months)
        await this.compactHistoricalData(aggregationConfig.retentionMonths);
    }

    /**
     * นโยบายการเก็บข้อมูลเพื่อประหยัดพื้นที่ (Time stamp) สำหรับข้อมูลใน actual_meter_data ที่อายุเกิน 3 เดือน:
     * - 3 เดือนแรก: เก็บทุก 15 นาที ทุกประเภทมิเตอร์
     * - หลังจาก 3 เดือน (date_keep < NOW() - INTERVAL '3 months'):
     *   1. ไฟฟ้า (kWh): เหลือ 24 ชม. 1 ค่า (1 ค่าต่อวัน)
     *   2. ไฟฟ้า (ELE): เหลือ ชม.ละ 1 ค่า (1 ค่าต่อชั่วโมง)
     *   3. ไฟฟ้า Main MDB (TOU): เก็บทุก 15 นาที ตลอดการใช้งาน (ไม่ลบข้อมูล)
     *   4. น้ำ (Water): เหลือ 24 ชม. 1 ค่า (1 ค่าต่อวัน)
     */
    async compactHistoricalData(retentionMonths = aggregationConfig.retentionMonths): Promise<CompactionResult> {
        let compactionSummary: CompactionResult = {
            retentionMonths,
            dailyBackfilled: 0,
            deletedKwhRows: 0,
            deletedEleRows: 0,
            deletedWaterRows: 0,
            totalCompacted: 0,
        };

        await this.runWithLock('compaction', async (client) => {
            const startedAt = new Date();
            const tz = aggregationConfig.timezone || 'Asia/Bangkok';

            try {
                // 1. Ensure daily summary (24h 1 value) is backfilled in actual_meter_data_daily
                //    for all historical dates older than retentionMonths before deleting any 15-min rows
                const dailyBackfillRes = await client.query(
                    `
                    WITH daily_agg AS (
                        SELECT
                            d.meter_id,
                            (d.date_keep AT TIME ZONE $2)::date AS day_date,
                            MAX(d.energy_kwh) AS total_kwh,
                            MAX(d.energy_kw) AS max_kw,
                            MIN(d.energy_kw) AS min_kw,
                            AVG(d.energy_kw) AS avg_kw,
                            MAX(COALESCE(d.water_value, CASE WHEN m.meter_type_id = 2 THEN d.energy_kwh ELSE NULL END)) AS total_water,
                            MAX(d.gas_value) AS total_gas
                        FROM actual_meter_data d
                        LEFT JOIN meter m ON m.meter_id = d.meter_id
                        WHERE d.date_keep < NOW() - ($1::text || ' months')::interval
                          AND d.meter_id IS NOT NULL
                        GROUP BY d.meter_id, (d.date_keep AT TIME ZONE $2)::date
                    ),
                    upserted AS (
                        INSERT INTO actual_meter_data_daily (
                            meter_id, date_keep, total_kwh, max_kw, min_kw, avg_kw, total_water, total_gas
                        )
                        SELECT meter_id, day_date, COALESCE(total_kwh, 0), COALESCE(max_kw, 0), COALESCE(min_kw, 0), COALESCE(avg_kw, 0), total_water, total_gas
                        FROM daily_agg
                        ON CONFLICT (meter_id, date_keep) DO UPDATE SET
                            total_kwh = GREATEST(COALESCE(actual_meter_data_daily.total_kwh, 0), COALESCE(EXCLUDED.total_kwh, 0)),
                            max_kw = GREATEST(COALESCE(actual_meter_data_daily.max_kw, 0), COALESCE(EXCLUDED.max_kw, 0)),
                            min_kw = LEAST(COALESCE(actual_meter_data_daily.min_kw, 0), COALESCE(EXCLUDED.min_kw, 0)),
                            avg_kw = COALESCE(EXCLUDED.avg_kw, actual_meter_data_daily.avg_kw, 0),
                            total_water = COALESCE(EXCLUDED.total_water, actual_meter_data_daily.total_water),
                            total_gas = COALESCE(EXCLUDED.total_gas, actual_meter_data_daily.total_gas)
                        RETURNING 1
                    )
                    SELECT COUNT(*)::int AS upserted_count FROM upserted
                    `,
                    [retentionMonths, tz]
                );
                const dailyBackfilled = dailyBackfillRes.rows[0]?.upserted_count || 0;

                // Helper SQL expression classifying each meter into:
                // - 'mdb_tou': Main MDB (TOU) -> keep every 15 minutes forever
                // - 'water':   Water meter    -> after 3 months, keep 1 per 24 hours (1 day)
                // - 'kwh':     kWh meter      -> after 3 months, keep 1 per 24 hours (1 day)
                // - 'ele':     ELE meter      -> after 3 months, keep 1 per hour
                const meterCategoryCte = `
                    meter_categories AS (
                        SELECT
                            m.meter_id,
                            CASE
                                WHEN COALESCE(mst.sub_type_name, '') ILIKE '%MDB%'
                                  OR COALESCE(mst.sub_type_name, '') ILIKE '%TOU%'
                                  OR COALESCE(mt.meter_type_name, '') ILIKE '%MDB%'
                                  OR COALESCE(mt.meter_type_name, '') ILIKE '%TOU%'
                                  OR COALESCE(m.meter_group, '') ILIKE '%MDB%'
                                  OR COALESCE(m.meter_group, '') ILIKE '%TOU%'
                                  OR COALESCE(m.meter_name, '') ILIKE '%MDB%'
                                  OR COALESCE(m.meter_name, '') ILIKE '%TOU%'
                                  OR COALESCE(m.meter_code, '') ILIKE '%MDB%'
                                  OR COALESCE(m.meter_code, '') ILIKE '%TOU%'
                                  OR COALESCE(m.circuit, '') ILIKE '%MDB%'
                                  OR COALESCE(m.circuit, '') ILIKE '%TOU%'
                                THEN 'mdb_tou'
                                WHEN m.meter_type_id = 2
                                  OR COALESCE(mt.meter_type_name, '') ILIKE '%water%'
                                  OR COALESCE(mt.meter_type_name, '') ILIKE '%wtr%'
                                  OR COALESCE(mt.meter_type_name, '') ILIKE '%น้ำ%'
                                  OR COALESCE(mst.sub_type_name, '') ILIKE '%water%'
                                  OR COALESCE(mst.sub_type_name, '') ILIKE '%wtr%'
                                  OR COALESCE(m.meter_group, '') ILIKE '%water%'
                                  OR COALESCE(m.meter_group, '') ILIKE '%wtr%'
                                  OR COALESCE(m.meter_code, '') ILIKE '%-W%'
                                  OR COALESCE(m.meter_name, '') ILIKE '%-W%'
                                THEN 'water'
                                WHEN COALESCE(mst.sub_type_name, '') ILIKE '%KWH%'
                                  OR COALESCE(mt.meter_type_name, '') ILIKE '%KWH%'
                                  OR COALESCE(m.meter_group, '') ILIKE '%KWH%'
                                THEN 'kwh'
                                ELSE 'ele'
                            END AS retention_category
                        FROM meter m
                        LEFT JOIN meter_type mt ON mt.meter_type_id = m.meter_type_id
                        LEFT JOIN meter_sub_type mst ON mst.meter_sub_type_id = m.meter_sub_type_id
                    )
                `;

                // 2. Water (น้ำ): After 3 months -> keep 1 value per 24 hours (1 day)
                const waterRes = await client.query(
                    `
                    WITH ${meterCategoryCte},
                    ranked AS (
                        SELECT
                            d.id,
                            ROW_NUMBER() OVER (
                                PARTITION BY d.meter_id, date_trunc('day', d.date_keep AT TIME ZONE $2)
                                ORDER BY d.date_keep DESC, d.id DESC
                            ) AS rn
                        FROM actual_meter_data d
                        JOIN meter_categories mc ON mc.meter_id = d.meter_id
                        WHERE mc.retention_category = 'water'
                          AND d.date_keep < NOW() - ($1::text || ' months')::interval
                    ),
                    deleted AS (
                        DELETE FROM actual_meter_data
                        WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
                        RETURNING 1
                    )
                    SELECT COUNT(*)::int AS deleted_count FROM deleted
                    `,
                    [retentionMonths, tz]
                );
                const deletedWaterRows = waterRes.rows[0]?.deleted_count || 0;

                // 3. ไฟฟ้า 1. kWh: After 3 months -> keep 1 value per 24 hours (1 day)
                //    Applies to explicit 'kwh' meters AND any non-MDB power meter rows that only recorded kWh (no V/I/kW electrical parameters)
                const kwhRes = await client.query(
                    `
                    WITH ${meterCategoryCte},
                    ranked AS (
                        SELECT
                            d.id,
                            ROW_NUMBER() OVER (
                                PARTITION BY d.meter_id, date_trunc('day', d.date_keep AT TIME ZONE $2)
                                ORDER BY d.date_keep DESC, d.id DESC
                            ) AS rn
                        FROM actual_meter_data d
                        JOIN meter_categories mc ON mc.meter_id = d.meter_id
                        WHERE d.date_keep < NOW() - ($1::text || ' months')::interval
                          AND (
                              mc.retention_category = 'kwh'
                              OR (
                                  mc.retention_category = 'ele'
                                  AND COALESCE(d.energy_kw, 0) = 0
                                  AND COALESCE(d.energy_kva, 0) = 0
                                  AND COALESCE(d.energy_volt_p1, 0) = 0
                                  AND COALESCE(d.energy_volt_p2, 0) = 0
                                  AND COALESCE(d.energy_volt_p3, 0) = 0
                                  AND COALESCE(d.energy_amp1, 0) = 0
                                  AND COALESCE(d.energy_amp2, 0) = 0
                                  AND COALESCE(d.energy_amp3, 0) = 0
                              )
                          )
                    ),
                    deleted AS (
                        DELETE FROM actual_meter_data
                        WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
                        RETURNING 1
                    )
                    SELECT COUNT(*)::int AS deleted_count FROM deleted
                    `,
                    [retentionMonths, tz]
                );
                const deletedKwhRows = kwhRes.rows[0]?.deleted_count || 0;

                // 4. ไฟฟ้า 2. ELE: After 3 months -> keep 1 value per hour (ชม.ละ 1 ค่า)
                //    (Main MDB / TOU meters have retention_category = 'mdb_tou' and are untouched — kept at 15-min forever)
                const eleRes = await client.query(
                    `
                    WITH ${meterCategoryCte},
                    ranked AS (
                        SELECT
                            d.id,
                            ROW_NUMBER() OVER (
                                PARTITION BY d.meter_id, date_trunc('hour', d.date_keep AT TIME ZONE $2)
                                ORDER BY d.date_keep DESC, d.id DESC
                            ) AS rn
                        FROM actual_meter_data d
                        JOIN meter_categories mc ON mc.meter_id = d.meter_id
                        WHERE mc.retention_category = 'ele'
                          AND d.date_keep < NOW() - ($1::text || ' months')::interval
                    ),
                    deleted AS (
                        DELETE FROM actual_meter_data
                        WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
                        RETURNING 1
                    )
                    SELECT COUNT(*)::int AS deleted_count FROM deleted
                    `,
                    [retentionMonths, tz]
                );
                const deletedEleRows = eleRes.rows[0]?.deleted_count || 0;

                const totalCompacted = deletedWaterRows + deletedKwhRows + deletedEleRows;
                compactionSummary = {
                    retentionMonths,
                    dailyBackfilled,
                    deletedKwhRows,
                    deletedEleRows,
                    deletedWaterRows,
                    totalCompacted,
                };

                if (totalCompacted > 0) {
                    console.log(
                        `🗜️  Historical compaction (> ${retentionMonths}m): compacted ${totalCompacted} rows ` +
                        `(kWh->24h: ${deletedKwhRows}, ELE->1h: ${deletedEleRows}, Water->24h: ${deletedWaterRows}, Main MDB/TOU: kept 15m)`
                    );
                }

                await this.logJob({
                    jobName: 'compaction',
                    status: 'success',
                    rowsRead: dailyBackfilled,
                    rowsWritten: totalCompacted,
                    startedAt,
                });
            } catch (error: any) {
                await this.logJob({
                    jobName: 'compaction',
                    status: 'failed',
                    errorMessage: error.message,
                    startedAt,
                });
                throw error;
            }
        });

        return compactionSummary;
    }

    private async runWithLock(jobName: keyof typeof advisoryLockIds, callback: (client: PoolClient) => Promise<void>): Promise<void> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const lock = await client.query('SELECT pg_try_advisory_xact_lock($1) AS locked', [advisoryLockIds[jobName]]);
            if (!lock.rows[0]?.locked) {
                await client.query('COMMIT');
                await this.logJob({
                    jobName,
                    status: 'skipped',
                    errorMessage: 'Another worker holds the advisory lock',
                    startedAt: new Date(),
                });
                return;
            }

            await callback(client);
            await client.query('COMMIT');
        } catch (error: any) {
            try {
                await client.query('ROLLBACK');
            } catch (_) {}
            throw error;
        } finally {
            client.release();
        }
    }

    private async logJob(input: JobLogInput): Promise<void> {
        try {
            await pool.query(
                `
                INSERT INTO aggregation_job_runs (
                    job_name, bucket_start, bucket_end, status,
                    rows_read, rows_written, rows_skipped, error_message,
                    started_at, finished_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                `,
                [
                    input.jobName,
                    input.bucketStart || null,
                    input.bucketEnd || null,
                    input.status,
                    input.rowsRead || 0,
                    input.rowsWritten || 0,
                    input.rowsSkipped || 0,
                    input.errorMessage || null,
                    input.startedAt,
                ]
            );
        } catch (e: any) {
            console.warn('⚠️ Failed to write aggregation job log:', e.message);
        }
    }
}

export const aggregationService = new AggregationService();
