import { query } from '../../config/database';
import { parsePagination } from '../../utils/pagination';

export class MeterDataService {
    async getRealtimeData(queryParams: any) {
        const { siteId, buildingId, zoneId, meterTypeId } = queryParams;
        let whereClause = 'WHERE 1=1';
        const params: any[] = [];

        if (siteId) { params.push(parseInt(siteId)); whereClause += ` AND m.site_id = $${params.length}`; }
        if (buildingId) { params.push(parseInt(buildingId)); whereClause += ` AND m.building_id = $${params.length}`; }
        if (zoneId) { params.push(parseInt(zoneId)); whereClause += ` AND m.zone_id = $${params.length}`; }
        if (meterTypeId) { params.push(parseInt(meterTypeId)); whereClause += ` AND m.meter_type_id = $${params.length}`; }

        const result = await query(
            `SELECT DISTINCT ON (m.meter_id)
        m.meter_id, m.meter_code, m.meter_name, m.room_code, m.room_name,
        d.status, d.date_keep,
        d.energy_kwh, d.energy_kva, d.energy_kw, d.energy_kvar, d.energy_frequency,
        d.energy_volt_p1, d.energy_volt_p2, d.energy_volt_p3,
        d.energy_amp1, d.energy_amp2, d.energy_amp3,
        d.energy_pf1, d.energy_pf2, d.energy_pf3,
        z.zone_name, b.building_name
       FROM meter m
       LEFT JOIN LATERAL (
         SELECT * FROM actual_meter_data amd WHERE amd.meter_id = m.meter_id ORDER BY amd.date_keep DESC LIMIT 1
       ) d ON true
       LEFT JOIN zones z ON m.zone_id = z.zone_id
       LEFT JOIN buildings b ON m.building_id = b.building_id
       ${whereClause}
       ORDER BY m.meter_id`,
            params
        );
        return result.rows;
    }

    async getHistoryData(queryParams: any) {
        const { page, limit, offset } = parsePagination(queryParams);
        const { meterId, startDate, endDate } = queryParams;
        let whereClause = 'WHERE 1=1';
        const params: any[] = [];

        if (meterId) { params.push(parseInt(meterId)); whereClause += ` AND d.meter_id = $${params.length}`; }
        if (startDate) { params.push(startDate); whereClause += ` AND d.date_keep >= $${params.length}`; }
        if (endDate) { params.push(endDate); whereClause += ` AND d.date_keep <= $${params.length}`; }

        const countResult = await query(`SELECT COUNT(*) FROM actual_meter_data d ${whereClause}`, params);
        const total = parseInt(countResult.rows[0].count);

        params.push(limit, offset);
        const result = await query(
            `SELECT d.*, m.meter_name, m.meter_code, m.room_code, m.room_name
       FROM actual_meter_data d
       LEFT JOIN meter m ON d.meter_id = m.meter_id
       ${whereClause}
       ORDER BY d.date_keep DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );
        return { data: result.rows, total, page, limit };
    }

    async getDailyData(queryParams: any) {
        const { siteId, buildingId, zoneId, startDate, endDate } = queryParams;
        let whereClause = 'WHERE 1=1';
        const params: any[] = [];

        if (siteId) { params.push(parseInt(siteId)); whereClause += ` AND m.site_id = $${params.length}`; }
        if (buildingId) { params.push(parseInt(buildingId)); whereClause += ` AND m.building_id = $${params.length}`; }
        if (zoneId) { params.push(parseInt(zoneId)); whereClause += ` AND m.zone_id = $${params.length}`; }
        if (startDate) { params.push(startDate); whereClause += ` AND d.date_keep >= $${params.length}`; }
        if (endDate) { params.push(endDate); whereClause += ` AND d.date_keep <= $${params.length}`; }

        const result = await query(
            `SELECT m.meter_id, m.meter_name, m.meter_code,
              DATE(d.date_keep) as date,
              MAX(d.energy_kwh) - MIN(d.energy_kwh) as daily_consumption,
              MAX(d.energy_kwh) as max_kwh,
              MIN(d.energy_kwh) as min_kwh
       FROM actual_meter_data d
       JOIN meter m ON d.meter_id = m.meter_id
       ${whereClause}
       GROUP BY m.meter_id, m.meter_name, m.meter_code, DATE(d.date_keep)
       ORDER BY DATE(d.date_keep) DESC, m.meter_id`,
            params
        );
        return result.rows;
    }

    async getMonthlyData(queryParams: any) {
        const { siteId, year } = queryParams;
        const params: any[] = [];
        let whereClause = 'WHERE 1=1';

        if (siteId) { params.push(parseInt(siteId)); whereClause += ` AND m.site_id = $${params.length}`; }
        if (year) { params.push(parseInt(year)); whereClause += ` AND EXTRACT(YEAR FROM d.date_keep) = $${params.length}`; }

        const result = await query(
            `SELECT m.meter_id, m.meter_name,
              EXTRACT(MONTH FROM d.date_keep)::int as month,
              EXTRACT(YEAR FROM d.date_keep)::int as year,
              MAX(d.energy_kwh) - MIN(d.energy_kwh) as monthly_consumption
       FROM actual_meter_data d
       JOIN meter m ON d.meter_id = m.meter_id
       ${whereClause}
       GROUP BY m.meter_id, m.meter_name, EXTRACT(MONTH FROM d.date_keep), EXTRACT(YEAR FROM d.date_keep)
       ORDER BY year DESC, month DESC`,
            params
        );
        return result.rows;
    }
}
