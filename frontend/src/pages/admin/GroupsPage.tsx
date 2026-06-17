import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { usersApi } from '../../api/client';
import { useLanguage } from '../../contexts/LanguageContext';

interface GroupForm {
    groupName: string;
    description: string;
    isActive: boolean;
}

const emptyForm: GroupForm = { groupName: '', description: '', isActive: true };

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

const GroupsPage: React.FC = () => {
    const { t } = useLanguage();
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<GroupForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    // Delete state
    const [showDelete, setShowDelete] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);

    // Success message
    const [successMsg, setSuccessMsg] = useState('');

    // Permissions state
    const [showPerms, setShowPerms] = useState(false);
    const [permsTarget, setPermsTarget] = useState<any>(null);
    const [permsList, setPermsList] = useState<any[]>([]);
    const [permsSaving, setPermsSaving] = useState(false);
    const [permsError, setPermsError] = useState('');

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
            const res = await usersApi.getGroups({ page, limit });
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [page, limit]);

    useEffect(() => { fetchData(); }, [fetchData]);

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
        setEditId(row.group_id);
        setForm({
            groupName: row.group_name || '',
            description: row.description || '',
            isActive: row.is_active ?? true,
        });
        setFormError('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.groupName.trim()) {
            setFormError(t('กรุณากรอกชื่อกลุ่ม', 'Group Name is required'));
            return;
        }
        setSaving(true);
        setFormError('');
        try {
            if (editId) {
                await usersApi.updateGroup(editId, form);
                setSuccessMsg(t('อัปเดตกลุ่มสำเร็จ!', 'Group updated successfully!'));
            } else {
                await usersApi.createGroup(form);
                setSuccessMsg(t('สร้างกลุ่มสำเร็จ!', 'Group created successfully!'));
            }
            setShowModal(false);
            fetchData();
        } catch (err: any) {
            setFormError(err.response?.data?.message || t('บันทึกกลุ่มล้มเหลว', 'Failed to save group'));
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
            await usersApi.deleteGroup(deleteTarget.group_id);
            setSuccessMsg(t('ลบกลุ่มสำเร็จ!', 'Group deleted successfully!'));
            setShowDelete(false);
            setDeleteTarget(null);
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.message || t('ลบกลุ่มล้มเหลว', 'Failed to delete group'));
        }
        setDeleting(false);
    };

    // Permission functions
    const handleAddPermissionClick = async (row: any) => {
        setPermsTarget(row);
        setPermsError('');
        setPermsList([]);
        setShowPerms(true);
        try {
            const res = await usersApi.getGroupPermissions(row.group_id);
            const rawPerms = res.data.data || [];
            
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
        if (!permsTarget) return;
        setPermsSaving(true);
        setPermsError('');
        try {
            await usersApi.updateGroupPermissions(permsTarget.group_id, { permissions: permsList });
            setSuccessMsg(t('อัปเดตสิทธิ์สำเร็จ!', 'Permissions updated successfully!'));
            setShowPerms(false);
            setPermsTarget(null);
        } catch (err: any) {
            setPermsError(err.response?.data?.message || t('บันทึกสิทธิ์ล้มเหลว', 'Failed to save permissions'));
        }
        setPermsSaving(false);
    };

    const columns = [
        { key: 'group_name', title: t('ชื่อกลุ่ม', 'Group Name') },
        { key: 'description', title: t('รายละเอียด', 'Description') },
        {
            key: 'is_active',
            title: t('สถานะ', 'Status'),
            render: (v: boolean) => (
                <span className={`badge ${v ? 'badge-success' : 'badge-danger'}`}>
                    {v ? t('ใช้งาน', 'Active') : t('ไม่ใช้งาน', 'Inactive')}
                </span>
            ),
        },
        {
            key: 'actions',
            title: t('จัดการ', 'Actions'),
            render: (_: any, row: any) => (
                <div className="table-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => handleEdit(row)}>
                        ✏️ {t('แก้ไข', 'Edit')}
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={() => handleAddPermissionClick(row)}>
                        🛡️ {t('จัดการสิทธิ์', 'Add Permission')}
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

            <DataTable
                title={t('กลุ่มผู้ใช้งาน', 'User Groups')}
                columns={columns}
                data={data}
                total={total}
                page={page}
                limit={limit}
                loading={loading}
                onPageChange={setPage}
                onLimitChange={(l) => { setLimit(l); setPage(1); }}
                onCreate={handleCreate}
                createLabel={t('เพิ่มกลุ่มผู้ใช้งาน', 'Add User Group')}
            />

            {/* Create/Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editId ? t('แก้ไขกลุ่ม', 'Edit Group') : t('เพิ่มกลุ่มใหม่', 'Add New Group')}
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

                <div className="form-group">
                    <label className="form-label">{t('ชื่อกลุ่ม', 'Group Name')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                        type="text"
                        className="form-control"
                        placeholder={t('กรอกชื่อกลุ่ม', 'Enter group name')}
                        value={form.groupName}
                        onChange={(e) => setForm({ ...form, groupName: e.target.value })}
                        autoFocus
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">{t('รายละเอียด', 'Description')}</label>
                    <textarea
                        className="form-control"
                        placeholder={t('กรอกรายละเอียด', 'Enter description')}
                        rows={3}
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        style={{ resize: 'vertical' }}
                    />
                </div>

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

            {/* Delete Confirmation Modal */}
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
                        {t('ลบกลุ่ม', 'Delete group')}
                    </p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>
                        "{deleteTarget?.group_name}"
                    </p>
                </div>
            </Modal>

            {/* Manage Group Permissions Modal */}
            <Modal
                isOpen={showPerms}
                onClose={() => {
                    setShowPerms(false);
                    setPermsTarget(null);
                }}
                title={t('จัดการสิทธิ์: ', 'Manage Permissions: ') + (permsTarget?.group_name || '')}
                size="lg"
                footer={
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline" onClick={() => {
                            setShowPerms(false);
                            setPermsTarget(null);
                        }} disabled={permsSaving}>
                            {t('ยกเลิก', 'Cancel')}
                        </button>
                        <button className="btn btn-primary" onClick={handleSavePermissions} disabled={permsSaving || !permsTarget}>
                            {permsSaving ? t('กำลังบันทึก...', 'Saving...') : t('บันทึกสิทธิ์', 'Save Permissions')}
                        </button>
                    </div>
                }
            >
                {permsError && <div className="form-error-banner">{permsError}</div>}

                {permsTarget && permsList.length > 0 ? (
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
                ) : (
                    permsTarget && <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)' }}>{t('กำลังโหลดสิทธิ์...', 'Loading permissions...')}</div>
                )}
            </Modal>
        </div>
    );
};

export default GroupsPage;
