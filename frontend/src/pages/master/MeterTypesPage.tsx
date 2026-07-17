import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { metersApi } from '../../api/client';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';

interface TypeForm {
    meterTypeName: string;
    iconName: string;
    isActive: boolean;
}

const emptyForm: TypeForm = { meterTypeName: '', iconName: '', isActive: true };

/** Predefined icon options for meter types (Font Awesome class names) */
const ICON_OPTIONS = [
    { icon: 'fa fa-bolt', label: 'Power', color: '#F59E0B', emoji: '⚡' },
    { icon: 'fa fa-tint', label: 'Water', color: '#3B82F6', emoji: '💧' },
    { icon: 'fa fa-fire', label: 'Gas', color: '#EF4444', emoji: '🔥' },
    { icon: 'fa fa-plug', label: 'MDB', color: '#8B5CF6', emoji: '🔌' },
    { icon: 'fa fa-satellite-dish', label: 'Sensor', color: '#06B6D4', emoji: '📡' },
    { icon: 'fa fa-car-battery', label: 'Generator', color: '#10B981', emoji: '🔋' },
    { icon: 'fa fa-solar-panel', label: 'Solar', color: '#F97316', emoji: '☀️' },
    { icon: 'fa fa-snowflake', label: 'HVAC', color: '#0EA5E9', emoji: '❄️' },
    { icon: 'fa fa-industry', label: 'Industrial', color: '#6366F1', emoji: '🏭' },
    { icon: 'fa fa-building', label: 'Building', color: '#64748B', emoji: '🏢' },
    { icon: 'fa fa-chart-bar', label: 'Analytics', color: '#14B8A6', emoji: '📊' },
    { icon: 'fa fa-exclamation-triangle', label: 'Alert', color: '#EAB308', emoji: '⚠️' },
];

/** Get color for a given icon class */
const getIconInfo = (iconName: string): { color: string; label: string } => {
    const match = ICON_OPTIONS.find(o => o.icon === iconName);
    return match ? { color: match.color, label: match.label } : { color: '#6B7280', label: '' };
};

/** Check if value is a Font Awesome class */
const isFaIcon = (v: string) => v && (v.startsWith('fa ') || v.startsWith('fa-') || v.startsWith('fas '));

/** Render icon — supports FA class names and emoji */
const renderIconElement = (v: string, size: number = 20) => {
    if (isFaIcon(v)) {
        return <i className={v} style={{ fontSize: size }} />;
    }
    return <span style={{ fontSize: size, lineHeight: 1 }}>{v}</span>;
};

