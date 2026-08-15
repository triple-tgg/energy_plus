import React, { useEffect, useState, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { layoutsApi, meterDataApi, metersApi, realtimeApi } from '../../api/client';
import { LayoutGrid, ZoomIn, ZoomOut, Maximize2, X, Search, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { LoadingScreen } from '../../components/ui/LoadingScreen';

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, "Cascadia Mono", monospace';

const THEMES = {
    light: {
        bg: '#EAE7DA', panel: '#FBFAF4', panel2: '#F1EFE3', ink: '#23261E', sub: '#6E705F',
        line: '#D4D1C0', bar: '#F1EFE3', barSub: '#8A8C7A', accent: '#2B4C7E',
    },
    dark: {
        bg: '#0E1116', panel: '#161B22', panel2: '#1C232E', ink: '#E6EDF3', sub: '#8B98A6',
        line: '#2A313C', bar: '#080A0E', barSub: '#8B98A6', accent: '#36C2CE',
    },
};

const POINT_TYPES: Record<string, { icon: string; faIcon: string; color: string; labelTh: string; labelEn: string }> = {
    power: { icon: '⚡', faIcon: 'fa fa-bolt', color: '#F59E0B', labelTh: 'ไฟฟ้า (Power)', labelEn: 'Power' },
    water: { icon: '💧', faIcon: 'fa fa-tint', color: '#3B82F6', labelTh: 'น้ำ (Water)', labelEn: 'Water' },
    gas: { icon: '🔥', faIcon: 'fa fa-fire', color: '#EF4444', labelTh: 'แก๊ส (Gas)', labelEn: 'Gas' },
    mdb: { icon: '🔌', faIcon: 'fa fa-plug', color: '#8B5CF6', labelTh: 'MDB', labelEn: 'MDB' },
    temp: { icon: '🌡️', faIcon: 'fa fa-thermometer-half', color: '#F43F5E', labelTh: 'อุณหภูมิ (Temp)', labelEn: 'Temp' },
    humidity: { icon: '🌫️', faIcon: 'fa fa-smog', color: '#14B8A6', labelTh: 'ความชื้น (Humidity)', labelEn: 'Humidity' },
    
    // Fallback for old layout points stored in DB
    meter: { icon: '⚡', faIcon: 'fa fa-bolt', color: '#F59E0B', labelTh: 'ไฟฟ้า (Power)', labelEn: 'Power' },
    sensor: { icon: '💧', faIcon: 'fa fa-tint', color: '#3B82F6', labelTh: 'น้ำ (Water)', labelEn: 'Water' },
    gen: { icon: '🔥', faIcon: 'fa fa-fire', color: '#EF4444', labelTh: 'แก๊ส (Gas)', labelEn: 'Gas' },
    ups: { icon: '🔌', faIcon: 'fa fa-plug', color: '#8B5CF6', labelTh: 'MDB', labelEn: 'MDB' },
    temperature: { icon: '🌡️', faIcon: 'fa fa-thermometer-half', color: '#F43F5E', labelTh: 'อุณหภูมิ (Temp)', labelEn: 'Temp' },
    hum: { icon: '🌫️', faIcon: 'fa fa-smog', color: '#14B8A6', labelTh: 'ความชื้น (Humidity)', labelEn: 'Humidity' },
};

/** Meter type definitions: meter_type_id → display info (FA class from DB) */
const METER_TYPES: Record<number, { faIcon: string; color: string; labelTh: string; labelEn: string }> = {
    1: { faIcon: 'fa fa-bolt', color: '#F59E0B', labelTh: 'Power', labelEn: 'Power' },
    2: { faIcon: 'fa fa-tint', color: '#3B82F6', labelTh: 'Water', labelEn: 'Water' },
    3: { faIcon: 'fa fa-fire', color: '#EF4444', labelTh: 'Gas', labelEn: 'Gas' },
    4: { faIcon: 'fa fa-plug', color: '#8B5CF6', labelTh: 'MDB', labelEn: 'MDB' },
    11: { faIcon: 'fa fa-smog', color: '#14B8A6', labelTh: 'Humidity', labelEn: 'Humidity' },
    12: { faIcon: 'fa fa-thermometer-half', color: '#F43F5E', labelTh: 'Temperature', labelEn: 'Temperature' },
};

const DEFAULT_TYPE = { faIcon: 'fa fa-chart-bar', color: '#6B7280', labelTh: 'อื่นๆ', labelEn: 'Other' };

/** Get meter type info — dynamically categorizes types based on name/id for Power/Water/Gas/MDB/Temp/Humidity matching */
const getMeterTypeInfo = (typeId: number, iconName?: string, typeName?: string) => {
    const name = (typeName || '').toLowerCase();
    let category = 'power';
    let color = '#F59E0B';
    let label = 'Power';
    let faIcon = iconName || 'fa fa-bolt';
    
    if (name.includes('น้ำ') || name.includes('water')) {
        category = 'water';
        color = '#3B82F6';
        label = 'Water';
        faIcon = iconName || 'fa fa-tint';
    } else if (name.includes('แก๊ส') || name.includes('gas') || name.includes('fire')) {
        category = 'gas';
        color = '#EF4444';
        label = 'Gas';
        faIcon = iconName || 'fa fa-fire';
    } else if (name.includes('mdb') || name.includes('plug')) {
        category = 'mdb';
        color = '#8B5CF6';
        label = 'MDB';
        faIcon = iconName || 'fa fa-plug';
    } else if (name.includes('temp') || name.includes('อุณหภูมิ')) {
        category = 'temp';
        color = '#F43F5E';
        label = 'Temp';
        faIcon = iconName || 'fa fa-thermometer-half';
    } else if (name.includes('hum') || name.includes('ความชื้น')) {
        category = 'humidity';
        color = '#14B8A6';
        label = 'Humidity';
        faIcon = iconName || 'fa fa-smog';
    } else if (name.includes('ele') || name.includes('volt') || name.includes('amp') || name.includes('power')) {
        category = 'power';
        color = '#F59E0B';
        label = 'Power';
        faIcon = iconName || 'fa fa-bolt';
    } else {
        // Fallback matching by typeId
        if (typeId === 2) {
            category = 'water'; color = '#3B82F6'; label = 'Water'; faIcon = iconName || 'fa fa-tint';
        } else if (typeId === 3) {
            category = 'gas'; color = '#EF4444'; label = 'Gas'; faIcon = iconName || 'fa fa-fire';
        } else if (typeId === 4 || typeId === 8) {
            category = 'mdb'; color = '#8B5CF6'; label = 'MDB'; faIcon = iconName || 'fa fa-plug';
        } else if (typeId === 11) {
            category = 'humidity'; color = '#14B8A6'; label = 'Humidity'; faIcon = iconName || 'fa fa-smog';
        } else if (typeId === 12) {
            category = 'temp'; color = '#F43F5E'; label = 'Temp'; faIcon = iconName || 'fa fa-thermometer-half';
        }
    }
    
    return { category, color, labelTh: label, labelEn: label, faIcon };
};

/** Render icon — supports FA class names */
const renderMeterIcon = (faIcon: string, size: number = 14, color?: string) => {
    return <i className={faIcon} style={{ fontSize: size, color: color || 'inherit' }} />;
};

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 5;
const ZOOM_STEP = 0.25;

/** Meter data fields to display in popup */
const METER_FIELDS: { key: string; labelTh: string; labelEn: string; unit?: string }[] = [
    { key: 'water_value', labelTh: 'ปริมาณน้ำสะสม (Water)', labelEn: 'Water Value', unit: 'm³' },
    { key: 'gas_value', labelTh: 'ปริมาณแก๊สสะสม (Gas)', labelEn: 'Gas Value', unit: 'm³' },
    { key: 'energy_kva', labelTh: 'กำลังไฟฟ้าปรากฏ (Kva)', labelEn: 'Kva' },
    { key: 'energy_kw', labelTh: 'กำลังไฟฟ้าจริง (Kw)', labelEn: 'Kw' },
    { key: 'energy_kvar', labelTh: 'กำลังไฟฟ้ารีแอคทีฟ (Kvar)', labelEn: 'Kvar' },
    { key: 'energy_frequency', labelTh: 'ความถี่ (Frequency)', labelEn: 'Frequency', unit: 'Hz' },
    { key: 'energy_kwh', labelTh: 'พลังงานไฟฟ้ารวม (KWh)', labelEn: 'KWh' },
    { key: 'energy_volt_p1', labelTh: 'แรงดันไฟฟ้า L1 (VoltP1)', labelEn: 'VoltP1', unit: 'V' },
    { key: 'energy_volt_p2', labelTh: 'แรงดันไฟฟ้า L2 (VoltP2)', labelEn: 'VoltP2', unit: 'V' },
    { key: 'energy_volt_p3', labelTh: 'แรงดันไฟฟ้า L3 (VoltP3)', labelEn: 'VoltP3', unit: 'V' },
    { key: 'energy_volt_l1', labelTh: 'แรงดันไฟฟ้า L1-L2 (VoltL1)', labelEn: 'VoltL1', unit: 'V' },
    { key: 'energy_volt_l2', labelTh: 'แรงดันไฟฟ้า L2-L3 (VoltL2)', labelEn: 'VoltL2', unit: 'V' },
    { key: 'energy_volt_l3', labelTh: 'แรงดันไฟฟ้า L3-L1 (VoltL3)', labelEn: 'VoltL3', unit: 'V' },
    { key: 'energy_amp1', labelTh: 'กระแสไฟฟ้า L1 (Amp1)', labelEn: 'Amp1', unit: 'A' },
    { key: 'energy_amp2', labelTh: 'กระแสไฟฟ้า L2 (Amp2)', labelEn: 'Amp2', unit: 'A' },
    { key: 'energy_amp3', labelTh: 'กระแสไฟฟ้า L3 (Amp3)', labelEn: 'Amp3', unit: 'A' },
    { key: 'energy_pf1', labelTh: 'ตัวประกอบกำลัง L1 (Pf1)', labelEn: 'Pf1' },
    { key: 'energy_pf2', labelTh: 'ตัวประกอบกำลัง L2 (Pf2)', labelEn: 'Pf2' },
    { key: 'energy_pf3', labelTh: 'ตัวประกอบกำลัง L3 (Pf3)', labelEn: 'Pf3' },
    { key: 'energy_thd_v1', labelTh: 'ความเพี้ยนฮาร์มอนิกแรงดัน (THD V1)', labelEn: 'THD V1', unit: '%' },
    { key: 'energy_thd_a1', labelTh: 'ความเพี้ยนฮาร์มอนิกกระแส (THD A1)', labelEn: 'THD A1', unit: '%' },
];

interface LayoutPoint {
    id: number;
    layout_id: number;
    point_type: string;
    label: string;
    x_percent: number;
    y_percent: number;
    meter_id: number | null;
    meter_name?: string;
    meter_code?: string;
}

const REALTIME_ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

const mapRealtimeMeterData = (row: any) => {
    const receivedAt = row?.received_at ? new Date(row.received_at).getTime() : 0;
    const isOnline = receivedAt > 0 && Date.now() - receivedAt <= REALTIME_ONLINE_THRESHOLD_MS;
    // Treat all-zero readings as offline even if data is fresh
    const isAllZero = row?.is_all_zero === true || (
        parseFloat(row?.vl1 || 0) === 0 && parseFloat(row?.vl2 || 0) === 0 && parseFloat(row?.vl3 || 0) === 0
        && parseFloat(row?.il1 || 0) === 0 && parseFloat(row?.il2 || 0) === 0 && parseFloat(row?.il3 || 0) === 0
        && parseFloat(row?.kw_3ph || 0) === 0 && parseFloat(row?.kva_3ph || 0) === 0
        && parseFloat(row?.hz || 0) === 0 && parseFloat(row?.import_kwhr || 0) === 0
    );
    return {
        ...row,
        status: (isOnline && !isAllZero) ? 'online' : 'offline',
        date_keep: row.received_at,
        energy_kwh: row.import_kwhr,
        energy_kva: row.kva_3ph,
        energy_kw: row.kw_3ph,
        energy_kvar: row.kvar_3ph,
        energy_frequency: row.hz,
        energy_volt_p1: row.vl1,
        energy_volt_p2: row.vl2,
        energy_volt_p3: row.vl3,
        energy_volt_l1: row.vl12,
        energy_volt_l2: row.vl23,
        energy_volt_l3: row.vl31,
        energy_amp1: row.il1,
        energy_amp2: row.il2,
        energy_amp3: row.il3,
        energy_pf1: row.pf1,
        energy_pf2: row.pf2,
        energy_pf3: row.pf3,
    };
};

const LayoutViewPage: React.FC = () => {
    const { theme } = useTheme();
    const { t, language } = useLanguage();
    const C = THEMES[theme];

    const [layouts, setLayouts] = useState<any[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [selectedLayout, setSelectedLayout] = useState<any>(null);
    const [points, setPoints] = useState<LayoutPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

    // Zoom state
    const [zoom, setZoom] = useState(1);

    // Meter popup state
    const [popupPoint, setPopupPoint] = useState<LayoutPoint | null>(null);
    const [meterData, setMeterData] = useState<any>(null);
    const [meterLoading, setMeterLoading] = useState(false);

    // Meter list sidebar state
    const [allMeters, setAllMeters] = useState<any[]>([]);
    const [latestMeterData, setLatestMeterData] = useState<Record<number, any>>({});
    const [meterSearch, setMeterSearch] = useState('');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [meterTypeFilter, setMeterTypeFilter] = useState<string | null>(null);
    const [activeLegendFilter, setActiveLegendFilter] = useState<string | null>(null);

    // Load all layouts + all meters
    useEffect(() => {
        (async () => {
            try {
                const [layoutRes, meterRes] = await Promise.all([
                    layoutsApi.getAll({ limit: 100 }),
                    metersApi.getAll({ limit: 500 }),
                ]);
                const items = layoutRes.data.data || [];
                setLayouts(items);
                if (items.length > 0) setSelectedId(items[0].id);
                setAllMeters(meterRes.data?.data || []);
            } catch (err) { console.error(err); }
            setLoading(false);
        })();
    }, []);

    // Refresh the latest realtime imported energy used by the meter list.
    useEffect(() => {
        let active = true;
        const loadLatestPower = async () => {
            try {
                const res = await realtimeApi.getLatest();
                const rows = res.data?.data || [];
                if (active) {
                    setLatestMeterData(Object.fromEntries(
                        rows
                            .filter((row: any) => row.meter_id)
                            .map((row: any) => [Number(row.meter_id), row])
                    ));
                }
            } catch (err) {
                console.error(err);
            }
        };
        loadLatestPower();
        const timer = window.setInterval(loadLatestPower, 30000);
        return () => {
            active = false;
            window.clearInterval(timer);
        };
    }, []);

    useEffect(() => {
        if (!popupPoint?.meter_id) return;
        const realtime = latestMeterData[Number(popupPoint.meter_id)];
        if (realtime) setMeterData(mapRealtimeMeterData(realtime));
    }, [latestMeterData, popupPoint?.meter_id]);

    // Check if a meter is linked to any point on the current layout
    const linkedMeterIds = useMemo(() => {
        const ids = new Set<string | number>();
        points.forEach(p => {
            if (p.meter_id) {
                ids.add(p.meter_id);
                ids.add(Number(p.meter_id));
                ids.add(String(p.meter_id));
            }
        });
        return ids;
    }, [points]);

    // Filtered meters for sidebar search + type filter
    const filteredMeters = useMemo(() => {
        // Only show meters that are linked to the current layout
        let result = allMeters.filter((m: any) => m.meter_id && linkedMeterIds.has(m.meter_id));
        
        // Also filter by activeLegendFilter if selected
        if (activeLegendFilter !== null) {
            result = result.filter((m: any) => {
                const linkedPt = points.find(p => Number(p.meter_id) === Number(m.meter_id));
                if (!linkedPt) return false;
                const ptMappedType = linkedPt.point_type === 'meter' ? 'power' : linkedPt.point_type === 'sensor' ? 'water' : linkedPt.point_type === 'gen' ? 'gas' : linkedPt.point_type === 'ups' ? 'mdb' : linkedPt.point_type;
                return ptMappedType === activeLegendFilter;
            });
        }
        
        if (meterTypeFilter !== null) {
            result = result.filter((m: any) => {
                const linkedPt = points.find(p => Number(p.meter_id) === Number(m.meter_id));
                if (!linkedPt) return false;
                const ptMappedType = linkedPt.point_type === 'meter' ? 'power' : linkedPt.point_type === 'sensor' ? 'water' : linkedPt.point_type === 'gen' ? 'gas' : linkedPt.point_type === 'ups' ? 'mdb' : linkedPt.point_type;
                return ptMappedType === meterTypeFilter;
            });
        }
        if (meterSearch.trim()) {
            const q = meterSearch.toLowerCase();
            result = result.filter((m: any) =>
                (m.meter_code || '').toLowerCase().includes(q) ||
                (m.meter_name || '').toLowerCase().includes(q) ||
                (m.room_code || '').toLowerCase().includes(q) ||
                (m.room_name || '').toLowerCase().includes(q)
            );
        }
        return result.sort((a: any, b: any) => {
            const aPointIndex = points.findIndex(point => Number(point.meter_id) === Number(a.meter_id));
            const bPointIndex = points.findIndex(point => Number(point.meter_id) === Number(b.meter_id));
            return aPointIndex - bPointIndex;
        });
    }, [allMeters, linkedMeterIds, activeLegendFilter, points, meterSearch, meterTypeFilter]);

    // Load points when layout changes
    useEffect(() => {
        if (!selectedId) return;
        setZoom(1);
        setPopupPoint(null);
        (async () => {
            try {
                const [layoutRes, pointsRes] = await Promise.all([
                    layoutsApi.getById(selectedId),
                    layoutsApi.getPoints(selectedId),
                ]);
                setSelectedLayout(layoutRes.data.data);
                setPoints((pointsRes.data.data || []).map((pt: any) => ({
                    ...pt,
                    x_percent: parseFloat(pt.x_percent) || 0,
                    y_percent: parseFloat(pt.y_percent) || 0,
                })));
            } catch (err) {
                console.error(err);
                setSelectedLayout(null);
                setPoints([]);
            }
        })();
    }, [selectedId]);

    // Zoom handlers
    const handleZoomIn = () => setZoom(z => Math.min(ZOOM_MAX, z + ZOOM_STEP));
    const handleZoomOut = () => setZoom(z => Math.max(ZOOM_MIN, z - ZOOM_STEP));
    const handleZoomReset = () => setZoom(1);

    // Point click — fetch meter realtime data
    const handlePointClick = async (pt: LayoutPoint) => {
        setPopupPoint(pt);
        setMeterData(null);

        if (!pt.meter_id) {
            // No linked meter — just show point info
            setMeterData(null);
            return;
        }

        setMeterLoading(true);
        try {
            const realtime = latestMeterData[Number(pt.meter_id)];
            if (realtime) {
                setMeterData(mapRealtimeMeterData(realtime));
                setMeterLoading(false);
                return;
            }

            const res = await meterDataApi.getRealtime({ meter_id: pt.meter_id });
            const rows = res.data.data || [];
            // Find the matching meter row
            const match = rows.find((r: any) => r.meter_id === pt.meter_id) || rows[0] || null;
            setMeterData(match);
        } catch (err) {
            console.error(err);
            setMeterData(null);
        }
        setMeterLoading(false);
    };

    // Count by type
    const typeCounts = points.reduce((acc, pt) => {
        acc[pt.point_type] = (acc[pt.point_type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const zoomPercent = Math.round(zoom * 100);

    return (
        <div style={{ color: C.ink, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
            {/* Command Bar */}
            <div style={{ background: C.bar, color: C.ink, display: 'flex', alignItems: 'stretch', borderBottom: `2px solid ${C.accent}`, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}><LayoutGrid size={16} /></div>
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>{t('การติดตาม // แผนผัง', 'MONITORING // LAYOUT')}</div>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>{t('แผนผังตำแหน่งมิเตอร์และจุดวัดพลังงาน', 'Meter placement layout and energy measurement points')}</div>
                    </div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px' }}>
                    <label style={{ fontFamily: MONO, fontSize: 11, color: C.barSub }}>{t('เลือกแผนผัง:', 'Select Layout:')}</label>
                    <select value={selectedId || ''} onChange={e => setSelectedId(parseInt(e.target.value, 10))}
                        style={{ padding: '5px 10px', fontFamily: MONO, fontSize: 12, background: C.panel2, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 4, outline: 'none', minWidth: 220 }}>
                        {layouts.map((l: any) => {
                            const bName = language === 'en' ? (l.building_name_en || l.building_name) : (l.building_name_th || l.building_name);
                            const sName = language === 'en' ? (l.site_name_en || l.site_name) : (l.site_name_th || l.site_name);
                            const locTag = bName || sName ? ` [${[sName, bName].filter(Boolean).join(' · ')}]` : '';
                            return (<option key={l.id} value={l.id}>{l.name}{locTag}</option>);
                        })}
                    </select>
                </div>
            </div>

            {loading ? (
                <LoadingScreen inline theme={theme} />
            ) : layouts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 24px', fontFamily: MONO, color: C.sub }}>
                    <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>🗺️</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{t('ไม่มีแผนผังที่สามารถแสดงได้', 'No Layouts Available')}</div>
                    <div style={{ fontSize: 11, marginTop: 6 }}>{t('ไปที่การตั้งค่า → แผนผัง เพื่อสร้างแผนผังใหม่', 'Go to Settings → Layouts to create a new layout')}</div>
                </div>
            ) : selectedLayout ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px 16px 16px' }}>
                    {/* Top bar: Legend + Zoom Controls */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center', flexShrink: 0 }}>
                        {/* Legend */}
                        <div style={{
                            flex: 1, display: 'flex', gap: 12, padding: '8px 16px',
                            background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, alignItems: 'center',
                            flexWrap: 'wrap', minWidth: 0,
                        }}>
                            <span style={{ fontFamily: MONO, fontSize: 10, color: C.sub, textTransform: 'uppercase', letterSpacing: '1px' }}>{t('อุปกรณ์:', 'Devices:')}</span>
                            {Object.entries(POINT_TYPES).filter(([k]) => ['power', 'water', 'gas', 'mdb'].includes(k)).map(([key, info]) => {
                                const isActive = activeLegendFilter === key;
                                const count = (typeCounts[key] || 0) + (key === 'power' ? typeCounts.meter || 0 : key === 'water' ? typeCounts.sensor || 0 : key === 'gas' ? typeCounts.gen || 0 : key === 'mdb' ? typeCounts.ups || 0 : 0);
                                return (
                                    <div key={key}
                                        onClick={() => setActiveLegendFilter(activeLegendFilter === key ? null : key)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                                            background: isActive ? info.color + '22' : 'transparent',
                                            border: `1.5px solid ${isActive ? info.color : 'transparent'}`,
                                            boxShadow: isActive ? `0 2px 6px ${info.color}30` : 'none',
                                            transition: 'all 0.15s ease',
                                            userSelect: 'none'
                                        }}
                                        title={isActive ? t('แสดงทั้งหมด', 'Show All') : `${t('แสดงเฉพาะ', 'Show Only')} ${t(info.labelTh, info.labelEn)}`}
                                    >
                                        <span style={{ width: 22, height: 22, borderRadius: '50%', background: info.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff' }}>
                                            <i className={info.faIcon} />
                                        </span>
                                        <span style={{ fontFamily: MONO, fontSize: 11, color: C.ink, fontWeight: isActive ? 700 : 500 }}>{t(info.labelTh, info.labelEn)}</span>
                                        <span style={{
                                            fontFamily: MONO, fontSize: 10, color: isActive ? '#fff' : C.sub,
                                            background: isActive ? info.color : C.panel2, padding: '1px 6px',
                                            borderRadius: 8, border: `1px solid ${isActive ? info.color : C.line}`,
                                            fontWeight: isActive ? 700 : 500,
                                            transition: 'all 0.15s ease'
                                        }}>{count}</span>
                                    </div>
                                );
                            })}
                            <div style={{ flex: 1 }} />
                            <span style={{ fontFamily: MONO, fontSize: 10, color: C.sub }}>{t('จุดทั้งหมด', 'Total')} {points.length} {t('จุด', 'points')}</span>
                        </div>

                        {/* Zoom Controls */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: '4px 8px',
                        }}>
                            <button onClick={handleZoomOut} title={t('ซูมออก (−)', 'Zoom Out (−)')}
                                style={{ background: 'transparent', border: `1px solid ${C.line}`, borderRadius: 4, width: 30, height: 30, display: 'grid', placeItems: 'center', cursor: 'pointer', color: C.ink, transition: 'all 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = C.panel2; e.currentTarget.style.borderColor = C.accent; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = C.line; }}>
                                <ZoomOut size={16} />
                            </button>
                            <div style={{
                                fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.ink,
                                minWidth: 48, textAlign: 'center', padding: '0 4px',
                                background: C.panel2, borderRadius: 4, lineHeight: '28px',
                                border: `1px solid ${C.line}`,
                            }}>{zoomPercent}%</div>
                            <button onClick={handleZoomIn} title={t('ซูมเข้า (+)', 'Zoom In (+)')}
                                style={{ background: 'transparent', border: `1px solid ${C.line}`, borderRadius: 4, width: 30, height: 30, display: 'grid', placeItems: 'center', cursor: 'pointer', color: C.ink, transition: 'all 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = C.panel2; e.currentTarget.style.borderColor = C.accent; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = C.line; }}>
                                <ZoomIn size={16} />
                            </button>
                            <div style={{ width: 1, height: 20, background: C.line, margin: '0 4px' }} />
                            <button onClick={handleZoomReset} title={t('รีเซ็ตซูม (100%)', 'Reset Zoom (100%)')}
                                style={{ background: 'transparent', border: `1px solid ${C.line}`, borderRadius: 4, width: 30, height: 30, display: 'grid', placeItems: 'center', cursor: 'pointer', color: C.ink, transition: 'all 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = C.panel2; e.currentTarget.style.borderColor = C.accent; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = C.line; }}>
                                <Maximize2 size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Main content area: Canvas + Meter Sidebar */}
                    <div style={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden', borderRadius: 6, border: `1px solid ${C.line}` }}>
                        {/* Layout Image + Points — zoom contained in this box */}
                        <div style={{
                            flex: 1, overflow: 'auto', position: 'relative',
                            background: C.panel,
                        }}>
                            <div style={{
                                width: `${zoom * 100}%`,
                                minHeight: zoom > 1 ? `${zoom * 100}%` : '100%',
                                padding: 12,
                                position: 'relative',
                                transition: 'width 0.2s ease, min-height 0.2s ease',
                            }}>
                                <div style={{
                                    position: 'relative', display: 'inline-block',
                                    width: '100%',
                                }}>
                                    <img src={selectedLayout.image_url} alt={selectedLayout.name}
                                        style={{
                                            width: '100%',
                                            objectFit: 'contain', display: 'block',
                                            border: `2px solid ${C.line}`, userSelect: 'none',
                                        }}
                                        draggable={false} />

                                    {/* Points */}
                                    {points.filter(pt => {
                                        const ptMappedType = pt.point_type === 'meter' ? 'power' : pt.point_type === 'sensor' ? 'water' : pt.point_type === 'gen' ? 'gas' : pt.point_type === 'ups' ? 'mdb' : pt.point_type;
                                        return activeLegendFilter === null || ptMappedType === activeLegendFilter;
                                    }).map((pt, idx) => {
                                        const info = POINT_TYPES[pt.point_type] || POINT_TYPES.power;
                                        const isHovered = hoveredPoint === idx;
                                        const isActive = popupPoint?.id === pt.id;
                                        const pointNumber = points.findIndex(point => point.id === pt.id) + 1;
                                        const pointScale = Math.max(0.5, Math.min(1.5, 1 / Math.sqrt(zoom)));
                                        return (
                                            <div key={pt.id}
                                                style={{
                                                    position: 'absolute', left: `${pt.x_percent}%`, top: `${pt.y_percent}%`,
                                                    transform: `translate(-50%, -50%) scale(${pointScale})`,
                                                    zIndex: isHovered || isActive ? 20 : 10, cursor: 'pointer',
                                                }}
                                                onMouseEnter={() => setHoveredPoint(idx)}
                                                onMouseLeave={() => setHoveredPoint(null)}
                                                onClick={() => handlePointClick(pt)}>
                                                {/* Pulse */}
                                                {(isHovered || isActive) && (
                                                    <div style={{
                                                        position: 'absolute', inset: -6, borderRadius: '50%',
                                                        border: `2px solid ${info.color}`,
                                                        animation: 'pulse-ring 1s ease-out infinite', opacity: 0.6,
                                                    }} />
                                                )}
                                                {/* Circle */}
                                                <div style={{
                                                    width: isHovered || isActive ? 38 : 32, height: isHovered || isActive ? 38 : 32,
                                                    borderRadius: '50%', background: info.color,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: isHovered || isActive ? 16 : 14, lineHeight: 1, color: '#fff',
                                                    fontFamily: MONO, fontWeight: 800,
                                                    border: isActive ? '3px solid #fff' : `2px solid ${theme === 'dark' ? '#000' : '#fff'}`,
                                                    boxShadow: isHovered || isActive
                                                        ? `0 0 12px ${info.color}80, 0 4px 12px rgba(0,0,0,0.4)`
                                                        : '0 2px 6px rgba(0,0,0,0.3)',
                                                    transition: 'all 0.2s ease', userSelect: 'none',
                                                }}>{pointNumber}</div>
                                                <div style={{
                                                    position: 'absolute', top: -7, right: -7,
                                                    width: 18, height: 18,
                                                    borderRadius: 9, background: theme === 'dark' ? C.panel : '#fff',
                                                    color: info.color,
                                                    border: `2px solid ${info.color}`,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 8,
                                                    lineHeight: 1, boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
                                                    userSelect: 'none',
                                                }}><i className={info.faIcon} /></div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* ═══════════════════════════════════════════════════════
                            Right Sidebar: Meter List
                            ═══════════════════════════════════════════════════════ */}
                        <div style={{
                            width: sidebarCollapsed ? 36 : 300,
                            background: C.panel,
                            borderLeft: `1px solid ${C.line}`,
                            display: 'flex', flexDirection: 'column',
                            overflow: 'hidden',
                            transition: 'width 0.2s ease',
                            flexShrink: 0,
                        }}>
                            {/* Sidebar Header */}
                            <div
                                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                                style={{
                                    padding: sidebarCollapsed ? '10px 8px' : '10px 14px',
                                    background: C.panel2, borderBottom: `1px solid ${C.line}`,
                                    fontFamily: MONO, fontSize: 12, fontWeight: 700, color: C.ink,
                                    textTransform: 'uppercase', letterSpacing: '1px',
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    cursor: 'pointer', userSelect: 'none',
                                    justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                                }}>
                                <ChevronRight size={14} style={{
                                    transform: sidebarCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s',
                                }} />
                                {!sidebarCollapsed && (
                                    <>
                                        <span>{t('📋 รายการมิเตอร์', '📋 Meter List')}</span>
                                        <span style={{
                                            marginLeft: 'auto', fontFamily: MONO, fontSize: 10,
                                            color: C.sub, background: C.panel, padding: '1px 8px',
                                            borderRadius: 8, border: `1px solid ${C.line}`,
                                        }}>{filteredMeters.length}</span>
                                    </>
                                )}
                            </div>

                            {!sidebarCollapsed && (
                                <>
                                    {/* Type filter tabs */}
                                    <div style={{
                                        display: 'flex', gap: 4, padding: '6px 12px',
                                        borderBottom: `1px solid ${C.line}`,
                                        flexWrap: 'wrap',
                                    }}>
                                        <button
                                            onClick={() => setMeterTypeFilter(null)}
                                            style={{
                                                padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                                                fontFamily: MONO, fontSize: 9, fontWeight: 700,
                                                background: meterTypeFilter === null ? C.accent : 'transparent',
                                                color: meterTypeFilter === null ? '#fff' : C.sub,
                                                border: `1px solid ${meterTypeFilter === null ? C.accent : C.line}`,
                                                transition: 'all 0.15s',
                                            }}>
                                            {t('ทั้งหมด', 'ALL')}
                                        </button>
                                        {Object.entries(POINT_TYPES).filter(([k]) => ['power', 'water', 'gas', 'mdb', 'temp', 'humidity'].includes(k)).map(([key, info]) => (
                                            <button
                                                key={key}
                                                onClick={() => setMeterTypeFilter(meterTypeFilter === key ? null : key)}
                                                style={{
                                                    padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                                                    fontFamily: MONO, fontSize: 9, fontWeight: 700,
                                                    background: meterTypeFilter === key ? info.color : 'transparent',
                                                    color: meterTypeFilter === key ? '#fff' : C.sub,
                                                    border: `1px solid ${meterTypeFilter === key ? info.color : C.line}`,
                                                    transition: 'all 0.15s',
                                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                                }}>
                                                {renderMeterIcon(info.faIcon, 9)} {info.labelEn}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Search */}
                                    <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.line}` }}>
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            background: C.panel2, border: `1px solid ${C.line}`,
                                            borderRadius: 4, padding: '5px 8px',
                                        }}>
                                            <Search size={13} style={{ color: C.sub, flexShrink: 0 }} />
                                            <input
                                                type="text"
                                                value={meterSearch}
                                                onChange={e => setMeterSearch(e.target.value)}
                                                placeholder={t('ค้นหามิเตอร์...', 'Search meters...')}
                                                style={{
                                                    flex: 1, background: 'transparent', border: 'none',
                                                    outline: 'none', fontFamily: MONO, fontSize: 11,
                                                    color: C.ink, padding: 0,
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Meter list */}
                                    <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
                                        {filteredMeters.length === 0 ? (
                                            <div style={{
                                                textAlign: 'center', padding: '30px 12px',
                                                color: C.sub, fontFamily: MONO, fontSize: 11,
                                            }}>
                                                <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>⚡</div>
                                                <div>{meterSearch || meterTypeFilter !== null ? t('ไม่พบมิเตอร์ที่ค้นหา', 'No meters found') : t('ไม่มีมิเตอร์', 'No meters')}</div>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                {filteredMeters.map((m: any) => {
                                                    const isLinked = linkedMeterIds.has(m.meter_id);
                                                    const linkedPt = points.find(p => Number(p.meter_id) === Number(m.meter_id));
                                                    const pointNumber = linkedPt
                                                        ? points.findIndex(point => point.id === linkedPt.id) + 1
                                                        : null;
                                                    const realtime = latestMeterData[Number(m.meter_id)];
                                                    const hasCurrentKwh = realtime?.import_kwhr !== null && realtime?.import_kwhr !== undefined;
                                                    const currentKwh = Number(realtime?.import_kwhr);
                                                    const ptType = linkedPt ? (linkedPt.point_type === 'meter' ? 'power' : linkedPt.point_type === 'sensor' ? 'water' : linkedPt.point_type === 'gen' ? 'gas' : linkedPt.point_type === 'ups' ? 'mdb' : linkedPt.point_type) : 'power';
                                                    const mType = POINT_TYPES[ptType] || POINT_TYPES.power;
                                                    return (
                                                        <div key={m.meter_id}
                                                            onClick={() => {
                                                                const linkedPt = points.find(p => Number(p.meter_id) === Number(m.meter_id));
                                                                if (linkedPt) handlePointClick(linkedPt);
                                                            }}
                                                            style={{
                                                                display: 'flex', alignItems: 'center', gap: 8,
                                                                padding: '7px 10px', borderRadius: 4,
                                                                background: C.panel2, border: `1px solid ${C.line}`,
                                                                cursor: isLinked ? 'pointer' : 'default',
                                                                transition: 'border-color 0.15s',
                                                                opacity: isLinked ? 1 : 0.65,
                                                            }}
                                                            onMouseEnter={e => { if (isLinked) e.currentTarget.style.borderColor = mType.color; }}
                                                            onMouseLeave={e => { e.currentTarget.style.borderColor = C.line; }}
                                                        >
                                                            <span style={{
                                                                width: 26, height: 26, borderRadius: '50%',
                                                                background: isLinked ? mType.color : C.line,
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontFamily: MONO, fontSize: 12, fontWeight: 800,
                                                                flexShrink: 0, color: '#fff',
                                                            }}>{pointNumber ?? '—'}</span>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{
                                                                    fontFamily: MONO, fontSize: 11, fontWeight: 600, color: C.ink,
                                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                                }}>{m.meter_name || m.meter_code}</div>
                                                                <div style={{ fontFamily: MONO, fontSize: 9, color: C.sub }}>
                                                                    [{m.meter_code}] {m.room_code ? `• ${m.room_code}` : ''}
                                                                </div>
                                                            </div>
                                                            <span style={{
                                                                minWidth: 70, textAlign: 'right',
                                                                fontFamily: MONO, fontSize: 12, fontWeight: 800,
                                                                color: hasCurrentKwh && Number.isFinite(currentKwh) ? '#10B981' : C.sub,
                                                                whiteSpace: 'nowrap', flexShrink: 0,
                                                            }}>
                                                                {hasCurrentKwh && Number.isFinite(currentKwh)
                                                                    ? `${currentKwh.toLocaleString(language === 'th' ? 'th-TH' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh`
                                                                    : '— kWh'}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}

            {/* ═══════════════════════════════════════════════════════
                Meter Data Popup (Modal)
                ═══════════════════════════════════════════════════════ */}
            {popupPoint && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1200,
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                    onClick={() => setPopupPoint(null)}>
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8,
                            width: 480, maxHeight: '80vh', overflow: 'hidden',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
                            display: 'flex', flexDirection: 'column',
                        }}>
                        {/* Header */}
                        <div style={{
                            padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            background: C.bar, borderBottom: `2px solid ${(POINT_TYPES[popupPoint.point_type] || POINT_TYPES.power).color}`,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{
                                    width: 30, height: 30, borderRadius: '50%',
                                    background: (POINT_TYPES[popupPoint.point_type] || POINT_TYPES.power).color,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 14, color: '#fff',
                                }}><i className={(POINT_TYPES[popupPoint.point_type] || POINT_TYPES.power).faIcon} /></span>
                                <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: C.ink, letterSpacing: '0.5px' }}>
                                    {popupPoint.label}
                                </span>
                            </div>
                            <button onClick={() => setPopupPoint(null)}
                                style={{ background: 'transparent', border: 'none', color: C.ink, cursor: 'pointer', padding: 4, display: 'grid', placeItems: 'center' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
                            {/* Meter Info */}
                            {popupPoint.meter_id && meterData ? (
                                <>
                                    {/* Meter name */}
                                    <div style={{
                                        padding: '12px 18px', background: C.panel2,
                                        borderBottom: `1px solid ${C.line}`,
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    }}>
                                        <div>
                                            <div style={{ fontFamily: MONO, fontSize: 10, color: C.sub, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 2 }}>{t('มิเตอร์', 'Meter')}</div>
                                            <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: C.ink }}>
                                                [{meterData.meter_code}] {meterData.meter_name}
                                            </div>
                                        </div>
                                        <div style={{
                                            fontFamily: MONO, fontSize: 10, padding: '3px 10px',
                                            borderRadius: 12,
                                            background: meterData.status === 'online' ? '#10B98120' : '#EF444420',
                                            color: meterData.status === 'online' ? '#10B981' : '#EF4444',
                                            border: `1px solid ${meterData.status === 'online' ? '#10B981' : '#EF4444'}40`,
                                            fontWeight: 600, textTransform: 'uppercase',
                                        }}>
                                            {meterData.status === 'online' ? '🟢' : '🔴'} {meterData.status === 'online' ? t('ออนไลน์', 'online') : t('ออฟไลน์', 'offline')}
                                        </div>
                                    </div>

                                    {/* Location info */}
                                    <div style={{
                                        padding: '8px 18px', background: C.panel,
                                        borderBottom: `1px solid ${C.line}`,
                                        display: 'flex', gap: 20,
                                    }}>
                                        {meterData.building_name && (
                                            <div style={{ fontFamily: MONO, fontSize: 10, color: C.sub }}>
                                                🏢 {meterData.building_name}
                                            </div>
                                        )}
                                        {meterData.room_name && (
                                            <div style={{ fontFamily: MONO, fontSize: 10, color: C.sub }}>
                                                📍 {meterData.room_name}
                                            </div>
                                        )}
                                        {meterData.date_keep && (
                                            <div style={{ fontFamily: MONO, fontSize: 10, color: C.sub, marginLeft: 'auto' }}>
                                                🕐 {new Date(typeof meterData.date_keep === 'string' ? meterData.date_keep.replace(/[Z]$/i, '').replace(/[+-]\d{2}:\d{2}$/, '') : meterData.date_keep).toLocaleString(language === 'th' ? 'th-TH' : 'en-US')}
                                            </div>
                                        )}
                                    </div>

                                    {/* Data Table */}
                                    <div style={{ padding: '0' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 12 }}>
                                            <tbody>
                                                {METER_FIELDS.map((field, i) => {
                                                    const val = meterData[field.key];
                                                    if (val === undefined || val === null) return null;
                                                    const numVal = parseFloat(val);
                                                    return (
                                                        <tr key={field.key} style={{
                                                            borderBottom: `1px solid ${C.line}`,
                                                            background: i % 2 === 0 ? C.panel : C.panel2,
                                                        }}>
                                                            <td style={{
                                                                padding: '8px 18px', fontWeight: 600, color: C.ink,
                                                                width: '45%',
                                                            }}>{t(field.labelTh, field.labelEn)}</td>
                                                            <td style={{
                                                                padding: '8px 18px', textAlign: 'right',
                                                                color: C.ink, fontWeight: 500,
                                                            }}>
                                                                {isNaN(numVal) ? val : numVal.toLocaleString(language === 'th' ? 'th-TH' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                {field.unit && <span style={{ color: C.sub, fontSize: 10, marginLeft: 4 }}>{field.unit}</span>}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            ) : popupPoint.meter_id && meterLoading ? (
                                <div style={{ textAlign: 'center', padding: '40px 20px', fontFamily: MONO, color: C.sub }}>
                                    <div style={{ fontSize: 24, marginBottom: 8, animation: 'pulse-ring 1s ease-out infinite' }}>⏳</div>
                                    {t('กำลังโหลดข้อมูลมิเตอร์...', 'Loading meter data...')}
                                </div>
                            ) : (
                                <div style={{ padding: '30px 20px', textAlign: 'center', fontFamily: MONO }}>
                                    <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📊</div>
                                    <div style={{ fontSize: 13, color: C.ink, fontWeight: 600, marginBottom: 4 }}>
                                        {popupPoint.label}
                                    </div>
                                    <div style={{ fontSize: 11, color: C.sub }}>
                                        {t((POINT_TYPES[popupPoint.point_type] || POINT_TYPES.power).labelTh, (POINT_TYPES[popupPoint.point_type] || POINT_TYPES.power).labelEn)}
                                    </div>
                                    {!popupPoint.meter_id && (
                                        <div style={{ fontSize: 11, color: C.sub, marginTop: 12, padding: '8px 16px', background: C.panel2, borderRadius: 6, border: `1px solid ${C.line}`, display: 'inline-block' }}>
                                            {t('⚠️ ไม่ได้เชื่อมต่อมิเตอร์', '⚠️ Meter not linked')}
                                            <br />
                                            <span style={{ fontSize: 10 }}>{t('ไปที่ ตั้งค่า → แผนผัง → 📌 จุดแผนผัง เพื่อเชื่อมต่อมิเตอร์', 'Go to Settings → Layouts → 📌 Points to link a meter')}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* CSS */}
            <style>{`
                @keyframes pulse-ring {
                    0% { transform: scale(1); opacity: 0.6; }
                    100% { transform: scale(1.8); opacity: 0; }
                }
            `}</style>
        </div>
    );
};

export default LayoutViewPage;
