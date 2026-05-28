import pool from '../config/database';

/**
 * Create table for storing raw meter data received from Redis Pub/Sub
 * Matches the exact JSON structure from the power meter device (MPR45S)
 */
async function createRedisMeterTable() {
    const client = await pool.connect();

    try {
        console.log('\n🔧 Creating Redis meter data table...\n');

        await client.query(`
            CREATE TABLE IF NOT EXISTS meter_data_realtime (
                id              BIGSERIAL PRIMARY KEY,
                
                -- Channel & Device Info
                channel         VARCHAR(100),
                site_id         INTEGER,
                address_id      INTEGER,
                device          VARCHAR(50),
                code            VARCHAR(20),
                type            VARCHAR(50),
                
                -- Voltage Line-to-Neutral
                vl1             DECIMAL(10,2) DEFAULT 0,
                vl2             DECIMAL(10,2) DEFAULT 0,
                vl3             DECIMAL(10,2) DEFAULT 0,
                
                -- Voltage Line-to-Line
                vl12            DECIMAL(10,2) DEFAULT 0,
                vl23            DECIMAL(10,2) DEFAULT 0,
                vl31            DECIMAL(10,2) DEFAULT 0,
                
                -- Current per phase
                il1             DECIMAL(10,3) DEFAULT 0,
                il2             DECIMAL(10,3) DEFAULT 0,
                il3             DECIMAL(10,3) DEFAULT 0,
                
                -- Active Power (kW) per phase & total
                kw1             DECIMAL(12,3) DEFAULT 0,
                kw2             DECIMAL(12,3) DEFAULT 0,
                kw3             DECIMAL(12,3) DEFAULT 0,
                kw_3ph          DECIMAL(12,3) DEFAULT 0,
                
                -- Reactive Power (kVar) per phase & total
                kvar1           DECIMAL(12,3) DEFAULT 0,
                kvar2           DECIMAL(12,3) DEFAULT 0,
                kvar3           DECIMAL(12,3) DEFAULT 0,
                kvar_3ph        DECIMAL(12,3) DEFAULT 0,
                
                -- Apparent Power (kVA) per phase & total
                kva1            DECIMAL(12,3) DEFAULT 0,
                kva2            DECIMAL(12,3) DEFAULT 0,
                kva3            DECIMAL(12,3) DEFAULT 0,
                kva_3ph         DECIMAL(12,3) DEFAULT 0,
                
                -- Power Factor per phase
                pf1             DECIMAL(6,4) DEFAULT 0,
                pf2             DECIMAL(6,4) DEFAULT 0,
                pf3             DECIMAL(6,4) DEFAULT 0,
                
                -- Frequency
                hz              DECIMAL(8,2) DEFAULT 0,
                
                -- Energy (cumulative)
                import_kwhr     DECIMAL(18,3) DEFAULT 0,
                
                -- Timestamps
                device_datetime TIMESTAMPTZ,
                received_at     TIMESTAMPTZ DEFAULT NOW(),
                
                -- Raw JSON for reference
                raw_json        JSONB
            )
        `);
        console.log('  ✅ meter_data_realtime table created');

        // Create indexes for efficient querying
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_meter_realtime_site_address 
            ON meter_data_realtime (site_id, address_id)
        `);
        console.log('  ✅ Index: site_id + address_id');

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_meter_realtime_device_datetime 
            ON meter_data_realtime (device_datetime DESC)
        `);
        console.log('  ✅ Index: device_datetime DESC');

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_meter_realtime_received_at 
            ON meter_data_realtime (received_at DESC)
        `);
        console.log('  ✅ Index: received_at DESC');

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_meter_realtime_channel 
            ON meter_data_realtime (channel)
        `);
        console.log('  ✅ Index: channel');

        console.log('\n✅ Redis meter data table ready!\n');

    } catch (error) {
        console.error('❌ Table creation failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

createRedisMeterTable();
