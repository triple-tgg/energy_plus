import crypto from 'crypto';
import { query } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import {
    LICENSE_CONFIG,
    LicensePayload,
    LicenseTokenStructure,
    LicenseStatusResult
} from '../../config/license.config';

export class LicenseService {
    /**
     * Decode and verify cryptographic digital signature of a License Token
     */
    verifyLicenseToken(tokenString: string): LicensePayload {
        if (!tokenString || typeof tokenString !== 'string') {
            throw new AppError(400, 'INVALID_LICENSE', 'กรุณาระบุ License Key');
        }

        let tokenObject: LicenseTokenStructure;
        try {
            const jsonStr = Buffer.from(tokenString.trim(), 'base64').toString('utf8');
            tokenObject = JSON.parse(jsonStr);
        } catch (e) {
            throw new AppError(400, 'INVALID_LICENSE_FORMAT', 'รูปแบบ License Key ไม่ถูกต้อง (Invalid Base64/JSON format)');
        }

        if (!tokenObject.payload || !tokenObject.signature) {
            throw new AppError(400, 'MALFORMED_LICENSE', 'โครงสร้าง License Key ไม่สมบูรณ์');
        }

        const { payload, signature } = tokenObject;

        // 1. Verify ECDSA signature using embedded Public Key
        const payloadString = JSON.stringify(payload);
        const verifier = crypto.createVerify('SHA256');
        verifier.update(payloadString);
        verifier.end();

        const isSignatureValid = verifier.verify(LICENSE_CONFIG.PUBLIC_KEY, signature, 'base64');
        if (!isSignatureValid) {
            throw new AppError(400, 'LICENSE_SIGNATURE_INVALID', 'ลายเซ็นดิจิทัลของ License Key ไม่ถูกต้องหรือถูกแก้ไข (Cryptographic Signature Verification Failed)');
        }

        // 2. Validate essential fields
        if (typeof payload.maxMeters !== 'number' || payload.maxMeters <= 0) {
            throw new AppError(400, 'INVALID_LICENSE_PAYLOAD', 'จำนวนโควตามิเตอร์ใน License ไม่ถูกต้อง');
        }

        // 3. Check expiration date if present
        if (payload.expiryDate) {
            const expiry = new Date(payload.expiryDate);
            if (isNaN(expiry.getTime())) {
                throw new AppError(400, 'INVALID_EXPIRY_DATE', 'รูปแบบวันหมดอายุใน License ไม่ถูกต้อง');
            }
            if (new Date() > expiry) {
                throw new AppError(400, 'LICENSE_EXPIRED', `License Key หมดอายุแล้วตั้งแต่วันที่ ${expiry.toLocaleDateString('th-TH')}`);
            }
        }

        return payload;
    }

    /**
     * Retrieve current active license from database or initialize default
     */
    async getCurrentLicenseRecord(): Promise<any> {
        // Ensure system_license table exists
        await this.ensureTableExists();

        const result = await query(
            `SELECT * FROM system_license WHERE is_valid = true ORDER BY id DESC LIMIT 1`
        );

        if (result.rows.length === 0) {
            // Seed default initial license (50 meters)
            return await this.seedDefaultLicense();
        }

        return result.rows[0];
    }

    /**
     * Count meters consuming license quota.
     * Every meter record counts, whether it is active or not.
     */
    private async countLicensedMeters(): Promise<number> {
        const countRes = await query(`SELECT COUNT(*) FROM meter`);
        return parseInt(countRes.rows[0].count, 10);
    }

    /**
     * Check if meter creation is within quota
     */
    async checkMeterQuota(additionalMeters: number = 1): Promise<{
        allowed: boolean;
        current: number;
        max: number;
        remaining: number;
        usagePercentage: number;
        license: LicensePayload;
    }> {
        const licenseRecord = await this.getCurrentLicenseRecord();
        const maxMeters = licenseRecord.max_meters || LICENSE_CONFIG.DEFAULT_FALLBACK_METERS;

        const currentMeters = await this.countLicensedMeters();

        const newTotal = currentMeters + additionalMeters;
        const allowed = newTotal <= maxMeters;
        const remaining = Math.max(0, maxMeters - currentMeters);
        const usagePercentage = Math.min(100, Math.round((currentMeters / maxMeters) * 100));

        return {
            allowed,
            current: currentMeters,
            max: maxMeters,
            remaining,
            usagePercentage,
            license: {
                customerName: licenseRecord.customer_name,
                maxMeters,
                issuedDate: licenseRecord.issued_date,
                expiryDate: licenseRecord.expiry_date
            }
        };
    }

