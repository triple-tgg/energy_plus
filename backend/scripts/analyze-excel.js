const path = require('path');
const XLSX = require(path.join(__dirname, '..', 'node_modules', 'xlsx'));

const filePath = path.join(__dirname, '..', '..', 'M Sofemplate-\u0e08\u0e23\u0e23\u0e22\u0e27\u0e23\u0e23\u0e18.xlsx');
const wb = XLSX.readFile(filePath);
const sheet = wb.Sheets['Sheet1'];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

// Column mapping from header row (row index 2)
const headerRow = rows[2];
console.log('Header:', JSON.stringify(headerRow));

// Based on previous analysis:
// Col 4 = (Site EL), Col 12 = Meter Code, Col 16 = Address, Col 3 = Site
const COL = {
    no: 0,
    circuit: 2,
    siteName: 3,
    siteEl: 4,
    building: 5,
    meterCode: 12,
    address: 16,
    roomCode: 8,
    roomName: 9,
};

// Simulate the full import logic to find duplicates
const dataRows = [];
for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || !row.some(x => x != null && x !== '')) continue;
    
    const meterCode = row[COL.meterCode] != null ? String(row[COL.meterCode]).trim() : '';
    const address = row[COL.address] != null ? String(row[COL.address]).trim() : '';
    const siteName = row[COL.siteName] != null ? String(row[COL.siteName]).trim() : '';
    const siteEl = row[COL.siteEl] != null ? String(row[COL.siteEl]).trim() : '';
    const building = row[COL.building] != null ? String(row[COL.building]).trim() : '';
    const roomCode = row[COL.roomCode] != null ? String(row[COL.roomCode]).trim() : '';
    
    dataRows.push({
        excelRow: i + 1,
        no: row[COL.no],
        meterCode,
        address,
        siteName,
        siteEl,
        building,
        roomCode,
    });
}

console.log(`\nTotal data rows: ${dataRows.length}`);

// === Check 1: Duplicate meter_code ===
console.log('\n' + '='.repeat(60));
console.log('CHECK 1: DUPLICATE meter_code');
console.log('='.repeat(60));

const codeMap = new Map();
dataRows.forEach(r => {
    if (!r.meterCode) return;
    if (!codeMap.has(r.meterCode)) {
        codeMap.set(r.meterCode, []);
    }
    codeMap.get(r.meterCode).push(r);
});

let dupCodeCount = 0;
for (const [code, entries] of codeMap) {
    if (entries.length > 1) {
        dupCodeCount++;
        console.log(`  meter_code "${code}" appears ${entries.length} times:`);
        entries.forEach(e => {
            console.log(`    - Excel row ${e.excelRow}, No=${e.no}, Site=${e.siteName}, Building=${e.building}, Address=${e.address}`);
        });
    }
}
if (dupCodeCount === 0) console.log('  No duplicate meter_code found');

const uniqueCodes = new Set(dataRows.map(r => r.meterCode).filter(Boolean));
console.log(`\n  Unique meter_code values: ${uniqueCodes.size} (from ${dataRows.length} rows)`);

// === Check 2: Duplicate site + address (simulating backend logic) ===
console.log('\n' + '='.repeat(60));
console.log('CHECK 2: DUPLICATE site_name + address (backend dedup)');
console.log('='.repeat(60));

// The backend generates address from different sources
// Let's simulate what address each row would actually get

const siteAddrMap = new Map();
dataRows.forEach(r => {
    // Backend logic: modbusAddr comes from row.address, or derived from siteEl
    let modbusAddr = r.address;
    
    // If no address, backend derives from siteEl (e.g. "1021_1" -> derivedAddressFromEl = "1")
    if (!modbusAddr && r.siteEl && r.siteEl.includes('_')) {
        const parts = r.siteEl.split('_');
        modbusAddr = parts[1] || '';
    }
    
    // If still no address, backend falls back to row index
    if (!modbusAddr) {
        modbusAddr = String(dataRows.indexOf(r) + 1);
    }
    
    // siteName is used to look up/create site_id
    const key = `${r.siteName}||${modbusAddr}`;
    if (!siteAddrMap.has(key)) {
        siteAddrMap.set(key, []);
    }
    siteAddrMap.get(key).push({ ...r, resolvedAddress: modbusAddr });
});

