import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { sitesApi } from '../../api/client';
import { useLanguage } from '../../contexts/LanguageContext';

interface BuildingForm {
    buildingName: string;
    siteId: string;
    isActive: boolean;
}

const emptyForm: BuildingForm = { buildingName: '', siteId: '', isActive: true };

const BuildingsPage: React.FC = () => {
    const { t } = useLanguage();
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(true);

    // Sites for dropdown
    const [sites, setSites] = useState<any[]>([]);

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<BuildingForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    // Delete
    const [showDelete, setShowDelete] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);

    // Toast
    const [successMsg, setSuccessMsg] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await sitesApi.getAllBuildings({ page, limit });
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [page, limit]);

    const fetchSites = useCallback(async () => {
        try {
            const res = await sitesApi.getAll({ limit: 100 });
            setSites(res.data.data || []);
        } catch (err) { console.error(err); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { fetchSites(); }, [fetchSites]);

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
        setEditId(row.building_id);
        setForm({
            buildingName: row.building_name || '',
            siteId: row.site_id?.toString() || '',
            isActive: row.is_active ?? true,
        });
        setFormError('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.buildingName.trim()) {
            setFormError(t('กรุณากรอกชื่ออาคาร', 'Building Name is required'));
            return;
        }
        if (!form.siteId) {
            setFormError(t('กรุณาเลือกไซต์', 'Site is required'));
            return;
        }
        setSaving(true);
        setFormError('');
        try {
            const payload = {
                buildingName: form.buildingName,
                siteId: parseInt(form.siteId),
                isActive: form.isActive,
            };
            if (editId) {
                await sitesApi.updateBuilding(editId, payload);
                setSuccessMsg(t('อัปเดตอาคารสำเร็จ!', 'Building updated successfully!'));
            } else {
                await sitesApi.createBuilding(payload);
                setSuccessMsg(t('สร้างอาคารสำเร็จ!', 'Building created successfully!'));
            }
            setShowModal(false);
            fetchData();
        } catch (err: any) {
            setFormError(err.response?.data?.message || t('บันทึกอาคารล้มเหลว', 'Failed to save building'));
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
            await sitesApi.deleteBuilding(deleteTarget.building_id);
            setSuccessMsg(t('ลบอาคารสำเร็จ!', 'Building deleted successfully!'));
            setShowDelete(false);
            setDeleteTarget(null);
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.message || t('ลบอาคารล้มเหลว', 'Failed to delete building'));
        }
        setDeleting(false);
    };

    const columns = [
        { key: 'building_name', title: t('ชื่ออาคาร', 'Building Name') },
        { key: 'site_name', title: t('ชื่อไซต์', 'Site Name') },
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
                title={t('อาคาร', 'Buildings')}
                columns={columns}
                data={data}
                total={total}
                page={page}
                limit={limit}
                loading={loading}
                onPageChange={setPage}
                onLimitChange={(l) => { setLimit(l); setPage(1); }}
                onCreate={handleCreate}
                createLabel={t('เพิ่มอาคาร', 'Add Building')}
            />

            {/* Create / Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editId ? t('แก้ไขอาคาร', 'Edit Building') : t('เพิ่มอาคารใหม่', 'Add New Building')}
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
                    <label className="form-label">
                        {t('ชื่ออาคาร', 'Building Name')} <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                        type="text"
                        className="form-control"
                        placeholder={t('กรอกชื่ออาคาร', 'Enter building name')}
                        value={form.buildingName}
                        onChange={(e) => setForm({ ...form, buildingName: e.target.value })}
                        autoFocus
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">
                        {t('ไซต์', 'Site')} <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <select
                        className="form-control"
                        value={form.siteId}
                        onChange={(e) => setForm({ ...form, siteId: e.target.value })}
                    >
                        <option value="">— {t('เลือกไซต์', 'Select Site')} —</option>
                        {sites.map((s: any) => (
                            <option key={s.site_id} value={s.site_id}>{s.site_name}</option>
                        ))}
                    </select>
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
                        {t('ลบอาคาร', 'Delete building')}
                    </p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>
                        "{deleteTarget?.building_name}"
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default BuildingsPage;
