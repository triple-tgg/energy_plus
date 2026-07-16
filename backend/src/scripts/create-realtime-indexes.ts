/**
 * One-time script to create optimized indexes for realtime queries.
 * Run: npx ts-node src/scripts/create-realtime-indexes.ts
 */
import pool from '../config/database';

async function createIndexes() {
    console.log('Creating optimized indexes for meter_data_realtime...');

    const indexes = [
        // Composite index for the "latest per meter" query: WHERE received_at >= X ORDER BY site_id, address_id, device_datetime DESC
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mdr_received_site_addr_dt
         ON meter_data_realtime (received_at, site_id, address_id, device_datetime DESC)`,

        // Index for history query: WHERE received_at >= X, used with GROUP BY bucket
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mdr_received_at_desc
         ON meter_data_realtime (received_at DESC)`,
    ];

    for (const sql of indexes) {
        try {
            console.log(`  Running: ${sql.trim().split('\n')[0]}...`);
            await pool.query(sql);
            console.log('  ✅ Done');
        } catch (err: any) {
            if (err.message?.includes('already exists')) {
                console.log('  ⏭️  Already exists, skipping');
            } else {
                console.error('  ❌ Error:', err.message);
            }
        }
    }

    console.log('\nAll indexes created.');
    await pool.end();
}

createIndexes().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
