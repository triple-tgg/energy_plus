import { query } from '../../config/database';
import { parsePagination } from '../../utils/pagination';

export class ReportsService {
    private async ensureAlarmLogTable() {
        await query(`CREATE TABLE IF NOT EXISTS alarm_log (
            id BIGSERIAL PRIMARY KEY,
            alarm_config_id INTEGER REFERENCES alarm_config(alarm_config_id),
            meter_id INTEGER REFERENCES meter(meter_id),
            alarm_type VARCHAR(100),
            message TEXT NOT NULL,
            occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            acknowledged BOOLEAN NOT NULL DEFAULT false,
            acknowledged_at TIMESTAMPTZ,
            acknowledged_by VARCHAR(255),
            resolved_at TIMESTAMPTZ,
            resolved_by VARCHAR(255),
            metadata JSONB
        )`);
        await query(`CREATE INDEX IF NOT EXISTS idx_alarm_log_occurred_at ON alarm_log (occurred_at DESC)`);
    }

    async getAlarms(queryParams: any) {
        await this.ensureAlarmLogTable();
        const { page, limit, offset } = parsePagination(queryParams);
        const { startDate, endDate, search, siteId } = queryParams;
        const params: any[] = [];
        const filters: string[] = ['m.is_active = true'];
        if (siteId) { params.push(parseInt(siteId)); filters.push(`m.site_id = $${params.length}`); }
        if (startDate) { params.push(startDate); filters.push(`al.occurred_at >= ($${params.length}::date::timestamp AT TIME ZONE 'Asia/Bangkok')`); }
        if (endDate) { params.push(endDate); filters.push(`al.occurred_at < (($${params.length}::date + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')`); }
        if (search) {
            params.push(`%${String(search).trim()}%`);
            filters.push(`(al.message ILIKE $${params.length} OR m.meter_code ILIKE $${params.length} OR m.meter_name ILIKE $${params.length})`);
        }
        const dataParams = [...params, limit, offset];
        const result = await query(
            `SELECT al.id, al.occurred_at AS alarm_date, al.message, al.occurred_at,
                    COALESCE(al.alarm_type, '0') AS alarm_type,
                    al.resolved_at, al.resolved_by, al.acknowledged, al.acknowledged_at, al.acknowledged_by,
                    m.meter_code, m.meter_name, COUNT(*) OVER()::int AS full_count
             FROM alarm_log al
             JOIN meter m ON m.meter_id = al.meter_id
             WHERE ${filters.join(' AND ')}
             ORDER BY al.occurred_at DESC, al.id DESC
             LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
            dataParams
        );
        const total = Number(result.rows[0]?.full_count || 0);
        return { data: result.rows.map(({ full_count, ...row }: any) => row), total, page, limit };
    }

    async acknowledgeAlarm(id: number, acknowledgedBy?: string, siteId?: number) {
        await this.ensureAlarmLogTable();
        const result = await query(
            `UPDATE alarm_log
             SET acknowledged = true, acknowledged_at = NOW(), acknowledged_by = $1
             WHERE id = $2
               AND ($3::int IS NULL OR meter_id IN (SELECT meter_id FROM meter WHERE site_id=$3))
             RETURNING *`,
            [acknowledgedBy || null, id, siteId || null]
        );
        if (!result.rows[0]) throw new Error('Alarm log not found');
        return result.rows[0];
    }

    async getComparison(queryParams: any) {
        const { page, limit, offset } = parsePagination(queryParams);
        const now = new Date();
        const { siteId, buildingId, zoneId, meterTypeId, month = now.getMonth() + 1, year = now.getFullYear(), search } = queryParams;
        const params: any[] = [parseInt(String(year)), parseInt(String(month))];
        const filters: string[] = ['m.is_active IS DISTINCT FROM false'];

        if (siteId) { params.push(parseInt(siteId)); filters.push(`m.site_id = $${params.length}`); }
        if (buildingId) { params.push(parseInt(buildingId)); filters.push(`m.building_id = $${params.length}`); }
        if (zoneId) { params.push(parseInt(zoneId)); filters.push(`m.zone_id = $${params.length}`); }
        if (meterTypeId) { params.push(parseInt(meterTypeId)); filters.push(`m.meter_type_id = $${params.length}`); }
        if (search) {
            params.push(`%${String(search).trim()}%`);
            filters.push(`(m.meter_code ILIKE $${params.length} OR m.meter_name ILIKE $${params.length} OR m.room_name ILIKE $${params.length})`);
        }

        const dataParams = [...params, limit, offset];
        const result = await query(
            `WITH periods AS (
                SELECT make_date($1, $2, 1) AS current_start,
                       make_date($1, $2, 1) - INTERVAL '1 month' AS previous_start,
                       make_date($1, $2, 1) + INTERVAL '1 month' AS next_start
            ), meter_scope AS (
                SELECT m.meter_id, m.meter_code, m.meter_name AS customer_name, m.floor,
                       m.room_code, m.room_name, b.building_name, z.zone_name
                FROM meter m
                LEFT JOIN buildings b ON b.building_id = m.building_id
                LEFT JOIN zones z ON z.zone_id = m.zone_id
                WHERE ${filters.join(' AND ')}
            ), readings AS (
                SELECT d.meter_id, d.date_keep, d.energy_kwh
                FROM actual_meter_data d
                JOIN meter_scope ms ON ms.meter_id = d.meter_id
                CROSS JOIN periods p
                WHERE d.date_keep >= (p.previous_start::timestamp AT TIME ZONE 'Asia/Bangkok')
                  AND d.date_keep < (p.next_start::timestamp AT TIME ZONE 'Asia/Bangkok')
            ), usage AS (
                SELECT r.meter_id,
                    MAX(r.energy_kwh) FILTER (WHERE r.date_keep >= (p.previous_start::timestamp AT TIME ZONE 'Asia/Bangkok') AND r.date_keep < (p.current_start::timestamp AT TIME ZONE 'Asia/Bangkok')) AS prev_month,
                    MIN(r.energy_kwh) FILTER (WHERE r.date_keep >= (p.previous_start::timestamp AT TIME ZONE 'Asia/Bangkok') AND r.date_keep < (p.current_start::timestamp AT TIME ZONE 'Asia/Bangkok')) AS prev_first,
                    MAX(r.energy_kwh) FILTER (WHERE r.date_keep >= (p.current_start::timestamp AT TIME ZONE 'Asia/Bangkok') AND r.date_keep < (p.next_start::timestamp AT TIME ZONE 'Asia/Bangkok')) AS current_month,
                    MIN(r.energy_kwh) FILTER (WHERE r.date_keep >= (p.current_start::timestamp AT TIME ZONE 'Asia/Bangkok') AND r.date_keep < (p.next_start::timestamp AT TIME ZONE 'Asia/Bangkok')) AS current_first
                FROM readings r CROSS JOIN periods p
                GROUP BY r.meter_id
            ), rows AS (
                SELECT ms.*, to_char(p.previous_start, 'YYYY-MM') AS previous_period,
                       to_char(p.current_start, 'YYYY-MM') AS current_period,
                       COALESCE(u.prev_month, 0) AS prev_month,
                       GREATEST(COALESCE(u.prev_month, 0) - COALESCE(u.prev_first, u.prev_month, 0), 0) AS prev_units,
                       COALESCE(u.current_month, 0) AS current_month,
                       GREATEST(COALESCE(u.current_month, 0) - COALESCE(u.current_first, u.current_month, 0), 0) AS current_units
                FROM meter_scope ms CROSS JOIN periods p
                LEFT JOIN usage u ON u.meter_id = ms.meter_id
            )
            SELECT rows.*,
                CASE WHEN prev_units > 0 THEN ((current_units - prev_units) / prev_units) * 100 ELSE 0 END AS diff_percent,
                COUNT(*) OVER()::int AS full_count
            FROM rows
            ORDER BY building_name, floor, meter_code
            LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
            dataParams
        );
        const total = Number(result.rows[0]?.full_count || 0);
        return { data: result.rows.map(({ full_count, ...row }: any) => row), total, page, limit };
    }

