const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '25060', 10),
    database: process.env.DB_DATABASE || 'energy_plus',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
});

async function checkUsersAndPerms() {
    console.log('--- Group Users ---');
    const groups = await pool.query(`SELECT group_id, group_name, description, is_active FROM group_user ORDER BY group_id`);
    console.table(groups.rows);

    console.log('\n--- User Permissions by Group ---');
    const perms = await pool.query(`
        SELECT p.group_id, g.group_name, p.permission_key, p.can_view, p.can_create, p.can_edit, p.can_delete
        FROM user_permission p
        JOIN group_user g ON g.group_id = p.group_id
        ORDER BY p.group_id, p.permission_key
    `);
    console.table(perms.rows);

    console.log('\n--- App Users ---');
    const users = await pool.query(`
        SELECT u.user_id, u.user_name, u.display_name, u.email, u.group_id, u.role, u.site_access_mode, u.is_active
        FROM app_user u
        ORDER BY u.user_id
    `);
    console.table(users.rows);

    await pool.end();
}

checkUsersAndPerms().catch(console.error);
