const fs = require('fs');
const path = require('path');
const { ReportsService } = require('../dist/modules/reports/reports.service');
const pool = require('../dist/config/database').default;

async function run() {
    const svc = new ReportsService();
    console.log('Fetching meters and generating outputs...\n');

    // 1. Check total meters in DB
    const meterCountRes = await pool.query('SELECT count(*) as total, count(*) FILTER (WHERE is_active IS DISTINCT FROM false) as active FROM meter');
    console.log('Total meters in DB:', meterCountRes.rows[0].total, '| Active:', meterCountRes.rows[0].active);

    // 2. Sample meters
    const sampleMeters = await pool.query(`
        SELECT m.meter_id, m.meter_code, m.meter_name, m.room_code, m.meter_group,
               m.lease_number, m.vr_number, mt.meter_type_name
        FROM meter m
        LEFT JOIN meter_type mt ON mt.meter_type_id = m.meter_type_id
        WHERE m.is_active IS DISTINCT FROM false
        LIMIT 5
    `);
    console.log('Sample meters:', sampleMeters.rows);

    // 3. Generate Electricity CSV
    console.log('\nGenerating Electricity CSV...');
    const elecResult = await svc.getMeterReadingsReport({
        startDate: '2026-10-01',
        endDate: '2026-10-22',
        utilityType: 'electric',
        delimiter: 'pipe',
    });
    console.log(`Generated ${elecResult.total} rows for electricity`);
    const elecPath = path.join(__dirname, '..', '..', 'output_meter_readings_electric_2026_10.csv');
    fs.writeFileSync(elecPath, '\uFEFF' + elecResult.csv, 'utf8');
    console.log('Saved to:', elecPath);

    // 4. Generate Water CSV
    console.log('\nGenerating Water CSV...');
    const waterResult = await svc.getMeterReadingsReport({
        startDate: '2026-10-01',
        endDate: '2026-10-22',
        utilityType: 'water',
        delimiter: 'pipe',
    });
    console.log(`Generated ${waterResult.total} rows for water`);
    const waterPath = path.join(__dirname, '..', '..', 'output_meter_readings_water_2026_10.csv');
    fs.writeFileSync(waterPath, '\uFEFF' + waterResult.csv, 'utf8');
    console.log('Saved to:', waterPath);

    // 5. Generate All Meters CSV (both comma and pipe)
    console.log('\nGenerating All Meters CSV (Pipe)...');
    const allResult = await svc.getMeterReadingsReport({
        startDate: '2026-10-01',
        endDate: '2026-10-22',
        utilityType: 'all',
        delimiter: 'pipe',
    });
    const allPipePath = path.join(__dirname, '..', '..', 'output_meter_readings_all_pipe_2026_10.csv');
    fs.writeFileSync(allPipePath, '\uFEFF' + allResult.csv, 'utf8');
    console.log('Saved to:', allPipePath);

    console.log('\nGenerating All Meters CSV (Comma separated)...');
    const allCommaResult = await svc.getMeterReadingsReport({
        startDate: '2026-10-01',
        endDate: '2026-10-22',
        utilityType: 'all',
        delimiter: 'comma',
    });
    const allCommaPath = path.join(__dirname, '..', '..', 'output_meter_readings_all_comma_2026_10.csv');
    fs.writeFileSync(allCommaPath, '\uFEFF' + allCommaResult.csv, 'utf8');
    console.log('Saved to:', allCommaPath);

    // Print first 10 lines of electric CSV
    console.log('\n=== PREVIEW: Electricity CSV Output (first 10 lines) ===');
    console.log(elecResult.csv.split('\r\n').slice(0, 10).join('\n'));

    // Print first 10 lines of water CSV
    console.log('\n=== PREVIEW: Water CSV Output (first 10 lines) ===');
    console.log(waterResult.csv.split('\r\n').slice(0, 10).join('\n'));

    await pool.end();
}

run().catch(err => {
    console.error('Run error:', err);
    pool.end();
});
