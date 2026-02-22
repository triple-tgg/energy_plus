import pool from '../config/database';
import bcrypt from 'bcryptjs';

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
        parent_meter_id INTEGER REFERENCES meter(meter_id),
        is_active BOOLEAN DEFAULT true,
        status VARCHAR(50) DEFAULT 'Manual',
        created_by VARCHAR(100),
        created_on TIMESTAMPTZ DEFAULT NOW(),
        last_modified_on TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        console.log('  ✅ meter');

        // Actual Meter Data (realtime)
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
        total_gas DECIMAL(18,2)
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
        total_gas DECIMAL(18,2)
      )
    `);
        console.log('  ✅ actual_meter_data_monthly');

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
        is_lamp_on BOOLEAN DEFAULT false,
        is_buzzer_on BOOLEAN DEFAULT false,
        lamp_address INTEGER DEFAULT 0,
        buzzer_address INTEGER DEFAULT 0,
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

        // ═══════════════════════════════════════════════════════
        // 2. SEED DATA
        // ═══════════════════════════════════════════════════════

        console.log('\n📦 Seeding sample data...\n');

        // --- Company ---
        await client.query(`
      INSERT INTO company (company_name, address, contact_name, contact_phone, domain)
      VALUES ('บริษัท กลุ่มเคอี จำกัด', '111 ถ.พหลโยธิน แขวงจตุจักร เขตจตุจักร กรุงเทพฯ 10900', 'Admin', '02-123-4567', 'energyplus.kegroup.co.th')
      ON CONFLICT DO NOTHING
    `);
        console.log('  ✅ company');

        // --- User Groups ---
        const groups = [
            { name: 'Administrator', desc: 'Full access to all features' },
            { name: 'Technician', desc: 'Access to monitoring, meters, and alarms' },
            { name: 'Tenant Service', desc: 'View monitoring and billing' },
            { name: 'User', desc: 'Basic view access' },
            { name: 'View', desc: 'Dashboard view only' },
            { name: 'Guest', desc: 'Limited guest access' },
        ];
        for (const g of groups) {
            await client.query(`INSERT INTO group_user (group_name, description) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [g.name, g.desc]);
        }
        console.log('  ✅ group_user (6 groups)');

        // --- Users ---
        const passwordHash = await bcrypt.hash('admin123', 12);
        const users = [
            { username: 'admin', display: 'ผู้ดูแลระบบ', email: 'admin@kegroup.co.th', group: 1 },
            { username: 'technician1', display: 'ช่างเทคนิค 1', email: 'tech1@kegroup.co.th', group: 2 },
            { username: 'tenant1', display: 'ผู้เช่า 1', email: 'tenant1@kegroup.co.th', group: 3 },
            { username: 'user1', display: 'ผู้ใช้งาน 1', email: 'user1@kegroup.co.th', group: 4 },
            { username: 'viewer', display: 'ผู้ดูอย่างเดียว', email: 'viewer@kegroup.co.th', group: 5 },
        ];
        for (const u of users) {
            await client.query(
                `INSERT INTO app_user (user_name, display_name, email, password_hash, group_id, created_by)
         VALUES ($1, $2, $3, $4, $5, 'system') ON CONFLICT (user_name) DO NOTHING`,
                [u.username, u.display, u.email, passwordHash, u.group]
            );
        }
        console.log('  ✅ app_user (5 users, password: admin123)');

        // --- Sites ---
        const sitesData = [
            { name: '111PMT', address: '111 ถ.พหลโยธิน แขวงจตุจักร เขตจตุจักร กรุงเทพฯ 10900' },
            { name: 'CDC Crystal Design Center', address: '1420 ถ.ประดิษฐ์มนูธรรม แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพฯ 10230' },
            { name: 'KE Factory', address: '99 หมู่ 3 ถ.บางนา-ตราด สมุทรปราการ 10270' },
        ];
        for (const s of sitesData) {
            await client.query(`INSERT INTO sites (site_name, site_address) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [s.name, s.address]);
        }
        console.log('  ✅ sites (3 sites)');

        // --- Buildings ---
        const buildingsData = [
            { name: '111PMT_Building A', site: 1 },
            { name: '111PMT_Building B', site: 1 },
            { name: 'CDC_CP2', site: 2 },
            { name: 'CDC_CP3', site: 2 },
            { name: 'Factory_Main', site: 3 },
        ];
        for (const b of buildingsData) {
            await client.query(`INSERT INTO buildings (building_name, site_id, created_by) VALUES ($1, $2, 'system') ON CONFLICT DO NOTHING`, [b.name, b.site]);
        }
        console.log('  ✅ buildings (5 buildings)');

        // --- Zones ---
        const zonesData = [
            { name: 'พลาซ่า', building: 1, show: true },
            { name: 'สำนักงาน ชั้น 1', building: 1, show: true },
            { name: 'สำนักงาน ชั้น 2', building: 1, show: true },
            { name: 'ห้องเครื่อง', building: 2, show: false },
            { name: 'ที่จอดรถ', building: 2, show: true },
            { name: 'CDC-DB1-TOU1 (B)', building: 3, show: true },
            { name: 'CDC-DB1-TOU2 (C)', building: 3, show: true },
            { name: 'CDC-DB1-TOU3 (D)', building: 3, show: true },
            { name: 'CDC-DB2 MDB1', building: 4, show: true },
            { name: 'CDC-DB2 MDB2', building: 4, show: true },
            { name: 'Factory Zone A', building: 5, show: true },
            { name: 'Factory Zone B', building: 5, show: true },
        ];
        for (const z of zonesData) {
            await client.query(`INSERT INTO zones (zone_name, building_id, is_show_dashboard) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [z.name, z.building, z.show]);
        }
        console.log('  ✅ zones (12 zones)');

        // --- Meter Brands ---
        const brands = [
            { name: 'Siemens', model: 'AB5478' },
            { name: 'Schneider Electric', model: 'PM5110' },
            { name: 'ABB', model: 'M4M 30' },
            { name: 'Socomec', model: 'DIRIS A40' },
            { name: 'Hioki', model: 'PW3365' },
            { name: 'CET', model: 'PMC-53A' },
            { name: 'CHINT', model: 'DTSU666' },
            { name: 'Eastron', model: 'SDM630' },
        ];
        for (const b of brands) {
            await client.query(`INSERT INTO meter_brand (meter_brand_name, model_name) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [b.name, b.model]);
        }
        console.log('  ✅ meter_brand (8 brands)');

        // --- Meter Types ---
        const types = [
            { name: 'ไฟฟ้า', icon: 'fa fa-bolt' },
            { name: 'น้ำ', icon: 'fa fa-tint' },
            { name: 'แก๊ส', icon: 'fa fa-fire' },
        ];
        for (const t of types) {
            await client.query(`INSERT INTO meter_type (meter_type_name, icon_name) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [t.name, t.icon]);
        }
        console.log('  ✅ meter_type (3 types)');

        // --- Loops ---
        const loops = [
            { name: 'Loop 1', port: 1, baud: 9600 },
            { name: 'Loop 2', port: 2, baud: 9600 },
            { name: 'Loop 3', port: 3, baud: 9600 },
            { name: 'Loop 4', port: 4, baud: 19200 },
            { name: 'Loop 5', port: 5, baud: 9600 },
            { name: 'Loop 6', port: 6, baud: 9600 },
            { name: 'Loop 7', port: 7, baud: 9600 },
            { name: 'Loop 8', port: 8, baud: 19200 },
        ];
        for (const l of loops) {
            await client.query(`INSERT INTO loop (loop_name, port_no, baudrate) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [l.name, l.port, l.baud]);
        }
        console.log('  ✅ loop (8 loops)');

        // --- Protocols ---
        await client.query(`INSERT INTO protocol (protocol_name) VALUES ('Modbus RTU'), ('Modbus TCP'), ('BACnet') ON CONFLICT DO NOTHING`);
        console.log('  ✅ protocol (3 protocols)');

        // --- Energy Values ---
        const energyValues = [
            { name: 'kWh', unit: 'kWh', col: 'energy_kwh', order: 1 },
            { name: 'kW', unit: 'kW', col: 'energy_kw', order: 2 },
            { name: 'kVA', unit: 'kVA', col: 'energy_kva', order: 3 },
            { name: 'kVAR', unit: 'kVAR', col: 'energy_kvar', order: 4 },
            { name: 'Frequency', unit: 'Hz', col: 'energy_frequency', order: 5 },
            { name: 'Volt P1', unit: 'V', col: 'energy_volt_p1', order: 6 },
            { name: 'Volt P2', unit: 'V', col: 'energy_volt_p2', order: 7 },
            { name: 'Volt P3', unit: 'V', col: 'energy_volt_p3', order: 8 },
            { name: 'Volt L1', unit: 'V', col: 'energy_volt_l1', order: 9 },
            { name: 'Volt L2', unit: 'V', col: 'energy_volt_l2', order: 10 },
            { name: 'Volt L3', unit: 'V', col: 'energy_volt_l3', order: 11 },
            { name: 'Amp P1', unit: 'A', col: 'energy_amp1', order: 12 },
            { name: 'Amp P2', unit: 'A', col: 'energy_amp2', order: 13 },
            { name: 'Amp P3', unit: 'A', col: 'energy_amp3', order: 14 },
            { name: 'PF P1', unit: '', col: 'energy_pf1', order: 15 },
            { name: 'PF P2', unit: '', col: 'energy_pf2', order: 16 },
            { name: 'PF P3', unit: '', col: 'energy_pf3', order: 17 },
            { name: 'THD V1', unit: '%', col: 'energy_thd_v1', order: 18 },
            { name: 'THD A1', unit: '%', col: 'energy_thd_a1', order: 19 },
            { name: 'Water', unit: 'm³', col: 'water_value', order: 20 },
            { name: 'Gas', unit: 'm³', col: 'gas_value', order: 21 },
        ];
        for (const ev of energyValues) {
            await client.query(
                `INSERT INTO energy_value (energy_value_name, unit, column_name, display_order) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
                [ev.name, ev.unit, ev.col, ev.order]
            );
        }
        console.log('  ✅ energy_value (21 types)');

        // --- Meters (sample meters matching API design) ---
        const metersData = [
            { code: '0206213159', name: 'Main MDB L1 (L1-L4)', addr: 1, brand: 1, type: 1, loop: 1, site: 1, building: 1, zone: 1, room_code: 'Main MDB-L1', room_name: 'Common' },
            { code: '0206213160', name: 'Main MDB L2', addr: 2, brand: 1, type: 1, loop: 1, site: 1, building: 1, zone: 1, room_code: 'Main MDB-L2', room_name: 'Common' },
            { code: '0206213161', name: 'Sub MDB A1', addr: 3, brand: 2, type: 1, loop: 2, site: 1, building: 1, zone: 2, room_code: 'Sub-A1', room_name: 'Office 1F' },
            { code: '0206213162', name: 'Sub MDB A2', addr: 4, brand: 2, type: 1, loop: 2, site: 1, building: 1, zone: 3, room_code: 'Sub-A2', room_name: 'Office 2F' },
            { code: '0206213163', name: 'MDB Parking', addr: 5, brand: 3, type: 1, loop: 3, site: 1, building: 2, zone: 5, room_code: 'MDB-PK', room_name: 'Parking' },
            { code: 'CDC001', name: 'CDC MDB-1 TOU1', addr: 1, brand: 4, type: 1, loop: 4, site: 2, building: 3, zone: 6, room_code: 'CDC-MDB1', room_name: 'TOU1' },
            { code: 'CDC002', name: 'CDC MDB-1 TOU2', addr: 2, brand: 4, type: 1, loop: 4, site: 2, building: 3, zone: 7, room_code: 'CDC-MDB2', room_name: 'TOU2' },
            { code: 'CDC003', name: 'CDC MDB-1 TOU3', addr: 3, brand: 4, type: 1, loop: 4, site: 2, building: 3, zone: 8, room_code: 'CDC-MDB3', room_name: 'TOU3' },
            { code: 'CDC004', name: 'CDC DB2 MDB1', addr: 4, brand: 5, type: 1, loop: 5, site: 2, building: 4, zone: 9, room_code: 'CDC-DB2-1', room_name: 'MDB1' },
            { code: 'CDC005', name: 'CDC DB2 MDB2', addr: 5, brand: 5, type: 1, loop: 5, site: 2, building: 4, zone: 10, room_code: 'CDC-DB2-2', room_name: 'MDB2' },
            { code: 'FAC001', name: 'Factory Main MDB', addr: 1, brand: 6, type: 1, loop: 6, site: 3, building: 5, zone: 11, room_code: 'FAC-MAIN', room_name: 'Main' },
            { code: 'FAC002', name: 'Factory Line A', addr: 2, brand: 6, type: 1, loop: 6, site: 3, building: 5, zone: 11, room_code: 'FAC-A', room_name: 'Line A' },
            { code: 'FAC003', name: 'Factory Line B', addr: 3, brand: 7, type: 1, loop: 7, site: 3, building: 5, zone: 12, room_code: 'FAC-B', room_name: 'Line B' },
            { code: 'WATER001', name: 'Water Meter Main', addr: 1, brand: 8, type: 2, loop: 8, site: 1, building: 1, zone: 1, room_code: 'WTR-MAIN', room_name: 'Water' },
            { code: 'WATER002', name: 'Water Meter CDC', addr: 2, brand: 8, type: 2, loop: 8, site: 2, building: 3, zone: 6, room_code: 'WTR-CDC', room_name: 'Water CDC' },
        ];
        for (const m of metersData) {
            await client.query(
                `INSERT INTO meter (meter_code, meter_name, address, meter_brand_id, meter_type_id, loop_id, site_id, building_id, zone_id, room_code, room_name, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'system') ON CONFLICT DO NOTHING`,
                [m.code, m.name, m.addr, m.brand, m.type, m.loop, m.site, m.building, m.zone, m.room_code, m.room_name]
            );
        }
        console.log('  ✅ meter (15 meters)');

        // --- Realtime Meter Data (sample latest readings) ---
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
           VALUES ($1, $2, $3, $4, $5, $6)`,
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
           VALUES ($1, $2, $3, $4, $5)`,
                    [meterId, yearMonth, totalKwh, maxKw, Math.round(maxKw * 0.65)]
                );
            }
        }
        console.log('  ✅ actual_meter_data_monthly (120 rows, 12 months × 10 meters)');

        // --- Alarm Groups ---
        await client.query(`
      INSERT INTO alarm_group (group_name, email, telegram_chat_id, is_active) VALUES
      ('กลุ่มช่างเทคนิค', 'tech@kegroup.co.th', '-1001234567890', true),
      ('กลุ่มผู้จัดการ', 'manager@kegroup.co.th', '-1009876543210', true),
      ('กลุ่ม IT', 'it@kegroup.co.th', '', true)
    `);
        console.log('  ✅ alarm_group (3 groups)');

        // --- Alarm Configs ---
        await client.query(`
      INSERT INTO alarm_config (meter_id, energy_value_id, lower_value, higher_value, lower_message, higher_message, is_active, alarm_group_id) VALUES
      (1, 6, 180, 250, '⚠️ แรงดันต่ำ: Volt P1 ต่ำกว่า 180V', '🔴 แรงดันสูง: Volt P1 สูงกว่า 250V', true, 1),
      (1, 2, 0, 800, NULL, '🔴 กำลังไฟฟ้าสูง: kW เกิน 800', true, 1),
      (6, 6, 180, 250, '⚠️ CDC แรงดันต่ำ', '🔴 CDC แรงดันสูง', true, 2),
      (11, 2, 0, 1000, NULL, '🔴 Factory กำลังไฟฟ้าเกิน 1000 kW', true, 2)
    `);
        console.log('  ✅ alarm_config (4 configs)');

        // --- Billing Configs ---
        await client.query(`
      INSERT INTO billing_config (effective_date, unit_price, description, is_active) VALUES
      ('2022-01-01', 5.50, 'อัตราค่าไฟฟ้า 2022', false),
      ('2022-09-01', 6.00, 'อัตราค่าไฟฟ้า ปรับ ก.ย. 2022', false),
      ('2023-01-13', 7.08, 'อัตราค่าไฟฟ้า 2023', false),
      ('2024-01-01', 7.50, 'อัตราค่าไฟฟ้าปัจจุบัน 2024', true)
    `);
        console.log('  ✅ billing_config (4 rate configs)');

        // --- Demand Peak Config ---
        await client.query(`
      INSERT INTO demand_peak_config (display_name, warning_setpoint, peak_setpoint, saving_rate, flat_rate, tou, saving_target, is_active) VALUES
      ('111PMT Demand Control', 700, 850, 0.05, 7.50, 4.72, 50000, true),
      ('CDC Demand Control', 1200, 1500, 0.04, 7.50, 4.72, 80000, true)
    `);
        console.log('  ✅ demand_peak_config (2 configs)');

        // --- Demand Meter Config ---
        await client.query(`
      INSERT INTO demand_meter_config (config_id, meter_id) VALUES
      (1, 1), (1, 2), (1, 3), (1, 4), (1, 5),
      (2, 6), (2, 7), (2, 8), (2, 9), (2, 10)
    `);
        console.log('  ✅ demand_meter_config (10 mappings)');

        // --- Site-User Mapping ---
        await client.query(`
      INSERT INTO site_user_map (site_id, user_id) VALUES
      (1, 1), (2, 1), (3, 1), 
      (1, 2), (2, 2),
      (1, 3),
      (1, 4), (2, 4)
      ON CONFLICT DO NOTHING
    `);
        console.log('  ✅ site_user_map (admin → all sites)');

        // --- User Permissions ---
        const modules = ['dashboard', 'monitoring', 'meters', 'alarms', 'users', 'billing', 'reports', 'settings', 'company', 'sites'];
        // Admin = full, Technician = most, etc.
        for (const mod of modules) {
            await client.query(
                `INSERT INTO user_permission (group_id, permission_key, can_view, can_create, can_edit, can_delete) VALUES ($1, $2, true, true, true, true)`,
                [1, mod]
            );
        }
        for (const mod of ['dashboard', 'monitoring', 'meters', 'alarms', 'reports']) {
            await client.query(
                `INSERT INTO user_permission (group_id, permission_key, can_view, can_create, can_edit, can_delete) VALUES ($1, $2, true, true, true, false)`,
                [2, mod]
            );
        }
        console.log('  ✅ user_permission (admin + technician)');

        await client.query('COMMIT');

        console.log('\n✅ Migration and seeding completed successfully!\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('  📌 Admin Login:');
        console.log('     Username: admin');
        console.log('     Password: admin123');
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
