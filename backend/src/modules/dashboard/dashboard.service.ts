import { query } from '../../config/database';
import { aggregationConfig } from '../../config/aggregation';
import { parsePagination } from '../../utils/pagination';

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

        // MDB scope: มิเตอร์ที่เป็นชนิด "MDB" ระบุจาก meter_type ชื่อ MDB (case-insensitive)
        //   mdb=only    → เอาเฉพาะมิเตอร์ MDB (หน้า /dashboard/mdb)
        //   mdb=exclude → ตัดมิเตอร์ MDB ออก (หน้า /dashboard/zone)
        const mdbScope = String(queryParams.mdb || '').toLowerCase();
        const MDB_MATCH = `EXISTS (SELECT 1 FROM meter_type mt WHERE mt.meter_type_id = m.meter_type_id AND mt.meter_type_name ILIKE '%MDB%')`;
        const mdbSql = mdbScope === 'only'
            ? ` AND ${MDB_MATCH}`
            : mdbScope === 'exclude'
                ? ` AND NOT ${MDB_MATCH}`
                : '';

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
        meterFilter += mdbSql;

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
                m.site_id, m.building_id, m.zone_id, m.loop_id, m.floor, m.status AS meter_status, m.meter_type_id,
                s.site_name, b.building_name, z.zone_name,
                COALESCE(latest_realtime.received_at, latest.date_keep) AS date_keep,
                COALESCE(latest_realtime.device_datetime, latest_realtime.received_at, latest.date_keep) AS device_datetime,
                latest_realtime.channel AS realtime_channel,
                latest_realtime.realtime_site_id,
                latest_realtime.realtime_address_id,
                CASE WHEN latest_realtime.meter_id IS NOT NULL THEN 'realtime' WHEN latest.meter_id IS NOT NULL THEN 'actual' ELSE 'none' END AS data_source,
                COALESCE(latest_realtime.import_kwhr, latest.energy_kwh, 0) AS energy_kwh,
                COALESCE(latest_realtime.kva_3ph, latest.energy_kva, 0) AS energy_kva,
                COALESCE(latest_realtime.kw_3ph, latest.energy_kw, 0) AS energy_kw,
                COALESCE(latest_realtime.kvar_3ph, latest.energy_kvar, 0) AS energy_kvar,
                COALESCE(latest_realtime.hz, latest.energy_frequency, 0) AS energy_frequency,
                COALESCE(latest_realtime.vl1, latest.energy_volt_p1, 0) AS energy_volt_p1,
                COALESCE(latest_realtime.vl2, latest.energy_volt_p2, 0) AS energy_volt_p2,
                COALESCE(latest_realtime.vl3, latest.energy_volt_p3, 0) AS energy_volt_p3,
                COALESCE(latest_realtime.vl12, latest.energy_volt_l1, 0) AS energy_volt_l1,
                COALESCE(latest_realtime.vl23, latest.energy_volt_l2, 0) AS energy_volt_l2,
                COALESCE(latest_realtime.vl31, latest.energy_volt_l3, 0) AS energy_volt_l3,
                COALESCE(latest_realtime.il1, latest.energy_amp1, 0) AS energy_amp1,
                COALESCE(latest_realtime.il2, latest.energy_amp2, 0) AS energy_amp2,
                COALESCE(latest_realtime.il3, latest.energy_amp3, 0) AS energy_amp3,
                COALESCE(latest_realtime.pf1, latest.energy_pf1, 0) AS energy_pf1,
                COALESCE(latest_realtime.pf2, latest.energy_pf2, 0) AS energy_pf2,
                COALESCE(latest_realtime.pf3, latest.energy_pf3, 0) AS energy_pf3,
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
                0 AS period_start_kwh,
                latest_realtime.received_at AS realtime_received_at
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
        const trendSiteFilter = (trendFilters.length > 0 ? 'AND ' + trendFilters.join(' AND ') : '') + mdbSql;
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

        const comparisonResult = await query(
            `WITH meter_scope AS (
                SELECT m.meter_id, m.site_id, m.building_id, s.site_name, b.building_name
                FROM meter m
                LEFT JOIN sites s ON m.site_id = s.site_id
                LEFT JOIN buildings b ON m.building_id = b.building_id
                WHERE m.is_active IS DISTINCT FROM false
                  ${mdbSql}
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
                    to_char(hm.bucket, 'YYYY-MM-DD"T"HH24:MI:SS') AS bucket,
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
                WHERE dd.date_keep >= CURRENT_DATE - INTERVAL '36 months'
            ),
            daily_diff AS (
                SELECT
                    meter_id, date_keep,
                    CASE
                        WHEN prev_total_kwh IS NULL THEN 0
                        WHEN total_kwh >= prev_total_kwh THEN total_kwh - prev_total_kwh
                        ELSE total_kwh
                    END AS kwh
                FROM daily_source
            ),
            daily AS (
                SELECT
                    'week' AS gran,
                    to_char(d.date_keep, 'YYYY-MM-DD') AS bucket,
                    ms.site_id, ms.site_name, ms.building_id, ms.building_name,
                    SUM(d.kwh) AS kwh
                FROM daily_diff d
                JOIN meter_scope ms ON ms.meter_id = d.meter_id
                WHERE d.date_keep >= CURRENT_DATE - INTERVAL '7 days'
                GROUP BY d.date_keep, ms.site_id, ms.site_name, ms.building_id, ms.building_name
            ),
            monthly AS (
                SELECT
                    'year' AS gran,
                    to_char(date_trunc('month', d.date_keep), 'YYYY-MM-01') AS bucket,
                    ms.site_id, ms.site_name, ms.building_id, ms.building_name,
                    SUM(d.kwh) AS kwh
                FROM daily_diff d
                JOIN meter_scope ms ON ms.meter_id = d.meter_id
                GROUP BY date_trunc('month', d.date_keep), ms.site_id, ms.site_name, ms.building_id, ms.building_name
            ),
            yearly AS (
                SELECT
                    'yearly' AS gran,
                    to_char(date_trunc('year', bucket::date), 'YYYY-01-01') AS bucket,
                    site_id, site_name, building_id, building_name,
                    SUM(kwh) AS kwh
                FROM monthly
                GROUP BY date_trunc('year', bucket::date), site_id, site_name, building_id, building_name
            ),
            unioned AS (
                SELECT * FROM hourly
                UNION ALL
                SELECT * FROM daily
                UNION ALL
                SELECT * FROM monthly
                UNION ALL
                SELECT * FROM yearly
            )
            SELECT gran, bucket, 'site' AS entity_type, site_id AS entity_id, site_name AS entity_name, SUM(kwh) AS kwh
            FROM unioned
            WHERE site_id IS NOT NULL
            GROUP BY gran, bucket, site_id, site_name
            UNION ALL
            SELECT gran, bucket, 'building' AS entity_type, building_id AS entity_id,
                   COALESCE(site_name, '') || '·' || building_name AS entity_name, SUM(kwh) AS kwh
            FROM unioned
            WHERE building_id IS NOT NULL
            GROUP BY gran, bucket, building_id, site_name, building_name
            ORDER BY gran, bucket, entity_type, entity_name`
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
            meter_type_id: row.meter_type_id ? parseInt(row.meter_type_id, 10) : 1,
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
            received_at: row.realtime_received_at ? new Date(row.realtime_received_at).getTime() : (row.date_keep ? new Date(row.date_keep).getTime() : 0),
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
        const { siteId, buildingId, zoneId, meterId, startDate, endDate } = queryParams;
        const params: any[] = [];
        const filters: string[] = [
            'm.is_active = true',
            's.site_status = true',
            'b.is_active = true',
            'mt.is_active = true',
        ];

        if (siteId) { params.push(parseInt(siteId)); filters.push(`m.site_id = $${params.length}`); }
        if (buildingId) { params.push(parseInt(buildingId)); filters.push(`m.building_id = $${params.length}`); }
        if (zoneId) { params.push(parseInt(zoneId)); filters.push(`m.zone_id = $${params.length}`); }
        if (meterId) { params.push(parseInt(meterId)); filters.push(`m.meter_id = $${params.length}`); }
        if (startDate) { params.push(startDate); filters.push(`r.received_at >= ($${params.length}::date::timestamp AT TIME ZONE 'Asia/Bangkok')`); }
        else filters.push(`r.received_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok'`);
        if (endDate) { params.push(endDate); filters.push(`r.received_at < (($${params.length}::date + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')`); }

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
            ),
            scoped AS (
                SELECT r.*, m.meter_id, m.site_id AS meter_site_id, s.site_name,
                    date_trunc('hour', r.received_at)
                      + floor(extract(minute from r.received_at) / 15) * interval '15 minutes' AS bucket,
                    ROW_NUMBER() OVER (
                        PARTITION BY m.meter_id,
                            date_trunc('hour', r.received_at) + floor(extract(minute from r.received_at) / 15) * interval '15 minutes'
                        ORDER BY r.received_at DESC, r.id DESC
                    ) AS bucket_rank,
                    ROW_NUMBER() OVER (PARTITION BY m.meter_id ORDER BY r.received_at DESC, r.id DESC) AS latest_rank
                FROM mapped r
                JOIN meter m ON m.meter_id = r.mapped_meter_id
                LEFT JOIN sites s ON s.site_id = m.site_id
                WHERE ${filters.join(' AND ')}
            ),
            history AS (
                SELECT bucket AS time, SUM(COALESCE(kw_3ph, 0)) AS demand
                FROM scoped WHERE bucket_rank = 1
                GROUP BY bucket
            ),
            current_value AS (
                SELECT SUM(COALESCE(kw_3ph, 0)) AS demand,
                       MAX(received_at) AS last_received_at,
                       COUNT(*)::int AS meter_count
                FROM scoped WHERE latest_rank = 1
            ),
            selected_sites AS (
                SELECT DISTINCT meter_site_id AS site_id, site_name FROM scoped
            ),
            latest_configs AS (
                SELECT DISTINCT ON (display_name) display_name, warning_setpoint, peak_setpoint
                FROM demand_peak_config
                WHERE is_active = true
                ORDER BY display_name, config_id DESC
            ),
            thresholds AS (
                SELECT
                    COALESCE(SUM(lc.warning_setpoint), 0) AS warning_level,
                    COALESCE(SUM(lc.peak_setpoint), 0) AS setpoint
                FROM selected_sites ss
                LEFT JOIN LATERAL (
                    SELECT warning_setpoint, peak_setpoint
                    FROM latest_configs lc
                    WHERE ss.site_name ILIKE '%' || split_part(lc.display_name, ' ', 1) || '%'
                    ORDER BY length(lc.display_name) DESC
                    LIMIT 1
                ) lc ON true
            )
            SELECT
                COALESCE(cv.demand, 0) AS current_demand,
                COALESCE((SELECT MAX(demand) FROM history), 0) AS peak_demand,
                COALESCE((SELECT AVG(demand) FROM history), 0) AS average_demand,
                th.setpoint, th.warning_level,
                cv.last_received_at, COALESCE(cv.meter_count, 0) AS meter_count,
                COALESCE((SELECT json_agg(json_build_object('time', time, 'demand', demand) ORDER BY time) FROM history), '[]') AS history
            FROM current_value cv CROSS JOIN thresholds th`,
            params
        );
        return result.rows[0] || {
            current_demand: 0, peak_demand: 0, average_demand: 0,
            setpoint: 0, warning_level: 0, meter_count: 0, history: [],
        };
    }

    async getConsumptionTable(queryParams: any) {
        const { page, limit, offset } = parsePagination(queryParams);
        const { siteId, buildingId, zoneId, meterTypeId, meterId, startDate, endDate, searchMeter } = queryParams;
        const params: any[] = [];
        const filters: string[] = ['m.is_active IS DISTINCT FROM false'];

        if (siteId) { params.push(parseInt(siteId)); filters.push(`m.site_id = $${params.length}`); }
        if (buildingId) { params.push(parseInt(buildingId)); filters.push(`m.building_id = $${params.length}`); }
        if (zoneId) { params.push(parseInt(zoneId)); filters.push(`m.zone_id = $${params.length}`); }
        if (meterTypeId) { params.push(parseInt(meterTypeId)); filters.push(`m.meter_type_id = $${params.length}`); }
        if (meterId) { params.push(parseInt(meterId)); filters.push(`m.meter_id = $${params.length}`); }
        if (startDate) {
            params.push(startDate);
            filters.push(`r.received_at >= ($${params.length}::date::timestamp AT TIME ZONE 'Asia/Bangkok')`);
        } else {
            // ค่าเริ่มต้น: ต้นวันนี้ (กันการสแกนข้อมูลทั้งชุดถ้าไม่ได้ส่งช่วงวันมา)
            filters.push(`r.received_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok'`);
        }
        if (endDate) {
            params.push(endDate);
            filters.push(`r.received_at < (($${params.length}::date + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')`);
        }
        if (searchMeter) {
            params.push(`%${String(searchMeter).trim()}%`);
            filters.push(`(m.meter_code ILIKE $${params.length} OR m.meter_name ILIKE $${params.length})`);
        }

        const mappedReadings = `
            SELECT
                r.import_kwhr, r.received_at,
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
        `;

        // สรุปการใช้ไฟ "รายวันต่อมิเตอร์" ในช่วงที่เลือก (เหมือนระบบเดิม)
        //  - kwh        = ค่ามิเตอร์สะสมล่าสุดของวันนั้น (import_kwhr เพิ่มขึ้นเรื่อยๆ → MAX = ค่าปลายวัน)
        //  - consumption = ค่าปลายวันนี้ − ค่าปลายวันก่อนหน้า (วันแรกในช่วง = 0)
        const dataParams = [...params, limit, offset];
        const result = await query(
            `WITH mapped_readings AS (${mappedReadings}),
            scoped AS (
                SELECT
                    r.import_kwhr, r.received_at,
                    m.meter_id, m.meter_code, m.meter_name, m.room_name,
                    b.building_name, z.zone_name,
                    (r.received_at AT TIME ZONE 'Asia/Bangkok')::date AS day
                FROM mapped_readings r
                JOIN meter m ON m.meter_id = r.mapped_meter_id
                LEFT JOIN buildings b ON b.building_id = m.building_id
                LEFT JOIN zones z ON z.zone_id = m.zone_id
                WHERE ${filters.join(' AND ')}
            ),
            daily AS (
                SELECT
                    meter_id, meter_code, meter_name, room_name, building_name, zone_name, day,
                    MAX(import_kwhr) AS kwh,
                    MAX(received_at) AS received_at
                FROM scoped
                GROUP BY meter_id, meter_code, meter_name, room_name, building_name, zone_name, day
            ),
            daily_delta AS (
                SELECT d.*,
                    LAG(kwh) OVER (PARTITION BY meter_id ORDER BY day) AS prev_kwh
                FROM daily d
            )
            SELECT
                meter_id, meter_code, meter_name, building_name, zone_name, room_name,
                to_char(day, 'YYYY-MM-DD') AS date, received_at,
                kwh,
                GREATEST(kwh - COALESCE(prev_kwh, kwh), 0) AS consumption,
                COUNT(*) OVER() AS total_count
            FROM daily_delta
            ORDER BY meter_code, day
            LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
            dataParams
        );

        const total = result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
        const data = result.rows.map(({ total_count, ...rest }: any) => rest);
        return { data, total, page, limit };
    }

    async getConsumptionMeters(queryParams: any) {
        const { siteId, buildingId, zoneId, meterTypeId, startDate, endDate } = queryParams;
        const params: any[] = [];
        const filters: string[] = ['m.is_active IS DISTINCT FROM false'];

        if (siteId) { params.push(parseInt(siteId)); filters.push(`m.site_id = $${params.length}`); }
        if (buildingId) { params.push(parseInt(buildingId)); filters.push(`m.building_id = $${params.length}`); }
        if (zoneId) { params.push(parseInt(zoneId)); filters.push(`m.zone_id = $${params.length}`); }
        if (meterTypeId) { params.push(parseInt(meterTypeId)); filters.push(`m.meter_type_id = $${params.length}`); }
        if (startDate) { params.push(startDate); filters.push(`r.received_at >= ($${params.length}::date::timestamp AT TIME ZONE 'Asia/Bangkok')`); }
        if (endDate) { params.push(endDate); filters.push(`r.received_at < (($${params.length}::date + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')`); }

        const result = await query(
            `SELECT DISTINCT m.meter_id, m.meter_code, m.meter_name,
                    m.site_id, m.building_id, m.zone_id, m.meter_type_id
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
             JOIN meter m ON m.meter_id = COALESCE(rmm.meter_id, fallback_meter.meter_id)
             JOIN sites s ON s.site_id = m.site_id
             JOIN buildings b ON b.building_id = m.building_id
             JOIN meter_type mt ON mt.meter_type_id = m.meter_type_id
             WHERE ${filters.join(' AND ')}
             ORDER BY m.meter_code, m.meter_name`,
            params
        );
        return result.rows;
    }
}
