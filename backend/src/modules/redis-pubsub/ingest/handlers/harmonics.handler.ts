import { HARMONICS_SNAPSHOT_MINUTES } from '../schema';
import { num, ParsedHeader } from '../messageParser';
import { DatatypeHandler } from './types';

const HARMONIC_ORDERS = Array.from({ length: 32 }, (_, i) => i + 2); // H2..H33

/** datatype → payload phase suffixes stored in phase1/phase2/phase3. */
export const HARMONIC_PHASES: Record<string, [string, string, string]> = {
    'HD33-VL': ['VL1', 'VL2', 'VL3'],
    'HD33-VLL': ['VL12', 'VL23', 'VL31'],
    'HD33-IL': ['IL1', 'IL2', 'IL3'],
};

export const floorToBucket = (date: Date, minutes = HARMONICS_SNAPSHOT_MINUTES): Date => {
    const size = minutes * 60 * 1000;
    return new Date(Math.floor(date.getTime() / size) * size);
};

/** Returns [phase1, phase2, phase3]; index 0 = H2 (Postgres index 1). Missing values → null. */
export const extractHarmonics = (datatype: string, data: Record<string, any>): Array<Array<number | null>> => {
    const phases = HARMONIC_PHASES[datatype];
    if (!phases) throw new Error(`No harmonic phase mapping for ${datatype}`);
    return phases.map((phase) => HARMONIC_ORDERS.map((h) => num(data[`H${h}_${phase}`])));
};

export const buildHarmonicsRow = (header: ParsedHeader, data: Record<string, any>) => {
    const [phase1, phase2, phase3] = extractHarmonics(header.datatype, data);
    return [
        header.siteId, header.addressId, header.datatype,
        floorToBucket(header.deviceDatetime),
        phase1, phase2, phase3,
        header.device, header.code, header.deviceDatetime,
    ];
};

/**
 * HD33-* harmonic spectra. Stored as one snapshot per HARMONICS_SNAPSHOT_MINUTES bucket
 * (default 15 min); later messages in the same bucket overwrite it, so each row holds
 * the latest sample of its bucket (same convention as the 15-minute aggregation).
 */
export const harmonicsHandler: DatatypeHandler = {
    name: 'harmonics',
    datatypes: Object.keys(HARMONIC_PHASES),
    async save(client, header, data) {
        await client.query(
            `INSERT INTO meter_harmonics_realtime (
                site_id, address_id, datatype, bucket_start,
                phase1, phase2, phase3, device, code, device_datetime
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (site_id, address_id, datatype, bucket_start) DO UPDATE SET
                phase1 = EXCLUDED.phase1,
                phase2 = EXCLUDED.phase2,
                phase3 = EXCLUDED.phase3,
                device = EXCLUDED.device,
                code = EXCLUDED.code,
                device_datetime = EXCLUDED.device_datetime,
                received_at = NOW(),
                sample_count = meter_harmonics_realtime.sample_count + 1
             WHERE EXCLUDED.device_datetime >= meter_harmonics_realtime.device_datetime`,
            buildHarmonicsRow(header, data)
        );
    },
};
