import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { metersApi } from '../../api/client';
import { useLanguage } from '../../contexts/LanguageContext';

interface TypeForm {
    meterTypeName: string;
    iconName: string;
    isActive: boolean;
}

const emptyForm: TypeForm = { meterTypeName: '', iconName: '', isActive: true };

const MeterTypesPage: React.FC = () => {
    const { t } = useLanguage();
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(true);

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<TypeForm>(emptyForm);
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
            const res = await metersApi.getTypes({ page, limit });
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
        setEditId(row.meter_type_id);
        setForm({
            meterTypeName: row.meter_type_name || '',
            iconName: row.icon_name || '',
            isActive: row.is_active ?? true,
        });
        setFormError('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.meterTypeName.trim()) {
            setFormError(t('กรุณากรอกชื่อประเภทมิเตอร์', 'Meter Type Name is required'));
            return;
        }
        setSaving(true);
        setFormError('');
        try {
            if (editId) {
                await metersApi.updateType(editId, form);
                setSuccessMsg(t('อัปเดตประเภทมิเตอร์สำเร็จ!', 'Meter type updated successfully!'));
            } else {
                await metersApi.createType(form);
                setSuccessMsg(t('สร้างประเภทมิเตอร์สำเร็จ!', 'Meter type created successfully!'));
            }
            setShowModal(false);
            fetchData();
        } catch (err: any) {
            setFormError(err.response?.data?.message || t('บันทึกประเภทมิเตอร์ล้มเหลว', 'Failed to save meter type'));
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
            await metersApi.deleteType(deleteTarget.meter_type_id);
            setSuccessMsg(t('ลบประเภทมิเตอร์สำเร็จ!', 'Meter type deleted successfully!'));
            setShowDelete(false);
            setDeleteTarget(null);
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.message || t('ลบประเภทมิเตอร์ล้มเหลว', 'Failed to delete meter type'));
        }
        setDeleting(false);
    };

    const columns = [
        { key: 'meter_type_name', title: t('ชื่อประเภท', 'Type Name') },
        { key: 'icon_name', title: t('ไอคอน', 'Icon') },
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
                    <button className="btn btn-primary btn-sm" onClick={() => handleEdit(row)}>✏️ {t('แก้ไข', 'Edit')}</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteClick(row)}>🗑️ {t('ลบ', 'Delete')}</button>
                </div>
            ),
        },
    ];

    return (
        <div>
            {successMsg && <div className="toast-success">✅ {successMsg}</div>}

            <DataTable
                title={t('ประเภทมิเตอร์', 'Meter Types')}
                columns={columns}
                data={data}
                total={total}
                page={page}
                limit={limit}
                loading={loading}
                onPageChange={setPage}
                onLimitChange={(l) => { setLimit(l); setPage(1); }}
                onCreate={handleCreate}
                createLabel={t('เพิ่มประเภท', 'Add Type')}
            />

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editId ? t('แก้ไขประเภทมิเตอร์', 'Edit Meter Type') : t('เพิ่มประเภทมิเตอร์ใหม่', 'Add New Meter Type')}
                size="md"
                footer={
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>{t('ยกเลิก', 'Cancel')}</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? t('กำลังบันทึก...', 'Saving...') : editId ? t('อัปเดต', 'Update') : t('สร้าง', 'Create')}
                        </button>
                    </div>
                }
            >
                {formError && <div className="form-error-banner">{formError}</div>}

                <div className="form-group">
                    <label className="form-label">{t('ชื่อประเภท', 'Type Name')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                        type="text"
                        className="form-control"
                        placeholder={t('เช่น ไฟฟ้า, น้ำ, แก๊ส', 'e.g. Electricity, Water, Gas')}
                        value={form.meterTypeName}
                        onChange={(e) => setForm({ ...form, meterTypeName: e.target.value })}
                        autoFocus
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">{t('ชื่อไอคอน', 'Icon Name')}</label>
                    <input
                        type="text"
                        className="form-control"
                        placeholder={t('เช่น ⚡ หรือชื่อคลาสไอคอน', 'e.g. ⚡ or icon class name')}
                        value={form.iconName}
                        onChange={(e) => setForm({ ...form, iconName: e.target.value })}
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

            <Modal
                isOpen={showDelete}
                onClose={() => setShowDelete(false)}
                title={t('ยืนยันการลบ', 'Confirm Delete')}
                size="sm"
                footer={
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline" onClick={() => setShowDelete(false)} disabled={deleting}>{t('ยกเลิก', 'Cancel')}</button>
                        <button className="btn btn-danger" onClick={handleDeleteConfirm} disabled={deleting}>
                            {deleting ? t('กำลังลบ...', 'Deleting...') : t('ลบ', 'Delete')}
                        </button>
                    </div>
                }
            >
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                    <p style={{ fontSize: 16, marginBottom: 8 }}>{t('ลบประเภทมิเตอร์', 'Delete meter type')}</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>
                        "{deleteTarget?.meter_type_name}"
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                        {t('มิเตอร์ที่ใช้ประเภทนี้อาจได้รับผลกระทบ', 'Meters using this type may be affected.')}
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default MeterTypesPage;
