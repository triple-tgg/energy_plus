import { PoolClient } from 'pg';
import { num, ParsedHeader } from '../messageParser';
import { DatatypeHandler } from './types';

/**
 * [db column, payload key, max |value| allowed by the column precision].
 * DECIMAL(p,s) holds |v| < 10^(p-s): (10,2)=1e8, (10,3)=1e7, (12,3)=1e9, (6,4)=100, (8,2)=1e6, (18,3)=1e15.
 */
type Field = [string, string, number];

const V = 1e8, I = 1e7, P = 1e9, PF = 100, HZ = 1e6, E = 1e15, THD = 1e6;

/** Base electrical values (missing → 0, same as the legacy ingest). */
const BASE_FIELDS: Field[] = [
    ['vl1', 'VL1', V], ['vl2', 'VL2', V], ['vl3', 'VL3', V],
    ['vl12', 'VL12', V], ['vl23', 'VL23', V], ['vl31', 'VL31', V],
    ['il1', 'IL1', I], ['il2', 'IL2', I], ['il3', 'IL3', I],
    ['kw1', 'KW1', P], ['kw2', 'KW2', P], ['kw3', 'KW3', P], ['kw_3ph', 'KW_3Ph', P],
    ['kvar1', 'KVar1', P], ['kvar2', 'KVar2', P], ['kvar3', 'KVar3', P], ['kvar_3ph', 'KVar_3Ph', P],
    ['kva1', 'KVA1', P], ['kva2', 'KVA2', P], ['kva3', 'KVA3', P], ['kva_3ph', 'KVA_3Ph', P],
    ['pf1', 'PF1', PF], ['pf2', 'PF2', PF], ['pf3', 'PF3', PF],
    ['hz', 'Hz', HZ],
    ['import_kwhr', 'Import_KWhr', E],
];

/** THD values (missing → NULL, so "not measured" is distinguishable from 0). */
const THD_FIELDS: Field[] = [
    ['thd_vl1', 'THD_VL1', THD], ['thd_vl2', 'THD_VL2', THD], ['thd_vl3', 'THD_VL3', THD],
    ['thd_vl12', 'THD_VL12', THD], ['thd_vl23', 'THD_VL23', THD], ['thd_vl31', 'THD_VL31', THD],
    ['thd_il1', 'THD_IL1', THD], ['thd_il2', 'THD_IL2', THD], ['thd_il3', 'THD_IL3', THD],
];

const MAX_DEMAND_FIELDS: Field[] = [
    ['vl1', 'MAX_DEMAND_VL1', V], ['vl2', 'MAX_DEMAND_VL2', V], ['vl3', 'MAX_DEMAND_VL3', V],
    ['vl12', 'MAX_DEMAND_VL12', V], ['vl23', 'MAX_DEMAND_VL23', V], ['vl31', 'MAX_DEMAND_VL31', V],
    ['il1', 'MAX_DEMAND_IL1', P], ['il2', 'MAX_DEMAND_IL2', P], ['il3', 'MAX_DEMAND_IL3', P],
    ['kw1', 'MAX_DEMAND_KW1', P], ['kw2', 'MAX_DEMAND_KW2', P], ['kw3', 'MAX_DEMAND_KW3', P],
    ['kvar1', 'MAX_DEMAND_KVar1', P], ['kvar2', 'MAX_DEMAND_KVar2', P], ['kvar3', 'MAX_DEMAND_KVar3', P],
    ['kva1', 'MAX_DEMAND_KVA1', P], ['kva2', 'MAX_DEMAND_KVA2', P], ['kva3', 'MAX_DEMAND_KVA3', P],
    ['pf1', 'MAX_DEMAND_PF1', PF], ['pf2', 'MAX_DEMAND_PF2', PF], ['pf3', 'MAX_DEMAND_PF3', PF],
    ['vln_3ph', 'MAX_DEMAND_VLN_3Ph', V],
    ['vll_3ph', 'MAX_DEMAND_VLL_3Ph', V],
    ['il_3ph', 'MAX_DEMAND_IL_3Ph', P],
    ['kw_3ph', 'MAX_DEMAND_KW_3Ph', P],
    ['kvar_3ph', 'MAX_DEMAND_KVar_3Ph', P],
    ['kva_3ph', 'MAX_DEMAND_KVA_3Ph', P],
];

