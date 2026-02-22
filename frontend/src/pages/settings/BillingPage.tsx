import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { billingApi } from '../../api/client';

interface BillingForm {
    effectiveDate: string;
    unitPrice: string;
    isActive: boolean;
}

const emptyForm: BillingForm = { effectiveDate: '', unitPrice: '', isActive: true };

const BillingPage: React.FC = () => {
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
        if (!form.effectiveDate) { setFormError('กรุณาระบุวันที่มีผล'); return; }
        if (!form.unitPrice) { setFormError('กรุณาระบุราคาต่อหน่วย'); return; }
        setSaving(true); setFormError('');
        try {
            const payload = {
                ...form,
                unitPrice: parseFloat(form.unitPrice),
            };
            if (editId) {
                await billingApi.updateConfig(editId, payload);
                setSuccessMsg('อัพเดตอัตราค่าไฟสำเร็จ!');
            } else {
                await billingApi.createConfig(payload);
                setSuccessMsg('สร้างอัตราค่าไฟสำเร็จ!');
            }
            setShowModal(false); fetchData();
        } catch (err: any) { setFormError(err.response?.data?.message || 'บันทึกไม่สำเร็จ'); }
        setSaving(false);
    };

    const handleDeleteClick = (row: any) => { setDeleteTarget(row); setShowDelete(true); };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await billingApi.deleteConfig(deleteTarget.id);
            setSuccessMsg('ลบอัตราค่าไฟสำเร็จ!');
            setShowDelete(false); setDeleteTarget(null); fetchData();
        } catch (err: any) { alert(err.response?.data?.message || 'ลบไม่สำเร็จ'); }
        setDeleting(false);
    };

    const columns = [
        {
            key: 'effective_date', title: 'วันที่มีผล',
            render: (v: string) => v ? new Date(v).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '—',
        },
        {
            key: 'unit_price', title: 'ราคาต่อหน่วย (฿/kWh)',
            render: (v: number) => v != null ? `฿${Number(v).toFixed(4)}` : '—',
        },
        {
            key: 'is_active', title: 'สถานะ',
            render: (v: boolean) => <span className={`badge ${v ? 'badge-success' : 'badge-danger'}`}>{v ? 'ใช้งาน' : 'ปิด'}</span>,
        },
        {
            key: 'actions', title: 'จัดการ',
            render: (_: any, row: any) => (
                <div className="table-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => handleEdit(row)}>✏️ แก้ไข</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteClick(row)}>🗑️ ลบ</button>
                </div>
            ),
        },
    ];

    return (
        <div>
            {successMsg && <div className="toast-success">✅ {successMsg}</div>}
            <DataTable title="อัตราค่าไฟฟ้า" columns={columns} data={data} total={total} page={page} limit={limit} loading={loading} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} onCreate={handleCreate} createLabel="เพิ่มอัตรา" />

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? 'แก้ไขอัตราค่าไฟ' : 'เพิ่มอัตราค่าไฟ'} size="sm"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>ยกเลิก</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'กำลังบันทึก...' : editId ? 'อัพเดต' : 'สร้าง'}</button></div>}
            >
                {formError && <div className="form-error-banner">{formError}</div>}
                <div className="form-group">
                    <label className="form-label">วันที่มีผล <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input type="date" className="form-control" value={form.effectiveDate} onChange={e => setForm({ ...form, effectiveDate: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label">ราคาต่อหน่วย (฿/kWh) <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input type="number" className="form-control" step="0.0001" placeholder="เช่น 4.1503" value={form.unitPrice} onChange={e => setForm({ ...form, unitPrice: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--success)' }} />
                        ใช้งาน
                    </label>
                </div>
            </Modal>

            <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title="ยืนยันการลบ" size="sm"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowDelete(false)} disabled={deleting}>ยกเลิก</button><button className="btn btn-danger" onClick={handleDeleteConfirm} disabled={deleting}>{deleting ? 'กำลังลบ...' : 'ลบ'}</button></div>}
            >
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                    <p style={{ fontSize: 16, marginBottom: 8 }}>ลบอัตราค่าไฟ</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>
                        {deleteTarget?.effective_date ? new Date(deleteTarget.effective_date).toLocaleDateString('th-TH') : ''} — ฿{deleteTarget?.unit_price}
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default BillingPage;
