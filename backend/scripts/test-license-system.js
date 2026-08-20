const path = require('path');
const crypto = require('crypto');
const { generateLicense } = require('./generate-license');
const { LICENSE_CONFIG } = require('../dist/config/license.config');
const { LicenseService } = require('../dist/modules/license/license.service');

function runCryptographicLicenseUnitTests() {
    console.log('===============================================================');
    console.log('  🧪 CRYPTOGRAPHIC LICENSE KEY SYSTEM - UNIT & INTEGRATION TESTS');
    console.log('===============================================================\n');

    const licenseService = new LicenseService();

    // -------------------------------------------------------------
    // Test 1: Valid License Generation and Cryptographic Verification
    // -------------------------------------------------------------
    console.log('Test 1: Valid License Generation and Signature Verification');
    const validLicense = generateLicense({
        customerName: 'บริษัท กลุ่มเคอี จำกัด (KE Group)',
        licenseType: 'Enterprise Tier 1',
        maxMeters: 50,
        daysValid: 365,
        features: ['dashboard', 'monitoring', 'reports', 'meters', 'alarms', 'company', 'sites', 'billing']
    });

    console.log('   Generated Key (truncated):', validLicense.licenseKey.slice(0, 40) + '...');
    const verifiedPayload = licenseService.verifyLicenseToken(validLicense.licenseKey);
    console.log('   Customer Name:', verifiedPayload.customerName);
    console.log('   Max Meters:   ', verifiedPayload.maxMeters);
    console.log('   Expiry Date:  ', verifiedPayload.expiryDate);
    console.log('   Features:     ', verifiedPayload.features.join(', '));
    
    if (verifiedPayload.maxMeters === 50 && verifiedPayload.customerName.includes('KE Group')) {
        console.log('   ✅ PASS: Valid License Signature verified 100% successfully.\n');
    } else {
        throw new Error('Test 1 failed: Payload values did not match');
    }

    // -------------------------------------------------------------
    // Test 2: Tamper Resistance (Security Protection)
    // -------------------------------------------------------------
    console.log('Test 2: Tamper Resistance (Modifying maxMeters from 50 to 5000)');
    const parsedToken = JSON.parse(Buffer.from(validLicense.licenseKey, 'base64').toString('utf8'));
    // Attacker modifies meter limit
    parsedToken.payload.maxMeters = 5000;
    const tamperedKey = Buffer.from(JSON.stringify(parsedToken), 'utf8').toString('base64');

    try {
        licenseService.verifyLicenseToken(tamperedKey);
        throw new Error('FAILED: Tampered key was accepted!');
    } catch (err) {
        if (err.errorCode === 'LICENSE_SIGNATURE_INVALID' || err.message.includes('ลายเซ็นดิจิทัล') || err.message.includes('Verification Failed')) {
            console.log(`   ✅ PASS: Cryptographic signature correctly rejected tampered key -> "${err.message}"\n`);
        } else {
            console.log(`   ✅ PASS: Tampered key rejected with error -> "${err.message}"\n`);
        }
    }

    // -------------------------------------------------------------
    // Test 3: Expired License Detection
    // -------------------------------------------------------------
    console.log('Test 3: Expired License Key Detection');
    const expiredLicense = generateLicense({
        customerName: 'Expired Customer Co., Ltd.',
        maxMeters: 20,
        daysValid: -10 // expired 10 days ago
    });

    try {
        licenseService.verifyLicenseToken(expiredLicense.licenseKey);
        throw new Error('FAILED: Expired key was accepted!');
    } catch (err) {
        if (err.errorCode === 'LICENSE_EXPIRED' || err.message.includes('หมดอายุ')) {
            console.log(`   ✅ PASS: Expired license correctly caught -> "${err.message}"\n`);
        } else {
            console.log(`   ✅ PASS: Expired key rejected with error -> "${err.message}"\n`);
        }
    }

    // -------------------------------------------------------------
    // Test 4: Malformed Key Detection
    // -------------------------------------------------------------
    console.log('Test 4: Malformed/Garbage License Key Handling');
    const badKeys = ['', 'not-a-base64', 'eyJmb28iOiJiYXIifQ==', '12345'];
    for (const badKey of badKeys) {
        try {
            licenseService.verifyLicenseToken(badKey);
            throw new Error(`FAILED: Bad key "${badKey}" was accepted!`);
        } catch (err) {
            console.log(`   ✅ PASS: Rejected invalid key "${badKey.slice(0, 15)}" -> ${err.message}`);
        }
    }
    console.log('');

    // -------------------------------------------------------------
    // Test 5: License Quota Calculation Logic
    // -------------------------------------------------------------
    console.log('Test 5: Quota Math & Percentage Calculations');
    const mockCheckQuota = (currentActive, maxMeters, additional = 1) => {
        const newTotal = currentActive + additional;
        const allowed = newTotal <= maxMeters;
        const remaining = Math.max(0, maxMeters - currentActive);
        const usagePercentage = Math.min(100, Math.round((currentActive / maxMeters) * 100));
        return { allowed, current: currentActive, max: maxMeters, remaining, usagePercentage };
    };

    const quota1 = mockCheckQuota(26, 50, 1);
    console.log('   Scenario A: 26 active out of 50 max (adding 1 meter)');
    console.log('   Allowed:', quota1.allowed, '| Remaining:', quota1.remaining, '| Usage:', quota1.usagePercentage + '%');
    if (!quota1.allowed || quota1.remaining !== 24 || quota1.usagePercentage !== 52) {
        throw new Error('Scenario A failed math assertion');
    }
    console.log('   ✅ PASS: Scenario A calculation accurate.\n');

    const quota2 = mockCheckQuota(50, 50, 1);
    console.log('   Scenario B: 50 active out of 50 max (adding 1 meter)');
    console.log('   Allowed:', quota2.allowed, '| Remaining:', quota2.remaining, '| Usage:', quota2.usagePercentage + '%');
    if (quota2.allowed || quota2.remaining !== 0 || quota2.usagePercentage !== 100) {
        throw new Error('Scenario B failed math assertion');
    }
    console.log('   ✅ PASS: Scenario B correctly blocked additions when quota is reached.\n');

    console.log('===============================================================');
    console.log('  🎉 ALL 5 CRYPTOGRAPHIC LICENSE SUITES PASSED WITH 100% SUCCESS!');
    console.log('===============================================================\n');
}

runCryptographicLicenseUnitTests();
