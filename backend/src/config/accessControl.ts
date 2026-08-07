import { query } from './database';

export const ensureAccessControlSchema = async (): Promise<void> => {
    await query(`ALTER TABLE app_user ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'viewer'`);
    await query(`ALTER TABLE app_user ADD COLUMN IF NOT EXISTS site_access_mode VARCHAR(20) NOT NULL DEFAULT 'assigned'`);
    await query(`UPDATE app_user SET role = CASE
        WHEN LOWER(COALESCE(role, '')) IN ('viewer','operator','admin') THEN LOWER(role)
        WHEN LOWER(user_name) = 'admin' THEN 'admin'
        ELSE 'viewer' END`);
    await query(`UPDATE app_user SET role = 'admin' WHERE LOWER(user_name) = 'admin'`);
    await query(`UPDATE app_user SET site_access_mode = 'all' WHERE role = 'admin' AND LOWER(user_name) = 'admin'`);
};
