import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { alarmsApi, layoutsApi, meterDataApi, metersApi, realtimeApi, sitesApi } from '../../api/client';
import { LayoutGrid, ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw, X, Search, ChevronRight, ChevronLeft, Play, Pause, Repeat, Timer } from 'lucide-react';
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

export const STATUS_TYPES: Record<string, { color: string; bg: string; border: string; labelTh: string; labelEn: string; icon: string }> = {
    normal: { color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', border: '#10B981', labelTh: 'เป็นปกติ', labelEn: 'Normal', icon: '🟢' },
    problem: { color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)', border: '#EF4444', labelTh: 'มีปัญหา', labelEn: 'Problem', icon: '🔴' },
    inactive: { color: '#6B7280', bg: 'rgba(107, 114, 128, 0.15)', border: '#6B7280', labelTh: 'ไม่ใช้งาน', labelEn: 'Inactive', icon: '⚪' },
};

const POINT_TYPES: Record<string, { icon: string; faIcon: string; labelTh: string; labelEn: string }> = {
    power: { icon: '⚡', faIcon: 'fa fa-bolt', labelTh: 'ไฟฟ้า', labelEn: 'Power' },
    water: { icon: '💧', faIcon: 'fa fa-tint', labelTh: 'น้ำ', labelEn: 'Water' },
    gas: { icon: '🔥', faIcon: 'fa fa-fire', labelTh: 'แก๊ส', labelEn: 'Gas' },
    mdb: { icon: '🔌', faIcon: 'fa fa-plug', labelTh: 'MDB', labelEn: 'MDB' },
    temp: { icon: '🌡️', faIcon: 'fa fa-thermometer-half', labelTh: 'อุณหภูมิ', labelEn: 'Temp' },
    humidity: { icon: '🌫️', faIcon: 'fa fa-smog', labelTh: 'ความชื้น', labelEn: 'Humidity' },
    
    // Fallback for old layout points stored in DB
    meter: { icon: '⚡', faIcon: 'fa fa-bolt', labelTh: 'ไฟฟ้า', labelEn: 'Power' },
    sensor: { icon: '💧', faIcon: 'fa fa-tint', labelTh: 'น้ำ', labelEn: 'Water' },
    gen: { icon: '🔥', faIcon: 'fa fa-fire', labelTh: 'แก๊ส', labelEn: 'Gas' },
    ups: { icon: '🔌', faIcon: 'fa fa-plug', labelTh: 'MDB', labelEn: 'MDB' },
    temperature: { icon: '🌡️', faIcon: 'fa fa-thermometer-half', labelTh: 'อุณหภูมิ', labelEn: 'Temp' },
    hum: { icon: '🌫️', faIcon: 'fa fa-smog', labelTh: 'ความชื้น', labelEn: 'Humidity' },
};

/** Meter type definitions: meter_type_id → display info (FA class from DB) */
const METER_TYPES: Record<number, { faIcon: string; labelTh: string; labelEn: string }> = {
    1: { faIcon: 'fa fa-bolt', labelTh: 'Power', labelEn: 'Power' },
    2: { faIcon: 'fa fa-tint', labelTh: 'Water', labelEn: 'Water' },
    3: { faIcon: 'fa fa-fire', labelTh: 'Gas', labelEn: 'Gas' },
    4: { faIcon: 'fa fa-plug', labelTh: 'MDB', labelEn: 'MDB' },
    11: { faIcon: 'fa fa-smog', labelTh: 'Humidity', labelEn: 'Humidity' },
    12: { faIcon: 'fa fa-thermometer-half', labelTh: 'Temperature', labelEn: 'Temperature' },
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

/** Determine meter / point status: 'normal' (Green) | 'problem' (Red) | 'inactive' (Grey) */
const getPointStatusKey = (
    pt: LayoutPoint,
    metersList: any[],
    realtimeMap: Record<number, any>,
    alertsList: any[]
): 'normal' | 'problem' | 'inactive' => {
    if (!pt.meter_id) return 'inactive';
    const meter = metersList.find(m => Number(m.meter_id) === Number(pt.meter_id));
    if (!meter) return 'inactive';
    
    // Check if meter is explicitly deactivated/disabled
    if (meter.status === 'inactive' || meter.status === 'disabled' || meter.active === false || meter.is_active === false || meter.status === 0 || meter.status === '0') {
        return 'inactive';
    }

    // Check if meter has error/offline/alarm status or active alarm
    if (meter.status === 'error' || meter.status === 'alarm' || meter.status === 'offline' || meter.is_alarm) {
        return 'problem';
    }

    const realtime = realtimeMap[Number(pt.meter_id)];
    if (realtime && (realtime.status === 'offline' || realtime.status === 'error' || realtime.status === 'disconnect' || realtime.is_alarm)) {
        return 'problem';
    }

    if (alertsList && alertsList.some(a => Number(a.meter_id) === Number(pt.meter_id) && !a.acknowledged)) {
        return 'problem';
    }

    return 'normal';
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
    const { user } = useAuth();
    const { t, language } = useLanguage();
    const C = THEMES[theme];

    const [layouts, setLayouts] = useState<any[]>([]);
    const [allSites, setAllSites] = useState<any[]>([]);
    const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>('all');
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [selectedLayout, setSelectedLayout] = useState<any>(null);
    const [points, setPoints] = useState<LayoutPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

    // Zoom & Fullscreen state
    const [zoom, setZoom] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const pageContainerRef = useRef<HTMLDivElement>(null);

    const handleToggleFullscreen = () => {
        if (!document.fullscreenElement) {
            if (pageContainerRef.current?.requestFullscreen) {
                pageContainerRef.current.requestFullscreen().catch(() => {
                    setIsFullscreen(prev => !prev);
                });
            } else {
                setIsFullscreen(prev => !prev);
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {
                    setIsFullscreen(false);
                });
            } else {
                setIsFullscreen(false);
            }
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
        };
    }, []);

    // Meter popup state
    const [popupPoint, setPopupPoint] = useState<LayoutPoint | null>(null);
    const [meterData, setMeterData] = useState<any>(null);
    const [meterLoading, setMeterLoading] = useState(false);

    // Meter list sidebar state
    const [allMeters, setAllMeters] = useState<any[]>([]);
    const [latestMeterData, setLatestMeterData] = useState<Record<number, any>>({});
    const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
    const [meterSearch, setMeterSearch] = useState('');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [meterTypeFilter, setMeterTypeFilter] = useState<string | null>(null);
    const [activeLegendFilter, setActiveLegendFilter] = useState<string | null>(null);
    const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null);

    // Poll active alerts periodically
    useEffect(() => {
        let active = true;
        const fetchRecentAlerts = async () => {
            try {
                const res = await alarmsApi.getRecentAlerts(60);
                if (active) setActiveAlerts(res.data?.data || []);
            } catch (e) {
                // silent
            }
        };
        fetchRecentAlerts();
        const timer = setInterval(fetchRecentAlerts, 30000);
        return () => { active = false; clearInterval(timer); };
    }, []);

    // Load all layouts + all meters + sites
    useEffect(() => {
        (async () => {
            try {
                const [layoutRes, meterRes, sitesRes] = await Promise.all([
                    layoutsApi.getAll({ limit: 100 }),
                    metersApi.getAll({ limit: 500 }),
                    sitesApi.getAll({ limit: 100, activeOnly: true }),
                ]);
                const items = layoutRes.data.data || [];
                setLayouts(items);
                setAllMeters(meterRes.data?.data || []);
                setAllSites(sitesRes.data?.data || []);
            } catch (err) { console.error(err); }
            setLoading(false);
        })();
    }, []);

    // Sites accessible by current user based on permission
    const accessibleSites = useMemo(() => {
        if (user?.role === 'admin' || user?.siteAccessMode === 'all') {
            return allSites;
        }
        if (!user?.sites || user.sites.length === 0) {
            return allSites;
        }
        const allowedIds = new Set(user.sites.map((s: any) => Number(s.siteId)));
        return allSites.filter((s: any) => allowedIds.has(Number(s.site_id)));
    }, [allSites, user]);

    // Layouts filtered by user site access permissions
    const userAccessibleLayouts = useMemo(() => {
        if (user?.role === 'admin' || user?.siteAccessMode === 'all') {
            return layouts;
        }
        if (!user?.sites || user.sites.length === 0) {
            return layouts;
        }
        const allowedIds = new Set(user.sites.map((s: any) => Number(s.siteId)));
        return layouts.filter((l: any) => !l.site_id || allowedIds.has(Number(l.site_id)));
    }, [layouts, user]);

    // Layouts filtered by user-selected Site dropdown (All Sites vs specific Site)
    const displayedLayouts = useMemo(() => {
        if (selectedSiteFilter === 'all') return userAccessibleLayouts;
        const targetSiteId = Number(selectedSiteFilter);
        return userAccessibleLayouts.filter((l: any) => Number(l.site_id) === targetSiteId);
    }, [userAccessibleLayouts, selectedSiteFilter]);

    // Auto-loop slideshow state
    const [isLooping, setIsLooping] = useState(false);
    const [loopIntervalSeconds, setLoopIntervalSeconds] = useState(10);
    const [loopProgress, setLoopProgress] = useState(0); // 0 to 100%

    const handleNextLayout = () => {
        if (displayedLayouts.length <= 1) return;
        const currentIdx = displayedLayouts.findIndex(l => l.id === selectedId);
        const nextIdx = (currentIdx + 1) % displayedLayouts.length;
        setSelectedId(displayedLayouts[nextIdx].id);
        setLoopProgress(0);
    };

    const handlePrevLayout = () => {
        if (displayedLayouts.length <= 1) return;
        const currentIdx = displayedLayouts.findIndex(l => l.id === selectedId);
        const prevIdx = (currentIdx - 1 + displayedLayouts.length) % displayedLayouts.length;
        setSelectedId(displayedLayouts[prevIdx].id);
        setLoopProgress(0);
    };

    // Auto-loop timer effect
    useEffect(() => {
        if (!isLooping || displayedLayouts.length <= 1) {
            setLoopProgress(0);
            return;
        }

        const stepMs = 200;
        const totalMs = loopIntervalSeconds * 1000;
        const stepPercent = (stepMs / totalMs) * 100;

        const timer = setInterval(() => {
            setLoopProgress(prev => {
                if (prev + stepPercent >= 100) {
                    const currentIdx = displayedLayouts.findIndex(l => l.id === selectedId);
                    const nextIdx = (currentIdx + 1) % displayedLayouts.length;
                    setSelectedId(displayedLayouts[nextIdx].id);
                    return 0;
                }
                return prev + stepPercent;
            });
        }, stepMs);

        return () => clearInterval(timer);
    }, [isLooping, loopIntervalSeconds, displayedLayouts, selectedId]);

    // Sync selected layout id when displayedLayouts changes
    useEffect(() => {
        if (displayedLayouts.length > 0) {
            if (!selectedId || !displayedLayouts.some(l => l.id === selectedId)) {
                setSelectedId(displayedLayouts[0].id);
            }
        } else {
            setSelectedId(null);
        }
    }, [displayedLayouts, selectedId]);

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

    // Filtered meters for sidebar search + type filter + status filter
    const filteredMeters = useMemo(() => {
        // Only show meters that are linked to the current layout
        let result = allMeters.filter((m: any) => m.meter_id && linkedMeterIds.has(m.meter_id));
        
        // Filter by activeLegendFilter (Device Type) if selected
        if (activeLegendFilter !== null) {
            result = result.filter((m: any) => {
                const linkedPt = points.find(p => Number(p.meter_id) === Number(m.meter_id));
                if (!linkedPt) return false;
                const ptMappedType = linkedPt.point_type === 'meter' ? 'power' : linkedPt.point_type === 'sensor' ? 'water' : linkedPt.point_type === 'gen' ? 'gas' : linkedPt.point_type === 'ups' ? 'mdb' : linkedPt.point_type;
                return ptMappedType === activeLegendFilter;
            });
        }

        // Filter by activeStatusFilter (Normal / Problem / Inactive) if selected
        if (activeStatusFilter !== null) {
            result = result.filter((m: any) => {
                const linkedPt = points.find(p => Number(p.meter_id) === Number(m.meter_id));
                if (!linkedPt) return false;
                const st = getPointStatusKey(linkedPt, allMeters, latestMeterData, activeAlerts);
                return st === activeStatusFilter;
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
    }, [allMeters, linkedMeterIds, activeLegendFilter, activeStatusFilter, points, meterSearch, meterTypeFilter, latestMeterData, activeAlerts]);

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

    // Status counts: Normal (Green), Problem (Red), Inactive (Grey)
    const statusCounts = useMemo(() => {
        const counts = { normal: 0, problem: 0, inactive: 0 };
        points.forEach(pt => {
            const st = getPointStatusKey(pt, allMeters, latestMeterData, activeAlerts);
            counts[st] = (counts[st] || 0) + 1;
        });
        return counts;
    }, [points, allMeters, latestMeterData, activeAlerts]);

    // Device Type counts
    const typeCounts = useMemo(() => {
        const counts: Record<string, number> = { power: 0, water: 0, gas: 0, mdb: 0, temp: 0, humidity: 0 };
        points.forEach(pt => {
            const ptMappedType = pt.point_type === 'meter' ? 'power' : pt.point_type === 'sensor' ? 'water' : pt.point_type === 'gen' ? 'gas' : pt.point_type === 'ups' ? 'mdb' : pt.point_type;
            counts[ptMappedType] = (counts[ptMappedType] || 0) + 1;
        });
        return counts;
    }, [points]);

    // Points filtered by Legend Type / Status filters
    const visiblePoints = useMemo(() => {
        return points.filter(pt => {
            const ptMappedType = pt.point_type === 'meter' ? 'power' : pt.point_type === 'sensor' ? 'water' : pt.point_type === 'gen' ? 'gas' : pt.point_type === 'ups' ? 'mdb' : pt.point_type;
            if (activeLegendFilter !== null && ptMappedType !== activeLegendFilter) {
                return false;
            }
            if (activeStatusFilter !== null) {
                const st = getPointStatusKey(pt, allMeters, latestMeterData, activeAlerts);
                if (st !== activeStatusFilter) return false;
            }
            return true;
        });
    }, [points, activeLegendFilter, activeStatusFilter, allMeters, latestMeterData, activeAlerts]);

    const zoomPercent = Math.round(zoom * 100);

    return (
        <div
            ref={pageContainerRef}
            style={{
                color: C.ink,
                background: C.bg,
                display: 'flex',
                flexDirection: 'column',
                height: isFullscreen ? '100vh' : 'calc(100vh - 60px)',
                position: isFullscreen ? 'fixed' : 'relative',
                top: isFullscreen ? 0 : undefined,
                left: isFullscreen ? 0 : undefined,
                width: isFullscreen ? '100vw' : '100%',
                zIndex: isFullscreen ? 99999 : undefined,
                overflow: 'hidden',
            }}
        >
            {/* Command Bar */}
            <div style={{
                background: C.bar,
                color: C.ink,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: `2px solid ${C.accent}`,
                flexShrink: 0,
                flexWrap: 'nowrap',
                padding: '0 16px',
                minHeight: 52,
                gap: 12,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent, flexShrink: 0 }}><LayoutGrid size={16} /></div>
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 12.5, letterSpacing: 1.5, lineHeight: 1.2 }}>{t('การติดตาม // แผนผัง', 'MONITORING // LAYOUT')}</div>
                        <div style={{ fontSize: 9.5, color: C.barSub, letterSpacing: 0.3, lineHeight: 1.2 }}>{t('แผนผังตำแหน่งมิเตอร์และจุดวัดพลังงาน', 'Meter placement layout and energy measurement points')}</div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', flexShrink: 0 }}>
                    {/* Site Filter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                        <label style={{ fontFamily: MONO, fontSize: 11, color: C.barSub, whiteSpace: 'nowrap' }}>{t('ไซต์:', 'Site:')}</label>
                        <select
                            value={selectedSiteFilter}
                            onChange={e => setSelectedSiteFilter(e.target.value)}
                            style={{
                                padding: '4px 8px',
                                fontFamily: MONO,
                                fontSize: 11.5,
                                background: C.panel2,
                                color: C.ink,
                                border: `1px solid ${C.line}`,
                                borderRadius: 4,
                                outline: 'none',
                                minWidth: 120,
                                maxWidth: 160,
                                height: 30,
                            }}
                        >
                            <option value="all">{t('— ดูทุก Site —', '— All Sites —')}</option>
                            {accessibleSites.map((s: any) => (
                                <option key={s.site_id} value={s.site_id}>
                                    {language === 'en' ? (s.site_name_en || s.site_name) : (s.site_name_th || s.site_name)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Layout Select */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                        <label style={{ fontFamily: MONO, fontSize: 11, color: C.barSub, whiteSpace: 'nowrap' }}>{t('แผนผัง:', 'Layout:')}</label>
                        <select
                            value={selectedId || ''}
                            onChange={e => {
                                setSelectedId(parseInt(e.target.value, 10));
                                setLoopProgress(0);
                            }}
                            disabled={displayedLayouts.length === 0}
                            style={{
                                padding: '4px 8px',
                                fontFamily: MONO,
                                fontSize: 11.5,
                                background: C.panel2,
                                color: C.ink,
                                border: `1px solid ${C.line}`,
                                borderRadius: 4,
                                outline: 'none',
                                minWidth: 160,
                                maxWidth: 220,
                                height: 30,
                            }}
                        >
                            {displayedLayouts.length === 0 ? (
                                <option value="">{t('— ไม่มีแผนผังในไซต์นี้ —', '— No layout —')}</option>
                            ) : (
                                displayedLayouts.map((l: any) => {
                                    const bName = language === 'en' ? (l.building_name_en || l.building_name) : (l.building_name_th || l.building_name);
                                    const sName = language === 'en' ? (l.site_name_en || l.site_name) : (l.site_name_th || l.site_name);
                                    const locTag = bName || sName ? ` [${[sName, bName].filter(Boolean).join(' · ')}]` : '';
                                    return (<option key={l.id} value={l.id}>{l.name}{locTag}</option>);
                                })
                            )}
                        </select>
                    </div>

                    {/* Carousel / Loop Controls */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 3,
                        background: isLooping ? 'rgba(16, 185, 129, 0.12)' : C.panel2,
                        padding: '2px 5px', borderRadius: 4,
                        border: `1px solid ${isLooping ? '#10B981' : C.line}`,
                        transition: 'all 0.2s ease',
                        flexShrink: 0,
                        height: 30,
                    }}>
                        {/* Prev Layout Button */}
                        <button
                            onClick={handlePrevLayout}
                            disabled={displayedLayouts.length <= 1}
                            title={t('แผนผังก่อนหน้า', 'Previous Layout')}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                borderRadius: 4,
                                width: 22,
                                height: 22,
                                display: 'grid',
                                placeItems: 'center',
                                cursor: displayedLayouts.length <= 1 ? 'not-allowed' : 'pointer',
                                color: displayedLayouts.length <= 1 ? C.sub : C.ink,
                                opacity: displayedLayouts.length <= 1 ? 0.3 : 1,
                            }}
                        >
                            <ChevronLeft size={13} />
                        </button>

                        {/* Play / Pause Loop Button */}
                        <button
                            onClick={() => setIsLooping(prev => !prev)}
                            disabled={displayedLayouts.length <= 1}
                            title={isLooping ? t('หยุดการเล่นวนลูป (Slideshow)', 'Pause Slideshow') : t('เริ่มเล่นวนลูปแผนผัง (Auto-Loop)', 'Start Layout Slideshow')}
                            style={{
                                background: isLooping ? '#10B981' : 'transparent',
                                border: `1px solid ${isLooping ? '#10B981' : C.line}`,
                                borderRadius: 4,
                                padding: '2px 7px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                cursor: displayedLayouts.length <= 1 ? 'not-allowed' : 'pointer',
                                color: isLooping ? '#fff' : (displayedLayouts.length <= 1 ? C.sub : C.ink),
                                opacity: displayedLayouts.length <= 1 ? 0.3 : 1,
                                fontFamily: MONO,
                                fontSize: 10.5,
                                fontWeight: 700,
                                transition: 'all 0.15s ease',
                                height: 22,
                            }}
                        >
                            {isLooping ? <Pause size={10} /> : <Play size={10} />}
                            <span>{isLooping ? t('วนลูปอยู่', 'LOOPING') : t('วนลูป', 'LOOP')}</span>
                        </button>

                        {/* Next Layout Button */}
                        <button
                            onClick={handleNextLayout}
                            disabled={displayedLayouts.length <= 1}
                            title={t('แผนผังถัดไป', 'Next Layout')}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                borderRadius: 4,
                                width: 22,
                                height: 22,
                                display: 'grid',
                                placeItems: 'center',
                                cursor: displayedLayouts.length <= 1 ? 'not-allowed' : 'pointer',
                                color: displayedLayouts.length <= 1 ? C.sub : C.ink,
                                opacity: displayedLayouts.length <= 1 ? 0.3 : 1,
                            }}
                        >
                            <ChevronRight size={13} />
                        </button>

                        {/* Speed selector */}
                        <select
                            value={loopIntervalSeconds}
                            onChange={e => {
                                setLoopIntervalSeconds(Number(e.target.value));
                                setLoopProgress(0);
                            }}
                            title={t('ความเร็วในการวนลูป', 'Loop interval')}
                            style={{
                                padding: '1px 3px',
                                fontFamily: MONO,
                                fontSize: 10,
                                background: C.panel,
                                color: C.ink,
                                border: `1px solid ${C.line}`,
                                borderRadius: 4,
                                outline: 'none',
                                cursor: 'pointer',
                                height: 22,
                            }}
                        >
                            <option value={5}>5s</option>
                            <option value={10}>10s</option>
                            <option value={15}>15s</option>
                            <option value={30}>30s</option>
                            <option value={60}>60s</option>
                        </select>

                        {/* Layout Index Badge */}
                        {displayedLayouts.length > 0 && (
                            <span style={{
                                fontFamily: MONO,
                                fontSize: 10,
                                fontWeight: 700,
                                color: isLooping ? '#10B981' : C.sub,
                                padding: '0 3px',
                                letterSpacing: '0.5px',
                            }}>
                                {Math.max(1, displayedLayouts.findIndex(l => l.id === selectedId) + 1)}/{displayedLayouts.length}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Loop Progress Indicator Bar */}
            {isLooping && displayedLayouts.length > 1 && (
                <div style={{ width: '100%', height: 3, background: C.line, overflow: 'hidden', flexShrink: 0 }}>
                    <div
                        style={{
                            height: '100%',
                            width: `${loopProgress}%`,
                            background: '#10B981',
                            transition: 'width 0.2s linear',
                        }}
                    />
                </div>
            )}

            {loading ? (
                <LoadingScreen inline theme={theme} />
            ) : displayedLayouts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 24px', fontFamily: MONO, color: C.sub }}>
                    <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>🗺️</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{t('ไม่มีแผนผังที่สามารถแสดงได้', 'No Layouts Available')}</div>
                    <div style={{ fontSize: 11, marginTop: 6 }}>{t('ไปที่การตั้งค่า → แผนผัง เพื่อสร้างแผนผังใหม่ หรือเลือกไซต์อื่น', 'Go to Settings → Layouts to create a layout or choose another site')}</div>
                </div>
            ) : selectedLayout ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px 16px 16px' }}>
                    {/* Top bar: Legend + Zoom Controls */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center', flexShrink: 0 }}>
                        {/* Legend: Status (Colored) & Device Types (Neutral) */}
                        <div style={{
                            flex: 1, display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 14px',
                            background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6,
                            minWidth: 0,
                        }}>
                            {/* Row 1: Status */}
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
                                <span style={{ fontFamily: MONO, fontSize: 10, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>{t('สถานะ:', 'Status:')}</span>
                                {Object.entries(STATUS_TYPES).map(([key, info]) => {
                                    const isActive = activeStatusFilter === key;
                                    const count = statusCounts[key as keyof typeof statusCounts] || 0;
                                    return (
                                        <div key={key}
                                            onClick={() => setActiveStatusFilter(activeStatusFilter === key ? null : key)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 6,
                                                padding: '3px 9px', borderRadius: 6, cursor: 'pointer',
                                                background: isActive ? info.bg : 'transparent',
                                                border: `1.5px solid ${isActive ? info.border : C.line}`,
                                                boxShadow: isActive ? `0 2px 8px ${info.color}35` : 'none',
                                                transition: 'all 0.15s ease',
                                                userSelect: 'none'
                                            }}
                                            title={isActive ? t('แสดงทั้งหมด', 'Show All') : `${t('กรองแสดงเฉพาะ', 'Filter')} ${t(info.labelTh, info.labelEn)}`}
                                        >
                                            <span style={{ fontSize: 11 }}>{info.icon}</span>
                                            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: info.color }}>
                                                {t(info.labelTh, info.labelEn)}
                                            </span>
                                            <span style={{
                                                fontFamily: MONO, fontSize: 10, fontWeight: 800,
                                                padding: '1px 6px', borderRadius: 10,
                                                background: info.bg, color: info.color,
                                                border: `1px solid ${info.border}40`,
                                            }}>{count}</span>
                                        </div>
                                    );
                                })}

                                {(activeLegendFilter || activeStatusFilter) && (
                                    <button onClick={() => { setActiveLegendFilter(null); setActiveStatusFilter(null); }}
                                        style={{
                                            fontFamily: MONO, fontSize: 10, color: C.accent, background: 'transparent',
                                            border: `1px dashed ${C.accent}`, borderRadius: 4, padding: '3px 8px', cursor: 'pointer',
                                            marginLeft: 'auto',
                                        }}>
                                        ✕ {t('ล้างตัวกรอง', 'Clear Filter')}
                                    </button>
                                )}

                                <div style={{ flex: 1 }} />
                                <span style={{ fontFamily: MONO, fontSize: 10, color: C.sub, whiteSpace: 'nowrap' }}>{t('จุดทั้งหมด', 'Total')} {points.length} {t('จุด', 'points')}</span>
                            </div>

                            {/* Row 2: Types */}
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
                                <span style={{ fontFamily: MONO, fontSize: 10, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>{t('ประเภท:', 'Types:')}</span>
                                {Object.entries(POINT_TYPES).filter(([k]) => ['power', 'water', 'gas', 'mdb', 'temp', 'humidity'].includes(k)).map(([key, info]) => {
                                    const isActive = activeLegendFilter === key;
                                    const count = typeCounts[key] || 0;
                                    return (
                                        <div key={key}
                                            onClick={() => setActiveLegendFilter(activeLegendFilter === key ? null : key)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 5,
                                                padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                                                background: isActive ? C.panel2 : 'transparent',
                                                border: `1.5px solid ${isActive ? C.ink : C.line}`,
                                                color: C.ink,
                                                transition: 'all 0.15s ease',
                                                userSelect: 'none'
                                            }}
                                            title={isActive ? t('แสดงทั้งหมด', 'Show All') : `${t('แสดงเฉพาะ', 'Show Only')} ${t(info.labelTh, info.labelEn)}`}
                                        >
                                            <span style={{ fontSize: 11 }}><i className={info.faIcon} /></span>
                                            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: C.ink }}>
                                                {t(info.labelTh, info.labelEn)}
                                            </span>
                                            <span style={{
                                                fontFamily: MONO, fontSize: 10, fontWeight: 700,
                                                padding: '1px 5px', borderRadius: 8,
                                                background: C.panel2, color: C.sub,
                                                border: `1px solid ${C.line}`,
                                            }}>{count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Zoom Controls */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            background: C.panel, padding: '4px 8px', borderRadius: 6,
                            border: `1px solid ${C.line}`, flexShrink: 0,
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
                                <RotateCcw size={14} />
                            </button>
                            <button onClick={handleToggleFullscreen} title={isFullscreen ? t('ออกจากโหมดเต็มจอ (Esc)', 'Exit Fullscreen (Esc)') : t('แสดงเต็มหน้าจอ', 'Expand Fullscreen')}
                                style={{
                                    background: isFullscreen ? C.accent + '22' : 'transparent',
                                    border: `1px solid ${isFullscreen ? C.accent : C.line}`,
                                    borderRadius: 4, width: 30, height: 30, display: 'grid', placeItems: 'center',
                                    cursor: 'pointer', color: isFullscreen ? C.accent : C.ink, transition: 'all 0.15s'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = C.panel2; e.currentTarget.style.borderColor = C.accent; }}
                                onMouseLeave={e => { e.currentTarget.style.background = isFullscreen ? C.accent + '22' : 'transparent'; e.currentTarget.style.borderColor = isFullscreen ? C.accent : C.line; }}>
                                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
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

                                    {/* Canvas Points Colored by Status */}
                                    {visiblePoints.map((pt) => {
                                        const statusKey = getPointStatusKey(pt, allMeters, latestMeterData, activeAlerts);
                                        const statusInfo = STATUS_TYPES[statusKey] || STATUS_TYPES.normal;
                                        const statusColor = statusInfo.color;
                                        const isProblem = statusKey === 'problem';
                                        const isHovered = hoveredPoint === pt.id;
                                        const isActive = popupPoint?.id === pt.id;
                                        const pointNumber = points.findIndex(point => point.id === pt.id) + 1;
                                        const pointScale = Math.max(0.5, Math.min(1.5, 1 / Math.sqrt(zoom)));
                                        const typeInfo = POINT_TYPES[pt.point_type] || POINT_TYPES.power;

                                        return (
                                            <div key={pt.id}
                                                style={{
                                                    position: 'absolute', left: `${pt.x_percent}%`, top: `${pt.y_percent}%`,
                                                    transform: `translate(-50%, -50%) scale(${pointScale})`,
                                                    zIndex: isHovered || isActive ? 20 : 10, cursor: 'pointer',
                                                }}
                                                onMouseEnter={() => setHoveredPoint(pt.id)}
                                                onMouseLeave={() => setHoveredPoint(null)}
                                                onClick={() => handlePointClick(pt)}>
                                                {/* Pulse Ring */}
                                                {(isProblem || isHovered || isActive) && (
                                                    <div style={{
                                                        position: 'absolute', inset: isProblem ? -8 : -6, borderRadius: '50%',
                                                        border: `2.5px solid ${statusColor}`,
                                                        animation: isProblem ? 'pulse-ring 0.8s ease-out infinite' : 'pulse-ring 1s ease-out infinite',
                                                        opacity: isProblem ? 0.9 : 0.6,
                                                    }} />
                                                )}
                                                {/* Main Circle (Status Color) */}
                                                <div style={{
                                                    width: isHovered || isActive ? 38 : 32, height: isHovered || isActive ? 38 : 32,
                                                    borderRadius: '50%', background: statusColor,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: isHovered || isActive ? 16 : 14, lineHeight: 1, color: '#fff',
                                                    fontFamily: MONO, fontWeight: 800,
                                                    border: isActive ? '3px solid #fff' : `2px solid ${theme === 'dark' ? '#000' : '#fff'}`,
                                                    boxShadow: isHovered || isActive
                                                        ? `0 0 14px ${statusColor}90, 0 4px 12px rgba(0,0,0,0.4)`
                                                        : `0 2px 6px ${statusColor}50, 0 2px 6px rgba(0,0,0,0.3)`,
                                                    transition: 'all 0.2s ease', userSelect: 'none',
                                                }}>{pointNumber}</div>
                                                {/* Neutral Corner Icon Badge */}
                                                <div style={{
                                                    position: 'absolute', top: -6, right: -6,
                                                    width: 17, height: 17,
                                                    borderRadius: '50%', background: theme === 'dark' ? C.panel : '#fff',
                                                    color: C.ink,
                                                    border: `1.5px solid ${C.line}`,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 8,
                                                    lineHeight: 1, boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
                                                    userSelect: 'none',
                                                }}><i className={typeInfo.faIcon} /></div>
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
                                    {/* Type filter tabs (Neutral styling) */}
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
                                                    background: meterTypeFilter === key ? C.panel2 : 'transparent',
                                                    color: meterTypeFilter === key ? C.ink : C.sub,
                                                    border: `1px solid ${meterTypeFilter === key ? C.ink : C.line}`,
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
                                                    const typeInfo = POINT_TYPES[ptType] || POINT_TYPES.power;
                                                    const mTypeInfo = getMeterTypeInfo(m.meter_type_id, m.icon_name, m.meter_type_name || m.meter_type);
                                                    const typeFaIcon = typeInfo?.faIcon || mTypeInfo?.faIcon || 'fa fa-bolt';
                                                    const typeLabel = t(typeInfo?.labelTh || mTypeInfo?.labelTh, typeInfo?.labelEn || mTypeInfo?.labelEn);
                                                    const statusKey = linkedPt ? getPointStatusKey(linkedPt, allMeters, latestMeterData, activeAlerts) : 'inactive';
                                                    const statusInfo = STATUS_TYPES[statusKey] || STATUS_TYPES.inactive;

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
                                                            onMouseEnter={e => { if (isLinked) e.currentTarget.style.borderColor = statusInfo.color; }}
                                                            onMouseLeave={e => { e.currentTarget.style.borderColor = C.line; }}
                                                        >
                                                            {/* Status Colored Badge with Point Number */}
                                                            <span style={{
                                                                width: 26, height: 26, borderRadius: '50%',
                                                                background: isLinked ? statusInfo.color : C.line,
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontFamily: MONO, fontSize: 12, fontWeight: 800,
                                                                flexShrink: 0, color: '#fff',
                                                            }}>{pointNumber ?? '—'}</span>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{
                                                                    fontFamily: MONO, fontSize: 11, fontWeight: 600, color: C.ink,
                                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                                    display: 'flex', alignItems: 'center', gap: 6,
                                                                }}>
                                                                    <span style={{
                                                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                                        width: 17, height: 17, borderRadius: 3,
                                                                        background: C.panel, border: `1px solid ${C.line}`,
                                                                        color: C.ink, fontSize: 9, flexShrink: 0,
                                                                    }} title={typeLabel}>
                                                                        <i className={typeFaIcon} />
                                                                    </span>
                                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.meter_name || m.meter_code}</span>
                                                                </div>
                                                                <div style={{ fontFamily: MONO, fontSize: 9, color: C.sub, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                                                    <span>[{m.meter_code}]</span>
                                                                    {m.room_code && <span>• {m.room_code}</span>}
                                                                </div>
                                                            </div>
                                                            <span style={{
                                                                minWidth: 70, textAlign: 'right',
                                                                fontFamily: MONO, fontSize: 11.5, fontWeight: 700,
                                                                color: hasCurrentKwh && Number.isFinite(currentKwh) ? C.ink : C.sub,
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
            {popupPoint && (() => {
                const popupStatusKey = getPointStatusKey(popupPoint, allMeters, latestMeterData, activeAlerts);
                const popupStatusInfo = STATUS_TYPES[popupStatusKey] || STATUS_TYPES.normal;
                const popupTypeInfo = POINT_TYPES[popupPoint.point_type] || POINT_TYPES.power;

                return (
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
                                background: C.bar, borderBottom: `2px solid ${popupStatusInfo.color}`,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{
                                        width: 30, height: 30, borderRadius: '50%',
                                        background: popupStatusInfo.color,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 14, color: '#fff',
                                    }}><i className={popupTypeInfo.faIcon} /></span>
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
                                        {/* Meter name & Status Badge */}
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
                                                fontFamily: MONO, fontSize: 10.5, padding: '4px 10px',
                                                borderRadius: 12,
                                                background: popupStatusInfo.bg,
                                                color: popupStatusInfo.color,
                                                border: `1px solid ${popupStatusInfo.border}`,
                                                fontWeight: 700, textTransform: 'uppercase',
                                                display: 'flex', alignItems: 'center', gap: 5,
                                            }}>
                                                <span>{popupStatusInfo.icon}</span>
                                                <span>{t(popupStatusInfo.labelTh, popupStatusInfo.labelEn)}</span>
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
                );
            })()}

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
