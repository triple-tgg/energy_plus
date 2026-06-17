import pool from '../config/database';

async function addLayoutPointsTable() {
    const client = await pool.connect();
    try {
        console.log('\n🔧 Adding layout_points table...\n');

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

        console.log('✅ layout_points table created successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

addLayoutPointsTable();
