import React, { useEffect, useState } from 'react';
import { authApi } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { User, Mail, Shield, Save, X, Pencil, Building2 } from 'lucide-react';

const ProfilePage: React.FC = () => {
    const { user } = useAuth();
    const { theme } = useTheme();
    const { t } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({ displayName: '', email: '' });
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const res = await authApi.me();
                const d = res.data.data;
                setProfile(d);
                setForm({ displayName: d.displayName || '', email: d.email || '' });
            } catch (e) {
                console.error(e);
                // Fallback to auth context user
                if (user) {
                    setProfile(user);
                    setForm({ displayName: user.displayName || '', email: user.email || '' });
                }
            }
            setLoading(false);
        })();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setErrorMsg('');
        setSuccessMsg('');
        try {
            await authApi.updateProfile(form);
            setSuccessMsg(t('บันทึกข้อมูลโปรไฟล์สำเร็จ', 'Profile updated successfully'));
            setEditing(false);
            // Update local profile
            setProfile({ ...profile, displayName: form.displayName, email: form.email });
            // Update localStorage user
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                try {
                    const u = JSON.parse(storedUser);
                    u.displayName = form.displayName;
                    u.email = form.email;
                    localStorage.setItem('user', JSON.stringify(u));
                } catch { /* ignore */ }
            }
        } catch (e: any) {
            setErrorMsg(e.response?.data?.message || t('ไม่สามารถบันทึกข้อมูลได้', 'Failed to update profile'));
        }
        setSaving(false);
    };

    const handleCancel = () => {
        setEditing(false);
        setErrorMsg('');
        if (profile) {
            setForm({ displayName: profile.displayName || '', email: profile.email || '' });
        }
    };

    if (loading) return <LoadingScreen />;

    return (
        <div>
            {/* Title / Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700 }}>{t('ตั้งค่าโปรไฟล์', 'Profile Settings')}</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
                        {t('จัดการข้อมูลบัญชีผู้ใช้ของคุณ', 'Manage your user account information')}
                    </p>
                </div>
            </div>

            {successMsg && (
                <div className="alert alert-success" style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 6, background: '#10B98120', border: '1px solid #10B981', color: '#10B981', fontSize: 13, fontWeight: 600 }}>
                    ✓ {successMsg}
                </div>
            )}
            {errorMsg && (
                <div className="alert alert-danger" style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 6, background: '#EF444420', border: '1px solid #EF4444', color: '#EF4444', fontSize: 13, fontWeight: 600 }}>
                    ✕ {errorMsg}
                </div>
            )}

            {/* Profile Card */}
            <div className="card">
                <div className="card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <User size={18} color="var(--accent)" />
                        <span style={{ fontSize: '15px', fontWeight: 700 }}>{t('ข้อมูลทั่วไป', 'General Information')}</span>
                    </div>
                    {!editing ? (
                        <button className="btn btn-sm btn-outline" onClick={() => setEditing(true)}>
                            <Pencil size={14} /> {t('แก้ไข', 'Edit')}
                        </button>
                    ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-sm btn-outline" onClick={handleCancel} disabled={saving}>
                                <X size={14} /> {t('ยกเลิก', 'Cancel')}
                            </button>
                            <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving}>
                                <Save size={14} /> {saving ? t('กำลังบันทึก...', 'Saving...') : t('บันทึก', 'Save')}
                            </button>
                        </div>
                    )}
                </div>
                <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                        {/* Username (read-only) */}
                        <div className="form-group">
                            <label className="form-label">
                                <User size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                {t('ชื่อผู้ใช้', 'Username')}
                            </label>
                            <input
                                type="text"
                                className="form-control"
                                value={profile?.userName || user?.userName || ''}
                                disabled
                                style={{ opacity: 0.7 }}
                            />
                            <small style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 4 }}>
                                {t('ชื่อผู้ใช้ไม่สามารถเปลี่ยนได้', 'Username cannot be changed')}
                            </small>
                        </div>

                        {/* Display Name */}
                        <div className="form-group">
                            <label className="form-label">{t('ชื่อที่แสดง', 'Display Name')}</label>
                            <input
                                type="text"
                                className="form-control"
                                value={form.displayName}
                                onChange={e => setForm({ ...form, displayName: e.target.value })}
                                disabled={!editing}
                                placeholder={t('กรอกชื่อที่แสดง', 'Enter display name')}
                            />
                        </div>

                        {/* Email */}
                        <div className="form-group">
                            <label className="form-label">
                                <Mail size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                {t('อีเมล', 'Email')}
                            </label>
                            <input
                                type="email"
                                className="form-control"
                                value={form.email}
                                onChange={e => setForm({ ...form, email: e.target.value })}
                                disabled={!editing}
                                placeholder={t('กรอกอีเมล', 'Enter email')}
                            />
                        </div>

                        {/* Group (read-only) */}
                        <div className="form-group">
                            <label className="form-label">
                                <Shield size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                {t('กลุ่มผู้ใช้', 'User Group')}
                            </label>
                            <input
                                type="text"
                                className="form-control"
                                value={profile?.group || user?.group || ''}
                                disabled
                                style={{ opacity: 0.7 }}
                            />
                        </div>

                        {/* Role (read-only) */}
                        <div className="form-group">
                            <label className="form-label">{t('บทบาท', 'Role')}</label>
                            <input
                                type="text"
                                className="form-control"
                                value={profile?.role || user?.role || ''}
                                disabled
                                style={{ opacity: 0.7, textTransform: 'capitalize' }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Sites Access Card */}
            <div className="card" style={{ marginTop: 20 }}>
                <div className="card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Building2 size={18} color="var(--accent)" />
                        <span style={{ fontSize: '15px', fontWeight: 700 }}>{t('สิทธิ์การเข้าถึงไซต์', 'Site Access')}</span>
                    </div>
                </div>
                <div className="card-body">
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                        {t('โหมดการเข้าถึง:', 'Access Mode:')}
                        <span style={{
                            marginLeft: 8, padding: '2px 10px', borderRadius: 4,
                            background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700,
                            textTransform: 'uppercase',
                        }}>
                            {profile?.siteAccessMode || user?.siteAccessMode || 'assigned'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {(profile?.sites || user?.sites || []).map((s: any) => (
                            <span key={s.siteId} style={{
                                padding: '5px 12px', borderRadius: 6,
                                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                            }}>
                                <Building2 size={12} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                                {s.siteName}
                            </span>
                        ))}
                        {(profile?.sites || user?.sites || []).length === 0 && (
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                {t('ไม่มีไซต์ที่กำหนด', 'No sites assigned')}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
