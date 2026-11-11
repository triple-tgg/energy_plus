import { query } from './database';

export const ensureMeterMasterData = async (): Promise<void> => {
    try {
        // 1. Ensure meter_type table exists
        await query(`
            CREATE TABLE IF NOT EXISTS meter_type (
                meter_type_id SERIAL PRIMARY KEY,
                meter_type_name VARCHAR(100) NOT NULL,
                icon_name VARCHAR(50),
                is_active BOOLEAN DEFAULT true,
                created_by VARCHAR(100),
                created_on TIMESTAMPTZ DEFAULT NOW(),
                last_modified_by VARCHAR(100),
                last_modified_on TIMESTAMPTZ
            )
        `);

        // 2. Ensure standard 8 meter types exist
        const standardTypes = [
            { id: 1, name: 'Power',          icon: 'fa fa-bolt' },
            { id: 2, name: 'Water',          icon: 'fa fa-tint' },
            { id: 3, name: 'Water Quality',  icon: 'fa fa-flask' },
            { id: 4, name: 'Air Quality',    icon: 'fa fa-wind' },
            { id: 5, name: 'Soil Quality',   icon: 'fa fa-seedling' },
            { id: 6, name: 'Power Security', icon: 'fa fa-shield-alt' },
            { id: 7, name: 'Fire Security',  icon: 'fa fa-fire-extinguisher' },
            { id: 8, name: 'Room Service',   icon: 'fa fa-home' },
        ];

        for (const t of standardTypes) {
            await query(
                `INSERT INTO meter_type (meter_type_id, meter_type_name, icon_name, is_active)
                 VALUES ($1, $2, $3, true)
                 ON CONFLICT (meter_type_id) DO UPDATE SET meter_type_name = $2, icon_name = $3, is_active = true`,
                [t.id, t.name, t.icon]
            );
        }

        // Reset meter_type sequence
        await query(`SELECT setval('meter_type_meter_type_id_seq', (SELECT GREATEST(MAX(meter_type_id), 8) FROM meter_type))`);

        // 3. Ensure meter_sub_type table exists
        await query(`
            CREATE TABLE IF NOT EXISTS meter_sub_type (
                meter_sub_type_id SERIAL PRIMARY KEY,
                meter_type_id INTEGER NOT NULL REFERENCES meter_type(meter_type_id) ON DELETE CASCADE,
                sub_type_name VARCHAR(100) NOT NULL,
                sort_order INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                created_by VARCHAR(100),
                created_on TIMESTAMPTZ DEFAULT NOW(),
                last_modified_by VARCHAR(100),
                last_modified_on TIMESTAMPTZ
            )
        `);

        // 4. Ensure meter table has foreign key column meter_sub_type_id
        await query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meter') THEN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'meter' AND column_name = 'meter_sub_type_id') THEN
                        ALTER TABLE meter ADD COLUMN meter_sub_type_id INTEGER REFERENCES meter_sub_type(meter_sub_type_id) ON DELETE SET NULL;
                    END IF;
                END IF;
            END $$;
        `);

        // 5. Seed standard sub types for each meter type (only if not already existing)
        const standardSubTypes: { typeId: number; name: string; sortOrder: number }[] = [
            // Power (Type 1)
            { typeId: 1, name: 'MDB', sortOrder: 1 },
            { typeId: 1, name: 'DB', sortOrder: 2 },
            { typeId: 1, name: 'ELE', sortOrder: 3 },
            { typeId: 1, name: 'KWH', sortOrder: 4 },
            { typeId: 1, name: 'CHILLER', sortOrder: 5 },
            { typeId: 1, name: 'AIR', sortOrder: 6 },
            { typeId: 1, name: 'SOLAR', sortOrder: 7 },
            { typeId: 1, name: 'LIGHTING', sortOrder: 8 },
            { typeId: 1, name: 'PLUG', sortOrder: 9 },
            { typeId: 1, name: 'LIFT', sortOrder: 10 },
            { typeId: 1, name: 'OTHER', sortOrder: 11 },

            // Water (Type 2)
            { typeId: 2, name: 'MAIN', sortOrder: 1 },
            { typeId: 2, name: 'COOLING TOWER', sortOrder: 2 },
            { typeId: 2, name: 'WATER PUMP', sortOrder: 3 },
            { typeId: 2, name: 'DOMESTIC', sortOrder: 4 },
            { typeId: 2, name: 'RECYCLE', sortOrder: 5 },
            { typeId: 2, name: 'OTHER', sortOrder: 6 },

            // Water Quality (Type 3)
            { typeId: 3, name: 'PH', sortOrder: 1 },
            { typeId: 3, name: 'TDS', sortOrder: 2 },
            { typeId: 3, name: 'CONDUCTIVITY', sortOrder: 3 },
            { typeId: 3, name: 'TURBIDITY', sortOrder: 4 },

            // Air Quality (Type 4)
            { typeId: 4, name: 'PM2.5', sortOrder: 1 },
            { typeId: 4, name: 'PM10', sortOrder: 2 },
            { typeId: 4, name: 'CO2', sortOrder: 3 },
            { typeId: 4, name: 'TEMP/HUMIDITY', sortOrder: 4 },

            // Soil Quality (Type 5)
            { typeId: 5, name: 'SOIL MOISTURE', sortOrder: 1 },
            { typeId: 5, name: 'SOIL NPK', sortOrder: 2 },

            // Power Security (Type 6)
            { typeId: 6, name: 'UPS', sortOrder: 1 },
            { typeId: 6, name: 'GENERATOR', sortOrder: 2 },

            // Fire Security (Type 7)
            { typeId: 7, name: 'FIRE PUMP', sortOrder: 1 },
            { typeId: 7, name: 'SMOKE ALARM', sortOrder: 2 },

            // Room Service (Type 8)
            { typeId: 8, name: 'ROOM ENERGY', sortOrder: 1 },
            { typeId: 8, name: 'KEYCARD', sortOrder: 2 },
        ];

        for (const st of standardSubTypes) {
            await query(
                `INSERT INTO meter_sub_type (meter_type_id, sub_type_name, sort_order, is_active)
                 SELECT $1, $2::varchar, $3, true
                 WHERE NOT EXISTS (
                     SELECT 1 FROM meter_sub_type
                     WHERE meter_type_id = $1 AND LOWER(sub_type_name) = LOWER($2::varchar)
                 )`,
                [st.typeId, st.name, st.sortOrder]
            );
            await query(
                `UPDATE meter_sub_type
                 SET sort_order = $3, is_active = true
                 WHERE meter_type_id = $1 AND LOWER(sub_type_name) = LOWER($2::varchar)`,
                [st.typeId, st.name, st.sortOrder]
            );
        }

        // Backfill meter_sub_type_id for existing Power meters where meter_sub_type_id is NULL
        await query(`
            UPDATE meter m
            SET meter_sub_type_id = mst.meter_sub_type_id
            FROM meter_type mt, meter_sub_type mst
            WHERE m.meter_sub_type_id IS NULL
              AND m.meter_type_id = mt.meter_type_id
              AND mst.meter_type_id = 1
              AND (
                  LOWER(TRIM(mt.meter_type_name)) = LOWER(TRIM(mst.sub_type_name))
                  OR LOWER(TRIM(COALESCE(m.meter_group, ''))) = LOWER(TRIM(mst.sub_type_name))
              )
        `);

        // Reset meter_sub_type sequence safely
        await query(`
            SELECT setval(
                'meter_sub_type_meter_sub_type_id_seq',
                COALESCE((SELECT MAX(meter_sub_type_id) FROM meter_sub_type), 1)
            )
        `);

        // 6. Ensure meter_brand table & audit columns exist, then seed standard meter models/brands
        await query(`
            CREATE TABLE IF NOT EXISTS meter_brand (
                meter_brand_id SERIAL PRIMARY KEY,
                meter_brand_name VARCHAR(100) NOT NULL,
                model_name VARCHAR(100),
                notes VARCHAR(500),
                is_active BOOLEAN DEFAULT true,
                created_by VARCHAR(100),
                created_on TIMESTAMPTZ DEFAULT NOW(),
                last_modified_by VARCHAR(100),
                last_modified_on TIMESTAMPTZ
            )
        `);
        await query(`ALTER TABLE meter_brand ADD COLUMN IF NOT EXISTS model_name VARCHAR(100)`);
        await query(`ALTER TABLE meter_brand ADD COLUMN IF NOT EXISTS notes VARCHAR(500)`);
        await query(`ALTER TABLE meter_brand ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);
        await query(`ALTER TABLE meter_brand ADD COLUMN IF NOT EXISTS created_by VARCHAR(100)`);
        await query(`ALTER TABLE meter_brand ADD COLUMN IF NOT EXISTS created_on TIMESTAMPTZ DEFAULT NOW()`);
        await query(`ALTER TABLE meter_brand ADD COLUMN IF NOT EXISTS last_modified_by VARCHAR(100)`);
        await query(`ALTER TABLE meter_brand ADD COLUMN IF NOT EXISTS last_modified_on TIMESTAMPTZ`);

        const standardBrands = [
            { brand: 'Schneider Electric', model: 'PM5110', notes: 'Power Meter 3-Phase Modbus RS485 (สำหรับ MDB / DB / ELE)' },
            { brand: 'Schneider Electric', model: 'PM5350', notes: 'Power Meter 3-Phase Digital Analyzer (สำหรับ MDB / DB)' },
            { brand: 'Schneider Electric', model: 'PM2230', notes: 'PowerLogic PM2000 Series (สำหรับ DB / ELE)' },
            { brand: 'Entes', model: 'MPR-45S', notes: 'Network Analyzer 3P4W Modbus (สำหรับ MDB / DB / ELE)' },
            { brand: 'ABB', model: 'M4M 30', notes: 'Network Analyzer Modbus RTU/TCP (สำหรับ MDB / DB)' },
            { brand: 'Mitsubishi', model: 'ME96SS', notes: 'Electronic Multi-Measuring Instrument (สำหรับ Main MDB)' },
            { brand: 'Eastron', model: 'SDM630-Modbus', notes: '3-Phase Multifunction DIN Rail Meter (สำหรับ ELE / KWH)' },
            { brand: 'Eastron', model: 'SDM120-Modbus', notes: '1-Phase DIN Rail kWh Meter (สำหรับ KWH ปลายทาง)' },
            { brand: 'Digital Water', model: 'WaterFlow-50', notes: 'Ultrasonic / Pulse Water Meter (สำหรับมิเตอร์น้ำ)' },
            { brand: 'Manual Meter', model: 'Standard Analog/Digital', notes: 'มิเตอร์จดหน่วยแบบ Manual / สแกน QR Code (ทศนิยม 3 ตำแหน่ง)' },
        ];

        for (const b of standardBrands) {
            await query(
                `INSERT INTO meter_brand (meter_brand_name, model_name, notes, is_active, created_by, created_on)
                 SELECT $1::varchar, $2::varchar, $3::varchar, true, 'system', NOW()
                 WHERE NOT EXISTS (
                     SELECT 1 FROM meter_brand
                     WHERE LOWER(meter_brand_name) = LOWER($1::varchar)
                       AND LOWER(COALESCE(model_name, '')) = LOWER($2::varchar)
                 )`,
                [b.brand, b.model, b.notes]
            );
        }
        await query(`
            SELECT setval(
                'meter_brand_meter_brand_id_seq',
                COALESCE((SELECT MAX(meter_brand_id) FROM meter_brand), 1)
            )
        `);

        // 7. Ensure loop table & columns exist, then seed standard communication loops
        await query(`
            CREATE TABLE IF NOT EXISTS loop (
                loop_id SERIAL PRIMARY KEY,
                loop_name VARCHAR(100),
                port_no VARCHAR(50),
                baudrate INTEGER DEFAULT 9600,
                stopbit INTEGER DEFAULT 1,
                parity VARCHAR(10) DEFAULT 'N',
                databit INTEGER DEFAULT 8,
                remark VARCHAR(500),
                description VARCHAR(500),
                is_active BOOLEAN DEFAULT true
            )
        `);
        await query(`ALTER TABLE loop ADD COLUMN IF NOT EXISTS loop_name VARCHAR(100)`);
        await query(`ALTER TABLE loop ADD COLUMN IF NOT EXISTS stopbit INTEGER DEFAULT 1`);
        await query(`ALTER TABLE loop ADD COLUMN IF NOT EXISTS parity VARCHAR(10) DEFAULT 'N'`);
        await query(`ALTER TABLE loop ADD COLUMN IF NOT EXISTS databit INTEGER DEFAULT 8`);
        await query(`ALTER TABLE loop ADD COLUMN IF NOT EXISTS remark VARCHAR(500)`);
        await query(`ALTER TABLE loop ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);

        const standardLoops = [
            { portNo: 1, name: 'Loop 1', baudrate: 9600, stopbit: 1, parity: 'N', databit: 8, remark: 'Loop 1 — Main RS485 Bus (MDB / DB)' },
            { portNo: 2, name: 'Loop 2', baudrate: 9600, stopbit: 1, parity: 'N', databit: 8, remark: 'Loop 2 — Sub-meter RS485 Bus (ELE / KWH)' },
            { portNo: 3, name: 'Loop 3', baudrate: 9600, stopbit: 1, parity: 'N', databit: 8, remark: 'Loop 3 — Tenant / Floor RS485 Bus' },
            { portNo: 4, name: 'Loop 4', baudrate: 9600, stopbit: 1, parity: 'N', databit: 8, remark: 'Loop 4 — Water & Utility Meters' },
        ];

        for (const l of standardLoops) {
            await query(
                `INSERT INTO loop (loop_name, port_no, baudrate, stopbit, parity, databit, remark, is_active)
                 SELECT $1::varchar, $2, $3, $4, $5::varchar, $6, $7::varchar, true
                 WHERE NOT EXISTS (
                     SELECT 1 FROM loop WHERE port_no::text = $2::text
                 )`,
                [l.name, l.portNo, l.baudrate, l.stopbit, l.parity, l.databit, l.remark]
            );
        }
        await query(`
            SELECT setval(
                'loop_loop_id_seq',
                COALESCE((SELECT MAX(loop_id) FROM loop), 1)
            )
        `);

        // 8. Ensure protocol table & seed standard protocols
        await query(`
            CREATE TABLE IF NOT EXISTS protocol (
                protocol_id SERIAL PRIMARY KEY,
                protocol_name VARCHAR(100) NOT NULL,
                is_active BOOLEAN DEFAULT true
            )
        `);
        const standardProtocols = [
            { id: 1, name: 'Modbus RTU' },
            { id: 2, name: 'Modbus TCP' },
            { id: 3, name: 'BACnet' },
            { id: 4, name: 'MQTT / Redis PubSub' },
        ];
        for (const p of standardProtocols) {
            await query(
                `INSERT INTO protocol (protocol_id, protocol_name, is_active)
                 VALUES ($1, $2, true)
                 ON CONFLICT (protocol_id) DO UPDATE SET protocol_name = $2, is_active = true`,
                [p.id, p.name]
            );
        }
        await query(`SELECT setval('protocol_protocol_id_seq', (SELECT GREATEST(MAX(protocol_id), 4) FROM protocol))`);

        // 9. Ensure energy_value table & seed 21 standard parameters
        await query(`
            CREATE TABLE IF NOT EXISTS energy_value (
                energy_value_id SERIAL PRIMARY KEY,
                energy_value_name VARCHAR(100) NOT NULL,
                unit VARCHAR(20),
                column_name VARCHAR(50),
                display_order INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT true
            )
        `);
        const standardEnergyValues = [
            { id: 1, name: 'kWh', unit: 'kWh', col: 'energy_kwh', order: 1 },
            { id: 2, name: 'kW', unit: 'kW', col: 'energy_kw', order: 2 },
            { id: 3, name: 'kVA', unit: 'kVA', col: 'energy_kva', order: 3 },
            { id: 4, name: 'kVAR', unit: 'kVAR', col: 'energy_kvar', order: 4 },
            { id: 5, name: 'Frequency', unit: 'Hz', col: 'energy_frequency', order: 5 },
            { id: 6, name: 'Volt P1', unit: 'V', col: 'energy_volt_p1', order: 6 },
            { id: 7, name: 'Volt P2', unit: 'V', col: 'energy_volt_p2', order: 7 },
            { id: 8, name: 'Volt P3', unit: 'V', col: 'energy_volt_p3', order: 8 },
            { id: 9, name: 'Volt L1', unit: 'V', col: 'energy_volt_l1', order: 9 },
            { id: 10, name: 'Volt L2', unit: 'V', col: 'energy_volt_l2', order: 10 },
            { id: 11, name: 'Volt L3', unit: 'V', col: 'energy_volt_l3', order: 11 },
            { id: 12, name: 'Amp P1', unit: 'A', col: 'energy_amp1', order: 12 },
            { id: 13, name: 'Amp P2', unit: 'A', col: 'energy_amp2', order: 13 },
            { id: 14, name: 'Amp P3', unit: 'A', col: 'energy_amp3', order: 14 },
            { id: 15, name: 'PF P1', unit: '', col: 'energy_pf1', order: 15 },
            { id: 16, name: 'PF P2', unit: '', col: 'energy_pf2', order: 16 },
            { id: 17, name: 'PF P3', unit: '', col: 'energy_pf3', order: 17 },
            { id: 18, name: 'THD V1', unit: '%', col: 'energy_thd_v1', order: 18 },
            { id: 19, name: 'THD A1', unit: '%', col: 'energy_thd_a1', order: 19 },
            { id: 20, name: 'Water', unit: 'm³', col: 'water_value', order: 20 },
            { id: 21, name: 'Gas', unit: 'm³', col: 'gas_value', order: 21 },
        ];
        for (const ev of standardEnergyValues) {
            await query(
                `INSERT INTO energy_value (energy_value_id, energy_value_name, unit, column_name, display_order, is_active)
                 VALUES ($1, $2, $3, $4, $5, true)
                 ON CONFLICT (energy_value_id) DO UPDATE SET energy_value_name = $2, unit = $3, column_name = $4, display_order = $5`,
                [ev.id, ev.name, ev.unit, ev.col, ev.order]
            );
        }
        await query(`SELECT setval('energy_value_energy_value_id_seq', (SELECT GREATEST(MAX(energy_value_id), 21) FROM energy_value))`);

        // 10. Ensure default Billing Tariffs (billing_config & tou_tariff_config) and Alarm Group exist
        await query(`
            CREATE TABLE IF NOT EXISTS billing_config (
                id SERIAL PRIMARY KEY,
                effective_date DATE NOT NULL,
                unit_price DECIMAL(10,4) NOT NULL DEFAULT 4.1500,
                rate_mode VARCHAR(20) DEFAULT 'tiered',
                tier1_limit NUMERIC(10, 2) DEFAULT 200.00,
                tier1_rate NUMERIC(10, 4) DEFAULT 3.0000,
                tier2_rate NUMERIC(10, 4) DEFAULT 4.2200,
                service_charge NUMERIC(10, 4) DEFAULT 24.6200,
                ft_rate NUMERIC(10, 4) DEFAULT 0.1623,
                vat_percent NUMERIC(5, 2) DEFAULT 7.00,
                description VARCHAR(500),
                is_active BOOLEAN DEFAULT true,
                created_by VARCHAR(100),
                created_on TIMESTAMPTZ DEFAULT NOW(),
                last_modified_by VARCHAR(100),
                last_modified_on TIMESTAMPTZ
            )
        `);
        await query(`
            ALTER TABLE billing_config
            ADD COLUMN IF NOT EXISTS rate_mode VARCHAR(20) DEFAULT 'tiered',
            ADD COLUMN IF NOT EXISTS tier1_limit NUMERIC(10, 2) DEFAULT 200.00,
            ADD COLUMN IF NOT EXISTS tier1_rate NUMERIC(10, 4) DEFAULT 3.0000,
            ADD COLUMN IF NOT EXISTS tier2_rate NUMERIC(10, 4) DEFAULT 4.2200,
            ADD COLUMN IF NOT EXISTS service_charge NUMERIC(10, 4) DEFAULT 24.6200,
            ADD COLUMN IF NOT EXISTS ft_rate NUMERIC(10, 4) DEFAULT 0.1623,
            ADD COLUMN IF NOT EXISTS vat_percent NUMERIC(5, 2) DEFAULT 7.00,
            ADD COLUMN IF NOT EXISTS created_by VARCHAR(100),
            ADD COLUMN IF NOT EXISTS last_modified_by VARCHAR(100),
            ADD COLUMN IF NOT EXISTS last_modified_on TIMESTAMPTZ
        `);
        await query(`
            INSERT INTO billing_config (
                effective_date, unit_price, rate_mode, tier1_limit,
                tier1_rate, tier2_rate, service_charge, ft_rate, vat_percent,
                description, is_active, created_by, created_on
            )
            SELECT '2026-01-01', 4.1500, 'tiered', 200.00,
                   3.0000, 4.2200, 24.6200, 0.1623, 7.00,
                   'อัตราค่าไฟฟ้ามาตรฐาน (Standard Tiered Tariff)', true, 'system', NOW()
            WHERE NOT EXISTS (SELECT 1 FROM billing_config)
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS tou_tariff_config (
                id SERIAL PRIMARY KEY,
                effective_date DATE NOT NULL,
                on_peak_rate NUMERIC(10, 4) NOT NULL DEFAULT 5.7982,
                off_peak_rate NUMERIC(10, 4) NOT NULL DEFAULT 2.6369,
                demand_rate NUMERIC(10, 4) NOT NULL DEFAULT 210.0000,
                pf_penalty_rate NUMERIC(10, 4) NOT NULL DEFAULT 56.0700,
                pf_threshold_factor NUMERIC(10, 4) NOT NULL DEFAULT 0.6197,
                service_charge NUMERIC(10, 4) NOT NULL DEFAULT 38.2200,
                ft_rate NUMERIC(10, 4) NOT NULL DEFAULT 0.1623,
                vat_percent NUMERIC(5, 2) NOT NULL DEFAULT 7.00,
                is_active BOOLEAN DEFAULT true,
                created_by VARCHAR(100),
                created_on TIMESTAMPTZ DEFAULT NOW(),
                last_modified_by VARCHAR(100),
                last_modified_on TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        await query(`
            INSERT INTO tou_tariff_config (
                effective_date, on_peak_rate, off_peak_rate, demand_rate,
                pf_penalty_rate, pf_threshold_factor, service_charge, ft_rate, vat_percent,
                is_active, created_by, created_on
            )
            SELECT '2026-01-01', 5.7982, 2.6369, 210.0000,
                   56.0700, 0.6197, 38.2200, 0.1623, 7.00,
                   true, 'system', NOW()
            WHERE NOT EXISTS (SELECT 1 FROM tou_tariff_config)
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS alarm_group (
                alarm_group_id SERIAL PRIMARY KEY,
                group_name VARCHAR(200) NOT NULL,
                email VARCHAR(200),
                telegram_token VARCHAR(500),
                telegram_chat_id VARCHAR(100),
                is_active BOOLEAN DEFAULT true,
                created_on TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        await query(`
            INSERT INTO alarm_group (group_name, email, is_active, created_on)
            SELECT 'Engineering & Facility Alert Group', 'engineering@example.com', true, NOW()
            WHERE NOT EXISTS (SELECT 1 FROM alarm_group)
        `);

        console.log('✅ Master data (Meter Types, Sub-Types, Models/Brands, Loops, Protocols, Energy Values, Tariffs) verified/initialized');
    } catch (err: any) {
        console.warn('⚠️ ensureMeterMasterData warning:', err.message);
    }
};
