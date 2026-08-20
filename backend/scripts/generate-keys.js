const crypto = require('crypto');

// Generate ECDSA P-256 (prime256v1) keypair
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
    },
    privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
    }
});

console.log('PUBLIC KEY:\n', publicKey);
console.log('PRIVATE KEY:\n', privateKey);
