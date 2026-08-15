import React, { useState } from 'react';
import { authApi } from '../../api/client';
import { useLanguage } from '../../contexts/LanguageContext';
import { Lock, Eye, EyeOff, Save, ShieldCheck } from 'lucide-react';

const ChangePasswordPage: React.FC = () => {
    const { t } = useLanguage();
    const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');

        // Validate
        if (!form.currentPassword) {
            setErrorMsg(t('กรุณากรอกรหัสผ่านปัจจุบัน', 'Please enter your current password'));
            return;
        }
        if (!form.newPassword || form.newPassword.length < 6) {
            setErrorMsg(t('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร', 'New password must be at least 6 characters'));
            return;
        }
        if (form.newPassword !== form.confirmPassword) {
            setErrorMsg(t('รหัสผ่านใหม่ไม่ตรงกัน', 'New passwords do not match'));
            return;
        }
        if (form.currentPassword === form.newPassword) {
            setErrorMsg(t('รหัสผ่านใหม่ต้องไม่เหมือนรหัสผ่านเดิม', 'New password must be different from the current password'));
            return;
        }

        setSaving(true);
        try {
            await authApi.changePassword({
                currentPassword: form.currentPassword,
                newPassword: form.newPassword,
            });
            setSuccessMsg(t('เปลี่ยนรหัสผ่านสำเร็จ', 'Password changed successfully'));
            setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (e: any) {
            setErrorMsg(e.response?.data?.message || t('ไม่สามารถเปลี่ยนรหัสผ่านได้', 'Failed to change password'));
        }
        setSaving(false);
    };

    // Password strength indicator
    const getStrength = (pw: string) => {
        if (!pw) return { level: 0, label: '', color: '' };
        let score = 0;
        if (pw.length >= 6) score++;
        if (pw.length >= 8) score++;
        if (/[A-Z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;
        if (score <= 1) return { level: 1, label: t('อ่อน', 'Weak'), color: '#EF4444' };
        if (score <= 3) return { level: 2, label: t('ปานกลาง', 'Medium'), color: '#F59E0B' };
        return { level: 3, label: t('แข็งแรง', 'Strong'), color: '#10B981' };
    };

    const strength = getStrength(form.newPassword);

    return (
        <div>
            {/* Title / Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700 }}>{t('เปลี่ยนรหัสผ่าน', 'Change Password')}</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
                        {t('เปลี่ยนรหัสผ่านเพื่อรักษาความปลอดภัยบัญชีของคุณ', 'Change your password to keep your account secure')}
                    </p>
                </div>
            </div>

            {successMsg && (
                <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 6, background: '#10B98120', border: '1px solid #10B981', color: '#10B981', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldCheck size={16} /> {successMsg}
                </div>
            )}
            {errorMsg && (
                <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 6, background: '#EF444420', border: '1px solid #EF4444', color: '#EF4444', fontSize: 13, fontWeight: 600 }}>
                    ✕ {errorMsg}
                </div>
            )}

            <div className="card" style={{ maxWidth: 520 }}>
                <div className="card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Lock size={18} color="var(--accent)" />
                        <span style={{ fontSize: '15px', fontWeight: 700 }}>{t('ตั้งรหัสผ่านใหม่', 'Set New Password')}</span>
                    </div>
                </div>
                <div className="card-body">
                    <form onSubmit={handleSubmit}>
                        {/* Current Password */}
                        <div className="form-group" style={{ marginBottom: 18 }}>
                            <label className="form-label">
                                {t('รหัสผ่านปัจจุบัน', 'Current Password')} <span style={{ color: 'var(--danger)' }}>*</span>
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showCurrent ? 'text' : 'password'}
                                    className="form-control"
                                    value={form.currentPassword}
                                    onChange={e => setForm({ ...form, currentPassword: e.target.value })}
                                    placeholder={t('กรอกรหัสผ่านปัจจุบัน', 'Enter current password')}
                                    autoComplete="current-password"
                                />
                                <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                                    style={{
                                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4,
                                    }}>
                                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* New Password */}
                        <div className="form-group" style={{ marginBottom: 8 }}>
                            <label className="form-label">
                                {t('รหัสผ่านใหม่', 'New Password')} <span style={{ color: 'var(--danger)' }}>*</span>
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showNew ? 'text' : 'password'}
                                    className="form-control"
                                    value={form.newPassword}
                                    onChange={e => setForm({ ...form, newPassword: e.target.value })}
                                    placeholder={t('กรอกรหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)', 'Enter new password (min 6 characters)')}
                                    autoComplete="new-password"
                                />
                                <button type="button" onClick={() => setShowNew(!showNew)}
                                    style={{
                                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4,
                                    }}>
                                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            {/* Strength Indicator */}
                            {form.newPassword && (
                                <div style={{ marginTop: 8 }}>
                                    <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                                        {[1, 2, 3].map(i => (
                                            <div key={i} style={{
                                                flex: 1, height: 4, borderRadius: 2,
                                                background: i <= strength.level ? strength.color : 'var(--border)',
                                                transition: 'background 0.2s',
                                            }} />
                                        ))}
                                    </div>
                                    <span style={{ fontSize: 11, color: strength.color, fontWeight: 600 }}>
                                        {strength.label}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Confirm New Password */}
                        <div className="form-group" style={{ marginBottom: 24, marginTop: 18 }}>
                            <label className="form-label">
                                {t('ยืนยันรหัสผ่านใหม่', 'Confirm New Password')} <span style={{ color: 'var(--danger)' }}>*</span>
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    className="form-control"
                                    value={form.confirmPassword}
                                    onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                                    placeholder={t('กรอกรหัสผ่านใหม่อีกครั้ง', 'Re-enter new password')}
                                    autoComplete="new-password"
                                />
                                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                                    style={{
                                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4,
                                    }}>
                                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            {form.confirmPassword && form.newPassword !== form.confirmPassword && (
                                <small style={{ color: '#EF4444', fontSize: 11, marginTop: 4, display: 'block' }}>
                                    {t('รหัสผ่านไม่ตรงกัน', 'Passwords do not match')}
                                </small>
                            )}
                            {form.confirmPassword && form.newPassword === form.confirmPassword && form.confirmPassword.length >= 6 && (
                                <small style={{ color: '#10B981', fontSize: 11, marginTop: 4, display: 'block' }}>
                                    ✓ {t('รหัสผ่านตรงกัน', 'Passwords match')}
                                </small>
                            )}
                        </div>

                        <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: '100%' }}>
                            <Save size={16} style={{ marginRight: 6 }} />
                            {saving ? t('กำลังบันทึก...', 'Saving...') : t('เปลี่ยนรหัสผ่าน', 'Change Password')}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ChangePasswordPage;