    /**
     * Activate a new cryptographic license key
     */
    async activateLicense(tokenString: string, userId?: number): Promise<LicenseStatusResult> {
        const payload = this.verifyLicenseToken(tokenString);

        await this.ensureTableExists();

        // Invalidate old active licenses
        await query(`UPDATE system_license SET is_valid = false WHERE is_valid = true`);

        // Insert new active license
        await query(
            `INSERT INTO system_license (
                license_key, customer_name, max_meters, features, issued_date, expiry_date, is_valid, last_verified_on, created_on
            ) VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())`,
            [
                tokenString.trim(),
                payload.customerName || 'Customer',
                payload.maxMeters,
                JSON.stringify(payload.features || []),
                payload.issuedDate || new Date().toISOString(),
                payload.expiryDate || null
            ]
        );

        return await this.getLicenseStatus(true);
    }

    /**
     * Get detailed license status for UI display.
     * The full key is only included for admins — everyone else gets the masked form.
     */
    async getLicenseStatus(includeFullKey: boolean = false): Promise<LicenseStatusResult> {
        const license = await this.getCurrentLicenseRecord();
        const usedMeters = await this.countLicensedMeters();
        const maxMeters = license.max_meters || LICENSE_CONFIG.DEFAULT_FALLBACK_METERS;
        const remainingMeters = Math.max(0, maxMeters - usedMeters);
        const usagePercentage = Math.min(100, Math.round((usedMeters / maxMeters) * 100));

        let daysRemaining: number | null = null;
        let isExpired = false;

        if (license.expiry_date) {
            const expTime = new Date(license.expiry_date).getTime();
            const nowTime = Date.now();
            const diffMs = expTime - nowTime;
            daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            if (daysRemaining < 0) {
                isExpired = true;
                daysRemaining = 0;
            }
        }

        const rawKey = String(license.license_key || '');
        const licenseKeyMasked = rawKey.length > 20
            ? `${rawKey.slice(0, 10)}...${rawKey.slice(-10)}`
            : rawKey;

        return {
            isValid: !isExpired,
            customerName: license.customer_name || 'KE Group',
            licenseType: license.license_type || 'Enterprise',
            maxMeters,
            usedMeters,
            remainingMeters,
            usagePercentage,
            issuedDate: license.issued_date,
            expiryDate: license.expiry_date,
            daysRemaining,
            isExpired,
            features: Array.isArray(license.features) ? license.features : [],
            licenseKeyMasked,
            ...(includeFullKey ? { licenseKey: rawKey } : {})
        };
    }

    /**
     * Ensure system_license table exists in Postgres
     */
    private async ensureTableExists(): Promise<void> {
        await query(`
            CREATE TABLE IF NOT EXISTS system_license (
                id SERIAL PRIMARY KEY,
                license_key TEXT NOT NULL,
                customer_name VARCHAR(200),
                license_type VARCHAR(100) DEFAULT 'Enterprise',
                max_meters INTEGER NOT NULL DEFAULT 50,
                features JSONB DEFAULT '[]',
                issued_date TIMESTAMPTZ,
                expiry_date TIMESTAMPTZ,
                is_valid BOOLEAN DEFAULT true,
                last_verified_on TIMESTAMPTZ DEFAULT NOW(),
                created_on TIMESTAMPTZ DEFAULT NOW()
            )
        `);
    }

    /**
     * Seed initial valid license if database is fresh
     */
    private async seedDefaultLicense(): Promise<any> {
        const { daysValid } = LICENSE_CONFIG.DEFAULT_LICENSE;
        const issuedDate = new Date();
        let expiryDate: Date | null = null;
        if (daysValid > 0) {
            expiryDate = new Date(issuedDate);
            expiryDate.setDate(expiryDate.getDate() + daysValid);
        }

        // Sign the default license when the offline generator is available (dev / full image).
        // If it is not bundled, still seed an unsigned record so the API stays usable —
        // quota is enforced from max_meters, and activating a real key always requires a valid signature.
        let licenseKey = '';
        try {
            const path = require('path');
            const { generateLicense } = require(path.resolve(__dirname, '../../../scripts/generate-license'));
            licenseKey = generateLicense(LICENSE_CONFIG.DEFAULT_LICENSE).licenseKey;
        } catch (e) {
            licenseKey = 'BUILTIN-DEFAULT';
        }

        const insertRes = await query(
            `INSERT INTO system_license (
                license_key, customer_name, license_type, max_meters, features, issued_date, expiry_date, is_valid, last_verified_on, created_on
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW()) RETURNING *`,
            [
                licenseKey,
                LICENSE_CONFIG.DEFAULT_LICENSE.customerName,
                LICENSE_CONFIG.DEFAULT_LICENSE.licenseType,
                LICENSE_CONFIG.DEFAULT_LICENSE.maxMeters,
                JSON.stringify(LICENSE_CONFIG.DEFAULT_LICENSE.features),
                issuedDate.toISOString(),
                expiryDate ? expiryDate.toISOString() : null
            ]
        );

        return insertRes.rows[0];
    }
}

export const licenseService = new LicenseService();
