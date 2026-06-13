import React, { useEffect, useState, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, ShieldAlert, Cpu, Radio, Zap, RefreshCw, AlertTriangle } from 'lucide-react';
import axios from 'axios';

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
    const chartColors = ['#1d4ed8', '#059669', '#d97706', '#be185d', '#6d28d9'];

    return (
        <div style={{ color: '#1e293b', padding: '10px 0' }}>
            {/* Header section with white/light theme */}
            <div className="card" style={{
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
                marginBottom: '24px',
                border: '1px solid var(--border-light)'
            }}>
                <div>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Radio style={{ animation: dbSyncStatus === 'active' ? 'pulse 2s infinite' : 'none', color: 'var(--primary-600)' }} />
                        Live Database Real-time Monitor
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '14px', fontWeight: 500 }}>
                        แสดงผลข้อมูลมิเตอร์จากตาราง <code style={{ color: 'var(--primary-600)', background: 'var(--primary-50)', padding: '2px 6px', borderRadius: '4px' }}>meter_data_realtime</code> อัปเดตผ่าน API ทุกๆ 5 วินาที
                    </p>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Last Sync</span>
                        <span style={{ fontSize: '14px', color: 'var(--text)', fontWeight: 800 }}>{lastFetchTime || '-'}</span>
                    </div>

                    <button 
                        onClick={() => fetchLatestData(false)}
                        className="btn btn-outline"
                        style={{
                            borderRadius: '8px',
                            padding: '8px 14px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '13px',
                            fontWeight: 700,
                            borderColor: 'var(--border)'
                        }}
                    >
                        <RefreshCw size={14} className={dbSyncStatus === 'syncing' ? 'spin' : ''} /> Force Sync
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
                <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 700 }}>Sync Status</span>
                        <Radio size={20} style={{
                            color: dbSyncStatus === 'active' ? '#059669' : dbSyncStatus === 'syncing' ? '#d97706' : '#dc2626'
                        }} />
                    </div>
                    <h3 style={{ fontSize: '24px', fontWeight: 800, margin: '10px 0 4px 0', color: 'var(--text)' }}>
                        {dbSyncStatus === 'active' ? 'Connected' : dbSyncStatus === 'syncing' ? 'Syncing...' : 'Error'}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: dbSyncStatus === 'active' ? '#059669' : 'var(--text-secondary)', fontWeight: 600 }}>
                        <span style={{
                            width: 8, height: 8, borderRadius: '50%',
                            backgroundColor: dbSyncStatus === 'active' ? '#10b981' : dbSyncStatus === 'syncing' ? '#f59e0b' : '#ef4444',
                            boxShadow: dbSyncStatus === 'active' ? '0 0 8px #10b981' : 'none'
                        }} />
                        {dbSyncStatus === 'active' ? 'ดึงฐานข้อมูลแบบ Real-time (5s)' : 'กำลังอัปเดตข้อมูล...'}
                    </div>
                </div>

                {/* Active Meters Card */}
                <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 700 }}>Active Power Meters</span>
                        <Cpu size={20} style={{ color: '#0284c7' }} />
                    </div>
                    <h3 style={{ fontSize: '24px', fontWeight: 800, margin: '10px 0 4px 0', color: 'var(--text)' }}>
                        {activeCount} / 5
                    </h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        จำนวนมิเตอร์ที่จำลองขึ้นในระบบ
                    </span>
                </div>

                {/* Total Load Card */}
                <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 700 }}>Total Active Load</span>
                        <Zap size={20} style={{ color: '#d97706' }} />
                    </div>
                    <h3 style={{ fontSize: '24px', fontWeight: 800, margin: '10px 0 4px 0', color: '#d97706' }}>
                        {totalPower.toLocaleString([], { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW
                    </h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        ผลรวมโหลดทั้ง 5 มิเตอร์แบบ real-time
                    </span>
                </div>

                {/* Avg Voltage Card */}
                <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 700 }}>Avg Line-to-Neutral</span>
                        <Activity size={20} style={{ color: '#2563eb' }} />
                    </div>
                    <h3 style={{ fontSize: '24px', fontWeight: 800, margin: '10px 0 4px 0', color: 'var(--text)' }}>
                        {avgVoltage.toFixed(1)} V
                    </h3>
                    <span style={{ fontSize: '12px', color: avgVoltage > 215 && avgVoltage < 230 ? '#059669' : '#dc2626', fontWeight: 600 }}>
                        {avgVoltage > 215 && avgVoltage < 230 ? 'สถานะแรงดันไฟคงที่' : 'แรงดันไฟต่างจากมาตรฐาน'}
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
                <div className="card" style={{
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Activity size={16} style={{ color: '#2563eb' }} />
                            คลื่นการใช้พลังงานสด (Live Active Load - kW)
                        </h4>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>แสดงข้อมูล 15 จุดล่าสุด</span>
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
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.05)" />
                                    <XAxis dataKey="time" stroke="#475569" style={{ fontSize: 10, fontWeight: 600 }} />
                                    <YAxis stroke="#475569" style={{ fontSize: 10, fontWeight: 600 }} unit=" kW" />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#1e293b', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)' }}
                                        itemStyle={{ fontSize: 12, fontWeight: 600 }}
                                        labelStyle={{ fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 4 }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10, fontWeight: 600 }} />
                                    {meters.map((m, idx) => (
                                        <Area
                                            key={m.meter_code}
                                            type="monotone"
                                            dataKey={m.meter_name}
                                            stroke={chartColors[idx % chartColors.length]}
                                            fillOpacity={1}
                                            fill={`url(#color-${idx})`}
                                            strokeWidth={2.5}
                                            dot={false}
                                            activeDot={{ r: 5 }}
                                        />
                                    ))}
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                                กำลังโหลดข้อมูล...
                            </div>
                        )}
                    </div>
                </div>

                {/* Alerts panel */}
                <div className="card" style={{
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '380px',
                    overflow: 'hidden'
                }}>
                    <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShieldAlert size={16} style={{ color: '#dc2626' }} />
                        Realtime Alerts
                    </h4>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
                        {alerts.length > 0 ? (
                            alerts.map(al => (
                                <div key={al.id} style={{
                                    borderLeft: `4px solid ${al.type === 'danger' ? '#dc2626' : '#d97706'}`,
                                    background: al.type === 'danger' ? '#fef2f2' : '#fffbeb',
                                    padding: '10px 12px',
                                    borderRadius: '0 8px 8px 0',
                                    fontSize: '12px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '10px', marginBottom: '4px' }}>
                                        <span style={{ fontWeight: 700, color: al.type === 'danger' ? '#ef4444' : '#b45309' }}>
                                            {al.type.toUpperCase()}
                                        </span>
                                        <span style={{ fontWeight: 600 }}>{al.time}</span>
                                    </div>
                                    <div style={{ color: 'var(--text)', lineHeight: 1.4, fontWeight: 600 }}>{al.msg}</div>
                                </div>
                            ))
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', gap: '8px', paddingTop: '40px' }}>
                                <AlertTriangle size={28} style={{ color: 'var(--border)' }} />
                                <span style={{ fontWeight: 600 }}>No alerts at the moment</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Real-time Table */}
            <div className="card" style={{
                borderRadius: '16px',
                padding: '20px',
                overflow: 'hidden'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Cpu size={16} style={{ color: 'var(--primary-600)' }} />
                        ตารางการใช้พลังงานในแต่ละจุด (Realtime Values)
                    </h4>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 800 }}>
                                <th style={{ padding: '12px 8px' }}>Code</th>
                                <th style={{ padding: '12px 8px' }}>Meter Name</th>
                                <th style={{ padding: '12px 8px' }}>Voltage (V)</th>
                                <th style={{ padding: '12px 8px' }}>Current (A)</th>
                                <th style={{ padding: '12px 8px' }}>Active Power (kW)</th>
                                <th style={{ padding: '12px 8px' }}>Apparent Power (kVA)</th>
                                <th style={{ padding: '12px 8px' }}>Power Factor</th>
                                <th style={{ padding: '12px 8px' }}>Frequency (Hz)</th>
                                <th style={{ padding: '12px 8px' }}>Total Energy (kWh)</th>
                                <th style={{ padding: '12px 8px' }}>Update Time</th>
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
                                            borderBottom: '1px solid var(--border-light)',
                                            backgroundColor: isFlashing ? 'rgba(52, 211, 153, 0.15)' : 'transparent',
                                            transition: isFlashing ? 'none' : 'background-color 0.8s ease',
                                            color: 'var(--text)',
                                            fontWeight: 500
                                        }}>
                                            <td style={{ padding: '14px 8px', fontWeight: 700 }}>{m.meter_code}</td>
                                            <td style={{ padding: '14px 8px', color: '#0284c7', fontWeight: 600 }}>{m.meter_name}</td>
                                            <td style={{ padding: '14px 8px' }}>
                                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', fontWeight: 600 }}>
                                                    {m.vl1.toFixed(1)} / {m.vl2.toFixed(1)} / {m.vl3.toFixed(1)}
                                                </span>
                                                <span style={{ fontWeight: 700 }}>{avgV.toFixed(1)} V</span>
                                            </td>
                                            <td style={{ padding: '14px 8px' }}>
                                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', fontWeight: 600 }}>
                                                    {m.il1.toFixed(2)} / {m.il2.toFixed(2)} / {m.il3.toFixed(2)}
                                                </span>
                                                <span style={{ fontWeight: 700 }}>{avgI.toFixed(2)} A</span>
                                            </td>
                                            <td style={{ padding: '14px 8px', fontWeight: 800, color: '#d97706' }}>
                                                {m.kw_3ph.toFixed(2)} kW
                                            </td>
                                            <td style={{ padding: '14px 8px', fontWeight: 600 }}>{m.kva_3ph.toFixed(2)} kVA</td>
                                            <td style={{ padding: '14px 8px', color: avgPf > 0.85 ? '#059669' : '#dc2626', fontWeight: 700 }}>
                                                {avgPf.toFixed(3)}
                                            </td>
                                            <td style={{ padding: '14px 8px', fontWeight: 600 }}>{m.hz.toFixed(2)} Hz</td>
                                            <td style={{ padding: '14px 8px', fontWeight: 700, color: '#059669' }}>
                                                {m.import_kwhr.toLocaleString([], { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                            </td>
                                            <td style={{ padding: '14px 8px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                                                {new Date(m.device_datetime).toLocaleTimeString()}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                                        ไม่มีข้อมูลมิเตอร์
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
