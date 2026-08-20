import { AuthService } from '../src/modules/auth/auth.service';
import pool from '../src/config/database';

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
    } catch (err: any) {
        console.error('❌ Login FAILED:', err.message);
    } finally {
        await pool.end();
    }
}

testLogin();
