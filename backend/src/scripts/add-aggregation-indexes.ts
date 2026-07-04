import { aggregationService } from '../modules/aggregation/aggregation.service';
import pool from '../config/database';

async function main() {
    await aggregationService.ensureSchema();
    console.log('✅ Aggregation indexes and job log table are ready');
}

main()
    .catch((error) => {
        console.error('❌ Failed to prepare aggregation schema:', error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });

