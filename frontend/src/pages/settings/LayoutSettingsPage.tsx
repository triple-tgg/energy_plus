import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/ui/StatusBadge';
import { layoutsApi, metersApi } from '../../api/client';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Search, ZoomIn, ZoomOut, RotateCcw, Filter, Eye, EyeOff, Layers, CheckCircle2, AlertCircle } from 'lucide-react';
import { STANDARD_METER_TYPES, resolveMeterType, renderMeterTypeIcon } from '../../config/meterTypes';

/* ═══════════════════════════════════════════════════════════════
   Types & Constants
   ═══════════════════════════════════════════════════════════════ */
interface LayoutForm {
    name: string;
    imageName: string;
    position: string;
    siteId: string;
    buildingId: string;
    floor: string;
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

const emptyForm: LayoutForm = { name: '', imageName: '', position: '', siteId: '', buildingId: '', floor: '', imageFile: null };

const POINT_TYPES = STANDARD_METER_TYPES.map(t => ({
    key: String(t.id),
    labelTh: t.labelTh,
    labelEn: t.labelEn,
    icon: t.icon,
    color: t.color,
    emoji: t.emoji,
}));

/** Resolve layout point type details safely with unified Master Data */
const getPointTypeInfo = (type: string | null | undefined) => {
    if (!type) return { key: '1', ...STANDARD_METER_TYPES[0] };
    if (type === 'power' || type === 'meter') return { key: '1', ...STANDARD_METER_TYPES[0] };
    if (type === 'water' || type === 'sensor') return { key: '2', ...STANDARD_METER_TYPES[1] };
    if (type === 'gas' || type === 'gen') return { key: '7', ...STANDARD_METER_TYPES[6] };
    if (type === 'mdb' || type === 'ups') return { key: '1', ...STANDARD_METER_TYPES[0] };
    if (type === 'temp' || type === 'temperature') return { key: '4', ...STANDARD_METER_TYPES[3] };
    if (type === 'humidity' || type === 'hum') return { key: '4', ...STANDARD_METER_TYPES[3] };

    const resolved = resolveMeterType(Number(type));
    return { key: String(resolved.id), ...resolved };
};

/** Automatically determine point_type from meter properties using unified Master Data */
const determinePointTypeFromMeter = (meter: any): string => {
    if (!meter) return '1';
    const resolved = resolveMeterType(meter.meter_type_id, meter.meter_type_name || meter.meter_name);
    return String(resolved.id);
};


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

const getPointMeterName = (point: LayoutPoint, meters: any[]): string => {
    const linkedMeter = meters.find((meter: any) => Number(meter.meter_id) === Number(point.meter_id));
    return linkedMeter?.meter_name || point.meter_name || point.label;
};

/** Check if value is a Font Awesome class */
const isFaIcon = (v: string) => v && (v.startsWith('fa ') || v.startsWith('fa-') || v.startsWith('fas '));

/** Render icon — supports FA class names and emoji */
const renderPointIcon = (iconName: string | null | undefined, fallbackIcon: string, size: number = 14) => {
    const active = iconName || fallbackIcon;
    if (active && isFaIcon(active)) {
        return <i className={active} style={{ fontSize: size }} />;
    }
    return <span style={{ fontSize: size, lineHeight: 1 }}>{active}</span>;
};

/** Get matching color for the icon */
const getIconColor = (iconName: string | null | undefined, fallbackColor: string): string => {
    if (!iconName) return fallbackColor;
    if (iconName.includes('bolt')) return '#F59E0B'; // Power
    if (iconName.includes('tint')) return '#3B82F6'; // Water
    if (iconName.includes('fire')) return '#EF4444'; // Gas
    if (iconName.includes('plug')) return '#8B5CF6'; // MDB
    if (iconName.includes('satellite-dish')) return '#06B6D4'; // Sensor
    if (iconName.includes('car-battery')) return '#10B981'; // Generator
    if (iconName.includes('solar-panel')) return '#F97316'; // Solar
    if (iconName.includes('snowflake')) return '#0EA5E9'; // HVAC
    if (iconName.includes('industry')) return '#6366F1'; // Industrial
    if (iconName.includes('building')) return '#64748B'; // Building
    if (iconName.includes('chart-bar')) return '#14B8A6'; // Analytics
    if (iconName.includes('exclamation-triangle')) return '#EAB308'; // Alert
    return fallbackColor;
};

/* ═══════════════════════════════════════════════════════════════
   LayoutSettingsPage
   ═══════════════════════════════════════════════════════════════ */
const LayoutSettingsPage: React.FC = () => {
    const { theme } = useTheme();
    const { t, language } = useLanguage();
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

    // --- Sites & Buildings state ---
    const [sites, setSites] = useState<any[]>([]);
    const [allBuildings, setAllBuildings] = useState<any[]>([]);

    useEffect(() => {
        (async () => {
            try {
                const { sitesApi } = await import('../../api/client');
                const [sitesRes, buildingsRes] = await Promise.all([
                    sitesApi.getAll({ limit: 100, activeOnly: true }),
                    sitesApi.getAllBuildings({ limit: 200 }),
                ]);
                setSites(sitesRes.data?.data || []);
                setAllBuildings(buildingsRes.data?.data || []);
            } catch (e) {
                console.error('Failed to load sites/buildings:', e);
            }
        })();
    }, []);

    const formBuildings = useMemo(() => {
        if (!form.siteId) return allBuildings;
        return allBuildings.filter((b: any) => String(b.site_id) === String(form.siteId));
    }, [allBuildings, form.siteId]);

    // --- Point Editor state ---
    const [editorOpen, setEditorOpen] = useState(false);
    const [editorLayout, setEditorLayout] = useState<any>(null);
    const [points, setPoints] = useState<LayoutPoint[]>([]);
    const [activeType, setActiveType] = useState('power');
    const [pointSaving, setPointSaving] = useState(false);
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [editingPoint, setEditingPoint] = useState<number | null>(null);
    const [meters, setMeters] = useState<any[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    // Enhanced points management state
    const [sidebarTab, setSidebarTab] = useState<'available' | 'placed'>('available');
    const [meterScopeFilter, setMeterScopeFilter] = useState<'all' | 'building'>('all');
    const [pointSearch, setPointSearch] = useState('');
    const [meterSearch, setMeterSearch] = useState('');
    const [pointFilterType, setPointFilterType] = useState<string>('all');
    const [pointFilterStatus, setPointFilterStatus] = useState<'all' | 'linked' | 'unlinked'>('all');
    const [zoomLevel, setZoomLevel] = useState<number>(1);
    const [pointScale, setPointScale] = useState<'sm' | 'md' | 'lg'>('md');
    const [showLabelsOnCanvas, setShowLabelsOnCanvas] = useState<boolean>(true);
    const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);
    const [draggedMeter, setDraggedMeter] = useState<any | null>(null);

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
        const inferredFloor = row.floor || (Array.isArray(row.linked_floors) && row.linked_floors.length === 1 ? row.linked_floors[0] : '');
        setForm({
            name: row.name || '',
            imageName: row.image_name || '',
            position: row.position || '',
            siteId: row.site_id ? String(row.site_id) : '',
            buildingId: row.building_id ? String(row.building_id) : '',
            floor: inferredFloor ? String(inferredFloor) : '',
            imageFile: null
        });
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
            formData.append('site_id', form.siteId || '');
            formData.append('building_id', form.buildingId || '');
            formData.append('floor', form.floor || '');
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
                metersApi.getAll({ all: true }),
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
        const typeInfo = getPointTypeInfo(activeType);
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
            setEditingPoint(null); // Go back to Point List!
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
        {
            key: 'site_name',
            title: t('ไซต์', 'Site'),
            render: (_: any, row: any) => (language === 'en' ? (row.site_name_en || row.site_name) : (row.site_name_th || row.site_name)) || '—',
        },
        {
            key: 'building_name',
            title: t('อาคาร', 'Building'),
            render: (_: any, row: any) => (language === 'en' ? (row.building_name_en || row.building_name) : (row.building_name_th || row.building_name)) || '—',
        },
        {
            key: 'floor',
            title: t('ชั้น', 'Floor'),
            render: (_: any, row: any) => {
                if (row.floor) return row.floor;
                if (Array.isArray(row.linked_floors) && row.linked_floors.length > 0) return row.linked_floors.join(', ');
                return '—';
            },
        },
        { key: 'image_name', title: t('ชื่อไฟล์รูปภาพ', 'Image Name') },
        {
            key: 'image_url', title: t('รูปภาพ', 'Image'),
            render: (v: string) => v ? (
                <img src={v} alt="layout" style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setPreviewImage(v)} />
            ) : <span style={{ color: 'var(--text-muted)' }}>—</span>,
        },
        {
            key: 'point_summary', title: t('สรุป Meter ในแผนผัง', 'Plan Meter Summary'),
            render: (v: any) => {
                const summary = Array.isArray(v) ? v : [];
                if (summary.length === 0) return <span style={{ color: 'var(--text-muted)', fontFamily: MONO, fontSize: 11 }}>— {t('ไม่มี Meter', 'No meters')} —</span>;
                return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {summary.map((item: any) => {
                            const typeInfo = getPointTypeInfo(item.point_type);
                            const color = typeInfo.color;
                            return (
                                <span key={item.point_type} style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    padding: '2px 8px', borderRadius: 4, fontSize: 10, fontFamily: MONO, fontWeight: 600,
                                    background: color + '20', color: color,
                                    border: `1px solid ${color}40`,
                                    transition: 'all 0.15s ease',
                                }}>
                                    {renderPointIcon(typeInfo.icon, typeInfo.emoji, 10)}
                                    {t(typeInfo.labelTh, typeInfo.labelEn)}
                                    <strong style={{ fontSize: 12 }}>{Number(item.count).toLocaleString()}</strong>
                                </span>
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
    ], [t, language]); // eslint-disable-line react-hooks/exhaustive-deps

    /* ───────────────────────────────────────
       Filtered Points for Large Points List
       ─────────────────────────────────────── */
    const filteredPoints = useMemo(() => {
        return points.map((p, idx) => ({ ...p, originalIndex: idx })).filter(item => {
            // Type filter
            if (pointFilterType !== "all" && item.point_type !== pointFilterType) {
                return false;
            }
            // Status filter
            if (pointFilterStatus === "linked" && !item.meter_id) {
                return false;
            }
            if (pointFilterStatus === "unlinked" && item.meter_id) {
                return false;
            }
            // Search query filter (matches point number, label, meter_name, meter_code)
            if (pointSearch.trim()) {
                const q = pointSearch.trim().toLowerCase();
                const numStr = String(item.originalIndex + 1);
                const label = (item.label || "").toLowerCase();
                const meterName = (getPointMeterName(item, meters) || "").toLowerCase();
                const linkedMeter = meters.find((m: any) => Number(m.meter_id) === Number(item.meter_id));
                const meterCode = (linkedMeter?.meter_code || item.meter_code || "").toLowerCase();
                if (!numStr.includes(q) && !label.includes(q) && !meterName.includes(q) && !meterCode.includes(q)) {
                    return false;
                }
            }
            return true;
        });
    }, [points, meters, pointFilterType, pointFilterStatus, pointSearch]);

    // Summary counts for filter tabs
    const pointsSummary = useMemo(() => {
        let linked = 0;
        let unlinked = 0;
        const byType: Record<string, number> = {};
        for (const p of points) {
            if (p.meter_id) linked++;
            else unlinked++;
            byType[p.point_type] = (byType[p.point_type] || 0) + 1;
        }
        return { total: points.length, linked, unlinked, byType };
    }, [points]);

    // Available meters that are not yet placed on this layout
    const availableMeters = useMemo(() => {
        const placedMeterIds = new Set(points.map(p => p.meter_id).filter(Boolean));
        // All unplaced meters in the entire system
        let list = meters.filter((m: any) => !placedMeterIds.has(Number(m.meter_id)));

        // Filter by scope if user explicitly selects 'building' and layout has site/building assigned
        if (meterScopeFilter === 'building') {
            if (editorLayout?.building_id) {
                list = list.filter((m: any) => Number(m.building_id) === Number(editorLayout.building_id));
            } else if (editorLayout?.site_id) {
                list = list.filter((m: any) => Number(m.site_id) === Number(editorLayout.site_id));
            }
        }

        // Search filter
        if (meterSearch.trim()) {
            const q = meterSearch.trim().toLowerCase();
            list = list.filter((m: any) =>
                (m.meter_name || '').toLowerCase().includes(q) ||
                (m.meter_code || '').toLowerCase().includes(q) ||
                String(m.meter_id).includes(q) ||
                (m.building_name || '').toLowerCase().includes(q) ||
                (m.site_name || '').toLowerCase().includes(q)
            );
        }
        return list;
    }, [meters, points, editorLayout, meterScopeFilter, meterSearch]);

    // Add Blank (Unlinked) Point handler
    const handleAddBlankPoint = () => {
        const newPoint: LayoutPoint = {
            point_type: '1',
            label: `Point ${points.length + 1}`,
            x_percent: 50,
            y_percent: 50,
            meter_id: null,
        };
        setPoints(prev => [...prev, newPoint]);
        setEditingPoint(points.length);
        setSuccessMsg(t('สร้างจุดเปล่าสำเร็จ สามารถเลือกลิงก์มิเตอร์ภายหลังได้', 'Blank point created'));
    };

    // Handler when user drops a dragged meter onto canvas or clicks "+ วาง"
    const handleDropMeterOnCanvas = (meter: any, xPercent: number, yPercent: number) => {
        const pType = determinePointTypeFromMeter(meter);
        const newPoint: LayoutPoint = {
            point_type: pType,
            label: meter.meter_name || meter.meter_code,
            x_percent: Math.round(xPercent * 100) / 100,
            y_percent: Math.round(yPercent * 100) / 100,
            meter_id: Number(meter.meter_id),
            meter_name: meter.meter_name,
            meter_code: meter.meter_code,
        };
        setPoints(prev => [...prev, newPoint]);
        setEditingPoint(points.length); // Open edit immediately for the newly placed meter
        setSuccessMsg(t(`วางมิเตอร์ ${meter.meter_code} สำเร็จ`, `Placed meter ${meter.meter_code} successfully`));
    };

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
                    <label className="form-label">{t('ไซต์', 'Site')}</label>
                    <select
                        className="form-control"
                        value={form.siteId}
                        onChange={e => setForm({ ...form, siteId: e.target.value, buildingId: '' })}
                    >
                        <option value="">— {t('เลือกไซต์', 'Select Site')} —</option>
                        {sites.map((s: any) => (
                            <option key={s.site_id} value={s.site_id}>
                                {language === 'en' ? (s.site_name_en || s.site_name) : (s.site_name_th || s.site_name)}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">{t('อาคาร', 'Building')}</label>
                    <select
                        className="form-control"
                        value={form.buildingId}
                        onChange={e => setForm({ ...form, buildingId: e.target.value })}
                    >
                        <option value="">— {t('เลือกอาคาร', 'Select Building')} —</option>
                        {formBuildings.map((b: any) => (
                            <option key={b.building_id} value={b.building_id}>
                                {language === 'en' ? (b.building_name_en || b.building_name) : (b.building_name_th || b.building_name)}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">{t('ชั้น', 'Floor')}</label>
                    <input
                        type="text"
                        className="form-control"
                        value={form.floor}
                        onChange={e => setForm({ ...form, floor: e.target.value })}
                        placeholder={t('เช่น 1, 2, G, B1', 'e.g. 1, 2, G, B1')}
                    />
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
                        background: C.bar, color: "#fff", padding: "8px 20px",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        borderBottom: `2px solid ${C.accent}`,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.15)", zIndex: 30,
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, letterSpacing: "0.5px", color: "#fff" }}>
                                {t("📌 จัดการจุดบนแผนผัง —", "📌 Manage Points —")} {editorLayout.name}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{
                                    fontFamily: MONO, fontSize: 11, background: "rgba(255, 255, 255, 0.12)",
                                    border: "1px solid rgba(255, 255, 255, 0.25)", padding: "2px 8px", borderRadius: 12,
                                    display: "inline-flex", alignItems: "center", gap: 4, color: "#fff",
                                }}>
                                    <Layers size={12} color="#38BDF8" />
                                    <strong>{points.length}</strong> {t("จุดบนผัง", "points on plan")}
                                </span>
                                <span style={{
                                    fontFamily: MONO, fontSize: 11, background: "rgba(16, 185, 129, 0.2)",
                                    border: "1px solid rgba(16, 185, 129, 0.4)", padding: "2px 8px", borderRadius: 12,
                                    display: "inline-flex", alignItems: "center", gap: 4, color: "#34D399",
                                }}>
                                    <CheckCircle2 size={12} />
                                    <strong>{pointsSummary.linked}</strong> {t("ผูกแล้ว", "linked")}
                                </span>
                                <span style={{
                                    fontFamily: MONO, fontSize: 11, background: "rgba(59, 130, 246, 0.2)",
                                    border: "1px solid rgba(59, 130, 246, 0.4)", padding: "2px 8px", borderRadius: 12,
                                    display: "inline-flex", alignItems: "center", gap: 4, color: "#93C5FD",
                                }}>
                                    <strong>{availableMeters.length}</strong> {t("มิเตอร์ที่ยังไม่วาง", "available meters")}
                                </span>
                            </div>
                        </div>

                        {/* Top Action Buttons */}
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <button onClick={handleSavePoints} disabled={pointSaving}
                                style={{
                                    background: "#10B981", color: "#fff", border: "none", padding: "6px 16px",
                                    borderRadius: 4, cursor: "pointer", fontFamily: MONO, fontSize: 12, fontWeight: 700,
                                    display: "inline-flex", alignItems: "center", gap: 6,
                                    boxShadow: "0 2px 6px rgba(16, 185, 129, 0.3)",
                                    opacity: pointSaving ? 0.6 : 1, transition: "all 0.15s ease",
                                }}>
                                {pointSaving ? t("⏳ กำลังบันทึก...", "⏳ Saving...") : t("💾 บันทึกจุดทั้งหมด", "💾 Save Points")}
                            </button>
                            <button onClick={() => { setEditorOpen(false); setEditorLayout(null); setEditingPoint(null); }}
                                style={{
                                    background: "rgba(255, 255, 255, 0.1)",
                                    border: "1px solid rgba(255, 255, 255, 0.35)",
                                    color: "#FFFFFF",
                                    padding: "6px 14px", borderRadius: 4, cursor: "pointer",
                                    fontFamily: MONO, fontSize: 12, fontWeight: 700,
                                    display: "inline-flex", alignItems: "center", gap: 6,
                                    transition: "all 0.15s ease",
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = "rgba(239, 68, 68, 0.25)";
                                    e.currentTarget.style.borderColor = "#EF4444";
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.35)";
                                }}>
                                {t("✕ ปิด", "✕ Close")}
                            </button>
                        </div>
                    </div>

                    {/* Toolbar: Instructions & Canvas Controls */}
                    <div style={{
                        background: C.panel2, padding: "6px 16px",
                        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
                        borderBottom: `1px solid ${C.line}`, zIndex: 20,
                    }}>
                        {/* Left: Interactive workflow tip */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{
                                fontFamily: MONO, fontSize: 11, background: C.accent + "18", color: C.accent,
                                border: `1px solid ${C.accent}40`, padding: "2px 8px", borderRadius: 4, fontWeight: 600,
                                display: "inline-flex", alignItems: "center", gap: 4,
                            }}>
                                💡 {t('วิธีใช้งาน: ลากมิเตอร์จากแถบขวามาวางบนรูป หรือคลิกปุ่ม "+ วาง" ที่มิเตอร์ได้ทันที', 'Tip: Drag a meter from right sidebar or click "+ Place"')}
                            </span>
                        </div>

                        {/* Right: Canvas Zoom & View Controls */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {/* Point Scale Toggle (Small, Medium, Large) */}
                            <div style={{ display: "inline-flex", background: C.panel, borderRadius: 4, border: `1px solid ${C.line}`, padding: 2, marginRight: 6 }}>
                                {(["sm", "md", "lg"] as const).map(sz => (
                                    <button key={sz} onClick={() => setPointScale(sz)}
                                        style={{
                                            border: "none", background: pointScale === sz ? C.accent : "transparent",
                                            color: pointScale === sz ? "#fff" : C.sub,
                                            fontSize: 10, fontFamily: MONO, fontWeight: 700, padding: "2px 8px",
                                            borderRadius: 3, cursor: "pointer", textTransform: "uppercase",
                                        }}
                                        title={sz === "sm" ? t("จุดขนาดเล็ก (เหมาะสำหรับจุดเยอะ)", "Small markers") : sz === "md" ? t("จุดขนาดปกติ", "Medium markers") : t("จุดขนาดใหญ่", "Large markers")}>
                                        {sz === "sm" ? t("จุดเล็ก", "Small") : sz === "md" ? t("จุดกลาง", "Med") : t("จุดใหญ่", "Large")}
                                    </button>
                                ))}
                            </div>

                            {/* Show/Hide Label Toggle */}
                            <button onClick={() => setShowLabelsOnCanvas(!showLabelsOnCanvas)}
                                style={{
                                    border: `1px solid ${C.line}`, background: showLabelsOnCanvas ? C.accent + "20" : C.panel,
                                    color: showLabelsOnCanvas ? C.accent : C.sub,
                                    fontSize: 11, fontFamily: MONO, fontWeight: 600, padding: "3px 8px",
                                    borderRadius: 4, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
                                }}
                                title={t("เปิด/ปิดการแสดงป้ายชื่อบนแผนผัง", "Toggle labels on canvas")}>
                                {showLabelsOnCanvas ? <Eye size={13} /> : <EyeOff size={13} />}
                                <span>{showLabelsOnCanvas ? t("ป้ายชื่อ: เปิด", "Labels: ON") : t("ป้ายชื่อ: ปิด", "Labels: OFF")}</span>
                            </button>

                            {/* Zoom controls */}
                            <div style={{ display: "inline-flex", alignItems: "center", background: C.panel, borderRadius: 4, border: `1px solid ${C.line}`, padding: "1px 4px" }}>
                                <button onClick={() => setZoomLevel(prev => Math.max(0.5, Math.round((prev - 0.25) * 100) / 100))}
                                    style={{ border: "none", background: "transparent", color: C.ink, cursor: "pointer", padding: "3px 5px", display: "flex", alignItems: "center" }}
                                    title={t("ซูมออก (-)", "Zoom out")}>
                                    <ZoomOut size={13} />
                                </button>
                                <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, minWidth: 42, textAlign: "center", color: C.ink }}>
                                    {Math.round(zoomLevel * 100)}%
                                </span>
                                <button onClick={() => setZoomLevel(prev => Math.min(3, Math.round((prev + 0.25) * 100) / 100))}
                                    style={{ border: "none", background: "transparent", color: C.ink, cursor: "pointer", padding: "3px 5px", display: "flex", alignItems: "center" }}
                                    title={t("ซูมเข้า (+)", "Zoom in")}>
                                    <ZoomIn size={13} />
                                </button>
                                <button onClick={() => setZoomLevel(1)}
                                    style={{ border: "none", background: "transparent", color: C.sub, cursor: "pointer", padding: "3px 5px", borderLeft: `1px solid ${C.line}`, display: "flex", alignItems: "center" }}
                                    title={t("รีเซ็ตขนาด 100%", "Reset zoom")}>
                                    <RotateCcw size={11} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Main Work Area: Canvas on Left, Drag & Drop Sidebar on Right */}
                    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                        {/* Canvas Area (Supports Drag Over & Drop) */}
                        <div style={{
                            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                            padding: 20, overflow: "auto", background: C.bg, position: "relative",
                        }}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "copy";
                        }}
                        onDrop={(e) => {
                            e.preventDefault();
                            const container = containerRef.current;
                            if (!container) return;
                            const meterDataStr = e.dataTransfer.getData("application/json");
                            if (!meterDataStr) return;
                            try {
                                const meter = JSON.parse(meterDataStr);
                                const rect = container.getBoundingClientRect();
                                const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                                const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
                                handleDropMeterOnCanvas(meter, x, y);
                            } catch (err) {
                                console.error("Drop error:", err);
                            }
                        }}>
                            <div style={{
                                transform: `scale(${zoomLevel})`,
                                transformOrigin: "center center",
                                transition: "transform 0.15s ease-out",
                            }}>
                                <div ref={containerRef}
                                    style={{
                                        position: "relative", display: "inline-block", maxWidth: "100%", maxHeight: "100%",
                                        cursor: draggedMeter ? "copy" : "default", userSelect: "none",
                                    }}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = "copy";
                                    }}>
                                    <img src={editorLayout.image_url} alt={editorLayout.name}
                                        style={{
                                            maxWidth: "100%", maxHeight: "calc(100vh - 160px)", objectFit: "contain",
                                            display: "block", border: `2px solid ${C.line}`, userSelect: "none", pointerEvents: "none",
                                            boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
                                        }}
                                        draggable={false} />

                                    {/* Points Overlay */}
                                    {points.map((pt, idx) => {
                                        const typeInfo = getPointTypeInfo(pt.point_type);
                                        const isSelected = editingPoint === idx;
                                        const isHovered = hoveredPointIdx === idx;
                                        const color = typeInfo.color;

                                        // Marker dimensions based on scale
                                        const size = pointScale === "sm" ? 22 : pointScale === "lg" ? 36 : 28;
                                        const fontSize = pointScale === "sm" ? 11 : pointScale === "lg" ? 16 : 13;
                                        const badgeSize = pointScale === "sm" ? 13 : pointScale === "lg" ? 18 : 15;

                                        return (
                                            <div key={idx}
                                                style={{
                                                    position: "absolute", left: `${pt.x_percent}%`, top: `${pt.y_percent}%`,
                                                    transform: "translate(-50%, -50%)",
                                                    zIndex: isSelected ? 40 : isHovered ? 35 : 15,
                                                    cursor: dragIdx === idx ? "grabbing" : "grab",
                                                }}
                                                onClick={(e) => { e.stopPropagation(); setEditingPoint(isSelected ? null : idx); }}
                                                onMouseEnter={() => setHoveredPointIdx(idx)}
                                                onMouseLeave={() => setHoveredPointIdx(null)}
                                                onMouseDown={(e) => handlePointDragStart(idx, e)}>
                                                {/* Point Pin */}
                                                <div style={{
                                                    width: size, height: size, borderRadius: "50%", background: color,
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    fontSize: fontSize, lineHeight: 1, color: "#fff",
                                                    fontFamily: MONO, fontWeight: 800,
                                                    border: isSelected ? "3px solid #fff" : isHovered ? "3px solid #F59E0B" : `2px solid ${theme === "dark" ? "#000" : "#fff"}`,
                                                    boxShadow: isSelected
                                                        ? `0 0 0 4px ${color}, 0 4px 12px rgba(0,0,0,0.5)`
                                                        : isHovered
                                                        ? `0 0 0 3px #F59E0B, 0 3px 10px rgba(0,0,0,0.4)`
                                                        : "0 2px 6px rgba(0,0,0,0.35)",
                                                    transform: isSelected || isHovered ? "scale(1.15)" : "scale(1)",
                                                    transition: "transform 0.15s, box-shadow 0.15s, border 0.15s",
                                                    userSelect: "none",
                                                }}>
                                                    {idx + 1}
                                                </div>

                                                {/* Type Icon Badge */}
                                                <div style={{
                                                    position: "absolute", top: -5, right: -5,
                                                    width: badgeSize, height: badgeSize, borderRadius: "50%",
                                                    background: theme === "dark" ? C.panel : "#fff",
                                                    color: typeInfo.color,
                                                    border: `1.5px solid ${typeInfo.color}`,
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    fontSize: badgeSize * 0.55, lineHeight: 1,
                                                    boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                                                    userSelect: "none", pointerEvents: "none",
                                                }}>
                                                    {renderPointIcon(typeInfo.icon, typeInfo.emoji, badgeSize * 0.55)}
                                                </div>

                                                {/* Optional Label Tag underneath */}
                                                {showLabelsOnCanvas && (
                                                    <div style={{
                                                        position: "absolute", top: "100%", left: "50%",
                                                        transform: "translateX(-50%)", marginTop: 2,
                                                        background: theme === "dark" ? "rgba(14, 17, 22, 0.9)" : "rgba(255, 255, 255, 0.9)",
                                                        color: C.ink, border: `1px solid ${isSelected ? color : C.line}`,
                                                        padding: "1px 5px", borderRadius: 3,
                                                        fontFamily: MONO, fontSize: 9, fontWeight: 700,
                                                        whiteSpace: "nowrap", pointerEvents: "none",
                                                        boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
                                                        maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis",
                                                    }}>
                                                        {getPointMeterName(pt, meters)}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Enhanced Sidebar with Two Tabs: "มิเตอร์ที่ยังไม่วาง (Drag to Place)" and "จุดที่วางแล้ว (Placed Points)" */}
                        <div style={{
                            width: 370, background: C.panel, borderLeft: `1px solid ${C.line}`,
                            display: "flex", flexDirection: "column", overflow: "hidden",
                            boxShadow: "-2px 0 10px rgba(0,0,0,0.1)", zIndex: 15,
                        }}>
                            {/* Two-tab Switcher Header */}
                            {editingPoint === null ? (
                                <div style={{
                                    display: "flex", background: C.panel2, borderBottom: `1px solid ${C.line}`,
                                }}>
                                    <button
                                        onClick={() => setSidebarTab("available")}
                                        style={{
                                            flex: 1, padding: "10px 8px", border: "none", cursor: "pointer",
                                            fontFamily: MONO, fontSize: 11.5, fontWeight: 700,
                                            background: sidebarTab === "available" ? C.panel : "transparent",
                                            color: sidebarTab === "available" ? C.accent : C.sub,
                                            borderBottom: sidebarTab === "available" ? `2px solid ${C.accent}` : "none",
                                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                                            transition: "all 0.15s ease",
                                        }}>
                                        <span>⚡ {t("มิเตอร์ที่ยังไม่วาง", "Available Meters")}</span>
                                        <span style={{
                                            background: sidebarTab === "available" ? C.accent : C.line,
                                            color: sidebarTab === "available" ? "#fff" : C.ink,
                                            fontSize: 10, padding: "1px 6px", borderRadius: 10,
                                        }}>
                                            {availableMeters.length}
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => setSidebarTab("placed")}
                                        style={{
                                            flex: 1, padding: "10px 8px", border: "none", cursor: "pointer",
                                            fontFamily: MONO, fontSize: 11.5, fontWeight: 700,
                                            background: sidebarTab === "placed" ? C.panel : "transparent",
                                            color: sidebarTab === "placed" ? C.accent : C.sub,
                                            borderBottom: sidebarTab === "placed" ? `2px solid ${C.accent}` : "none",
                                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                                            transition: "all 0.15s ease",
                                        }}>
                                        <span>📌 {t("จุดบนผัง", "Placed Points")}</span>
                                        <span style={{
                                            background: sidebarTab === "placed" ? C.accent : C.line,
                                            color: sidebarTab === "placed" ? "#fff" : C.ink,
                                            fontSize: 10, padding: "1px 6px", borderRadius: 10,
                                        }}>
                                            {points.length}
                                        </span>
                                    </button>
                                </div>
                            ) : (
                                <div style={{
                                    padding: "10px 14px", background: C.panel2, borderBottom: `1px solid ${C.line}`,
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                }}>
                                    <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: C.ink, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                        {t("✏️ แก้ไขจุดบนแผนผัง", "✏️ Edit Point")}
                                    </div>
                                    <button onClick={() => setEditingPoint(null)}
                                        style={{ border: "none", background: "transparent", color: C.sub, cursor: "pointer", fontFamily: MONO, fontSize: 11 }}>
                                        {t("← กลับ", "← Back")}
                                    </button>
                                </div>
                            )}

                            {/* Sidebar Content */}
                            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
                                {/* 1. EDIT MODE */}
                                {editingPoint !== null && points[editingPoint] ? (
                                    <div style={{ padding: 12 }}>
                                        <PointEditor
                                            point={points[editingPoint]}
                                            pointIndex={editingPoint}
                                            meters={meters}
                                            theme={theme}
                                            C={C}
                                            t={t}
                                            onChange={(updates) => handlePointUpdate(editingPoint, updates)}
                                            onDelete={() => handlePointDelete(editingPoint)}
                                            onClose={() => setEditingPoint(null)}
                                        />
                                    </div>
                                ) : sidebarTab === "available" ? (
                                    /* 2. AVAILABLE METERS TAB (DRAG & DROP TO CANVAS) */
                                    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                                        {/* Search & Scope Filter Box */}
                                        <div style={{ padding: "8px 12px", borderBottom: `1px solid ${C.line}`, background: C.panel, display: "flex", flexDirection: "column", gap: 6 }}>
                                            {/* Scope selector & Add blank point button */}
                                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                                <div style={{ display: "inline-flex", flex: 1, background: C.panel2, borderRadius: 4, border: `1px solid ${C.line}`, padding: 1 }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setMeterScopeFilter('all')}
                                                        style={{
                                                            flex: 1, border: "none", borderRadius: 3, padding: "3px 4px",
                                                            fontFamily: MONO, fontSize: 10, fontWeight: 700, cursor: "pointer",
                                                            background: meterScopeFilter === 'all' ? C.accent : "transparent",
                                                            color: meterScopeFilter === 'all' ? "#fff" : C.sub,
                                                        }}>
                                                        {t('มิเตอร์ทั้งหมด', 'All Meters')}
                                                    </button>
                                                    {(editorLayout?.building_id || editorLayout?.site_id) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setMeterScopeFilter('building')}
                                                            style={{
                                                                flex: 1, border: "none", borderRadius: 3, padding: "3px 4px",
                                                                fontFamily: MONO, fontSize: 10, fontWeight: 700, cursor: "pointer",
                                                                background: meterScopeFilter === 'building' ? C.accent : "transparent",
                                                                color: meterScopeFilter === 'building' ? "#fff" : C.sub,
                                                            }}>
                                                            {t('เฉพาะอาคารนี้', 'This Building')}
                                                        </button>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleAddBlankPoint}
                                                    style={{
                                                        background: C.panel2, color: C.ink, border: `1px solid ${C.line}`,
                                                        borderRadius: 4, padding: "3px 8px", fontFamily: MONO, fontSize: 10,
                                                        fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                                                    }}
                                                    title={t("สร้างจุดหมุดเปล่าแล้วค่อยผูกมิเตอร์ภายหลัง", "Create blank unlinked point")}>
                                                    + {t("สร้างจุดเปล่า", "Blank Point")}
                                                </button>
                                            </div>

                                            {/* Search input */}
                                            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                                                <Search size={13} color={C.sub} style={{ position: "absolute", left: 9 }} />
                                                <input
                                                    type="text"
                                                    value={meterSearch}
                                                    onChange={e => setMeterSearch(e.target.value)}
                                                    placeholder={t("ค้นหารหัสมิเตอร์, ชื่อมิเตอร์...", "Search meter code, name...")}
                                                    style={{
                                                        width: "100%", padding: "5px 24px 5px 28px", fontFamily: MONO, fontSize: 11,
                                                        background: C.panel2, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 4, outline: "none",
                                                    }}
                                                />
                                                {meterSearch && (
                                                    <button onClick={() => setMeterSearch("")}
                                                        style={{ position: "absolute", right: 6, border: "none", background: "transparent", color: C.sub, cursor: "pointer", fontSize: 11 }}>
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                            <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.sub }}>
                                                {t('🖱️ ลากมิเตอร์ไปวางบนรูป หรือคลิก "+ วาง"', '🖱️ Drag to image or click "+ Place"')}
                                            </div>
                                        </div>

                                        {/* List of Available Meters */}
                                        <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                                            {availableMeters.length === 0 ? (
                                                <div style={{ textAlign: "center", padding: "30px 12px", color: C.sub, fontFamily: MONO, fontSize: 11 }}>
                                                    <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.6 }}>🔍</div>
                                                    <div style={{ fontWeight: 700, color: C.ink, marginBottom: 4 }}>
                                                        {meterSearch || meterScopeFilter === 'building' ? t("ไม่พบมิเตอร์ตามเงื่อนไข", "No meters found") : t("มิเตอร์ทั้งหมดถูกวางบนผังแล้ว", "All meters are placed!")}
                                                    </div>
                                                    <div style={{ fontSize: 10, color: C.sub, marginBottom: 10 }}>
                                                        {points.length > 0 ? t(`มีมิเตอร์วางบนผังแล้ว ${points.length} จุด (ดูได้ที่แท็บ "จุดบนผัง")`, `${points.length} meters placed. Check "Placed Points" tab`) : t("ยังไม่มีมิเตอร์ในระบบ", "No meters in system")}
                                                    </div>
                                                    {meterScopeFilter === 'building' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setMeterScopeFilter('all')}
                                                            style={{
                                                                padding: "4px 10px", fontSize: 10, fontFamily: MONO,
                                                                background: C.accent, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer",
                                                            }}>
                                                            {t("สลับดูมิเตอร์ทั้งหมดในระบบ", "Show all meters in system")}
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                availableMeters.map((m: any) => {
                                                    const inferredType = determinePointTypeFromMeter(m);
                                                    const typeInfo = getPointTypeInfo(inferredType);
                                                    const color = typeInfo.color;

                                                    return (
                                                        <div key={m.meter_id}
                                                            draggable
                                                            onDragStart={(e) => {
                                                                setDraggedMeter(m);
                                                                e.dataTransfer.setData("application/json", JSON.stringify(m));
                                                                e.dataTransfer.effectAllowed = "copy";
                                                            }}
                                                            onDragEnd={() => setDraggedMeter(null)}
                                                            style={{
                                                                padding: "8px 10px", borderRadius: 5,
                                                                background: C.panel2, border: `1px solid ${C.line}`,
                                                                cursor: "grab", display: "flex", alignItems: "center", gap: 8,
                                                                transition: "all 0.15s ease",
                                                            }}
                                                            onMouseEnter={e => {
                                                                e.currentTarget.style.borderColor = color;
                                                                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
                                                            }}
                                                            onMouseLeave={e => {
                                                                e.currentTarget.style.borderColor = C.line;
                                                                e.currentTarget.style.boxShadow = "none";
                                                            }}>
                                                            {/* Type Icon Badge */}
                                                            <div style={{
                                                                width: 26, height: 26, borderRadius: "50%",
                                                                background: color + "20", color: color,
                                                                border: `1.5px solid ${color}50`,
                                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                                fontSize: 11, flexShrink: 0,
                                                            }}>
                                                                {renderPointIcon(typeInfo.icon, typeInfo.emoji, 11)}
                                                            </div>

                                                            {/* Meter Details */}
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                    {m.meter_code}
                                                                </div>
                                                                <div style={{ fontFamily: MONO, fontSize: 10, color: C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                    {m.meter_name}
                                                                </div>
                                                            </div>

                                                            {/* Quick Add Button */}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDropMeterOnCanvas(m, 50, 50)}
                                                                style={{
                                                                    background: color + "18", color: color,
                                                                    border: `1px solid ${color}50`, borderRadius: 4,
                                                                    padding: "3px 8px", fontSize: 10, fontFamily: MONO, fontWeight: 700,
                                                                    cursor: "pointer", flexShrink: 0,
                                                                }}
                                                                title={t("วางมิเตอร์นี้ตรงกลางแผนผัง", "Place meter at center of layout")}>
                                                                + {t("วาง", "Place")}
                                                            </button>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    /* 3. PLACED POINTS TAB */
                                    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                                        {/* Search & Filter Bar */}
                                        <div style={{ padding: "8px 12px", borderBottom: `1px solid ${C.line}`, background: C.panel, display: "flex", flexDirection: "column", gap: 6 }}>
                                            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                                                <Search size={13} color={C.sub} style={{ position: "absolute", left: 9 }} />
                                                <input
                                                    type="text"
                                                    value={pointSearch}
                                                    onChange={e => setPointSearch(e.target.value)}
                                                    placeholder={t("ค้นหาเลขจุด, ป้าย, มิเตอร์...", "Search #, label, meter...")}
                                                    style={{
                                                        width: "100%", padding: "5px 24px 5px 28px", fontFamily: MONO, fontSize: 11,
                                                        background: C.panel2, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 4, outline: "none",
                                                    }}
                                                />
                                                {pointSearch && (
                                                    <button onClick={() => setPointSearch("")}
                                                        style={{ position: "absolute", right: 6, border: "none", background: "transparent", color: C.sub, cursor: "pointer", fontSize: 11 }}>
                                                        ✕
                                                    </button>
                                                )}
                                            </div>

                                            {/* Type filter chips */}
                                            <div style={{ display: "flex", gap: 3, overflowX: "auto", paddingBottom: 2 }}>
                                                <button onClick={() => setPointFilterType("all")}
                                                    style={{
                                                        padding: "2px 6px", fontSize: 9.5, fontFamily: MONO, fontWeight: 600,
                                                        borderRadius: 3, cursor: "pointer", whiteSpace: "nowrap",
                                                        background: pointFilterType === "all" ? C.ink : "transparent",
                                                        color: pointFilterType === "all" ? (theme === "dark" ? "#000" : "#fff") : C.sub,
                                                        border: `1px solid ${pointFilterType === "all" ? C.ink : C.line}`,
                                                    }}>
                                                    {t("ทุกชนิด", "All")}
                                                </button>
                                                {POINT_TYPES.map(pt => {
                                                    const count = pointsSummary.byType[pt.key] || 0;
                                                    if (count === 0 && pointFilterType !== pt.key) return null;
                                                    const isActive = pointFilterType === pt.key;
                                                    return (
                                                        <button key={pt.key} onClick={() => setPointFilterType(isActive ? "all" : pt.key)}
                                                            style={{
                                                                padding: "2px 6px", fontSize: 9.5, fontFamily: MONO, fontWeight: 600,
                                                                borderRadius: 3, cursor: "pointer", whiteSpace: "nowrap",
                                                                background: isActive ? pt.color : pt.color + "18",
                                                                color: isActive ? "#fff" : pt.color,
                                                                border: `1px solid ${isActive ? pt.color : pt.color + "50"}`,
                                                                display: "inline-flex", alignItems: "center", gap: 3,
                                                            }}>
                                                            {renderPointIcon(pt.icon, pt.emoji, 9)}
                                                            <span>{t(pt.labelTh, pt.labelEn).split(" ")[0]}</span>
                                                            <span style={{ opacity: 0.8 }}>({count})</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Placed Points List */}
                                        <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 5 }}>
                                            {filteredPoints.length === 0 ? (
                                                <div style={{ textAlign: "center", padding: "40px 12px", color: C.sub, fontFamily: MONO, fontSize: 11 }}>
                                                    <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.5 }}>🔍</div>
                                                    <div>{t("ไม่พบจุดตามเงื่อนไขที่ค้นหา", "No matching points found")}</div>
                                                </div>
                                            ) : (
                                                filteredPoints.map((item) => {
                                                    const realIdx = item.originalIndex;
                                                    const typeInfo = getPointTypeInfo(item.point_type);
                                                    const color = typeInfo.color;
                                                    const isSelected = editingPoint === realIdx;
                                                    const isHovered = hoveredPointIdx === realIdx;
                                                    const isLinked = !!item.meter_id;
                                                    const linkedMeter = meters.find((m: any) => Number(m.meter_id) === Number(item.meter_id));

                                                    return (
                                                        <div key={realIdx}
                                                            onClick={() => setEditingPoint(realIdx)}
                                                            onMouseEnter={() => setHoveredPointIdx(realIdx)}
                                                            onMouseLeave={() => setHoveredPointIdx(null)}
                                                            style={{
                                                                display: "flex", alignItems: "center", gap: 8,
                                                                padding: "7px 9px", borderRadius: 4,
                                                                background: isSelected ? color + "20" : isHovered ? C.panel2 : C.panel,
                                                                border: `1px solid ${isSelected ? color : isHovered ? color + "80" : C.line}`,
                                                                cursor: "pointer", transition: "all 0.15s ease",
                                                            }}>
                                                            {/* Point Number Badge */}
                                                            <div style={{
                                                                width: 24, height: 24, borderRadius: "50%", background: color,
                                                                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                                                                fontFamily: MONO, fontSize: 11, fontWeight: 800, flexShrink: 0,
                                                            }}>
                                                                {realIdx + 1}
                                                            </div>

                                                            {/* Point Info */}
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{
                                                                    fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: C.ink,
                                                                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                                                }}>
                                                                    {item.label || `Point ${realIdx + 1}`}
                                                                </div>
                                                                <div style={{
                                                                    fontFamily: MONO, fontSize: 10, marginTop: 2,
                                                                    display: "flex", alignItems: "center", gap: 4,
                                                                    color: isLinked ? (theme === "dark" ? "#6EE7B7" : "#047857") : "#EF4444",
                                                                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                                                }}>
                                                                    {isLinked ? (
                                                                        <>
                                                                            <CheckCircle2 size={10} style={{ flexShrink: 0 }} />
                                                                            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                                                                [{linkedMeter?.meter_code || item.meter_code}] {linkedMeter?.meter_name || item.meter_name}
                                                                            </span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <AlertCircle size={10} style={{ flexShrink: 0 }} />
                                                                            <span>{t("ยังไม่ผูกมิเตอร์", "Not linked")}</span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Coordinates */}
                                                            <span style={{ fontFamily: MONO, fontSize: 9, color: C.sub, flexShrink: 0 }}>
                                                                {Math.round(item.x_percent)}%, {Math.round(item.y_percent)}%
                                                            </span>

                                                            {/* Delete */}
                                                            <button onClick={(e) => { e.stopPropagation(); handlePointDelete(realIdx); }}
                                                                style={{
                                                                    background: "transparent", border: "none", color: C.sub,
                                                                    cursor: "pointer", fontSize: 13, padding: "2px 4px", borderRadius: 3,
                                                                }}
                                                                onMouseEnter={e => (e.currentTarget.style.color = "#EF4444")}
                                                                onMouseLeave={e => (e.currentTarget.style.color = C.sub)}
                                                                title={t("ลบจุด", "Delete point")}>
                                                                ✕
                                                            </button>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
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
const PointEditor: React.FC<{
    point: LayoutPoint;
    pointIndex: number;
    meters: any[];
    theme: string;
    C: any;
    t: any;
    onChange: (updates: Partial<LayoutPoint>) => void;
    onDelete: () => void;
    onClose: () => void;
}> = ({ point, pointIndex, meters, theme, C, t, onChange, onDelete, onClose }) => {
    const typeInfo = getPointTypeInfo(point.point_type);
    const color = typeInfo.color;
    const [meterSearchQuery, setMeterSearchQuery] = useState("");

    // Filter meters by search query for fast linking
    const filteredMeters = useMemo(() => {
        if (!meterSearchQuery.trim()) return meters;
        const q = meterSearchQuery.trim().toLowerCase();
        return meters.filter((m: any) =>
            (m.meter_name || "").toLowerCase().includes(q) ||
            (m.meter_code || "").toLowerCase().includes(q) ||
            String(m.meter_id).includes(q)
        );
    }, [meters, meterSearchQuery]);

    const linkedMeter = meters.find((m: any) => Number(m.meter_id) === Number(point.meter_id));

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Header with Point Number & Type */}
            <div style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                background: color + "18", borderRadius: 6, border: `1px solid ${color}40`,
            }}>
                <div style={{
                    width: 24, height: 24, borderRadius: "50%", background: color, color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: MONO, fontSize: 12, fontWeight: 800,
                }}>
                    {pointIndex + 1}
                </div>
                <span style={{ fontSize: 18, color: color }}>{renderPointIcon(typeInfo.icon, typeInfo.emoji, 16)}</span>
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: color }}>{t(typeInfo.labelTh, typeInfo.labelEn)}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.sub, marginLeft: "auto" }}>
                    ({Number(point.x_percent).toFixed(1)}%, {Number(point.y_percent).toFixed(1)}%)
                </span>
            </div>

            {/* Label Input */}
            <div>
                <label style={{ fontFamily: MONO, fontSize: 10, color: C.sub, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 4 }}>
                    {t("ป้ายชื่อ (Label)", "Label")}
                </label>
                <input
                    type="text"
                    value={point.label}
                    onChange={e => onChange({ label: e.target.value })}
                    style={{
                        width: "100%", padding: "6px 10px", fontFamily: MONO, fontSize: 12,
                        background: C.panel2, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 4, outline: "none",
                    }}
                />
            </div>

            {/* Type Switcher */}
            <div>
                <label style={{ fontFamily: MONO, fontSize: 10, color: C.sub, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 4 }}>
                    {t("เปลี่ยนประเภทจุด", "Change Type")}
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
                    {POINT_TYPES.map(pt => (
                        <button key={pt.key}
                            type="button"
                            onClick={() => onChange({ point_type: pt.key })}
                            style={{
                                padding: "4px 6px", fontSize: 10, fontFamily: MONO, fontWeight: 600,
                                borderRadius: 3, cursor: "pointer",
                                background: point.point_type === pt.key ? pt.color : C.panel2,
                                color: point.point_type === pt.key ? "#fff" : C.ink,
                                border: `1px solid ${point.point_type === pt.key ? pt.color : C.line}`,
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
                            }}>
                            {renderPointIcon(pt.icon, pt.emoji, 10)} {t(pt.labelTh, pt.labelEn).split(" ")[0]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Searchable Meter Connection */}
            <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <label style={{ fontFamily: MONO, fontSize: 10, color: C.sub, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {t("เชื่อมต่อมิเตอร์ (Link Meter)", "Link Meter")}
                    </label>
                    {linkedMeter && (
                        <button
                            type="button"
                            onClick={() => onChange({ meter_id: null })}
                            style={{ border: "none", background: "transparent", color: "#EF4444", fontSize: 9.5, fontFamily: MONO, cursor: "pointer", textDecoration: "underline" }}>
                            {t("ยกเลิกการผูก", "Unlink")}
                        </button>
                    )}
                </div>

                {/* Instant search input for meters */}
                <div style={{ position: "relative", marginBottom: 6 }}>
                    <Search size={12} color={C.sub} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }} />
                    <input
                        type="text"
                        value={meterSearchQuery}
                        onChange={e => setMeterSearchQuery(e.target.value)}
                        placeholder={t("พิมพ์ค้นหามิเตอร์เพื่อเลือก...", "Type to search meters...")}
                        style={{
                            width: "100%", padding: "5px 22px 5px 26px", fontFamily: MONO, fontSize: 11,
                            background: C.panel2, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 4, outline: "none",
                        }}
                    />
                    {meterSearchQuery && (
                        <button onClick={() => setMeterSearchQuery("")}
                            style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", color: C.sub, cursor: "pointer", fontSize: 10 }}>
                            ✕
                        </button>
                    )}
                </div>

                {/* Select list with search results */}
                <select
                    size={6}
                    value={point.meter_id || ""}
                    onChange={e => onChange({ meter_id: e.target.value ? parseInt(e.target.value, 10) : null })}
                    style={{
                        width: "100%", padding: "4px", fontFamily: MONO, fontSize: 11,
                        background: C.panel2, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 4, outline: "none",
                    }}>
                    <option value="" style={{ padding: "4px 6px", color: C.sub }}>
                        {t("— ไม่ได้เชื่อมต่อมิเตอร์ —", "— Not Connected —")}
                    </option>
                    {filteredMeters.map((m: any) => (
                        <option key={m.meter_id} value={m.meter_id} style={{ padding: "4px 6px" }}>
                            [{m.meter_code}] {m.meter_name}
                        </option>
                    ))}
                </select>
                <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.sub, marginTop: 4, textAlign: "right" }}>
                    {t("แสดง", "Showing")} {filteredMeters.length} / {meters.length} {t("มิเตอร์", "meters")}
                </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" onClick={onClose}
                    style={{
                        flex: 1, padding: "7px 0", fontFamily: MONO, fontSize: 11, fontWeight: 600,
                        background: C.panel2, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 4, cursor: "pointer",
                    }}>
                    {t("← กลับไปหน้ารายการ", "← Back to List")}
                </button>
                <button type="button" onClick={onDelete}
                    style={{
                        flex: 1, padding: "7px 0", fontFamily: MONO, fontSize: 11, fontWeight: 600,
                        background: "#EF4444", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer",
                    }}>
                    {t("🗑️ ลบจุดนี้", "🗑️ Delete Point")}
                </button>
            </div>
        </div>
    );
};

export default LayoutSettingsPage;
