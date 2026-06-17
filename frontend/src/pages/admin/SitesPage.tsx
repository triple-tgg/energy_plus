import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { sitesApi, usersApi } from '../../api/client';
import { useLanguage } from '../../contexts/LanguageContext';

interface SiteForm {
    siteName: string;
    siteAddress: string;
    siteStatus: boolean;
}

const emptyForm: SiteForm = { siteName: '', siteAddress: '', siteStatus: true };

const SitesPage: React.FC = () => {
    const { t } = useLanguage();
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<SiteForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    // Delete state
    const [showDelete, setShowDelete] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);

    // Mapped Users Modal state
    const [showUsersModal, setShowUsersModal] = useState(false);
    const [usersTarget, setUsersTarget] = useState<any>(null);
    const [systemUsers, setSystemUsers] = useState<any[]>([]);
    const [mappedUserIds, setMappedUserIds] = useState<number[]>([]);
    const [usersSaving, setUsersSaving] = useState(false);
    const [usersError, setUsersError] = useState('');

    // Success message
    const [successMsg, setSuccessMsg] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await sitesApi.getAll({ page, limit });
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [page, limit]);

    const fetchSystemUsers = useCallback(async () => {
        try {
            const res = await usersApi.getAll({ limit: 1000 });
            setSystemUsers(res.data.data || []);
        } catch (err) { console.error(err); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { fetchSystemUsers(); }, [fetchSystemUsers]);

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
        setEditId(row.site_id);
        setForm({
            siteName: row.site_name || '',
            siteAddress: row.site_address || '',
            siteStatus: row.site_status ?? true,
        });
        setFormError('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.siteName.trim()) {
            setFormError(t('กรุณากรอกชื่อไซต์', 'Site Name is required'));
            return;
        }
        setSaving(true);
        setFormError('');
        try {
            if (editId) {
                await sitesApi.update(editId, form);
                setSuccessMsg(t('อัปเดตไซต์สำเร็จ!', 'Site updated successfully!'));
            } else {
                await sitesApi.create(form);
                setSuccessMsg(t('สร้างไซต์สำเร็จ!', 'Site created successfully!'));
            }
            setShowModal(false);
            fetchData();
        } catch (err: any) {
            setFormError(err.response?.data?.message || t('บันทึกไซต์ล้มเหลว', 'Failed to save site'));
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
            await sitesApi.delete(deleteTarget.site_id);
            setSuccessMsg(t('ลบไซต์สำเร็จ!', 'Site deleted successfully!'));
            setShowDelete(false);
            setDeleteTarget(null);
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.message || t('ลบไซต์ล้มเหลว', 'Failed to delete site'));
        }
        setDeleting(false);
    };

    // User mapping logic
    const handleUsersClick = async (row: any) => {
        setUsersTarget(row);
        setUsersError('');
        setMappedUserIds([]);
        setShowUsersModal(true);
        try {
            const res = await sitesApi.getSiteUsers(row.site_id);
            const mapped = res.data.data || [];
            setMappedUserIds(mapped.map((u: any) => u.user_id));
        } catch (err) {
            setUsersError(t('โหลดข้อมูลผู้ใช้งานที่เชื่อมโยงล้มเหลว', 'Failed to load mapped users'));
        }
    };

    const handleUserCheckboxChange = (userId: number, checked: boolean) => {
        if (checked) {
            setMappedUserIds(prev => [...prev, userId]);
        } else {
            setMappedUserIds(prev => prev.filter(id => id !== userId));
        }
    };

    const handleSaveUsers = async () => {
        if (!usersTarget) return;
        setUsersSaving(true);
        setUsersError('');
        try {
            await sitesApi.updateSiteUsers(usersTarget.site_id, { userIds: mappedUserIds });
            setSuccessMsg(t(`อัปเดตสิทธิ์การเข้าถึงไซต์ "${usersTarget.site_name}" สำหรับผู้ใช้งานสำเร็จ!`, `Updated user permissions for site "${usersTarget.site_name}" successfully!`));
            setShowUsersModal(false);
        } catch (err: any) {
            setUsersError(err.response?.data?.message || t('บันทึกสิทธิ์การเข้าถึงไซต์ล้มเหลว', 'Failed to save site user permissions'));
        }
        setUsersSaving(false);
    };

    const columns = [
        { key: 'site_name', title: t('ชื่อไซต์', 'Site Name') },
        { key: 'site_address', title: t('ที่อยู่', 'Address') },
        {
            key: 'site_status',
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
                    <button className="btn btn-outline btn-sm" onClick={() => handleUsersClick(row)} style={{ fontSize: '11px' }}>
                        👤 {t('ผู้ใช้งาน', 'Users')}
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => handleEdit(row)}>
                        ✏️ {t('แก้ไข', 'Edit')}
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
                title={t('สถานที่ตั้งไซต์', 'Site Locations')}
                columns={columns}
                data={data}
                total={total}
                page={page}
                limit={limit}
                loading={loading}
                onPageChange={setPage}
                onLimitChange={(l) => { setLimit(l); setPage(1); }}
                onCreate={handleCreate}
                createLabel={t('เพิ่มไซต์', 'Add Site')}
            />

            {/* Create/Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editId ? t('แก้ไขไซต์', 'Edit Site') : t('เพิ่มไซต์ใหม่', 'Add New Site')}
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
                    <label className="form-label">{t('ชื่อไซต์', 'Site Name')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                        type="text"
                        className="form-control"
                        placeholder={t('กรอกชื่อไซต์', 'Enter site name')}
                        value={form.siteName}
                        onChange={(e) => setForm({ ...form, siteName: e.target.value })}
                        autoFocus
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">{t('ที่อยู่', 'Address')}</label>
                    <textarea
                        className="form-control"
                        placeholder={t('กรอกที่อยู่', 'Enter site address')}
                        rows={3}
                        value={form.siteAddress}
                        onChange={(e) => setForm({ ...form, siteAddress: e.target.value })}
                        style={{ resize: 'vertical' }}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                            type="checkbox"
                            checked={form.siteStatus}
                            onChange={(e) => setForm({ ...form, siteStatus: e.target.checked })}
                            style={{ width: 18, height: 18, accentColor: 'var(--success)' }}
                        />
                        {t('ใช้งาน', 'Active')}
                    </label>
                </div>
            </Modal>

            {/* Manage Mapped Users Modal */}
            <Modal
                isOpen={showUsersModal}
                onClose={() => setShowUsersModal(false)}
                title={t('กำหนดสิทธิ์การเข้าถึงของผู้ใช้งาน — ', 'Assign User Permissions — ') + (usersTarget?.site_name || '')}
                size="md"
                footer={
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline" onClick={() => setShowUsersModal(false)} disabled={usersSaving}>
                            {t('ยกเลิก', 'Cancel')}
                        </button>
                        <button className="btn btn-primary" onClick={handleSaveUsers} disabled={usersSaving}>
                            {usersSaving ? t('กำลังบันทึก...', 'Saving...') : t('บันทึกสิทธิ์', 'Save Permissions')}
                        </button>
                    </div>
                }
            >
                {usersError && <div className="form-error-banner">{usersError}</div>}

                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                    {t('เลือกผู้ใช้งานที่มีสิทธิ์เข้าถึงและดูข้อมูลของไซต์นี้:', 'Select users who have permission to access and view data for this site:')}
                </p>

                <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', padding: '10px' }}>
                    {systemUsers.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            {t('ไม่พบผู้ใช้งานในระบบ', 'No users found in the system')}
                        </div>
                    ) : (
                        systemUsers.map((user: any) => (
                            <div key={user.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 6px', borderBottom: '1px solid var(--border-light)' }}>
                                <input
                                    type="checkbox"
                                    id={`user-${user.user_id}`}
                                    checked={mappedUserIds.includes(user.user_id)}
                                    onChange={(e) => handleUserCheckboxChange(user.user_id, e.target.checked)}
                                    style={{ width: 18, height: 18 }}
                                />
                                <label htmlFor={`user-${user.user_id}`} style={{ flex: 1, cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{user.user_name}</span>
                                    <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{user.display_name} ({user.group_name})</span>
                                </label>
                            </div>
                        ))
                    )}
                </div>
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
                        {t('ลบไซต์', 'Delete site')}
                    </p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>
                        "{deleteTarget?.site_name}"
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default SitesPage;
