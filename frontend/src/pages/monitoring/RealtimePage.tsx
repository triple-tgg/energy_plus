import React, { useEffect, useState, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, ShieldAlert, Cpu, Radio, Zap, RefreshCw, AlertTriangle, LayoutGrid } from 'lucide-react';
import axios from 'axios';
import { useTheme } from '../../contexts/ThemeContext';

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
    meter_code: string;
    meter_name: string;
    site_id: number;
    address_id: number;
    device: string;
    type: string;
    vl1: number;
    vl2: number;
    vl3: number;
    vl12: number;
    vl23: number;
    vl31: number;
    il1: number;
    il2: number;
    il3: number;
    kw1: number;
    kw2: number;
    kw3: number;
    kw_3ph: number;
    kvar1: number;
    kvar2: number;
    kvar3: number;
    kvar_3ph: number;
    kva1: number;
    kva2: number;
    kva3: number;
    kva_3ph: number;
    pf1: number;
    pf2: number;
    pf3: number;
    hz: number;
    import_kwhr: number;
    device_datetime: string;
    received_at: string;
}

interface ChartDataPoint {
    time: string;
    [key: string]: any; // dynamic keys for meters (e.g. "Main MDB L1": 250)
}

const RealtimePage: React.FC = () => {
    const { theme } = useTheme();
    const C = THEMES[theme];
    const [meters, setMeters] = useState<RealtimeMeterData[]>([]);
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [dbSyncStatus, setDbSyncStatus] = useState<'active' | 'syncing' | 'error'>('syncing');
    const [alerts, setAlerts] = useState<{ id: string; time: string; msg: string; type: 'warning' | 'danger' }[]>([]);
    const [flashingRows, setFlashingRows] = useState<Record<string, boolean>>({});
    const [lastFetchTime, setLastFetchTime] = useState<string>('');

    // Keep track of previously loaded timestamps to detect updates
    const previousTimestamps = useRef<Record<string, string>>({});

    // Add alarm logic
    const checkAlarms = (data: RealtimeMeterData) => {
        const newAlerts: typeof alerts = [];
        
        // Voltage anomaly check
        if (data.vl1 < 210 || data.vl1 > 235) {
            newAlerts.push({
                id: `${data.meter_code}-v1-${Date.now()}`,
                time: new Date().toLocaleTimeString(),
                msg: `มิเตอร์ ${data.meter_code} (${data.meter_name}): แรงดัน L1 ผิดปกติ (${data.vl1} V)`,
                type: data.vl1 < 205 ? 'danger' : 'warning'
            });
        }

        // Low power factor check
        const avgPf = (data.pf1 + data.pf2 + data.pf3) / 3;
        if (avgPf < 0.8 && avgPf > 0) {
            newAlerts.push({
                id: `${data.meter_code}-pf-${Date.now()}`,
                time: new Date().toLocaleTimeString(),
                msg: `มิเตอร์ ${data.meter_code} (${data.meter_name}): ค่า Power Factor ต่ำ (${avgPf.toFixed(2)})`,
                type: 'warning'
            });
        }

        if (newAlerts.length > 0) {
            setAlerts(prev => [newAlerts[0], ...prev.slice(0, 9)]);
        }
    };

    // Load latest data from the backend database (polls this every 5 seconds)
    const fetchLatestData = async (isInitial = false) => {
        setDbSyncStatus('syncing');
        try {
            const token = localStorage.getItem('accessToken');
            const res = await axios.get('/api/v1/redis/latest', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (res.data && res.data.success && Array.isArray(res.data.data)) {
                const fetchedData: any[] = res.data.data;
                
                // Format meter names for display and map code to meter_code with numeric parsing
                const processedMeters: RealtimeMeterData[] = fetchedData.map(m => ({
                    ...m,
                    meter_code: m.code,
                    meter_name: m.code === '0206213159' ? 'Main MDB L1 (L1-L4)' :
                                m.code === '0206213160' ? 'Main MDB L2' :
                                m.code === '0206213161' ? 'Sub MDB A1' :
                                m.code === '0206213162' ? 'Sub MDB A2' :
                                m.code === '0206213163' ? 'MDB Parking' : `Meter ${m.code}`,
                    vl1: parseFloat(m.vl1) || 0,
                    vl2: parseFloat(m.vl2) || 0,
                    vl3: parseFloat(m.vl3) || 0,
                    vl12: parseFloat(m.vl12) || 0,
                    vl23: parseFloat(m.vl23) || 0,
                    vl31: parseFloat(m.vl31) || 0,
                    il1: parseFloat(m.il1) || 0,
                    il2: parseFloat(m.il2) || 0,
                    il3: parseFloat(m.il3) || 0,
                    kw1: parseFloat(m.kw1) || 0,
                    kw2: parseFloat(m.kw2) || 0,
                    kw3: parseFloat(m.kw3) || 0,
                    kw_3ph: parseFloat(m.kw_3ph) || 0,
                    kvar1: parseFloat(m.kvar1) || 0,
                    kvar2: parseFloat(m.kvar2) || 0,
                    kvar3: parseFloat(m.kvar3) || 0,
                    kvar_3ph: parseFloat(m.kvar_3ph) || 0,
                    kva1: parseFloat(m.kva1) || 0,
                    kva2: parseFloat(m.kva2) || 0,
                    kva3: parseFloat(m.kva3) || 0,
                    kva_3ph: parseFloat(m.kva_3ph) || 0,
                    pf1: parseFloat(m.pf1) || 0,
                    pf2: parseFloat(m.pf2) || 0,
                    pf3: parseFloat(m.pf3) || 0,
                    hz: parseFloat(m.hz) || 0,
                    import_kwhr: parseFloat(m.import_kwhr) || 0,
                })).sort((a, b) => (a.address_id || 0) - (b.address_id || 0));

                setMeters(processedMeters);
                setDbSyncStatus('active');
                setLastFetchTime(new Date().toLocaleTimeString());

                // Detect changes in timestamps to trigger UI feedback and charts
                let hasUpdates = false;
                const newFlashingRows: Record<string, boolean> = {};

                processedMeters.forEach(m => {
                    const prevTime = previousTimestamps.current[m.meter_code];
                    const currTime = m.device_datetime;

                    if (prevTime !== currTime) {
                        previousTimestamps.current[m.meter_code] = currTime;
                        
                        // Only trigger visual flash animations if it is not the very first load
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
                        const clearedFlashing: Record<string, boolean> = {};
                        Object.keys(newFlashingRows).forEach(k => { clearedFlashing[k] = false; });
                        setFlashingRows(prev => ({ ...prev, ...clearedFlashing }));
                    }, 800);
                }

                // Update Recharts Chart Data
                const timeStr = new Date().toLocaleTimeString([], { 
                    hour: '2-digit', minute: '2-digit', second: '2-digit' 
                });

                setChartData(prevChart => {
                    const newPoint: ChartDataPoint = { time: timeStr };
                    processedMeters.forEach(m => {
                        newPoint[m.meter_name] = m.kw_3ph;
                    });

                    const updatedChart = [...prevChart, newPoint];
                    if (updatedChart.length > 15) {
                        updatedChart.shift();
                    }
                    return updatedChart;
                });
            }
        } catch (error) {
            console.error('Failed to poll latest realtime data:', error);
            setDbSyncStatus('error');
        }
    };

    useEffect(() => {
        // Initial Fetch
        fetchLatestData(true);

        // Poll every 5 seconds
        const pollInterval = setInterval(() => {
            fetchLatestData(false);
        }, 5000);

        return () => clearInterval(pollInterval);
    }, []);

    // Summary calculations
    const activeCount = meters.length;
    const totalPower = meters.reduce((sum, m) => sum + (m.kw_3ph || 0), 0);
    const avgVoltage = meters.length > 0 
        ? meters.reduce((sum, m) => sum + ((m.vl1 + m.vl2 + m.vl3) / 3 || 0), 0) / meters.length
        : 0;

    // Line colors for chart (high contrast themes)
    const chartColors = [C.accent, C.green, C.yellow, C.red, '#8b5cf6'];

    const syncColor = dbSyncStatus === 'active' ? C.green : dbSyncStatus === 'syncing' ? C.yellow : C.red;

    return (
        <div style={{ color: C.ink, padding: '10px 0' }}>
            {/* Command bar */}
            <div style={{ background: C.bar, color: '#fff', display: 'flex', alignItems: 'stretch', borderBottom: `2px solid ${C.accent}`, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}><LayoutGrid size={16} /></div>
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>MONITORING // REALTIME</div>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>
                            แสดงผลข้อมูลมิเตอร์จากตาราง <code style={{ color: C.accent, padding: '1px 4px', background: C.barSub + '1a', fontFamily: MONO }}>meter_data_realtime</code>
                        </div>
                    </div>
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', fontFamily: MONO, fontSize: 11.5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: C.barSub }}>LAST SYNC:</span>
                        <span style={{ color: '#fff', fontWeight: 700 }}>{lastFetchTime || '-'}</span>
                    </div>

                    <button 
                        onClick={() => fetchLatestData(false)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 5, fontFamily: MONO, fontSize: 11, color: '#fff',
                            background: 'transparent', border: `1px solid #ffffff33`, padding: '5px 9px', cursor: 'pointer'
                        }}
                        title="Force Sync Data"
                    >
                        <RefreshCw size={11} className={dbSyncStatus === 'syncing' ? 'spin' : ''} /> SYNC
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
                {/* Database Sync Status Card */}
                <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRadius: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontFamily: MONO, color: C.sub, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sync Status</span>
                        <Radio size={20} style={{ color: syncColor }} />
                    </div>
                    <h3 style={{ fontSize: '24px', fontWeight: 800, fontFamily: MONO, margin: '10px 0 4px 0', color: C.ink }}>
                        {dbSyncStatus === 'active' ? 'Connected' : dbSyncStatus === 'syncing' ? 'Syncing...' : 'Error'}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontFamily: MONO, color: syncColor, fontWeight: 600 }}>
                        <span style={{
                            width: 8, height: 8, borderRadius: '50%',
                            backgroundColor: syncColor,
                            boxShadow: dbSyncStatus === 'active' ? `0 0 8px ${C.green}` : 'none'
                        }} />
                        {dbSyncStatus === 'active' ? 'LIVE TELEMETRY (5S)' : 'UPDATING CACHE...'}
                    </div>
                </div>

                {/* Active Meters Card */}
                <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRadius: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontFamily: MONO, color: C.sub, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Power Meters</span>
                        <Cpu size={20} style={{ color: C.accent }} />
                    </div>
                    <h3 style={{ fontSize: '24px', fontWeight: 800, fontFamily: MONO, margin: '10px 0 4px 0', color: C.ink }}>
                        {activeCount} / 5
                    </h3>
                    <span style={{ fontSize: '11px', color: C.sub, fontWeight: 600, fontFamily: MONO }}>
                        ACTIVE CHANNELS IN PROCESS
                    </span>
                </div>

                {/* Total Load Card */}
                <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRadius: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontFamily: MONO, color: C.sub, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Active Load</span>
                        <Zap size={20} style={{ color: C.yellow }} />
                    </div>
                    <h3 style={{ fontSize: '24px', fontWeight: 800, fontFamily: MONO, margin: '10px 0 4px 0', color: C.yellow }}>
                        {totalPower.toLocaleString([], { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW
                    </h3>
                    <span style={{ fontSize: '11px', color: C.sub, fontWeight: 600, fontFamily: MONO }}>
                        AGGREGATED REALTIME POWER DEMAND
                    </span>
                </div>

                {/* Avg Voltage Card */}
                <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRadius: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontFamily: MONO, color: C.sub, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Avg Line-to-Neutral</span>
                        <Activity size={20} style={{ color: C.accent }} />
                    </div>
                    <h3 style={{ fontSize: '24px', fontWeight: 800, fontFamily: MONO, margin: '10px 0 4px 0', color: C.ink }}>
                        {avgVoltage.toFixed(1)} V
                    </h3>
                    <span style={{ fontSize: '11px', color: avgVoltage > 215 && avgVoltage < 230 ? C.green : C.red, fontWeight: 600, fontFamily: MONO }}>
                        {avgVoltage > 215 && avgVoltage < 230 ? 'VOLTAGE NOMINAL' : 'VOLTAGE OUT OF TOLERANCE'}
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
                {/* Real-time Line Chart */}
                <div style={{
                    background: C.panel,
                    border: `1px solid ${C.line}`,
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    borderRadius: 0
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, fontFamily: MONO, color: C.ink, display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase' }}>
                            <Activity size={16} style={{ color: C.accent }} />
                            ACTIVE POWER LOAD WAVEFORM (kW)
                        </h4>
                        <span style={{ fontSize: '10px', fontFamily: MONO, color: C.sub, fontWeight: 600 }}>15-POINT BUFFER</span>
                    </div>

                    <div style={{ width: '100%', height: 300 }}>
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                    <defs>
                                        {meters.map((m, idx) => (
                                            <linearGradient key={m.meter_code} id={`color-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={chartColors[idx % chartColors.length]} stopOpacity={0.15}/>
                                                <stop offset="95%" stopColor={chartColors[idx % chartColors.length]} stopOpacity={0}/>
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                                    <XAxis dataKey="time" stroke={C.sub} style={{ fontSize: 9, fontFamily: MONO, fontWeight: 600 }} />
                                    <YAxis stroke={C.sub} style={{ fontSize: 9, fontFamily: MONO, fontWeight: 600 }} unit=" kW" />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: C.panel, borderColor: C.line, color: C.ink, borderRadius: 0, fontFamily: MONO }}
                                        itemStyle={{ fontSize: 11, fontWeight: 600 }}
                                        labelStyle={{ fontSize: 11, fontWeight: 'bold', color: C.sub, marginBottom: 4 }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: 10, fontFamily: MONO, paddingTop: 10, fontWeight: 600, color: C.ink }} />
                                    {meters.map((m, idx) => (
                                        <Area
                                            key={m.meter_code}
                                            type="monotone"
                                            dataKey={m.meter_name}
                                            stroke={chartColors[idx % chartColors.length]}
                                            fillOpacity={1}
                                            fill={`url(#color-${idx})`}
                                            strokeWidth={2}
                                            dot={false}
                                            activeDot={{ r: 4 }}
                                        />
                                    ))}
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontFamily: MONO, color: C.sub }}>
                                LOADING WAVEFORM DATA...
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
                        Realtime Alerts
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
                                                {al.type.toUpperCase()}
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
                                <span style={{ fontWeight: 600, fontFamily: MONO, fontSize: 11 }}>SYSTEM HEALTH OK</span>
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
                        METER CHANNELS REALTIME DIAGNOSTICS
                    </h4>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', fontFamily: MONO }}>
                        <thead>
                            <tr style={{ borderBottom: `2px solid ${C.line}`, color: C.sub, fontWeight: 700 }}>
                                <th style={{ padding: '12px 8px', fontSize: '11px', letterSpacing: '0.5px' }}>Code</th>
                                <th style={{ padding: '12px 8px', fontSize: '11px', letterSpacing: '0.5px' }}>Meter Name</th>
                                <th style={{ padding: '12px 8px', fontSize: '11px', letterSpacing: '0.5px' }}>Voltage (V)</th>
                                <th style={{ padding: '12px 8px', fontSize: '11px', letterSpacing: '0.5px' }}>Current (A)</th>
                                <th style={{ padding: '12px 8px', fontSize: '11px', letterSpacing: '0.5px' }}>Active Power (kW)</th>
                                <th style={{ padding: '12px 8px', fontSize: '11px', letterSpacing: '0.5px' }}>Apparent Power (kVA)</th>
                                <th style={{ padding: '12px 8px', fontSize: '11px', letterSpacing: '0.5px' }}>Power Factor</th>
                                <th style={{ padding: '12px 8px', fontSize: '11px', letterSpacing: '0.5px' }}>Frequency (Hz)</th>
                                <th style={{ padding: '12px 8px', fontSize: '11px', letterSpacing: '0.5px' }}>Total Energy (kWh)</th>
                                <th style={{ padding: '12px 8px', fontSize: '11px', letterSpacing: '0.5px' }}>Update Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {meters.length > 0 ? (
                                meters.map(m => {
                                    const avgV = (m.vl1 + m.vl2 + m.vl3) / 3;
                                    const avgI = (m.il1 + m.il2 + m.il3) / 3;
                                    const avgPf = (m.pf1 + m.pf2 + m.pf3) / 3;
                                    const isFlashing = flashingRows[m.meter_code];

                                    return (
                                        <tr key={m.meter_code} style={{
                                            borderBottom: `1px solid ${C.line}`,
                                            backgroundColor: isFlashing 
                                                ? (theme === 'light' ? 'rgba(43,76,126,0.12)' : 'rgba(54,194,206,0.12)') 
                                                : 'transparent',
                                            transition: isFlashing ? 'none' : 'background-color 0.8s ease',
                                            color: C.ink,
                                            fontWeight: 500
                                        }}>
                                            <td style={{ padding: '14px 8px', fontWeight: 700 }}>{m.meter_code}</td>
                                            <td style={{ padding: '14px 8px', color: C.accent, fontWeight: 700 }}>{m.meter_name}</td>
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
                                                {new Date(m.device_datetime).toLocaleTimeString()}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: C.sub }}>
                                        NO METER REGISTRIES FOUND
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

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
