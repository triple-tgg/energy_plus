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

async function testLogin(username, password) {
    console.log(`🔑 Testing login for "${username}" with password "${password}"...`);

    const userResult = await pool.query(
        `SELECT u.user_id, u.user_name, u.display_name, u.email, u.password_hash,
                u.group_id, u.is_active, u.role, u.site_access_mode,
                g.group_name
         FROM app_user u
         LEFT JOIN group_user g ON u.group_id = g.group_id
         WHERE u.user_name = $1`,
        [username]
    );

    if (userResult.rows.length === 0) {
        console.error('❌ User not found!');
        return;
    }

    const user = userResult.rows[0];
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    console.log('Password valid:', passwordValid);

    if (!passwordValid) {
        console.error('❌ Password mismatch!');
        return;
    }

    // Sites
    const sitesResult = user.site_access_mode === 'all'
        ? await pool.query(`SELECT site_id, site_name FROM sites WHERE site_status = true ORDER BY site_id`)
        : await pool.query(
            `SELECT s.site_id, s.site_name
             FROM site_user_map sum
             JOIN sites s ON sum.site_id = s.site_id
             WHERE sum.user_id = $1 AND (s.site_status = true OR s.site_status IS NULL)
             ORDER BY s.site_id`,
            [user.user_id]
        );

    // Permissions
    const permResult = await pool.query(
        `SELECT permission_key FROM user_permission WHERE group_id = $1 AND can_view = true`,
        [user.group_id]
    );

    const profile = {
        userId: user.user_id,
        userName: user.user_name,
        displayName: user.display_name,
        email: user.email,
        group: user.group_name || 'User',
        groupId: user.group_id,
        role: user.role || 'viewer',
        siteAccessMode: user.site_access_mode || 'assigned',
        permissions: permResult.rows.map(p => p.permission_key),
        sites: sitesResult.rows.map(s => ({ siteId: s.site_id, siteName: s.site_name })),
    };

    console.log('\n✅ Login SUCCESS! Returned profile:');
    console.log(JSON.stringify(profile, null, 2));

    await pool.end();
}

testLogin('viewall', 'viewall123').catch(console.error);
