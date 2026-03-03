import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/ui/StatusBadge';
import { exportApi } from '../../api/client';

interface ExportForm {
    name: string;
    exportPath: string;
    scheduleEvery: string;
    isActive: boolean;
}

const emptyForm: ExportForm = { name: '', exportPath: '', scheduleEvery: '', isActive: true };

const ExportSettingsPage: React.FC = () => {
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<ExportForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const [showDelete, setShowDelete] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await exportApi.getAll({ page, limit });
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
            name: row.name || '',
            exportPath: row.export_path || '',
            scheduleEvery: row.schedule_every || '',
            isActive: row.is_active ?? true,
        });
        setFormError('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.name) { setFormError('กรุณาระบุชื่อ'); return; }
        if (!form.exportPath) { setFormError('กรุณาระบุ Export Path'); return; }
        setSaving(true); setFormError('');
        try {
            if (editId) {
                await exportApi.update(editId, form);
                setSuccessMsg('อัพเดตเรียบร้อย!');
            } else {
                await exportApi.create(form);
                setSuccessMsg('สร้างเรียบร้อย!');
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
            await exportApi.delete(deleteTarget.id);
            setSuccessMsg('ลบเรียบร้อย!');
            setShowDelete(false); setDeleteTarget(null); fetchData();
        } catch (err: any) { alert(err.response?.data?.message || 'ลบไม่สำเร็จ'); }
        setDeleting(false);
    };

    const columns = [
        { key: 'name', title: 'Name' },
        { key: 'export_path', title: 'ExportPath' },
        { key: 'schedule_every', title: 'ScheduleEvery' },
        {
            key: 'is_active', title: 'ใช้งาน',
            render: (v: boolean) => <StatusBadge status={v ? 'active' : 'inactive'} />,
        },
        { key: 'created_by', title: 'ผู้สร้าง' },
        {
            key: 'created_at', title: 'วันที่สร้าง',
            render: (v: string) => v ? new Date(v).toLocaleString('th-TH') : '—',
        },
        { key: 'updated_by', title: 'ผู้แก้ไข' },
        {
            key: 'updated_at', title: 'วันที่แก้ไข',
            render: (v: string) => v ? new Date(v).toLocaleString('th-TH') : '—',
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
            <DataTable title="ตั้งค่าการ Export" columns={columns} data={data} total={total} page={page} limit={limit} loading={loading} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} onCreate={handleCreate} createLabel="สร้าง Export ใหม่" />

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? 'แก้ไข Export' : 'สร้าง Export ใหม่'} size="md"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>ยกเลิก</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'กำลังบันทึก...' : editId ? 'อัพเดต' : 'สร้าง'}</button></div>}
            >
                {formError && <div className="form-error-banner">{formError}</div>}
                <div className="form-group">
                    <label className="form-label">ชื่อ <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input type="text" className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="เช่น AutoExport" />
                </div>
                <div className="form-group">
                    <label className="form-label">Export Path <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input type="text" className="form-control" value={form.exportPath} onChange={e => setForm({ ...form, exportPath: e.target.value })} placeholder="เช่น D:\EnergyExports" />
                </div>
                <div className="form-group">
                    <label className="form-label">Schedule Every</label>
                    <input type="datetime-local" className="form-control" value={form.scheduleEvery} onChange={e => setForm({ ...form, scheduleEvery: e.target.value })} />
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
                    <p>ลบ Export <strong style={{ color: 'var(--danger)' }}>{deleteTarget?.name}</strong></p>
                </div>
            </Modal>
        </div>
    );
};

export default ExportSettingsPage;
