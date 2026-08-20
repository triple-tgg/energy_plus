import React, { useEffect, useState } from 'react';
import { licenseApi } from '../../api/client';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, "Cascadia Mono", monospace';

const THEMES = {
    light: {
        bg: '#EAE7DA', panel: '#FBFAF4', panel2: '#F1EFE3', ink: '#23261E', sub: '#6E705F',
        line: '#D4D1C0', bar: '#F1EFE3', barSub: '#8A8C7A', accent: '#2B4C7E',
        successBg: '#16a34a', infoBg: '#2B4C7E', darkBg: '#23261E', warnBg: '#92400e',
    },
    dark: {
        bg: '#F0F2F5', panel: '#FFFFFF', panel2: '#F5F6F8', ink: '#1A1D23', sub: '#5F6B7A',
        line: '#D8DCE3', bar: '#E8EBF0', barSub: '#8892A0', accent: '#2B6CB0',
        successBg: '#34d399', infoBg: '#36C2CE', darkBg: '#1C232E', warnBg: '#fbbf24',
    },
};

interface LicenseStatus {
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
}

export const LicensePage: React.FC = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const { theme } = useTheme();
    const C = THEMES[theme];

    const [status, setStatus] = useState<LicenseStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Form activation state
    const [licenseInput, setLicenseInput] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [activating, setActivating] = useState(false);
    const [verifiedPayload, setVerifiedPayload] = useState<any>(null);

    const fetchStatus = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await licenseApi.getStatus();
            if (res.data?.success && res.data?.data) {
                setStatus(res.data.data);
            }
        } catch (err: any) {
            console.error('Failed to fetch license status:', err);
            setError(err.response?.data?.message || 'ไม่สามารถดึงข้อมูลสถานะ License ได้');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    const handleVerify = async () => {
        if (!licenseInput.trim()) {
            setError(t('กรุณาระบุ License Key', 'Please enter a License Key'));
            return;
        }
        setVerifying(true);
        setError('');
        setSuccessMsg('');
        setVerifiedPayload(null);
        try {
            const res = await licenseApi.verify(licenseInput.trim());
            if (res.data?.success && res.data?.data?.payload) {
                setVerifiedPayload(res.data.data.payload);
                setSuccessMsg(t('✅ ตรวจสอบความถูกต้องสำเร็จ! ลายเซ็นดิจิทัลและข้อมูล License ถูกต้อง', 'Verification successful! Cryptographic signature is valid.'));
            }
        } catch (err: any) {
            setError(err.response?.data?.message || t('License Key ไม่ถูกต้องหรือถูกปลอมแปลง', 'Invalid or tampered License Key'));
        } finally {
            setVerifying(false);
        }
    };

    const handleActivate = async () => {
        if (!licenseInput.trim()) {
            setError(t('กรุณาระบุ License Key', 'Please enter a License Key'));
            return;
        }
        setActivating(true);
        setError('');
        setSuccessMsg('');
        try {
            const res = await licenseApi.activate(licenseInput.trim());
            if (res.data?.success) {
                setStatus(res.data.data);
                setSuccessMsg(t('🎉 เปิดใช้งาน License Key ใหม่สำเร็จเรียบร้อยแล้ว!', 'New License Key activated successfully!'));
                setLicenseInput('');
                setVerifiedPayload(null);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || t('ไม่สามารถเปิดใช้งาน License Key ได้', 'Failed to activate License Key'));
        } finally {
            setActivating(false);
        }
    };

    const getProgressColor = (pct: number) => {
        if (pct >= 100) return '#ef4444'; // Red
        if (pct >= 80) return '#f59e0b';  // Amber
        return '#10b981';                // Green
    };

    if (loading && !status) {
        return (
            <div style={{ padding: 24, fontFamily: MONO, color: C.sub }}>
                ⏳ {t('กำลังโหลดข้อมูล License...', 'Loading License Information...')}
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 40 }}>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontFamily: MONO, fontSize: '16px', fontWeight: 700, letterSpacing: '1px', color: C.ink, textTransform: 'uppercase', margin: 0 }}>
                    🛡️ {t('การจัดการ License & โควตามิเตอร์', 'System License & Meter Quota')}
                </h2>
                <p style={{ fontFamily: MONO, fontSize: '11px', color: C.sub, margin: '4px 0 0 0' }}>
                    {t('ตรวจสอบสถานะโควตาการใช้งานมิเตอร์ และอัปเกรดระบบด้วย Cryptographic Digital Signature License Key', 'Manage meter creation quota and activate cryptographic license keys')}
                </p>
            </div>

            {/* Alert Messages */}
            {successMsg && (
                <div style={{
                    padding: '12px 16px',
                    background: '#ecfdf5',
                    border: '1px solid #10b981',
                    color: '#065f46',
                    fontFamily: MONO,
                    fontSize: '12px',
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                }}>
                    {successMsg}
                </div>
            )}

            {error && (
                <div style={{
                    padding: '12px 16px',
                    background: '#fef2f2',
                    border: '1px solid #ef4444',
                    color: '#991b1b',
                    fontFamily: MONO,
                    fontSize: '12px',
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                }}>
                    ⚠️ {error}
                </div>
            )}

            {/* Grid Layout: Status Overview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
                {/* Card 1: Meter Quota Usage */}
                <div style={{
                    background: C.panel,
                    border: `1px solid ${C.line}`,
                    padding: 20,
                    borderRadius: 0,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            📊 {t('โควตามิเตอร์ (Meter Quota)', 'Meter Quota')}
                        </span>
                        <span style={{
                            padding: '2px 8px',
                            fontSize: '10px',
                            fontFamily: MONO,
                            fontWeight: 700,
                            borderRadius: 2,
                            background: status?.isValid ? '#ecfdf5' : '#fef2f2',
                            color: status?.isValid ? '#059669' : '#dc2626',
                            border: `1px solid ${status?.isValid ? '#a7f3d0' : '#fecaca'}`
                        }}>
                            {status?.isValid ? t('เปิดใช้งานอยู่ (ACTIVE)', 'ACTIVE') : t('หมดอายุ (EXPIRED)', 'EXPIRED')}
                        </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontFamily: MONO, fontSize: '32px', fontWeight: 800, color: C.ink }}>
                            {status?.usedMeters ?? 0}
                        </span>
                        <span style={{ fontFamily: MONO, fontSize: '16px', color: C.sub }}>
                            / {status?.maxMeters ?? 0} {t('ตัว (Meters)', 'Meters')}
                        </span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: 10, background: C.bar, borderRadius: 5, overflow: 'hidden', marginBottom: 8 }}>
                        <div style={{
                            width: `${status?.usagePercentage ?? 0}%`,
                            height: '100%',
                            background: getProgressColor(status?.usagePercentage ?? 0),
                            transition: 'width 0.5s ease-in-out'
                        }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: '11px', color: C.sub }}>
                        <span>{t('ใช้งานไปแล้ว', 'Used')}: {status?.usagePercentage ?? 0}%</span>
                        <span>{t('คงเหลือ', 'Remaining')}: <strong>{status?.remainingMeters ?? 0}</strong> {t('ตัว', 'meters')}</span>
                    </div>
                </div>

                {/* Card 2: License Details */}
                <div style={{
                    background: C.panel,
                    border: `1px solid ${C.line}`,
                    padding: 20,
                    borderRadius: 0,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ marginBottom: 12 }}>
                        <span style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            🏢 {t('ข้อมูลลูกค้า & ใบอนุญาต', 'License Info')}
                        </span>
                    </div>

                    <div style={{ marginBottom: 10 }}>
                        <div style={{ fontFamily: MONO, fontSize: '10px', color: C.sub, textTransform: 'uppercase' }}>{t('ชื่อลูกค้า / องค์กร', 'Customer')}</div>
                        <div style={{ fontFamily: MONO, fontSize: '14px', fontWeight: 700, color: C.ink }}>{status?.customerName || '-'}</div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                        <div>
                            <div style={{ fontFamily: MONO, fontSize: '10px', color: C.sub, textTransform: 'uppercase' }}>{t('ประเภท License', 'License Type')}</div>
                            <div style={{ fontFamily: MONO, fontSize: '12px', fontWeight: 600, color: C.accent }}>{status?.licenseType || 'Standard'}</div>
                        </div>
                        <div>
                            <div style={{ fontFamily: MONO, fontSize: '10px', color: C.sub, textTransform: 'uppercase' }}>{t('ระยะเวลาคงเหลือ', 'Days Remaining')}</div>
                            <div style={{ fontFamily: MONO, fontSize: '12px', fontWeight: 600, color: (status?.daysRemaining ?? 0) < 30 ? '#ef4444' : C.ink }}>
                                {status?.daysRemaining !== null ? `${status?.daysRemaining} ${t('วัน', 'days')}` : t('ไม่จำกัด (Unlimited)', 'Unlimited')}
                            </div>
                        </div>
                    </div>

                    <div>
                        <div style={{ fontFamily: MONO, fontSize: '10px', color: C.sub, textTransform: 'uppercase' }}>{t('วันหมดอายุ', 'Expiry Date')}</div>
                        <div style={{ fontFamily: MONO, fontSize: '11px', color: C.ink }}>
                            {status?.expiryDate ? new Date(status.expiryDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : t('ตลอดชีพ (Never)', 'Never')}
                        </div>
                    </div>
                </div>
            </div>

            {/* Features Entitlement Section */}
            {status?.features && status.features.length > 0 && (
                <div style={{
                    background: C.panel,
                    border: `1px solid ${C.line}`,
                    padding: '16px 20px',
                    borderRadius: 0,
                    marginBottom: 24
                }}>
                    <div style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                        ✨ {t('ฟีเจอร์ที่ได้รับสิทธิ์ (Licensed Features)', 'Licensed Features')}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {status.features.map((feat, idx) => (
                            <span key={idx} style={{
                                fontFamily: MONO,
                                fontSize: '11px',
                                padding: '4px 10px',
                                background: C.panel2,
                                border: `1px solid ${C.line}`,
                                color: C.ink,
                                borderRadius: 3
                            }}>
                                ✓ {feat}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Admin Activation Section */}
            {user?.role === 'admin' && (
                <div style={{
                    background: C.panel,
                    border: `1px solid ${C.line}`,
                    padding: 24,
                    borderRadius: 0,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: '18px' }}>🔑</span>
                        <h3 style={{ fontFamily: MONO, fontSize: '14px', fontWeight: 700, margin: 0, color: C.ink, textTransform: 'uppercase' }}>
                            {t('อัปเกรดหรือเปิดใช้งาน License Key ใหม่', 'Activate / Upgrade License Key')}
                        </h3>
                    </div>
                    <p style={{ fontFamily: MONO, fontSize: '11px', color: C.sub, margin: '0 0 16px 0' }}>
                        {t('วาง License Token (Base64) ที่ได้รับจากผู้พัฒนาเพื่อเพิ่มโควตามิเตอร์หรือขยายระยะเวลาใช้งาน', 'Paste the cryptographically signed License Key token to expand meter limits or extend validity')}
                    </p>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontFamily: MONO, fontSize: '11px', fontWeight: 700, color: C.ink, marginBottom: 6, textTransform: 'uppercase' }}>
                            {t('License Key Token:', 'License Key Token:')}
                        </label>
                        <textarea
                            rows={4}
                            value={licenseInput}
                            onChange={(e) => setLicenseInput(e.target.value)}
                            placeholder="eyJwYXlsb2FkIjp7ImN1c3RvbWVyTmFtZSI6IktFIEdyb3VwIiwibWF4TWV0ZXJzIjo1MC4uLiJ9LCJzaWduYXR1cmUiOiJNRVFDSU..."
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                fontFamily: MONO,
                                fontSize: '11px',
                                background: C.panel2,
                                color: C.ink,
                                border: `1px solid ${C.line}`,
                                borderRadius: 0,
                                resize: 'vertical',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    {/* Decoded preview if verified */}
                    {verifiedPayload && (
                        <div style={{
                            padding: '12px 16px',
                            background: C.panel2,
                            border: `1px dashed ${C.accent}`,
                            marginBottom: 16,
                            fontFamily: MONO,
                            fontSize: '11px'
                        }}>
                            <div style={{ fontWeight: 700, color: C.accent, marginBottom: 6 }}>
                                📋 {t('ข้อมูล License ที่กำลังจะเปิดใช้งาน:', 'License Details to Activate:')}
                            </div>
                            <div><strong>{t('ลูกค้า', 'Customer')}:</strong> {verifiedPayload.customerName}</div>
                            <div><strong>{t('โควตามิเตอร์ใหม่', 'New Meter Quota')}:</strong> {verifiedPayload.maxMeters} {t('ตัว', 'meters')}</div>
                            <div><strong>{t('วันหมดอายุ', 'Expiry')}:</strong> {verifiedPayload.expiryDate ? new Date(verifiedPayload.expiryDate).toLocaleDateString('th-TH') : t('ตลอดชีพ', 'Never')}</div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            onClick={handleVerify}
                            disabled={verifying || activating || !licenseInput.trim()}
                            style={{
                                fontFamily: MONO,
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '8px 16px',
                                background: C.panel2,
                                color: C.ink,
                                border: `1px solid ${C.line}`,
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                                opacity: !licenseInput.trim() ? 0.6 : 1
                            }}
                        >
                            {verifying ? t('กำลังตรวจสอบ...', 'Verifying...') : `🔍 ${t('ตรวจสอบความถูกต้อง (Verify)', 'Verify Key')}`}
                        </button>

                        <button
                            onClick={handleActivate}
                            disabled={activating || !licenseInput.trim()}
                            style={{
                                fontFamily: MONO,
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '8px 20px',
                                background: C.accent,
                                color: '#ffffff',
                                border: 'none',
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                                opacity: !licenseInput.trim() ? 0.6 : 1
                            }}
                        >
                            {activating ? t('กำลังเปิดใช้งาน...', 'Activating...') : `🚀 ${t('เปิดใช้งานทันที (Activate)', 'Activate Now')}`}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LicensePage;
