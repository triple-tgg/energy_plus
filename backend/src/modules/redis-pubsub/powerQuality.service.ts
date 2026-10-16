import pool from '../../config/database';

/**
 * Power-quality reads for the Harmonic dashboard.
 * Sources are identified by the publisher's (site_id, address_id); meter metadata is attached when a meter
 * maps to it (realtime_meter_map, meter.site_el = "{site}_{address}", or meter.site_el = site + meter.address).
 */

export interface SourceKey {
    siteId: number;
    addressId: number;
}

const METER_MATCH = (alias: string) => `
    LEFT JOIN LATERAL (
        SELECT m.meter_id, m.meter_code, m.meter_name, m.site_id AS meter_site_id, s.site_name
        FROM meter m
        LEFT JOIN sites s ON s.site_id = m.site_id
        LEFT JOIN realtime_meter_map rmm
               ON rmm.meter_id = m.meter_id AND rmm.is_active = true
        WHERE m.is_active IS DISTINCT FROM false
          AND (
                (rmm.realtime_site_id = ${alias}.site_id AND rmm.realtime_address_id = ${alias}.address_id)
             OR TRIM(m.site_el::text) = ${alias}.site_id::text || '_' || ${alias}.address_id::text
             OR (TRIM(m.site_el::text) = ${alias}.site_id::text AND TRIM(m.address::text) = ${alias}.address_id::text)
          )
        ORDER BY (rmm.id IS NOT NULL) DESC, m.meter_id
        LIMIT 1
    ) mm ON true`;

/** Devices that have harmonic, THD or max-demand data in the last `days` days. */
export const getPowerQualitySources = async (days = 7, filterSiteIds?: number[] | null): Promise<any[]> => {
    const params: any[] = [days];
    let siteFilter = 'WHERE (mm.meter_site_id IS NULL OR mm.meter_site_id != 26)';
    if (filterSiteIds !== undefined && filterSiteIds !== null) {
        const validSiteIds = filterSiteIds.filter(id => id !== 26);
        if (validSiteIds.length === 0) {
            return [];
        }
        params.push(validSiteIds);
        siteFilter = `WHERE mm.meter_site_id = ANY($${params.length}::int[]) AND mm.meter_site_id != 26`;
    }

    const result = await pool.query(
        `WITH src AS (
            SELECT site_id, address_id,
                   array_agg(DISTINCT datatype ORDER BY datatype) AS harmonic_types,
                   MAX(device_datetime) AS last_harmonics
            FROM meter_harmonics_realtime
            WHERE device_datetime >= NOW() - ($1 || ' days')::interval
            GROUP BY site_id, address_id
        ),
        thd AS (
            SELECT site_id, address_id, MAX(device_datetime) AS last_thd,
                   bool_or(datatype = 'PM3-THD-DEMAND') AS has_demand
            FROM meter_data_realtime
            WHERE thd_vl1 IS NOT NULL
              AND device_datetime >= NOW() - ($1 || ' days')::interval
            GROUP BY site_id, address_id
        ),
        keys AS (
            SELECT site_id, address_id FROM src
            UNION
            SELECT site_id, address_id FROM thd
        )
        SELECT k.site_id, k.address_id,
               k.site_id::text || '_' || k.address_id::text AS channel,
               COALESCE(src.harmonic_types, '{}') AS harmonic_types,
               src.last_harmonics, thd.last_thd,
               COALESCE(thd.has_demand, false) AS has_demand,
               GREATEST(src.last_harmonics, thd.last_thd) AS last_seen,
               mm.meter_id, mm.meter_code, mm.meter_name, mm.site_name, mm.meter_site_id
        FROM keys k
        LEFT JOIN src ON src.site_id = k.site_id AND src.address_id = k.address_id
        LEFT JOIN thd ON thd.site_id = k.site_id AND thd.address_id = k.address_id
        ${METER_MATCH('k')}
        ${siteFilter}
        ORDER BY k.site_id, k.address_id`,
        params
    );
    return result.rows;
};

const toNumbers = (arr: any[] | null): Array<number | null> =>
    (arr || []).map((v) => (v === null || v === undefined ? null : Number(v)));

const numOrNull = (v: any): number | null => (v === null || v === undefined ? null : Number(v));

