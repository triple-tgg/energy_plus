export const LICENSE_CONFIG = {
    // Embedded ECDSA P-256 Public Key used to verify license signatures
    PUBLIC_KEY: `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEaSdokfShglVaDYe8Q1eyZQfD83pe
/QwG3Ko817fbJi8FGh/UtdXwPqRg21Cwr1po5t8OsSjKT75zqCKW86Vq0Q==
-----END PUBLIC KEY-----`,

    // Fallback meter quota if no license is found
    DEFAULT_FALLBACK_METERS: 1,

    // License seeded automatically on a fresh database.
    // daysValid = 0 means the license never expires.
    DEFAULT_LICENSE: {
        customerName: 'Wanwanach',
        licenseType: 'Enterprise Standard',
        maxMeters: 1,
        daysValid: 0,
        features: ['dashboard', 'monitoring', 'reports', 'meters', 'alarms', 'company', 'sites', 'billing', 'settings']
    },
};

export interface LicensePayload {
    customerName: string;
    licenseType?: string;
    maxMeters: number;
    issuedDate: string;
    expiryDate: string | null;
    features?: string[];
    hardwareLock?: string | null;
}

export interface LicenseTokenStructure {
    payload: LicensePayload;
    signature: string;
}

export interface LicenseStatusResult {
    isValid: boolean;
    customerName: string;
    licenseType: string;
    maxMeters: number;
    usedMeters: number;
    remainingMeters: number;
    usagePercentage: number;
    issuedDate: string | null;
    expiryDate: string | null;
    daysRemaining: number | null;
    isExpired: boolean;
    features: string[];
    licenseKeyMasked: string;
    /** Full key — only returned to admins, so they can copy or re-apply it */
    licenseKey?: string;
}
