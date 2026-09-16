import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { metersApi } from '../../api/client';
import { useLanguage } from '../../contexts/LanguageContext';

interface SubTypeForm {
    meterTypeId: string;
    subTypeName: string;
    isActive: boolean;
}

const emptyForm: SubTypeForm = { meterTypeId: '', subTypeName: '', isActive: true };

const MeterSubTypesPage: React.FC = () => {
    const { t } = useLanguage();
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [loading, setLoading] = useState(true);

    // Types for dropdown
    const [types, setTypes] = useState<any[]>([]);
    const [filterTypeId, setFilterTypeId] = useState('');

    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<SubTypeForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const [showDelete, setShowDelete] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    // Load types once
    useEffect(() => {
        (async () => {
            try {
                const res = await metersApi.getTypes({ limit: 100 });
                setTypes(res.data.data || []);
            } catch (err) { console.error(err); }
        })();
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = { page, limit };
            if (filterTypeId) params.meterTypeId = filterTypeId;
            const res = await metersApi.getSubTypes(params);
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [page, limit, filterTypeId]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => {
        if (successMsg) { const timer = setTimeout(() => setSuccessMsg(''), 3000); return () => clearTimeout(timer); }
    }, [successMsg]);

    const handleCreate = () => { setEditId(null); setForm(emptyForm); setFormError(''); setShowModal(true); };

    const handleEdit = (row: any) => {
        setEditId(row.meter_sub_type_id);
        setForm({
            meterTypeId: row.meter_type_id?.toString() || '',
            subTypeName: row.sub_type_name || '',
            isActive: row.is_active ?? true,
        });
        setFormError('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.subTypeName.trim()) { setFormError(t('กรุณากรอกชื่อ Sub Type', 'Sub Type name is required')); return; }
        if (!form.meterTypeId) { setFormError(t('กรุณาเลือกประเภทหลัก', 'Please select a parent type')); return; }
        setSaving(true); setFormError('');
        try {
            const payload = { ...form, meterTypeId: parseInt(form.meterTypeId) };
            if (editId) {
                await metersApi.updateSubType(editId, payload);
                setSuccessMsg(t('อัปเดต Sub Type สำเร็จ!', 'Sub type updated!'));
            } else {
                await metersApi.createSubType(payload);
                setSuccessMsg(t('สร้าง Sub Type สำเร็จ!', 'Sub type created!'));
            }
            setShowModal(false);
            fetchData();
        } catch (err: any) {
            setFormError(err.response?.data?.message || t('บันทึกล้มเหลว', 'Failed to save'));
        }
        setSaving(false);
    };

    const handleDeleteClick = (row: any) => { setDeleteTarget(row); setShowDelete(true); };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await metersApi.deleteSubType(deleteTarget.meter_sub_type_id);
            setSuccessMsg(t('ลบ Sub Type สำเร็จ!', 'Sub type deleted!'));
            setShowDelete(false); setDeleteTarget(null);
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.message || t('ลบล้มเหลว', 'Failed to delete'));
        }
        setDeleting(false);
    };

    const columns = [
        { key: 'meter_sub_type_id', title: 'ID' },
        {
            key: 'meter_type_name', title: t('ประเภทหลัก', 'Parent Type'),
            render: (v: string) => v ? <span className="badge badge-info">{v}</span> : '—',
        },
        { key: 'sub_type_name', title: t('ชื่อ Sub Type', 'Sub Type Name') },
        {
            key: 'is_active', title: t('สถานะ', 'Status'),
            render: (v: boolean) => (
                <span className={`badge ${v ? 'badge-success' : 'badge-danger'}`}>
                    {v ? t('ใช้งาน', 'Active') : t('ไม่ใช้งาน', 'Inactive')}
                </span>
            ),
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

            {/* Filter by type */}
            <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {t('กรองตามประเภทหลัก:', 'Filter by Type:')}
                </label>
                <select className="form-control" style={{ maxWidth: 220 }}
                    value={filterTypeId} onChange={e => { setFilterTypeId(e.target.value); setPage(1); }}>
                    <option value="">{t('ทั้งหมด', 'All')}</option>
                    {types.map(t => <option key={t.meter_type_id} value={t.meter_type_id}>{t.meter_type_name}</option>)}
                </select>
            </div>

            <DataTable
                title={t('ประเภทย่อยมิเตอร์', 'Meter Sub Types')}
                columns={columns}
                data={data}
                total={total}
                page={page}
                limit={limit}
                loading={loading}
                onPageChange={setPage}
                onLimitChange={(l) => { setLimit(l); setPage(1); }}
                onCreate={handleCreate}
                createLabel={t('เพิ่ม Sub Type', 'Add Sub Type')}
            />

            {/* Create/Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editId ? t('แก้ไข Sub Type', 'Edit Sub Type') : t('เพิ่ม Sub Type ใหม่', 'Add New Sub Type')}
                size="sm"
                footer={
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>{t('ยกเลิก', 'Cancel')}</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? t('กำลังบันทึก...', 'Saving...') : editId ? t('อัปเดต', 'Update') : t('สร้าง', 'Create')}
                        </button>
                    </div>
                }
            >
                {formError && <div className="form-error-banner">{formError}</div>}

                <div className="form-group">
                    <label className="form-label">{t('ประเภทหลัก', 'Parent Type')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <select className="form-control" value={form.meterTypeId} onChange={e => setForm({ ...form, meterTypeId: e.target.value })}>
                        <option value="">— {t('เลือก', 'Select')} —</option>
                        {types.map(t => <option key={t.meter_type_id} value={t.meter_type_id}>{t.meter_type_name}</option>)}
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">{t('ชื่อ Sub Type', 'Sub Type Name')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input type="text" className="form-control" placeholder={t('เช่น ELE, MDB, CHILLER', 'e.g. ELE, MDB, CHILLER')}
                        value={form.subTypeName} onChange={(e) => setForm({ ...form, subTypeName: e.target.value })} autoFocus />
                </div>

                <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                            style={{ width: 18, height: 18, accentColor: 'var(--success)' }} />
                        {t('ใช้งาน', 'Active')}
                    </label>
                </div>
            </Modal>

            {/* Delete Modal */}
            <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title={t('ยืนยันการลบ', 'Confirm Delete')} size="sm"
                footer={
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline" onClick={() => setShowDelete(false)} disabled={deleting}>{t('ยกเลิก', 'Cancel')}</button>
                        <button className="btn btn-danger" onClick={handleDeleteConfirm} disabled={deleting}>
                            {deleting ? t('กำลังลบ...', 'Deleting...') : t('ลบ', 'Delete')}
                        </button>
                    </div>
                }>
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                    <p style={{ fontSize: 16, marginBottom: 8 }}>{t('ลบ Sub Type', 'Delete sub type')}</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>"{deleteTarget?.sub_type_name}"</p>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                        {t('มิเตอร์ที่ใช้ Sub Type นี้จะได้รับผลกระทบ', 'Meters using this sub type will be affected.')}
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default MeterSubTypesPage;
