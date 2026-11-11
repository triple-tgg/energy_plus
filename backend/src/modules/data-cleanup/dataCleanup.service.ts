import { query } from '../../config/database';
import { aggregationService } from '../aggregation/aggregation.service';
import { aggregationConfig } from '../../config/aggregation';

export class DataCleanupService {
    /**
     * Get current realtime data stats + historical timestamp compaction stats
     */
    async getRealtimeStats() {
        const result = await query(`
            SELECT
                COUNT(*)::int AS total_rows,
                MIN(received_at) AS oldest_record,
                MAX(received_at) AS newest_record,
                pg_size_pretty(pg_total_relation_size('meter_data_realtime')) AS table_size,
                COUNT(*) FILTER (WHERE received_at < NOW() - INTERVAL '24 hours')::int AS rows_older_than_24h,
                COUNT(*) FILTER (WHERE received_at < NOW() - INTERVAL '7 days')::int AS rows_older_than_7d,
                COUNT(*) FILTER (WHERE received_at < NOW() - INTERVAL '30 days')::int AS rows_older_than_30d
            FROM meter_data_realtime
        `);

        const historicalResult = await query(`
            WITH meter_categories AS (
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
            SELECT
                COUNT(*)::int AS actual_total_rows,
                MIN(d.date_keep) AS actual_oldest_record,
                MAX(d.date_keep) AS actual_newest_record,
                pg_size_pretty(pg_total_relation_size('actual_meter_data')) AS actual_table_size,
                COUNT(*) FILTER (WHERE d.date_keep >= NOW() - INTERVAL '3 months')::int AS actual_within_3m,
                COUNT(*) FILTER (WHERE d.date_keep < NOW() - INTERVAL '3 months')::int AS actual_older_than_3m,
                COUNT(*) FILTER (WHERE mc.retention_category = 'kwh')::int AS kwh_rows,
                COUNT(*) FILTER (WHERE mc.retention_category = 'ele')::int AS ele_rows,
                COUNT(*) FILTER (WHERE mc.retention_category = 'mdb_tou')::int AS mdb_tou_rows,
                COUNT(*) FILTER (WHERE mc.retention_category = 'water')::int AS water_rows
            FROM actual_meter_data d
            LEFT JOIN meter_categories mc ON mc.meter_id = d.meter_id
        `);

        const base = result.rows[0] || {
            total_rows: 0,
            oldest_record: null,
            newest_record: null,
            table_size: '0 bytes',
            rows_older_than_24h: 0,
            rows_older_than_7d: 0,
            rows_older_than_30d: 0,
        };
        const hist = historicalResult.rows[0] || {
            actual_total_rows: 0,
            actual_oldest_record: null,
            actual_newest_record: null,
            actual_table_size: '0 bytes',
            actual_within_3m: 0,
            actual_older_than_3m: 0,
            kwh_rows: 0,
            ele_rows: 0,
            mdb_tou_rows: 0,
            water_rows: 0,
        };

        return {
            ...base,
            historical: hist,
            policy: {
                realtimeRetentionHours: aggregationConfig.retentionHours,
                firstPhaseMonths: aggregationConfig.retentionMonths,
                firstPhaseIntervalMinutes: 15,
                rules: [
                    { category: 'realtime', labelTh: 'Realtime (เตือน Alarm)', labelEn: 'Realtime (Alarm Monitoring)', within3m: 'ทุกวินาที (เก็บไว้ 24 ชม.)', after3m: 'ลบอัตโนมัติหลัง 24 ชม.' },
                    { category: 'kwh', labelTh: 'ไฟฟ้า 1. kWh', labelEn: 'Electricity 1. kWh', within3m: 'ทุก 15 นาที (3 เดือนแรก)', after3m: '24 ชม. 1 ค่า (วันละ 1 ค่า)' },
                    { category: 'ele', labelTh: 'ไฟฟ้า 2. ELE', labelEn: 'Electricity 2. ELE', within3m: 'ทุก 15 นาที (3 เดือนแรก)', after3m: 'ชม.ละ 1 ค่า (ชั่วโมงละ 1 ค่า)' },
                    { category: 'mdb_tou', labelTh: 'ไฟฟ้า 3. Main MDB (TOU)', labelEn: 'Electricity 3. Main MDB (TOU)', within3m: 'ทุก 15 นาที', after3m: 'เก็บทุก 15 นาที ตลอดการใช้งาน' },
                    { category: 'water', labelTh: 'น้ำ (Water)', labelEn: 'Water', within3m: 'ทุก 15 นาที (3 เดือนแรก)', after3m: '24 ชม. 1 ค่า (วันละ 1 ค่า)' },
                ],
            },
        };
    }

    /**
     * Delete realtime data older than the specified number of hours
     * and compact historical timestamp data (> 3 months) per retention policy
     */
    async purgeRealtimeData(retentionHours: number, retentionMonths = aggregationConfig.retentionMonths) {
        if (retentionHours < 1) {
            throw new Error('Retention must be at least 1 hour');
        }

        // Delete realtime data in batches to avoid locking
        let totalDeleted = 0;
        const batchSize = 10000;
        let batchDeleted = 0;

        do {
            const result = await query(
                `DELETE FROM meter_data_realtime WHERE id IN (
                    SELECT id FROM meter_data_realtime
                    WHERE received_at < NOW() - ($1 || ' hours')::INTERVAL
                    LIMIT $2
                )`,
                [retentionHours.toString(), batchSize]
            );
            batchDeleted = result.rowCount || 0;
            totalDeleted += batchDeleted;
        } while (batchDeleted >= batchSize);

        try {
            await query(
                `DELETE FROM meter_max_demand_realtime WHERE received_at < NOW() - ($1 || ' hours')::INTERVAL`,
                [retentionHours.toString()]
            );
        } catch (_) {
            // Ignore if table does not exist yet
        }

        // Run historical timestamp compaction (> 3 months) according to policy
        const compaction = await aggregationService.compactHistoricalData(retentionMonths);

        return {
            deleted: totalDeleted + compaction.totalCompacted,
            realtimeDeleted: totalDeleted,
            historicalCompacted: compaction.totalCompacted,
            compaction,
            retentionHours,
            retentionMonths,
            message: `Deleted ${totalDeleted} realtime records (> ${retentionHours}h) and compacted ${compaction.totalCompacted} historical records (> ${retentionMonths}m)`,
        };
    }
}
