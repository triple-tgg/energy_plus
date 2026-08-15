import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
    Activity, ShieldAlert, Cpu, Radio, Zap, RefreshCw, AlertTriangle, LayoutGrid, X,
    ChevronDown, Gauge, BatteryCharging, TrendingUp, BarChart2, Check, RotateCcw,
    SlidersHorizontal, Layers, Filter, Sparkles, Clock, Eye, EyeOff
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { realtimeApi } from '../../api/client';
import { LoadingScreen } from '../../components/ui/LoadingScreen';

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, "Cascadia Mono", monospace';

const THEMES = {
    light: {
        bg: '#EAE7DA', panel: '#FBFAF4', panel2: '#F1EFE3', ink: '#23261E', sub: '#6E705F',
        line: '#D4D1C0', bar: '#F1EFE3', barSub: '#8A8C7A', accent: '#2B4C7E',
        red: '#dc2626', yellow: '#C08A1E', green: '#16a34a',
    },
    dark: {
        bg: '#0E1116', panel: '#161B22', panel2: '#1C232E', ink: '#E6EDF3', sub: '#8B98A6',
        line: '#2A313C', bar: '#080A0E', barSub: '#8B98A6', accent: '#36C2CE',
        red: '#f85149', yellow: '#D29922', green: '#34d399',
    },
};

interface RealtimeMeterData {
    // From meter table (enriched by backend)
    meter_id: number;
    meter_code: string;
    meter_name: string;
    room_code: string;
    room_name: string;
    site_id: number;
    building_id: number;
    zone_id: number;
    floor: number;
    loop_id: number;
    meter_status: string;
    is_active: boolean;
    meter_type_id?: number;
    meter_type_name?: string;
    icon_name?: string;
    is_all_zero: boolean;
    site_name: string;
    building_name: string;
    zone_name: string;
    // From meter_data_realtime
    realtime_site_id: number;
    realtime_address_id: number;
    device: string;
    code: string;
    type: string;
    vl1: number; vl2: number; vl3: number;
    vl12: number; vl23: number; vl31: number;
    il1: number; il2: number; il3: number;
    kw1: number; kw2: number; kw3: number; kw_3ph: number;
    kvar1: number; kvar2: number; kvar3: number; kvar_3ph: number;
    kva1: number; kva2: number; kva3: number; kva_3ph: number;
    pf1: number; pf2: number; pf3: number;
    hz: number;
    import_kwhr: number;
    device_datetime: string;
    received_at: string;
}

interface ChartDataPoint {
    time: string;
    [key: string]: any;
}

type ChartMetric = 'kw' | 'voltage' | 'current' | 'pf';

const CHART_METRICS: { key: ChartMetric; labelTh: string; labelEn: string; unit: string }[] = [
    { key: 'kw', labelTh: 'กำลังไฟฟ้าจริง (kW)', labelEn: 'Active Power (kW)', unit: 'kW' },
    { key: 'voltage', labelTh: 'แรงดันไฟฟ้า (V)', labelEn: 'Voltage (V)', unit: 'V' },
    { key: 'current', labelTh: 'กระแสไฟฟ้า (A)', labelEn: 'Current (A)', unit: 'A' },
    { key: 'pf', labelTh: 'ตัวประกอบกำลัง (PF)', labelEn: 'Power Factor', unit: '' },
];

export interface MetricDef {
    key: string;
    labelTh: string;
    labelEn: string;
    unit: string;
    color: string;
    category: 'power' | 'voltage' | 'current' | 'energy' | 'pf' | 'other';
    defaultOn?: boolean;
}

export const METRIC_DEFS: MetricDef[] = [
    // Power (kW)
    { key: 'kw_3ph', labelTh: 'กำลังไฟฟ้ารวม (kW)', labelEn: 'Total Active Power (kW)', unit: 'kW', color: '#F59E0B', category: 'power', defaultOn: true },
    { key: 'kw1', labelTh: 'กำลังไฟฟ้า L1 (kW)', labelEn: 'Power L1 (kW)', unit: 'kW', color: '#FBBF24', category: 'power' },
    { key: 'kw2', labelTh: 'กำลังไฟฟ้า L2 (kW)', labelEn: 'Power L2 (kW)', unit: 'kW', color: '#D97706', category: 'power' },
    { key: 'kw3', labelTh: 'กำลังไฟฟ้า L3 (kW)', labelEn: 'Power L3 (kW)', unit: 'kW', color: '#B45309', category: 'power' },

    // Voltage (V)
    { key: 'avg_voltage', labelTh: 'แรงดันเฉลี่ย L-N (V)', labelEn: 'Avg Voltage L-N (V)', unit: 'V', color: '#3B82F6', category: 'voltage', defaultOn: true },
    { key: 'vl1', labelTh: 'แรงดัน VL1 (V)', labelEn: 'Voltage L1 (V)', unit: 'V', color: '#60A5FA', category: 'voltage' },
    { key: 'vl2', labelTh: 'แรงดัน VL2 (V)', labelEn: 'Voltage L2 (V)', unit: 'V', color: '#93C5FD', category: 'voltage' },
    { key: 'vl3', labelTh: 'แรงดัน VL3 (V)', labelEn: 'Voltage L3 (V)', unit: 'V', color: '#2563EB', category: 'voltage' },
    { key: 'vl12', labelTh: 'แรงดัน VL1-L2 (V)', labelEn: 'Voltage L1-L2 (V)', unit: 'V', color: '#6366F1', category: 'voltage' },
    { key: 'vl23', labelTh: 'แรงดัน VL2-L3 (V)', labelEn: 'Voltage L2-L3 (V)', unit: 'V', color: '#818CF8', category: 'voltage' },
    { key: 'vl31', labelTh: 'แรงดัน VL3-L1 (V)', labelEn: 'Voltage L3-L1 (V)', unit: 'V', color: '#A5B4FC', category: 'voltage' },

    // Current (A)
    { key: 'avg_current', labelTh: 'กระแสเฉลี่ย (A)', labelEn: 'Avg Current (A)', unit: 'A', color: '#EC4899', category: 'current', defaultOn: true },
    { key: 'il1', labelTh: 'กระแส IL1 (A)', labelEn: 'Current L1 (A)', unit: 'A', color: '#F472B6', category: 'current' },
    { key: 'il2', labelTh: 'กระแส IL2 (A)', labelEn: 'Current L2 (A)', unit: 'A', color: '#DB2777', category: 'current' },
    { key: 'il3', labelTh: 'กระแส IL3 (A)', labelEn: 'Current L3 (A)', unit: 'A', color: '#BE185D', category: 'current' },

    // Energy (kWh)
    { key: 'import_kwhr', labelTh: 'พลังงานไฟฟ้ารวม (kWh)', labelEn: 'Total Energy (kWh)', unit: 'kWh', color: '#10B981', category: 'energy' },

    // Power Factor (PF) & Frequency
    { key: 'avg_pf', labelTh: 'ตัวประกอบกำลังเฉลี่ย (PF)', labelEn: 'Avg Power Factor', unit: '', color: '#14B8A6', category: 'pf', defaultOn: true },
    { key: 'pf1', labelTh: 'PF เฟส 1', labelEn: 'PF Phase 1', unit: '', color: '#2DD4BF', category: 'pf' },
    { key: 'pf2', labelTh: 'PF เฟส 2', labelEn: 'PF Phase 2', unit: '', color: '#0D9488', category: 'pf' },
    { key: 'pf3', labelTh: 'PF เฟส 3', labelEn: 'PF Phase 3', unit: '', color: '#115E59', category: 'pf' },
    { key: 'hz', labelTh: 'ความถี่ (Hz)', labelEn: 'Frequency (Hz)', unit: 'Hz', color: '#8B5CF6', category: 'pf' },

    // kVA & kVAR
    { key: 'kva_3ph', labelTh: 'กำลังปรากฏรวม (kVA)', labelEn: 'Total Apparent (kVA)', unit: 'kVA', color: '#06B6D4', category: 'other' },
    { key: 'kva1', labelTh: 'กำลังปรากฏ L1 (kVA)', labelEn: 'Apparent L1 (kVA)', unit: 'kVA', color: '#67E8F9', category: 'other' },
    { key: 'kva2', labelTh: 'กำลังปรากฏ L2 (kVA)', labelEn: 'Apparent L2 (kVA)', unit: 'kVA', color: '#0891B2', category: 'other' },
    { key: 'kva3', labelTh: 'กำลังปรากฏ L3 (kVA)', labelEn: 'Apparent L3 (kVA)', unit: 'kVA', color: '#0E7490', category: 'other' },
    { key: 'kvar_3ph', labelTh: 'รีแอคทีฟรวม (kVAR)', labelEn: 'Total Reactive (kVAR)', unit: 'kVAR', color: '#64748B', category: 'other' },
    { key: 'kvar1', labelTh: 'รีแอคทีฟ L1 (kVAR)', labelEn: 'Reactive L1 (kVAR)', unit: 'kVAR', color: '#94A3B8', category: 'other' },
    { key: 'kvar2', labelTh: 'รีแอคทีฟ L2 (kVAR)', labelEn: 'Reactive L2 (kVAR)', unit: 'kVAR', color: '#475569', category: 'other' },
    { key: 'kvar3', labelTh: 'รีแอคทีฟ L3 (kVAR)', labelEn: 'Reactive L3 (kVAR)', unit: 'kVAR', color: '#334155', category: 'other' },
];

