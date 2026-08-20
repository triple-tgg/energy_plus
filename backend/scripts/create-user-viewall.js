const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '25060', 10),
    database: process.env.DB_DATABASE || 'energy_plus',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
});

async function main() {
    const client = await pool.connect();
    try {
        console.log('🔄 Setting up Group View permissions and creating viewall user...');

        // 1. Check Group 5 (View)
        const groupRes = await client.query(`SELECT group_id, group_name FROM group_user WHERE group_id = 5 OR group_name = 'View'`);
        let groupId = 5;
        if (groupRes.rows.length === 0) {
            const insGroup = await client.query(`INSERT INTO group_user (group_name, description, is_active) VALUES ('View', 'Dashboard view only', true) RETURNING group_id`);
            groupId = insGroup.rows[0].group_id;
            console.log(`✅ Created group View with id: ${groupId}`);
        } else {
            groupId = groupRes.rows[0].group_id;
            console.log(`✅ Found group View with id: ${groupId}`);
        }

        // 2. Set permissions for Group View (group_id = 5)
        // Give can_view = true for all main viewer modules
        const viewModules = ['dashboard', 'monitoring', 'reports', 'meters', 'alarms', 'company', 'sites', 'billing', 'settings'];
        
        // Remove existing to avoid duplicates
        await client.query(`DELETE FROM user_permission WHERE group_id = $1`, [groupId]);

        for (const mod of viewModules) {
            await client.query(`
                INSERT INTO user_permission (group_id, permission_key, can_view, can_create, can_edit, can_delete)
                VALUES ($1, $2, true, false, false, false)
            `, [groupId, mod]);
            console.log(`  🛡️ Set permission for Group ${groupId}: ${mod} (can_view = true)`);
        }

        // Also ensure default permissions for other groups if missing
        // Group 3 (Tenant Service)
        const g3Count = await client.query(`SELECT COUNT(*) FROM user_permission WHERE group_id = 3`);
        if (parseInt(g3Count.rows[0].count, 10) === 0) {
            for (const mod of ['dashboard', 'monitoring', 'billing', 'reports']) {
                await client.query(`INSERT INTO user_permission (group_id, permission_key, can_view, can_create, can_edit, can_delete) VALUES (3, $1, true, false, false, false)`, [mod]);
            }
            console.log('  🛡️ Set default permissions for Group 3 (Tenant Service)');
        }

        // Group 4 (User)
        const g4Count = await client.query(`SELECT COUNT(*) FROM user_permission WHERE group_id = 4`);
        if (parseInt(g4Count.rows[0].count, 10) === 0) {
            for (const mod of ['dashboard', 'monitoring', 'reports']) {
                await client.query(`INSERT INTO user_permission (group_id, permission_key, can_view, can_create, can_edit, can_delete) VALUES (4, $1, true, false, false, false)`, [mod]);
            }
            console.log('  🛡️ Set default permissions for Group 4 (User)');
        }

        // 3. Create or update user `viewall`
        const passwordHash = await bcrypt.hash('viewall123', 12);
        
        const userCheck = await client.query(`SELECT user_id FROM app_user WHERE user_name = 'viewall'`);
        let userId;

        if (userCheck.rows.length > 0) {
            userId = userCheck.rows[0].user_id;
            await client.query(`
                UPDATE app_user
                SET display_name = 'ผู้ดูทั้งหมด (View All)',
                    email = 'viewall@kegroup.co.th',
                    password_hash = $1,
                    group_id = $2,
                    role = 'viewer',
                    site_access_mode = 'all',
                    is_active = true
                WHERE user_id = $3
            `, [passwordHash, groupId, userId]);
            console.log(`✅ Updated user 'viewall' (User ID: ${userId})`);
        } else {
            const insUser = await client.query(`
                INSERT INTO app_user (user_name, display_name, email, password_hash, group_id, role, site_access_mode, is_active, created_by)
                VALUES ('viewall', 'ผู้ดูทั้งหมด (View All)', 'viewall@kegroup.co.th', $1, $2, 'viewer', 'all', true, 'admin')
                RETURNING user_id
            `, [passwordHash, groupId]);
            userId = insUser.rows[0].user_id;
            console.log(`✅ Created user 'viewall' (User ID: ${userId})`);
        }

        // 4. Map user `viewall` to all active sites in site_user_map
        const sites = await client.query(`SELECT site_id FROM sites WHERE site_status = true OR site_status IS NULL`);
        for (const s of sites.rows) {
            await client.query(`
                INSERT INTO site_user_map (site_id, user_id)
                VALUES ($1, $2)
                ON CONFLICT (site_id, user_id) DO NOTHING
            `, [s.site_id, userId]);
        }
        console.log(`✅ Mapped user 'viewall' to all ${sites.rows.length} active sites`);

        console.log('\n🎉 user viewall created and configured successfully!');
    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
