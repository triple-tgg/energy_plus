import pool from '../config/database';

/**
 * Seed mock real-time meter data into meter_data_realtime table.
 * Generates historical data for the last 90 days (3 months) at 15-minute intervals.
 * Optimised with batch inserts for speed over cloud networks.
 */
async function seedMockRealtime() {
    const client = await pool.connect();

    try {
        console.log('\n🌱 Seeding mock real-time meter data (90 days, 15-min intervals)...');

        // 1. Ensure table exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS meter_data_realtime (
                id              BIGSERIAL PRIMARY KEY,
                channel         VARCHAR(100),
                site_id         INTEGER,
                address_id      INTEGER,
                device          VARCHAR(50),
                code            VARCHAR(20),
                type            VARCHAR(50),
                vl1             DECIMAL(10,2) DEFAULT 0,
                vl2             DECIMAL(10,2) DEFAULT 0,
                vl3             DECIMAL(10,2) DEFAULT 0,
                vl12            DECIMAL(10,2) DEFAULT 0,
                vl23            DECIMAL(10,2) DEFAULT 0,
                vl31            DECIMAL(10,2) DEFAULT 0,
                il1             DECIMAL(10,3) DEFAULT 0,
                il2             DECIMAL(10,3) DEFAULT 0,
                il3             DECIMAL(10,3) DEFAULT 0,
                kw1             DECIMAL(12,3) DEFAULT 0,
                kw2             DECIMAL(12,3) DEFAULT 0,
                kw3             DECIMAL(12,3) DEFAULT 0,
                kw_3ph          DECIMAL(12,3) DEFAULT 0,
                kvar1           DECIMAL(12,3) DEFAULT 0,
                kvar2           DECIMAL(12,3) DEFAULT 0,
                kvar3           DECIMAL(12,3) DEFAULT 0,
                kvar_3ph        DECIMAL(12,3) DEFAULT 0,
                kva1            DECIMAL(12,3) DEFAULT 0,
                kva2            DECIMAL(12,3) DEFAULT 0,
                kva3            DECIMAL(12,3) DEFAULT 0,
                kva_3ph         DECIMAL(12,3) DEFAULT 0,
                pf1             DECIMAL(6,4) DEFAULT 0,
                pf2             DECIMAL(6,4) DEFAULT 0,
                pf3             DECIMAL(6,4) DEFAULT 0,
                hz              DECIMAL(8,2) DEFAULT 0,
                import_kwhr     DECIMAL(18,3) DEFAULT 0,
                device_datetime TIMESTAMPTZ,
                received_at     TIMESTAMPTZ DEFAULT NOW(),
                raw_json        JSONB
            )
        `);

        // Check if index exists, create if not
        await client.query(`CREATE INDEX IF NOT EXISTS idx_meter_realtime_site_address ON meter_data_realtime (site_id, address_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_meter_realtime_device_datetime ON meter_data_realtime (device_datetime DESC)`);

        // Clear existing mock data in real-time table
        console.log('🧹 Clearing previous real-time mock data...');
        await client.query(`DELETE FROM meter_data_realtime WHERE channel = 'project1_1000_1'`);

        // Seed meters config
        const meters = [
            { code: '0206213159', addr: 1, site: 1 },
            { code: '0206213160', addr: 2, site: 1 },
            { code: '0206213161', addr: 3, site: 1 },
            { code: '0206213162', addr: 4, site: 1 },
            { code: '0206213163', addr: 5, site: 1 }
        ];

        const channel = process.env.REDIS_DEFAULT_CHANNEL || 'project1_1000_1';
        const now = new Date();
        
        // 90 days at 15-minute intervals (4 points per hour * 24 hours * 90 days = 8,640 intervals)
        const days = 90;
        const intervalsPerDay = 24 * 4; // 96
        const intervals = days * intervalsPerDay; // 8,640
        
        console.log(`⏳ Generating ${intervals * meters.length} data points (8,640 intervals per meter)...`);

        const BATCH_SIZE = 500; // Fast batch inserts (17,500 parameters per batch)
        let valueRows: any[][] = [];

        await client.query('BEGIN');

        for (let i = 0; i < intervals; i++) {
            const timeOffset = (intervals - i) * 15 * 60 * 1000; // 15-minute offsets
            const recordTime = new Date(now.getTime() - timeOffset);

            for (const m of meters) {
                const baseKw = m.addr === 1 ? 250 : m.addr === 2 ? 180 : m.addr === 3 ? 60 : m.addr === 4 ? 80 : 30;
                const hour = recordTime.getHours();
                const timeFactor = (hour >= 8 && hour <= 18) ? 1.5 : 0.6;
                const randomFluc = 0.9 + Math.random() * 0.2;
                
                const kwTotal = parseFloat((baseKw * timeFactor * randomFluc).toFixed(3));
                const kw1 = parseFloat((kwTotal * 0.33).toFixed(3));
                const kw2 = parseFloat((kwTotal * 0.34).toFixed(3));
                const kw3 = parseFloat((kwTotal * 0.33).toFixed(3));

                const pf1 = parseFloat((0.85 + Math.random() * 0.1).toFixed(4));
                const pf2 = parseFloat((0.85 + Math.random() * 0.1).toFixed(4));
                const pf3 = parseFloat((0.85 + Math.random() * 0.1).toFixed(4));

                const vl1 = parseFloat((220 + Math.random() * 4).toFixed(2));
                const vl2 = parseFloat((219 + Math.random() * 4).toFixed(2));
                const vl3 = parseFloat((221 + Math.random() * 4).toFixed(2));

                const vl12 = parseFloat((vl1 * Math.sqrt(3)).toFixed(2));
                const vl23 = parseFloat((vl2 * Math.sqrt(3)).toFixed(2));
                const vl31 = parseFloat((vl3 * Math.sqrt(3)).toFixed(2));

                const il1 = parseFloat((kw1 * 1000 / (vl1 * pf1)).toFixed(3));
                const il2 = parseFloat((kw2 * 1000 / (vl2 * pf2)).toFixed(3));
                const il3 = parseFloat((kw3 * 1000 / (vl3 * pf3)).toFixed(3));

                const kvar1 = parseFloat((kw1 * Math.tan(Math.acos(pf1))).toFixed(3));
                const kvar2 = parseFloat((kw2 * Math.tan(Math.acos(pf2))).toFixed(3));
                const kvar3 = parseFloat((kw3 * Math.tan(Math.acos(pf3))).toFixed(3));
                const kvarTotal = parseFloat((kvar1 + kvar2 + kvar3).toFixed(3));

                const kva1 = parseFloat((kw1 / pf1).toFixed(3));
                const kva2 = parseFloat((kw2 / pf2).toFixed(3));
                const kva3 = parseFloat((kw3 / pf3).toFixed(3));
                const kvaTotal = parseFloat((kva1 + kva2 + kva3).toFixed(3));

                const hz = parseFloat((49.95 + Math.random() * 0.1).toFixed(2));

                // Cumulative energy (starting from 1,000,000 kWh and adding incrementally)
                const startKwh = 1254300 + (m.addr * 25000);
                const energyAdded = (kwTotal * 15) / 60; // 15 minutes of usage
                const importKwhr = parseFloat((startKwh + (i * energyAdded)).toFixed(3));

                const mockPayload = {
                    siteID: m.site,
                    addressID: m.addr,
                    device: 'MPR45S',
                    code: m.code,
                    type: 'ไฟฟ้า',
                    VL1: vl1, VL2: vl2, VL3: vl3,
                    VL12: vl12, VL23: vl23, VL31: vl31,
                    IL1: il1, IL2: il2, IL3: il3,
                    KW1: kw1, KW2: kw2, KW3: kw3, KW_3Ph: kwTotal,
                    KVar1: kvar1, KVar2: kvar2, KVar3: kvar3, KVar_3Ph: kvarTotal,
                    KVA1: kva1, KVA2: kva2, KVA3: kva3, KVA_3Ph: kvaTotal,
                    PF1: pf1, PF2: pf2, PF3: pf3,
                    Hz: hz,
                    Import_KWhr: importKwhr,
                    datetime: recordTime.toISOString()
                };

                const row = [
                    channel, m.site, m.addr, mockPayload.device, mockPayload.code, mockPayload.type,
                    vl1, vl2, vl3, vl12, vl23, vl31,
                    il1, il2, il3,
                    kw1, kw2, kw3, kwTotal,
                    kvar1, kvar2, kvar3, kvarTotal,
                    kva1, kva2, kva3, kvaTotal,
                    pf1, pf2, pf3,
                    hz, importKwhr,
                    recordTime, recordTime, JSON.stringify(mockPayload)
                ];

                valueRows.push(row);

                if (valueRows.length >= BATCH_SIZE) {
                    await insertBatch(client, valueRows);
                    valueRows = [];
                }
            }
        }

        // Insert remaining rows
        if (valueRows.length > 0) {
            await insertBatch(client, valueRows);
        }

        await client.query('COMMIT');
        console.log(`✅ Successfully seeded ${intervals * meters.length} mock real-time data rows!`);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Seeding failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

/**
 * Execute a single batch insert query
 */
async function insertBatch(client: any, rows: any[][]) {
    const columnsCount = rows[0].length;
    const placeholders: string[] = [];
    const flatValues: any[] = [];

    rows.forEach((row, rowIndex) => {
        const rowPlaceholders = row.map((_, colIndex) => {
            const index = (rowIndex * columnsCount) + colIndex + 1;
            return `$${index}`;
        });
        placeholders.push(`(${rowPlaceholders.join(', ')})`);
        flatValues.push(...row);
    });

    const queryText = `
        INSERT INTO meter_data_realtime (
            channel, site_id, address_id, device, code, type,
            vl1, vl2, vl3, vl12, vl23, vl31,
            il1, il2, il3,
            kw1, kw2, kw3, kw_3ph,
            kvar1, kvar2, kvar3, kvar_3ph,
            kva1, kva2, kva3, kva_3ph,
            pf1, pf2, pf3,
            hz, import_kwhr,
            device_datetime, received_at, raw_json
        ) VALUES ${placeholders.join(', ')}
    `;

    await client.query(queryText, flatValues);
}

seedMockRealtime();
