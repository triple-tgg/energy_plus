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
            { typeId: 1, name: 'CHILLER', sortOrder: 4 },
            { typeId: 1, name: 'AIR', sortOrder: 5 },
            { typeId: 1, name: 'SOLAR', sortOrder: 6 },
            { typeId: 1, name: 'LIGHTING', sortOrder: 7 },
            { typeId: 1, name: 'PLUG', sortOrder: 8 },
            { typeId: 1, name: 'LIFT', sortOrder: 9 },
            { typeId: 1, name: 'OTHER', sortOrder: 10 },

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
                 SELECT $1, $2, $3, true
                 WHERE NOT EXISTS (
                     SELECT 1 FROM meter_sub_type
                     WHERE meter_type_id = $1 AND LOWER(sub_type_name) = LOWER($2)
                 )`,
                [st.typeId, st.name, st.sortOrder]
            );
        }

        // Reset meter_sub_type sequence safely
        await query(`
            SELECT setval(
                'meter_sub_type_meter_sub_type_id_seq',
                COALESCE((SELECT MAX(meter_sub_type_id) FROM meter_sub_type), 1)
            )
        `);

        console.log('✅ Meter types & sub-types verified/initialized');
    } catch (err: any) {
        console.warn('⚠️ ensureMeterMasterData warning:', err.message);
    }
};
