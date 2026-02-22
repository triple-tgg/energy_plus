import { query } from '../../config/database';

export class DashboardService {
    async getZoneConsumption(queryParams: any) {
        const { siteId, zoneId, period } = queryParams;
        const params: any[] = [];
        let dateFilter = '';

        if (period === 'week') {
            dateFilter = `AND d.date_keep >= NOW() - INTERVAL '7 days'`;
        } else if (period === 'month') {
            dateFilter = `AND d.date_keep >= NOW() - INTERVAL '30 days'`;
        } else {
            dateFilter = `AND d.date_keep >= NOW() - INTERVAL '7 days'`;
        }

        let whereClause = `WHERE 1=1 ${dateFilter}`;
        if (siteId) { params.push(parseInt(siteId)); whereClause += ` AND m.site_id = $${params.length}`; }
        if (zoneId) { params.push(parseInt(zoneId)); whereClause += ` AND m.zone_id = $${params.length}`; }

        const result = await query(
            `SELECT z.zone_name, DATE(d.date_keep) as date,
              SUM(CASE WHEN d.energy_kwh > 0 THEN d.energy_kwh ELSE 0 END) as total_kwh
       FROM actual_meter_data d
       JOIN meter m ON d.meter_id = m.meter_id
       JOIN zones z ON m.zone_id = z.zone_id
       ${whereClause}
       GROUP BY z.zone_name, DATE(d.date_keep)
       ORDER BY DATE(d.date_keep)`,
            params
        );
        return result.rows;
    }

    async getMdbConsumption(queryParams: any) {
        const { siteId, period } = queryParams;
        const params: any[] = [];
        let dateFilter = period === 'month'
            ? `AND d.date_keep >= NOW() - INTERVAL '30 days'`
            : `AND d.date_keep >= NOW() - INTERVAL '7 days'`;

        let whereClause = `WHERE m.meter_name ILIKE '%MDB%' ${dateFilter}`;
        if (siteId) { params.push(parseInt(siteId)); whereClause += ` AND m.site_id = $${params.length}`; }

        const result = await query(
            `SELECT m.meter_name, DATE(d.date_keep) as date,
              MAX(d.energy_kwh) - MIN(d.energy_kwh) as daily_kwh
       FROM actual_meter_data d
       JOIN meter m ON d.meter_id = m.meter_id
       ${whereClause}
       GROUP BY m.meter_name, DATE(d.date_keep)
       ORDER BY DATE(d.date_keep)`,
            params
        );
        return result.rows;
    }

    async getDemandData(queryParams: any) {
        const { siteId } = queryParams;
        const params: any[] = [];
        let whereClause = `WHERE d.date_keep >= NOW() - INTERVAL '30 days'`;
        if (siteId) { params.push(parseInt(siteId)); whereClause += ` AND m.site_id = $${params.length}`; }

        const result = await query(
            `SELECT DATE(d.date_keep) as date,
              MAX(d.energy_kw) as peak_demand,
              AVG(d.energy_kw) as avg_demand
       FROM actual_meter_data d
       JOIN meter m ON d.meter_id = m.meter_id
       ${whereClause}
       GROUP BY DATE(d.date_keep)
       ORDER BY DATE(d.date_keep)`,
            params
        );
        return result.rows;
    }

    async getConsumptionTable(queryParams: any) {
        const { siteId, zoneId, period } = queryParams;
        const params: any[] = [];
        let dateFilter = '';

        if (period === 'month') {
            dateFilter = `AND d.date_keep >= NOW() - INTERVAL '30 days'`;
        } else {
            dateFilter = `AND d.date_keep >= NOW() - INTERVAL '7 days'`;
        }

        let whereClause = `WHERE 1=1 ${dateFilter}`;
        if (siteId) { params.push(parseInt(siteId)); whereClause += ` AND m.site_id = $${params.length}`; }
        if (zoneId) { params.push(parseInt(zoneId)); whereClause += ` AND m.zone_id = $${params.length}`; }

        const result = await query(
            `SELECT z.zone_name, DATE(d.date_keep) as date,
              MAX(d.energy_kwh) as kwh,
              MAX(d.energy_kwh) - MIN(d.energy_kwh) as consumption
       FROM actual_meter_data d
       JOIN meter m ON d.meter_id = m.meter_id
       JOIN zones z ON m.zone_id = z.zone_id
       ${whereClause}
       GROUP BY z.zone_name, DATE(d.date_keep)
       ORDER BY z.zone_name, DATE(d.date_keep) DESC`,
            params
        );
        return result.rows;
    }
}
