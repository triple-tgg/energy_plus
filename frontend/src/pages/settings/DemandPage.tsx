import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { billingApi } from '../../api/client';
import { useLanguage } from '../../contexts/LanguageContext';

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
    const { t } = useLanguage();
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
        if (!form.displayName.trim()) { setFormError(t('กรุณาระบุชื่อ', 'Please specify a name')); return; }
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
                setSuccessMsg(t('อัปเดตการตั้งค่าดีมานด์สำเร็จ!', 'Updated demand configuration successfully!'));
            } else {
                await billingApi.createDemandConfig(payload);
                setSuccessMsg(t('สร้างการตั้งค่าดีมานด์สำเร็จ!', 'Created demand configuration successfully!'));
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
            await billingApi.deleteDemandConfig(deleteTarget.config_id);
            setSuccessMsg(t('ลบการตั้งค่าดีมานด์สำเร็จ!', 'Deleted demand configuration successfully!'));
            setShowDelete(false); setDeleteTarget(null); fetchData();
        } catch (err: any) { alert(err.response?.data?.message || t('ลบไม่สำเร็จ', 'Delete failed')); }
        setDeleting(false);
    };

    const columns = [
        { key: 'display_name', title: t('ชื่อ', 'Name') },
        {
            key: 'warning_setpoint', title: t('เตือน (kW)', 'Warning (kW)'),
            render: (v: number) => v != null ? `${Number(v).toLocaleString()} kW` : '—',
        },
        {
            key: 'peak_setpoint', title: t('พีค (kW)', 'Peak (kW)'),
            render: (v: number) => v != null ? `${Number(v).toLocaleString()} kW` : '—',
        },
        {
            key: 'saving_rate', title: t('อัตราการประหยัด', 'Saving Rate'),
            render: (v: number) => v != null ? v : '—',
        },
        {
            key: 'flat_rate', title: t('อัตราคงที่', 'Flat Rate'),
            render: (v: number) => v != null ? v : '—',
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
            <DataTable title={t('ตั้งค่าดีมานด์ / การประหยัดพลังงาน', 'Demand / Saving Settings')} columns={columns} data={data} total={total} page={page} limit={limit} loading={loading} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} onCreate={handleCreate} createLabel={t('เพิ่มการตั้งค่าดีมานด์', 'Add Demand Configuration')} />

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? t('แก้ไขการตั้งค่าดีมานด์', 'Edit Demand Configuration') : t('เพิ่มการตั้งค่าดีมานด์', 'Add Demand Configuration')} size="md"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>{t('ยกเลิก', 'Cancel')}</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('กำลังบันทึก...', 'Saving...') : editId ? t('อัปเดต', 'Update') : t('สร้าง', 'Create')}</button></div>}
            >
                {formError && <div className="form-error-banner">{formError}</div>}
                <div className="form-group">
                    <label className="form-label">{t('ชื่อ', 'Name')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input type="text" className="form-control" placeholder={t('เช่น อาคารสำนักงาน', 'e.g. Office Building')} value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} autoFocus />
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">{t('ระดับเตือนภัย (kW)', 'Warning Level (kW)')}</label>
                        <input type="number" className="form-control" placeholder="0" value={form.warningSetpoint} onChange={e => setForm({ ...form, warningSetpoint: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('ระดับพีค (kW)', 'Peak Level (kW)')}</label>
                        <input type="number" className="form-control" placeholder="0" value={form.peakSetpoint} onChange={e => setForm({ ...form, peakSetpoint: e.target.value })} />
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">{t('อัตราการประหยัด', 'Saving Rate')}</label>
                        <input type="number" className="form-control" step="0.01" placeholder="0" value={form.savingRate} onChange={e => setForm({ ...form, savingRate: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('อัตราคงที่', 'Flat Rate')}</label>
                        <input type="number" className="form-control" step="0.01" placeholder="0" value={form.flatRate} onChange={e => setForm({ ...form, flatRate: e.target.value })} />
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">{t('TOU', 'TOU')}</label>
                        <input type="number" className="form-control" step="0.01" placeholder="0" value={form.tou} onChange={e => setForm({ ...form, tou: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('เป้าหมายการประหยัด', 'Saving Target')}</label>
                        <input type="number" className="form-control" step="0.01" placeholder="0" value={form.savingTarget} onChange={e => setForm({ ...form, savingTarget: e.target.value })} />
                    </div>
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
                    <p style={{ fontSize: 16, marginBottom: 8 }}>{t('ต้องการลบการตั้งค่าดีมานด์', 'Delete demand configuration')}</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>"{deleteTarget?.display_name}"</p>
                </div>
            </Modal>
        </div>
    );
};

export default DemandPage;
