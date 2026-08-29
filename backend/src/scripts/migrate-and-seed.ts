import pool from '../config/database';
import bcrypt from 'bcryptjs';
import { LICENSE_CONFIG } from '../config/license.config';
import { generateLicense } from '../utils/license-generator';

async function migrateAndSeed() {
    const client = await pool.connect();

    try {
        console.log('\n🔧 Starting migration and seeding...\n');
        await client.query('BEGIN');

        // ═══════════════════════════════════════════════════════
        // 1. CREATE TABLES
        // ═══════════════════════════════════════════════════════

        console.log('📋 Creating tables...');

        // Company
        await client.query(`
      CREATE TABLE IF NOT EXISTS company (
        company_id SERIAL PRIMARY KEY,
        company_name VARCHAR(200) NOT NULL,
        address TEXT,
        contact_name VARCHAR(100),
        contact_phone VARCHAR(50),
        domain VARCHAR(200),
        logo_url VARCHAR(500),
        created_on TIMESTAMPTZ DEFAULT NOW(),
        last_modified_on TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        console.log('  ✅ company');

        // Group User
        await client.query(`
      CREATE TABLE IF NOT EXISTS group_user (
        group_id SERIAL PRIMARY KEY,
        group_name VARCHAR(100) NOT NULL,
        description VARCHAR(500),
        is_active BOOLEAN DEFAULT true,
        created_on TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        console.log('  ✅ group_user');

        // App User
        await client.query(`
      CREATE TABLE IF NOT EXISTS app_user (
        user_id SERIAL PRIMARY KEY,
        user_name VARCHAR(100) NOT NULL UNIQUE,
        display_name VARCHAR(200),
        email VARCHAR(200),
        password_hash VARCHAR(500) NOT NULL,
        group_id INTEGER REFERENCES group_user(group_id),
        is_active BOOLEAN DEFAULT true,
        role VARCHAR(20) NOT NULL DEFAULT 'viewer',
        site_access_mode VARCHAR(20) NOT NULL DEFAULT 'assigned',
        created_by VARCHAR(100),
        created_on TIMESTAMPTZ DEFAULT NOW(),
        last_modified_by VARCHAR(100),
        last_modified_on TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        console.log('  ✅ app_user');

        // User Permission
        await client.query(`
      CREATE TABLE IF NOT EXISTS user_permission (
        permission_id SERIAL PRIMARY KEY,
        group_id INTEGER REFERENCES group_user(group_id),
        permission_key VARCHAR(100) NOT NULL,
        can_view BOOLEAN DEFAULT false,
        can_create BOOLEAN DEFAULT false,
        can_edit BOOLEAN DEFAULT false,
        can_delete BOOLEAN DEFAULT false
      )
    `);
        await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_user_permission_group_key ON user_permission (group_id, permission_key)`);
        console.log('  ✅ user_permission');

        // Sites
        await client.query(`
      CREATE TABLE IF NOT EXISTS sites (
        site_id SERIAL PRIMARY KEY,
        site_name VARCHAR(200) NOT NULL,
        site_address TEXT,
        site_status BOOLEAN DEFAULT true,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        created_by VARCHAR(100),
        created_on TIMESTAMPTZ DEFAULT NOW(),
        last_modified_on TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        console.log('  ✅ sites');

        // Buildings
        await client.query(`
      CREATE TABLE IF NOT EXISTS buildings (
        building_id SERIAL PRIMARY KEY,
        building_name VARCHAR(200) NOT NULL,
        site_id INTEGER REFERENCES sites(site_id),
        is_active BOOLEAN DEFAULT true,
        created_by VARCHAR(100),
        created_on TIMESTAMPTZ DEFAULT NOW(),
        last_modified_by VARCHAR(100),
        last_modified_on TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        console.log('  ✅ buildings');

        // Zones
        await client.query(`
      CREATE TABLE IF NOT EXISTS zones (
        zone_id SERIAL PRIMARY KEY,
        zone_name VARCHAR(200) NOT NULL,
        building_id INTEGER REFERENCES buildings(building_id),
        is_show_dashboard BOOLEAN DEFAULT true,
        created_on TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        console.log('  ✅ zones');

        // Site-User mapping
        await client.query(`
      CREATE TABLE IF NOT EXISTS site_user_map (
        id SERIAL PRIMARY KEY,
        site_id INTEGER REFERENCES sites(site_id),
        user_id INTEGER REFERENCES app_user(user_id),
        UNIQUE(site_id, user_id)
      )
    `);
        console.log('  ✅ site_user_map');

        // Meter Brand
        await client.query(`
      CREATE TABLE IF NOT EXISTS meter_brand (
        meter_brand_id SERIAL PRIMARY KEY,
        meter_brand_name VARCHAR(100) NOT NULL,
        model_name VARCHAR(100),
        notes VARCHAR(500),
        is_active BOOLEAN DEFAULT true
      )
    `);
        console.log('  ✅ meter_brand');

        // Meter Type
        await client.query(`
      CREATE TABLE IF NOT EXISTS meter_type (
        meter_type_id SERIAL PRIMARY KEY,
        meter_type_name VARCHAR(100) NOT NULL,
        icon_name VARCHAR(50),
        is_active BOOLEAN DEFAULT true
      )
    `);
        console.log('  ✅ meter_type');

        // Loop
        await client.query(`
      CREATE TABLE IF NOT EXISTS loop (
        loop_id SERIAL PRIMARY KEY,
        loop_name VARCHAR(100),
        port_no INTEGER,
        baudrate INTEGER DEFAULT 9600,
        description VARCHAR(500),
        is_active BOOLEAN DEFAULT true
      )
    `);
        console.log('  ✅ loop');

        // Protocol
        await client.query(`
      CREATE TABLE IF NOT EXISTS protocol (
        protocol_id SERIAL PRIMARY KEY,
        protocol_name VARCHAR(100) NOT NULL,
        is_active BOOLEAN DEFAULT true
      )
    `);
        console.log('  ✅ protocol');

        // Energy Value types
        await client.query(`
      CREATE TABLE IF NOT EXISTS energy_value (
        energy_value_id SERIAL PRIMARY KEY,
        energy_value_name VARCHAR(100) NOT NULL,
        unit VARCHAR(20),
        column_name VARCHAR(50),
        display_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true
      )
    `);
        console.log('  ✅ energy_value');

        // Meter
        await client.query(`
      CREATE TABLE IF NOT EXISTS meter (
        meter_id SERIAL PRIMARY KEY,
        meter_code VARCHAR(50),
        meter_name VARCHAR(200) NOT NULL,
        address INTEGER,
        meter_brand_id INTEGER REFERENCES meter_brand(meter_brand_id),
        meter_type_id INTEGER REFERENCES meter_type(meter_type_id),
        loop_id INTEGER REFERENCES loop(loop_id),
        site_id INTEGER REFERENCES sites(site_id),
        building_id INTEGER REFERENCES buildings(building_id),
        zone_id INTEGER REFERENCES zones(zone_id),
        protocol_id INTEGER REFERENCES protocol(protocol_id),
        ip_address VARCHAR(50),
        port_number INTEGER,
        room_code VARCHAR(100),
        room_name VARCHAR(200),
        site VARCHAR(200),
        site_el INTEGER,
        phase VARCHAR(20),
        circuit VARCHAR(100),
        floor INTEGER,
        parent_meter_id INTEGER REFERENCES meter(meter_id),
        is_active BOOLEAN DEFAULT true,
        status VARCHAR(50) DEFAULT 'Manual',
        created_by VARCHAR(100),
        created_on TIMESTAMPTZ DEFAULT NOW(),
        last_modified_on TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        console.log('  ✅ meter');

        // Add columns that may be missing from older deployments
        await client.query(`ALTER TABLE meter ADD COLUMN IF NOT EXISTS phase VARCHAR(20)`);
        await client.query(`ALTER TABLE meter ADD COLUMN IF NOT EXISTS circuit VARCHAR(100)`);
        await client.query(`ALTER TABLE meter ADD COLUMN IF NOT EXISTS floor INTEGER`);

        // Actual Meter Data (15-min snapshot history)
        await client.query(`
      CREATE TABLE IF NOT EXISTS actual_meter_data (
        id SERIAL PRIMARY KEY,
        meter_id INTEGER REFERENCES meter(meter_id),
        date_keep TIMESTAMPTZ NOT NULL,
        energy_kva DECIMAL(18,2) DEFAULT 0,
        energy_kw DECIMAL(18,2) DEFAULT 0,
        energy_kvar DECIMAL(18,2) DEFAULT 0,
        energy_frequency DECIMAL(10,2) DEFAULT 0,
        energy_volt_p1 DECIMAL(10,2) DEFAULT 0,
        energy_volt_p2 DECIMAL(10,2) DEFAULT 0,
        energy_volt_p3 DECIMAL(10,2) DEFAULT 0,
        energy_volt_l1 DECIMAL(10,2) DEFAULT 0,
        energy_volt_l2 DECIMAL(10,2) DEFAULT 0,
        energy_volt_l3 DECIMAL(10,2) DEFAULT 0,
        energy_amp1 DECIMAL(10,2) DEFAULT 0,
        energy_amp2 DECIMAL(10,2) DEFAULT 0,
        energy_amp3 DECIMAL(10,2) DEFAULT 0,
        energy_pf1 DECIMAL(10,4) DEFAULT 0,
        energy_pf2 DECIMAL(10,4) DEFAULT 0,
        energy_pf3 DECIMAL(10,4) DEFAULT 0,
        energy_thd_v1 DECIMAL(10,2) DEFAULT 0,
        energy_thd_a1 DECIMAL(10,2) DEFAULT 0,
        energy_kwh DECIMAL(18,2) DEFAULT 0,
        water_value DECIMAL(18,2),
        gas_value DECIMAL(18,2),
        status VARCHAR(50) DEFAULT 'online'
      )
    `);
        console.log('  ✅ actual_meter_data');

        // Actual Meter Data Daily
        await client.query(`
      CREATE TABLE IF NOT EXISTS actual_meter_data_daily (
        id SERIAL PRIMARY KEY,
        meter_id INTEGER REFERENCES meter(meter_id),
        date_keep DATE NOT NULL,
        total_kwh DECIMAL(18,2) DEFAULT 0,
        max_kw DECIMAL(18,2) DEFAULT 0,
        min_kw DECIMAL(18,2) DEFAULT 0,
        avg_kw DECIMAL(18,2) DEFAULT 0,
        total_water DECIMAL(18,2),
        total_gas DECIMAL(18,2),
        CONSTRAINT uq_actual_meter_data_daily_meter_date UNIQUE(meter_id, date_keep)
      )
    `);
        console.log('  ✅ actual_meter_data_daily');

        // Actual Meter Data Monthly
        await client.query(`
      CREATE TABLE IF NOT EXISTS actual_meter_data_monthly (
        id SERIAL PRIMARY KEY,
        meter_id INTEGER REFERENCES meter(meter_id),
        year_month VARCHAR(7) NOT NULL,
        total_kwh DECIMAL(18,2) DEFAULT 0,
        max_kw DECIMAL(18,2) DEFAULT 0,
        avg_kw DECIMAL(18,2) DEFAULT 0,
        total_water DECIMAL(18,2),
        total_gas DECIMAL(18,2),
        CONSTRAINT uq_actual_meter_data_monthly_meter_month UNIQUE(meter_id, year_month)
      )
    `);
        console.log('  ✅ actual_meter_data_monthly');

        // Meter Data Realtime (streamed from Redis)
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
        await client.query(`CREATE INDEX IF NOT EXISTS idx_meter_realtime_site_address ON meter_data_realtime (site_id, address_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_meter_realtime_channel ON meter_data_realtime (channel)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_meter_realtime_received_at ON meter_data_realtime (received_at DESC)`);
        console.log('  ✅ meter_data_realtime');

        // Realtime Meter Map
        await client.query(`
      CREATE TABLE IF NOT EXISTS realtime_meter_map (
        id SERIAL PRIMARY KEY,
        channel VARCHAR(100),
        realtime_site_id INTEGER NOT NULL,
        realtime_address_id INTEGER NOT NULL,
        meter_id INTEGER NOT NULL REFERENCES meter(meter_id),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_realtime_meter_map_active
      ON realtime_meter_map (
        COALESCE(channel, ''),
        realtime_site_id,
        realtime_address_id
      )
      WHERE is_active = true
    `);
        console.log('  ✅ realtime_meter_map');

        // Aggregation Job Runs
        await client.query(`
      CREATE TABLE IF NOT EXISTS aggregation_job_runs (
        id BIGSERIAL PRIMARY KEY,
        job_name VARCHAR(100) NOT NULL,
        bucket_start TIMESTAMPTZ,
        bucket_end TIMESTAMPTZ,
        records_processed INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'success',
        message TEXT,
        run_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        console.log('  ✅ aggregation_job_runs');

        // Alarm Group
        await client.query(`
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
        console.log('  ✅ alarm_group');

        // Alarm Config
        await client.query(`
      CREATE TABLE IF NOT EXISTS alarm_config (
        alarm_config_id SERIAL PRIMARY KEY,
        meter_id INTEGER REFERENCES meter(meter_id),
        energy_value_id INTEGER REFERENCES energy_value(energy_value_id),
        lower_value DECIMAL(18,2),
        higher_value DECIMAL(18,2),
        lower_message TEXT,
        higher_message TEXT,
        is_active BOOLEAN DEFAULT true,
        alarm_group_id INTEGER REFERENCES alarm_group(alarm_group_id),
        created_on TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        console.log('  ✅ alarm_config');

        // Alarm Group Mapping
        await client.query(`
      CREATE TABLE IF NOT EXISTS alarm_group_mapping (
        id SERIAL PRIMARY KEY,
        alarm_group_id INTEGER REFERENCES alarm_group(alarm_group_id),
        meter_id INTEGER REFERENCES meter(meter_id)
      )
    `);
        console.log('  ✅ alarm_group_mapping');

        // Alarm Log
        await client.query(`
      CREATE TABLE IF NOT EXISTS alarm_log (
        id BIGSERIAL PRIMARY KEY,
        alarm_config_id INTEGER REFERENCES alarm_config(alarm_config_id),
        meter_id INTEGER REFERENCES meter(meter_id),
        alarm_type VARCHAR(100),
        message TEXT NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        acknowledged BOOLEAN NOT NULL DEFAULT false,
        acknowledged_at TIMESTAMPTZ,
        acknowledged_by VARCHAR(255),
        resolved_at TIMESTAMPTZ,
        resolved_by VARCHAR(255),
        metadata JSONB
      )
    `);
        console.log('  ✅ alarm_log');

        // Billing Config
        await client.query(`
      CREATE TABLE IF NOT EXISTS billing_config (
        id SERIAL PRIMARY KEY,
        effective_date DATE NOT NULL,
        unit_price DECIMAL(10,4) NOT NULL,
        description VARCHAR(500),
        is_active BOOLEAN DEFAULT true,
        created_on TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        console.log('  ✅ billing_config');

        // Demand Peak Config
        await client.query(`
      CREATE TABLE IF NOT EXISTS demand_peak_config (
        config_id SERIAL PRIMARY KEY,
        display_name VARCHAR(200) NOT NULL,
        warning_setpoint DECIMAL(18,2) DEFAULT 0,
        peak_setpoint DECIMAL(18,2) DEFAULT 0,
        saving_rate DECIMAL(10,4) DEFAULT 0,
        flat_rate DECIMAL(10,4) DEFAULT 0,
        tou DECIMAL(10,4) DEFAULT 0,
        saving_target DECIMAL(18,2) DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_on TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        console.log('  ✅ demand_peak_config');

        // Demand Meter Config
        await client.query(`
      CREATE TABLE IF NOT EXISTS demand_meter_config (
        id SERIAL PRIMARY KEY,
        config_id INTEGER REFERENCES demand_peak_config(config_id),
        meter_id INTEGER REFERENCES meter(meter_id)
      )
    `);
        console.log('  ✅ demand_meter_config');

        // Demand Peak Data
        await client.query(`
      CREATE TABLE IF NOT EXISTS demand_peak_data (
        id SERIAL PRIMARY KEY,
        config_id INTEGER REFERENCES demand_peak_config(config_id),
        date_keep TIMESTAMPTZ NOT NULL,
        demand_kw DECIMAL(18,2) DEFAULT 0,
        is_peak BOOLEAN DEFAULT false
      )
    `);
        console.log('  ✅ demand_peak_data');

        // Energy Daily Usage
        await client.query(`
      CREATE TABLE IF NOT EXISTS energy_daily_usage (
        id SERIAL PRIMARY KEY,
        meter_id INTEGER REFERENCES meter(meter_id),
        usage_date DATE NOT NULL,
        start_kwh DECIMAL(18,2) DEFAULT 0,
        end_kwh DECIMAL(18,2) DEFAULT 0,
        usage_kwh DECIMAL(18,2) DEFAULT 0,
        unit_price DECIMAL(10,4),
        amount DECIMAL(18,2)
      )
    `);
        console.log('  ✅ energy_daily_usage');

        // Energy Save
        await client.query(`
      CREATE TABLE IF NOT EXISTS energy_save (
        id SERIAL PRIMARY KEY,
        config_id INTEGER REFERENCES demand_peak_config(config_id),
        save_date DATE NOT NULL,
        target_kwh DECIMAL(18,2) DEFAULT 0,
        actual_kwh DECIMAL(18,2) DEFAULT 0,
        saving_kwh DECIMAL(18,2) DEFAULT 0,
        saving_percent DECIMAL(10,2) DEFAULT 0
      )
    `);
        console.log('  ✅ energy_save');

        // Saving Meter Config
        await client.query(`
      CREATE TABLE IF NOT EXISTS saving_meter_config (
        id SERIAL PRIMARY KEY,
        config_id INTEGER REFERENCES demand_peak_config(config_id),
        meter_id INTEGER REFERENCES meter(meter_id),
        baseline_kwh DECIMAL(18,2) DEFAULT 0
      )
    `);
        console.log('  ✅ saving_meter_config');

        // Audit Logs
        await client.query(`
      CREATE TABLE IF NOT EXISTS auditlogs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        user_name VARCHAR(100),
        action VARCHAR(50),
        entity_type VARCHAR(100),
        entity_id VARCHAR(50),
        old_values JSONB,
        new_values JSONB,
        ip_address VARCHAR(50),
        created_on TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        console.log('  ✅ auditlogs');

        // Write Log
        await client.query(`
      CREATE TABLE IF NOT EXISTS write_log (
        id SERIAL PRIMARY KEY,
        meter_id INTEGER,
        log_message TEXT,
        log_type VARCHAR(50),
        created_on TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        console.log('  ✅ write_log');

        // Refresh Tokens
        await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES app_user(user_id),
        token VARCHAR(500) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        console.log('  ✅ refresh_tokens');

        // Layouts
        await client.query(`
      CREATE TABLE IF NOT EXISTS layouts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        image_name VARCHAR(255),
        image_url TEXT,
        position VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        console.log('  ✅ layouts');

        // Layout Points
        await client.query(`
      CREATE TABLE IF NOT EXISTS layout_points (
        id SERIAL PRIMARY KEY,
        layout_id INTEGER REFERENCES layouts(id) ON DELETE CASCADE,
        point_type VARCHAR(50) NOT NULL,
        label VARCHAR(200),
        x_percent DECIMAL(8,4) NOT NULL,
        y_percent DECIMAL(8,4) NOT NULL,
        meter_id INTEGER REFERENCES meter(meter_id),
        config JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        console.log('  ✅ layout_points');

        // System License (Cryptographic Meter License)
        await client.query(`
      CREATE TABLE IF NOT EXISTS system_license (
        id SERIAL PRIMARY KEY,
        license_key TEXT NOT NULL,
        customer_name VARCHAR(200),
        license_type VARCHAR(100) DEFAULT 'Enterprise',
        max_meters INTEGER NOT NULL DEFAULT 50,
        features JSONB DEFAULT '[]',
        issued_date TIMESTAMPTZ,
        expiry_date TIMESTAMPTZ,
        is_valid BOOLEAN DEFAULT true,
        last_verified_on TIMESTAMPTZ DEFAULT NOW(),
        created_on TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        console.log('  ✅ system_license');

        // ═══════════════════════════════════════════════════════
        // 2. SEED DATA (Minimal — production-ready for customer)
        // ═══════════════════════════════════════════════════════

        console.log('\n📦 Seeding essential data...\n');

        // --- Company ---
        await client.query(`
      INSERT INTO company (company_id, company_name, address, contact_name, contact_phone, domain)
      VALUES (1, 'Wanwanach', '', 'Admin', '', '')
      ON CONFLICT (company_id) DO NOTHING
    `);
        console.log('  ✅ company');

        // --- User Groups ---
        const groups = [
            { id: 1, name: 'Administrator', desc: 'Full access to all features' },
            { id: 2, name: 'Technician', desc: 'Access to monitoring, meters, and alarms' },
            { id: 3, name: 'Tenant Service', desc: 'View monitoring and billing' },
            { id: 4, name: 'User', desc: 'Basic view access' },
            { id: 5, name: 'View', desc: 'Dashboard view only' },
            { id: 6, name: 'Guest', desc: 'Limited guest access' },
        ];
        for (const g of groups) {
            await client.query(
                `INSERT INTO group_user (group_id, group_name, description) VALUES ($1, $2, $3)
                 ON CONFLICT (group_id) DO UPDATE SET group_name = $2, description = $3`,
                [g.id, g.name, g.desc]
            );
        }
        console.log('  ✅ group_user (6 groups)');

        // --- Users (admin only) ---
        const passwordHash = await bcrypt.hash('admin123', 12);
        await client.query(
            `INSERT INTO app_user (user_name, display_name, email, password_hash, group_id, role, site_access_mode, created_by)
             VALUES ('admin', 'Administrator', '', $1, 1, 'admin', 'all', 'system')
             ON CONFLICT (user_name) DO UPDATE SET
               display_name = 'Administrator',
               group_id = 1,
               role = 'admin',
               site_access_mode = 'all',
               is_active = true`,
            [passwordHash]
        );
        console.log('  ✅ app_user (admin)');

        // --- Meter Brands (reference data) ---
        const brands = [
            { id: 1, name: 'Siemens', model: 'AB5478' },
            { id: 2, name: 'Schneider Electric', model: 'PM5110' },
            { id: 3, name: 'ABB', model: 'M4M 30' },
            { id: 4, name: 'Socomec', model: 'DIRIS A40' },
            { id: 5, name: 'Hioki', model: 'PW3365' },
            { id: 6, name: 'CET', model: 'PMC-53A' },
            { id: 7, name: 'CHINT', model: 'DTSU666' },
            { id: 8, name: 'Eastron', model: 'SDM630' },
        ];
        for (const b of brands) {
            await client.query(
                `INSERT INTO meter_brand (meter_brand_id, meter_brand_name, model_name) VALUES ($1, $2, $3)
                 ON CONFLICT (meter_brand_id) DO UPDATE SET meter_brand_name = $2, model_name = $3`,
                [b.id, b.name, b.model]
            );
        }
        await client.query(`SELECT setval('meter_brand_meter_brand_id_seq', (SELECT GREATEST(MAX(meter_brand_id), 8) FROM meter_brand))`);
        console.log('  ✅ meter_brand (8 brands)');

        // --- Meter Types (reference data) ---
        const types = [
            { id: 1, name: 'ไฟฟ้า', icon: 'fa fa-bolt' },
            { id: 2, name: 'น้ำ', icon: 'fa fa-tint' },
            { id: 3, name: 'แก๊ส', icon: 'fa fa-fire' },
        ];
        for (const t of types) {
            await client.query(
                `INSERT INTO meter_type (meter_type_id, meter_type_name, icon_name) VALUES ($1, $2, $3)
                 ON CONFLICT (meter_type_id) DO UPDATE SET meter_type_name = $2, icon_name = $3`,
                [t.id, t.name, t.icon]
            );
        }
        await client.query(`SELECT setval('meter_type_meter_type_id_seq', (SELECT GREATEST(MAX(meter_type_id), 3) FROM meter_type))`);
        console.log('  ✅ meter_type (3 types)');

        // --- Protocols (reference data) ---
        const protocols = [
            { id: 1, name: 'Modbus RTU' },
            { id: 2, name: 'Modbus TCP' },
            { id: 3, name: 'BACnet' },
        ];
        for (const p of protocols) {
            await client.query(
                `INSERT INTO protocol (protocol_id, protocol_name) VALUES ($1, $2)
                 ON CONFLICT (protocol_id) DO UPDATE SET protocol_name = $2`,
                [p.id, p.name]
            );
        }
        await client.query(`SELECT setval('protocol_protocol_id_seq', (SELECT GREATEST(MAX(protocol_id), 3) FROM protocol))`);
        console.log('  ✅ protocol (3 protocols)');

        // --- Energy Values (reference data) ---
        const energyValues = [
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
        for (const ev of energyValues) {
            await client.query(
                `INSERT INTO energy_value (energy_value_id, energy_value_name, unit, column_name, display_order) VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (energy_value_id) DO UPDATE SET energy_value_name = $2, unit = $3, column_name = $4, display_order = $5`,
                [ev.id, ev.name, ev.unit, ev.col, ev.order]
            );
        }
        await client.query(`SELECT setval('energy_value_energy_value_id_seq', (SELECT GREATEST(MAX(energy_value_id), 21) FROM energy_value))`);
        console.log('  ✅ energy_value (21 types)');

        // --- User Permissions ---
        const allModules = ['dashboard', 'monitoring', 'meters', 'alarms', 'users', 'billing', 'reports', 'settings', 'company', 'sites'];

        // Admin = full access
        for (const mod of allModules) {
            await client.query(
                `INSERT INTO user_permission (group_id, permission_key, can_view, can_create, can_edit, can_delete)
                 VALUES (1, $1, true, true, true, true)
                 ON CONFLICT (group_id, permission_key) DO UPDATE SET can_view = true, can_create = true, can_edit = true, can_delete = true`,
                [mod]
            );
        }
        // Technician = monitor + create/edit
        for (const mod of ['dashboard', 'monitoring', 'meters', 'alarms', 'reports']) {
            await client.query(
                `INSERT INTO user_permission (group_id, permission_key, can_view, can_create, can_edit, can_delete)
                 VALUES (2, $1, true, true, true, false)
                 ON CONFLICT (group_id, permission_key) DO UPDATE SET can_view = true, can_create = true, can_edit = true, can_delete = false`,
                [mod]
            );
        }
        // Tenant Service = view billing + reports
        for (const mod of ['dashboard', 'monitoring', 'billing', 'reports']) {
            await client.query(
                `INSERT INTO user_permission (group_id, permission_key, can_view, can_create, can_edit, can_delete)
                 VALUES (3, $1, true, false, false, false)
                 ON CONFLICT (group_id, permission_key) DO UPDATE SET can_view = true, can_create = false, can_edit = false, can_delete = false`,
                [mod]
            );
        }
        // User = view dashboard, monitoring, reports
        for (const mod of ['dashboard', 'monitoring', 'reports']) {
            await client.query(
                `INSERT INTO user_permission (group_id, permission_key, can_view, can_create, can_edit, can_delete)
                 VALUES (4, $1, true, false, false, false)
                 ON CONFLICT (group_id, permission_key) DO UPDATE SET can_view = true, can_create = false, can_edit = false, can_delete = false`,
                [mod]
            );
        }
        // View = view all main screens
        for (const mod of ['dashboard', 'monitoring', 'reports', 'meters', 'alarms', 'company', 'sites', 'billing', 'settings']) {
            await client.query(
                `INSERT INTO user_permission (group_id, permission_key, can_view, can_create, can_edit, can_delete)
                 VALUES (5, $1, true, false, false, false)
                 ON CONFLICT (group_id, permission_key) DO UPDATE SET can_view = true, can_create = false, can_edit = false, can_delete = false`,
                [mod]
            );
        }
        console.log('  ✅ user_permission');

        // --- System License ---
        // Try to generate a cryptographically signed license.
        // On production the private key is intentionally absent, so we
        // fall back to seeding an unsigned record from config defaults.
        let licenseKey = 'BUILTIN-DEFAULT';
        let licensePayload: {
            customerName: string;
            licenseType?: string;
            maxMeters: number;
            issuedDate: string;
            expiryDate: string | null;
            features?: string[];
        } = {
            customerName: LICENSE_CONFIG.DEFAULT_LICENSE.customerName,
            licenseType: LICENSE_CONFIG.DEFAULT_LICENSE.licenseType,
            maxMeters: LICENSE_CONFIG.DEFAULT_LICENSE.maxMeters,
            issuedDate: new Date().toISOString(),
            expiryDate: null,
            features: LICENSE_CONFIG.DEFAULT_LICENSE.features,
        };

        try {
            const signed = generateLicense(LICENSE_CONFIG.DEFAULT_LICENSE);
            licenseKey = signed.licenseKey;
            licensePayload = signed.payload;
            console.log('  🔑 License signed with private key');
        } catch (_e) {
            console.log('  ⚠️  LICENSE_PRIVATE_KEY not set — seeding unsigned default license');
        }

        await client.query(
            `INSERT INTO system_license (id, license_key, customer_name, license_type, max_meters, features, issued_date, expiry_date, is_valid, last_verified_on, created_on)
             VALUES (1, $1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
             ON CONFLICT (id) DO UPDATE SET
               customer_name = EXCLUDED.customer_name,
               license_type = EXCLUDED.license_type,
               max_meters = EXCLUDED.max_meters,
               features = EXCLUDED.features,
               is_valid = true`,
            [
                licenseKey,
                licensePayload.customerName,
                licensePayload.licenseType,
                licensePayload.maxMeters,
                JSON.stringify(licensePayload.features),
                licensePayload.issuedDate,
                licensePayload.expiryDate
            ]
        );
        await client.query(`SELECT setval('system_license_id_seq', (SELECT GREATEST(MAX(id), 1) FROM system_license))`);
        console.log('  ✅ system_license (Wanwanach 5-meter License)');

        await client.query('COMMIT');

        console.log('\n✅ Migration and seeding completed successfully!\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('  📌 Login:');
        console.log('     Admin:   admin / admin123');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

migrateAndSeed();