let dupAddrCount = 0;
for (const [key, entries] of siteAddrMap) {
    if (entries.length > 1) {
        dupAddrCount++;
        console.log(`  site+address "${key}" has ${entries.length} rows:`);
        entries.forEach(e => {
            console.log(`    - Excel row ${e.excelRow}, No=${e.no}, meterCode=${e.meterCode}, Building=${e.building}`);
        });
    }
}
if (dupAddrCount === 0) console.log('  No duplicate site+address found');

console.log(`\n  Unique site+address combinations: ${siteAddrMap.size}`);

// === Simulate full import to count actual unique meters ===
console.log('\n' + '='.repeat(60));
console.log('SIMULATION: Full import dedup (same logic as backend)');
console.log('='.repeat(60));

// Simulating backend importMeters() logic
const meterByCode = new Map();  // meter_code -> latest row
const meterBySiteAddr = new Map();  // site+address -> meter_id placeholder

let imported = 0;
let updated = 0;
const finalMeters = new Map(); // meter_id (simulated) -> row data

let nextId = 1;

for (const r of dataRows) {
    let modbusAddr = r.address;
    if (!modbusAddr && r.siteEl && r.siteEl.includes('_')) {
        modbusAddr = r.siteEl.split('_')[1] || '';
    }
    if (!modbusAddr) modbusAddr = String(dataRows.indexOf(r) + 1);
    
    let meterCode = r.meterCode;
    if (!meterCode) {
        meterCode = r.roomCode || `${r.siteName}_M${modbusAddr}`;
    }
    
    let existingId = null;
    
    // Check 1: by meter_code
    if (meterCode && meterByCode.has(meterCode)) {
        existingId = meterByCode.get(meterCode);
    }
    
    // Check 2: by site + address (if not found by code)
    if (!existingId && modbusAddr) {
        const siteKey = `${r.siteName}||${modbusAddr}`;
        if (meterBySiteAddr.has(siteKey)) {
            existingId = meterBySiteAddr.get(siteKey);
        }
    }
    
    if (existingId) {
        // UPDATE existing
        finalMeters.set(existingId, { ...r, resolvedAddress: modbusAddr, resolvedCode: meterCode });
        updated++;
    } else {
        // INSERT new
        const newId = nextId++;
        finalMeters.set(newId, { ...r, resolvedAddress: modbusAddr, resolvedCode: meterCode });
        meterByCode.set(meterCode, newId);
        const siteKey = `${r.siteName}||${modbusAddr}`;
        meterBySiteAddr.set(siteKey, newId);
        imported++;
    }
}

console.log(`  Processed: ${dataRows.length} rows`);
console.log(`  Imported (new):     ${imported}`);
console.log(`  Updated (existing): ${updated}`);
console.log(`  Final unique meters in DB: ${finalMeters.size}`);
console.log(`  Missing: ${dataRows.length - finalMeters.size} rows were updates to existing meters`);

if (updated > 0) {
    console.log('\n  === ROWS THAT UPDATED (overwrote) EXISTING METERS ===');
    // Find which rows caused updates
    const codeToFirstRow = new Map();
    const addrToFirstRow = new Map();
    
    for (const r of dataRows) {
        let modbusAddr = r.address;
        if (!modbusAddr && r.siteEl && r.siteEl.includes('_')) {
            modbusAddr = r.siteEl.split('_')[1] || '';
        }
        if (!modbusAddr) modbusAddr = String(dataRows.indexOf(r) + 1);
        
        let meterCode = r.meterCode;
        if (!meterCode) {
            meterCode = r.roomCode || `${r.siteName}_M${modbusAddr}`;
        }
        
        const siteKey = `${r.siteName}||${modbusAddr}`;
        
        if (codeToFirstRow.has(meterCode)) {
            const first = codeToFirstRow.get(meterCode);
            console.log(`  Row ${r.excelRow} (No=${r.no}) OVERWROTE Row ${first.excelRow} (No=${first.no}) — same meter_code="${meterCode}"`);
        } else {
            codeToFirstRow.set(meterCode, r);
        }
        
        if (!codeToFirstRow.has(meterCode + '_addr') && addrToFirstRow.has(siteKey) && !codeToFirstRow.has(meterCode)) {
            const first = addrToFirstRow.get(siteKey);
            console.log(`  Row ${r.excelRow} (No=${r.no}) OVERWROTE Row ${first.excelRow} (No=${first.no}) — same site+address="${siteKey}"`);
        }
        if (!addrToFirstRow.has(siteKey)) {
            addrToFirstRow.set(siteKey, r);
        }
    }
}
