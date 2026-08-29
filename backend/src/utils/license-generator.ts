import crypto from 'crypto';
import { LicensePayload } from '../config/license.config';

/**
 * The ECDSA P-256 private key is read from the LICENSE_PRIVATE_KEY
 * environment variable.  This key must NEVER be committed to source
 * control or baked into production Docker images.
 *
 * Set it only in trusted environments (dev machine, CI for seeding).
 */
function getPrivateKey(): string {
    const key = process.env.LICENSE_PRIVATE_KEY;
    if (!key) {
        throw new Error(
            'LICENSE_PRIVATE_KEY environment variable is not set. ' +
            'License generation is only available in trusted environments.'
        );
    }
    return key.replace(/\\n/g, '\n');
}

export interface GenerateLicenseOptions {
    customerName?: string;
    licenseType?: string;
    maxMeters?: number;
    daysValid?: number;
    features?: string[];
}

export function generateLicense({
    customerName = 'KE Group',
    licenseType = 'Enterprise',
    maxMeters = 5,
    daysValid = 0, // 0 = never expires
    features = ['dashboard', 'monitoring', 'reports', 'meters', 'alarms', 'billing', 'demand_control']
}: GenerateLicenseOptions = {}): {
    licenseKey: string;
    payload: LicensePayload;
    signature: string;
} {
    const issuedDate = new Date();
    let expiryDate: string | null = null;

    if (daysValid && daysValid > 0) {
        const exp = new Date(issuedDate);
        exp.setDate(exp.getDate() + daysValid);
        expiryDate = exp.toISOString();
    }

    const payload: LicensePayload = {
        customerName,
        licenseType,
        maxMeters: parseInt(String(maxMeters), 10) || 50,
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
    const signature = sign.sign(getPrivateKey(), 'base64');

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
