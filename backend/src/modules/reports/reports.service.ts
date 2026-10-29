import { query } from '../../config/database';
import { parsePagination } from '../../utils/pagination';
import { parseSiteIds } from '../../utils/siteFilter';

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
        const siteIds = parseSiteIds(siteId);
        if (siteIds) { params.push(siteIds); filters.push(`m.site_id = ANY($${params.length}::int[])`); }
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

    async acknowledgeAlarm(id: number, acknowledgedBy?: string, siteId?: unknown) {
        await this.ensureAlarmLogTable();
        const result = await query(
            `UPDATE alarm_log
             SET acknowledged = true, acknowledged_at = NOW(), acknowledged_by = $1
             WHERE id = $2
               AND ($3::int[] IS NULL OR meter_id IN (SELECT meter_id FROM meter WHERE site_id = ANY($3::int[])))
             RETURNING *`,
            [acknowledgedBy || 'system', id, parseSiteIds(siteId)]
        );
        if (result.rows.length === 0) throw new Error('Alarm not found or not in your site');
        return result.rows[0];
    }

    async clearAlarms(queryParams: any) {
        await this.ensureAlarmLogTable();
        const { startDate, endDate, search, siteId, ids } = queryParams;
        const siteIds = parseSiteIds(siteId);
        if (Array.isArray(ids) && ids.length > 0) {
            const result = await query(
                `DELETE FROM alarm_log
                 WHERE id = ANY($1::int[])
                   AND ($2::int[] IS NULL OR meter_id IN (SELECT meter_id FROM meter WHERE site_id = ANY($2::int[])))
                 RETURNING id`,
                [ids, siteIds]
            );
            return { deletedCount: result.rowCount || 0 };
        }
        const params: any[] = [];
        const filters: string[] = ['true'];
        if (siteIds) { params.push(siteIds); filters.push(`meter_id IN (SELECT meter_id FROM meter WHERE site_id = ANY($${params.length}::int[]))`); }
        if (startDate) { params.push(startDate); filters.push(`occurred_at >= ($${params.length}::date::timestamp AT TIME ZONE 'Asia/Bangkok')`); }
        if (endDate) { params.push(endDate); filters.push(`occurred_at < (($${params.length}::date + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')`); }
        if (search) {
            params.push(`%${String(search).trim()}%`);
            filters.push(`(message ILIKE $${params.length} OR meter_id IN (SELECT meter_id FROM meter WHERE meter_code ILIKE $${params.length} OR meter_name ILIKE $${params.length}))`);
        }
        const result = await query(
            `DELETE FROM alarm_log WHERE ${filters.join(' AND ')} RETURNING id`,
            params
        );
        return { deletedCount: result.rowCount || 0 };
    }

    async getComparison(queryParams: any) {
        const { page, limit, offset } = parsePagination(queryParams);
        const now = new Date();
        const { siteId, buildingId, zoneId, meterTypeId, month = now.getMonth() + 1, year = now.getFullYear(), search } = queryParams;
        const params: any[] = [parseInt(String(year)), parseInt(String(month))];
        const filters: string[] = ['m.is_active IS DISTINCT FROM false'];

        const siteIds = parseSiteIds(siteId);
        if (siteIds) { params.push(siteIds); filters.push(`m.site_id = ANY($${params.length}::int[])`); }
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

        const siteIds = parseSiteIds(siteId);
        if (siteIds) { params.push(siteIds); filters.push(`m.site_id = ANY($${params.length}::int[])`); }
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

        filters.push(`d.date_keep >= ($${startParam}::date::timestamp AT TIME ZONE 'Asia/Bangkok')`);
        filters.push(`d.date_keep < (($${endParam}::date + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')`);

        const dataParams = [...params, limit, offset];
        const result = await query(
            `SELECT
                to_char((d.date_keep AT TIME ZONE 'Asia/Bangkok')::date, 'YYYY-MM-DD') AS timestamp,
                to_char((d.date_keep AT TIME ZONE 'Asia/Bangkok')::date, 'YYYY-MM-DD') AS date,
                m.meter_id, m.meter_code, m.meter_name,
                ROUND(GREATEST(COALESCE(MAX(d.energy_kwh) - MIN(d.energy_kwh), 0), 0)::numeric, 2) AS kwh_used,
                ROUND(COALESCE(MAX(d.energy_kwh), 0)::numeric, 2) AS kwh,
                ROUND(COALESCE(MAX(d.energy_kw), 0)::numeric, 2) AS max_kw,
                ROUND(COALESCE(AVG(d.energy_kw), 0)::numeric, 2) AS kw,
                ROUND(COALESCE(AVG(d.energy_kva), 0)::numeric, 2) AS kva,
                ROUND(COALESCE(AVG(d.energy_kvar), 0)::numeric, 2) AS kvar,
                ROUND(COALESCE(AVG(d.energy_frequency), 0)::numeric, 2) AS frequency,
                ROUND(COALESCE(AVG(d.energy_pf1), 0)::numeric, 3) AS pwl1,
                ROUND(COALESCE(AVG(d.energy_pf2), 0)::numeric, 3) AS pwl2,
                ROUND(COALESCE(AVG(d.energy_pf3), 0)::numeric, 3) AS pwl3,
                ROUND(COALESCE(AVG(d.energy_volt_p1), 0)::numeric, 1) AS volt_p1,
                ROUND(COALESCE(AVG(d.energy_volt_p2), 0)::numeric, 1) AS volt_p2,
                ROUND(COALESCE(AVG(d.energy_volt_p3), 0)::numeric, 1) AS volt_p3,
                ROUND(COALESCE(AVG(d.energy_volt_l1), 0)::numeric, 1) AS volt_l1,
                ROUND(COALESCE(AVG(d.energy_volt_l2), 0)::numeric, 1) AS volt_l2,
                ROUND(COALESCE(AVG(d.energy_volt_l3), 0)::numeric, 1) AS volt_l3,
                ROUND(COALESCE(AVG(d.energy_amp1), 0)::numeric, 2) AS amp1,
                ROUND(COALESCE(AVG(d.energy_amp2), 0)::numeric, 2) AS amp2,
                ROUND(COALESCE(AVG(d.energy_amp3), 0)::numeric, 2) AS amp3,
                COUNT(*)::int AS readings_count,
                COUNT(*) OVER()::int AS full_count
            FROM actual_meter_data d
            JOIN meter m ON m.meter_id = d.meter_id
            WHERE ${filters.join(' AND ')}
            GROUP BY (d.date_keep AT TIME ZONE 'Asia/Bangkok')::date, m.meter_id, m.meter_code, m.meter_name
            ORDER BY (d.date_keep AT TIME ZONE 'Asia/Bangkok')::date DESC, m.meter_code ASC
            LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
            dataParams
        );
        const total = Number(result.rows[0]?.full_count || 0);
        return { data: result.rows.map(({ full_count, ...row }: any) => row), total, page, limit };
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

        const siteIds = parseSiteIds(siteId);
        if (siteIds) { params.push(siteIds); meterFilters.push(`m.site_id = ANY($${params.length}::int[])`); }
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
             ON (fallback_meter.site_el::text = r.channel OR (fallback_meter.site_el::text = r.site_id::text AND fallback_meter.address::text = r.address_id::text))
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
        ), daily_stats AS (
            SELECT
                d.meter_id,
                MIN(d.total_kwh) AS daily_first_reading,
                MAX(d.total_kwh) AS daily_last_reading,
                MIN(d.date_keep) AS daily_first_date,
                MAX(d.date_keep) AS daily_last_date,
                SUM(COALESCE(d.total_kwh, 0)) AS daily_sum_kwh
            FROM actual_meter_data_daily d
            JOIN meter_scope ms ON ms.meter_id = d.meter_id
            WHERE d.date_keep >= $${startParam}::date
              AND d.date_keep <= $${endParam}::date
            GROUP BY d.meter_id
        ), daily_prev AS (
            SELECT DISTINCT ON (d.meter_id)
                d.meter_id,
                d.date_keep::timestamp AS prev_date,
                d.total_kwh AS prev_reading
            FROM actual_meter_data_daily d
            JOIN meter_scope ms ON ms.meter_id = d.meter_id
            WHERE d.date_keep < $${startParam}::date
            ORDER BY d.meter_id, d.date_keep DESC
        ), actual_prev AS (
            SELECT DISTINCT ON (d.meter_id)
                d.meter_id,
                d.date_keep AS prev_date,
                d.energy_kwh AS prev_reading
            FROM actual_meter_data d
            JOIN meter_scope ms ON ms.meter_id = d.meter_id
            WHERE d.date_keep < ($${startParam}::date::timestamp AT TIME ZONE 'Asia/Bangkok')
            ORDER BY d.meter_id, d.date_keep DESC
        ), start_points_prior AS (
            SELECT DISTINCT ON (m.meter_id)
                m.meter_id, r.received_at AS start_date, r.import_kwhr AS start_reading
            FROM meter_scope m JOIN mapped r ON r.mapped_meter_id = m.meter_id
            WHERE r.received_at < ($${startParam}::date::timestamp AT TIME ZONE 'Asia/Bangkok')
            ORDER BY m.meter_id, r.received_at DESC, r.id DESC
        ), start_points_earliest AS (
            SELECT DISTINCT ON (m.meter_id)
                m.meter_id, r.received_at AS start_date, r.import_kwhr AS start_reading
            FROM meter_scope m JOIN mapped r ON r.mapped_meter_id = m.meter_id
            WHERE r.received_at >= ($${startParam}::date::timestamp AT TIME ZONE 'Asia/Bangkok')
              AND r.received_at < (($${endParam}::date + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')
            ORDER BY m.meter_id, r.received_at ASC, r.id ASC
        ), start_points AS (
            SELECT
                m.meter_id,
                COALESCE(
                    sp_prior.start_date,
                    ap.prev_date,
                    dp.prev_date,
                    sp_earliest.start_date,
                    ds.daily_first_date::timestamp
                ) AS start_date,
                COALESCE(
                    sp_prior.start_reading,
                    ap.prev_reading,
                    dp.prev_reading,
                    sp_earliest.start_reading,
                    ds.daily_first_reading
                ) AS start_reading
            FROM meter_scope m
            LEFT JOIN start_points_prior sp_prior ON sp_prior.meter_id = m.meter_id
            LEFT JOIN actual_prev ap ON ap.meter_id = m.meter_id
            LEFT JOIN daily_prev dp ON dp.meter_id = m.meter_id
            LEFT JOIN start_points_earliest sp_earliest ON sp_earliest.meter_id = m.meter_id
            LEFT JOIN daily_stats ds ON ds.meter_id = m.meter_id
        ), end_points_realtime AS (
            SELECT DISTINCT ON (m.meter_id)
                m.meter_id, r.received_at AS end_date, r.import_kwhr AS end_reading
            FROM meter_scope m JOIN mapped r ON r.mapped_meter_id = m.meter_id
            WHERE r.received_at < (($${endParam}::date + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')
            ORDER BY m.meter_id, r.received_at DESC, r.id DESC
        ), end_points AS (
            SELECT
                m.meter_id,
                COALESCE(
                    ep_rt.end_date,
                    ds.daily_last_date::timestamp
                ) AS end_date,
                COALESCE(
                    ep_rt.end_reading,
                    ds.daily_last_reading
                ) AS end_reading
            FROM meter_scope m
            LEFT JOIN end_points_realtime ep_rt ON ep_rt.meter_id = m.meter_id
            LEFT JOIN daily_stats ds ON ds.meter_id = m.meter_id
        ), report_rows AS (
            SELECT
                m.meter_id, m.meter_code, m.meter_name AS customer_name,
                m.building_name, m.floor, m.room_code AS site_code,
                COALESCE(m.room_name, m.zone_name, m.project_name) AS site_name,
                sp.start_date, sp.start_reading, ep.end_date, ep.end_reading,
                CASE
                    WHEN ep.end_reading IS NOT NULL AND sp.start_reading IS NOT NULL AND ep.end_reading > sp.start_reading
                        THEN (ep.end_reading - sp.start_reading)
                    WHEN COALESCE(ds.daily_sum_kwh, 0) > 0
                        THEN ds.daily_sum_kwh
                    ELSE GREATEST(COALESCE(ep.end_reading, 0) - COALESCE(sp.start_reading, ep.end_reading, 0), 0)
                END AS units_used,
                COALESCE(rate.unit_price, 4.15) AS unit_price,
                COALESCE(rate.rate_mode, 'tiered') AS rate_mode,
                COALESCE(rate.tier1_limit, 200.00) AS tier1_limit,
                COALESCE(rate.tier1_rate, 3.0000) AS tier1_rate,
                COALESCE(rate.tier2_rate, 4.2200) AS tier2_rate,
                COALESCE(rate.service_charge, 24.6200) AS service_charge,
                COALESCE(rate.ft_rate, 0.1623) AS ft_rate,
                COALESCE(rate.vat_percent, 7.00) AS vat_percent,
                rate.effective_date AS tariff_effective_date
            FROM meter_scope m
            JOIN end_points ep ON ep.meter_id = m.meter_id
            LEFT JOIN start_points sp ON sp.meter_id = m.meter_id
            LEFT JOIN daily_stats ds ON ds.meter_id = m.meter_id
            LEFT JOIN LATERAL (
                SELECT * FROM billing_config
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

        const rows = result.rows.map(({ full_count, ...r }: any) => {
            const unitsUsed = Number(r.units_used || 0);
            const rateMode = r.rate_mode || 'tiered';
            const tier1Limit = Number(r.tier1_limit || 200);
            const tier1Rate = Number(r.tier1_rate || 3.00);
            const tier2Rate = Number(r.tier2_rate || 4.22);
            const unitPrice = Number(r.unit_price || 4.15);
            const serviceCharge = Number(r.service_charge || 24.62);
            const ftRate = Number(r.ft_rate || 0.1623);
            const vatPercent = Number(r.vat_percent || 7.00);

            let tier1Units = 0;
            let tier1Amount = 0;
            let tier2Units = 0;
            let tier2Amount = 0;
            let energyAmount = 0;

            if (rateMode === 'tiered') {
                tier1Units = Math.min(unitsUsed, tier1Limit);
                tier2Units = Math.max(0, unitsUsed - tier1Limit);
                tier1Amount = tier1Units * tier1Rate;
                tier2Amount = tier2Units * tier2Rate;
                energyAmount = tier1Amount + tier2Amount;
            } else {
                tier1Units = unitsUsed;
                tier1Amount = unitsUsed * unitPrice;
                energyAmount = tier1Amount;
            }

            const ftAmount = unitsUsed * ftRate;
            const subtotal = energyAmount + serviceCharge + ftAmount;
            const vatAmount = subtotal * (vatPercent / 100);
            const totalAmount = subtotal + vatAmount;

            return {
                ...r,
                units_used: unitsUsed,
                rate_mode: rateMode,
                tier1_limit: tier1Limit,
                tier1_rate: tier1Rate,
                tier1_units: tier1Units,
                tier1_amount: tier1Amount,
                tier2_rate: tier2Rate,
                tier2_units: tier2Units,
                tier2_amount: tier2Amount,
                energy_amount: energyAmount,
                service_charge: serviceCharge,
                ft_rate: ftRate,
                ft_amount: ftAmount,
                subtotal: subtotal,
                vat_percent: vatPercent,
                vat_amount: vatAmount,
                total_amount: totalAmount,
                tariff_info: {
                    effective_date: r.tariff_effective_date,
                    rate_mode: rateMode,
                    tier1_limit: tier1Limit,
                    tier1_rate: tier1Rate,
                    tier2_rate: tier2Rate,
                    unit_price: unitPrice,
                    service_charge: serviceCharge,
                    ft_rate: ftRate,
                    vat_percent: vatPercent,
                },
            };
        });

        return {
            data: rows,
            total, page, limit,
        };
    }

    async getTouReport(queryParams: any) {
        const { page, limit, offset } = parsePagination(queryParams);
        const { siteId, buildingId, zoneId, meterId, startDate, endDate, search } = queryParams;
        const params: any[] = [];
        const meterFilters: string[] = ['m.is_active IS DISTINCT FROM false'];

        const MDB_MATCH = `(EXISTS (SELECT 1 FROM meter_type mt WHERE mt.meter_type_id = m.meter_type_id AND mt.meter_type_name ILIKE '%MDB%') OR m.meter_name ILIKE '%MDB%' OR m.meter_code ILIKE '%MDB%')`;
        meterFilters.push(MDB_MATCH);

        const siteIds = parseSiteIds(siteId);
        if (siteIds) { params.push(siteIds); meterFilters.push(`m.site_id = ANY($${params.length}::int[])`); }
        if (buildingId) { params.push(parseInt(buildingId)); meterFilters.push(`m.building_id = $${params.length}`); }
        if (zoneId) { params.push(parseInt(zoneId)); meterFilters.push(`m.zone_id = $${params.length}`); }
        if (meterId) { params.push(parseInt(meterId)); meterFilters.push(`m.meter_id = $${params.length}`); }
        if (search) {
            params.push(`%${String(search).trim()}%`);
            meterFilters.push(`(m.meter_code ILIKE $${params.length} OR m.meter_name ILIKE $${params.length} OR m.room_name ILIKE $${params.length})`);
        }

        const start = startDate || new Date().toISOString().slice(0, 10);
        const end = endDate || startDate || new Date().toISOString().slice(0, 10);
        params.push(start);
        const startParam = params.length;
        params.push(end);
        const endParam = params.length;

        // Query active TOU tariff rate
        let rate: any;
        try {
            const rateResult = await query(
                `SELECT * FROM tou_tariff_config
                 WHERE is_active = true AND effective_date <= $1::date
                 ORDER BY effective_date DESC, id DESC LIMIT 1`,
                [end]
            );
            rate = rateResult.rows[0];
        } catch { /* use default if table not created yet */ }

        if (!rate) {
            rate = {
                effective_date: '2026-01-01',
                on_peak_rate: 5.7982,
                off_peak_rate: 2.6369,
                demand_rate: 210.0000,
                pf_penalty_rate: 56.0700,
                pf_threshold_factor: 0.6197,
                service_charge: 38.2200,
                ft_rate: 0.1623,
                vat_percent: 7.00,
            };
        }

        const onPeakRate = Number(rate.on_peak_rate ?? 5.7982);
        const offPeakRate = Number(rate.off_peak_rate ?? 2.6369);
        const demandRate = Number(rate.demand_rate ?? 210.0000);
        const pfPenaltyRate = Number(rate.pf_penalty_rate ?? 56.0700);
        const pfThresholdFactor = Number(rate.pf_threshold_factor ?? 0.6197);
        const serviceCharge = Number(rate.service_charge ?? 38.2200);
        const ftRate = Number(rate.ft_rate ?? 0.1623);
        const vatPercent = Number(rate.vat_percent ?? 7.00);

        const querySql = `
            WITH meter_scope AS (
                SELECT m.meter_id, m.meter_code, m.meter_name AS customer_name,
                       m.floor, m.room_code AS site_code,
                       COALESCE(m.room_name, z.zone_name, s.site_name) AS site_name,
                       b.building_name
                FROM meter m
                LEFT JOIN buildings b ON b.building_id = m.building_id
                LEFT JOIN zones z ON z.zone_id = m.zone_id
                LEFT JOIN sites s ON s.site_id = m.site_id
                WHERE ${meterFilters.join(' AND ')}
            ),
            actual_points AS (
                SELECT d.meter_id, d.date_keep,
                       COALESCE(d.energy_kwh, 0) AS energy_kwh,
                       COALESCE(d.energy_kw, 0) AS energy_kw,
                       COALESCE(d.energy_kvar, 0) AS energy_kvar
                FROM actual_meter_data d
                JOIN meter_scope ms ON ms.meter_id = d.meter_id
                WHERE d.date_keep >= ($${startParam}::date::timestamp AT TIME ZONE 'Asia/Bangkok')
                  AND d.date_keep < (($${endParam}::date + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')
            ),
            realtime_mapped AS (
                SELECT
                    COALESCE(rmm.meter_id, fallback_meter.meter_id) AS meter_id,
                    date_trunc('hour', r.received_at) + (floor(extract(minute from r.received_at) / 15) * 15) * interval '1 minute' AS date_keep,
                    COALESCE(r.import_kwhr, 0) AS energy_kwh,
                    COALESCE(r.kw_3ph, 0) AS energy_kw,
                    COALESCE(r.kvar_3ph, 0) AS energy_kvar,
                    ROW_NUMBER() OVER (
                        PARTITION BY COALESCE(rmm.meter_id, fallback_meter.meter_id),
                                     date_trunc('hour', r.received_at) + (floor(extract(minute from r.received_at) / 15) * 15) * interval '1 minute'
                        ORDER BY r.received_at DESC, r.id DESC
                    ) AS rn
                FROM meter_data_realtime r
                LEFT JOIN realtime_meter_map rmm
                  ON rmm.realtime_site_id = r.site_id
                 AND rmm.realtime_address_id = r.address_id
                 AND rmm.is_active = true
                 AND (rmm.channel IS NULL OR rmm.channel = r.channel)
                LEFT JOIN meter fallback_meter
                  ON (fallback_meter.site_el::text = r.channel OR (fallback_meter.site_el::text = r.site_id::text AND fallback_meter.address::text = r.address_id::text))
                 AND rmm.id IS NULL
                WHERE r.received_at >= ($${startParam}::date::timestamp AT TIME ZONE 'Asia/Bangkok')
                  AND r.received_at < (($${endParam}::date + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')
                  AND COALESCE(rmm.meter_id, fallback_meter.meter_id) IN (SELECT meter_id FROM meter_scope)
            ),
            combined_points AS (
                SELECT meter_id, date_keep, energy_kwh, energy_kw, energy_kvar FROM actual_points
                UNION ALL
                SELECT meter_id, date_keep, energy_kwh, energy_kw, energy_kvar FROM realtime_mapped
                WHERE rn = 1
                  AND NOT EXISTS (
                      SELECT 1 FROM actual_points ap WHERE ap.meter_id = realtime_mapped.meter_id AND ap.date_keep = realtime_mapped.date_keep
                  )
            ),
            points_tagged AS (
                SELECT
                    meter_id, date_keep, energy_kwh, energy_kw, energy_kvar,
                    (EXTRACT(ISODOW FROM date_keep AT TIME ZONE 'Asia/Bangkok') BETWEEN 1 AND 5
                     AND EXTRACT(HOUR FROM date_keep AT TIME ZONE 'Asia/Bangkok') >= 9
                     AND EXTRACT(HOUR FROM date_keep AT TIME ZONE 'Asia/Bangkok') < 22) AS is_on_peak,
                    LAG(energy_kwh) OVER (PARTITION BY meter_id ORDER BY date_keep) AS prev_kwh
                FROM combined_points
            ),
            meter_aggs AS (
                SELECT
                    meter_id,
                    MIN(date_keep) AS start_date,
                    MAX(date_keep) AS end_date,
                    MIN(energy_kwh) AS start_reading,
                    MAX(energy_kwh) AS end_reading,
                    MAX(CASE WHEN is_on_peak THEN energy_kw ELSE 0 END) AS peak_demand_kw,
                    SUM(CASE WHEN is_on_peak THEN GREATEST(energy_kwh - prev_kwh, energy_kw * 0.25, 0) ELSE 0 END) AS on_peak_delta,
                    SUM(CASE WHEN NOT is_on_peak THEN GREATEST(energy_kwh - prev_kwh, energy_kw * 0.25, 0) ELSE 0 END) AS off_peak_delta,
                    SUM(COALESCE(energy_kvar, 0) * 0.25) AS total_kvar
                FROM points_tagged
                GROUP BY meter_id
            )
            SELECT
                ms.*,
                ma.start_date,
                ma.end_date,
                COALESCE(ma.start_reading, 0) AS start_reading,
                COALESCE(ma.end_reading, 0) AS end_reading,
                COALESCE(ma.peak_demand_kw, 0) AS peak_demand_kw,
                COALESCE(ma.on_peak_delta, 0) AS on_peak_kwh,
                COALESCE(ma.off_peak_delta, 0) AS off_peak_kwh,
                COALESCE(ma.total_kvar, 0) AS total_kvar,
                COUNT(*) OVER()::int AS full_count
            FROM meter_scope ms
            LEFT JOIN meter_aggs ma ON ma.meter_id = ms.meter_id
            ORDER BY building_name, floor, meter_code
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;

        const dataParams = [...params, limit, offset];
        const result = await query(querySql, dataParams);
        const total = Number(result.rows[0]?.full_count || 0);

        const rows = result.rows.map(({ full_count, ...r }: any) => {
            const rawStartReading = Number(r.start_reading || 0);
            const rawEndReading = Number(r.end_reading || 0);
            let onPeakKwh = Number(r.on_peak_kwh || 0);
            let offPeakKwh = Number(r.off_peak_kwh || 0);
            let unitsUsed = rawEndReading > rawStartReading ? (rawEndReading - rawStartReading) : (onPeakKwh + offPeakKwh);

            if (unitsUsed > 0 && (onPeakKwh + offPeakKwh) > 0) {
                const ratio = onPeakKwh / (onPeakKwh + offPeakKwh);
                onPeakKwh = unitsUsed * ratio;
                offPeakKwh = unitsUsed * (1 - ratio);
            } else if (unitsUsed > 0 && (onPeakKwh + offPeakKwh) === 0) {
                onPeakKwh = unitsUsed * 0.45;
                offPeakKwh = unitsUsed * 0.55;
            }

            const peakDemandKw = Number(r.peak_demand_kw || 0);
            const totalKvar = Number(r.total_kvar || 0);

            const onPeakAmount = onPeakKwh * onPeakRate;
            const offPeakAmount = offPeakKwh * offPeakRate;
            const energyAmount = onPeakAmount + offPeakAmount;
            const demandAmount = peakDemandKw * demandRate;

            const kvarAllowable = onPeakKwh * pfThresholdFactor;
            const kvarExcess = Math.max(0, totalKvar - kvarAllowable);
            const pfPenaltyAmount = kvarExcess * pfPenaltyRate;

            const ftAmount = unitsUsed * ftRate;
            const subtotal = energyAmount + demandAmount + pfPenaltyAmount + serviceCharge + ftAmount;
            const vatAmount = subtotal * (vatPercent / 100);
            const totalAmount = subtotal + vatAmount;

            return {
                meter_id: r.meter_id,
                meter_code: r.meter_code,
                customer_name: r.customer_name,
                building_name: r.building_name,
                floor: r.floor,
                site_code: r.site_code,
                site_name: r.site_name,
                start_date: r.start_date,
                end_date: r.end_date,
                start_reading: rawStartReading,
                end_reading: rawEndReading,
                units_used: unitsUsed,
                on_peak_kwh: onPeakKwh,
                on_peak_rate: onPeakRate,
                on_peak_amount: onPeakAmount,
                off_peak_kwh: offPeakKwh,
                off_peak_rate: offPeakRate,
                off_peak_amount: offPeakAmount,
                energy_amount: energyAmount,
                peak_demand_kw: peakDemandKw,
                demand_rate: demandRate,
                demand_amount: demandAmount,
                total_kvar: totalKvar,
                kvar_allowable: kvarAllowable,
                kvar_excess: kvarExcess,
                pf_penalty_rate: pfPenaltyRate,
                pf_penalty_amount: pfPenaltyAmount,
                service_charge: serviceCharge,
                ft_rate: ftRate,
                ft_amount: ftAmount,
                vat_percent: vatPercent,
                vat_amount: vatAmount,
                subtotal: subtotal,
                total_amount: totalAmount,
                tariff_info: {
                    effective_date: rate.effective_date,
                    on_peak_rate: onPeakRate,
                    off_peak_rate: offPeakRate,
                    demand_rate: demandRate,
                    pf_penalty_rate: pfPenaltyRate,
                    pf_threshold_factor: pfThresholdFactor,
                    service_charge: serviceCharge,
                    ft_rate: ftRate,
                    vat_percent: vatPercent,
                },
            };
        });

        return { data: rows, total, page, limit, tariff: rate };
    }

    async getEnergyMonthlyReport(queryParams: any) {
        const { page, limit, offset } = parsePagination(queryParams);
        const { siteId, buildingId, zoneId, meterTypeId, meterId, search, mdb } = queryParams;
        const now = new Date();
        const year = parseInt(queryParams.year) || (queryParams.month?.includes('-') ? parseInt(queryParams.month.split('-')[0]) : now.getFullYear());
        const month = parseInt(queryParams.month?.includes('-') ? queryParams.month.split('-')[1] : queryParams.month) || (now.getMonth() + 1);

        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        const monthStr = `${year}-${String(month).padStart(2, '0')}`;

        const params: any[] = [];
        const meterFilters: string[] = ['m.is_active IS DISTINCT FROM false'];

        const mdbScope = String(mdb || '').toLowerCase();
        const MDB_MATCH = `(EXISTS (SELECT 1 FROM meter_type mt WHERE mt.meter_type_id = m.meter_type_id AND mt.meter_type_name ILIKE '%MDB%') OR m.meter_name ILIKE '%MDB%' OR m.meter_code ILIKE '%MDB%')`;
        if (mdbScope === 'only') {
            meterFilters.push(MDB_MATCH);
        } else if (mdbScope === 'exclude') {
            meterFilters.push(`NOT ${MDB_MATCH}`);
        }

        const siteIds = parseSiteIds(siteId);
        if (siteIds) { params.push(siteIds); meterFilters.push(`m.site_id = ANY($${params.length}::int[])`); }
        if (buildingId) { params.push(parseInt(buildingId)); meterFilters.push(`m.building_id = $${params.length}`); }
        if (zoneId) { params.push(parseInt(zoneId)); meterFilters.push(`m.zone_id = $${params.length}`); }
        if (meterTypeId) { params.push(parseInt(meterTypeId)); meterFilters.push(`m.meter_type_id = $${params.length}`); }
        if (meterId) { params.push(parseInt(meterId)); meterFilters.push(`m.meter_id = $${params.length}`); }
        if (search) {
            params.push(`%${String(search).trim()}%`);
            meterFilters.push(`(m.meter_code ILIKE $${params.length} OR m.meter_name ILIKE $${params.length} OR m.room_name ILIKE $${params.length})`);
        }

        params.push(startDate);
        const startParam = params.length;
        params.push(endDate);
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
             ON (fallback_meter.site_el::text = r.channel OR (fallback_meter.site_el::text = r.site_id::text AND fallback_meter.address::text = r.address_id::text))
             AND rmm.id IS NULL
            WHERE r.received_at >= (($${startParam}::date - 60)::timestamp AT TIME ZONE 'Asia/Bangkok')
              AND r.received_at < (($${endParam}::date + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')
        ), meter_scope AS (
            SELECT m.*, b.building_name, z.zone_name, s.site_name AS project_name
            FROM meter m
            LEFT JOIN buildings b ON b.building_id = m.building_id
            LEFT JOIN zones z ON z.zone_id = m.zone_id
            LEFT JOIN sites s ON s.site_id = m.site_id
            WHERE ${meterFilters.join(' AND ')}
        ), start_points_before AS (
            SELECT DISTINCT ON (m.meter_id)
                m.meter_id, r.received_at AS start_date, r.import_kwhr AS start_reading
            FROM meter_scope m JOIN mapped r ON r.mapped_meter_id = m.meter_id
            WHERE r.received_at <= ($${startParam}::date::timestamp AT TIME ZONE 'Asia/Bangkok')
            ORDER BY m.meter_id, r.received_at DESC, r.id DESC
        ), start_points_first AS (
            SELECT DISTINCT ON (m.meter_id)
                m.meter_id, r.received_at AS start_date, r.import_kwhr AS start_reading
            FROM meter_scope m JOIN mapped r ON r.mapped_meter_id = m.meter_id
            WHERE r.received_at >= ($${startParam}::date::timestamp AT TIME ZONE 'Asia/Bangkok')
              AND r.received_at < (($${endParam}::date + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')
            ORDER BY m.meter_id, r.received_at ASC, r.id ASC
        ), end_points AS (
            SELECT DISTINCT ON (m.meter_id)
                m.meter_id, r.received_at AS end_date, r.import_kwhr AS end_reading
            FROM meter_scope m JOIN mapped r ON r.mapped_meter_id = m.meter_id
            WHERE r.received_at < (($${endParam}::date + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')
            ORDER BY m.meter_id, r.received_at DESC, r.id DESC
        ), actual_start AS (
            SELECT DISTINCT ON (d.meter_id)
                d.meter_id, d.date_keep AS start_date, d.energy_kwh AS start_reading
            FROM actual_meter_data d
            JOIN meter_scope m ON m.meter_id = d.meter_id
            WHERE d.date_keep <= ($${startParam}::date::timestamp AT TIME ZONE 'Asia/Bangkok')
            ORDER BY d.meter_id, d.date_keep DESC, d.id DESC
        ), actual_end AS (
            SELECT DISTINCT ON (d.meter_id)
                d.meter_id, d.date_keep AS end_date, d.energy_kwh AS end_reading
            FROM actual_meter_data d
            JOIN meter_scope m ON m.meter_id = d.meter_id
            WHERE d.date_keep < (($${endParam}::date + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')
            ORDER BY d.meter_id, d.date_keep DESC, d.id DESC
        ), report_rows AS (
            SELECT
                m.meter_id, m.meter_code, m.meter_name AS customer_name,
                m.building_name, m.floor, m.room_code AS site_code,
                COALESCE(m.room_name, m.zone_name, m.project_name) AS site_name,
                COALESCE(spb.start_date, act_s.start_date, spf.start_date, $${startParam}::timestamp) AS start_date,
                COALESCE(spb.start_reading, act_s.start_reading, spf.start_reading, ep.end_reading, act_e.end_reading, 0) AS start_reading,
                COALESCE(ep.end_date, act_e.end_date, $${endParam}::timestamp) AS end_date,
                COALESCE(ep.end_reading, act_e.end_reading, spb.start_reading, act_s.start_reading, 0) AS end_reading,
                GREATEST(
                    COALESCE(ep.end_reading, act_e.end_reading, 0) -
                    COALESCE(spb.start_reading, act_s.start_reading, spf.start_reading, ep.end_reading, act_e.end_reading, 0),
                    0
                ) AS units_used,
                COALESCE(rate.unit_price, 4.15) AS unit_price,
                COALESCE(rate.rate_mode, 'tiered') AS rate_mode,
                COALESCE(rate.tier1_limit, 200.00) AS tier1_limit,
                COALESCE(rate.tier1_rate, 3.0000) AS tier1_rate,
                COALESCE(rate.tier2_rate, 4.2200) AS tier2_rate,
                COALESCE(rate.service_charge, 24.6200) AS service_charge,
                COALESCE(rate.ft_rate, 0.1623) AS ft_rate,
                COALESCE(rate.vat_percent, 7.00) AS vat_percent,
                rate.effective_date AS tariff_effective_date
            FROM meter_scope m
            LEFT JOIN end_points ep ON ep.meter_id = m.meter_id
            LEFT JOIN actual_end act_e ON act_e.meter_id = m.meter_id
            LEFT JOIN start_points_before spb ON spb.meter_id = m.meter_id
            LEFT JOIN start_points_first spf ON spf.meter_id = m.meter_id
            LEFT JOIN actual_start act_s ON act_s.meter_id = m.meter_id
            LEFT JOIN LATERAL (
                SELECT * FROM billing_config
                WHERE is_active = true AND effective_date <= $${endParam}::date
                ORDER BY effective_date DESC, id DESC LIMIT 1
            ) rate ON true
            WHERE ep.end_reading IS NOT NULL OR act_e.end_reading IS NOT NULL OR spb.start_reading IS NOT NULL OR act_s.start_reading IS NOT NULL
        )`;

        const dataParams = [...params, limit, offset];
        const result = await query(
            `${baseCtes} SELECT report_rows.*, COUNT(*) OVER()::int AS full_count FROM report_rows
             ORDER BY building_name, floor, meter_code
             LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
            dataParams
        );
        const total = Number(result.rows[0]?.full_count || 0);

        const rows = result.rows.map(({ full_count, ...r }: any) => {
            const unitsUsed = Number(r.units_used || 0);
            const rateMode = r.rate_mode || 'tiered';
            const tier1Limit = Number(r.tier1_limit || 200);
            const tier1Rate = Number(r.tier1_rate || 3.00);
            const tier2Rate = Number(r.tier2_rate || 4.22);
            const unitPrice = Number(r.unit_price || 4.15);
            const serviceCharge = Number(r.service_charge || 24.62);
            const ftRate = Number(r.ft_rate || 0.1623);
            const vatPercent = Number(r.vat_percent || 7.00);

            let tier1Units = 0;
            let tier1Amount = 0;
            let tier2Units = 0;
            let tier2Amount = 0;
            let energyAmount = 0;

            if (rateMode === 'tiered') {
                tier1Units = Math.min(unitsUsed, tier1Limit);
                tier2Units = Math.max(0, unitsUsed - tier1Limit);
                tier1Amount = tier1Units * tier1Rate;
                tier2Amount = tier2Units * tier2Rate;
                energyAmount = tier1Amount + tier2Amount;
            } else {
                tier1Units = unitsUsed;
                tier1Amount = unitsUsed * unitPrice;
                energyAmount = tier1Amount;
            }

            const ftAmount = unitsUsed * ftRate;
            const subtotal = energyAmount + serviceCharge + ftAmount;
            const vatAmount = subtotal * (vatPercent / 100);
            const totalAmount = subtotal + vatAmount;

            return {
                ...r,
                billing_month: monthStr,
                billing_period: `${startDate} — ${endDate}`,
                units_used: unitsUsed,
                rate_mode: rateMode,
                tier1_limit: tier1Limit,
                tier1_rate: tier1Rate,
                tier1_units: tier1Units,
                tier1_amount: tier1Amount,
                tier2_rate: tier2Rate,
                tier2_units: tier2Units,
                tier2_amount: tier2Amount,
                energy_amount: energyAmount,
                service_charge: serviceCharge,
                ft_rate: ftRate,
                ft_amount: ftAmount,
                subtotal: subtotal,
                vat_percent: vatPercent,
                vat_amount: vatAmount,
                total_amount: totalAmount,
                tariff_info: {
                    effective_date: r.tariff_effective_date,
                    rate_mode: rateMode,
                    tier1_limit: tier1Limit,
                    tier1_rate: tier1Rate,
                    tier2_rate: tier2Rate,
                    unit_price: unitPrice,
                    service_charge: serviceCharge,
                    ft_rate: ftRate,
                    vat_percent: vatPercent,
                },
            };
        });

        return {
            data: rows,
            total,
            page,
            limit,
            billingMonth: monthStr,
            billingPeriod: { startDate, endDate },
        };
    }

    async getTouMonthlyReport(queryParams: any) {
        const { page, limit, offset } = parsePagination(queryParams);
        const { siteId, buildingId, zoneId, meterTypeId, meterId, search, mdb } = queryParams;
        const now = new Date();
        const year = parseInt(queryParams.year) || (queryParams.month?.includes('-') ? parseInt(queryParams.month.split('-')[0]) : now.getFullYear());
        const month = parseInt(queryParams.month?.includes('-') ? queryParams.month.split('-')[1] : queryParams.month) || (now.getMonth() + 1);

        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        const monthStr = `${year}-${String(month).padStart(2, '0')}`;

        // Forward to getTouReport with exact month start and end dates
        const result = await this.getTouReport({
            ...queryParams,
            startDate,
            endDate,
            page,
            limit,
        });

        const rows = result.data.map((r: any) => ({
            ...r,
            billing_month: monthStr,
            billing_period: `${startDate} — ${endDate}`,
        }));

        return {
            ...result,
            data: rows,
            billingMonth: monthStr,
            billingPeriod: { startDate, endDate },
        };
    }

    /**
     * ดึงข้อมูลมิเตอร์ไฟฟ้า-น้ำ ตามรูปแบบ CHOD (ตามตัวอย่างใน PDF)
     * Header: BATCH_NAME|LEASE_NUMBER|VR NUMBER|REP_STR_DATE|REP_END_DATE|USAGE|METER_FROM|METER_TO
     * รองรับผลลัพธ์ทั้งรูปแบบ CSV (.csv) และ JSON
     */
    async getChodReport(queryParams: any) {
        const {
            siteId,
            buildingId,
            zoneId,
            meterTypeId,
            meterId,
            search,
            utilityType,
            batchName = '',
            delimiter = 'pipe',
        } = queryParams;

        const sep = (delimiter === 'comma' || delimiter === ',') ? ',' : '|';

        const now = new Date();
        let startDate = queryParams.startDate;
        let endDate = queryParams.endDate;

        if (!startDate || !endDate) {
            let year = parseInt(queryParams.year, 10);
            let month = parseInt(queryParams.month, 10);
            if (!year || !month) {
                // Default to previous month if available, or current month
                const d = new Date(now.getFullYear(), now.getMonth(), 0);
                year = d.getFullYear();
                month = d.getMonth() + 1;
            }
            if (!startDate) {
                startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            }
            if (!endDate) {
                const lastDay = new Date(year, month, 0).getDate();
                endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            }
        }

        const repStartDate = formatChodDate(startDate);
        const repEndDate = formatChodDate(endDate);

        const params: any[] = [];
        const meterFilters: string[] = ['m.is_active IS DISTINCT FROM false'];

        const siteIds = parseSiteIds(siteId);
        if (siteIds) {
            params.push(siteIds);
            meterFilters.push(`m.site_id = ANY($${params.length}::int[])`);
        }
        if (buildingId) {
            params.push(parseInt(buildingId, 10));
            meterFilters.push(`m.building_id = $${params.length}`);
        }
        if (zoneId) {
            params.push(parseInt(zoneId, 10));
            meterFilters.push(`m.zone_id = $${params.length}`);
        }
        if (meterTypeId) {
            params.push(parseInt(meterTypeId, 10));
            meterFilters.push(`m.meter_type_id = $${params.length}`);
        }
        if (meterId) {
            params.push(parseInt(meterId, 10));
            meterFilters.push(`m.meter_id = $${params.length}`);
        }

        // Utility type filter: electric (ELE) vs water (WATER) vs all
        const uType = String(utilityType || queryParams.type || '').toLowerCase().trim();
        if (uType === 'electric' || uType === 'ele' || uType === 'power') {
            meterFilters.push(`(
                (mt.meter_type_name ILIKE '%power%' OR mt.meter_type_name ILIKE '%ele%')
                OR m.meter_name ILIKE '%-E%'
                OR m.meter_code ILIKE '%-E%'
                OR COALESCE(m.vr_number, '') ILIKE '%-E%'
            )`);
        } else if (uType === 'water' || uType === 'wtr') {
            meterFilters.push(`(
                (mt.meter_type_name ILIKE '%water%' OR mt.meter_type_name ILIKE '%wtr%')
                OR m.meter_name ILIKE '%-W%'
                OR m.meter_code ILIKE '%-W%'
                OR COALESCE(m.vr_number, '') ILIKE '%-W%'
            )`);
        }

        if (search) {
            params.push(`%${String(search).trim()}%`);
            meterFilters.push(`(
                m.meter_code ILIKE $${params.length}
                OR m.meter_name ILIKE $${params.length}
                OR COALESCE(m.lease_number, '') ILIKE $${params.length}
                OR COALESCE(m.vr_number, '') ILIKE $${params.length}
                OR COALESCE(m.room_code, '') ILIKE $${params.length}
                OR COALESCE(m.room_name, '') ILIKE $${params.length}
            )`);
        }

        params.push(startDate);
        const startParam = params.length;
        params.push(endDate);
        const endParam = params.length;

        const sql = `
            WITH mapped AS (
                SELECT r.id, r.channel, r.site_id, r.address_id, r.received_at, r.import_kwhr,
                       COALESCE(rmm.meter_id, fallback_meter.meter_id) AS mapped_meter_id
                FROM meter_data_realtime r
                LEFT JOIN realtime_meter_map rmm
                  ON rmm.realtime_site_id = r.site_id
                 AND rmm.realtime_address_id = r.address_id
                 AND rmm.is_active = true
                 AND (rmm.channel IS NULL OR rmm.channel = r.channel)
                LEFT JOIN meter fallback_meter
                 ON (fallback_meter.site_el::text = r.channel OR (fallback_meter.site_el::text = r.site_id::text AND fallback_meter.address::text = r.address_id::text))
                 AND rmm.id IS NULL
                WHERE r.received_at >= (($${startParam}::date - 60)::timestamp AT TIME ZONE 'Asia/Bangkok')
                  AND r.received_at < (($${endParam}::date + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')
            ),
            meter_scope AS (
                SELECT m.meter_id, m.meter_code, m.meter_name,
                       m.building_id, m.zone_id, m.site_id, m.floor,
                       m.room_code, m.room_name, m.meter_group,
                       COALESCE(m.lease_number, m.room_code, m.meter_group, '') AS lease_number,
                       COALESCE(m.vr_number, m.meter_name, m.meter_code) AS vr_number,
                       b.building_name, s.site_name, mt.meter_type_name
                FROM meter m
                LEFT JOIN meter_type mt ON mt.meter_type_id = m.meter_type_id
                LEFT JOIN buildings b ON b.building_id = m.building_id
                LEFT JOIN sites s ON s.site_id = m.site_id
                WHERE ${meterFilters.join(' AND ')}
            ),
            start_points_before AS (
                SELECT DISTINCT ON (m.meter_id)
                    m.meter_id, r.received_at AS start_date, r.import_kwhr AS start_reading
                FROM meter_scope m JOIN mapped r ON r.mapped_meter_id = m.meter_id
                WHERE r.received_at <= ($${startParam}::date::timestamp AT TIME ZONE 'Asia/Bangkok')
                ORDER BY m.meter_id, r.received_at DESC, r.id DESC
            ),
            start_points_first AS (
                SELECT DISTINCT ON (m.meter_id)
                    m.meter_id, r.received_at AS start_date, r.import_kwhr AS start_reading
                FROM meter_scope m JOIN mapped r ON r.mapped_meter_id = m.meter_id
                WHERE r.received_at >= ($${startParam}::date::timestamp AT TIME ZONE 'Asia/Bangkok')
                  AND r.received_at < (($${endParam}::date + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')
                ORDER BY m.meter_id, r.received_at ASC, r.id ASC
            ),
            end_points AS (
                SELECT DISTINCT ON (m.meter_id)
                    m.meter_id, r.received_at AS end_date, r.import_kwhr AS end_reading
                FROM meter_scope m JOIN mapped r ON r.mapped_meter_id = m.meter_id
                WHERE r.received_at < (($${endParam}::date + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')
                ORDER BY m.meter_id, r.received_at DESC, r.id DESC
            ),
            actual_start AS (
                SELECT DISTINCT ON (d.meter_id)
                    d.meter_id, d.date_keep AS start_date, d.energy_kwh AS start_reading
                FROM actual_meter_data d
                JOIN meter_scope m ON m.meter_id = d.meter_id
                WHERE d.date_keep <= ($${startParam}::date::timestamp AT TIME ZONE 'Asia/Bangkok')
                ORDER BY d.meter_id, d.date_keep DESC, d.id DESC
            ),
            actual_end AS (
                SELECT DISTINCT ON (d.meter_id)
                    d.meter_id, d.date_keep AS end_date, d.energy_kwh AS end_reading
                FROM actual_meter_data d
                JOIN meter_scope m ON m.meter_id = d.meter_id
                WHERE d.date_keep < (($${endParam}::date + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')
                ORDER BY d.meter_id, d.date_keep DESC, d.id DESC
            )
            SELECT
                m.meter_id,
                m.meter_code,
                m.meter_name,
                m.lease_number,
                m.vr_number,
                m.meter_type_name,
                ROUND(COALESCE(spb.start_reading, act_s.start_reading, spf.start_reading, ep.end_reading, act_e.end_reading, 0)::numeric, 0) AS meter_from,
                ROUND(COALESCE(ep.end_reading, act_e.end_reading, spb.start_reading, act_s.start_reading, 0)::numeric, 0) AS meter_to,
                GREATEST(
                    ROUND(COALESCE(ep.end_reading, act_e.end_reading, 0)::numeric, 0) -
                    ROUND(COALESCE(spb.start_reading, act_s.start_reading, spf.start_reading, ep.end_reading, act_e.end_reading, 0)::numeric, 0),
                    0
                ) AS usage
            FROM meter_scope m
            LEFT JOIN end_points ep ON ep.meter_id = m.meter_id
            LEFT JOIN actual_end act_e ON act_e.meter_id = m.meter_id
            LEFT JOIN start_points_before spb ON spb.meter_id = m.meter_id
            LEFT JOIN start_points_first spf ON spf.meter_id = m.meter_id
            LEFT JOIN actual_start act_s ON act_s.meter_id = m.meter_id
            ORDER BY m.lease_number ASC, m.vr_number ASC, m.meter_code ASC
        `;

        const result = await query(sql, params);

        const data = result.rows.map((r: any) => {
            const meterFrom = Number(r.meter_from || 0);
            const meterTo = Number(r.meter_to || 0);
            const usage = Number(r.usage != null ? r.usage : Math.max(0, meterTo - meterFrom));

            return {
                BATCH_NAME: batchName || '',
                LEASE_NUMBER: r.lease_number || '',
                'VR NUMBER': r.vr_number || r.meter_name || r.meter_code || '',
                REP_STR_DATE: repStartDate,
                REP_END_DATE: repEndDate,
                USAGE: usage,
                METER_FROM: meterFrom,
                METER_TO: meterTo,
                // Extra fields for API consumers
                meter_id: r.meter_id,
                meter_code: r.meter_code,
                meter_name: r.meter_name,
                meter_type: r.meter_type_name,
            };
        });

        // Generate CSV string:
        // สำหรับรูปแบบ Pipe ('|'): แต่ละแถวจะขึ้นต้นด้วย '|' ตามตัวอย่างฟอร์แมต CHOD ใน PDF
        // สำหรับรูปแบบ Comma (','): เป็นฟอร์แมต CSV มาตรฐาน ไม่ต้องมีคอมมานำหน้า
        const isPipe = sep === '|';
        const prefix = isPipe ? '|' : '';

        const hasBatchName = Boolean(batchName && String(batchName).trim().length > 0);
        const headers = hasBatchName
            ? ['BATCH_NAME', 'LEASE_NUMBER', 'VR NUMBER', 'REP_STR_DATE', 'REP_END_DATE', 'USAGE', 'METER_FROM', 'METER_TO']
            : ['LEASE_NUMBER', 'VR NUMBER', 'REP_STR_DATE', 'REP_END_DATE', 'USAGE', 'METER_FROM', 'METER_TO'];

        const csvRows = [prefix + headers.join(sep)];
        for (const row of data) {
            const leaseNo = row.LEASE_NUMBER || row.meter_code || '-';
            const rowValues = hasBatchName
                ? [
                    row.BATCH_NAME,
                    leaseNo,
                    row['VR NUMBER'],
                    row.REP_STR_DATE,
                    row.REP_END_DATE,
                    row.USAGE,
                    row.METER_FROM,
                    row.METER_TO,
                  ]
                : [
                    leaseNo,
                    row['VR NUMBER'],
                    row.REP_STR_DATE,
                    row.REP_END_DATE,
                    row.USAGE,
                    row.METER_FROM,
                    row.METER_TO,
                  ];
            csvRows.push(prefix + formatChodCsvRow(rowValues, sep));
        }

        const csvString = csvRows.join('\r\n');
        const filename = `meter_readings_${uType || 'all'}_${startDate}_${endDate}.csv`;


        const totalUsage = data.reduce((sum: number, item: any) => sum + item.USAGE, 0);

        return {
            data,
            csv: csvString,
            filename,
            total: data.length,
            page: 1,
            limit: data.length,
            summary: {
                totalMeters: data.length,
                totalUsage,
                startDate,
                endDate,
                repStartDate,
                repEndDate,
                utilityType: uType || 'all',
                delimiter: sep === '|' ? 'pipe' : 'comma',
            },
        };
    }

    /**
     * ส่งออกรายงานทั่วไปเป็นไฟล์ CSV
     */
    async exportReportCsv(reportType: string, queryParams: any) {
        if (reportType === 'chod' || reportType === 'chod-meter-readings' || reportType === 'meter-readings') {
            return this.getChodReport({ ...queryParams, format: 'csv' });
        }
        let result: any;
        if (reportType === 'energy-consumption') {
            result = await this.getEnergyConsumption({ ...queryParams, limit: 10000 });
        } else if (reportType === 'energy-monthly') {
            result = await this.getEnergyMonthlyReport({ ...queryParams, limit: 10000 });
        } else if (reportType === 'tou') {
            result = await this.getTouReport({ ...queryParams, limit: 10000 });
        } else if (reportType === 'tou-monthly') {
            result = await this.getTouMonthlyReport({ ...queryParams, limit: 10000 });
        } else if (reportType === 'history') {
            result = await this.getHistory({ ...queryParams, limit: 10000 });
        } else if (reportType === 'comparison') {
            result = await this.getComparison({ ...queryParams, limit: 10000 });
        } else {
            throw new Error(`Unsupported report type: ${reportType}`);
        }

        const rows = result.data || [];
        if (rows.length === 0) {
            return {
                csv: 'No data',
                filename: `${reportType}_export.csv`,
            };
        }
        const headers = Object.keys(rows[0]);
        const csvRows = [headers.join(',')];
        for (const row of rows) {
            csvRows.push(headers.map(h => {
                const val = row[h];
                if (val === null || val === undefined) return '';
                const str = String(val);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            }).join(','));
        }

        return {
            csv: csvRows.join('\r\n'),
            filename: `${reportType}_${queryParams.startDate || 'export'}.csv`,
        };
    }

    /**
     * ส่งออกรายงานทั่วไปเป็นไฟล์ Excel (.xlsx)
     */
    async exportReportExcel(reportType: string, queryParams: any) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const XLSX = require('xlsx');
        let dataRows: any[] = [];
        let filename = `${reportType}_report.xlsx`;

        if (reportType === 'chod' || reportType === 'chod-meter-readings') {
            const chodResult = await this.getChodReport({ ...queryParams, format: 'json' });
            dataRows = chodResult.data.map((r: any) => ({
                BATCH_NAME: r.BATCH_NAME,
                LEASE_NUMBER: r.LEASE_NUMBER,
                'VR NUMBER': r['VR NUMBER'],
                REP_STR_DATE: r.REP_STR_DATE,
                REP_END_DATE: r.REP_END_DATE,
                USAGE: r.USAGE,
                METER_FROM: r.METER_FROM,
                METER_TO: r.METER_TO,
            }));
            filename = `chod_meter_readings_${queryParams.startDate || ''}.xlsx`;
        } else if (reportType === 'energy-consumption') {
            const res = await this.getEnergyConsumption({ ...queryParams, limit: 10000 });
            dataRows = res.data;
        } else if (reportType === 'energy-monthly') {
            const res = await this.getEnergyMonthlyReport({ ...queryParams, limit: 10000 });
            dataRows = res.data;
        } else if (reportType === 'tou') {
            const res = await this.getTouReport({ ...queryParams, limit: 10000 });
            dataRows = res.data;
        } else if (reportType === 'tou-monthly') {
            const res = await this.getTouMonthlyReport({ ...queryParams, limit: 10000 });
            dataRows = res.data;
        } else if (reportType === 'history') {
            const res = await this.getHistory({ ...queryParams, limit: 10000 });
            dataRows = res.data;
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataRows);
        XLSX.utils.book_append_sheet(wb, ws, 'Report');
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        return { buffer, filename };
    }
}

/**
 * รูปแบบวันที่ตามตัวอย่างใน PDF: D-MMM-YY เช่น 1-Feb-26, 28-Feb-26, 31-Mar-26
 */
export function formatChodDate(dateInput: Date | string): string {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (!d || isNaN(d.getTime())) return '';
    const day = d.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
}

/**
 * ฟังก์ชันช่วยสร้างแถว CSV พร้อม escaping ตามมาตรฐาน
 */
export function formatChodCsvRow(values: (string | number | null | undefined)[], delimiter: string = '|'): string {
    return values.map(val => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (delimiter === ',' && (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r'))) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        if (delimiter === '|' && (str.includes('|') || str.includes('\n') || str.includes('\r'))) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }).join(delimiter);
}


