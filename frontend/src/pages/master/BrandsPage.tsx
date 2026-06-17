import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { metersApi } from '../../api/client';
import { useLanguage } from '../../contexts/LanguageContext';

interface BrandForm {
    meterBrandName: string;
    modelName: string;
    notes: string;
    isActive: boolean;
}

const emptyForm: BrandForm = { meterBrandName: '', modelName: '', notes: '', isActive: true };

const BrandsPage: React.FC = () => {
    const { t } = useLanguage();
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<BrandForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const [showDelete, setShowDelete] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await metersApi.getBrands({ page, limit });
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

    const handleCreate = () => { setEditId(null); setForm(emptyForm); setFormError(''); setShowModal(true); };

    const handleEdit = (row: any) => {
        setEditId(row.meter_brand_id);
        setForm({
            meterBrandName: row.meter_brand_name || '',
            modelName: row.model_name || '',
            notes: row.notes || '',
            isActive: row.is_active ?? true,
        });
        setFormError('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.meterBrandName.trim()) { setFormError(t('กรุณากรอกชื่อแบรนด์', 'Brand Name is required')); return; }
        setSaving(true); setFormError('');
        try {
            if (editId) {
                await metersApi.updateBrand(editId, form);
                setSuccessMsg(t('อัปเดตแบรนด์สำเร็จ!', 'Brand updated successfully!'));
            } else {
                await metersApi.createBrand(form);
                setSuccessMsg(t('สร้างแบรนด์สำเร็จ!', 'Brand created successfully!'));
            }
            setShowModal(false); fetchData();
        } catch (err: any) { setFormError(err.response?.data?.message || t('บันทึกแบรนด์ล้มเหลว', 'Failed to save brand')); }
        setSaving(false);
    };

    const handleDeleteClick = (row: any) => { setDeleteTarget(row); setShowDelete(true); };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await metersApi.deleteBrand(deleteTarget.meter_brand_id);
            setSuccessMsg(t('ลบแบรนด์สำเร็จ!', 'Brand deleted successfully!'));
            setShowDelete(false); setDeleteTarget(null); fetchData();
        } catch (err: any) { alert(err.response?.data?.message || t('ลบแบรนด์ล้มเหลว', 'Failed to delete brand')); }
        setDeleting(false);
    };

    const columns = [
        { key: 'meter_brand_name', title: t('ชื่อแบรนด์', 'Brand Name') },
        { key: 'model_name', title: t('รุ่น', 'Model') },
        { key: 'notes', title: t('หมายเหตุ', 'Notes') },
        {
            key: 'is_active', title: t('สถานะ', 'Status'),
            render: (v: boolean) => <span className={`badge ${v ? 'badge-success' : 'badge-danger'}`}>{v ? t('ใช้งาน', 'Active') : t('ไม่ใช้งาน', 'Inactive')}</span>,
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
            <DataTable title={t('แบรนด์มิเตอร์', 'Meter Brands')} columns={columns} data={data} total={total} page={page} limit={limit} loading={loading} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} onCreate={handleCreate} createLabel={t('เพิ่มแบรนด์', 'Add Brand')} />

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? t('แก้ไขแบรนด์', 'Edit Brand') : t('เพิ่มแบรนด์ใหม่', 'Add New Brand')} size="md"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>{t('ยกเลิก', 'Cancel')}</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('กำลังบันทึก...', 'Saving...') : editId ? t('อัปเดต', 'Update') : t('สร้าง', 'Create')}</button></div>}
            >
                {formError && <div className="form-error-banner">{formError}</div>}
                <div className="form-group">
                    <label className="form-label">{t('ชื่อแบรนด์', 'Brand Name')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input type="text" className="form-control" placeholder={t('กรอกชื่อแบรนด์', 'Enter brand name')} value={form.meterBrandName} onChange={(e) => setForm({ ...form, meterBrandName: e.target.value })} autoFocus />
                </div>
                <div className="form-group">
                    <label className="form-label">{t('ชื่อรุ่น', 'Model Name')}</label>
                    <input type="text" className="form-control" placeholder={t('กรอกชื่อรุ่น', 'Enter model name')} value={form.modelName} onChange={(e) => setForm({ ...form, modelName: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label">{t('หมายเหตุ', 'Notes')}</label>
                    <textarea className="form-control" placeholder={t('หมายเหตุเพิ่มเติม (ถ้ามี)', 'Optional notes')} rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ resize: 'vertical' }} />
                </div>
                <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--success)' }} />
                        {t('ใช้งาน', 'Active')}
                    </label>
                </div>
            </Modal>

            <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title={t('ยืนยันการลบ', 'Confirm Delete')} size="sm"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowDelete(false)} disabled={deleting}>{t('ยกเลิก', 'Cancel')}</button><button className="btn btn-danger" onClick={handleDeleteConfirm} disabled={deleting}>{deleting ? t('กำลังลบ...', 'Deleting...') : t('ลบ', 'Delete')}</button></div>}
            >
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                    <p style={{ fontSize: 16, marginBottom: 8 }}>{t('ลบแบรนด์', 'Delete brand')}</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>"{deleteTarget?.meter_brand_name}"</p>
                </div>
            </Modal>
        </div>
    );
};

export default BrandsPage;
