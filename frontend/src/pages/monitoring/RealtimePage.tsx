import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
    Activity, ShieldAlert, Cpu, Radio, Zap, RefreshCw, AlertTriangle, LayoutGrid, X,
    ChevronDown, Gauge, BatteryCharging, TrendingUp, BarChart2, Check, RotateCcw,
    SlidersHorizontal, Layers, Filter, Sparkles, Clock, Eye, EyeOff, Search
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

export type RealtimeStatus = 'online' | 'zero' | 'offline' | 'inactive';
const REALTIME_STALE_MS = 120000;

/** Calculate 4 standardized statuses: Online, No Reading, No Signal (offline), Inactive */
export const getMeterRealtimeStatus = (m: RealtimeMeterData, now = Date.now()): RealtimeStatus => {
    if (m.is_active === false || m.meter_status === 'disabled') return 'inactive';

    const receivedAt = m.received_at ? new Date(m.received_at).getTime() : 0;
    const deviceTime = m.device_datetime ? new Date(m.device_datetime.replace(/[Z]$/i, '').replace(/[+-]\d{2}:\d{2}$/, '')).getTime() : 0;
    const latestTime = Math.max(receivedAt, deviceTime);

    if (latestTime === 0 || (now - latestTime > REALTIME_STALE_MS)) {
        return 'offline'; // No Signal
    }

    const isZero = m.is_all_zero === true || (
        m.vl1 === 0 && m.vl2 === 0 && m.vl3 === 0
        && m.il1 === 0 && m.il2 === 0 && m.il3 === 0
        && m.kw_3ph === 0 && m.kva_3ph === 0
        && m.hz === 0 && m.import_kwhr === 0
    );

    if (isZero) return 'zero'; // No Reading

    return 'online'; // Online
};

export const getRealtimeStatusInfo = (status: RealtimeStatus | string) => {
    switch (status) {
        case 'offline':
            return { color: '#EF4444', labelTh: 'ไม่มีสัญญาณ', labelEn: 'No Signal', badgeBg: 'rgba(239, 68, 68, 0.12)', badgeBorder: 'rgba(239, 68, 68, 0.3)' };
        case 'zero':
            return { color: '#F59E0B', labelTh: 'ไม่มีค่าอ่าน', labelEn: 'No Reading', badgeBg: 'rgba(245, 158, 11, 0.12)', badgeBorder: 'rgba(245, 158, 11, 0.3)' };
        case 'inactive':
            return { color: '#6B7280', labelTh: 'ไม่ใช้งาน', labelEn: 'Inactive', badgeBg: 'rgba(107, 114, 128, 0.15)', badgeBorder: 'rgba(107, 114, 128, 0.3)' };
        case 'online':
        default:
            return { color: '#10B981', labelTh: 'ออนไลน์', labelEn: 'Online', badgeBg: 'rgba(16, 185, 129, 0.12)', badgeBorder: 'rgba(16, 185, 129, 0.3)' };
    }
};

/** Format device_datetime from DB — DB stores Bangkok time but PG sends as UTC.
 *  Strip timezone suffix so JS treats it as local time (no double +7 offset). */