/** Latest harmonic spectrum per datatype + latest THD / base values + latest max demand. */
export const getPowerQualityLatest = async ({ siteId, addressId }: SourceKey) => {
    const [harmonics, thd, demand] = await Promise.all([
        pool.query(
            `SELECT DISTINCT ON (datatype)
                    datatype, phase1, phase2, phase3, device, code, sample_count,
                    bucket_start, device_datetime, received_at
             FROM meter_harmonics_realtime
             WHERE site_id = $1 AND address_id = $2
             ORDER BY datatype, bucket_start DESC`,
            [siteId, addressId]
        ),
        pool.query(
            `SELECT datatype, device, code,
                    vl1, vl2, vl3, vl12, vl23, vl31, il1, il2, il3,
                    kw_3ph, kvar_3ph, kva_3ph, pf1, pf2, pf3, hz,
                    thd_vl1, thd_vl2, thd_vl3, thd_vl12, thd_vl23, thd_vl31, thd_il1, thd_il2, thd_il3,
                    device_datetime, received_at
             FROM meter_data_realtime
             WHERE site_id = $1 AND address_id = $2 AND thd_vl1 IS NOT NULL
             ORDER BY device_datetime DESC
             LIMIT 1`,
            [siteId, addressId]
        ),
        pool.query(
            `SELECT * FROM meter_max_demand_realtime
             WHERE site_id = $1 AND address_id = $2
             ORDER BY device_datetime DESC
             LIMIT 1`,
            [siteId, addressId]
        ),
    ]);

    const spectra: Record<string, any> = {};
    for (const row of harmonics.rows) {
        spectra[row.datatype] = {
            datatype: row.datatype,
            phases: [toNumbers(row.phase1), toNumbers(row.phase2), toNumbers(row.phase3)],
            device: row.device,
            code: row.code,
            sampleCount: row.sample_count,
            bucketStart: row.bucket_start,
            deviceDatetime: row.device_datetime,
            receivedAt: row.received_at,
        };
    }

    const t = thd.rows[0];
    const d = demand.rows[0];
    const pick = (row: any, cols: string[]) =>
        row ? Object.fromEntries(cols.map((c) => [c, numOrNull(row[c])])) : null;

    return {
        siteId,
        addressId,
        channel: `${siteId}_${addressId}`,
        spectra,
        thd: t
            ? {
                ...pick(t, ['thd_vl1', 'thd_vl2', 'thd_vl3', 'thd_vl12', 'thd_vl23', 'thd_vl31', 'thd_il1', 'thd_il2', 'thd_il3']),
                datatype: t.datatype,
                deviceDatetime: t.device_datetime,
            }
            : null,
        base: t
            ? {
                ...pick(t, ['vl1', 'vl2', 'vl3', 'vl12', 'vl23', 'vl31', 'il1', 'il2', 'il3', 'kw_3ph', 'kvar_3ph', 'kva_3ph', 'pf1', 'pf2', 'pf3', 'hz']),
                device: t.device,
                code: t.code,
                deviceDatetime: t.device_datetime,
            }
            : null,
        maxDemand: d
            ? {
                ...pick(d, [
                    'vl1', 'vl2', 'vl3', 'vl12', 'vl23', 'vl31', 'il1', 'il2', 'il3',
                    'kw1', 'kw2', 'kw3', 'kvar1', 'kvar2', 'kvar3', 'kva1', 'kva2', 'kva3',
                    'pf1', 'pf2', 'pf3', 'vln_3ph', 'vll_3ph', 'il_3ph', 'kw_3ph', 'kvar_3ph', 'kva_3ph',
                ]),
                deviceDatetime: d.device_datetime,
            }
            : null,
    };
};

const HARMONIC_TYPES = ['HD33-VL', 'HD33-VLL', 'HD33-IL'];

/** 15-minute harmonic snapshots for one datatype (for order trends). */
export const getHarmonicsHistory = async ({ siteId, addressId }: SourceKey, datatype: string, hours = 24) => {
    if (!HARMONIC_TYPES.includes(datatype)) {
        throw new Error(`datatype must be one of ${HARMONIC_TYPES.join(', ')}`);
    }
    const result = await pool.query(
        `SELECT bucket_start, device_datetime, sample_count, phase1, phase2, phase3
         FROM meter_harmonics_realtime
         WHERE site_id = $1 AND address_id = $2 AND datatype = $3
           AND bucket_start >= NOW() - ($4 || ' hours')::interval
         ORDER BY bucket_start`,
        [siteId, addressId, datatype, hours]
    );
    return result.rows.map((r) => ({
        bucketStart: r.bucket_start,
        deviceDatetime: r.device_datetime,
        sampleCount: r.sample_count,
        phases: [toNumbers(r.phase1), toNumbers(r.phase2), toNumbers(r.phase3)],
    }));
};

/** THD trend aggregated into 15-minute buckets (average). */
export const getThdHistory = async ({ siteId, addressId }: SourceKey, hours = 24) => {
    const result = await pool.query(
        `SELECT to_timestamp(floor(extract(epoch FROM device_datetime) / 900) * 900) AS bucket_start,
                AVG(thd_vl1)::float AS thd_vl1, AVG(thd_vl2)::float AS thd_vl2, AVG(thd_vl3)::float AS thd_vl3,
                AVG(thd_vl12)::float AS thd_vl12, AVG(thd_vl23)::float AS thd_vl23, AVG(thd_vl31)::float AS thd_vl31,
                AVG(thd_il1)::float AS thd_il1, AVG(thd_il2)::float AS thd_il2, AVG(thd_il3)::float AS thd_il3,
                COUNT(*)::int AS readings
         FROM meter_data_realtime
         WHERE site_id = $1 AND address_id = $2
           AND thd_vl1 IS NOT NULL
           AND device_datetime >= NOW() - ($3 || ' hours')::interval
         GROUP BY 1
         ORDER BY 1`,
        [siteId, addressId, hours]
    );
    return result.rows;
};
