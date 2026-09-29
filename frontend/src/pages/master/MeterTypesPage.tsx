import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { metersApi } from '../../api/client';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';

/** Predefined icon options for meter types */
const ICON_OPTIONS = [
    { icon: 'fa fa-bolt', label: 'Power', color: '#F59E0B', emoji: '⚡' },
    { icon: 'fa fa-tint', label: 'Water', color: '#3B82F6', emoji: '💧' },
    { icon: 'fa fa-flask', label: 'Water Quality', color: '#06B6D4', emoji: '🧪' },
    { icon: 'fa fa-wind', label: 'Air Quality', color: '#8B5CF6', emoji: '🌬️' },
    { icon: 'fa fa-seedling', label: 'Soil Quality', color: '#10B981', emoji: '🌱' },
    { icon: 'fa fa-shield-alt', label: 'Power Security', color: '#EF4444', emoji: '🔒' },
    { icon: 'fa fa-fire-extinguisher', label: 'Fire Security', color: '#F97316', emoji: '🔥' },
    { icon: 'fa fa-home', label: 'Room Service', color: '#EC4899', emoji: '🏠' },
    { icon: 'fa fa-plug', label: 'MDB', color: '#8B5CF6', emoji: '🔌' },
    { icon: 'fa fa-fire', label: 'Gas', color: '#EF4444', emoji: '🔥' },
    { icon: 'fa fa-thermometer-half', label: 'Temperature', color: '#F43F5E', emoji: '🌡️' },
    { icon: 'fa fa-smog', label: 'Humidity', color: '#14B8A6', emoji: '🌫️' },
    { icon: 'fa fa-solar-panel', label: 'Solar', color: '#F97316', emoji: '☀️' },
    { icon: 'fa fa-cube', label: 'Other', color: '#6B7280', emoji: '📦' },
];

const getIconInfo = (iconName: string) => {
    const match = ICON_OPTIONS.find(o => o.icon === iconName);
    return match || { color: '#6B7280', label: '', emoji: '📦' };
};

interface TypeForm {
    meterTypeName: string;
    iconName: string;
    isActive: boolean;
}

const emptyForm: TypeForm = { meterTypeName: '', iconName: '', isActive: true };

const MeterTypesPage: React.FC = () => {
    const { t } = useLanguage();
    const { theme } = useTheme();
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<TypeForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const [showDelete, setShowDelete] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await metersApi.getTypes({ page, limit });
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [page, limit]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => {
        if (successMsg) { const timer = setTimeout(() => setSuccessMsg(''), 3000); return () => clearTimeout(timer); }
    }, [successMsg]);

    const handleCreate = () => { setEditId(null); setForm(emptyForm); setFormError(''); setShowModal(true); };

    const handleEdit = (row: any) => {
        setEditId(row.meter_type_id);
        setForm({ meterTypeName: row.meter_type_name || '', iconName: row.icon_name || '', isActive: row.is_active ?? true });
        setFormError('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.meterTypeName.trim()) { setFormError(t('กรุณากรอกชื่อประเภท', 'Type name is required')); return; }
        setSaving(true); setFormError('');
        try {
            if (editId) {
                await metersApi.updateType(editId, form);
                setSuccessMsg(t('อัปเดตประเภทสำเร็จ!', 'Type updated!'));
            } else {
                await metersApi.createType(form);
                setSuccessMsg(t('สร้างประเภทสำเร็จ!', 'Type created!'));
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
            await metersApi.deleteType(deleteTarget.meter_type_id);
            setSuccessMsg(t('ลบประเภทสำเร็จ!', 'Type deleted!'));
            setShowDelete(false); setDeleteTarget(null);
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.message || t('ลบล้มเหลว', 'Failed to delete'));
        }
        setDeleting(false);
    };

    const columns = [
        {
            key: 'icon_name', title: t('ไอคอน', 'Icon'),
            render: (v: string) => {
                if (!v) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>;
                const info = getIconInfo(v);
                return (
                    <span style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: `${info.color}20`, border: `2px solid ${info.color}`,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        color: info.color, fontSize: 14,
                    }}><i className={v} /></span>
                );
            },
        },
        { key: 'meter_type_name', title: t('ชื่อประเภท', 'Type Name') },
        {
            key: 'sub_types', title: t('จำนวน Sub Type', 'Sub Types'),
            render: (v: any[]) => <span className="badge badge-info">{(v || []).length}</span>,
        },
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

            <DataTable
                title={t('ประเภทมิเตอร์', 'Meter Types')}
                columns={columns}
                data={data}
                total={total}
                page={page}
                limit={limit}
                loading={loading}
                onPageChange={setPage}
                onLimitChange={(l) => { setLimit(l); setPage(1); }}
                onCreate={handleCreate}
                createLabel={t('เพิ่มประเภท', 'Add Type')}
            />

            {/* Create/Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editId ? t('แก้ไขประเภทมิเตอร์', 'Edit Meter Type') : t('เพิ่มประเภทมิเตอร์ใหม่', 'Add New Meter Type')}
                size="md"
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
                    <label className="form-label">{t('ชื่อประเภท', 'Type Name')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input type="text" className="form-control" placeholder={t('เช่น Power, Water', 'e.g. Power, Water')}
                        value={form.meterTypeName} onChange={(e) => setForm({ ...form, meterTypeName: e.target.value })} autoFocus />
                </div>

                <div className="form-group">
                    <label className="form-label">{t('เลือกไอคอน', 'Select Icon')}</label>
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, padding: 8, borderRadius: 8,
                        background: theme === 'dark' ? '#1C232E' : '#F1EFE3',
                        border: `1px solid ${theme === 'dark' ? '#2A313C' : '#D4D1C0'}`,
                    }}>
                        {ICON_OPTIONS.map(opt => (
                            <button key={opt.icon} type="button" onClick={() => setForm({ ...form, iconName: opt.icon })} title={opt.label}
                                style={{
                                    width: '100%', aspectRatio: '1', borderRadius: 8,
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                                    cursor: 'pointer', fontSize: 18,
                                    background: form.iconName === opt.icon ? `${opt.color}20` : 'transparent',
                                    border: form.iconName === opt.icon ? `2px solid ${opt.color}` : `1px solid ${theme === 'dark' ? '#2A313C' : '#D4D1C0'}`,
                                }}>
                                <span style={{ color: form.iconName === opt.icon ? opt.color : (theme === 'dark' ? '#E6EDF3' : '#23261E') }}>
                                    <i className={opt.icon} style={{ fontSize: 16 }} />
                                </span>
                                <span style={{ fontSize: 7, fontWeight: 600, color: form.iconName === opt.icon ? opt.color : (theme === 'dark' ? '#8B98A6' : '#6E705F') }}>{opt.label}</span>
                            </button>
                        ))}
                    </div>
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
                    <p style={{ fontSize: 16, marginBottom: 8 }}>{t('ลบประเภทมิเตอร์', 'Delete meter type')}</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>"{deleteTarget?.meter_type_name}"</p>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                        {t('ประเภทย่อยและมิเตอร์ที่ใช้ประเภทนี้จะได้รับผลกระทบ', 'Sub types and meters using this type will be affected.')}
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default MeterTypesPage;