const formatDeviceTime = (dt: string | null | undefined, mode: 'time' | 'full' | 'auto' = 'auto'): string => {
    if (!dt) return '—';
    try {
        // Strip Z, +00, +07 etc. so JS treats as local time (already Bangkok)
        const stripped = dt.replace(/[Z]$/i, '').replace(/[+-]\d{2}:\d{2}$/, '').replace(/[+-]\d{4}$/, '');
        const d = new Date(stripped);
        if (isNaN(d.getTime())) return '—';
        if (mode === 'full') {
            return d.toLocaleString('th-TH');
        }
        if (mode === 'time') {
            return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
        // 'auto': If date is today, show HH:mm:ss. If older, show DD/MM HH:mm:ss
        const now = new Date();
        const isSameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
        if (isSameDay) {
            return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return `${day}/${month} ${time}`;
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
    status: RealtimeStatus;
}

const MeterGraphModal: React.FC<MeterGraphModalProps> = ({
    meter, onClose, theme, language, C, status
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
                                {(() => {
                                    const st = getRealtimeStatusInfo(status);
                                    return (
                                        <span style={{
                                            fontSize: 9.5, fontWeight: 700, fontFamily: MONO, padding: '2px 7px',
                                            background: st.badgeBg, color: st.color, border: `1px solid ${st.badgeBorder}`,
                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                        }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.color, display: 'inline-block' }} />
                                            {t(st.labelTh, st.labelEn).toUpperCase()}
                                        </span>
                                    );
                                })()}
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
    const [selectedFloor, setSelectedFloor] = useState<string | undefined>(undefined);
    const [selectedZoneId, setSelectedZoneId] = useState<number | undefined>(undefined);
    const [siteOptions, setSiteOptions] = useState<{ id: number; nameTh: string; nameEn: string; name: string }[]>([]);
    const [allBuildings, setAllBuildings] = useState<{ id: number; nameTh: string; nameEn: string; name: string; site_id: number }[]>([]);
    const [allZones, setAllZones] = useState<{ id: number; nameTh: string; nameEn: string; name: string; building_id: number }[]>([]);

    // Table specific filters (Status & Search)
    const [tableStatusFilter, setTableStatusFilter] = useState<'all' | RealtimeStatus>('all');
    const [tableSearchQuery, setTableSearchQuery] = useState<string>('');

    // Track previous timestamps for flash detection
    const previousTimestamps = useRef<Record<string, string>>({});

    // Load sites, buildings & zones once on mount
    useEffect(() => {
        (async () => {
            try {
                const { sitesApi } = await import('../../api/client');
                const [sitesRes, buildingsRes, zonesRes] = await Promise.all([
                    sitesApi.getAll({ limit: 100, activeOnly: true }),
                    sitesApi.getAllBuildings({ limit: 200 }),
                    sitesApi.getZones({ limit: 500 }),
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
                const zones = zonesRes.data?.data || [];
                setAllZones(zones.map((z: any) => ({
                    id: z.zone_id,
                    nameTh: z.zone_name_th || z.zone_name,
                    nameEn: z.zone_name_en || z.zone_name,
                    name: z.zone_name,
                    building_id: z.building_id,
                })));
            } catch (err) {
                console.error('Failed to load sites/buildings/zones for filter:', err);
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

    // Floor options extracted from meters & filtered by building
    const floorOptions = React.useMemo(() => {
        const floors = new Set<string>();
        meters.forEach(m => {
            if (m.floor !== null && m.floor !== undefined && String(m.floor).trim() !== '') {
                if (!selectedBuildingId || m.building_id === selectedBuildingId) {
                    floors.add(String(m.floor));
                }
            }
        });
        return Array.from(floors).sort((a, b) => {
            const na = parseFloat(a);
            const nb = parseFloat(b);
            if (!isNaN(na) && !isNaN(nb)) return na - nb;
            return a.localeCompare(b);
        });
    }, [meters, selectedBuildingId]);

    // Zone options filtered by selected building
    const zoneOptions = React.useMemo(() => {
        const list = selectedBuildingId ? allZones.filter(z => z.building_id === selectedBuildingId) : allZones;
        return list.map(z => ({
            id: z.id,
            name: language === 'en' ? (z.nameEn || z.name) : (z.nameTh || z.name),
        }));
    }, [allZones, selectedBuildingId, language]);

    // Persisted alarms: same source used by Alarm Report, so alerts survive refreshes.
    const fetchAlerts = useCallback(async () => {
        try {
            const res = await realtimeApi.getAlerts({
                siteId: selectedSiteId,
                buildingId: selectedBuildingId,
                floor: selectedFloor,
                zoneId: selectedZoneId,
            });
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
    }, [selectedSiteId, selectedBuildingId, selectedFloor, selectedZoneId, language]);

    // Fetch latest meter data
    const fetchLatestData = useCallback(async (isInitial = false) => {
        // Only show "syncing" on initial load to prevent flickering every 5s
        if (isInitial) setDbSyncStatus('syncing');
        try {
            const res = await realtimeApi.getLatest({
                siteId: selectedSiteId,
                buildingId: selectedBuildingId,
                floor: selectedFloor,
                zoneId: selectedZoneId,
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
    }, [selectedSiteId, selectedBuildingId, selectedFloor, selectedZoneId]);

    // Fetch chart history data
    const fetchChartHistory = useCallback(async () => {
        try {
            const res = await realtimeApi.getHistory({
                minutes: 60,
                siteId: selectedSiteId,
                buildingId: selectedBuildingId,
                floor: selectedFloor,
                zoneId: selectedZoneId,
            });

            if (res.data?.success && Array.isArray(res.data.data)) {
                const rows = res.data.data;
                // Group by bucket time
                const bucketMap = new Map<string, ChartDataPoint>();

                rows.forEach((row: any) => {
                    const time = row.time || (row.t ? new Date(String(row.t).replace(/[Z]$/i, '')).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '—');
                    const label = row.meter_name || row.meter_code || `M${row.meter_id}`;

                    if (!bucketMap.has(time)) {
                        bucketMap.set(time, { time });
                    }
                    const point = bucketMap.get(time)!;

                    const vl1 = parseNum(row.vl1);
                    const vl2 = parseNum(row.vl2);
                    const vl3 = parseNum(row.vl3);
                    const is3PhaseVoltage = (vl2 > 0 || vl3 > 0);

                    const il1 = parseNum(row.il1);
                    const il2 = parseNum(row.il2);
                    const il3 = parseNum(row.il3);
                    const is3PhaseCurrent = (il2 > 0 || il3 > 0);

                    const pf1 = parseNum(row.pf1);
                    const pf2 = parseNum(row.pf2);
                    const pf3 = parseNum(row.pf3);
                    const is3PhasePf = (pf2 > 0 || pf3 > 0);

                    // Active power (kW)
                    point[`${label}_kw`] = parseNum(row.kw_3ph);

                    // Voltage (V): If 3-phase, render 3 separate phase lines. If 1-phase, render actual single-phase voltage without dividing by 3
                    if (is3PhaseVoltage) {
                        point[`${label} (L1)_voltage`] = vl1;
                        point[`${label} (L2)_voltage`] = vl2;
                        point[`${label} (L3)_voltage`] = vl3;
                    } else {
                        point[`${label}_voltage`] = vl1 > 0 ? vl1 : parseNum(row.avg_voltage);
                    }

                    // Current (A): If 3-phase, render 3 separate phase lines. If 1-phase, render actual current
                    if (is3PhaseCurrent) {
                        point[`${label} (L1)_current`] = il1;
                        point[`${label} (L2)_current`] = il2;
                        point[`${label} (L3)_current`] = il3;
                    } else {
                        point[`${label}_current`] = il1 > 0 ? il1 : parseNum(row.avg_current);
                    }

                    // Power Factor: If 3-phase, render 3 separate phase lines. If 1-phase, render actual PF
                    if (is3PhasePf) {
                        point[`${label} (L1)_pf`] = pf1;
                        point[`${label} (L2)_pf`] = pf2;
                        point[`${label} (L3)_pf`] = pf3;
                    } else {
                        point[`${label}_pf`] = pf1 > 0 ? pf1 : parseNum(row.avg_pf);
                    }
                });

                setChartData(Array.from(bucketMap.values()));
            }
        } catch (error) {
            console.error('Failed to fetch chart history:', error);
        }
    }, [selectedSiteId, selectedBuildingId, selectedFloor, selectedZoneId]);

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
    const now = Date.now();
    const totalMeters = meters.length;
    const onlineMeters = meters.filter(m => getMeterRealtimeStatus(m, now) === 'online');
    const zeroMeters = meters.filter(m => getMeterRealtimeStatus(m, now) === 'zero');
    const noSignalMeters = meters.filter(m => getMeterRealtimeStatus(m, now) === 'offline');
    const inactiveMeters = meters.filter(m => getMeterRealtimeStatus(m, now) === 'inactive');

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

    // Filter meters for diagnostics table based on tableStatusFilter & tableSearchQuery
    const displayedTableMeters = React.useMemo(() => {
        return meters.filter(m => {
            if (tableStatusFilter !== 'all') {
                const st = getMeterRealtimeStatus(m, now);
                if (st !== tableStatusFilter) return false;
            }
            if (tableSearchQuery.trim()) {
                const q = tableSearchQuery.toLowerCase();
                const matchCode = (m.meter_code || '').toLowerCase().includes(q);
                const matchName = (m.meter_name || '').toLowerCase().includes(q);
                const matchRoom = (m.room_code || '').toLowerCase().includes(q) || (m.room_name || '').toLowerCase().includes(q);
                const matchBuilding = (m.building_name || '').toLowerCase().includes(q);
                const matchZone = (m.zone_name || '').toLowerCase().includes(q);
                if (!matchCode && !matchName && !matchRoom && !matchBuilding && !matchZone) return false;
            }
            return true;
        });
    }, [meters, tableStatusFilter, tableSearchQuery, now]);

    // Get active series names for current selected chart metric (e.g. 3-phase lines or single phase lines)
    const activeChartSeries = React.useMemo(() => {
        const series = new Set<string>();
        chartData.forEach(pt => {
            Object.keys(pt).forEach(k => {
                const suffix = `_${chartMetric}`;
                if (k.endsWith(suffix) && pt[k] !== undefined && pt[k] !== null) {
                    const sName = k.substring(0, k.length - suffix.length);
                    series.add(sName);
                }
            });
        });
        return Array.from(series);
    }, [chartData, chartMetric]);

    // Chart palette with high-contrast distinct colors
    const chartColors = [
        '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899',
        '#06B6D4', '#F97316', '#14B8A6', '#6366F1', '#D946EF', '#84CC16',
    ];

    // Group active chart series by meter name so 3-phase meters can be toggled together in legend
    const chartMeterGroups = React.useMemo(() => {
        const map = new Map<string, { name: string; phase?: string; color: string }[]>();

        activeChartSeries.forEach((seriesName, idx) => {
            let baseMeter = seriesName;
            let phase: string | undefined = undefined;

            const phaseMatch = seriesName.match(/\s*\((L[123])\)$/);
            if (phaseMatch) {
                baseMeter = seriesName.replace(/\s*\((L[123])\)$/, '').trim();
                phase = phaseMatch[1];
            }

            if (!map.has(baseMeter)) {
                map.set(baseMeter, []);
            }

            const color = chartColors[idx % chartColors.length];
            map.get(baseMeter)!.push({ name: seriesName, phase, color });
        });

        return Array.from(map.entries()).map(([meterLabel, series]) => ({
            meterLabel,
            series,
        }));
    }, [activeChartSeries, chartColors]);

    const handleToggleMeterGroup = (group: { meterLabel: string; series: { name: string }[] }) => {
        setHiddenSeries(prev => {
            const next = new Set(prev);
            const allHidden = group.series.every(s => next.has(s.name));
            if (allHidden) {
                // Unhide all phases of this meter
                group.series.forEach(s => next.delete(s.name));
            } else {
                // Hide all phases of this meter
                group.series.forEach(s => next.add(s.name));
            }
            return next;
        });
    };

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

                {/* Site / Building / Floor / Zone filters */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', flexWrap: 'wrap' }}>
                    {/* Site Filter */}
                    <select
                        value={selectedSiteId || ''}
                        onChange={e => {
                            setSelectedSiteId(e.target.value ? parseInt(e.target.value) : undefined);
                            setSelectedBuildingId(undefined);
                            setSelectedFloor(undefined);
                            setSelectedZoneId(undefined);
                        }}
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

                    {/* Building Filter */}
                    <select
                        value={selectedBuildingId || ''}
                        onChange={e => {
                            setSelectedBuildingId(e.target.value ? parseInt(e.target.value) : undefined);
                            setSelectedFloor(undefined);
                            setSelectedZoneId(undefined);
                        }}
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

                    {/* Floor Filter */}
                    <select
                        value={selectedFloor || ''}
                        onChange={e => setSelectedFloor(e.target.value || undefined)}
                        style={{
                            fontFamily: MONO, fontSize: 11, padding: '5px 8px',
                            background: C.panel, color: C.ink, border: `1px solid ${C.line}`,
                            cursor: 'pointer', outline: 'none',
                        }}
                    >
                        <option value="">{t('ทุกชั้น', 'All Floors')}</option>
                        {floorOptions.map(f => (
                            <option key={f} value={f}>{t(`ชั้น ${f}`, `Floor ${f}`)}</option>
                        ))}
                    </select>

                    {/* Zone Filter */}
                    <select
                        value={selectedZoneId || ''}
                        onChange={e => setSelectedZoneId(e.target.value ? parseInt(e.target.value) : undefined)}
                        style={{
                            fontFamily: MONO, fontSize: 11, padding: '5px 8px',
                            background: C.panel, color: C.ink, border: `1px solid ${C.line}`,
                            cursor: 'pointer', outline: 'none',
                        }}
                    >
                        <option value="">{t('ทุกโซน', 'All Zones')}</option>
                        {zoneOptions.map(z => (
                            <option key={z.id} value={z.id}>{z.name}</option>
                        ))}
                    </select>

                    {/* Clear Filter Button */}
                    {(selectedSiteId || selectedBuildingId || selectedFloor || selectedZoneId) && (
                        <button
                            onClick={() => {
                                setSelectedSiteId(undefined);
                                setSelectedBuildingId(undefined);
                                setSelectedFloor(undefined);
                                setSelectedZoneId(undefined);
                            }}
                            title={t('ล้างตัวกรองทั้งหมด', 'Clear All Filters')}
                            style={{
                                fontFamily: MONO, fontSize: 10.5, padding: '4px 8px',
                                background: 'transparent', color: C.red, border: `1px solid ${C.red}60`,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                            }}
                        >
                            <RotateCcw size={12} /> {t('ล้างตัวกรอง', 'Reset')}
                        </button>
                    )}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '11px', fontFamily: MONO, fontWeight: 600, flexWrap: 'wrap' }}>
                        <button
                            onClick={() => setTableStatusFilter(tableStatusFilter === 'online' ? 'all' : 'online')}
                            style={{
                                background: 'transparent', border: 'none', padding: '2px 4px',
                                color: '#10B981', display: 'flex', alignItems: 'center', gap: 4,
                                cursor: 'pointer', fontFamily: MONO, fontSize: 11, fontWeight: 600,
                                opacity: tableStatusFilter === 'all' || tableStatusFilter === 'online' ? 1 : 0.4,
                                textDecoration: tableStatusFilter === 'online' ? 'underline' : 'none',
                            }}
                            title={t('กรองดูเฉพาะมิเตอร์ที่ออนไลน์', 'Filter by Online')}
                        >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                            {t('ออนไลน์', 'ONLINE')} {onlineMeters.length}
                        </button>
                        {zeroMeters.length > 0 && (
                            <button
                                onClick={() => setTableStatusFilter(tableStatusFilter === 'zero' ? 'all' : 'zero')}
                                style={{
                                    background: 'transparent', border: 'none', padding: '2px 4px',
                                    color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 4,
                                    cursor: 'pointer', fontFamily: MONO, fontSize: 11, fontWeight: 600,
                                    opacity: tableStatusFilter === 'all' || tableStatusFilter === 'zero' ? 1 : 0.4,
                                    textDecoration: tableStatusFilter === 'zero' ? 'underline' : 'none',
                                }}
                                title={t('กรองดูเฉพาะมิเตอร์ที่ไม่มีค่าอ่าน', 'Filter by No Reading')}
                            >
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
                                {t('ไม่มีค่าอ่าน', 'NO READING')} {zeroMeters.length}
                            </button>
                        )}
                        {noSignalMeters.length > 0 && (
                            <button
                                onClick={() => setTableStatusFilter(tableStatusFilter === 'offline' ? 'all' : 'offline')}
                                style={{
                                    background: 'transparent', border: 'none', padding: '2px 4px',
                                    color: '#EF4444', display: 'flex', alignItems: 'center', gap: 4,
                                    cursor: 'pointer', fontFamily: MONO, fontSize: 11, fontWeight: 600,
                                    opacity: tableStatusFilter === 'all' || tableStatusFilter === 'offline' ? 1 : 0.4,
                                    textDecoration: tableStatusFilter === 'offline' ? 'underline' : 'none',
                                }}
                                title={t('กรองดูเฉพาะมิเตอร์ที่ไม่มีสัญญาณ', 'Filter by No Signal')}
                            >
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444', display: 'inline-block' }} />
                                {t('ไม่มีสัญญาณ', 'NO SIGNAL')} {noSignalMeters.length}
                            </button>
                        )}
                        {inactiveMeters.length > 0 && (
                            <button
                                onClick={() => setTableStatusFilter(tableStatusFilter === 'inactive' ? 'all' : 'inactive')}
                                style={{
                                    background: 'transparent', border: 'none', padding: '2px 4px',
                                    color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4,
                                    cursor: 'pointer', fontFamily: MONO, fontSize: 11, fontWeight: 600,
                                    opacity: tableStatusFilter === 'all' || tableStatusFilter === 'inactive' ? 1 : 0.4,
                                    textDecoration: tableStatusFilter === 'inactive' ? 'underline' : 'none',
                                }}
                                title={t('กรองดูเฉพาะมิเตอร์ที่ไม่ใช้งาน', 'Filter by Inactive')}
                            >
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6B7280', display: 'inline-block' }} />
                                {t('ไม่ใช้งาน', 'INACTIVE')} {inactiveMeters.length}
                            </button>
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
                        {chartData.length > 0 && activeChartSeries.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                    <defs>
                                        {activeChartSeries.map((label, idx) => (
                                            <linearGradient key={label} id={`color-rt-${idx % chartColors.length}`} x1="0" y1="0" x2="0" y2="1">
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
                                                gap: '8px 14px', paddingTop: 14, paddingBottom: 4,
                                            }}>
                                                {chartMeterGroups.map((group) => {
                                                    const isHidden = group.series.every(s => hiddenSeries.has(s.name));
                                                    return (
                                                        <div
                                                            key={group.meterLabel}
                                                            onClick={() => handleToggleMeterGroup(group)}
                                                            style={{
                                                                display: 'flex', alignItems: 'center', gap: 6,
                                                                cursor: 'pointer', userSelect: 'none',
                                                                padding: '4px 10px',
                                                                background: isHidden ? 'transparent' : (theme === 'light' ? '#f3f4f6' : '#1f2937'),
                                                                border: `1px solid ${isHidden ? C.line : (theme === 'light' ? '#d1d5db' : '#374151')}`,
                                                                borderRadius: '4px',
                                                                opacity: isHidden ? 0.35 : 1,
                                                                transition: 'all 0.2s',
                                                            }}
                                                            title={group.series.length > 1 ? `${group.meterLabel} (${t('รวม 3 เฟส L1, L2, L3', 'Combined 3-Phase L1, L2, L3')})` : group.meterLabel}
                                                        >
                                                            {/* Dots representing phases */}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                                                {group.series.map(s => (
                                                                    <span
                                                                        key={s.name}
                                                                        style={{
                                                                            width: 8, height: 8, borderRadius: '50%',
                                                                            background: isHidden ? C.sub : s.color,
                                                                            display: 'inline-block',
                                                                            transition: 'all 0.2s',
                                                                        }}
                                                                    />
                                                                ))}
                                                            </div>
                                                            <span style={{
                                                                fontFamily: MONO, fontSize: 11, fontWeight: 600,
                                                                color: isHidden ? C.sub : C.ink,
                                                                textDecoration: isHidden ? 'line-through' : 'none',
                                                                transition: 'all 0.2s',
                                                            }}>
                                                                {group.meterLabel}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    />
                                    {activeChartSeries.map((label, idx) => (
                                        <Area
                                            key={label}
                                            type="monotone"
                                            dataKey={`${label}_${chartMetric}`}
                                            name={label}
                                            stroke={chartColors[idx % chartColors.length]}
                                            fillOpacity={1}
                                            fill={`url(#color-rt-${idx % chartColors.length})`}
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
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                    flexWrap: 'wrap',
                    gap: 12,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, fontFamily: MONO, color: C.ink, display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase' }}>
                            <Cpu size={16} style={{ color: C.accent }} />
                            {t('การตรวจวิเคราะห์มิเตอร์แบบเรียลไทม์', 'METER CHANNELS REALTIME DIAGNOSTICS')}
                        </h4>
                        <span style={{ fontFamily: MONO, fontSize: 11, color: C.sub, background: C.panel2, padding: '2px 8px', border: `1px solid ${C.line}` }}>
                            {tableStatusFilter !== 'all' || tableSearchQuery.trim() ? (
                                <>{t('พบ', 'Found')} <strong style={{ color: C.accent }}>{displayedTableMeters.length}</strong> / {meters.length} {t('มิเตอร์', 'meters')}</>
                            ) : (
                                <>{meters.length} {t('มิเตอร์ทั้งหมด', 'total meters')}</>
                            )}
                        </span>
                    </div>

                    {/* Status Tabs & Search Box */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {/* Status Filter Buttons */}
                        <div style={{ display: 'inline-flex', background: C.panel2, border: `1px solid ${C.line}`, padding: 2, gap: 2 }}>
                            {([
                                { key: 'all', labelTh: 'ทั้งหมด', labelEn: 'ALL', count: totalMeters, color: C.ink, dot: false },
                                { key: 'online', labelTh: 'ออนไลน์', labelEn: 'ONLINE', count: onlineMeters.length, color: '#10B981', dot: true },
                                { key: 'zero', labelTh: 'ไม่มีค่าอ่าน', labelEn: 'NO READING', count: zeroMeters.length, color: '#F59E0B', dot: true },
                                { key: 'offline', labelTh: 'ไม่มีสัญญาณ', labelEn: 'NO SIGNAL', count: noSignalMeters.length, color: '#EF4444', dot: true },
                                { key: 'inactive', labelTh: 'ไม่ใช้งาน', labelEn: 'INACTIVE', count: inactiveMeters.length, color: '#6B7280', dot: true },
                            ] as const).map(tab => {
                                const isSelected = tableStatusFilter === tab.key;
                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => setTableStatusFilter(tab.key)}
                                        style={{
                                            fontFamily: MONO,
                                            fontSize: 10.5,
                                            fontWeight: isSelected ? 700 : 500,
                                            padding: '4px 9px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 5,
                                            background: isSelected ? (theme === 'light' ? '#fff' : C.bar) : 'transparent',
                                            color: isSelected ? (tab.color === C.ink ? C.accent : tab.color) : C.sub,
                                            boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                            transition: 'all 0.12s ease',
                                        }}
                                    >
                                        {tab.dot && (
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: tab.color }} />
                                        )}
                                        <span>{t(tab.labelTh, tab.labelEn)}</span>
                                        <span style={{
                                            fontSize: 9.5,
                                            padding: '1px 5px',
                                            background: isSelected ? `${tab.color}20` : `${C.sub}15`,
                                            color: isSelected ? tab.color : C.sub,
                                            borderRadius: 2,
                                            fontWeight: 700,
                                        }}>
                                            {tab.count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Search Input Box */}
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Search size={13} style={{ position: 'absolute', left: 8, color: C.sub, pointerEvents: 'none' }} />
                            <input
                                type="text"
                                value={tableSearchQuery}
                                onChange={e => setTableSearchQuery(e.target.value)}
                                placeholder={t('ค้นหารหัส, ชื่อ, สถานที่...', 'Search code, name, location...')}
                                style={{
                                    fontFamily: MONO,
                                    fontSize: 11,
                                    padding: '5px 24px 5px 26px',
                                    background: C.panel2,
                                    color: C.ink,
                                    border: `1px solid ${C.line}`,
                                    outline: 'none',
                                    width: 180,
                                }}
                            />
                            {tableSearchQuery && (
                                <button
                                    onClick={() => setTableSearchQuery('')}
                                    style={{
                                        position: 'absolute', right: 4, background: 'transparent', border: 'none',
                                        color: C.sub, cursor: 'pointer', padding: 2, display: 'grid', placeItems: 'center',
                                    }}
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    </div>
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
                            {displayedTableMeters.length > 0 ? (
                                displayedTableMeters.map(m => {
                                    const avgPf = (m.pf1 + m.pf2 + m.pf3) / 3;
                                    const isFlashing = flashingRows[m.meter_code];
                                    const locationParts = [m.building_name, m.zone_name].filter(Boolean);
                                    const status = getMeterRealtimeStatus(m, now);
                                    const st = getRealtimeStatusInfo(status);

                                    return (
                                        <tr key={m.meter_code}
                                            onClick={() => setSelectedMeter(m)}
                                            style={{
                                                borderBottom: `1px solid ${C.line}`,
                                                backgroundColor: isFlashing
                                                    ? (theme === 'light' ? 'rgba(43,76,126,0.12)' : 'rgba(54,194,206,0.12)')
                                                    : status === 'offline'
                                                        ? (theme === 'light' ? 'rgba(239,68,68,0.04)' : 'rgba(248,81,73,0.06)')
                                                        : status === 'zero'
                                                            ? (theme === 'light' ? 'rgba(245,158,11,0.04)' : 'rgba(245,158,11,0.06)')
                                                            : 'transparent',
                                                transition: isFlashing ? 'none' : 'background-color 0.8s ease',
                                                color: (status === 'offline' || status === 'inactive') ? C.sub : C.ink,
                                                fontWeight: 500,
                                                cursor: 'pointer',
                                                opacity: (status === 'offline' || status === 'inactive') ? 0.7 : 1,
                                            }}
                                            onMouseEnter={e => { if (!isFlashing) e.currentTarget.style.backgroundColor = theme === 'light' ? '#f0efe5' : '#1f2937'; }}
                                            onMouseLeave={e => { if (!isFlashing) e.currentTarget.style.backgroundColor = status === 'offline' ? (theme === 'light' ? 'rgba(239,68,68,0.04)' : 'rgba(248,81,73,0.06)') : status === 'zero' ? (theme === 'light' ? 'rgba(245,158,11,0.04)' : 'rgba(245,158,11,0.06)') : 'transparent'; }}
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
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                                    padding: '2px 8px', fontSize: 10, fontWeight: 700, fontFamily: MONO,
                                                    background: st.badgeBg,
                                                    color: st.color,
                                                    border: `1px solid ${st.badgeBorder}`,
                                                }}>
                                                    <span style={{
                                                        width: 6, height: 6, borderRadius: '50%', background: st.color, display: 'inline-block',
                                                        boxShadow: status === 'online' ? `0 0 6px ${st.color}` : 'none'
                                                    }} />
                                                    {t(st.labelTh, st.labelEn)}
                                                </span>
                                            </td>
                                            <td style={{ padding: '14px 8px', fontWeight: 700, color: C.accent }}>
                                                {m.meter_code}
                                            </td>
                                            <td style={{ padding: '14px 8px' }}>
                                                <div style={{ fontWeight: 600 }}>{m.meter_name || '—'}</div>
                                                {m.room_code && (
                                                    <div style={{ fontSize: '10.5px', color: C.sub }}>
                                                        {m.room_name ? `${m.room_code} - ${m.room_name}` : m.room_code}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: '14px 8px', color: C.sub }}>
                                                {locationParts.length > 0 ? locationParts.join(' > ') : '—'}
                                            </td>
                                            <td style={{ padding: '14px 8px' }}>
                                                {m.vl1 > 0 || m.vl2 > 0 || m.vl3 > 0 ? (
                                                    <div style={{ display: 'flex', gap: '4px', fontSize: '11px' }}>
                                                        <span>{m.vl1.toFixed(1)}</span>/
                                                        <span>{m.vl2.toFixed(1)}</span>/
                                                        <span>{m.vl3.toFixed(1)}</span>
                                                    </div>
                                                ) : (
                                                    <span style={{ color: C.sub }}>0.0</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '14px 8px' }}>
                                                {m.il1 > 0 || m.il2 > 0 || m.il3 > 0 ? (
                                                    <div style={{ display: 'flex', gap: '4px', fontSize: '11px' }}>
                                                        <span>{m.il1.toFixed(2)}</span>/
                                                        <span>{m.il2.toFixed(2)}</span>/
                                                        <span>{m.il3.toFixed(2)}</span>
                                                    </div>
                                                ) : (
                                                    <span style={{ color: C.sub }}>0.00</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '14px 8px', fontWeight: 700, color: m.kw_3ph > 0 ? C.yellow : C.sub }}>
                                                {m.kw_3ph.toFixed(2)}
                                            </td>
                                            <td style={{ padding: '14px 8px', color: m.kva_3ph > 0 ? C.ink : C.sub }}>
                                                {m.kva_3ph.toFixed(2)}
                                            </td>
                                            <td style={{ padding: '14px 8px', color: avgPf >= 0.85 ? C.green : avgPf > 0 ? C.red : C.sub }}>
                                                {avgPf > 0 ? avgPf.toFixed(2) : '0.00'}
                                            </td>
                                            <td style={{ padding: '14px 8px', color: m.hz > 0 ? C.ink : C.sub }}>
                                                {m.hz > 0 ? m.hz.toFixed(1) : '0.0'}
                                            </td>
                                            <td style={{ padding: '14px 8px', fontWeight: 600 }}>
                                                {m.import_kwhr > 0 ? m.import_kwhr.toLocaleString([], { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '0.0'}
                                            </td>
                                            <td style={{ padding: '14px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}>
                                                {(() => {
                                                    const timeStr = formatDeviceTime(m.device_datetime || m.received_at, 'auto');
                                                    const fullTimeStr = formatDeviceTime(m.device_datetime || m.received_at, 'full');
                                                    if (timeStr === '—') {
                                                        return <span style={{ color: C.sub, opacity: 0.6 }}>—</span>;
                                                    }
                                                    if (status === 'offline') {
                                                        return (
                                                            <span
                                                                title={`${t('เวลาล่าสุดที่ได้รับข้อมูลก่อนขาดการติดต่อ', 'Last received reading timestamp before disconnection')}: ${fullTimeStr}`}
                                                                style={{ color: '#EF4444', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                                            >
                                                                <Clock size={11} />
                                                                {timeStr}
                                                            </span>
                                                        );
                                                    }
                                                    if (status === 'zero') {
                                                        return (
                                                            <span
                                                                title={`${t('เวลาที่ได้รับข้อมูลล่าสุด (ไม่มีค่าอ่าน)', 'Last received reading timestamp (No Reading)')}: ${fullTimeStr}`}
                                                                style={{ color: '#F59E0B', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                                            >
                                                                <Clock size={11} />
                                                                {timeStr}
                                                            </span>
                                                        );
                                                    }
                                                    if (status === 'inactive') {
                                                        return (
                                                            <span style={{ color: '#6B7280' }} title={fullTimeStr}>
                                                                {timeStr}
                                                            </span>
                                                        );
                                                    }
                                                    return (
                                                        <span style={{ color: C.ink, fontWeight: 500 }} title={fullTimeStr}>
                                                            {timeStr}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={13} style={{ textAlign: 'center', padding: '36px 20px', color: C.sub }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                            <Filter size={24} style={{ opacity: 0.4 }} />
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>
                                                {tableStatusFilter !== 'all' || tableSearchQuery.trim()
                                                    ? t('ไม่พบมิเตอร์ที่ตรงกับเงื่อนไขการกรองสถานะหรือคำค้นหา', 'No meters matching current status filter or search')
                                                    : t('ไม่พบข้อมูลการลงทะเบียนมิเตอร์', 'NO METER REGISTRIES FOUND')}
                                            </div>
                                            {(tableStatusFilter !== 'all' || tableSearchQuery.trim()) && (
                                                <button
                                                    onClick={() => {
                                                        setTableStatusFilter('all');
                                                        setTableSearchQuery('');
                                                    }}
                                                    style={{
                                                        fontFamily: MONO, fontSize: 11, padding: '4px 10px',
                                                        background: C.accent, color: '#fff', border: 'none',
                                                        cursor: 'pointer', borderRadius: 3, marginTop: 4,
                                                    }}
                                                >
                                                    {t('ล้างตัวกรองสถานะและการค้นหา', 'Clear Status Filter & Search')}
                                                </button>
                                            )}
                                        </div>
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
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: C.ink, letterSpacing: '0.5px' }}>
                                            {selectedMeter.meter_name || selectedMeter.meter_code}
                                        </div>
                                        {(() => {
                                            const selSt = getRealtimeStatusInfo(getMeterRealtimeStatus(selectedMeter, now));
                                            return (
                                                <span style={{
                                                    fontSize: 9.5, fontWeight: 700, fontFamily: MONO, padding: '2px 7px',
                                                    background: selSt.badgeBg, color: selSt.color, border: `1px solid ${selSt.badgeBorder}`,
                                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                                }}>
                                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: selSt.color, display: 'inline-block' }} />
                                                    {t(selSt.labelTh, selSt.labelEn).toUpperCase()}
                                                </span>
                                            );
                                        })()}
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
                    status={getMeterRealtimeStatus(graphMeter, now)}
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
