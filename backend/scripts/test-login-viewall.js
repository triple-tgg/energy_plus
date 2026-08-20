const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { AuthService } = require('../dist/modules/auth/auth.service');

async function testLogin() {
    const authService = new AuthService();
    console.log('🔑 Testing login with viewall / viewall123...');

    try {
        const res = await authService.login({
            username: 'viewall',
            password: 'viewall123',
        });

        console.log('✅ Login SUCCESS!');
        console.log('\n--- User Profile Returned ---');
        console.log(JSON.stringify(res.user, null, 2));
    } catch (err) {
        console.error('❌ Login FAILED:', err.message);
    }
}

testLogin();
