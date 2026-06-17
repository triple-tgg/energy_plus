import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { alarmsApi } from '../../api/client';
import { useLanguage } from '../../contexts/LanguageContext';

interface GroupForm {
    groupName: string;
    email: string;
    telegramToken: string;
    telegramChatId: string;
    isActive: boolean;
}

const emptyForm: GroupForm = { groupName: '', email: '', telegramToken: '', telegramChatId: '', isActive: true };

const AlarmGroupsPage: React.FC = () => {
    const { t } = useLanguage();
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
        if (!form.groupName.trim()) { setFormError(t('กรุณาระบุชื่อกลุ่ม', 'Group name is required')); return; }
        setSaving(true); setFormError('');
        try {
            if (editId) {
                await alarmsApi.updateGroup(editId, form);
                setSuccessMsg(t('อัปเดตกลุ่มการแจ้งเตือนสำเร็จ!', 'Updated alarm group successfully!'));
            } else {
                await alarmsApi.createGroup(form);
                setSuccessMsg(t('สร้างกลุ่มการแจ้งเตือนสำเร็จ!', 'Created alarm group successfully!'));
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
            await alarmsApi.deleteGroup(deleteTarget.alarm_group_id);
            setSuccessMsg(t('ลบกลุ่มการแจ้งเตือนสำเร็จ!', 'Deleted alarm group successfully!'));
            setShowDelete(false); setDeleteTarget(null); fetchData();
        } catch (err: any) { alert(err.response?.data?.message || t('ลบไม่สำเร็จ', 'Delete failed')); }
        setDeleting(false);
    };

    const columns = [
        { key: 'group_name', title: t('ชื่อกลุ่ม', 'Group Name') },
        { key: 'email', title: t('อีเมล', 'Email') },
        { key: 'telegram_chat_id', title: t('Telegram Chat ID', 'Telegram Chat ID') },
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
            <DataTable title={t('กลุ่มการแจ้งเตือน', 'Alarm Groups')} columns={columns} data={data} total={total} page={page} limit={limit} loading={loading} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} onCreate={handleCreate} createLabel={t('เพิ่มกลุ่ม', 'Add Group')} />

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? t('แก้ไขกลุ่มการแจ้งเตือน', 'Edit Alarm Group') : t('เพิ่มกลุ่มการแจ้งเตือน', 'Add Alarm Group')} size="md"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>{t('ยกเลิก', 'Cancel')}</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('กำลังบันทึก...', 'Saving...') : editId ? t('อัปเดต', 'Update') : t('สร้าง', 'Create')}</button></div>}
            >
                {formError && <div className="form-error-banner">{formError}</div>}
                <div className="form-group">
                    <label className="form-label">{t('ชื่อกลุ่ม', 'Group Name')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input type="text" className="form-control" placeholder={t('เช่น ทีมซ่อมบำรุง', 'e.g. Maintenance Team')} value={form.groupName} onChange={e => setForm({ ...form, groupName: e.target.value })} autoFocus />
                </div>
                <div className="form-group">
                    <label className="form-label">{t('อีเมล', 'Email')}</label>
                    <input type="email" className="form-control" placeholder="email@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label">{t('Telegram Token', 'Telegram Token')}</label>
                    <input type="text" className="form-control" placeholder={t('โทเคนบอต', 'Bot token')} value={form.telegramToken} onChange={e => setForm({ ...form, telegramToken: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label">{t('Telegram Chat ID', 'Telegram Chat ID')}</label>
                    <input type="text" className="form-control" placeholder={t('ไอดีแชท', 'Chat ID')} value={form.telegramChatId} onChange={e => setForm({ ...form, telegramChatId: e.target.value })} />
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
                    <p style={{ fontSize: 16, marginBottom: 8 }}>{t('ต้องการลบกลุ่มการแจ้งเตือน', 'Delete alarm group')}</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>"{deleteTarget?.group_name}"</p>
                </div>
            </Modal>
        </div>
    );
};

export default AlarmGroupsPage;
