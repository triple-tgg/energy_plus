import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/ui/StatusBadge';
import { exportApi } from '../../api/client';
import { useLanguage } from '../../contexts/LanguageContext';

interface ExportForm {
    name: string;
    exportPath: string;
    scheduleEvery: string;
    isActive: boolean;
}

const emptyForm: ExportForm = { name: '', exportPath: '', scheduleEvery: '', isActive: true };

const ExportSettingsPage: React.FC = () => {
    const { t, language } = useLanguage();
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
        if (!form.name) { setFormError(t('กรุณาระบุชื่อ', 'Please specify a name')); return; }
        if (!form.exportPath) { setFormError(t('กรุณาระบุเส้นทางการส่งออก', 'Please specify an Export Path')); return; }
        setSaving(true); setFormError('');
        try {
            if (editId) {
                await exportApi.update(editId, form);
                setSuccessMsg(t('อัปเดตสำเร็จ!', 'Updated successfully!'));
            } else {
                await exportApi.create(form);
                setSuccessMsg(t('สร้างสำเร็จ!', 'Created successfully!'));
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
            await exportApi.delete(deleteTarget.id);
            setSuccessMsg(t('ลบสำเร็จ!', 'Deleted successfully!'));
            setShowDelete(false); setDeleteTarget(null); fetchData();
        } catch (err: any) { alert(err.response?.data?.message || t('ลบไม่สำเร็จ', 'Delete failed')); }
        setDeleting(false);
    };

    const columns = [
        { key: 'name', title: t('ชื่อ', 'Name') },
        { key: 'export_path', title: t('เส้นทางการส่งออก', 'ExportPath') },
        { key: 'schedule_every', title: t('เวลาตั้งตารางเวลา', 'ScheduleEvery') },
        {
            key: 'is_active', title: t('สถานะ', 'Status'),
            render: (v: boolean) => <StatusBadge status={v ? 'active' : 'inactive'} />,
        },
        { key: 'created_by', title: t('สร้างโดย', 'Created By') },
        {
            key: 'created_at', title: t('สร้างเมื่อ', 'Created At'),
            render: (v: string) => v ? new Date(v).toLocaleString(language === 'th' ? 'th-TH' : 'en-US') : '—',
        },
        { key: 'updated_by', title: t('อัปเดตโดย', 'Updated By') },
        {
            key: 'updated_at', title: t('อัปเดตเมื่อ', 'Updated At'),
            render: (v: string) => v ? new Date(v).toLocaleString(language === 'th' ? 'th-TH' : 'en-US') : '—',
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
            <DataTable title={t('ตั้งค่าการส่งออกข้อมูล', 'Export Settings')} columns={columns} data={data} total={total} page={page} limit={limit} loading={loading} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} onCreate={handleCreate} createLabel={t('สร้างรายการส่งออกใหม่', 'Create New Export')} />

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? t('แก้ไขรายการส่งออก', 'Edit Export') : t('สร้างรายการส่งออกใหม่', 'Create New Export')} size="md"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>{t('ยกเลิก', 'Cancel')}</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('กำลังบันทึก...', 'Saving...') : editId ? t('อัปเดต', 'Update') : t('สร้าง', 'Create')}</button></div>}
            >
                {formError && <div className="form-error-banner">{formError}</div>}
                <div className="form-group">
                    <label className="form-label">{t('ชื่อ', 'Name')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input type="text" className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('เช่น ส่งออกอัตโนมัติ', 'e.g. AutoExport')} />
                </div>
                <div className="form-group">
                    <label className="form-label">{t('เส้นทางการส่งออก', 'Export Path')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input type="text" className="form-control" value={form.exportPath} onChange={e => setForm({ ...form, exportPath: e.target.value })} placeholder={t('เช่น D:\\EnergyExports', 'e.g. D:\\EnergyExports')} />
                </div>
                <div className="form-group">
                    <label className="form-label">{t('เวลาตั้งตารางเวลา', 'Schedule Every')}</label>
                    <input type="datetime-local" className="form-control" value={form.scheduleEvery} onChange={e => setForm({ ...form, scheduleEvery: e.target.value })} />
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
                    <p>{t('ต้องการลบการตั้งค่าการส่งออก', 'Delete export configuration')} <strong style={{ color: 'var(--danger)' }}>{deleteTarget?.name}</strong>?</p>
                </div>
            </Modal>
        </div>
    );
};

export default ExportSettingsPage;
