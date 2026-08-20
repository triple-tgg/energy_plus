const crypto = require('crypto');

const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg7emgOEsn1Qe9IrNd
TWOV9Zb+v4I2lhWug3CrIJSt1I6hRANCAARpJ2iR9KGCVVoNh7xDV7JlB8Pzel79
DAbcqjzXt9smLwUaH9S11fA+pGDbULCvWmjm3w6xKMpPvnOoIpbzpWrR
-----END PRIVATE KEY-----`;

function generateLicense({
    customerName = 'KE Group',
    licenseType = 'Enterprise',
    maxMeters = 50,
    daysValid = 0, // 0 = never expires
    features = ['dashboard', 'monitoring', 'reports', 'meters', 'alarms', 'billing', 'demand_control']
} = {}) {
    const issuedDate = new Date();
    let expiryDate = null;

    if (daysValid && daysValid > 0) {
        const exp = new Date(issuedDate);
        exp.setDate(exp.getDate() + daysValid);
        expiryDate = exp.toISOString();
    }

    const payload = {
        customerName,
        licenseType,
        maxMeters: parseInt(maxMeters, 10),
        issuedDate: issuedDate.toISOString(),
        expiryDate,
        features
    };

    // Canonical payload string for signature
    const payloadString = JSON.stringify(payload);

    // Sign payload using ECDSA SHA-256
    const sign = crypto.createSign('SHA256');
    sign.update(payloadString);
    sign.end();
    const signature = sign.sign(PRIVATE_KEY, 'base64');

    const tokenObject = {
        payload,
        signature
    };

    // Encode the entire license structure to Base64
    const licenseKey = Buffer.from(JSON.stringify(tokenObject), 'utf8').toString('base64');

    return {
        licenseKey,
        payload,
        signature
    };
}

// If run directly from CLI
if (require.main === module) {
    const args = process.argv.slice(2);
    let customer = 'KE Group';
    let meters = 50;
    let days = 0; // 0 = never expires

    for (const arg of args) {
        if (arg.startsWith('--customer=')) customer = arg.split('=')[1];
        if (arg.startsWith('--meters=')) meters = parseInt(arg.split('=')[1], 10);
        if (arg.startsWith('--days=')) days = parseInt(arg.split('=')[1], 10);
    }

    const license = generateLicense({ customerName: customer, maxMeters: meters, daysValid: days });
    console.log('\n======================================================');
    console.log('  🔑 ENERGY+ CRYPTOGRAPHIC LICENSE KEY GENERATED');
    console.log('======================================================');
    console.log('Customer:    ', license.payload.customerName);
    console.log('Type:        ', license.payload.licenseType);
    console.log('Max Meters:  ', license.payload.maxMeters);
    console.log('Issued Date: ', license.payload.issuedDate);
    console.log('Expiry Date: ', license.payload.expiryDate || 'Never');
    console.log('Features:    ', license.payload.features.join(', '));
    console.log('------------------------------------------------------');
    console.log('LICENSE KEY:\n');
    console.log(license.licenseKey);
    console.log('\n======================================================\n');
}

module.exports = { generateLicense };
