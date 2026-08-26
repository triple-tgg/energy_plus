import crypto from 'crypto';
import { LicensePayload } from '../config/license.config';

const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg7emgOEsn1Qe9IrNd
TWOV9Zb+v4I2lhWug3CrIJSt1I6hRANCAARpJ2iR9KGCVVoNh7xDV7JlB8Pzel79
DAbcqjzXt9smLwUaH9S11fA+pGDbULCvWmjm3w6xKMpPvnOoIpbzpWrR
-----END PRIVATE KEY-----`;

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
