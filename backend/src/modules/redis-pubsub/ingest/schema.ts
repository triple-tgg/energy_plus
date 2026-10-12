import pool from '../../../config/database';

export const HARMONICS_SNAPSHOT_MINUTES = Math.max(
    1,
    parseInt(process.env.HARMONICS_SNAPSHOT_MINUTES || '15', 10) || 15
);

let ensured: Promise<void> | null = null;

/**
 * Idempotent schema for the datatype-based Redis ingest.
 * - meter_data_realtime: + datatype, source_channel, thd_* (nullable; existing readers unaffected)
 * - meter_max_demand_realtime: every PM3-THD-DEMAND message (cascade-deleted with its realtime row)
 * - meter_harmonics_realtime: HD33-* snapshot per HARMONICS_SNAPSHOT_MINUTES bucket (latest sample wins)
 */
export const ensureRealtimeIngestSchema = (): Promise<void> => {
    if (ensured) return ensured;
    ensured = (async () => {
        const hasRealtime = await pool.query(`SELECT to_regclass('public.meter_data_realtime') AS t`);
        if (!hasRealtime.rows[0]?.t) {
            throw new Error('meter_data_realtime does not exist (run migrate-and-seed first)');
        }

        await pool.query(`
            ALTER TABLE meter_data_realtime
                ADD COLUMN IF NOT EXISTS datatype       VARCHAR(30),
                ADD COLUMN IF NOT EXISTS source_channel VARCHAR(100),
                ADD COLUMN IF NOT EXISTS thd_vl1  DECIMAL(8,2),
                ADD COLUMN IF NOT EXISTS thd_vl2  DECIMAL(8,2),
                ADD COLUMN IF NOT EXISTS thd_vl3  DECIMAL(8,2),
                ADD COLUMN IF NOT EXISTS thd_vl12 DECIMAL(8,2),
                ADD COLUMN IF NOT EXISTS thd_vl23 DECIMAL(8,2),
                ADD COLUMN IF NOT EXISTS thd_vl31 DECIMAL(8,2),
                ADD COLUMN IF NOT EXISTS thd_il1  DECIMAL(8,2),
                ADD COLUMN IF NOT EXISTS thd_il2  DECIMAL(8,2),
                ADD COLUMN IF NOT EXISTS thd_il3  DECIMAL(8,2)
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS meter_max_demand_realtime (
                id              BIGSERIAL PRIMARY KEY,
                realtime_id     BIGINT REFERENCES meter_data_realtime(id) ON DELETE CASCADE,
                site_id         INTEGER NOT NULL,
                address_id      INTEGER NOT NULL,
                vl1  DECIMAL(10,2), vl2  DECIMAL(10,2), vl3  DECIMAL(10,2),
                vl12 DECIMAL(10,2), vl23 DECIMAL(10,2), vl31 DECIMAL(10,2),
                il1  DECIMAL(12,3), il2  DECIMAL(12,3), il3  DECIMAL(12,3),
                kw1  DECIMAL(12,3), kw2  DECIMAL(12,3), kw3  DECIMAL(12,3),
                kvar1 DECIMAL(12,3), kvar2 DECIMAL(12,3), kvar3 DECIMAL(12,3),
                kva1 DECIMAL(12,3), kva2 DECIMAL(12,3), kva3 DECIMAL(12,3),
                pf1  DECIMAL(6,4), pf2  DECIMAL(6,4), pf3  DECIMAL(6,4),
                vln_3ph  DECIMAL(10,2),
                vll_3ph  DECIMAL(10,2),
                il_3ph   DECIMAL(12,3),
                kw_3ph   DECIMAL(12,3),
                kvar_3ph DECIMAL(12,3),
                kva_3ph  DECIMAL(12,3),
                device_datetime TIMESTAMPTZ NOT NULL,
                received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_max_demand_site_address_time
            ON meter_max_demand_realtime (site_id, address_id, device_datetime DESC)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_max_demand_realtime_id
            ON meter_max_demand_realtime (realtime_id)`);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS meter_harmonics_realtime (
                id              BIGSERIAL PRIMARY KEY,
                site_id         INTEGER NOT NULL,
                address_id      INTEGER NOT NULL,
                datatype        VARCHAR(20) NOT NULL,
                bucket_start    TIMESTAMPTZ NOT NULL,
                phase1          REAL[] NOT NULL,
                phase2          REAL[] NOT NULL,
                phase3          REAL[] NOT NULL,
                device          VARCHAR(50),
                code            VARCHAR(20),
                sample_count    INTEGER NOT NULL DEFAULT 1,
                device_datetime TIMESTAMPTZ NOT NULL,
                received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_harmonics_snapshot UNIQUE (site_id, address_id, datatype, bucket_start)
            )
        `);
        await pool.query(`COMMENT ON TABLE meter_harmonics_realtime IS
            'HD33-* harmonic snapshots. phaseN[1] = H2 ... phaseN[32] = H33. HD33-VL: VL1/VL2/VL3, HD33-VLL: VL12/VL23/VL31, HD33-IL: IL1/IL2/IL3'`);

        // Channels seen on Redis (auto-discovery). Data is NOT stored until the channel is linked to a meter.
        await pool.query(`
            CREATE TABLE IF NOT EXISTS redis_channel_discovery (
                channel           VARCHAR(120) PRIMARY KEY,
                base_channel      VARCHAR(100) NOT NULL,
                site_id           INTEGER,
                address_id        INTEGER,
                datatype          VARCHAR(30),
                device            VARCHAR(80),
                code              VARCHAR(30),
                handler_supported BOOLEAN NOT NULL DEFAULT false,
                first_seen        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                last_seen         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                msg_count         BIGINT NOT NULL DEFAULT 0,
                rate_per_min      REAL,
                sample_json       JSONB,
                sample_at         TIMESTAMPTZ,
                ignored           BOOLEAN NOT NULL DEFAULT false,
                ignored_by        VARCHAR(100),
                ignored_at        TIMESTAMPTZ,
                updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_redis_channel_discovery_base
            ON redis_channel_discovery (base_channel)`);
    })().catch((error) => {
        ensured = null; // allow retry on next call
        throw error;
    });
    return ensured;
};
