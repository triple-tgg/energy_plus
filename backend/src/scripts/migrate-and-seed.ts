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
        parent_meter_id INTEGER REFERENCES meter(meter_id),
        is_active BOOLEAN DEFAULT true,
        status VARCHAR(50) DEFAULT 'Manual',
        created_by VARCHAR(100),
        created_on TIMESTAMPTZ DEFAULT NOW(),
        last_modified_on TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        console.log('  ✅ meter');

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
        // 2. SEED DATA
        // ═══════════════════════════════════════════════════════

        console.log('\n📦 Seeding sample data...\n');

        // --- Company ---
        await client.query(`
      INSERT INTO company (company_id, company_name, address, contact_name, contact_phone, domain)
      VALUES (1, 'บริษัท กลุ่มเคอี จำกัด', '111 ถ.พหลโยธิน แขวงจตุจักร เขตจตุจักร กรุงเทพฯ 10900', 'Admin', '02-123-4567', 'energyplus.kegroup.co.th')
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

        // --- Users ---
        const passwordHash = await bcrypt.hash('admin123', 12);
        const viewallHash = await bcrypt.hash('viewall123', 12);
        const users = [
            { username: 'admin', display: 'ผู้ดูแลระบบ', email: 'admin@kegroup.co.th', group: 1, pass: passwordHash, role: 'admin', mode: 'all' },
            { username: 'technician1', display: 'ช่างเทคนิค 1', email: 'tech1@kegroup.co.th', group: 2, pass: passwordHash, role: 'viewer', mode: 'assigned' },
            { username: 'tenant1', display: 'ผู้เช่า 1', email: 'tenant1@kegroup.co.th', group: 3, pass: passwordHash, role: 'viewer', mode: 'assigned' },
            { username: 'user1', display: 'ผู้ใช้งาน 1', email: 'user1@kegroup.co.th', group: 4, pass: passwordHash, role: 'viewer', mode: 'assigned' },
            { username: 'viewer', display: 'ผู้ดูอย่างเดียว', email: 'viewer@kegroup.co.th', group: 5, pass: passwordHash, role: 'viewer', mode: 'assigned' },
            { username: 'viewall', display: 'ผู้ดูทั้งหมด (View All)', email: 'viewall@kegroup.co.th', group: 5, pass: viewallHash, role: 'viewer', mode: 'all' },
        ];
        for (const u of users) {
            await client.query(
                `INSERT INTO app_user (user_name, display_name, email, password_hash, group_id, role, site_access_mode, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 'system')
                 ON CONFLICT (user_name) DO UPDATE SET
                   display_name = $2,
                   email = $3,
                   group_id = $5,
                   role = $6,
                   site_access_mode = $7,
                   is_active = true`,
                [u.username, u.display, u.email, u.pass, u.group, u.role, u.mode]
            );
        }
        console.log('  ✅ app_user (6 users: admin, technician1, tenant1, user1, viewer, viewall)');

        // --- Sites (Sites 1-3 & Sites 1000-1002 from Redis telemetry) ---
        const sitesData = [
            { id: 1, name: '111PMT', address: '111 ถ.พหลโยธิน แขวงจตุจักร เขตจตุจักร กรุงเทพฯ 10900' },
            { id: 2, name: 'CDC Crystal Design Center', address: '1420 ถ.ประดิษฐ์มนูธรรม แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพฯ 10230' },
            { id: 3, name: 'KE Factory', address: '99 หมู่ 3 ถ.บางนา-ตราด สมุทรปราการ 10270' },
            { id: 1000, name: 'Site 1000 - Main', address: null },
            { id: 1001, name: 'Site 1001 - PMT', address: null },
            { id: 1002, name: 'Site 1002 - New Site', address: null },
        ];
        for (const s of sitesData) {
            await client.query(
                `INSERT INTO sites (site_id, site_name, site_address, site_status) VALUES ($1, $2, $3, true)
                 ON CONFLICT (site_id) DO UPDATE SET site_name = $2, site_address = $3, site_status = true`,
                [s.id, s.name, s.address]
            );
        }
        await client.query(`SELECT setval('sites_site_id_seq', (SELECT GREATEST(MAX(site_id), 3) FROM sites))`);
        console.log('  ✅ sites (6 sites: 111PMT, CDC, Factory, Site 1000, Site 1001, Site 1002)');

        // --- Buildings ---
        const buildingsData = [
            { id: 1, name: '111PMT_Building A', site: 1 },
            { id: 2, name: '111PMT_Building B', site: 1 },
            { id: 3, name: 'CDC_CP2', site: 2 },
            { id: 4, name: 'CDC_CP3', site: 2 },
            { id: 5, name: 'Factory_Main', site: 3 },
            { id: 6, name: 'Building 1002', site: 1002 },
        ];
        for (const b of buildingsData) {
            await client.query(
                `INSERT INTO buildings (building_id, building_name, site_id, is_active, created_by) VALUES ($1, $2, $3, true, 'system')
                 ON CONFLICT (building_id) DO UPDATE SET building_name = $2, site_id = $3, is_active = true`,
                [b.id, b.name, b.site]
            );
        }
        await client.query(`SELECT setval('buildings_building_id_seq', (SELECT GREATEST(MAX(building_id), 6) FROM buildings))`);
        console.log('  ✅ buildings (6 buildings)');

        // --- Zones ---
        const zonesData = [
            { id: 1, name: 'พลาซ่า', building: 1, show: true },
            { id: 2, name: 'สำนักงาน ชั้น 1', building: 1, show: true },
            { id: 3, name: 'สำนักงาน ชั้น 2', building: 1, show: true },
            { id: 4, name: 'ห้องเครื่อง', building: 2, show: false },
            { id: 5, name: 'ที่จอดรถ', building: 2, show: true },
            { id: 6, name: 'CDC-DB1-TOU1 (B)', building: 3, show: true },
            { id: 7, name: 'CDC-DB1-TOU2 (C)', building: 3, show: true },
            { id: 8, name: 'CDC-DB1-TOU3 (D)', building: 3, show: true },
            { id: 9, name: 'CDC-DB2 MDB1', building: 4, show: true },
            { id: 10, name: 'CDC-DB2 MDB2', building: 4, show: true },
            { id: 11, name: 'Factory Zone A', building: 5, show: true },
            { id: 12, name: 'Factory Zone B', building: 5, show: true },
        ];
        for (const z of zonesData) {
            await client.query(
                `INSERT INTO zones (zone_id, zone_name, building_id, is_show_dashboard) VALUES ($1, $2, $3, $4)
                 ON CONFLICT (zone_id) DO UPDATE SET zone_name = $2, building_id = $3, is_show_dashboard = $4`,
                [z.id, z.name, z.building, z.show]
            );
        }
        await client.query(`SELECT setval('zones_zone_id_seq', (SELECT GREATEST(MAX(zone_id), 12) FROM zones))`);
        console.log('  ✅ zones (12 zones)');

        // --- Meter Brands ---
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

        // --- Meter Types ---
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

        // --- Loops ---
        const loops = [
            { id: 1, name: 'Loop 1', port: 1, baud: 9600 },
            { id: 2, name: 'Loop 2', port: 2, baud: 9600 },
            { id: 3, name: 'Loop 3', port: 3, baud: 9600 },
            { id: 4, name: 'Loop 4', port: 4, baud: 19200 },
            { id: 5, name: 'Loop 5', port: 5, baud: 9600 },
            { id: 6, name: 'Loop 6', port: 6, baud: 9600 },
            { id: 7, name: 'Loop 7', port: 7, baud: 9600 },
            { id: 8, name: 'Loop 8', port: 8, baud: 19200 },
        ];
        for (const l of loops) {
            await client.query(
                `INSERT INTO loop (loop_id, loop_name, port_no, baudrate) VALUES ($1, $2, $3, $4)
                 ON CONFLICT (loop_id) DO UPDATE SET loop_name = $2, port_no = $3, baudrate = $4`,
                [l.id, l.name, l.port, l.baud]
            );
        }
        await client.query(`SELECT setval('loop_loop_id_seq', (SELECT GREATEST(MAX(loop_id), 8) FROM loop))`);
        console.log('  ✅ loop (8 loops)');

        // --- Protocols ---
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

        // --- Energy Values ---
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

        // --- Meters (All 26 meters: 1-15 demo + 16-26 Redis live channels) ---
        const metersData = [
            // Standard meters
            { id: 1, code: '0206213159', name: 'Main MDB L1 (L1-L4)', addr: 1, brand: 1, type: 1, loop: 1, site: 1, building: 1, zone: 1, room_code: 'Main MDB-L1', room_name: 'Common', site_el: null, status: 'Manual' },
            { id: 2, code: '0206213160', name: 'Main MDB L2', addr: 2, brand: 1, type: 1, loop: 1, site: 1, building: 1, zone: 1, room_code: 'Main MDB-L2', room_name: 'Common', site_el: null, status: 'Manual' },
            { id: 3, code: '0206213161', name: 'Sub MDB A1', addr: 3, brand: 2, type: 1, loop: 2, site: 1, building: 1, zone: 2, room_code: 'Sub-A1', room_name: 'Office 1F', site_el: null, status: 'Manual' },
            { id: 4, code: '0206213162', name: 'Sub MDB A2', addr: 4, brand: 2, type: 1, loop: 2, site: 1, building: 1, zone: 3, room_code: 'Sub-A2', room_name: 'Office 2F', site_el: null, status: 'Manual' },
            { id: 5, code: '0206213163', name: 'MDB Parking', addr: 5, brand: 3, type: 1, loop: 3, site: 1, building: 2, zone: 5, room_code: 'MDB-PK', room_name: 'Parking', site_el: null, status: 'Manual' },
            { id: 6, code: 'CDC001', name: 'CDC MDB-1 TOU1', addr: 1, brand: 4, type: 1, loop: 4, site: 2, building: 3, zone: 6, room_code: 'CDC-MDB1', room_name: 'TOU1', site_el: null, status: 'Manual' },
            { id: 7, code: 'CDC002', name: 'CDC MDB-1 TOU2', addr: 2, brand: 4, type: 1, loop: 4, site: 2, building: 3, zone: 7, room_code: 'CDC-MDB2', room_name: 'TOU2', site_el: null, status: 'Manual' },
            { id: 8, code: 'CDC003', name: 'CDC MDB-1 TOU3', addr: 3, brand: 4, type: 1, loop: 4, site: 2, building: 3, zone: 8, room_code: 'CDC-MDB3', room_name: 'TOU3', site_el: null, status: 'Manual' },
            { id: 9, code: 'CDC004', name: 'CDC DB2 MDB1', addr: 4, brand: 5, type: 1, loop: 5, site: 2, building: 4, zone: 9, room_code: 'CDC-DB2-1', room_name: 'MDB1', site_el: null, status: 'Manual' },
            { id: 10, code: 'CDC005', name: 'CDC DB2 MDB2', addr: 5, brand: 5, type: 1, loop: 5, site: 2, building: 4, zone: 10, room_code: 'CDC-DB2-2', room_name: 'MDB2', site_el: null, status: 'Manual' },
            { id: 11, code: 'FAC001', name: 'Factory Main MDB', addr: 1, brand: 6, type: 1, loop: 6, site: 3, building: 5, zone: 11, room_code: 'FAC-MAIN', room_name: 'Main', site_el: null, status: 'Manual' },
            { id: 12, code: 'FAC002', name: 'Factory Line A', addr: 2, brand: 6, type: 1, loop: 6, site: 3, building: 5, zone: 11, room_code: 'FAC-A', room_name: 'Line A', site_el: null, status: 'Manual' },
            { id: 13, code: 'FAC003', name: 'Factory Line B', addr: 3, brand: 7, type: 1, loop: 7, site: 3, building: 5, zone: 12, room_code: 'FAC-B', room_name: 'Line B', site_el: null, status: 'Manual' },
            { id: 14, code: 'WATER001', name: 'Water Meter Main', addr: 1, brand: 8, type: 2, loop: 8, site: 1, building: 1, zone: 1, room_code: 'WTR-MAIN', room_name: 'Water', site_el: null, status: 'Manual' },
            { id: 15, code: 'WATER002', name: 'Water Meter CDC', addr: 2, brand: 8, type: 2, loop: 8, site: 2, building: 3, zone: 6, room_code: 'WTR-CDC', room_name: 'Water CDC', site_el: null, status: 'Manual' },

            // Redis Live Telemetry Meters
            { id: 16, code: '1002_1', name: 'Meter 1002_1', addr: 1, brand: null, type: 1, loop: null, site: 1002, building: 6, zone: null, room_code: null, room_name: null, site_el: 1002, status: 'online' },
            { id: 17, code: '1000_1', name: 'Meter 1000_1', addr: 1, brand: null, type: 1, loop: null, site: 1000, building: 6, zone: null, room_code: null, room_name: null, site_el: 1000, status: 'online' },
            { id: 18, code: '1000_2', name: 'Meter 1000_2', addr: 2, brand: null, type: 1, loop: null, site: 1000, building: 6, zone: null, room_code: null, room_name: null, site_el: 1000, status: 'online' },
            { id: 19, code: '1000_3', name: 'Meter 1000_3', addr: 3, brand: null, type: 1, loop: null, site: 1000, building: 6, zone: null, room_code: null, room_name: null, site_el: 1000, status: 'online' },
            { id: 20, code: '1000_4', name: 'Meter 1000_4', addr: 4, brand: null, type: 1, loop: null, site: 1000, building: 6, zone: null, room_code: null, room_name: null, site_el: 1000, status: 'online' },
            { id: 21, code: '1001_2', name: 'Meter 1001_2', addr: 2, brand: null, type: 1, loop: null, site: 1001, building: 6, zone: null, room_code: null, room_name: null, site_el: 1001, status: 'online' },
            { id: 22, code: '1001_3', name: 'Meter 1001_3', addr: 3, brand: null, type: 1, loop: null, site: 1001, building: 6, zone: null, room_code: null, room_name: null, site_el: 1001, status: 'online' },
            { id: 23, code: '1001_4', name: 'Meter 1001_4', addr: 4, brand: null, type: 1, loop: null, site: 1001, building: 6, zone: null, room_code: null, room_name: null, site_el: 1001, status: 'online' },
            { id: 24, code: '1001_50', name: 'Meter 1001_50', addr: 50, brand: null, type: 1, loop: null, site: 1001, building: 6, zone: null, room_code: null, room_name: null, site_el: 1001, status: 'online' },
            { id: 25, code: '1001_69', name: 'Meter 1001_69', addr: 69, brand: null, type: 1, loop: null, site: 1001, building: 6, zone: null, room_code: null, room_name: null, site_el: 1001, status: 'online' },
            { id: 26, code: '1001_84', name: 'Meter 1001_84', addr: 84, brand: null, type: 1, loop: null, site: 1001, building: 6, zone: null, room_code: null, room_name: null, site_el: 1001, status: 'online' },
        ];
        for (const m of metersData) {
            await client.query(
                `INSERT INTO meter (meter_id, meter_code, meter_name, address, meter_brand_id, meter_type_id, loop_id, site_id, building_id, zone_id, room_code, room_name, site_el, is_active, status, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, $14, 'system')
                 ON CONFLICT (meter_id) DO UPDATE SET
                   meter_code = $2,
                   meter_name = $3,
                   address = $4,
                   meter_brand_id = $5,
                   meter_type_id = $6,
                   loop_id = $7,
                   site_id = $8,
                   building_id = $9,
                   zone_id = $10,
                   room_code = $11,
                   room_name = $12,
                   site_el = $13,
                   status = $14,
                   is_active = true`,
                [m.id, m.code, m.name, m.addr, m.brand, m.type, m.loop, m.site, m.building, m.zone, m.room_code, m.room_name, m.site_el, m.status]
            );
        }
        await client.query(`SELECT setval('meter_meter_id_seq', (SELECT GREATEST(MAX(meter_id), 26) FROM meter))`);
        console.log('  ✅ meter (26 meters, including live channels)');

        // --- Realtime Meter Map (11 active Redis channels) ---
        const realtimeMappings = [
            { channel: '1002_1', site_id: 1002, address_id: 1, meter_id: 16 },
            { channel: '1000_1', site_id: 1000, address_id: 1, meter_id: 17 },
            { channel: '1000_2', site_id: 1000, address_id: 2, meter_id: 18 },
            { channel: '1000_3', site_id: 1000, address_id: 3, meter_id: 19 },
            { channel: '1000_4', site_id: 1000, address_id: 4, meter_id: 20 },
            { channel: '1001_2', site_id: 1001, address_id: 2, meter_id: 21 },
            { channel: '1001_3', site_id: 1001, address_id: 3, meter_id: 22 },
            { channel: '1001_4', site_id: 1001, address_id: 4, meter_id: 23 },
            { channel: '1001_50', site_id: 1001, address_id: 50, meter_id: 24 },
            { channel: '1001_69', site_id: 1001, address_id: 69, meter_id: 25 },
            { channel: '1001_84', site_id: 1001, address_id: 84, meter_id: 26 },
        ];
        for (const r of realtimeMappings) {
            await client.query(
                `INSERT INTO realtime_meter_map (channel, realtime_site_id, realtime_address_id, meter_id, is_active)
                 VALUES ($1, $2, $3, $4, true)
                 ON CONFLICT DO NOTHING`,
                [r.channel, r.site_id, r.address_id, r.meter_id]
            );
        }
        console.log('  ✅ realtime_meter_map (11 channel mappings)');

        // --- Realtime Meter Data (sample readings for demo meters) ---
        const now = new Date();
        for (let i = 1; i <= 15; i++) {
            const isElectric = i <= 13;
            const kwh = isElectric ? Math.round(Math.random() * 5000000 + 100000) : 0;
            const kw = isElectric ? Math.round(Math.random() * 500 + 10) : 0;
            const kva = isElectric ? Math.round(kw * 1.1) : 0;
            const water = !isElectric ? Math.round(Math.random() * 50000 + 1000) : null;

            await client.query(
                `INSERT INTO actual_meter_data (meter_id, date_keep, energy_kwh, energy_kw, energy_kva, energy_kvar, energy_frequency,
                   energy_volt_p1, energy_volt_p2, energy_volt_p3, energy_amp1, energy_amp2, energy_amp3,
                   energy_pf1, energy_pf2, energy_pf3, water_value, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
                [
                    i, now, kwh, kw, kva, Math.round(kw * 0.3), isElectric ? 50.0 : 0,
                    isElectric ? 220 + Math.random() * 10 : 0, isElectric ? 221 + Math.random() * 10 : 0, isElectric ? 219 + Math.random() * 10 : 0,
                    isElectric ? Math.random() * 200 + 20 : 0, isElectric ? Math.random() * 200 + 20 : 0, isElectric ? Math.random() * 200 + 20 : 0,
                    isElectric ? 0.85 + Math.random() * 0.14 : 0, isElectric ? 0.85 + Math.random() * 0.14 : 0, isElectric ? 0.85 + Math.random() * 0.14 : 0,
                    water, 'online'
                ]
            );
        }
        console.log('  ✅ actual_meter_data (15 latest readings)');

        // --- Daily Data (last 30 days for first 10 meters) ---
        for (let day = 0; day < 30; day++) {
            const date = new Date(now);
            date.setDate(date.getDate() - day);
            const dateStr = date.toISOString().split('T')[0];

            for (let meterId = 1; meterId <= 10; meterId++) {
                const totalKwh = Math.round(Math.random() * 3000 + 500);
                const maxKw = Math.round(Math.random() * 400 + 100);
                await client.query(
                    `INSERT INTO actual_meter_data_daily (meter_id, date_keep, total_kwh, max_kw, min_kw, avg_kw)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     ON CONFLICT (meter_id, date_keep) DO NOTHING`,
                    [meterId, dateStr, totalKwh, maxKw, Math.round(maxKw * 0.3), Math.round(maxKw * 0.6)]
                );
            }
        }
        console.log('  ✅ actual_meter_data_daily (300 rows, 30 days × 10 meters)');

        // --- Monthly Data (last 12 months for first 10 meters) ---
        for (let month = 0; month < 12; month++) {
            const date = new Date(now);
            date.setMonth(date.getMonth() - month);
            const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            for (let meterId = 1; meterId <= 10; meterId++) {
                const totalKwh = Math.round(Math.random() * 80000 + 20000);
                const maxKw = Math.round(Math.random() * 500 + 200);
                await client.query(
                    `INSERT INTO actual_meter_data_monthly (meter_id, year_month, total_kwh, max_kw, avg_kw)
                     VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (meter_id, year_month) DO NOTHING`,
                    [meterId, yearMonth, totalKwh, maxKw, Math.round(maxKw * 0.65)]
                );
            }
        }
        console.log('  ✅ actual_meter_data_monthly (120 rows, 12 months × 10 meters)');

        // --- Alarm Groups ---
        await client.query(`
      INSERT INTO alarm_group (alarm_group_id, group_name, email, telegram_chat_id, is_active) VALUES
      (1, 'กลุ่มช่างเทคนิค', 'tech@kegroup.co.th', '-1001234567890', true),
      (2, 'กลุ่มผู้จัดการ', 'manager@kegroup.co.th', '-1009876543210', true),
      (3, 'กลุ่ม IT', 'it@kegroup.co.th', '', true)
      ON CONFLICT (alarm_group_id) DO UPDATE SET group_name = EXCLUDED.group_name, email = EXCLUDED.email
    `);
        await client.query(`SELECT setval('alarm_group_alarm_group_id_seq', (SELECT GREATEST(MAX(alarm_group_id), 3) FROM alarm_group))`);
        console.log('  ✅ alarm_group (3 groups)');

        // --- Alarm Configs ---
        await client.query(`
      INSERT INTO alarm_config (alarm_config_id, meter_id, energy_value_id, lower_value, higher_value, lower_message, higher_message, is_active, alarm_group_id) VALUES
      (1, 1, 6, 180, 250, '⚠️ แรงดันต่ำ: Volt P1 ต่ำกว่า 180V', '🔴 แรงดันสูง: Volt P1 สูงกว่า 250V', true, 1),
      (2, 1, 2, 0, 800, NULL, '🔴 กำลังไฟฟ้าสูง: kW เกิน 800', true, 1),
      (3, 6, 6, 180, 250, '⚠️ CDC แรงดันต่ำ', '🔴 CDC แรงดันสูง', true, 2),
      (4, 11, 2, 0, 1000, NULL, '🔴 Factory กำลังไฟฟ้าเกิน 1000 kW', true, 2)
      ON CONFLICT (alarm_config_id) DO UPDATE SET lower_value = EXCLUDED.lower_value, higher_value = EXCLUDED.higher_value
    `);
        await client.query(`SELECT setval('alarm_config_alarm_config_id_seq', (SELECT GREATEST(MAX(alarm_config_id), 4) FROM alarm_config))`);
        console.log('  ✅ alarm_config (4 configs)');

        // --- Billing Configs ---
        await client.query(`
      INSERT INTO billing_config (id, effective_date, unit_price, description, is_active) VALUES
      (1, '2022-01-01', 5.50, 'อัตราค่าไฟฟ้า 2022', false),
      (2, '2022-09-01', 6.00, 'อัตราค่าไฟฟ้า ปรับ ก.ย. 2022', false),
      (3, '2023-01-13', 7.08, 'อัตราค่าไฟฟ้า 2023', false),
      (4, '2024-01-01', 7.50, 'อัตราค่าไฟฟ้าปัจจุบัน 2024', true)
      ON CONFLICT (id) DO UPDATE SET unit_price = EXCLUDED.unit_price, is_active = EXCLUDED.is_active
    `);
        await client.query(`SELECT setval('billing_config_id_seq', (SELECT GREATEST(MAX(id), 4) FROM billing_config))`);
        console.log('  ✅ billing_config (4 rate configs)');

        // --- Demand Peak Config ---
        await client.query(`
      INSERT INTO demand_peak_config (config_id, display_name, warning_setpoint, peak_setpoint, saving_rate, flat_rate, tou, saving_target, is_active) VALUES
      (1, '111PMT Demand Control', 700, 850, 0.05, 7.50, 4.72, 50000, true),
      (2, 'CDC Demand Control', 1200, 1500, 0.04, 7.50, 4.72, 80000, true)
      ON CONFLICT (config_id) DO UPDATE SET warning_setpoint = EXCLUDED.warning_setpoint, peak_setpoint = EXCLUDED.peak_setpoint
    `);
        await client.query(`SELECT setval('demand_peak_config_config_id_seq', (SELECT GREATEST(MAX(config_id), 2) FROM demand_peak_config))`);
        console.log('  ✅ demand_peak_config (2 configs)');

        // --- Demand Meter Config ---
        await client.query(`
      INSERT INTO demand_meter_config (id, config_id, meter_id) VALUES
      (1, 1, 1), (2, 1, 2), (3, 1, 3), (4, 1, 4), (5, 1, 5),
      (6, 2, 6), (7, 2, 7), (8, 2, 8), (9, 2, 9), (10, 2, 10)
      ON CONFLICT (id) DO NOTHING
    `);
        await client.query(`SELECT setval('demand_meter_config_id_seq', (SELECT GREATEST(MAX(id), 10) FROM demand_meter_config))`);
        console.log('  ✅ demand_meter_config (10 mappings)');

        // --- Site-User Mapping ---
        const siteUserMappings = [
            // Admin -> Sites 1, 2, 3
            { site_id: 1, user_id: 1 },
            { site_id: 2, user_id: 1 },
            { site_id: 3, user_id: 1 },
            // Technician1 -> Sites 1, 2
            { site_id: 1, user_id: 2 },
            { site_id: 2, user_id: 2 },
            // Tenant1 -> Site 1
            { site_id: 1, user_id: 3 },
            // User1 -> Sites 1, 2
            { site_id: 1, user_id: 4 },
            { site_id: 2, user_id: 4 },
            // ViewAll -> All 6 active sites
            { site_id: 1, user_id: 6 },
            { site_id: 2, user_id: 6 },
            { site_id: 3, user_id: 6 },
            { site_id: 1000, user_id: 6 },
            { site_id: 1001, user_id: 6 },
            { site_id: 1002, user_id: 6 },
        ];
        for (const sum of siteUserMappings) {
            await client.query(
                `INSERT INTO site_user_map (site_id, user_id) VALUES ($1, $2) ON CONFLICT (site_id, user_id) DO NOTHING`,
                [sum.site_id, sum.user_id]
            );
        }
        console.log('  ✅ site_user_map (admin & viewall site assignments)');

        // --- User Permissions ---
        const allModules = ['dashboard', 'monitoring', 'meters', 'alarms', 'users', 'billing', 'reports', 'settings', 'company', 'sites'];

        // 1. Admin = full access
        for (const mod of allModules) {
            await client.query(
                `INSERT INTO user_permission (group_id, permission_key, can_view, can_create, can_edit, can_delete)
                 VALUES (1, $1, true, true, true, true)
                 ON CONFLICT (group_id, permission_key) DO UPDATE SET can_view = true, can_create = true, can_edit = true, can_delete = true`,
                [mod]
            );
        }
        // 2. Technician = monitor + create/edit
        for (const mod of ['dashboard', 'monitoring', 'meters', 'alarms', 'reports']) {
            await client.query(
                `INSERT INTO user_permission (group_id, permission_key, can_view, can_create, can_edit, can_delete)
                 VALUES (2, $1, true, true, true, false)
                 ON CONFLICT (group_id, permission_key) DO UPDATE SET can_view = true, can_create = true, can_edit = true, can_delete = false`,
                [mod]
            );
        }
        // 3. Tenant Service = view billing + reports
        for (const mod of ['dashboard', 'monitoring', 'billing', 'reports']) {
            await client.query(
                `INSERT INTO user_permission (group_id, permission_key, can_view, can_create, can_edit, can_delete)
                 VALUES (3, $1, true, false, false, false)
                 ON CONFLICT (group_id, permission_key) DO UPDATE SET can_view = true, can_create = false, can_edit = false, can_delete = false`,
                [mod]
            );
        }
        // 4. User = view dashboard, monitoring, reports
        for (const mod of ['dashboard', 'monitoring', 'reports']) {
            await client.query(
                `INSERT INTO user_permission (group_id, permission_key, can_view, can_create, can_edit, can_delete)
                 VALUES (4, $1, true, false, false, false)
                 ON CONFLICT (group_id, permission_key) DO UPDATE SET can_view = true, can_create = false, can_edit = false, can_delete = false`,
                [mod]
            );
        }
        // 5. View = view all main screens
        for (const mod of ['dashboard', 'monitoring', 'reports', 'meters', 'alarms', 'company', 'sites', 'billing', 'settings']) {
            await client.query(
                `INSERT INTO user_permission (group_id, permission_key, can_view, can_create, can_edit, can_delete)
                 VALUES (5, $1, true, false, false, false)
                 ON CONFLICT (group_id, permission_key) DO UPDATE SET can_view = true, can_create = false, can_edit = false, can_delete = false`,
                [mod]
            );
        }
        console.log('  ✅ user_permission (admin, technician, view, tenant, user)');

        // --- System License ---
        const defaultLicense = generateLicense(LICENSE_CONFIG.DEFAULT_LICENSE);
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
                defaultLicense.licenseKey,
                defaultLicense.payload.customerName,
                defaultLicense.payload.licenseType,
                defaultLicense.payload.maxMeters,
                JSON.stringify(defaultLicense.payload.features),
                defaultLicense.payload.issuedDate,
                defaultLicense.payload.expiryDate
            ]
        );
        await client.query(`SELECT setval('system_license_id_seq', (SELECT GREATEST(MAX(id), 1) FROM system_license))`);
        console.log('  ✅ system_license (Default 50-meter Enterprise License)');

        await client.query('COMMIT');

        console.log('\n✅ Migration and seeding completed successfully!\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('  📌 Logins:');
        console.log('     Admin:   admin   / admin123');
        console.log('     ViewAll: viewall / viewall123');
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