    async getHistory(queryParams: any) {
        const { page, limit, offset } = parsePagination(queryParams);
        const { siteId, buildingId, zoneId, meterTypeId, meterId, startDate, endDate, search } = queryParams;
        const params: any[] = [];
        const filters: string[] = ['m.is_active IS DISTINCT FROM false'];

        if (siteId) { params.push(parseInt(siteId)); filters.push(`m.site_id = $${params.length}`); }
        if (buildingId) { params.push(parseInt(buildingId)); filters.push(`m.building_id = $${params.length}`); }
        if (zoneId) { params.push(parseInt(zoneId)); filters.push(`m.zone_id = $${params.length}`); }
        if (meterTypeId) { params.push(parseInt(meterTypeId)); filters.push(`m.meter_type_id = $${params.length}`); }
        if (meterId) { params.push(parseInt(meterId)); filters.push(`m.meter_id = $${params.length}`); }
        if (search) {
            params.push(`%${String(search).trim()}%`);
            filters.push(`(m.meter_code ILIKE $${params.length} OR m.meter_name ILIKE $${params.length})`);
        }
        params.push(startDate || new Date().toISOString().slice(0, 10));
        const startParam = params.length;
        params.push(endDate || startDate || new Date().toISOString().slice(0, 10));
        const endParam = params.length;

        const dataParams = [...params, limit, offset];
        const result = await query(
            `WITH mapped AS (
                SELECT r.*, COALESCE(rmm.meter_id, fallback_meter.meter_id) AS mapped_meter_id
                FROM meter_data_realtime r
                LEFT JOIN realtime_meter_map rmm
                  ON rmm.realtime_site_id = r.site_id
                 AND rmm.realtime_address_id = r.address_id
                 AND rmm.is_active = true
                 AND (rmm.channel IS NULL OR rmm.channel = r.channel)
                LEFT JOIN meter fallback_meter
                  ON fallback_meter.site_el = r.site_id
                 AND fallback_meter.address::text = r.address_id::text
                 AND rmm.id IS NULL
                WHERE r.received_at >= ($${startParam}::date::timestamp AT TIME ZONE 'Asia/Bangkok')
                  AND r.received_at < (($${endParam}::date + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')
            ), rows AS (
                SELECT
                    r.received_at AS timestamp,
                    m.meter_id, m.meter_code, m.meter_name,
                    r.import_kwhr AS kwh, r.kva_3ph AS kva, r.kw_3ph AS kw, r.kvar_3ph AS kvar,
                    r.hz AS frequency, r.pf1 AS pwl1, r.pf2 AS pwl2, r.pf3 AS pwl3,
                    r.kw1, r.kw2, r.kw3,
                    NULL::numeric AS kvah, NULL::numeric AS kvarh,
                    r.vl1 AS volt_p1, r.vl2 AS volt_p2, r.vl3 AS volt_p3,
                    r.vl12 AS volt_l1, r.vl23 AS volt_l2, r.vl31 AS volt_l3,
                    r.il1 AS amp1, r.il2 AS amp2, r.il3 AS amp3,
                    r.received_at, r.id
                FROM mapped r
                JOIN meter m ON m.meter_id = r.mapped_meter_id
                WHERE ${filters.join(' AND ')}
            )
            SELECT rows.*, COUNT(*) OVER()::int AS full_count
            FROM rows
            ORDER BY received_at DESC, id DESC
            LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
            dataParams
        );
        const total = Number(result.rows[0]?.full_count || 0);
        return { data: result.rows.map(({ full_count, id, received_at, ...row }: any) => row), total, page, limit };
    }

    async getEnergyConsumption(queryParams: any) {
        const { page, limit, offset } = parsePagination(queryParams);
        const { siteId, buildingId, zoneId, meterTypeId, meterId, startDate, endDate, search, mdb } = queryParams;
        const params: any[] = [];
        const meterFilters: string[] = ['m.is_active IS DISTINCT FROM false'];

        const mdbScope = String(mdb || '').toLowerCase();
        const MDB_MATCH = `(EXISTS (SELECT 1 FROM meter_type mt WHERE mt.meter_type_id = m.meter_type_id AND mt.meter_type_name ILIKE '%MDB%') OR m.meter_name ILIKE '%MDB%' OR m.meter_code ILIKE '%MDB%')`;
        if (mdbScope === 'only') {
            meterFilters.push(MDB_MATCH);
        } else if (mdbScope === 'exclude') {
            meterFilters.push(`NOT ${MDB_MATCH}`);
        }

        if (siteId) { params.push(parseInt(siteId)); meterFilters.push(`m.site_id = $${params.length}`); }
        if (buildingId) { params.push(parseInt(buildingId)); meterFilters.push(`m.building_id = $${params.length}`); }
        if (zoneId) { params.push(parseInt(zoneId)); meterFilters.push(`m.zone_id = $${params.length}`); }
        if (meterTypeId) { params.push(parseInt(meterTypeId)); meterFilters.push(`m.meter_type_id = $${params.length}`); }
        if (meterId) { params.push(parseInt(meterId)); meterFilters.push(`m.meter_id = $${params.length}`); }
        if (search) {
            params.push(`%${String(search).trim()}%`);
            meterFilters.push(`(m.meter_code ILIKE $${params.length} OR m.meter_name ILIKE $${params.length} OR m.room_name ILIKE $${params.length})`);
        }

        params.push(startDate || new Date().toISOString().slice(0, 10));
        const startParam = params.length;
        params.push(endDate || startDate || new Date().toISOString().slice(0, 10));
        const endParam = params.length;

        const baseCtes = `WITH mapped AS (
            SELECT r.id, r.channel, r.site_id, r.address_id, r.received_at, r.import_kwhr,
                   COALESCE(rmm.meter_id, fallback_meter.meter_id) AS mapped_meter_id
            FROM meter_data_realtime r
            LEFT JOIN realtime_meter_map rmm
              ON rmm.realtime_site_id = r.site_id
             AND rmm.realtime_address_id = r.address_id
             AND rmm.is_active = true
             AND (rmm.channel IS NULL OR rmm.channel = r.channel)
            LEFT JOIN meter fallback_meter
             ON fallback_meter.site_el = r.site_id
             AND fallback_meter.address::text = r.address_id::text
             AND rmm.id IS NULL
            WHERE r.received_at >= (($${startParam}::date - 1)::timestamp AT TIME ZONE 'Asia/Bangkok')
              AND r.received_at < (($${endParam}::date + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')
        ), meter_scope AS (
            SELECT m.*, b.building_name, z.zone_name, s.site_name AS project_name
            FROM meter m
            LEFT JOIN buildings b ON b.building_id = m.building_id
            LEFT JOIN zones z ON z.zone_id = m.zone_id
            LEFT JOIN sites s ON s.site_id = m.site_id
            WHERE ${meterFilters.join(' AND ')}
        ), start_points AS (
            SELECT DISTINCT ON (m.meter_id)
                m.meter_id, r.received_at AS start_date, r.import_kwhr AS start_reading
            FROM meter_scope m JOIN mapped r ON r.mapped_meter_id = m.meter_id
            WHERE r.received_at < ($${startParam}::date::timestamp AT TIME ZONE 'Asia/Bangkok')
            ORDER BY m.meter_id, r.received_at DESC, r.id DESC
        ), end_points AS (
            SELECT DISTINCT ON (m.meter_id)
                m.meter_id, r.received_at AS end_date, r.import_kwhr AS end_reading
            FROM meter_scope m JOIN mapped r ON r.mapped_meter_id = m.meter_id
            WHERE r.received_at < (($${endParam}::date + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')
            ORDER BY m.meter_id, r.received_at DESC, r.id DESC
        ), report_rows AS (
            SELECT
                m.meter_id, m.meter_code, m.meter_name AS customer_name,
                m.building_name, m.floor, m.room_code AS site_code,
                COALESCE(m.room_name, m.zone_name, m.project_name) AS site_name,
                sp.start_date, sp.start_reading, ep.end_date, ep.end_reading,
                GREATEST(COALESCE(ep.end_reading, 0) - COALESCE(sp.start_reading, ep.end_reading, 0), 0) AS units_used,
                COALESCE(rate.unit_price, 0) AS unit_price,
                GREATEST(COALESCE(ep.end_reading, 0) - COALESCE(sp.start_reading, ep.end_reading, 0), 0)
                    * COALESCE(rate.unit_price, 0) AS total_amount
            FROM meter_scope m
            JOIN end_points ep ON ep.meter_id = m.meter_id
            LEFT JOIN start_points sp ON sp.meter_id = m.meter_id
            LEFT JOIN LATERAL (
                SELECT unit_price FROM billing_config
                WHERE is_active = true AND effective_date <= $${endParam}::date
                ORDER BY effective_date DESC, id DESC LIMIT 1
            ) rate ON true
        )`;

        const dataParams = [...params, limit, offset];
        const result = await query(
            `${baseCtes} SELECT report_rows.*, COUNT(*) OVER()::int AS full_count FROM report_rows
             ORDER BY building_name, floor, meter_code
             LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
            dataParams
        );
        const total = Number(result.rows[0]?.full_count || 0);
        return {
            data: result.rows.map(({ full_count, ...row }: any) => row),
            total, page, limit,
        };
    }
}
