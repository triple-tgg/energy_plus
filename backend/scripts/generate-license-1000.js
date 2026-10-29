const crypto = require('crypto');

const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg7emgOEsn1Qe9IrNd
TWOV9Zb+v4I2lhWug3CrIJSt1I6hRANCAARpJ2iR9KGCVVoNh7xDV7JlB8Pzel79
DAbcqjzXt9smLwUaH9S11fA+pGDbULCvWmjm3w6xKMpPvnOoIpbzpWrR
-----END PRIVATE KEY-----`;

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEaSdokfShglVaDYe8Q1eyZQfD83pe
/QwG3Ko817fbJi8FGh/UtdXwPqRg21Cwr1po5t8OsSjKT75zqCKW86Vq0Q==
-----END PUBLIC KEY-----`;

// === Configuration ===
const customerName = 'Wanwanach';
const licenseType = 'Enterprise';
const maxMeters = 1000;
const daysValid = 0;  // 0 = never expires
const features = ['dashboard', 'monitoring', 'reports', 'meters', 'alarms', 'company', 'sites', 'billing', 'settings'];

// === Generate ===
const issuedDate = new Date();
let expiryDate = null;
if (daysValid > 0) {
    const exp = new Date(issuedDate);
    exp.setDate(exp.getDate() + daysValid);
    expiryDate = exp.toISOString();
}

const payload = {
    customerName,
    licenseType,
    maxMeters,
    issuedDate: issuedDate.toISOString(),
    expiryDate,
    features
};

const payloadString = JSON.stringify(payload);

// Sign with ECDSA SHA-256
const sign = crypto.createSign('SHA256');
sign.update(payloadString);
sign.end();
const signature = sign.sign(PRIVATE_KEY, 'base64');

const tokenObject = { payload, signature };
const licenseKey = Buffer.from(JSON.stringify(tokenObject), 'utf8').toString('base64');

// Verify the signature
const verifier = crypto.createVerify('SHA256');
verifier.update(payloadString);
verifier.end();
const isValid = verifier.verify(PUBLIC_KEY, signature, 'base64');

console.log('='.repeat(60));
console.log('  LICENSE KEY GENERATED');
console.log('='.repeat(60));
console.log(`  Customer:    ${customerName}`);
console.log(`  Type:        ${licenseType}`);
console.log(`  Max Meters:  ${maxMeters}`);
console.log(`  Issued:      ${issuedDate.toISOString()}`);
console.log(`  Expiry:      ${expiryDate || 'Never'}`);
console.log(`  Features:    ${features.join(', ')}`);
console.log(`  Signature:   Valid = ${isValid}`);
console.log('='.repeat(60));
console.log('\nLICENSE KEY:\n');
console.log(licenseKey);
console.log('\n' + '='.repeat(60));
