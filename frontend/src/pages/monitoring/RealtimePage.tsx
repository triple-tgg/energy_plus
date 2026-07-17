import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, ShieldAlert, Cpu, Radio, Zap, RefreshCw, AlertTriangle, LayoutGrid, X, ChevronDown } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { realtimeApi } from '../../api/client';

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, "Cascadia Mono", monospace';

const THEMES = {
    light: {
        bg: '#EAE7DA', panel: '#FBFAF4', panel2: '#F1EFE3', ink: '#23261E', sub: '#6E705F',
        line: '#D4D1C0', bar: '#23261E', barSub: '#A6A892', accent: '#2B4C7E',
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
    const [alerts, setAlerts] = useState<{ id: string; time: string; msg: string; type: 'warning' | 'danger' }[]>([]);
    const [flashingRows, setFlashingRows] = useState<Record<string, boolean>>({});
    const [lastFetchTime, setLastFetchTime] = useState<string>('');
    const [selectedMeter, setSelectedMeter] = useState<RealtimeMeterData | null>(null);

    // Filters
    const [selectedSiteId, setSelectedSiteId] = useState<number | undefined>(undefined);
    const [selectedBuildingId, setSelectedBuildingId] = useState<number | undefined>(undefined);
    const [siteOptions, setSiteOptions] = useState<{ id: number; name: string }[]>([]);
    const [allBuildings, setAllBuildings] = useState<{ id: number; name: string; site_id: number }[]>([]);

    // Track previous timestamps for flash detection
    const previousTimestamps = useRef<Record<string, string>>({});

    // Load sites & buildings once on mount
    useEffect(() => {
        (async () => {
            try {
                const { sitesApi } = await import('../../api/client');
                const [sitesRes, buildingsRes] = await Promise.all([
                    sitesApi.getAll({ limit: 100 }),
                    sitesApi.getAllBuildings({ limit: 200 }),
                ]);
                const sites = sitesRes.data?.data || [];
                setSiteOptions(sites.map((s: any) => ({ id: s.site_id, name: s.site_name })));
                const buildings = buildingsRes.data?.data || [];
                setAllBuildings(buildings.map((b: any) => ({ id: b.building_id, name: b.building_name, site_id: b.site_id })));
            } catch (err) {
                console.error('Failed to load sites/buildings for filter:', err);
            }
        })();
    }, []);

    // Building options filtered by selected site
    const buildingOptions = React.useMemo(() => {
        if (!selectedSiteId) return allBuildings.map(b => ({ id: b.id, name: b.name }));
        return allBuildings.filter(b => b.site_id === selectedSiteId).map(b => ({ id: b.id, name: b.name }));
    }, [allBuildings, selectedSiteId]);

    // Alarm logic
    const checkAlarms = useCallback((data: RealtimeMeterData) => {
        const newAlerts: typeof alerts = [];
        const avgV = (parseNum(data.vl1) + parseNum(data.vl2) + parseNum(data.vl3)) / 3;

        // Voltage anomaly
        if (avgV > 0 && (avgV < 210 || avgV > 235)) {
            newAlerts.push({
                id: `${data.meter_code}-v-${Date.now()}`,
                time: new Date().toLocaleTimeString(language === 'th' ? 'th-TH' : 'en-US'),
                msg: `${t('มิเตอร์', 'Meter')} ${data.meter_code} (${data.meter_name}): ${t('แรงดันไฟฟ้าเฉลี่ยผิดปกติ', 'Avg voltage abnormal')} (${avgV.toFixed(1)} V)`,
                type: avgV < 205 || avgV > 240 ? 'danger' : 'warning'
            });
        }

        // Low power factor
        const avgPf = (parseNum(data.pf1) + parseNum(data.pf2) + parseNum(data.pf3)) / 3;
        if (avgPf > 0 && avgPf < 0.8) {
            newAlerts.push({
                id: `${data.meter_code}-pf-${Date.now()}`,
                time: new Date().toLocaleTimeString(language === 'th' ? 'th-TH' : 'en-US'),
                msg: `${t('มิเตอร์', 'Meter')} ${data.meter_code} (${data.meter_name}): ${t('ตัวประกอบกำลังต่ำ', 'Low Power Factor')} (${avgPf.toFixed(2)})`,
                type: 'warning'
            });
        }

        if (newAlerts.length > 0) {
            setAlerts(prev => [...newAlerts, ...prev].slice(0, 10));
        }
    }, [language, t]);

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
                            checkAlarms(m);
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
    }, [selectedSiteId, selectedBuildingId, checkAlarms]);

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
        const chartDelay = setTimeout(() => fetchChartHistory(), 1000);

        const pollLatest = setInterval(() => fetchLatestData(false), 5000);
        const pollChart = setInterval(() => fetchChartHistory(), 30000);

        return () => {
            clearTimeout(chartDelay);
            clearInterval(pollLatest);
            clearInterval(pollChart);
        };
    }, [fetchLatestData, fetchChartHistory]);

    // Summary calculations
    const totalMeters = meters.length;
    const totalPower = meters.reduce((sum, m) => sum + (m.kw_3ph || 0), 0);
    const avgVoltage = meters.length > 0
        ? meters.reduce((sum, m) => sum + ((m.vl1 + m.vl2 + m.vl3) / 3 || 0), 0) / meters.length
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

    const syncColor = dbSyncStatus === 'active' ? C.green : dbSyncStatus === 'syncing' ? C.yellow : C.red;
    const selectedMetricInfo = CHART_METRICS.find(m => m.key === chartMetric)!;

    return (
        <div style={{ color: C.ink, padding: '10px 0' }}>
            {/* Command bar */}
            <div style={{ background: C.bar, color: '#fff', display: 'flex', alignItems: 'stretch', borderBottom: `2px solid ${C.accent}`, marginBottom: 16, flexWrap: 'wrap' }}>
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
                            background: 'transparent', color: '#fff', border: '1px solid #ffffff33',
                            cursor: 'pointer', outline: 'none',
                        }}
                    >
                        <option value="" style={{ color: '#000' }}>{t('ทุกสาขา', 'All Sites')}</option>
                        {siteOptions.map(s => (
                            <option key={s.id} value={s.id} style={{ color: '#000' }}>{s.name}</option>
                        ))}
                    </select>

                    <select
                        value={selectedBuildingId || ''}
                        onChange={e => setSelectedBuildingId(e.target.value ? parseInt(e.target.value) : undefined)}
                        style={{
                            fontFamily: MONO, fontSize: 11, padding: '5px 8px',
                            background: 'transparent', color: '#fff', border: '1px solid #ffffff33',
                            cursor: 'pointer', outline: 'none',
                        }}
                    >
                        <option value="" style={{ color: '#000' }}>{t('ทุกอาคาร', 'All Buildings')}</option>
                        {buildingOptions.map(b => (
                            <option key={b.id} value={b.id} style={{ color: '#000' }}>{b.name}</option>
                        ))}
                    </select>
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', fontFamily: MONO, fontSize: 11.5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: C.barSub }}>{t('ซิงค์ล่าสุด:', 'LAST SYNC:')}</span>
                        <span style={{ color: '#fff', fontWeight: 700 }}>{lastFetchTime || '-'}</span>
                    </div>

                    <button
                        onClick={() => { fetchLatestData(false); fetchChartHistory(); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 5, fontFamily: MONO, fontSize: 11, color: '#fff',
                            background: 'transparent', border: '1px solid #ffffff33', padding: '5px 9px', cursor: 'pointer'
                        }}
                        title={t('ซิงค์ข้อมูลทันที', 'Force Sync Data')}
                    >
                        <RefreshCw size={11} className={dbSyncStatus === 'syncing' ? 'spin' : ''} /> {t('ซิงค์', 'SYNC')}
                    </button>
                </div>
            </div>

            {/* Metrics cards grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                marginBottom: '24px'
            }}>
                {/* Sync Status Card */}
                <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRadius: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontFamily: MONO, color: C.sub, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('สถานะการซิงค์', 'Sync Status')}</span>
                        <Radio size={20} style={{ color: syncColor }} />
                    </div>
                    <h3 style={{ fontSize: '24px', fontWeight: 800, fontFamily: MONO, margin: '10px 0 4px 0', color: C.ink }}>
                        {dbSyncStatus === 'active' ? t('เชื่อมต่อแล้ว', 'Connected') : dbSyncStatus === 'syncing' ? t('กำลังซิงค์...', 'Syncing...') : t('ขัดข้อง', 'Error')}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontFamily: MONO, color: syncColor, fontWeight: 600 }}>
                        <span style={{
                            width: 8, height: 8, borderRadius: '50%',
                            backgroundColor: syncColor,
                            boxShadow: dbSyncStatus === 'active' ? `0 0 8px ${C.green}` : 'none'
                        }} />
                        {dbSyncStatus === 'active' ? t('ดึงข้อมูลสด (5วินาที)', 'LIVE TELEMETRY (5S)') : t('กำลังอัปเดตแคช...', 'UPDATING CACHE...')}
                    </div>
                </div>

                {/* Active Meters Card */}
                <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRadius: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontFamily: MONO, color: C.sub, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('มิเตอร์ที่กำลังทำงาน', 'Active Power Meters')}</span>
                        <Cpu size={20} style={{ color: C.accent }} />
                    </div>
                    <h3 style={{ fontSize: '24px', fontWeight: 800, fontFamily: MONO, margin: '10px 0 4px 0', color: C.ink }}>
                        {totalMeters}
                    </h3>
                    <span style={{ fontSize: '11px', color: C.sub, fontWeight: 600, fontFamily: MONO }}>
                        {t('ช่องสัญญาณที่ทำงานในระบบ', 'ACTIVE CHANNELS IN PROCESS')}
                    </span>
                </div>

                {/* Total Load Card */}
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

                {/* Avg Voltage Card */}
                <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRadius: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontFamily: MONO, color: C.sub, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('แรงดันไฟฟ้าเฉลี่ย (L-N)', 'Avg Line-to-Neutral')}</span>
                        <Activity size={20} style={{ color: C.accent }} />
                    </div>
                    <h3 style={{ fontSize: '24px', fontWeight: 800, fontFamily: MONO, margin: '10px 0 4px 0', color: C.ink }}>
                        {avgVoltage.toFixed(1)} V
                    </h3>
                    <span style={{ fontSize: '11px', color: avgVoltage > 215 && avgVoltage < 230 ? C.green : C.red, fontWeight: 600, fontFamily: MONO }}>
                        {avgVoltage > 215 && avgVoltage < 230 ? t('แรงดันไฟฟ้าปกติ', 'VOLTAGE NOMINAL') : avgVoltage === 0 ? t('ไม่มีข้อมูล', 'NO DATA') : t('แรงดันไฟฟ้านอกขอบเขต', 'VOLTAGE OUT OF TOLERANCE')}
                    </span>
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
                                    const avgV = (m.vl1 + m.vl2 + m.vl3) / 3;
                                    const avgI = (m.il1 + m.il2 + m.il3) / 3;
                                    const avgPf = (m.pf1 + m.pf2 + m.pf3) / 3;
                                    const isFlashing = flashingRows[m.meter_code];
                                    const locationParts = [m.building_name, m.zone_name].filter(Boolean);

                                    return (
                                        <tr key={m.meter_code}
                                            onClick={() => setSelectedMeter(m)}
                                            style={{
                                                borderBottom: `1px solid ${C.line}`,
                                                backgroundColor: isFlashing
                                                    ? (theme === 'light' ? 'rgba(43,76,126,0.12)' : 'rgba(54,194,206,0.12)')
                                                    : 'transparent',
                                                transition: isFlashing ? 'none' : 'background-color 0.8s ease',
                                                color: C.ink,
                                                fontWeight: 500,
                                                cursor: 'pointer',
                                            }}
                                            onMouseEnter={e => { if (!isFlashing) e.currentTarget.style.backgroundColor = theme === 'light' ? '#f0efe5' : '#1f2937'; }}
                                            onMouseLeave={e => { if (!isFlashing) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                        >
                                            <td style={{ padding: '14px 8px', fontWeight: 700 }}>{m.meter_code}</td>
                                            <td style={{ padding: '14px 8px', color: C.accent, fontWeight: 700 }}>{m.meter_name || m.room_code || `M${m.meter_id}`}</td>
                                            <td style={{ padding: '14px 8px', fontSize: '11px', color: C.sub }}>
                                                {locationParts.length > 0 ? locationParts.join(' › ') : '—'}
                                            </td>
                                            <td style={{ padding: '14px 8px' }}>
                                                <span style={{ fontSize: '10px', color: C.sub, display: 'block', fontWeight: 500 }}>
                                                    {m.vl1.toFixed(1)} / {m.vl2.toFixed(1)} / {m.vl3.toFixed(1)}
                                                </span>
                                                <span style={{ fontWeight: 700 }}>{avgV.toFixed(1)} V</span>
                                            </td>
                                            <td style={{ padding: '14px 8px' }}>
                                                <span style={{ fontSize: '10px', color: C.sub, display: 'block', fontWeight: 500 }}>
                                                    {m.il1.toFixed(2)} / {m.il2.toFixed(2)} / {m.il3.toFixed(2)}
                                                </span>
                                                <span style={{ fontWeight: 700 }}>{avgI.toFixed(2)} A</span>
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
                                    <td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: C.sub }}>
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
                                    <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '0.5px' }}>
                                        {selectedMeter.meter_name || selectedMeter.meter_code}
                                    </div>
                                    <div style={{ fontFamily: MONO, fontSize: 10, color: C.barSub }}>
                                        [{selectedMeter.meter_code}] {selectedMeter.room_code || ''}
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setSelectedMeter(null)}
                                style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, display: 'grid', placeItems: 'center' }}>
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