const warnedOutOfRange = new Set<string>();

/**
 * Value for a column: missing → `missing`; out of the column's range (corrupt device reading,
 * e.g. PF = -2117289) → NULL so the rest of the row is still stored (raw_json keeps the original).
 */
const fit = (header: ParsedHeader, data: Record<string, any>, [col, key, maxAbs]: Field, missing: number | null) => {
    const value = num(data[key]);
    if (value === null) return missing;
    if (Math.abs(value) < maxAbs) return value;
    const warnKey = `${header.sourceChannel}:${key}`;
    if (!warnedOutOfRange.has(warnKey)) {
        warnedOutOfRange.add(warnKey);
        console.warn(`⚠️  Redis ingest: ${header.sourceChannel} ${key}=${value} out of range for ${col} — stored as NULL`);
    }
    return null;
};

const placeholders = (count: number, offset = 0): string =>
    Array.from({ length: count }, (_, i) => `$${i + 1 + offset}`).join(', ');

export const buildRealtimeRow = (header: ParsedHeader, data: Record<string, any>) => {
    const columns = [
        'channel', 'source_channel', 'datatype', 'site_id', 'address_id', 'device', 'code', 'type',
        ...BASE_FIELDS.map(([col]) => col),
        ...THD_FIELDS.map(([col]) => col),
        'device_datetime', 'raw_json',
    ];
    const values = [
        header.baseChannel, header.sourceChannel, header.datatype,
        header.siteId, header.addressId, header.device, header.code, header.type,
        ...BASE_FIELDS.map((field) => fit(header, data, field, 0)),
        ...THD_FIELDS.map((field) => fit(header, data, field, null)),
        header.deviceDatetime, JSON.stringify(data),
    ];
    return { columns, values };
};

export const buildMaxDemandRow = (header: ParsedHeader, data: Record<string, any>, realtimeId: number | string | null) => {
    const columns = ['realtime_id', 'site_id', 'address_id', ...MAX_DEMAND_FIELDS.map(([col]) => col), 'device_datetime'];
    const values = [
        realtimeId, header.siteId, header.addressId,
        ...MAX_DEMAND_FIELDS.map((field) => fit(header, data, field, null)),
        header.deviceDatetime,
    ];
    return { columns, values };
};

const hasMaxDemand = (data: Record<string, any>): boolean =>
    MAX_DEMAND_FIELDS.some(([, key]) => data[key] !== undefined);

const insertRealtime = async (client: PoolClient, header: ParsedHeader, data: Record<string, any>) => {
    const { columns, values } = buildRealtimeRow(header, data);
    const result = await client.query(
        `INSERT INTO meter_data_realtime (${columns.join(', ')}) VALUES (${placeholders(values.length)}) RETURNING id`,
        values
    );
    return result.rows[0]?.id ?? null;
};

/**
 * Power-meter datatypes that carry base electrical values.
 * PM3            → meter_data_realtime
 * PM3-THD        → meter_data_realtime (+ thd_*)
 * PM3-THD-DEMAND → meter_data_realtime (+ thd_*) and meter_max_demand_realtime (every message)
 */
export const powerMeterHandler: DatatypeHandler = {
    name: 'power-meter',
    datatypes: ['PM1', 'PM3', 'PM3-THD', 'PM3-THD-DEMAND'],
    async save(client, header, data) {
        const realtimeId = await insertRealtime(client, header, data);
        if (hasMaxDemand(data)) {
            const { columns, values } = buildMaxDemandRow(header, data, realtimeId);
            await client.query(
                `INSERT INTO meter_max_demand_realtime (${columns.join(', ')}) VALUES (${placeholders(values.length)})`,
                values
            );
        }
    },
};