const DETAIL_FIELDS: { key: string; labelTh: string; labelEn: string; unit: string }[] = [
    { key: 'vl1', labelTh: 'แรงดัน L1 (V)', labelEn: 'Voltage L1', unit: 'V' },
    { key: 'vl2', labelTh: 'แรงดัน L2 (V)', labelEn: 'Voltage L2', unit: 'V' },
    { key: 'vl3', labelTh: 'แรงดัน L3 (V)', labelEn: 'Voltage L3', unit: 'V' },
    { key: 'vl12', labelTh: 'แรงดัน L1-L2 (V)', labelEn: 'Voltage L1-L2', unit: 'V' },
    { key: 'vl23', labelTh: 'แรงดัน L2-L3 (V)', labelEn: 'Voltage L2-L3', unit: 'V' },
    { key: 'vl31', labelTh: 'แรงดัน L3-L1 (V)', labelEn: 'Voltage L3-L1', unit: 'V' },
    { key: 'il1', labelTh: 'กระแส L1 (A)', labelEn: 'Current L1', unit: 'A' },
    { key: 'il2', labelTh: 'กระแส L2 (A)', labelEn: 'Current L2', unit: 'A' },
    { key: 'il3', labelTh: 'กระแส L3 (A)', labelEn: 'Current L3', unit: 'A' },
    { key: 'kw1', labelTh: 'กำลังไฟ L1 (kW)', labelEn: 'Power L1', unit: 'kW' },
    { key: 'kw2', labelTh: 'กำลังไฟ L2 (kW)', labelEn: 'Power L2', unit: 'kW' },
    { key: 'kw3', labelTh: 'กำลังไฟ L3 (kW)', labelEn: 'Power L3', unit: 'kW' },
    { key: 'kw_3ph', labelTh: 'กำลังไฟรวม 3 เฟส (kW)', labelEn: 'Total 3-Phase Power', unit: 'kW' },
    { key: 'kva1', labelTh: 'กำลังปรากฏ L1 (kVA)', labelEn: 'Apparent L1', unit: 'kVA' },
    { key: 'kva2', labelTh: 'กำลังปรากฏ L2 (kVA)', labelEn: 'Apparent L2', unit: 'kVA' },
    { key: 'kva3', labelTh: 'กำลังปรากฏ L3 (kVA)', labelEn: 'Apparent L3', unit: 'kVA' },
    { key: 'kva_3ph', labelTh: 'กำลังปรากฏรวม (kVA)', labelEn: 'Total Apparent', unit: 'kVA' },
    { key: 'kvar1', labelTh: 'รีแอคทีฟ L1 (kVAR)', labelEn: 'Reactive L1', unit: 'kVAR' },
    { key: 'kvar2', labelTh: 'รีแอคทีฟ L2 (kVAR)', labelEn: 'Reactive L2', unit: 'kVAR' },
    { key: 'kvar3', labelTh: 'รีแอคทีฟ L3 (kVAR)', labelEn: 'Reactive L3', unit: 'kVAR' },
    { key: 'kvar_3ph', labelTh: 'รีแอคทีฟรวม (kVAR)', labelEn: 'Total Reactive', unit: 'kVAR' },
    { key: 'pf1', labelTh: 'PF L1', labelEn: 'PF L1', unit: '' },
    { key: 'pf2', labelTh: 'PF L2', labelEn: 'PF L2', unit: '' },
    { key: 'pf3', labelTh: 'PF L3', labelEn: 'PF L3', unit: '' },
    { key: 'hz', labelTh: 'ความถี่ (Hz)', labelEn: 'Frequency', unit: 'Hz' },
    { key: 'import_kwhr', labelTh: 'พลังงานสะสม (kWh)', labelEn: 'Accumulated Energy', unit: 'kWh' },
];

const parseNum = (v: any, fallback = 0): number => {
    const n = parseFloat(v);
    return isFinite(n) ? n : fallback;
};

/** Detect meter as "offline" when active but all key measurement values are zero */
const isMeterOffline = (m: RealtimeMeterData): boolean => {
    // Inactive meters are classified as "inactive", not "offline"
    if (m.is_active === false) return false;
    // Backend may provide is_all_zero flag
    if (m.is_all_zero === true) return true;
    // Fallback: check client-side
    return m.vl1 === 0 && m.vl2 === 0 && m.vl3 === 0
        && m.il1 === 0 && m.il2 === 0 && m.il3 === 0
        && m.kw_3ph === 0 && m.kva_3ph === 0
        && m.hz === 0 && m.import_kwhr === 0;
};

/** Format device_datetime from DB — DB stores Bangkok time but PG sends as UTC.
 *  Strip timezone suffix so JS treats it as local time (no double +7 offset). */
const formatDeviceTime = (dt: string | null | undefined, mode: 'time' | 'full' = 'time'): string => {
    if (!dt) return '—';
    try {
        // Strip Z, +00, +07 etc. so JS treats as local time (already Bangkok)
        const stripped = dt.replace(/[Z]$/i, '').replace(/[+-]\d{2}:\d{2}$/, '').replace(/[+-]\d{4}$/, '');
        const d = new Date(stripped);
        if (isNaN(d.getTime())) return '—';
        if (mode === 'full') {
            return d.toLocaleString('th-TH');
        }
        return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return '—'; }
};

const CATEGORY_TABS = [
    { key: 'all', labelTh: 'ทั้งหมด', labelEn: 'All' },
    { key: 'power', labelTh: 'กำลังไฟฟ้า (kW)', labelEn: 'Power (kW)' },
    { key: 'voltage', labelTh: 'แรงดัน (V)', labelEn: 'Voltage (V)' },
    { key: 'current', labelTh: 'กระแส (A)', labelEn: 'Current (A)' },
    { key: 'energy', labelTh: 'พลังงาน (kWh)', labelEn: 'Energy (kWh)' },
    { key: 'pf', labelTh: 'PF & ความถี่', labelEn: 'PF & Frequency' },
    { key: 'other', labelTh: 'kVA & kVAR', labelEn: 'kVA & kVAR' },
];

const TIME_RANGES = [
    { minutes: 360, labelTh: '6 ชม. (24 จุด)', labelEn: '6h (24 pts)' },
    { minutes: 720, labelTh: '12 ชม. (48 จุด)', labelEn: '12h (48 pts)' },
    { minutes: 1440, labelTh: '24 ชม. (96 จุด)', labelEn: '24h (96 pts)' },
    { minutes: 4320, labelTh: '3 วัน', labelEn: '3 Days' },
    { minutes: 10080, labelTh: '7 วัน', labelEn: '7 Days' },
];

interface MeterGraphModalProps {
    meter: RealtimeMeterData;
    onClose: () => void;
    theme: 'light' | 'dark';
    language: 'th' | 'en';
    C: typeof THEMES['light'];
    isOffline: boolean;
}

