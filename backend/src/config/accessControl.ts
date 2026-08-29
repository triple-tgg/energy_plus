import { query } from './database';

export const ensureAccessControlSchema = async (): Promise<void> => {
    try {
        const check = await query("SELECT to_regclass('public.app_user') as has_app_user");
        if (!check.rows[0]?.has_app_user) {
            return;
        }

        await query(`ALTER TABLE IF EXISTS app_user ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'viewer'`);
        await query(`ALTER TABLE IF EXISTS app_user ADD COLUMN IF NOT EXISTS site_access_mode VARCHAR(20) NOT NULL DEFAULT 'assigned'`);
        await query(`UPDATE app_user SET role = CASE
            WHEN LOWER(COALESCE(role, '')) IN ('viewer','operator','admin') THEN LOWER(role)
            WHEN LOWER(user_name) = 'admin' THEN 'admin'
            ELSE 'viewer' END`);
        await query(`UPDATE app_user SET role = 'admin' WHERE LOWER(user_name) = 'admin'`);
        await query(`UPDATE app_user SET site_access_mode = 'all' WHERE role = 'admin' AND LOWER(user_name) = 'admin'`);
    } catch (err: any) {
        console.warn('⚠️ ensureAccessControlSchema skipped:', err.message);
    }
};
