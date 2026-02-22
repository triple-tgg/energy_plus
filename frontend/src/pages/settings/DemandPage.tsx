import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { billingApi } from '../../api/client';

interface DemandForm {
    displayName: string;
    warningSetpoint: string;
    peakSetpoint: string;
    savingRate: string;
    flatRate: string;
    tou: string;
    savingTarget: string;
    isActive: boolean;
}

const emptyForm: DemandForm = {
    displayName: '', warningSetpoint: '', peakSetpoint: '',
    savingRate: '', flatRate: '', tou: '', savingTarget: '', isActive: true,
};

const DemandPage: React.FC = () => {
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<DemandForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const [showDelete, setShowDelete] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await billingApi.getDemandConfigs({ page, limit });
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [page, limit]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { if (successMsg) { const t = setTimeout(() => setSuccessMsg(''), 3000); return () => clearTimeout(t); } }, [successMsg]);

    const handleCreate = () => { setEditId(null); setForm(emptyForm); setFormError(''); setShowModal(true); };

    const handleEdit = (row: any) => {
        setEditId(row.config_id);
        setForm({
            displayName: row.display_name || '',
            warningSetpoint: row.warning_setpoint?.toString() || '',
            peakSetpoint: row.peak_setpoint?.toString() || '',
            savingRate: row.saving_rate?.toString() || '',
            flatRate: row.flat_rate?.toString() || '',
            tou: row.tou?.toString() || '',
            savingTarget: row.saving_target?.toString() || '',
            isActive: row.is_active ?? true,
        });
        setFormError('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.displayName.trim()) { setFormError('กรุณาระบุชื่อ'); return; }
        setSaving(true); setFormError('');
        try {
            const payload = {
                ...form,
                warningSetpoint: form.warningSetpoint ? parseFloat(form.warningSetpoint) : null,
                peakSetpoint: form.peakSetpoint ? parseFloat(form.peakSetpoint) : null,
                savingRate: form.savingRate ? parseFloat(form.savingRate) : null,
                flatRate: form.flatRate ? parseFloat(form.flatRate) : null,
                tou: form.tou ? parseFloat(form.tou) : null,
                savingTarget: form.savingTarget ? parseFloat(form.savingTarget) : null,
            };
            if (editId) {
                await billingApi.updateDemandConfig(editId, payload);
                setSuccessMsg('อัพเดตค่าดีมานด์สำเร็จ!');
            } else {
                await billingApi.createDemandConfig(payload);
                setSuccessMsg('สร้างค่าดีมานด์สำเร็จ!');
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
            await billingApi.deleteDemandConfig(deleteTarget.config_id);
            setSuccessMsg('ลบค่าดีมานด์สำเร็จ!');
            setShowDelete(false); setDeleteTarget(null); fetchData();
        } catch (err: any) { alert(err.response?.data?.message || 'ลบไม่สำเร็จ'); }
        setDeleting(false);
    };

    const columns = [
        { key: 'display_name', title: 'ชื่อ' },
        {
            key: 'warning_setpoint', title: 'เตือน (kW)',
            render: (v: number) => v != null ? `${Number(v).toLocaleString()} kW` : '—',
        },
        {
            key: 'peak_setpoint', title: 'พีค (kW)',
            render: (v: number) => v != null ? `${Number(v).toLocaleString()} kW` : '—',
        },
        {
            key: 'saving_rate', title: 'อัตราประหยัด',
            render: (v: number) => v != null ? v : '—',
        },
        {
            key: 'flat_rate', title: 'Flat Rate',
            render: (v: number) => v != null ? v : '—',
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
            <DataTable title="ดีมานด์ / ประหยัด" columns={columns} data={data} total={total} page={page} limit={limit} loading={loading} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} onCreate={handleCreate} createLabel="เพิ่มค่าดีมานด์" />

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? 'แก้ไขค่าดีมานด์' : 'เพิ่มค่าดีมานด์'} size="md"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>ยกเลิก</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'กำลังบันทึก...' : editId ? 'อัพเดต' : 'สร้าง'}</button></div>}
            >
                {formError && <div className="form-error-banner">{formError}</div>}
                <div className="form-group">
                    <label className="form-label">ชื่อ <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input type="text" className="form-control" placeholder="เช่น อาคารสำนักงาน" value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} autoFocus />
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">ค่าเตือน (kW)</label>
                        <input type="number" className="form-control" placeholder="0" value={form.warningSetpoint} onChange={e => setForm({ ...form, warningSetpoint: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">ค่าพีค (kW)</label>
                        <input type="number" className="form-control" placeholder="0" value={form.peakSetpoint} onChange={e => setForm({ ...form, peakSetpoint: e.target.value })} />
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">อัตราประหยัด</label>
                        <input type="number" className="form-control" step="0.01" placeholder="0" value={form.savingRate} onChange={e => setForm({ ...form, savingRate: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Flat Rate</label>
                        <input type="number" className="form-control" step="0.01" placeholder="0" value={form.flatRate} onChange={e => setForm({ ...form, flatRate: e.target.value })} />
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">TOU</label>
                        <input type="number" className="form-control" step="0.01" placeholder="0" value={form.tou} onChange={e => setForm({ ...form, tou: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">เป้าประหยัด</label>
                        <input type="number" className="form-control" step="0.01" placeholder="0" value={form.savingTarget} onChange={e => setForm({ ...form, savingTarget: e.target.value })} />
                    </div>
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
                    <p style={{ fontSize: 16, marginBottom: 8 }}>ลบค่าดีมานด์</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>"{deleteTarget?.display_name}"</p>
                </div>
            </Modal>
        </div>
    );
};

export default DemandPage;