const MeterGraphModal: React.FC<MeterGraphModalProps> = ({
    meter, onClose, theme, language, C, isOffline
}) => {
    const { t } = useLanguage();
    const [minutes, setMinutes] = useState(1440);
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => {
        const defaults = new Set<string>();
        METRIC_DEFS.filter(m => m.defaultOn).forEach(m => defaults.add(m.key));
        return defaults;
    });
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastSync, setLastSync] = useState<string>('');

    const loadHistory = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);
        try {
            const res = await realtimeApi.getMeterHistory({ meterId: meter.meter_id, minutes });
            if (res.data?.success && Array.isArray(res.data.data)) {
                setHistoryData(res.data.data);
                setLastSync(new Date().toLocaleTimeString(language === 'th' ? 'th-TH' : 'en-US'));
            }
        } catch (err) {
            console.error('Failed to fetch meter history:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [meter.meter_id, minutes, language]);

    useEffect(() => {
        loadHistory();
        const timer = setInterval(() => loadHistory(true), 10000);
        return () => clearInterval(timer);
    }, [loadHistory]);

    const toggleKey = (key: string) => {
        setSelectedKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const selectAllCategory = (cat: string) => {
        setSelectedKeys(prev => {
            const next = new Set(prev);
            const targets = cat === 'all' ? METRIC_DEFS : METRIC_DEFS.filter(m => m.category === cat);
            targets.forEach(m => next.add(m.key));
            return next;
        });
    };

    const clearCategory = (cat: string) => {
        setSelectedKeys(prev => {
            const next = new Set(prev);
            const targets = cat === 'all' ? METRIC_DEFS : METRIC_DEFS.filter(m => m.category === cat);
            targets.forEach(m => next.delete(m.key));
            return next;
        });
    };

    const resetDefaults = () => {
        const defaults = new Set<string>();
        METRIC_DEFS.filter(m => m.defaultOn).forEach(m => defaults.add(m.key));
        setSelectedKeys(defaults);
    };

    const displayedMetricDefs = activeCategory === 'all'
        ? METRIC_DEFS
        : METRIC_DEFS.filter(m => m.category === activeCategory);

    const activeMetricDefs = METRIC_DEFS.filter(m => selectedKeys.has(m.key));

    const locationParts = [meter.building_name, meter.zone_name, meter.floor != null ? `${t('ชั้น', 'Fl.')} ${meter.floor}` : ''].filter(Boolean);

    // Summary calculations
    const latestKwh = meter.import_kwhr;
    const currentKw = meter.kw_3ph;
    const currentPf = (meter.pf1 + meter.pf2 + meter.pf3) / 3;
    const currentAvgV = (meter.vl1 + meter.vl2 + meter.vl3) / 3;
    const currentAvgA = (meter.il1 + meter.il2 + meter.il3) / 3;

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 1300,
                background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
            }}
            onClick={onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8,
                    width: 'min(1180px, 96vw)', maxHeight: '92vh', overflow: 'hidden',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                    display: 'flex', flexDirection: 'column',
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: C.bar, borderBottom: `2px solid ${C.accent}`, flexWrap: 'wrap', gap: 10,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 6,
                            background: `${C.accent}22`, color: C.accent,
                            display: 'grid', placeItems: 'center', border: `1px solid ${C.accent}44`
                        }}>
                            <TrendingUp size={20} />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: C.ink }}>
                                    {meter.meter_name || meter.meter_code}
                                </span>
                                <span style={{ fontFamily: MONO, fontSize: 11, color: C.sub }}>
                                    [{meter.meter_code}]
                                </span>
                                {meter.is_active === false ? (
                                    <span style={{
                                        fontSize: 9.5, fontWeight: 700, fontFamily: MONO, padding: '2px 7px',
                                        background: 'rgba(107,114,128,0.15)', color: '#6B7280', border: '1px solid rgba(107,114,128,0.3)'
                                    }}>⚪ {t('ไม่ใช้งาน', 'INACTIVE')}</span>
                                ) : isOffline ? (
                                    <span style={{
                                        fontSize: 9.5, fontWeight: 700, fontFamily: MONO, padding: '2px 7px',
                                        background: `${C.red}18`, color: C.red, border: `1px solid ${C.red}30`
                                    }}>🔴 {t('ออฟไลน์', 'OFFLINE')}</span>
                                ) : (
                                    <span style={{
                                        fontSize: 9.5, fontWeight: 700, fontFamily: MONO, padding: '2px 7px',
                                        background: `${C.green}18`, color: C.green, border: `1px solid ${C.green}30`
                                    }}>🟢 {t('ออนไลน์', 'ONLINE')}</span>
                                )}
                                <span style={{
                                    fontSize: 9.5, fontWeight: 700, fontFamily: MONO, padding: '2px 7px',
                                    background: `${C.accent}20`, color: C.accent, border: `1px solid ${C.accent}40`
                                }}>
                                    📊 {t('ข้อมูลสรุปทุก 15 นาที', '15-MIN INTERVAL SUMMARY')}
                                </span>
                            </div>
                            <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.barSub, marginTop: 2 }}>
                                {locationParts.length > 0 ? locationParts.join(' › ') : meter.site_name || '—'}
                                {meter.device && ` · ${meter.device}`}
                            </div>
                        </div>
                    </div>

                    {/* Right Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Time Range Pills */}
                        <div style={{ display: 'flex', border: `1px solid ${C.line}`, background: C.panel2, borderRadius: 4, overflow: 'hidden' }}>
                            {TIME_RANGES.map(tr => (
                                <button
                                    key={tr.minutes}
                                    onClick={() => setMinutes(tr.minutes)}
                                    style={{
                                        fontFamily: MONO, fontSize: 11, fontWeight: 600, padding: '5px 10px',
                                        border: 'none', cursor: 'pointer',
                                        background: minutes === tr.minutes ? C.accent : 'transparent',
                                        color: minutes === tr.minutes ? '#fff' : C.sub,
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    {t(tr.labelTh, tr.labelEn)}
                                </button>
                            ))}
                        </div>

                        {/* Refresh Button */}
                        <button
                            onClick={() => loadHistory(false)}
                            title={t('รีเฟรชข้อมูล', 'Refresh Data')}
                            style={{
                                background: C.panel2, border: `1px solid ${C.line}`, color: C.ink,
                                cursor: 'pointer', padding: '6px 10px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4,
                                fontFamily: MONO, fontSize: 11,
                            }}
                        >
                            <RefreshCw size={13} className={refreshing || loading ? 'spin' : ''} />
                            {lastSync && <span style={{ fontSize: 10, color: C.sub }}>{lastSync}</span>}
                        </button>

                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            style={{ background: 'transparent', border: 'none', color: C.ink, cursor: 'pointer', padding: 4, display: 'grid', placeItems: 'center' }}
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Sub-header Controls / Toggles */}
                <div style={{
                    padding: '12px 18px', background: C.panel2, borderBottom: `1px solid ${C.line}`,
                    display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                    {/* Category tabs & action buttons */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        {/* Category filter tabs */}
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {CATEGORY_TABS.map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveCategory(tab.key)}
                                    style={{
                                        fontFamily: MONO, fontSize: 10.5, fontWeight: activeCategory === tab.key ? 700 : 500,
                                        padding: '4px 10px', borderRadius: 3,
                                        background: activeCategory === tab.key ? C.accent : 'transparent',
                                        color: activeCategory === tab.key ? '#fff' : C.ink,
                                        border: `1px solid ${activeCategory === tab.key ? C.accent : C.line}`,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {t(tab.labelTh, tab.labelEn)}
                                </button>
                            ))}
                        </div>

                        {/* Presets & Bulk buttons */}
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button
                                onClick={() => selectAllCategory(activeCategory)}
                                style={{
                                    fontFamily: MONO, fontSize: 10, padding: '3px 8px', borderRadius: 3,
                                    background: C.panel, border: `1px solid ${C.line}`, color: C.ink, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 3
                                }}
                            >
                                <Check size={11} color={C.green} /> {t('เลือกทั้งหมด', 'Select All')}
                            </button>
                            <button
                                onClick={() => clearCategory(activeCategory)}
                                style={{
                                    fontFamily: MONO, fontSize: 10, padding: '3px 8px', borderRadius: 3,
                                    background: C.panel, border: `1px solid ${C.line}`, color: C.ink, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 3
                                }}
                            >
                                <X size={11} color={C.red} /> {t('ปิดทั้งหมด', 'Clear')}
                            </button>
                            <button
                                onClick={resetDefaults}
                                style={{
                                    fontFamily: MONO, fontSize: 10, padding: '3px 8px', borderRadius: 3,
                                    background: C.panel, border: `1px solid ${C.line}`, color: C.sub, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 3
                                }}
                            >
                                <RotateCcw size={11} /> {t('ค่าเริ่มต้น', 'Default')}
                            </button>
                        </div>
                    </div>

                    {/* Chips Grid */}
                    <div style={{
                        display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: '110px', overflowY: 'auto',
                        padding: '2px 0'
                    }}>
                        {displayedMetricDefs.map(mDef => {
                            const isSelected = selectedKeys.has(mDef.key);
                            const rawVal = (meter as any)[mDef.key];
                            const curVal = parseNum(rawVal);
                            const formattedVal = curVal.toLocaleString(undefined, { minimumFractionDigits: mDef.unit === 'V' || mDef.unit === 'Hz' ? 1 : mDef.unit === '' ? 3 : 2, maximumFractionDigits: 3 });

                            return (
                                <button
                                    key={mDef.key}
                                    onClick={() => toggleKey(mDef.key)}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                        padding: '4px 9px', borderRadius: 4,
                                        background: isSelected ? `${mDef.color}15` : C.panel,
                                        border: `1px solid ${isSelected ? mDef.color : C.line}`,
                                        color: isSelected ? C.ink : C.sub,
                                        cursor: 'pointer', fontFamily: MONO, fontSize: 11,
                                        boxShadow: isSelected ? `0 1px 4px ${mDef.color}25` : 'none',
                                        transition: 'all 0.12s ease',
                                    }}
                                >
                                    <span style={{
                                        width: 8, height: 8, borderRadius: '50%', background: mDef.color,
                                        opacity: isSelected ? 1 : 0.4,
                                        boxShadow: isSelected ? `0 0 5px ${mDef.color}` : 'none'
                                    }} />
                                    <span style={{ fontWeight: isSelected ? 700 : 500 }}>
                                        {t(mDef.labelTh, mDef.labelEn)}
                                    </span>
                                    <span style={{
                                        fontSize: 9.5, opacity: 0.75, fontFamily: MONO,
                                        paddingLeft: 2, borderLeft: `1px solid ${C.line}`
                                    }}>
                                        {formattedVal} {mDef.unit}
                                    </span>
                                    {isSelected ? (
                                        <Check size={11} color={mDef.color} style={{ strokeWidth: 3 }} />
                                    ) : (
                                        <span style={{ width: 11 }} />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Main Graph Area */}
                <div style={{ flex: 1, padding: '16px 20px', minHeight: 340, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                    {loading && historyData.length === 0 ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.sub, fontFamily: MONO, gap: 10 }}>
                            <RefreshCw size={20} className="spin" />
                            <span>{t('กำลังโหลดข้อมูลสรุปทุก 15 นาที...', 'Loading 15-minute summary data...')}</span>
                        </div>
                    ) : activeMetricDefs.length === 0 ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: C.sub, fontFamily: MONO, gap: 8 }}>
                            <SlidersHorizontal size={28} color={C.accent} />
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{t('กรุณากดเลือกค่าที่ต้องการแสดงในกราฟด้านบน', 'Please select at least one metric to display in the graph')}</span>
                            <button onClick={resetDefaults} style={{
                                marginTop: 6, padding: '6px 14px', background: C.accent, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: MONO, fontSize: 11
                            }}>{t('เปิดค่าเริ่มต้น (Power / Voltage / Current / PF)', 'Reset to Default Metrics')}</button>
                        </div>
                    ) : (
                        <div style={{ width: '100%', height: 350 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={historyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={C.line} opacity={0.6} />
                                    <XAxis
                                        dataKey={minutes > 1440 ? 'full_time' : 'time'}
                                        stroke={C.sub}
                                        style={{ fontSize: 10, fontFamily: MONO, fontWeight: 600 }}
                                    />
                                    <YAxis
                                        stroke={C.sub}
                                        style={{ fontSize: 10, fontFamily: MONO, fontWeight: 600 }}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: C.panel,
                                            borderColor: C.line,
                                            color: C.ink,
                                            borderRadius: 6,
                                            fontFamily: MONO,
                                            boxShadow: '0 8px 24px rgba(0,0,0,0.25)'
                                        }}
                                        labelStyle={{ fontWeight: 'bold', color: C.ink, marginBottom: 6, borderBottom: `1px solid ${C.line}`, paddingBottom: 4 }}
                                        formatter={(val: any, name: string) => {
                                            const def = METRIC_DEFS.find(d => d.key === name);
                                            const num = typeof val === 'number' ? val.toFixed(2) : val;
                                            return [`${num} ${def?.unit || ''}`, def ? t(def.labelTh, def.labelEn) : name];
                                        }}
                                    />
                                    <Legend
                                        formatter={(value) => {
                                            const def = METRIC_DEFS.find(d => d.key === value);
                                            return <span style={{ fontFamily: MONO, fontSize: 11, color: C.ink, fontWeight: 600 }}>{def ? t(def.labelTh, def.labelEn) : value}</span>;
                                        }}
                                    />
                                    {activeMetricDefs.map(mDef => (
                                        <Line
                                            key={mDef.key}
                                            type="monotone"
                                            dataKey={mDef.key}
                                            stroke={mDef.color}
                                            strokeWidth={2}
                                            dot={false}
                                            activeDot={{ r: 4, stroke: C.panel, strokeWidth: 2 }}
                                            isAnimationActive={false}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* Footer Telemetry Stat Bar */}
                <div style={{
                    padding: '10px 18px', background: C.bar, borderTop: `1px solid ${C.line}`,
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12,
                }}>
                    <div style={{ fontFamily: MONO }}>
                        <div style={{ fontSize: 9.5, color: C.sub, textTransform: 'uppercase' }}>{t('กำลังไฟฟ้าจริง', 'Active Power')}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#F59E0B' }}>{currentKw.toFixed(2)} <span style={{ fontSize: 10, color: C.sub }}>kW</span></div>
                    </div>
                    <div style={{ fontFamily: MONO }}>
                        <div style={{ fontSize: 9.5, color: C.sub, textTransform: 'uppercase' }}>{t('แรงดันเฉลี่ย', 'Avg Voltage')}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#3B82F6' }}>{currentAvgV.toFixed(1)} <span style={{ fontSize: 10, color: C.sub }}>V</span></div>
                    </div>
                    <div style={{ fontFamily: MONO }}>
                        <div style={{ fontSize: 9.5, color: C.sub, textTransform: 'uppercase' }}>{t('กระแสเฉลี่ย', 'Avg Current')}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#EC4899' }}>{currentAvgA.toFixed(2)} <span style={{ fontSize: 10, color: C.sub }}>A</span></div>
                    </div>
                    <div style={{ fontFamily: MONO }}>
                        <div style={{ fontSize: 9.5, color: C.sub, textTransform: 'uppercase' }}>{t('ตัวประกอบกำลัง', 'Power Factor')}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: currentPf > 0.85 ? C.green : C.red }}>{currentPf.toFixed(3)}</div>
                    </div>
                    <div style={{ fontFamily: MONO }}>
                        <div style={{ fontSize: 9.5, color: C.sub, textTransform: 'uppercase' }}>{t('ความถี่', 'Frequency')}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#8B5CF6' }}>{meter.hz.toFixed(2)} <span style={{ fontSize: 10, color: C.sub }}>Hz</span></div>
                    </div>
                    <div style={{ fontFamily: MONO }}>
                        <div style={{ fontSize: 9.5, color: C.sub, textTransform: 'uppercase' }}>{t('พลังงานสะสม', 'Total Energy')}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.green }}>{latestKwh.toLocaleString([], { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span style={{ fontSize: 10, color: C.sub }}>kWh</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const RealtimePage: React.FC = () => {
    const { theme } = useTheme();
    const { t, language } = useLanguage();
    const C = THEMES[theme];

    // State
    const [meters, setMeters] = useState<RealtimeMeterData[]>([]);
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [chartMetric, setChartMetric] = useState<ChartMetric>('kw');
    const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
    const [dbSyncStatus, setDbSyncStatus] = useState<'active' | 'syncing' | 'error'>('syncing');
    const [initialLoading, setInitialLoading] = useState(true);
    const [alerts, setAlerts] = useState<{ id: string; time: string; msg: string; type: 'warning' | 'danger' }[]>([]);
    const [flashingRows, setFlashingRows] = useState<Record<string, boolean>>({});
    const [lastFetchTime, setLastFetchTime] = useState<string>('');
    const [selectedMeter, setSelectedMeter] = useState<RealtimeMeterData | null>(null);
    const [graphMeter, setGraphMeter] = useState<RealtimeMeterData | null>(null);

    // Filters
    const [selectedSiteId, setSelectedSiteId] = useState<number | undefined>(undefined);
    const [selectedBuildingId, setSelectedBuildingId] = useState<number | undefined>(undefined);
    const [siteOptions, setSiteOptions] = useState<{ id: number; nameTh: string; nameEn: string; name: string }[]>([]);
    const [allBuildings, setAllBuildings] = useState<{ id: number; nameTh: string; nameEn: string; name: string; site_id: number }[]>([]);

    // Track previous timestamps for flash detection
    const previousTimestamps = useRef<Record<string, string>>({});

    // Load sites & buildings once on mount
    useEffect(() => {
        (async () => {
            try {
                const { sitesApi } = await import('../../api/client');
                const [sitesRes, buildingsRes] = await Promise.all([
                    sitesApi.getAll({ limit: 100, activeOnly: true }),
                    sitesApi.getAllBuildings({ limit: 200 }),
                ]);
                const sites = sitesRes.data?.data || [];
                setSiteOptions(sites.map((s: any) => ({
                    id: s.site_id,
                    nameTh: s.site_name_th || s.site_name,
                    nameEn: s.site_name_en || s.site_name,
                    name: s.site_name,
                })));
                const buildings = buildingsRes.data?.data || [];
                setAllBuildings(buildings.map((b: any) => ({
                    id: b.building_id,
                    nameTh: b.building_name_th || b.building_name,
                    nameEn: b.building_name_en || b.building_name,
                    name: b.building_name,
                    site_id: b.site_id,
                })));
            } catch (err) {
                console.error('Failed to load sites/buildings for filter:', err);
            }
        })();
    }, []);

    // Building options filtered by selected site
    const buildingOptions = React.useMemo(() => {
        const list = selectedSiteId ? allBuildings.filter(b => b.site_id === selectedSiteId) : allBuildings;
        return list.map(b => ({
            id: b.id,
            name: language === 'en' ? (b.nameEn || b.name) : (b.nameTh || b.name),
        }));
    }, [allBuildings, selectedSiteId, language]);

    // Persisted alarms: same source used by Alarm Report, so alerts survive refreshes.
    const fetchAlerts = useCallback(async () => {
        try {
            const res = await realtimeApi.getAlerts({ siteId: selectedSiteId, buildingId: selectedBuildingId });
            const rows = res.data?.data || [];
            setAlerts(rows.map((row: any) => ({
                id: String(row.id),
                time: new Date(row.occurred_at).toLocaleTimeString(language === 'th' ? 'th-TH' : 'en-US'),
                msg: row.message,
                type: /high|critical|danger/i.test(String(row.alarm_type || '')) ? 'danger' : 'warning',
            })));
        } catch (error) {
            console.error('Failed to load realtime alerts:', error);
        }
    }, [selectedSiteId, selectedBuildingId, language]);

    // Fetch latest meter data
    const fetchLatestData = useCallback(async (isInitial = false) => {
        // Only show "syncing" on initial load to prevent flickering every 5s
        if (isInitial) setDbSyncStatus('syncing');
        try {
            const res = await realtimeApi.getLatest({
                siteId: selectedSiteId,
                buildingId: selectedBuildingId,
            });

            if (res.data?.success && Array.isArray(res.data.data)) {
                const processedMeters: RealtimeMeterData[] = res.data.data.map((m: any) => ({
                    ...m,
                    vl1: parseNum(m.vl1), vl2: parseNum(m.vl2), vl3: parseNum(m.vl3),
                    vl12: parseNum(m.vl12), vl23: parseNum(m.vl23), vl31: parseNum(m.vl31),
                    il1: parseNum(m.il1), il2: parseNum(m.il2), il3: parseNum(m.il3),
                    kw1: parseNum(m.kw1), kw2: parseNum(m.kw2), kw3: parseNum(m.kw3),
                    kw_3ph: parseNum(m.kw_3ph),
                    kvar1: parseNum(m.kvar1), kvar2: parseNum(m.kvar2), kvar3: parseNum(m.kvar3),
                    kvar_3ph: parseNum(m.kvar_3ph),
                    kva1: parseNum(m.kva1), kva2: parseNum(m.kva2), kva3: parseNum(m.kva3),
                    kva_3ph: parseNum(m.kva_3ph),
                    pf1: parseNum(m.pf1), pf2: parseNum(m.pf2), pf3: parseNum(m.pf3),
                    hz: parseNum(m.hz),
                    import_kwhr: parseNum(m.import_kwhr),
                }));

                setMeters(processedMeters);
                setDbSyncStatus('active');
                setInitialLoading(false);
                setLastFetchTime(new Date().toLocaleTimeString());

                // Flash detection
                let hasUpdates = false;
                const newFlashingRows: Record<string, boolean> = {};

                processedMeters.forEach(m => {
                    const prevTime = previousTimestamps.current[m.meter_code];
                    const currTime = m.device_datetime;
                    if (prevTime !== currTime) {
                        previousTimestamps.current[m.meter_code] = currTime;
                        if (!isInitial) {
                            newFlashingRows[m.meter_code] = true;
                            hasUpdates = true;
                        }
                    }
                });

                if (hasUpdates) {
                    setFlashingRows(prev => ({ ...prev, ...newFlashingRows }));
                    setTimeout(() => {
                        const cleared: Record<string, boolean> = {};
                        Object.keys(newFlashingRows).forEach(k => { cleared[k] = false; });
                        setFlashingRows(prev => ({ ...prev, ...cleared }));
                    }, 800);
                }
            }
        } catch (error) {
            console.error('Failed to poll latest realtime data:', error);
            setDbSyncStatus('error');
        }
    }, [selectedSiteId, selectedBuildingId]);

    // Fetch chart history data
    const fetchChartHistory = useCallback(async () => {
        try {
            const res = await realtimeApi.getHistory({
                minutes: 60,
                siteId: selectedSiteId,
                buildingId: selectedBuildingId,
            });

            if (res.data?.success && Array.isArray(res.data.data)) {
                const rows = res.data.data;
                // Group by bucket time
                const bucketMap = new Map<string, ChartDataPoint>();

                rows.forEach((row: any) => {
                    const rawT = String(row.t).replace(/[Z]$/i, '').replace(/[+-]\d{2}:\d{2}$/, '').replace(/[+-]\d{4}$/, '');
                    const time = new Date(rawT).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                    const label = row.meter_name || row.meter_code || `M${row.meter_id}`;

                    if (!bucketMap.has(time)) {
                        bucketMap.set(time, { time });
                    }
                    const point = bucketMap.get(time)!;

                    // Store all metrics per meter
                    point[`${label}_kw`] = parseNum(row.kw_3ph);
                    point[`${label}_voltage`] = parseNum(row.avg_voltage);
                    point[`${label}_current`] = parseNum(row.avg_current);
                    point[`${label}_pf`] = parseNum(row.avg_pf);
                    // Store meter label for chart rendering
                    if (!point._meters) point._meters = new Set<string>();
                    (point._meters as Set<string>).add(label);
                });

                const chartPoints = Array.from(bucketMap.values()).map(pt => {
                    const { _meters, ...rest } = pt;
                    return { ...rest, _meterList: _meters ? Array.from(_meters as Set<string>) : [] };
                });

                setChartData(chartPoints);
            }
        } catch (error) {
            console.error('Failed to fetch chart history:', error);
        }
    }, [selectedSiteId, selectedBuildingId]);

    // Initial fetch + polling
    useEffect(() => {
        // Load meter data first (fast with index), defer chart (heavier query)
        fetchLatestData(true);
        fetchAlerts();
        const chartDelay = setTimeout(() => fetchChartHistory(), 1000);

        const pollLatest = setInterval(() => fetchLatestData(false), 5000);
        const pollChart = setInterval(() => fetchChartHistory(), 30000);
        const pollAlerts = setInterval(fetchAlerts, 10000);

        return () => {
            clearTimeout(chartDelay);
            clearInterval(pollLatest);
            clearInterval(pollChart);
            clearInterval(pollAlerts);
        };
    }, [fetchLatestData, fetchChartHistory, fetchAlerts]);

    // Summary calculations
    const activeMeters = meters.filter(m => m.is_active !== false);
    const inactiveMeters = meters.filter(m => m.is_active === false);
    const totalMeters = meters.length;
    const onlineMeters = activeMeters.filter(m => !isMeterOffline(m));
    const offlineMeters = activeMeters.filter(m => isMeterOffline(m));
    const totalPower = onlineMeters.reduce((sum, m) => sum + (m.kw_3ph || 0), 0);
    const totalEnergy = meters.reduce((sum, m) => sum + (m.import_kwhr || 0), 0);

    // Calculate Average Power Factor across online meters with valid readings
    const pfMeters = onlineMeters.map(m => {
        const vals = [m.pf1, m.pf2, m.pf3].filter(v => v !== null && v !== undefined && v > 0);
        return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    }).filter(pf => pf > 0);
    const avgPowerFactor = pfMeters.length > 0
        ? pfMeters.reduce((sum, pf) => sum + pf, 0) / pfMeters.length
        : 0;

    // Chart colors
    const chartColors = [C.accent, C.green, C.yellow, C.red, '#8b5cf6', '#f97316', '#06b6d4', '#ec4899'];

    // Get unique meter labels from chart data
    const chartMeterLabels = React.useMemo(() => {
        const labels = new Set<string>();
        chartData.forEach(pt => {
            if ((pt as any)._meterList) {
                (pt as any)._meterList.forEach((l: string) => labels.add(l));
            }
        });
        return Array.from(labels);
    }, [chartData]);

    const selectedMetricInfo = CHART_METRICS.find(m => m.key === chartMetric)!;

    if (initialLoading) return <LoadingScreen theme={theme} />;

    return (
        <div style={{ color: C.ink, padding: '10px 0' }}>
            {/* Command bar */}
            <div style={{ background: C.bar, color: C.ink, display: 'flex', alignItems: 'stretch', borderBottom: `2px solid ${C.accent}`, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}><LayoutGrid size={16} /></div>
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>{t('การติดตามข้อมูล // เรียลไทม์', 'MONITORING // REALTIME')}</div>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>
                            {t('แสดงข้อมูลมิเตอร์แบบเรียลไทม์จาก', 'Real-time meter data display from')} <code style={{ color: C.accent, padding: '1px 4px', background: C.barSub + '1a', fontFamily: MONO }}>meter_data_realtime</code>
                        </div>
                    </div>
                </div>

                {/* Site / Building filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', flexWrap: 'wrap' }}>
                    <select
                        value={selectedSiteId || ''}
                        onChange={e => { setSelectedSiteId(e.target.value ? parseInt(e.target.value) : undefined); setSelectedBuildingId(undefined); }}
                        style={{
                            fontFamily: MONO, fontSize: 11, padding: '5px 8px',
                            background: C.panel, color: C.ink, border: `1px solid ${C.line}`,
                            cursor: 'pointer', outline: 'none',
                        }}
                    >
                        <option value="">{t('ทุกสาขา', 'All Sites')}</option>
                        {siteOptions.map(s => (
                            <option key={s.id} value={s.id}>{language === 'en' ? (s.nameEn || s.name) : (s.nameTh || s.name)}</option>
                        ))}
                    </select>

                    <select
                        value={selectedBuildingId || ''}
                        onChange={e => setSelectedBuildingId(e.target.value ? parseInt(e.target.value) : undefined)}
                        style={{
                            fontFamily: MONO, fontSize: 11, padding: '5px 8px',
                            background: C.panel, color: C.ink, border: `1px solid ${C.line}`,
                            cursor: 'pointer', outline: 'none',
                        }}
                    >
                        <option value="">{t('ทุกอาคาร', 'All Buildings')}</option>
                        {buildingOptions.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* 4 Key Electrical KPI Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                marginBottom: '24px'
            }}>
                {/* 1. Total Active Load */}
                <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRadius: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontFamily: MONO, color: C.sub, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('โหลดกำลังไฟฟ้ารวม', 'Total Active Load')}</span>
                        <Zap size={20} style={{ color: C.yellow }} />
                    </div>
                    <h3 style={{ fontSize: '24px', fontWeight: 800, fontFamily: MONO, margin: '10px 0 4px 0', color: C.yellow }}>
                        {totalPower.toLocaleString([], { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW
                    </h3>
                    <span style={{ fontSize: '11px', color: C.sub, fontWeight: 600, fontFamily: MONO }}>
                        {t('ความต้องการกำลังไฟฟ้ารวมเรียลไทม์', 'AGGREGATED REALTIME POWER DEMAND')}
                    </span>
                </div>

                {/* 2. Total Energy */}
                <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRadius: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontFamily: MONO, color: C.sub, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('พลังงานไฟฟ้ารวม', 'Total Energy')}</span>
                        <BatteryCharging size={20} style={{ color: C.green }} />
                    </div>
                    <h3 style={{ fontSize: '24px', fontWeight: 800, fontFamily: MONO, margin: '10px 0 4px 0', color: C.green }}>
                        {totalEnergy.toLocaleString([], { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh
                    </h3>
                    <span style={{ fontSize: '11px', color: C.sub, fontWeight: 600, fontFamily: MONO }}>
                        {t('พลังงานไฟฟ้าสะสมรวมทุกมิเตอร์', 'ACCUMULATED ENERGY ACROSS METERS')}
                    </span>
                </div>

                {/* 3. Average Power Factor */}
                <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRadius: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontFamily: MONO, color: C.sub, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('เพาเวอร์แฟกเตอร์เฉลี่ย (PF)', 'Avg Power Factor')}</span>
                        <Gauge size={20} style={{ color: C.accent }} />
                    </div>
                    <h3 style={{ fontSize: '24px', fontWeight: 800, fontFamily: MONO, margin: '10px 0 4px 0', color: C.ink }}>
                        {avgPowerFactor > 0 ? avgPowerFactor.toFixed(2) : '—'}
                    </h3>
                    <span style={{
                        fontSize: '11px',
                        color: avgPowerFactor >= 0.85 ? C.green : avgPowerFactor > 0 ? C.red : C.sub,
                        fontWeight: 600, fontFamily: MONO
                    }}>
                        {avgPowerFactor >= 0.85
                            ? t('คุณภาพกำลังไฟฟ้าปกติ (≥ 0.85)', 'POWER FACTOR NOMINAL (≥ 0.85)')
                            : avgPowerFactor > 0
                                ? t('ต่ำกว่าเกณฑ์มาตรฐาน (< 0.85)', 'BELOW TARGET (< 0.85)')
                                : t('ไม่มีข้อมูล', 'NO DATA')}
                    </span>
                </div>

                {/* 4. Active Meters */}
                <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRadius: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontFamily: MONO, color: C.sub, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('สถานะมิเตอร์', 'Active Meters')}</span>
                        <Cpu size={20} style={{ color: C.accent }} />
                    </div>
                    <h3 style={{ fontSize: '24px', fontWeight: 800, fontFamily: MONO, margin: '10px 0 4px 0', color: C.ink }}>
                        {onlineMeters.length}<span style={{ fontSize: 14, fontWeight: 600, color: C.sub }}>/{totalMeters}</span>
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '11px', fontFamily: MONO, fontWeight: 600 }}>
                        <span style={{ color: C.green, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, display: 'inline-block' }} />
                            {t('ออนไลน์', 'ONLINE')} {onlineMeters.length}
                        </span>
                        {offlineMeters.length > 0 && (
                            <span style={{ color: C.red, display: 'flex', alignItems: 'center', gap: 3 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.red, display: 'inline-block' }} />
                                {t('ออฟไลน์', 'OFFLINE')} {offlineMeters.length}
                            </span>
                        )}
                        {inactiveMeters.length > 0 && (
                            <span style={{ color: '#6B7280', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6B7280', display: 'inline-block' }} />
                                {t('ไม่ใช้งาน', 'INACTIVE')} {inactiveMeters.length}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Split layout for Chart & Alerts */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '3fr 1.2fr',
                gap: '20px',
                marginBottom: '24px',
                alignItems: 'stretch'
            }}>
                {/* Real-time Chart */}
                <div style={{
                    background: C.panel,
                    border: `1px solid ${C.line}`,
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    borderRadius: 0
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: 8 }}>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, fontFamily: MONO, color: C.ink, display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase' }}>
                            <Activity size={16} style={{ color: C.accent }} />
                            {t(selectedMetricInfo.labelTh, selectedMetricInfo.labelEn)}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <select
                                value={chartMetric}
                                onChange={e => setChartMetric(e.target.value as ChartMetric)}
                                style={{
                                    fontFamily: MONO, fontSize: 10, padding: '4px 8px',
                                    background: C.panel2, color: C.ink, border: `1px solid ${C.line}`,
                                    cursor: 'pointer', outline: 'none', fontWeight: 600,
                                }}
                            >
                                {CHART_METRICS.map(m => (
                                    <option key={m.key} value={m.key}>{t(m.labelTh, m.labelEn)}</option>
                                ))}
                            </select>
                            <span style={{ fontSize: '10px', fontFamily: MONO, color: C.sub, fontWeight: 600 }}>{t('ข้อมูล 60 นาที', '60-MIN DATA')}</span>
                        </div>
                    </div>

                    <div style={{ width: '100%', height: 300 }}>
                        {chartData.length > 0 && chartMeterLabels.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                    <defs>
                                        {chartMeterLabels.map((label, idx) => (
                                            <linearGradient key={label} id={`color-rt-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={chartColors[idx % chartColors.length]} stopOpacity={0.15} />
                                                <stop offset="95%" stopColor={chartColors[idx % chartColors.length]} stopOpacity={0} />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                                    <XAxis dataKey="time" stroke={C.sub} style={{ fontSize: 9, fontFamily: MONO, fontWeight: 600 }} />
                                    <YAxis stroke={C.sub} style={{ fontSize: 9, fontFamily: MONO, fontWeight: 600 }} unit={selectedMetricInfo.unit ? ` ${selectedMetricInfo.unit}` : ''} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: C.panel, borderColor: C.line, color: C.ink, borderRadius: 0, fontFamily: MONO }}
                                        itemStyle={{ fontSize: 11, fontWeight: 600 }}
                                        labelStyle={{ fontSize: 11, fontWeight: 'bold', color: C.sub, marginBottom: 4 }}
                                        formatter={(value: any) => typeof value === 'number' ? value.toFixed(2) : value}
                                    />
                                    <Legend
                                        content={() => (
                                            <div style={{
                                                display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
                                                gap: '6px 14px', paddingTop: 14, paddingBottom: 4,
                                            }}>
                                                {chartMeterLabels.map((label, idx) => {
                                                    const color = chartColors[idx % chartColors.length];
                                                    const isHidden = hiddenSeries.has(label);
                                                    return (
                                                        <div
                                                            key={label}
                                                            onClick={() => {
                                                                setHiddenSeries(prev => {
                                                                    const next = new Set(prev);
                                                                    if (next.has(label)) next.delete(label);
                                                                    else next.add(label);
                                                                    return next;
                                                                });
                                                            }}
                                                            style={{
                                                                display: 'flex', alignItems: 'center', gap: 5,
                                                                cursor: 'pointer', userSelect: 'none',
                                                                opacity: isHidden ? 0.35 : 1,
                                                                transition: 'opacity 0.2s',
                                                            }}
                                                        >
                                                            <span style={{
                                                                width: 10, height: 10, borderRadius: '50%',
                                                                background: isHidden ? C.sub : color,
                                                                border: isHidden ? `2px solid ${C.sub}` : `2px solid ${color}`,
                                                                display: 'inline-block',
                                                                transition: 'all 0.2s',
                                                            }} />
                                                            <span style={{
                                                                fontFamily: MONO, fontSize: 10, fontWeight: 600,
                                                                color: isHidden ? C.sub : C.ink,
                                                                textDecoration: isHidden ? 'line-through' : 'none',
                                                                transition: 'all 0.2s',
                                                            }}>{label}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    />
                                    {chartMeterLabels.map((label, idx) => (
                                        <Area
                                            key={label}
                                            type="monotone"
                                            dataKey={`${label}_${chartMetric}`}
                                            name={label}
                                            stroke={chartColors[idx % chartColors.length]}
                                            fillOpacity={1}
                                            fill={`url(#color-rt-${idx})`}
                                            strokeWidth={2}
                                            dot={false}
                                            activeDot={{ r: 4 }}
                                            hide={hiddenSeries.has(label)}
                                        />
                                    ))}
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontFamily: MONO, color: C.sub }}>
                                {t('กำลังโหลดข้อมูลกราฟ...', 'LOADING WAVEFORM DATA...')}
                            </div>
                        )}
                    </div>
                </div>

                {/* Alerts panel */}
                <div style={{
                    background: C.panel,
                    border: `1px solid ${C.line}`,
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '380px',
                    overflow: 'hidden',
                    borderRadius: 0
                }}>
                    <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700, fontFamily: MONO, color: C.ink, display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase' }}>
                        <ShieldAlert size={16} style={{ color: C.red }} />
                        {t('การแจ้งเตือนเรียลไทม์', 'Realtime Alerts')}
                    </h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
                        {alerts.length > 0 ? (
                            alerts.map(al => {
                                const alertColor = al.type === 'danger' ? C.red : C.yellow;
                                const alertBg = al.type === 'danger'
                                    ? (theme === 'light' ? '#fef2f2' : '#2d1a1e')
                                    : (theme === 'light' ? '#fffbeb' : '#2d241a');
                                return (
                                    <div key={al.id} style={{
                                        borderLeft: `4px solid ${alertColor}`,
                                        background: alertBg,
                                        padding: '10px 12px',
                                        borderRadius: 0,
                                        fontSize: '12px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: C.sub, fontSize: '9px', fontFamily: MONO, marginBottom: '4px' }}>
                                            <span style={{ fontWeight: 700, color: alertColor }}>
                                                {al.type === 'danger' ? t('อันตราย', 'DANGER') : t('เตือนภัย', 'WARNING')}
                                            </span>
                                            <span style={{ fontWeight: 600 }}>{al.time}</span>
                                        </div>
                                        <div style={{ color: C.ink, lineHeight: 1.4, fontWeight: 600 }}>{al.msg}</div>
                                    </div>
                                );
                            })
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.sub, gap: '8px', paddingTop: '40px' }}>
                                <AlertTriangle size={24} style={{ color: C.line }} />
                                <span style={{ fontWeight: 600, fontFamily: MONO, fontSize: 11 }}>{t('ระบบทำงานปกติ', 'SYSTEM HEALTH OK')}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Real-time Table */}
            <div style={{
                background: C.panel,
                border: `1px solid ${C.line}`,
                borderRadius: 0,
                padding: '20px',
                overflow: 'hidden'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, fontFamily: MONO, color: C.ink, display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase' }}>
                        <Cpu size={16} style={{ color: C.accent }} />
                        {t('การตรวจวิเคราะห์มิเตอร์แบบเรียลไทม์', 'METER CHANNELS REALTIME DIAGNOSTICS')}
                    </h4>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', fontFamily: MONO }}>
                        <thead>
                            <tr style={{ borderBottom: `2px solid ${C.line}`, color: C.sub, fontWeight: 700 }}>
                                <th style={{ padding: '12px 8px', fontSize: '11px', letterSpacing: '0.5px', textAlign: 'center' }}>{t('กราฟ', 'Chart')}</th>
                                <th style={{ padding: '12px 8px', fontSize: '11px', letterSpacing: '0.5px' }}>{t('สถานะ', 'Status')}</th>
                                <th style={{ padding: '12px 8px', fontSize: '11px', letterSpacing: '0.5px' }}>{t('รหัส', 'Code')}</th>
                                <th style={{ padding: '12px 8px', fontSize: '11px', letterSpacing: '0.5px' }}>{t('ชื่อมิเตอร์', 'Meter Name')}</th>
                                <th style={{ padding: '12px 8px', fontSize: '11px', letterSpacing: '0.5px' }}>{t('สถานที่', 'Location')}</th>
                                <th style={{ padding: '12px 8px', fontSize: '11px', letterSpacing: '0.5px' }}>{t('แรงดันไฟฟ้า (V)', 'Voltage (V)')}</th>
                                <th style={{ padding: '12px 8px', fontSize: '11px', letterSpacing: '0.5px' }}>{t('กระแสไฟฟ้า (A)', 'Current (A)')}</th>
                                <th style={{ padding: '12px 8px', fontSize: '11px', letterSpacing: '0.5px' }}>{t('กำลังไฟฟ้าจริง (kW)', 'Active Power (kW)')}</th>
                                <th style={{ padding: '12px 8px', fontSize: '11px', letterSpacing: '0.5px' }}>{t('กำลังไฟฟ้าปรากฏ (kVA)', 'Apparent Power (kVA)')}</th>
                                <th style={{ padding: '12px 8px', fontSize: '11px', letterSpacing: '0.5px' }}>{t('ตัวประกอบกำลัง (PF)', 'Power Factor')}</th>
                                <th style={{ padding: '12px 8px', fontSize: '11px', letterSpacing: '0.5px' }}>{t('ความถี่ (Hz)', 'Frequency (Hz)')}</th>
                                <th style={{ padding: '12px 8px', fontSize: '11px', letterSpacing: '0.5px' }}>{t('พลังงานไฟฟ้ารวม (kWh)', 'Total Energy (kWh)')}</th>
                                <th style={{ padding: '12px 8px', fontSize: '11px', letterSpacing: '0.5px' }}>{t('เวลาอัปเดตล่าสุด', 'Update Time')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {meters.length > 0 ? (
                                meters.map(m => {
                                    const avgPf = (m.pf1 + m.pf2 + m.pf3) / 3;
                                    const isFlashing = flashingRows[m.meter_code];
                                    const locationParts = [m.building_name, m.zone_name].filter(Boolean);
                                    const offline = isMeterOffline(m);

                                    return (
                                        <tr key={m.meter_code}
                                            onClick={() => setSelectedMeter(m)}
                                            style={{
                                                borderBottom: `1px solid ${C.line}`,
                                                backgroundColor: isFlashing
                                                    ? (theme === 'light' ? 'rgba(43,76,126,0.12)' : 'rgba(54,194,206,0.12)')
                                                    : offline
                                                        ? (theme === 'light' ? 'rgba(239,68,68,0.04)' : 'rgba(248,81,73,0.06)')
                                                        : 'transparent',
                                                transition: isFlashing ? 'none' : 'background-color 0.8s ease',
                                                color: offline ? C.sub : C.ink,
                                                fontWeight: 500,
                                                cursor: 'pointer',
                                                opacity: offline ? 0.7 : 1,
                                            }}
                                            onMouseEnter={e => { if (!isFlashing) e.currentTarget.style.backgroundColor = theme === 'light' ? '#f0efe5' : '#1f2937'; }}
                                            onMouseLeave={e => { if (!isFlashing) e.currentTarget.style.backgroundColor = offline ? (theme === 'light' ? 'rgba(239,68,68,0.04)' : 'rgba(248,81,73,0.06)') : 'transparent'; }}
                                        >
                                            <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setGraphMeter(m);
                                                    }}
                                                    title={t('ดูกราฟการวิเคราะห์แบบเรียลไทม์ (ทุกค่า)', 'View Realtime Diagnostics Graph (All Parameters)')}
                                                    style={{
                                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                        width: 30, height: 30, borderRadius: 4,
                                                        background: theme === 'light' ? 'rgba(43,76,126,0.1)' : 'rgba(54,194,206,0.15)',
                                                        color: C.accent,
                                                        border: `1px solid ${C.accent}40`,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease',
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = C.accent;
                                                        e.currentTarget.style.color = '#fff';
                                                        e.currentTarget.style.transform = 'scale(1.1)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = theme === 'light' ? 'rgba(43,76,126,0.1)' : 'rgba(54,194,206,0.15)';
                                                        e.currentTarget.style.color = C.accent;
                                                        e.currentTarget.style.transform = 'scale(1)';
                                                    }}
                                                >
                                                    <TrendingUp size={15} />
                                                </button>
                                            </td>
                                            <td style={{ padding: '14px 8px', textAlign: 'center' }}>
                                                {m.is_active === false ? (
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                                        padding: '2px 8px', fontSize: 10, fontWeight: 700, fontFamily: MONO,
                                                        background: 'rgba(107, 114, 128, 0.15)',
                                                        color: '#6B7280',
                                                        border: '1px solid rgba(107, 114, 128, 0.3)',
                                                    }}>
                                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6B7280', display: 'inline-block' }} />
                                                        {t('ไม่ใช้งาน', 'INACTIVE')}
                                                    </span>
                                                ) : (
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                                        padding: '2px 8px', fontSize: 10, fontWeight: 700, fontFamily: MONO,
                                                        background: offline ? C.red + '18' : C.green + '18',
                                                        color: offline ? C.red : C.green,
                                                        border: `1px solid ${offline ? C.red : C.green}30`,
                                                    }}>
                                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: offline ? C.red : C.green, display: 'inline-block', boxShadow: offline ? 'none' : `0 0 6px ${C.green}` }} />
                                                        {offline ? t('ออฟไลน์', 'OFFLINE') : t('ออนไลน์', 'ONLINE')}
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '14px 8px', fontWeight: 700 }}>{m.meter_code}</td>
                                            <td style={{ padding: '14px 8px', color: offline ? C.sub : C.accent, fontWeight: 700 }}>{m.meter_name || m.room_code || `M${m.meter_id}`}</td>
                                            <td style={{ padding: '14px 8px', fontSize: '11px', color: C.sub }}>
                                                {locationParts.length > 0 ? locationParts.join(' › ') : '—'}
                                            </td>
                                            <td style={{ padding: '14px 8px' }}>
                                                <span style={{ fontWeight: 700 }}>
                                                    {m.vl1.toFixed(1)} / {m.vl2.toFixed(1)} / {m.vl3.toFixed(1)}
                                                </span>
                                            </td>
                                            <td style={{ padding: '14px 8px' }}>
                                                <span style={{ fontWeight: 700 }}>
                                                    {m.il1.toFixed(2)} / {m.il2.toFixed(2)} / {m.il3.toFixed(2)}
                                                </span>
                                            </td>
                                            <td style={{ padding: '14px 8px', fontWeight: 700, color: C.yellow }}>
                                                {m.kw_3ph.toFixed(2)} kW
                                            </td>
                                            <td style={{ padding: '14px 8px', fontWeight: 600 }}>{m.kva_3ph.toFixed(2)} kVA</td>
                                            <td style={{ padding: '14px 8px', color: avgPf > 0.85 ? C.green : C.red, fontWeight: 700 }}>
                                                {avgPf.toFixed(3)}
                                            </td>
                                            <td style={{ padding: '14px 8px', fontWeight: 600 }}>{m.hz.toFixed(2)} Hz</td>
                                            <td style={{ padding: '14px 8px', fontWeight: 700, color: C.green }}>
                                                {m.import_kwhr.toLocaleString([], { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                            </td>
                                            <td style={{ padding: '14px 8px', color: C.sub, fontSize: '12px', fontWeight: 600 }}>
                                                {formatDeviceTime(m.device_datetime)}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={12} style={{ textAlign: 'center', padding: '30px', color: C.sub }}>
                                        {t('ไม่พบข้อมูลการลงทะเบียนมิเตอร์', 'NO METER REGISTRIES FOUND')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Meter Detail Popup */}
            {selectedMeter && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 1200,
                        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    onClick={() => setSelectedMeter(null)}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8,
                            width: 560, maxHeight: '85vh', overflow: 'hidden',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
                            display: 'flex', flexDirection: 'column',
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            background: C.bar, borderBottom: `2px solid ${C.accent}`,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Zap size={20} style={{ color: C.accent }} />
                                <div>
                                    <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: C.ink, letterSpacing: '0.5px' }}>
                                        {selectedMeter.meter_name || selectedMeter.meter_code}
                                    </div>
                                    <div style={{ fontFamily: MONO, fontSize: 10, color: C.barSub }}>
                                        [{selectedMeter.meter_code}] {selectedMeter.room_code || ''}
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setSelectedMeter(null)}
                                style={{ background: 'transparent', border: 'none', color: C.ink, cursor: 'pointer', padding: 4, display: 'grid', placeItems: 'center' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Location info */}
                        <div style={{
                            padding: '8px 18px', background: C.panel2,
                            borderBottom: `1px solid ${C.line}`,
                            display: 'flex', gap: 16, flexWrap: 'wrap',
                        }}>
                            {selectedMeter.site_name && (
                                <div style={{ fontFamily: MONO, fontSize: 10, color: C.sub }}>
                                    🏢 {selectedMeter.site_name}
                                </div>
                            )}
                            {selectedMeter.building_name && (
                                <div style={{ fontFamily: MONO, fontSize: 10, color: C.sub }}>
                                    🏗️ {selectedMeter.building_name}
                                </div>
                            )}
                            {selectedMeter.zone_name && (
                                <div style={{ fontFamily: MONO, fontSize: 10, color: C.sub }}>
                                    📍 {selectedMeter.zone_name}
                                </div>
                            )}
                            {selectedMeter.floor != null && (
                                <div style={{ fontFamily: MONO, fontSize: 10, color: C.sub }}>
                                    🏢 {t('ชั้น', 'Floor')} {selectedMeter.floor}
                                </div>
                            )}
                            <div style={{ fontFamily: MONO, fontSize: 10, color: C.sub, marginLeft: 'auto' }}>
                                🕐 {formatDeviceTime(selectedMeter.device_datetime, 'full')}
                            </div>
                        </div>

                        {/* Data Table */}
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 12 }}>
                                <tbody>
                                    {DETAIL_FIELDS.map((field, i) => {
                                        const val = (selectedMeter as any)[field.key];
                                        const numVal = parseNum(val);
                                        return (
                                            <tr key={field.key} style={{
                                                borderBottom: `1px solid ${C.line}`,
                                                background: i % 2 === 0 ? C.panel : C.panel2,
                                            }}>
                                                <td style={{
                                                    padding: '8px 18px', fontWeight: 600, color: C.ink,
                                                    width: '50%',
                                                }}>{t(field.labelTh, field.labelEn)}</td>
                                                <td style={{
                                                    padding: '8px 18px', textAlign: 'right',
                                                    color: C.ink, fontWeight: 500,
                                                }}>
                                                    {numVal.toLocaleString(language === 'th' ? 'th-TH' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    {field.unit && <span style={{ color: C.sub, fontSize: 10, marginLeft: 4 }}>{field.unit}</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Realtime Graph Modal */}
            {graphMeter && (
                <MeterGraphModal
                    meter={graphMeter}
                    onClose={() => setGraphMeter(null)}
                    theme={theme}
                    language={language}
                    C={C}
                    isOffline={isMeterOffline(graphMeter)}
                />
            )}

            {/* Injected css for animations */}
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: .4; transform: scale(1.05); }
                }
                .spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}} />
        </div>
    );
};

export default RealtimePage;