const MeterTypesPage: React.FC = () => {
    const { t } = useLanguage();
    const { theme } = useTheme();
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(true);

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<TypeForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    // Delete
    const [showDelete, setShowDelete] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);

    // Toast
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
        if (successMsg) {
            const timer = setTimeout(() => setSuccessMsg(''), 3000);
            return () => clearTimeout(timer);
        }
    }, [successMsg]);

    const handleCreate = () => {
        setEditId(null);
        setForm(emptyForm);
        setFormError('');
        setShowModal(true);
    };

    const handleEdit = (row: any) => {
        setEditId(row.meter_type_id);
        setForm({
            meterTypeName: row.meter_type_name || '',
            iconName: row.icon_name || '',
            isActive: row.is_active ?? true,
        });
        setFormError('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.meterTypeName.trim()) {
            setFormError(t('กรุณากรอกชื่อประเภทมิเตอร์', 'Meter Type Name is required'));
            return;
        }
        setSaving(true);
        setFormError('');
        try {
            if (editId) {
                await metersApi.updateType(editId, form);
                setSuccessMsg(t('อัปเดตประเภทมิเตอร์สำเร็จ!', 'Meter type updated successfully!'));
            } else {
                await metersApi.createType(form);
                setSuccessMsg(t('สร้างประเภทมิเตอร์สำเร็จ!', 'Meter type created successfully!'));
            }
            setShowModal(false);
            fetchData();
        } catch (err: any) {
            setFormError(err.response?.data?.message || t('บันทึกประเภทมิเตอร์ล้มเหลว', 'Failed to save meter type'));
        }
        setSaving(false);
    };

    const handleDeleteClick = (row: any) => {
        setDeleteTarget(row);
        setShowDelete(true);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await metersApi.deleteType(deleteTarget.meter_type_id);
            setSuccessMsg(t('ลบประเภทมิเตอร์สำเร็จ!', 'Meter type deleted successfully!'));
            setShowDelete(false);
            setDeleteTarget(null);
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.message || t('ลบประเภทมิเตอร์ล้มเหลว', 'Failed to delete meter type'));
        }
        setDeleting(false);
    };

    const columns = [
        { key: 'meter_type_name', title: t('ชื่อประเภท', 'Type Name') },
        {
            key: 'icon_name', title: t('ไอคอน', 'Icon'),
            render: (v: string) => {
                if (!v) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>;
                const info = getIconInfo(v);
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: `${info.color}20`,
                            border: `2px solid ${info.color}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: info.color,
                        }}>{renderIconElement(v, 18)}</span>
                        {info.label && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{info.label}</span>}
                    </div>
                );
            },
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
                    <input
                        type="text"
                        className="form-control"
                        placeholder={t('เช่น ไฟฟ้า, น้ำ, แก๊ส', 'e.g. Electricity, Water, Gas')}
                        value={form.meterTypeName}
                        onChange={(e) => setForm({ ...form, meterTypeName: e.target.value })}
                        autoFocus
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">{t('เลือกไอคอน', 'Select Icon')}</label>
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)',
                        gap: 8, padding: 8, borderRadius: 8,
                        background: theme === 'dark' ? '#1C232E' : '#F1EFE3',
                        border: `1px solid ${theme === 'dark' ? '#2A313C' : '#D4D1C0'}`,
                    }}>
                        {ICON_OPTIONS.map(opt => (
                            <button
                                key={opt.icon}
                                type="button"
                                onClick={() => setForm({ ...form, iconName: opt.icon })}
                                title={opt.label}
                                style={{
                                    width: '100%', aspectRatio: '1', borderRadius: 8,
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center', gap: 2,
                                    cursor: 'pointer', transition: 'all 0.15s',
                                    fontSize: 22,
                                    background: form.iconName === opt.icon ? `${opt.color}20` : 'transparent',
                                    border: form.iconName === opt.icon ? `2px solid ${opt.color}` : `1px solid ${theme === 'dark' ? '#2A313C' : '#D4D1C0'}`,
                                    boxShadow: form.iconName === opt.icon ? `0 0 8px ${opt.color}40` : 'none',
                                }}
                            >
                                <span style={{ color: form.iconName === opt.icon ? opt.color : (theme === 'dark' ? '#E6EDF3' : '#23261E') }}>
                                    <i className={opt.icon} style={{ fontSize: 20 }} />
                                </span>
                                <span style={{ fontSize: 8, fontWeight: 600, color: form.iconName === opt.icon ? opt.color : (theme === 'dark' ? '#8B98A6' : '#6E705F'), textTransform: 'uppercase', letterSpacing: '0.5px' }}>{opt.label}</span>
                            </button>
                        ))}
                    </div>
                    {form.iconName && (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                            <span style={{
                                width: 32, height: 32, borderRadius: '50%',
                                background: `${getIconInfo(form.iconName).color}20`,
                                border: `2px solid ${getIconInfo(form.iconName).color}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: getIconInfo(form.iconName).color,
                            }}>{renderIconElement(form.iconName, 16)}</span>
                            <span style={{ color: theme === 'dark' ? '#8B98A6' : '#6E705F', fontSize: 11 }}>
                                {t('ไอคอนที่เลือก:', 'Selected icon:')} {form.iconName}
                            </span>
                            <button
                                type="button"
                                onClick={() => setForm({ ...form, iconName: '' })}
                                style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 12 }}
                            >✕ {t('ล้าง', 'Clear')}</button>
                        </div>
                    )}
                </div>

                <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                            type="checkbox"
                            checked={form.isActive}
                            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                            style={{ width: 18, height: 18, accentColor: 'var(--success)' }}
                        />
                        {t('ใช้งาน', 'Active')}
                    </label>
                </div>
            </Modal>

            <Modal
                isOpen={showDelete}
                onClose={() => setShowDelete(false)}
                title={t('ยืนยันการลบ', 'Confirm Delete')}
                size="sm"
                footer={
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline" onClick={() => setShowDelete(false)} disabled={deleting}>{t('ยกเลิก', 'Cancel')}</button>
                        <button className="btn btn-danger" onClick={handleDeleteConfirm} disabled={deleting}>
                            {deleting ? t('กำลังลบ...', 'Deleting...') : t('ลบ', 'Delete')}
                        </button>
                    </div>
                }
            >
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                    <p style={{ fontSize: 16, marginBottom: 8 }}>{t('ลบประเภทมิเตอร์', 'Delete meter type')}</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>
                        "{deleteTarget?.meter_type_name}"
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                        {t('มิเตอร์ที่ใช้ประเภทนี้อาจได้รับผลกระทบ', 'Meters using this type may be affected.')}
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default MeterTypesPage;
