import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/ui/StatusBadge';
import { layoutsApi, metersApi } from '../../api/client';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';

/* ═══════════════════════════════════════════════════════════════
   Types & Constants
   ═══════════════════════════════════════════════════════════════ */
interface LayoutForm {
    name: string;
    imageName: string;
    position: string;
    imageFile: File | null;
}

interface LayoutPoint {
    id?: number;
    layout_id?: number;
    point_type: string;
    label: string;
    x_percent: number;
    y_percent: number;
    meter_id: number | null;
    meter_name?: string;
    meter_code?: string;
    config?: any;
}

const emptyForm: LayoutForm = { name: '', imageName: '', position: '', imageFile: null };

const POINT_TYPES = [
    { key: 'meter', labelTh: 'มิเตอร์', labelEn: 'Meter', icon: '⚡', color: '#F59E0B' },
    { key: 'sensor', labelTh: 'เซนเซอร์', labelEn: 'Sensor', icon: '📡', color: '#3B82F6' },
    { key: 'gen', labelTh: 'เครื่องกำเนิดไฟฟ้า', labelEn: 'Generator', icon: '🔋', color: '#10B981' },
    { key: 'ups', labelTh: 'เครื่องสำรองไฟ (UPS)', labelEn: 'UPS', icon: '🔌', color: '#EF4444' },
];

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, "Cascadia Mono", monospace';

const THEMES = {
    light: {
        bg: '#EAE7DA', panel: '#FBFAF4', panel2: '#F1EFE3', ink: '#23261E', sub: '#6E705F',
        line: '#D4D1C0', bar: '#23261E', accent: '#2B4C7E',
    },
    dark: {
        bg: '#0E1116', panel: '#161B22', panel2: '#1C232E', ink: '#E6EDF3', sub: '#8B98A6',
        line: '#2A313C', bar: '#080A0E', accent: '#36C2CE',
    },
};

/** Parse DECIMAL strings from PostgreSQL to numbers */
const parsePoint = (pt: any): LayoutPoint => ({
    ...pt,
    x_percent: parseFloat(pt.x_percent) || 0,
    y_percent: parseFloat(pt.y_percent) || 0,
    meter_id: pt.meter_id ? parseInt(pt.meter_id, 10) : null,
});

/* ═══════════════════════════════════════════════════════════════
   LayoutSettingsPage
   ═══════════════════════════════════════════════════════════════ */
