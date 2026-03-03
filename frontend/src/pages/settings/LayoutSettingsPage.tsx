import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/ui/StatusBadge';
import { layoutsApi } from '../../api/client';

interface LayoutForm {
    name: string;
    imageName: string;
    position: string;
    imageFile: File | null;
}

const emptyForm: LayoutForm = { name: '', imageName: '', position: '', imageFile: null };

const LayoutSettingsPage: React.FC = () => {
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<LayoutForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const [showDelete, setShowDelete] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await layoutsApi.getAll({ page, limit });
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
            imageName: row.image_name || '',
            position: row.position || '',
            imageFile: null,
        });
        setFormError('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.name) { setFormError('กรุณาระบุชื่อ'); return; }
        setSaving(true); setFormError('');
        try {
            const formData = new FormData();
            formData.append('name', form.name);
            formData.append('position', form.position);
            if (form.imageFile) formData.append('image', form.imageFile);

            if (editId) {
                await layoutsApi.update(editId, formData);
                setSuccessMsg('อัพเดตเรียบร้อย!');
            } else {
                await layoutsApi.create(formData);
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
            await layoutsApi.delete(deleteTarget.id);
            setSuccessMsg('ลบเรียบร้อย!');
            setShowDelete(false); setDeleteTarget(null); fetchData();
        } catch (err: any) { alert(err.response?.data?.message || 'ลบไม่สำเร็จ'); }
        setDeleting(false);
    };

    const columns = [
        { key: 'name', title: 'Name' },
        { key: 'image_name', title: 'Image Name' },
        {
            key: 'image_url', title: 'Image',
            render: (v: string) => v ? (
                <img src={v} alt="layout" style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)' }} />
            ) : <span style={{ color: 'var(--text-muted)' }}>—</span>,
        },
        {
            key: 'position', title: 'Position',
            render: (v: string) => v ? <StatusBadge status={v} type="info" /> : '—',
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
            <DataTable title="ตั้งค่าภาพแผนผังสถานที่" columns={columns} data={data} total={total} page={page} limit={limit} loading={loading} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} onCreate={handleCreate} createLabel="สร้างแผนผังใหม่" />

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? 'แก้ไขแผนผัง' : 'สร้างแผนผังใหม่'} size="md"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>ยกเลิก</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'กำลังบันทึก...' : editId ? 'อัพเดต' : 'สร้าง'}</button></div>}
            >
                {formError && <div className="form-error-banner">{formError}</div>}
                <div className="form-group">
                    <label className="form-label">ชื่อ <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input type="text" className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="เช่น 111PMT_Building_A" />
                </div>
                <div className="form-group">
                    <label className="form-label">Position</label>
                    <input type="text" className="form-control" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} placeholder="เช่น LA-100" />
                </div>
                <div className="form-group">
                    <label className="form-label">รูปแผนผัง</label>
                    <input type="file" className="form-control" accept="image/*" onChange={e => {
                        const file = e.target.files?.[0] || null;
                        setForm({ ...form, imageFile: file, imageName: file?.name || form.imageName });
                    }} />
                </div>
            </Modal>

            <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title="ยืนยันการลบ" size="sm"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowDelete(false)} disabled={deleting}>ยกเลิก</button><button className="btn btn-danger" onClick={handleDeleteConfirm} disabled={deleting}>{deleting ? 'กำลังลบ...' : 'ลบ'}</button></div>}
            >
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                    <p>ลบแผนผัง <strong style={{ color: 'var(--danger)' }}>{deleteTarget?.name}</strong></p>
                </div>
            </Modal>
        </div>
    );
};

export default LayoutSettingsPage;
