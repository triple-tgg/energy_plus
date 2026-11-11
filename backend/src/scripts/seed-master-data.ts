import pool from '../config/database';
import { ensureMeterMasterData } from '../config/meterMasterData';

async function runSeedMasterData() {
    console.log('\n🌱 Starting Master Data Seeding...\n');
    try {
        await ensureMeterMasterData();
        console.log('\n✅ Master Data Seeding completed successfully!\n');
    } catch (error: any) {
        console.error('❌ Master Data Seeding failed:', error.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    runSeedMasterData();
}

export { runSeedMasterData };