const LayoutSettingsPage: React.FC = () => {
    const { theme } = useTheme();
    const { t } = useLanguage();
    const C = THEMES[theme];

    // --- Layout CRUD state ---
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
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // --- Point Editor state ---
    const [editorOpen, setEditorOpen] = useState(false);
    const [editorLayout, setEditorLayout] = useState<any>(null);
    const [points, setPoints] = useState<LayoutPoint[]>([]);
    const [activeType, setActiveType] = useState('meter');
    const [pointSaving, setPointSaving] = useState(false);
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [editingPoint, setEditingPoint] = useState<number | null>(null);
    const [meters, setMeters] = useState<any[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    /* ───────────────────────────────────────
       Data Fetching
       ─────────────────────────────────────── */
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

    /* ───────────────────────────────────────
       Layout CRUD Handlers
       ─────────────────────────────────────── */
    const handleCreate = () => { setEditId(null); setForm(emptyForm); setFormError(''); setShowModal(true); };

    const handleEdit = (row: any) => {
        setEditId(row.id);
        setForm({ name: row.name || '', imageName: row.image_name || '', position: row.position || '', imageFile: null });
        setFormError('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.name) { setFormError(t('กรุณาระบุชื่อ', 'Please specify a name')); return; }
        setSaving(true); setFormError('');
        try {
            const formData = new FormData();
            formData.append('name', form.name);
            formData.append('position', form.position);
            if (form.imageFile) formData.append('image', form.imageFile);
            if (editId) {
                await layoutsApi.update(editId, formData);
                setSuccessMsg(t('อัปเดตสำเร็จ!', 'Updated successfully!'));
            } else {
                await layoutsApi.create(formData);
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
            await layoutsApi.delete(deleteTarget.id);
            setSuccessMsg(t('ลบสำเร็จ!', 'Deleted successfully!'));
            setShowDelete(false); setDeleteTarget(null); fetchData();
        } catch (err: any) { alert(err.response?.data?.message || t('ลบไม่สำเร็จ', 'Delete failed')); }
        setDeleting(false);
    };

    /* ───────────────────────────────────────
       Point Editor Handlers
       ─────────────────────────────────────── */
    const openEditor = async (row: any) => {
        setEditorLayout(row);
        setEditorOpen(true);
        setEditingPoint(null);
        setDragIdx(null);
        try {
            const [ptRes, mRes] = await Promise.all([
                layoutsApi.getPoints(row.id),
                metersApi.getAll({ limit: 500 }),
            ]);
            const raw = ptRes.data.data || [];
            setPoints(raw.map(parsePoint));
            setMeters(mRes.data.data || []);
        } catch (err) {
            console.error(err);
            setPoints([]);
            setMeters([]);
        }
    };

    const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (dragIdx !== null) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        const typeInfo = POINT_TYPES.find(t => t.key === activeType)!;
        const newPoint: LayoutPoint = {
            point_type: activeType,
            label: `${t(typeInfo.labelTh, typeInfo.labelEn)} ${points.length + 1}`,
            x_percent: Math.round(x * 100) / 100,
            y_percent: Math.round(y * 100) / 100,
            meter_id: null,
        };
        setPoints(prev => [...prev, newPoint]);
    };

    const handlePointDragStart = (idx: number, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setDragIdx(idx);
        const container = containerRef.current;
        if (!container) return;
        const onMove = (ev: MouseEvent) => {
            const rect = container.getBoundingClientRect();
            const x = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
            const y = Math.max(0, Math.min(100, ((ev.clientY - rect.top) / rect.height) * 100));
            setPoints(prev => prev.map((p, i) => i === idx ? { ...p, x_percent: Math.round(x * 100) / 100, y_percent: Math.round(y * 100) / 100 } : p));
        };
        const onUp = () => {
            setDragIdx(null);
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    const handlePointDelete = (idx: number) => {
        setPoints(prev => prev.filter((_, i) => i !== idx));
        setEditingPoint(null);
    };

    const handlePointUpdate = (idx: number, updates: Partial<LayoutPoint>) => {
        setPoints(prev => prev.map((p, i) => i === idx ? { ...p, ...updates } : p));
    };

    const handleSavePoints = async () => {
        if (!editorLayout) return;
        setPointSaving(true);
        try {
            await layoutsApi.savePoints(editorLayout.id, points.map(p => ({
                point_type: p.point_type,
                label: p.label,
                x_percent: p.x_percent,
                y_percent: p.y_percent,
                meter_id: p.meter_id,
                config: p.config || {},
            })));
            setSuccessMsg(t('บันทึกจุดสำเร็จ!', 'Points saved successfully!'));
            const ptRes = await layoutsApi.getPoints(editorLayout.id);
            setPoints((ptRes.data.data || []).map(parsePoint));
        } catch (err: any) {
            alert(err.response?.data?.message || t('บันทึกจุดไม่สำเร็จ', 'Save points failed'));
        }
        setPointSaving(false);
    };

    /* ───────────────────────────────────────
       Table Columns (memoized to avoid re-render loops with base64 images)
       ─────────────────────────────────────── */
    const columns = useMemo(() => [
        { key: 'name', title: t('ชื่อแผนผัง', 'Name') },
        { key: 'image_name', title: t('ชื่อไฟล์รูปภาพ', 'Image Name') },
        {
            key: 'image_url', title: t('รูปภาพ', 'Image'),
            render: (v: string) => v ? (
                <img src={v} alt="layout" style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setPreviewImage(v)} />
            ) : <span style={{ color: 'var(--text-muted)' }}>—</span>,
        },
        {
            key: 'point_labels', title: t('จุดบนแผนผัง', 'Plan Points'),
            render: (v: any) => {
                const pts = Array.isArray(v) ? v : [];
                if (pts.length === 0) return <span style={{ color: 'var(--text-muted)', fontFamily: MONO, fontSize: 11 }}>— {t('ไม่มีจุด', 'No points')} —</span>;
                return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {pts.map((p: any, i: number) => {
                            const typeInfo = POINT_TYPES.find(t => t.key === p.point_type) || POINT_TYPES[0];
                            return (
                                <span key={i} style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 3,
                                    padding: '2px 8px', borderRadius: 4, fontSize: 10, fontFamily: MONO, fontWeight: 600,
                                    background: typeInfo.color + '20', color: typeInfo.color,
                                    border: `1px solid ${typeInfo.color}40`,
                                }}>{typeInfo.icon} {p.label}</span>
                            );
                        })}
                    </div>
                );
            },
        },
        {
            key: 'actions', title: t('การจัดการ', 'Actions'),
            render: (_: any, row: any) => (
                <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm" style={{ background: '#2B4C7E', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontFamily: MONO, fontSize: 11, letterSpacing: '0.5px' }} onClick={() => openEditor(row)} title={t('จัดการจุดบนแผนผัง', 'Manage points on plan')}>{t('📌 จุดแผนผัง', '📌 Points')}</button>
                    <button className="btn btn-primary btn-sm" onClick={() => handleEdit(row)}>{t('✏️ แก้ไข', '✏️ Edit')}</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteClick(row)}>{t('🗑️ ลบ', '🗑️ Delete')}</button>
                </div>
            ),
        },
    ], [t]); // eslint-disable-line react-hooks/exhaustive-deps

    /* ═══════════════════════════════════════════════════════
       Render
       ═══════════════════════════════════════════════════════ */
    return (
        <div>
            {successMsg && <div className="toast-success">✅ {successMsg}</div>}
            <DataTable title={t('ตั้งค่าแผนผังตำแหน่งมิเตอร์', 'Location Map Layout Settings')} columns={columns} data={data} total={total} page={page} limit={limit} loading={loading} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} onCreate={handleCreate} createLabel={t('สร้างแผนผังใหม่', 'Create New Layout')} />

            {/* Create/Edit Layout Modal */}
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? t('แก้ไขแผนผัง', 'Edit Layout') : t('สร้างแผนผังใหม่', 'Create New Layout')} size="md"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>{t('ยกเลิก', 'Cancel')}</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('กำลังบันทึก...', 'Saving...') : editId ? t('อัปเดต', 'Update') : t('สร้าง', 'Create')}</button></div>}
            >
                {formError && <div className="form-error-banner">{formError}</div>}
                <div className="form-group">
                    <label className="form-label">{t('ชื่อแผนผัง', 'Name')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input type="text" className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('เช่น 111PMT_อาคาร_A', 'e.g. 111PMT_Building_A')} />
                </div>
                <div className="form-group">
                    <label className="form-label">{t('คำอธิบาย', 'Description')}</label>
                    <input type="text" className="form-control" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} placeholder={t('เช่น แผนผังระบบไฟฟ้าอาคาร A', 'e.g. Building A Electrical Diagram')} />
                </div>
                <div className="form-group">
                    <label className="form-label">{t('รูปภาพแผนผัง', 'Layout Image')}</label>
                    <input type="file" className="form-control" accept="image/*" onChange={e => {
                        const file = e.target.files?.[0] || null;
                        setForm({ ...form, imageFile: file, imageName: file?.name || form.imageName });
                    }} />
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title={t('ยืนยันการลบ', 'Confirm Delete')} size="sm"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowDelete(false)} disabled={deleting}>{t('ยกเลิก', 'Cancel')}</button><button className="btn btn-danger" onClick={handleDeleteConfirm} disabled={deleting}>{deleting ? t('กำลังลบ...', 'Deleting...') : t('ลบ', 'Delete')}</button></div>}
            >
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                    <p>{t('ต้องการลบแผนผัง', 'Delete layout')} <strong style={{ color: 'var(--danger)' }}>{deleteTarget?.name}</strong>?</p>
                </div>
            </Modal>

            {/* Image Preview Modal */}
            <Modal isOpen={!!previewImage} onClose={() => setPreviewImage(null)} title={t('แสดงรูปภาพแผนผัง', 'View Layout Image')} size="xl"
                footer={<div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-primary" onClick={() => setPreviewImage(null)}>{t('ปิด', 'Close')}</button></div>}
            >
                {previewImage && (
                    <div style={{ textAlign: 'center', padding: '8px 0' }}>
                        <img src={previewImage} alt="layout preview" style={{ width: '100%', maxHeight: '75vh', objectFit: 'contain', border: '1px solid var(--border)' }} />
                    </div>
                )}
            </Modal>

            {/* ═══════════════════════════════════════════════════════
                Point Editor (Full-screen overlay)
                ═══════════════════════════════════════════════════════ */}
            {editorOpen && editorLayout && (
                <div className="layout-editor-overlay">
                    {/* Header */}
                    <div style={{
                        background: C.bar, color: '#fff', padding: '10px 20px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        borderBottom: `2px solid ${C.accent}`,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                                {t('📌 ตัวแก้ไขแผนผัง —', '📌 Layout Editor —')} {editorLayout.name}
                            </span>
                            <span style={{ fontFamily: MONO, fontSize: 11, color: C.sub }}>
                                {points.length} {t('จุด', 'points')}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <button onClick={handleSavePoints} disabled={pointSaving}
                                style={{ background: '#10B981', color: '#fff', border: 'none', padding: '6px 18px', borderRadius: 4, cursor: 'pointer', fontFamily: MONO, fontSize: 12, fontWeight: 700, opacity: pointSaving ? 0.6 : 1 }}>
                                {pointSaving ? t('⏳ กำลังบันทึก...', '⏳ Saving...') : t('💾 บันทึกจุด', '💾 Save Points')}
                            </button>
                            <button onClick={() => { setEditorOpen(false); setEditorLayout(null); setEditingPoint(null); }}
                                style={{ background: 'transparent', border: `1px solid ${C.sub}`, color: '#fff', padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontFamily: MONO, fontSize: 12 }}>
                                {t('✕ ปิด', '✕ Close')}
                            </button>
                        </div>
                    </div>

                    {/* Toolbar */}
                    <div style={{
                        background: C.panel2, padding: '8px 20px',
                        display: 'flex', alignItems: 'center', gap: 8,
                        borderBottom: `1px solid ${C.line}`,
                    }}>
                        <span style={{ fontFamily: MONO, fontSize: 11, color: C.sub, marginRight: 8 }}>{t('เลือกประเภท:', 'Select Type:')}</span>
                        {POINT_TYPES.map(pt => (
                            <button key={pt.key} onClick={() => setActiveType(pt.key)}
                                style={{
                                    padding: '5px 14px', borderRadius: 4, cursor: 'pointer',
                                    fontFamily: MONO, fontSize: 12, fontWeight: 600,
                                    background: activeType === pt.key ? pt.color : 'transparent',
                                    color: activeType === pt.key ? '#fff' : C.ink,
                                    border: `1.5px solid ${activeType === pt.key ? pt.color : C.line}`,
                                    transition: 'all 0.15s ease',
                                }}>
                                {pt.icon} {t(pt.labelTh, pt.labelEn)}
                            </button>
                        ))}
                        <div style={{ flex: 1 }} />
                        <span style={{ fontFamily: MONO, fontSize: 10, color: C.sub }}>
                            {t('คลิกบนรูปภาพเพื่อวางจุด • ลากเพื่อย้าย • คลิกที่จุดเพื่อแก้ไข', 'Click on image to place point • Drag to move • Click point to edit')}
                        </span>
                    </div>

                    {/* Main Area */}
                    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                        {/* Canvas */}
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'auto', background: C.bg }}>
                            <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', maxHeight: '100%', cursor: 'crosshair' }} onClick={handleImageClick}>
                                <img src={editorLayout.image_url} alt={editorLayout.name}
                                    style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 160px)', objectFit: 'contain', display: 'block', border: `2px solid ${C.line}`, userSelect: 'none', pointerEvents: 'none' }}
                                    draggable={false} />
                                {/* Points */}
                                {points.map((pt, idx) => {
                                    const typeInfo = POINT_TYPES.find(t => t.key === pt.point_type) || POINT_TYPES[0];
                                    const isSelected = editingPoint === idx;
                                    return (
                                        <div key={idx}
                                            style={{
                                                position: 'absolute', left: `${pt.x_percent}%`, top: `${pt.y_percent}%`,
                                                transform: 'translate(-50%, -50%)', zIndex: isSelected ? 20 : 10,
                                                cursor: dragIdx === idx ? 'grabbing' : 'grab',
                                            }}
                                            onClick={(e) => { e.stopPropagation(); setEditingPoint(isSelected ? null : idx); }}
                                            onMouseDown={(e) => handlePointDragStart(idx, e)}>
                                            <div style={{
                                                width: 32, height: 32, borderRadius: '50%', background: typeInfo.color,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 16, lineHeight: 1,
                                                border: isSelected ? '3px solid #fff' : `2px solid ${theme === 'dark' ? '#000' : '#fff'}`,
                                                boxShadow: isSelected ? `0 0 0 3px ${typeInfo.color}, 0 2px 8px rgba(0,0,0,0.4)` : '0 2px 6px rgba(0,0,0,0.3)',
                                                transition: 'box-shadow 0.15s, border 0.15s', userSelect: 'none',
                                            }}>{typeInfo.icon}</div>
                                            <div style={{
                                                position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 2,
                                                whiteSpace: 'nowrap', fontFamily: MONO, fontSize: 9, fontWeight: 700,
                                                color: '#fff', background: 'rgba(0,0,0,0.7)', padding: '1px 5px', borderRadius: 3,
                                            }}>{pt.label}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Sidebar */}
                        <div style={{ width: 300, background: C.panel, borderLeft: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <div style={{
                                padding: '10px 14px', background: C.panel2, borderBottom: `1px solid ${C.line}`,
                                fontFamily: MONO, fontSize: 12, fontWeight: 700, color: C.ink, textTransform: 'uppercase', letterSpacing: '1px',
                            }}>
                                {editingPoint !== null ? t('✏️ แก้ไขจุด', '✏️ Edit Point') : t('📋 รายการจุดทั้งหมด', '📋 Points List')}
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                                {editingPoint !== null && points[editingPoint] ? (
                                    <PointEditor
                                        point={points[editingPoint]} meters={meters} theme={theme} C={C} t={t}
                                        onChange={(updates) => handlePointUpdate(editingPoint, updates)}
                                        onDelete={() => handlePointDelete(editingPoint)}
                                        onClose={() => setEditingPoint(null)}
                                    />
                                ) : points.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px 12px', color: C.sub, fontFamily: MONO, fontSize: 11 }}>
                                        <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📌</div>
                                        <div>{t('ไม่มีจุด', 'No points')}</div>
                                        <div style={{ marginTop: 4 }}>{t('คลิกบนรูปภาพเพื่อเพิ่มจุดใหม่', 'Click on the image to place a new point')}</div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {points.map((pt, idx) => {
                                            const typeInfo = POINT_TYPES.find(t => t.key === pt.point_type) || POINT_TYPES[0];
                                            return (
                                                <div key={idx} onClick={() => setEditingPoint(idx)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 8,
                                                        padding: '8px 10px', borderRadius: 4,
                                                        background: C.panel2, border: `1px solid ${C.line}`,
                                                        cursor: 'pointer', transition: 'border-color 0.15s',
                                                    }}
                                                    onMouseEnter={e => (e.currentTarget.style.borderColor = typeInfo.color)}
                                                    onMouseLeave={e => (e.currentTarget.style.borderColor = C.line)}>
                                                    <span style={{ width: 26, height: 26, borderRadius: '50%', background: typeInfo.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{typeInfo.icon}</span>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pt.label}</div>
                                                        <div style={{ fontFamily: MONO, fontSize: 9, color: C.sub }}>
                                                            {t(typeInfo.labelTh, typeInfo.labelEn)} • ({Number(pt.x_percent).toFixed(1)}%, {Number(pt.y_percent).toFixed(1)}%)
                                                        </div>
                                                    </div>
                                                    <button onClick={(e) => { e.stopPropagation(); handlePointDelete(idx); }}
                                                        style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 14, padding: 2 }}
                                                        title={t('ลบจุด', 'Delete point')}>✕</button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════
   PointEditor — Sidebar form
   ═══════════════════════════════════════════════════════════════ */
const PointEditor: React.FC<{
    point: LayoutPoint; meters: any[]; theme: string; C: any; t: any;
    onChange: (updates: Partial<LayoutPoint>) => void;
    onDelete: () => void; onClose: () => void;
}> = ({ point, meters, theme, C, t, onChange, onDelete, onClose }) => {
    const typeInfo = POINT_TYPES.find(t => t.key === point.point_type) || POINT_TYPES[0];
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: typeInfo.color + '18', borderRadius: 6, border: `1px solid ${typeInfo.color}40` }}>
                <span style={{ fontSize: 20 }}>{typeInfo.icon}</span>
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: typeInfo.color }}>{t(typeInfo.labelTh, typeInfo.labelEn)}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.sub, marginLeft: 'auto' }}>
                    ({Number(point.x_percent).toFixed(1)}%, {Number(point.y_percent).toFixed(1)}%)
                </span>
            </div>
            <div>
                <label style={{ fontFamily: MONO, fontSize: 10, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>{t('ป้ายชื่อ', 'Label')}</label>
                <input type="text" value={point.label} onChange={e => onChange({ label: e.target.value })}
                    style={{ width: '100%', padding: '6px 10px', fontFamily: MONO, fontSize: 12, background: C.panel2, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 4, outline: 'none' }} />
            </div>
            <div>
                <label style={{ fontFamily: MONO, fontSize: 10, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>{t('ประเภท', 'Type')}</label>
                <select value={point.point_type} onChange={e => onChange({ point_type: e.target.value })}
                    style={{ width: '100%', padding: '6px 10px', fontFamily: MONO, fontSize: 12, background: C.panel2, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 4, outline: 'none' }}>
                    {POINT_TYPES.map(pt => (<option key={pt.key} value={pt.key}>{pt.icon} {t(pt.labelTh, pt.labelEn)}</option>))}
                </select>
            </div>
            <div>
                <label style={{ fontFamily: MONO, fontSize: 10, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>{t('เชื่อมต่อมิเตอร์', 'Link Meter')}</label>
                <select value={point.meter_id || ''} onChange={e => onChange({ meter_id: e.target.value ? parseInt(e.target.value, 10) : null })}
                    style={{ width: '100%', padding: '6px 10px', fontFamily: MONO, fontSize: 12, background: C.panel2, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 4, outline: 'none' }}>
                    <option value="">{t('— ไม่ได้เชื่อมต่อ —', '— Not Connected —')}</option>
                    {meters.map((m: any) => (<option key={m.meter_id} value={m.meter_id}>[{m.meter_code}] {m.meter_name}</option>))}
                </select>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={onClose} style={{ flex: 1, padding: '7px 0', fontFamily: MONO, fontSize: 11, background: C.panel2, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 4, cursor: 'pointer' }}>{t('← ย้อนกลับ', '← Back')}</button>
                <button onClick={onDelete} style={{ flex: 1, padding: '7px 0', fontFamily: MONO, fontSize: 11, background: '#EF4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{t('🗑️ ลบจุด', '🗑️ Delete Point')}</button>
            </div>
        </div>
    );
};

export default LayoutSettingsPage;
