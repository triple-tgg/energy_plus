const pool = require('../dist/config/database').default;

async function migrate() {
    console.log('Running migration...');
    await pool.query('ALTER TABLE IF EXISTS meter ADD COLUMN IF NOT EXISTS lease_number VARCHAR(100)');
    await pool.query('ALTER TABLE IF EXISTS meter ADD COLUMN IF NOT EXISTS vr_number VARCHAR(150)');
    console.log('Migration successful!');
    
    const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='meter' AND column_name IN ('lease_number', 'vr_number')");
    console.log('Columns verified:', cols.rows);
    
    await pool.end();
}

migrate().catch(e => {
    console.error('Migration error:', e);
    pool.end();
});
