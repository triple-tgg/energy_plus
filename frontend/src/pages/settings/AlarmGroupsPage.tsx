import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { alarmsApi } from '../../api/client';

interface GroupForm {
    groupName: string;
    email: string;
    telegramToken: string;
    telegramChatId: string;
    isActive: boolean;
}

const emptyForm: GroupForm = { groupName: '', email: '', telegramToken: '', telegramChatId: '', isActive: true };

const AlarmGroupsPage: React.FC = () => {
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<GroupForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const [showDelete, setShowDelete] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await alarmsApi.getGroups({ page, limit });
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [page, limit]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { if (successMsg) { const t = setTimeout(() => setSuccessMsg(''), 3000); return () => clearTimeout(t); } }, [successMsg]);

    const handleCreate = () => { setEditId(null); setForm(emptyForm); setFormError(''); setShowModal(true); };

    const handleEdit = (row: any) => {
        setEditId(row.alarm_group_id);
        setForm({
            groupName: row.group_name || '',
            email: row.email || '',
            telegramToken: row.telegram_token || '',
            telegramChatId: row.telegram_chat_id || '',
            isActive: row.is_active ?? true,
        });
        setFormError('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.groupName.trim()) { setFormError('ชื่อกลุ่มจำเป็นต้องกรอก'); return; }
        setSaving(true); setFormError('');
        try {
            if (editId) {
                await alarmsApi.updateGroup(editId, form);
                setSuccessMsg('อัพเดตกลุ่มแจ้งเตือนสำเร็จ!');
            } else {
                await alarmsApi.createGroup(form);
                setSuccessMsg('สร้างกลุ่มแจ้งเตือนสำเร็จ!');
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
            await alarmsApi.deleteGroup(deleteTarget.alarm_group_id);
            setSuccessMsg('ลบกลุ่มแจ้งเตือนสำเร็จ!');
            setShowDelete(false); setDeleteTarget(null); fetchData();
        } catch (err: any) { alert(err.response?.data?.message || 'ลบไม่สำเร็จ'); }
        setDeleting(false);
    };

    const columns = [
        { key: 'group_name', title: 'ชื่อกลุ่ม' },
        { key: 'email', title: 'อีเมล' },
        { key: 'telegram_chat_id', title: 'Telegram Chat ID' },
        {
            key: 'is_active', title: 'สถานะ',
            render: (v: boolean) => <span className={`badge ${v ? 'badge-success' : 'badge-danger'}`}>{v ? 'ใช้งาน' : 'ปิดใช้งาน'}</span>,
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
            <DataTable title="กลุ่มแจ้งเตือน" columns={columns} data={data} total={total} page={page} limit={limit} loading={loading} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} onCreate={handleCreate} createLabel="เพิ่มกลุ่ม" />

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? 'แก้ไขกลุ่มแจ้งเตือน' : 'เพิ่มกลุ่มแจ้งเตือน'} size="md"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>ยกเลิก</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'กำลังบันทึก...' : editId ? 'อัพเดต' : 'สร้าง'}</button></div>}
            >
                {formError && <div className="form-error-banner">{formError}</div>}
                <div className="form-group">
                    <label className="form-label">ชื่อกลุ่ม <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input type="text" className="form-control" placeholder="เช่น ทีมซ่อมบำรุง" value={form.groupName} onChange={e => setForm({ ...form, groupName: e.target.value })} autoFocus />
                </div>
                <div className="form-group">
                    <label className="form-label">อีเมล</label>
                    <input type="email" className="form-control" placeholder="email@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label">Telegram Token</label>
                    <input type="text" className="form-control" placeholder="Bot token" value={form.telegramToken} onChange={e => setForm({ ...form, telegramToken: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label">Telegram Chat ID</label>
                    <input type="text" className="form-control" placeholder="Chat ID" value={form.telegramChatId} onChange={e => setForm({ ...form, telegramChatId: e.target.value })} />
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
                    <p style={{ fontSize: 16, marginBottom: 8 }}>ลบกลุ่มแจ้งเตือน</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>"{deleteTarget?.group_name}"</p>
                </div>
            </Modal>
        </div>
    );
};

export default AlarmGroupsPage;
