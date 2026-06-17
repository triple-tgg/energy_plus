import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { billingApi } from '../../api/client';
import { useLanguage } from '../../contexts/LanguageContext';

interface BillingForm {
    effectiveDate: string;
    unitPrice: string;
    isActive: boolean;
}

const emptyForm: BillingForm = { effectiveDate: '', unitPrice: '', isActive: true };

const BillingPage: React.FC = () => {
    const { t, language } = useLanguage();
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<BillingForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const [showDelete, setShowDelete] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await billingApi.getConfigs({ page, limit });
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [page, limit]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { if (successMsg) { const t = setTimeout(() => setSuccessMsg(''), 3000); return () => clearTimeout(t); } }, [successMsg]);

    const handleCreate = () => { setEditId(null); setForm(emptyForm); setFormError(''); setShowModal(true); };

    const handleEdit = (row: any) => {
        setEditId(row.id);
        setForm({
            effectiveDate: row.effective_date ? row.effective_date.substring(0, 10) : '',
            unitPrice: row.unit_price?.toString() || '',
            isActive: row.is_active ?? true,
        });
        setFormError('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.effectiveDate) { setFormError(t('กรุณาระบุวันที่มีผลบังคับใช้', 'Please specify the effective date')); return; }
        if (!form.unitPrice) { setFormError(t('กรุณาระบุราคาต่อหน่วย', 'Please specify the unit price')); return; }
        setSaving(true); setFormError('');
        try {
            const payload = {
                ...form,
                unitPrice: parseFloat(form.unitPrice),
            };
            if (editId) {
                await billingApi.updateConfig(editId, payload);
                setSuccessMsg(t('อัปเดตอัตราค่าไฟฟ้าสำเร็จ!', 'Updated electricity rate successfully!'));
            } else {
                await billingApi.createConfig(payload);
                setSuccessMsg(t('สร้างอัตราค่าไฟฟ้าสำเร็จ!', 'Created electricity rate successfully!'));
            }
            setShowModal(false); fetchData();
        } catch (err: any) { setFormError(err.response?.data?.message || t('บันทึกไม่สำเร็จ', 'Save failed')); }
        setSaving(false);
    };

    const handleDeleteClick = (row: any) => { setDeleteTarget(row); setShowDelete(true); };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await billingApi.deleteConfig(deleteTarget.id);
            setSuccessMsg(t('ลบอัตราค่าไฟฟ้าสำเร็จ!', 'Deleted electricity rate successfully!'));
            setShowDelete(false); setDeleteTarget(null); fetchData();
        } catch (err: any) { alert(err.response?.data?.message || t('ลบไม่สำเร็จ', 'Delete failed')); }
        setDeleting(false);
    };

    const columns = [
        {
            key: 'effective_date', title: t('วันที่มีผลบังคับใช้', 'Effective Date'),
            render: (v: string) => v ? new Date(v).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—',
        },
        {
            key: 'unit_price', title: t('ราคาต่อหน่วย (฿/หน่วย)', 'Unit Price (฿/kWh)'),
            render: (v: number) => v != null ? `฿${Number(v).toFixed(4)}` : '—',
        },
        {
            key: 'is_active', title: t('สถานะ', 'Status'),
            render: (v: boolean) => (
                <span className={`badge ${v ? 'badge-success' : 'badge-danger'}`}>
                    {v ? t('ใช้งาน', 'Active') : t('ปิดใช้งาน', 'Inactive')}
                </span>
            ),
        },
        {
            key: 'actions', title: t('การจัดการ', 'Actions'),
            render: (_: any, row: any) => (
                <div className="table-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => handleEdit(row)}>{t('✏️ แก้ไข', '✏️ Edit')}</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteClick(row)}>{t('🗑️ ลบ', '🗑️ Delete')}</button>
                </div>
            ),
        },
    ];

    return (
        <div>
            {successMsg && <div className="toast-success">✅ {successMsg}</div>}
            <DataTable title={t('อัตราค่าไฟฟ้า', 'Electricity Rates')} columns={columns} data={data} total={total} page={page} limit={limit} loading={loading} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} onCreate={handleCreate} createLabel={t('เพิ่มอัตราค่าไฟฟ้า', 'Add Rate')} />

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? t('แก้ไขอัตราค่าไฟฟ้า', 'Edit Electricity Rate') : t('เพิ่มอัตราค่าไฟฟ้า', 'Add Electricity Rate')} size="sm"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>{t('ยกเลิก', 'Cancel')}</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('กำลังบันทึก...', 'Saving...') : editId ? t('อัปเดต', 'Update') : t('สร้าง', 'Create')}</button></div>}
            >
                {formError && <div className="form-error-banner">{formError}</div>}
                <div className="form-group">
                    <label className="form-label">{t('วันที่มีผลบังคับใช้', 'Effective Date')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input type="date" className="form-control" value={form.effectiveDate} onChange={e => setForm({ ...form, effectiveDate: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label">{t('ราคาต่อหน่วย (฿/หน่วย)', 'Unit Price (฿/kWh)')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input type="number" className="form-control" step="0.0001" placeholder={t('เช่น 4.1503', 'e.g. 4.1503')} value={form.unitPrice} onChange={e => setForm({ ...form, unitPrice: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--success)' }} />
                        {t('เปิดใช้งาน', 'Active')}
                    </label>
                </div>
            </Modal>

            <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title={t('ยืนยันการลบ', 'Confirm Delete')} size="sm"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowDelete(false)} disabled={deleting}>{t('ยกเลิก', 'Cancel')}</button><button className="btn btn-danger" onClick={handleDeleteConfirm} disabled={deleting}>{deleting ? t('กำลังลบ...', 'Deleting...') : t('ลบ', 'Delete')}</button></div>}
            >
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                    <p style={{ fontSize: 16, marginBottom: 8 }}>{t('ต้องการลบอัตราค่าไฟฟ้า', 'Delete electricity rate')}</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>
                        {deleteTarget?.effective_date ? new Date(deleteTarget.effective_date).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US') : ''} — ฿{deleteTarget?.unit_price}
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default BillingPage;
