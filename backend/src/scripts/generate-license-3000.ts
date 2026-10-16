/**
 * Generate a signed license key for 3000 devices.
 *
 * Usage:
 *   npx ts-node src/scripts/generate-license-3000.ts
 *
 * Requires LICENSE_PRIVATE_KEY in backend/.env
 */
import path from 'path';
import dotenv from 'dotenv';

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { generateLicense } from '../utils/license-generator';

const result = generateLicense({
    customerName: 'MSoft Energy Plus',
    licenseType: 'Enterprise',
    maxMeters: 3000,
    daysValid: 0, // 0 = never expires
    features: [
        'dashboard',
        'monitoring',
        'reports',
        'meters',
        'alarms',
        'company',
        'sites',
        'billing',
        'settings',
        'demand_control'
    ]
});

console.log('');
console.log('═══════════════════════════════════════════════════');
console.log('  🔑 License Key Generated Successfully');
console.log('═══════════════════════════════════════════════════');
console.log('');
console.log('📋 License Details:');
console.log(`   Customer   : ${result.payload.customerName}`);
console.log(`   Type       : ${result.payload.licenseType}`);
console.log(`   Max Meters : ${result.payload.maxMeters}`);
console.log(`   Issued     : ${result.payload.issuedDate}`);
console.log(`   Expiry     : ${result.payload.expiryDate || 'Never (Permanent)'}`);
console.log(`   Features   : ${result.payload.features?.join(', ')}`);
console.log('');
console.log('🔐 License Key (copy this entire string):');
console.log('───────────────────────────────────────────────────');
console.log(result.licenseKey);
console.log('───────────────────────────────────────────────────');
console.log('');
console.log('📌 How to activate:');
console.log('   1. Login as admin');
console.log('   2. Go to Settings > License & Quota');
console.log('   3. Paste the license key above');
console.log('   4. Click "Activate"');
console.log('');
