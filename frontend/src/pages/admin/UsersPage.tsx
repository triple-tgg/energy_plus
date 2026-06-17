import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { usersApi } from '../../api/client';
import { useLanguage } from '../../contexts/LanguageContext';

interface UserForm {
    userName: string;
    displayName: string;
    email: string;
    password: string;
    groupId: number;
    isActive: boolean;
}

const emptyForm: UserForm = {
    userName: '', displayName: '', email: '', password: '', groupId: 1, isActive: true,
};

const MODULE_KEYS = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'monitoring', label: 'Monitoring' },
    { key: 'meters', label: 'Master Data' },
    { key: 'alarms', label: 'Alarm Settings' },
    { key: 'users', label: 'User Management' },
    { key: 'billing', label: 'Billing Tariffs' },
    { key: 'reports', label: 'Reports' },
    { key: 'settings', label: 'System Settings' },
    { key: 'company', label: 'Company Settings' },
    { key: 'sites', label: 'Sites & Locations' },
];

const UsersPage: React.FC = () => {
    const { t } = useLanguage();
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    // Groups list for dropdown
    const [groups, setGroups] = useState<any[]>([]);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<UserForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    // Delete state
    const [showDelete, setShowDelete] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);

    // Reset Password Modal state
    const [showReset, setShowReset] = useState(false);
    const [resetTarget, setResetTarget] = useState<any>(null);
    const [newPassword, setNewPassword] = useState('');
    const [resetSaving, setResetSaving] = useState(false);
    const [resetError, setResetError] = useState('');

    // Permissions Modal state
    const [showPerms, setShowPerms] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<number | ''>('');
    const [permsList, setPermsList] = useState<any[]>([]);
    const [permsSaving, setPermsSaving] = useState(false);
    const [permsError, setPermsError] = useState('');

    // Success message
    const [successMsg, setSuccessMsg] = useState('');

    const getModuleLabel = (key: string) => {
        switch (key) {
            case 'dashboard': return t('แดชบอร์ด', 'Dashboard');
            case 'monitoring': return t('การตรวจสอบ', 'Monitoring');
            case 'meters': return t('ข้อมูลหลัก', 'Master Data');
            case 'alarms': return t('ตั้งค่าการเตือน', 'Alarm Settings');
            case 'users': return t('จัดการผู้ใช้งาน', 'User Management');
            case 'billing': return t('อัตราค่าไฟ', 'Billing Tariffs');
            case 'reports': return t('รายงาน', 'Reports');
            case 'settings': return t('ตั้งค่าระบบ', 'System Settings');
            case 'company': return t('ตั้งค่าบริษัท', 'Company Settings');
            case 'sites': return t('ไซต์และสถานที่', 'Sites & Locations');
            default: return key;
        }
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await usersApi.getAll({ page, limit, search });
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [page, limit, search]);

    const fetchGroups = useCallback(async () => {
        try {
            const res = await usersApi.getGroups({ limit: 100 });
            setGroups(res.data.data || []);
        } catch (err) { console.error(err); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { fetchGroups(); }, [fetchGroups]);

    useEffect(() => {
        if (successMsg) {
            const timer = setTimeout(() => setSuccessMsg(''), 3000);
            return () => clearTimeout(timer);
        }
    }, [successMsg]);

    const handleCreate = () => {
        setEditId(null);
        setForm(emptyForm);
        setFormError('');
        setShowModal(true);
    };

    const handleEdit = (row: any) => {
        setEditId(row.user_id);
        setForm({
            userName: row.user_name || '',
            displayName: row.display_name || '',
            email: row.email || '',
            password: '',
            groupId: row.group_id || 1,
            isActive: row.is_active ?? true,
        });
        setFormError('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.userName.trim()) {
            setFormError(t('กรุณากรอกชื่อผู้ใช้งาน', 'Username is required'));
            return;
        }
        if (!editId && (!form.password || form.password.length < 6)) {
            setFormError(t('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร', 'Password must be at least 6 characters'));
            return;
        }
        setSaving(true);
        setFormError('');
        try {
            if (editId) {
                await usersApi.update(editId, {
                    displayName: form.displayName,
                    email: form.email,
                    groupId: form.groupId,
                    isActive: form.isActive,
                });
                setSuccessMsg(t('อัปเดตผู้ใช้งานสำเร็จ!', 'User updated successfully!'));
            } else {
                await usersApi.create({
                    userName: form.userName,
                    displayName: form.displayName,
                    email: form.email,
                    password: form.password,
                    groupId: form.groupId,
                });
                setSuccessMsg(t('สร้างผู้ใช้งานสำเร็จ!', 'User created successfully!'));
            }
            setShowModal(false);
            fetchData();
        } catch (err: any) {
            setFormError(err.response?.data?.message || t('บันทึกผู้ใช้งานล้มเหลว', 'Failed to save user'));
        }
        setSaving(false);
    };

    const handleDeleteClick = (row: any) => {
        setDeleteTarget(row);
        setShowDelete(true);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await usersApi.delete(deleteTarget.user_id);
            setSuccessMsg(t('ลบผู้ใช้งานสำเร็จ!', 'User deleted successfully!'));
            setShowDelete(false);
            setDeleteTarget(null);
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.message || t('ลบผู้ใช้งานล้มเหลว', 'Failed to delete user'));
        }
        setDeleting(false);
    };

    // Reset password functions
    const handleResetClick = (row: any) => {
        setResetTarget(row);
        setNewPassword('');
        setResetError('');
        setShowReset(true);
    };

    const handleResetConfirm = async () => {
        if (!resetTarget) return;
        if (!newPassword || newPassword.length < 6) {
            setResetError(t('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร', 'Password must be at least 6 characters'));
            return;
        }
        setResetSaving(true);
        setResetError('');
        try {
            await usersApi.resetPassword(resetTarget.user_id, { password: newPassword });
            setSuccessMsg(t(`รีเซ็ตรหัสผ่านสำหรับ "${resetTarget.user_name}" สำเร็จ!`, `Reset password for "${resetTarget.user_name}" successfully!`));
            setShowReset(false);
            setResetTarget(null);
        } catch (err: any) {
            setResetError(err.response?.data?.message || t('รีเซ็ตรหัสผ่านล้มเหลว', 'Failed to reset password'));
        }
        setResetSaving(false);
    };

    // Permission functions
    const handleOpenPerms = () => {
        setSelectedGroup('');
        setPermsList([]);
        setPermsError('');
        setShowPerms(true);
    };

    const fetchGroupPerms = async (groupId: number) => {
        setSelectedGroup(groupId);
        setPermsError('');
        try {
            const res = await usersApi.getGroupPermissions(groupId);
            const rawPerms = res.data.data || [];
            
            // Build absolute list mapping with default values for missing modules
            const list = MODULE_KEYS.map(m => {
                const found = rawPerms.find((p: any) => p.permission_key === m.key);
                return {
                    permission_key: m.key,
                    label: m.label,
                    can_view: found ? found.can_view : false,
                    can_create: found ? found.can_create : false,
                    can_edit: found ? found.can_edit : false,
                    can_delete: found ? found.can_delete : false,
                };
            });
            setPermsList(list);
        } catch (err: any) {
            setPermsError(t('โหลดสิทธิ์กลุ่มล้มเหลว', 'Failed to load group permissions'));
        }
    };

    const handlePermCheckboxChange = (permKey: string, field: string, checked: boolean) => {
        setPermsList(prev => prev.map(p => {
            if (p.permission_key === permKey) {
                return { ...p, [field]: checked };
            }
            return p;
        }));
    };

    const handleSavePermissions = async () => {
        if (!selectedGroup) return;
        setPermsSaving(true);
        setPermsError('');
        try {
            await usersApi.updateGroupPermissions(selectedGroup, { permissions: permsList });
            setSuccessMsg(t('อัปเดตสิทธิ์สำเร็จ!', 'Permissions updated successfully!'));
            setShowPerms(false);
        } catch (err: any) {
            setPermsError(err.response?.data?.message || t('บันทึกสิทธิ์ล้มเหลว', 'Failed to save permissions'));
        }
        setPermsSaving(false);
    };

    const columns = [
        { key: 'user_name', title: t('ชื่อผู้ใช้งาน', 'Username') },
        { key: 'display_name', title: t('ชื่อที่แสดง', 'Display Name') },
        { key: 'email', title: t('อีเมล', 'Email') },
        {
            key: 'group_name', title: t('กลุ่ม', 'Group'),
            render: (v: string) => v ? <span className="badge badge-info">{v.toUpperCase()}</span> : '—',
        },
        {
            key: 'is_active', title: t('สถานะ', 'Status'),
            render: (v: boolean) => (
                <span className={`badge ${v ? 'badge-success' : 'badge-danger'}`}>
                    {v ? t('ใช้งาน', 'Active') : t('ไม่ใช้งาน', 'Inactive')}
                </span>
            ),
        },
        {
            key: 'actions', title: t('จัดการ', 'Actions'),
            render: (_: any, row: any) => (
                <div className="table-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => handleEdit(row)}>
                        ✏️ {t('แก้ไข', 'Edit')}
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={() => handleResetClick(row)} style={{ fontSize: '11px' }}>
                        🔑 {t('รีเซ็ตรหัสผ่าน', 'Reset PW')}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteClick(row)}>
                        🗑️ {t('ลบ', 'Delete')}
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div>
            {successMsg && <div className="toast-success">✅ {successMsg}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
                <button className="btn btn-outline" onClick={handleOpenPerms} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    🛡️ {t('จัดการสิทธิ์กลุ่ม', 'Manage Group Permissions')}
                </button>
            </div>

            <DataTable
                title={t('ระบบผู้ใช้งาน', 'System Users')}
                columns={columns}
                data={data}
                total={total}
                page={page}
                limit={limit}
                loading={loading}
                onPageChange={setPage}
                onLimitChange={(l) => { setLimit(l); setPage(1); }}
                onSearch={(s: string) => { setSearch(s); setPage(1); }}
                onCreate={handleCreate}
                createLabel={t('เพิ่มผู้ใช้งาน', 'Add User')}
            />

            {/* Create/Edit User Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editId ? t('แก้ไขผู้ใช้งาน', 'Edit User') : t('เพิ่มผู้ใช้งานใหม่', 'Add New User')}
                size="md"
                footer={
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>
                            {t('ยกเลิก', 'Cancel')}
                        </button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? t('กำลังบันทึก...', 'Saving...') : editId ? t('อัปเดต', 'Update') : t('สร้าง', 'Create')}
                        </button>
                    </div>
                }
            >
                {formError && <div className="form-error-banner">{formError}</div>}

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">{t('ชื่อผู้ใช้งาน', 'Username')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input
                            type="text"
                            className="form-control"
                            placeholder={t('กรอกชื่อผู้ใช้งาน', 'Enter username')}
                            value={form.userName}
                            onChange={(e) => setForm({ ...form, userName: e.target.value })}
                            disabled={!!editId}
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">{t('ชื่อที่แสดง', 'Display Name')}</label>
                        <input
                            type="text"
                            className="form-control"
                            placeholder={t('กรอกชื่อที่แสดง', 'Enter display name')}
                            value={form.displayName}
                            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                        />
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">{t('อีเมล', 'Email')}</label>
                        <input
                            type="email"
                            className="form-control"
                            placeholder={t('กรอกที่อยู่อีเมล', 'Enter email address')}
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">{t('กลุ่มผู้ใช้งาน', 'User Group')}</label>
                        <select
                            className="form-control"
                            value={form.groupId}
                            onChange={(e) => setForm({ ...form, groupId: parseInt(e.target.value) })}
                        >
                            {groups.map((g: any) => (
                                <option key={g.group_id} value={g.group_id}>{g.group_name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {!editId && (
                    <div className="form-group">
                        <label className="form-label">{t('รหัสผ่าน', 'Password')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input
                            type="password"
                            className="form-control"
                            placeholder={t('รหัสผ่านอย่างน้อย 6 ตัวอักษร', 'Minimum 6 characters')}
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                        />
                    </div>
                )}

                <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                            type="checkbox"
                            checked={form.isActive}
                            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                            style={{ width: 18, height: 18, accentColor: 'var(--success)' }}
                        />
                        {t('ใช้งาน', 'Active')}
                    </label>
                </div>
            </Modal>

            {/* Reset Password Modal */}
            <Modal
                isOpen={showReset}
                onClose={() => setShowReset(false)}
                title={t('รีเซ็ตรหัสผ่าน — ', 'Reset Password — ') + (resetTarget?.user_name || '')}
                size="sm"
                footer={
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline" onClick={() => setShowReset(false)} disabled={resetSaving}>
                            {t('ยกเลิก', 'Cancel')}
                        </button>
                        <button className="btn btn-primary" onClick={handleResetConfirm} disabled={resetSaving}>
                            {resetSaving ? t('กำลังบันทึก...', 'Saving...') : t('รีเซ็ต', 'Reset')}
                        </button>
                    </div>
                }
            >
                {resetError && <div className="form-error-banner">{resetError}</div>}
                <div className="form-group">
                    <label className="form-label">{t('รหัสผ่านใหม่', 'New Password')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                        type="password"
                        className="form-control"
                        placeholder={t('รหัสผ่านอย่างน้อย 6 ตัวอักษร', 'Minimum 6 characters')}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoFocus
                    />
                </div>
            </Modal>

            {/* Manage Group Permissions Modal */}
            <Modal
                isOpen={showPerms}
                onClose={() => setShowPerms(false)}
                title={t('จัดการสิทธิ์กลุ่ม', 'Manage Group Permissions')}
                size="lg"
                footer={
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline" onClick={() => setShowPerms(false)} disabled={permsSaving}>
                            {t('ยกเลิก', 'Cancel')}
                        </button>
                        <button className="btn btn-primary" onClick={handleSavePermissions} disabled={permsSaving || !selectedGroup}>
                            {permsSaving ? t('กำลังบันทึก...', 'Saving...') : t('บันทึกสิทธิ์', 'Save Permissions')}
                        </button>
                    </div>
                }
            >
                {permsError && <div className="form-error-banner">{permsError}</div>}

                <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label className="form-label">{t('เลือกกลุ่มผู้ใช้งาน', 'Select User Group')}</label>
                    <select
                        className="form-control"
                        value={selectedGroup}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val) fetchGroupPerms(parseInt(val));
                            else {
                                // Clear
                                setSelectedGroup('');
                                setPermsList([]);
                            }
                        }}
                    >
                        <option value="">— {t('เลือกกลุ่ม', 'Select Group')} —</option>
                        {groups.map((g: any) => (
                            <option key={g.group_id} value={g.group_id}>{g.group_name.toUpperCase()}</option>
                        ))}
                    </select>
                </div>

                {selectedGroup && permsList.length > 0 && (
                    <table className="table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                                <th style={{ padding: '8px' }}>{t('โมดูล / เมนู', 'Module / Menu')}</th>
                                <th style={{ padding: '8px', textAlign: 'center' }}>{t('ดู', 'View')}</th>
                                <th style={{ padding: '8px', textAlign: 'center' }}>{t('สร้าง', 'Create')}</th>
                                <th style={{ padding: '8px', textAlign: 'center' }}>{t('แก้ไข', 'Edit')}</th>
                                <th style={{ padding: '8px', textAlign: 'center' }}>{t('ลบ', 'Delete')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {permsList.map((p) => (
                                <tr key={p.permission_key} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '10px 8px', fontWeight: 600 }}>{getModuleLabel(p.permission_key)}</td>
                                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                        <input type="checkbox" checked={p.can_view} onChange={(e) => handlePermCheckboxChange(p.permission_key, 'can_view', e.target.checked)} style={{ width: 18, height: 18 }} />
                                    </td>
                                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                        <input type="checkbox" checked={p.can_create} onChange={(e) => handlePermCheckboxChange(p.permission_key, 'can_create', e.target.checked)} style={{ width: 18, height: 18 }} />
                                    </td>
                                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                        <input type="checkbox" checked={p.can_edit} onChange={(e) => handlePermCheckboxChange(p.permission_key, 'can_edit', e.target.checked)} style={{ width: 18, height: 18 }} />
                                    </td>
                                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                        <input type="checkbox" checked={p.can_delete} onChange={(e) => handlePermCheckboxChange(p.permission_key, 'can_delete', e.target.checked)} style={{ width: 18, height: 18 }} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Modal>

            {/* Delete Confirmation */}
            <Modal
                isOpen={showDelete}
                onClose={() => setShowDelete(false)}
                title={t('ยืนยันการลบ', 'Confirm Delete')}
                size="sm"
                footer={
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline" onClick={() => setShowDelete(false)} disabled={deleting}>
                            {t('ยกเลิก', 'Cancel')}
                        </button>
                        <button className="btn btn-danger" onClick={handleDeleteConfirm} disabled={deleting}>
                            {deleting ? t('กำลังลบ...', 'Deleting...') : t('ลบ', 'Delete')}
                        </button>
                    </div>
                }
            >
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                    <p style={{ fontSize: 16, marginBottom: 8 }}>
                        {t('ลบผู้ใช้งาน', 'Delete user')}
                    </p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>
                        "{deleteTarget?.user_name}"
                    </p>
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                        ({deleteTarget?.display_name})
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default UsersPage;
