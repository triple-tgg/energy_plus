import { query } from '../../config/database';
import { aggregationConfig } from '../../config/aggregation';

const numberOrNull = (value: any): number | null => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const toNumber = (value: any, fallback = 0): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export class DashboardService {
    async getZoneDashboardData(queryParams: any) {
        const siteId = numberOrNull(queryParams.siteId);
        const buildingId = numberOrNull(queryParams.buildingId);
        const floor = numberOrNull(queryParams.floor);
        const zoneId = numberOrNull(queryParams.zoneId);
        const params: any[] = [];
        let meterFilter = 'WHERE m.is_active IS DISTINCT FROM false';
        if (siteId) {
            params.push(siteId);
            meterFilter += ` AND m.site_id = $${params.length}`;
        }
        if (buildingId) {
            params.push(buildingId);
            meterFilter += ` AND m.building_id = $${params.length}`;
        }
        if (floor !== null) {
            params.push(floor);
            meterFilter += ` AND m.floor = $${params.length}`;
        }
        if (zoneId) {
            params.push(zoneId);
            meterFilter += ` AND m.zone_id = $${params.length}`;
        }

        const metersResult = await query(
            `WITH latest AS (
                SELECT DISTINCT ON (d.meter_id)
                    d.meter_id, d.date_keep, d.energy_kwh, d.energy_kva, d.energy_kw, d.energy_kvar,
                    d.energy_frequency, d.energy_volt_p1, d.energy_volt_p2, d.energy_volt_p3,
                    d.energy_volt_l1, d.energy_volt_l2, d.energy_volt_l3,
                    d.energy_amp1, d.energy_amp2, d.energy_amp3,
                    d.energy_pf1, d.energy_pf2, d.energy_pf3, d.status
                FROM actual_meter_data d
                ORDER BY d.meter_id, d.date_keep DESC, COALESCE(d.id, 0) DESC
            ),
            latest_realtime AS (
                SELECT DISTINCT ON (COALESCE(rmm.meter_id, mapped_meter.meter_id))
                    COALESCE(rmm.meter_id, mapped_meter.meter_id) AS meter_id,
                    r.channel, r.site_id AS realtime_site_id, r.address_id AS realtime_address_id,
                    r.device_datetime, r.received_at, r.import_kwhr,
                    r.kva1, r.kva2, r.kva3, r.kva_3ph,
                    r.kw1, r.kw2, r.kw3, r.kw_3ph,
                    r.kvar1, r.kvar2, r.kvar3, r.kvar_3ph, r.hz,
                    r.vl1, r.vl2, r.vl3, r.vl12, r.vl23, r.vl31,
                    r.il1, r.il2, r.il3, r.pf1, r.pf2, r.pf3
                FROM meter_data_realtime r
                LEFT JOIN realtime_meter_map rmm
                  ON rmm.realtime_site_id = r.site_id
                 AND rmm.realtime_address_id = r.address_id
                 AND rmm.is_active = true
                 AND (rmm.channel IS NULL OR rmm.channel = r.channel)
                LEFT JOIN meter mapped_meter
                  ON mapped_meter.site_el = r.site_id
                 AND mapped_meter.address::text = r.address_id::text
                 AND rmm.id IS NULL
                WHERE COALESCE(rmm.meter_id, mapped_meter.meter_id) IS NOT NULL
                ORDER BY COALESCE(rmm.meter_id, mapped_meter.meter_id), r.received_at DESC, r.id DESC
            ),
            day_start AS (
                SELECT DISTINCT ON (d.meter_id)
                    d.meter_id, d.energy_kwh AS period_start_kwh
                FROM actual_meter_data d
                WHERE (d.date_keep AT TIME ZONE 'Asia/Bangkok')::date = (NOW() AT TIME ZONE 'Asia/Bangkok')::date
                ORDER BY d.meter_id, d.date_keep ASC, COALESCE(d.id, 0) ASC
            ),
            day_counts AS (
                SELECT d.meter_id, COUNT(*)::int AS reading_count
                FROM actual_meter_data d
                WHERE (d.date_keep AT TIME ZONE 'Asia/Bangkok')::date = (NOW() AT TIME ZONE 'Asia/Bangkok')::date
                GROUP BY d.meter_id
            )
            SELECT
                m.meter_id, m.meter_code, m.meter_name, m.room_code, m.room_name, m.address,
                m.site_id, m.building_id, m.zone_id, m.loop_id, m.floor, m.status AS meter_status,
                s.site_name, b.building_name, z.zone_name,
                latest_realtime.received_at AS date_keep,
                COALESCE(latest_realtime.device_datetime, latest_realtime.received_at) AS device_datetime,
                latest_realtime.channel AS realtime_channel,
                latest_realtime.realtime_site_id,
                latest_realtime.realtime_address_id,
                CASE WHEN latest_realtime.meter_id IS NULL THEN 'none' ELSE 'realtime' END AS data_source,
                COALESCE(latest_realtime.import_kwhr, 0) AS energy_kwh,
                COALESCE(latest_realtime.kva_3ph, 0) AS energy_kva,
                COALESCE(latest_realtime.kw_3ph, 0) AS energy_kw,
                COALESCE(latest_realtime.kvar_3ph, 0) AS energy_kvar,
                COALESCE(latest_realtime.hz, 0) AS energy_frequency,
                COALESCE(latest_realtime.vl1, 0) AS energy_volt_p1,
                COALESCE(latest_realtime.vl2, 0) AS energy_volt_p2,
                COALESCE(latest_realtime.vl3, 0) AS energy_volt_p3,
                COALESCE(latest_realtime.vl12, 0) AS energy_volt_l1,
                COALESCE(latest_realtime.vl23, 0) AS energy_volt_l2,
                COALESCE(latest_realtime.vl31, 0) AS energy_volt_l3,
                COALESCE(latest_realtime.il1, 0) AS energy_amp1,
                COALESCE(latest_realtime.il2, 0) AS energy_amp2,
                COALESCE(latest_realtime.il3, 0) AS energy_amp3,
                COALESCE(latest_realtime.pf1, 0) AS energy_pf1,
                COALESCE(latest_realtime.pf2, 0) AS energy_pf2,
                COALESCE(latest_realtime.pf3, 0) AS energy_pf3,
                COALESCE(latest_realtime.kw1, 0) AS kw1,
                COALESCE(latest_realtime.kw2, 0) AS kw2,
                COALESCE(latest_realtime.kw3, 0) AS kw3,
                COALESCE(latest_realtime.kva1, 0) AS kva1,
                COALESCE(latest_realtime.kva2, 0) AS kva2,
                COALESCE(latest_realtime.kva3, 0) AS kva3,
                COALESCE(latest_realtime.kvar1, 0) AS kvar1,
                COALESCE(latest_realtime.kvar2, 0) AS kvar2,
                COALESCE(latest_realtime.kvar3, 0) AS kvar3,
                latest.status AS data_status,
                0 AS period_start_kwh
            FROM meter m
            LEFT JOIN sites s ON m.site_id = s.site_id
            LEFT JOIN buildings b ON m.building_id = b.building_id
            LEFT JOIN zones z ON m.zone_id = z.zone_id
            LEFT JOIN latest ON latest.meter_id = m.meter_id
            LEFT JOIN latest_realtime ON latest_realtime.meter_id = m.meter_id
            LEFT JOIN day_start ON day_start.meter_id = m.meter_id
            LEFT JOIN day_counts ON day_counts.meter_id = m.meter_id
            ${meterFilter}
            ORDER BY s.site_name, b.building_name, COALESCE(m.floor, 0), z.zone_name, m.meter_code`,
            params
        );

        // Build trend filter params: $1 = interval, then optional siteId, buildingId, floor, zoneId
        const trendParams: any[] = [aggregationConfig.intervalMinutes];
        const trendFilters: string[] = [];
        if (siteId) {
            trendParams.push(siteId);
            trendFilters.push(`m.site_id = $${trendParams.length}`);
        }
        if (buildingId) {
            trendParams.push(buildingId);
            trendFilters.push(`m.building_id = $${trendParams.length}`);
        }
        if (floor !== null) {
            trendParams.push(floor);
            trendFilters.push(`m.floor = $${trendParams.length}`);
        }
        if (zoneId) {
            trendParams.push(zoneId);
            trendFilters.push(`m.zone_id = $${trendParams.length}`);
        }
        const trendSiteFilter = trendFilters.length > 0 ? 'AND ' + trendFilters.join(' AND ') : '';
        const bucketExpr = (source: string) => `
            date_trunc('hour', ${source})
              + (floor(extract(minute from ${source}) / $1::int) * $1::int) * interval '1 minute'
        `;
        const realtimeBucketExpr = bucketExpr('r.received_at');

        const trendResult = await query(
            `WITH realtime_per_meter AS (
                SELECT
                    ${realtimeBucketExpr} AS date_keep,
                    m.meter_id,
                    SUM(COALESCE(r.kw_3ph, 0)) AS kw,
                    MAX(COALESCE(r.import_kwhr, 0)) AS kwh,
                    COUNT(*)::int AS readings
                FROM meter_data_realtime r
                LEFT JOIN realtime_meter_map rmm
                  ON rmm.realtime_site_id = r.site_id
                 AND rmm.realtime_address_id = r.address_id
                 AND rmm.is_active = true
                 AND (rmm.channel IS NULL OR rmm.channel = r.channel)
                LEFT JOIN meter mapped_meter
                  ON mapped_meter.site_el = r.site_id
                 AND mapped_meter.address::text = r.address_id::text
                 AND rmm.id IS NULL
                JOIN meter m ON m.meter_id = COALESCE(rmm.meter_id, mapped_meter.meter_id)
                WHERE r.received_at >= NOW() - INTERVAL '24 hours'
                  AND m.is_active IS DISTINCT FROM false
                  ${trendSiteFilter}
                GROUP BY ${realtimeBucketExpr}, m.meter_id
            ),
            realtime_scoped AS (
                SELECT
                    date_keep,
                    SUM(kw) AS kw,
                    SUM(kwh) AS kwh,
                    SUM(readings) AS readings
                FROM realtime_per_meter
                GROUP BY date_keep
            )
            SELECT date_keep AS t, kw, kwh, readings
            FROM realtime_scoped
            ORDER BY t`,
            trendParams
        );

        // Build comparison params
        const compParams: any[] = [];
        if (siteId) compParams.push(siteId);
        if (buildingId) compParams.push(buildingId);
        if (floor !== null) compParams.push(floor);
        if (zoneId) compParams.push(zoneId);
        const compSiteFilter = siteId ? `AND m.site_id = $${compParams.indexOf(siteId) + 1}` : '';
        const compBuildingFilter = buildingId ? `AND m.building_id = $${compParams.indexOf(buildingId) + 1}` : '';
        const compFloorFilter = floor !== null ? `AND m.floor = $${compParams.indexOf(floor) + 1}` : '';
        const compZoneFilter = zoneId ? `AND m.zone_id = $${compParams.indexOf(zoneId) + 1}` : '';

        const comparisonResult = await query(
            `WITH realtime_meter_ids AS (
                SELECT DISTINCT COALESCE(rmm.meter_id, mapped_meter.meter_id) AS meter_id
                FROM meter_data_realtime r
                LEFT JOIN realtime_meter_map rmm
                  ON rmm.realtime_site_id = r.site_id
                 AND rmm.realtime_address_id = r.address_id
                 AND rmm.is_active = true
                 AND (rmm.channel IS NULL OR rmm.channel = r.channel)
                LEFT JOIN meter mapped_meter
                  ON mapped_meter.site_el = r.site_id
                 AND mapped_meter.address::text = r.address_id::text
                 AND rmm.id IS NULL
                WHERE COALESCE(rmm.meter_id, mapped_meter.meter_id) IS NOT NULL
            ),
            meter_scope AS (
                SELECT m.meter_id, m.site_id, m.building_id, s.site_name, b.building_name
                FROM meter m
                JOIN realtime_meter_ids rmi ON rmi.meter_id = m.meter_id
                LEFT JOIN sites s ON m.site_id = s.site_id
                LEFT JOIN buildings b ON m.building_id = b.building_id
                WHERE m.is_active IS DISTINCT FROM false
                  ${compSiteFilter}
                  ${compBuildingFilter}
                  ${compFloorFilter}
                  ${compZoneFilter}
            ),
            hourly_meter AS (
                SELECT
                    bucket,
                    meter_id,
                    GREATEST(latest_kwh - COALESCE(prev_latest_kwh, first_kwh, 0), 0) AS kwh
                FROM (
                    SELECT
                        date_trunc('hour', d.date_keep) AS bucket,
                        d.meter_id,
                        MIN(d.energy_kwh) AS first_kwh,
                        MAX(d.energy_kwh) AS latest_kwh,
                        LAG(MAX(d.energy_kwh)) OVER (
                            PARTITION BY d.meter_id
                            ORDER BY date_trunc('hour', d.date_keep)
                        ) AS prev_latest_kwh
                    FROM actual_meter_data d
                    JOIN meter_scope ms ON ms.meter_id = d.meter_id
                    WHERE d.date_keep >= NOW() - INTERVAL '48 hours'
                    GROUP BY date_trunc('hour', d.date_keep), d.meter_id
                ) hourly_ranked
                WHERE bucket >= NOW() - INTERVAL '24 hours'
            ),
            hourly AS (
                SELECT
                    'day' AS gran,
                    hm.bucket,
                    ms.site_id, ms.site_name, ms.building_id, ms.building_name,
                    SUM(hm.kwh) AS kwh
                FROM hourly_meter hm
                JOIN meter_scope ms ON ms.meter_id = hm.meter_id
                GROUP BY hm.bucket, ms.site_id, ms.site_name, ms.building_id, ms.building_name
            ),
            daily_source AS (
                SELECT
                    dd.meter_id, dd.date_keep, dd.total_kwh,
                    LAG(dd.total_kwh) OVER (PARTITION BY dd.meter_id ORDER BY dd.date_keep) AS prev_total_kwh
                FROM actual_meter_data_daily dd
                JOIN meter_scope ms ON ms.meter_id = dd.meter_id
                WHERE dd.date_keep >= CURRENT_DATE - INTERVAL '35 days'
            ),
            daily_consumption AS (
                SELECT
                    ds.date_keep::timestamp AS bucket,
                    ms.site_id, ms.site_name, ms.building_id, ms.building_name,
                    GREATEST(SUM(ds.total_kwh - COALESCE(ds.prev_total_kwh, 0)), 0) AS kwh
                FROM daily_source ds
                JOIN meter_scope ms ON ms.meter_id = ds.meter_id
                GROUP BY ds.date_keep, ms.site_id, ms.site_name, ms.building_id, ms.building_name
            ),
            daily AS (
                SELECT
                    'month' AS gran, bucket, site_id, site_name, building_id, building_name, kwh
                FROM daily_consumption
                WHERE bucket >= CURRENT_DATE - INTERVAL '30 days'
                UNION ALL
                SELECT
                    'week' AS gran, bucket, site_id, site_name, building_id, building_name, kwh
                FROM daily_consumption
                WHERE bucket >= CURRENT_DATE - INTERVAL '7 days'
            ),
            monthly_source AS (
                SELECT
                    dm.meter_id, to_date(dm.year_month || '-01', 'YYYY-MM-DD') AS month_start, dm.total_kwh,
                    LAG(dm.total_kwh) OVER (PARTITION BY dm.meter_id ORDER BY dm.year_month) AS prev_total_kwh
                FROM actual_meter_data_monthly dm
                JOIN meter_scope ms ON ms.meter_id = dm.meter_id
                WHERE dm.year_month >= to_char(CURRENT_DATE - INTERVAL '12 months', 'YYYY-MM')
            ),
            monthly AS (
                SELECT
                    'year' AS gran,
                    msr.month_start::timestamp AS bucket,
                    ms.site_id, ms.site_name, ms.building_id, ms.building_name,
                    GREATEST(SUM(msr.total_kwh - COALESCE(msr.prev_total_kwh, 0)), 0) AS kwh
                FROM monthly_source msr
                JOIN meter_scope ms ON ms.meter_id = msr.meter_id
                GROUP BY msr.month_start, ms.site_id, ms.site_name, ms.building_id, ms.building_name
            ),
            unioned AS (
                SELECT * FROM hourly
                UNION ALL
                SELECT * FROM daily
                UNION ALL
                SELECT * FROM monthly
            )
            SELECT gran, bucket, 'site' AS entity_type, site_id AS entity_id, site_name AS entity_name, SUM(kwh) AS kwh
            FROM unioned
            WHERE site_id IS NOT NULL
            GROUP BY gran, bucket, site_id, site_name
            UNION ALL
            SELECT gran, bucket, 'building' AS entity_type, building_id AS entity_id, building_name AS entity_name, SUM(kwh) AS kwh
            FROM unioned
            WHERE building_id IS NOT NULL
            GROUP BY gran, bucket, building_id, building_name
            ORDER BY gran, bucket, entity_type, entity_name`,
            compParams
        );


        const tree = this.buildZoneTree(metersResult.rows);
        const meters = metersResult.rows.map((row: any) => this.mapZoneMeter(row));
        return {
            tree,
            meters,
            trend: trendResult.rows.map((row: any) => ({
                t: new Date(row.t).getTime(),
                kw: toNumber(row.kw),
                kwh: toNumber(row.kwh),
                readings: toNumber(row.readings),
            })),
            comparison: comparisonResult.rows.map((row: any) => ({
                gran: row.gran,
                bucket: row.bucket,
                entityType: row.entity_type,
                entityId: row.entity_id,
                entityName: row.entity_name || `${row.entity_type} ${row.entity_id}`,
                kwh: toNumber(row.kwh),
            })),
        };
    }

    private buildZoneTree(rows: any[]) {
        const sites = new Map<string, any>();
        const ensureChild = (children: any[], id: string, name: string, level: string) => {
            let child = children.find((item) => item.id === id);
            if (!child) {
                child = { id, name, level, children: [] };
                children.push(child);
            }
            return child;
        };

        rows.forEach((row) => {
            const siteId = `site-${row.site_id || 'unknown'}`;
            const buildingId = `building-${row.building_id || 'unknown'}`;
            const floorValue = row.floor ?? 1;
            const floorId = `floor-${row.building_id || 'unknown'}-${floorValue}`;
            const zoneId = `zone-${row.zone_id || 'unknown'}-${floorValue}`;
            const meterId = `meter-${row.meter_id}`;

            if (!sites.has(siteId)) {
                sites.set(siteId, { id: siteId, name: row.site_name || 'Unknown Site', level: 'branch', children: [] });
            }
            const site = sites.get(siteId);
            const building = ensureChild(site.children, buildingId, row.building_name || 'Unknown Building', 'building');
            const floor = ensureChild(building.children, floorId, `ชั้น ${floorValue}`, 'floor');
            const zone = ensureChild(floor.children, zoneId, row.zone_name || 'No Zone', 'zone');
            zone.children.push({
                id: meterId,
                name: row.room_code || row.meter_code || `M${row.meter_id}`,
                level: 'room',
            });
        });

        return Array.from(sites.values());
    }

    private mapZoneMeter(row: any) {
        const floorValue = row.floor ?? 1;
        const isActive = row.meter_status !== 'Inactive' && row.meter_status !== 'Disabled';
        return {
            id: `meter-${row.meter_id}`,
            code: row.room_code || row.meter_code || `M${row.meter_id}`,
            channel: row.realtime_channel || row.meter_code || '',
            site_id: row.site_id,
            address_id: row.realtime_address_id || row.address || row.meter_id,
            source_site_id: row.realtime_site_id || row.site_id,
            device: row.meter_name || row.meter_code || `Meter ${row.meter_id}`,
            type: '3P4W',
            loop: row.loop_id || 1,
            pathIds: [
                `site-${row.site_id || 'unknown'}`,
                `building-${row.building_id || 'unknown'}`,
                `floor-${row.building_id || 'unknown'}-${floorValue}`,
                `zone-${row.zone_id || 'unknown'}-${floorValue}`,
            ],
            pathNames: [
                row.site_name || 'Unknown Site',
                row.building_name || 'Unknown Building',
                `ชั้น ${floorValue}`,
                row.zone_name || 'No Zone',
            ],
            threshold: 0,
            disabled: !isActive,
            inputMode: isActive ? 'auto' : 'disabled',
            periodStart_kwhr: toNumber(row.period_start_kwh),
            import_kwhr: toNumber(row.energy_kwh),
            data_source: row.data_source || 'actual',
            _pf: 1,
            _v: 0,
            kw_3ph: toNumber(row.energy_kw),
            kw1: toNumber(row.kw1),
            kw2: toNumber(row.kw2),
            kw3: toNumber(row.kw3),
            pf1: toNumber(row.energy_pf1, 1),
            pf2: toNumber(row.energy_pf2, 1),
            pf3: toNumber(row.energy_pf3, 1),
            kva_3ph: toNumber(row.energy_kva),
            kvar_3ph: toNumber(row.energy_kvar),
            kva1: toNumber(row.kva1),
            kva2: toNumber(row.kva2),
            kva3: toNumber(row.kva3),
            kvar1: toNumber(row.kvar1),
            kvar2: toNumber(row.kvar2),
            kvar3: toNumber(row.kvar3),
            vl1: toNumber(row.energy_volt_p1),
            vl2: toNumber(row.energy_volt_p2),
            vl3: toNumber(row.energy_volt_p3),
            vl12: toNumber(row.energy_volt_l1),
            vl23: toNumber(row.energy_volt_l2),
            vl31: toNumber(row.energy_volt_l3),
            il1: toNumber(row.energy_amp1),
            il2: toNumber(row.energy_amp2),
            il3: toNumber(row.energy_amp3),
            hz: toNumber(row.energy_frequency),
            received_at: row.date_keep ? new Date(row.date_keep).getTime() : 0,
            device_datetime: row.device_datetime ? new Date(row.device_datetime).getTime() : (row.date_keep ? new Date(row.date_keep).getTime() : 0),
        };
    }

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
