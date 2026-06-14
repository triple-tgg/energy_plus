import React, { useState, useCallback } from 'react';
import FilterBar from '../../components/ui/FilterBar';
import type { FilterValues } from '../../components/ui/FilterBar';
import { dashboardApi } from '../../api/client';
import { Line } from 'react-chartjs-2';
import { LayoutGrid } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import {
    Chart as ChartJS,
    CategoryScale, LinearScale, PointElement, LineElement,
    Title, Tooltip, Legend, Filler,
} from 'chart.js';

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, "Cascadia Mono", monospace';

const THEMES = {
    light: {
        bg: '#EAE7DA', panel: '#FBFAF4', panel2: '#F1EFE3', ink: '#23261E', sub: '#6E705F',
        line: '#D4D1C0', bar: '#23261E', barSub: '#A6A892', accent: '#2B4C7E',
        green: '#16a34a', yellow: '#C08A1E', red: '#dc2626',
    },
    dark: {
        bg: '#0E1116', panel: '#161B22', panel2: '#1C232E', ink: '#E6EDF3', sub: '#8B98A6',
        line: '#2A313C', bar: '#080A0E', barSub: '#8B98A6', accent: '#36C2CE',
        green: '#34d399', yellow: '#D29922', red: '#f85149',
    },
};

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const DemandDashboard: React.FC = () => {
    const { theme } = useTheme();
    const C = THEMES[theme];
    const [loading, setLoading] = useState(false);
    const [chartData, setChartData] = useState<any>(null);
    const [summary, setSummary] = useState<any>(null);

    const fetchData = useCallback(async (filters: FilterValues) => {
        setLoading(true);
        try {
            const res = await dashboardApi.getDemand({
                siteId: filters.siteId,
                buildingId: filters.buildingId,
                startDate: filters.startDate,
                endDate: filters.endDate,
            });
            const d = res.data.data || res.data;

            const summaryObj = {
                currentDemand: d.currentDemand || d.current_demand || 0,
                peakDemand: d.peakDemand || d.peak_demand || 0,
                setpoint: d.setpoint || d.demand_setpoint || 0,
                warningLevel: d.warningLevel || d.warning_level || 0,
            };
            setSummary(summaryObj);

            const history = d.history || d.timeseries || [];
            if (history.length > 0) {
                const activeC = THEMES[localStorage.getItem('ec-theme') as 'light' | 'dark' || 'light'];
                setChartData({
                    labels: history.map((h: any) => h.time || h.timestamp),
                    datasets: [
                        {
                            label: 'Actual Demand (kW)',
                            data: history.map((h: any) => h.demand || h.kw || 0),
                            borderColor: activeC.accent,
                            backgroundColor: localStorage.getItem('ec-theme') === 'light' ? 'rgba(43,76,126,0.08)' : 'rgba(54,194,206,0.08)',
                            fill: true,
                            tension: 0.2,
                        },
                        {
                            label: 'Setpoint (kW)',
                            data: history.map(() => d.setpoint || d.demand_setpoint || 0),
                            borderColor: activeC.green,
                            borderDash: [8, 4],
                            pointRadius: 0,
                        },
                        {
                            label: 'Warning Level (kW)',
                            data: history.map(() => d.warningLevel || d.warning_level || 0),
                            borderColor: activeC.yellow,
                            borderDash: [4, 4],
                            pointRadius: 0,
                        },
                    ],
                });
            }
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    }, []);

    const gaugePercent = summary ? Math.min((summary.currentDemand / (summary.setpoint || 1)) * 100, 100) : 0;
    const gaugeColor = gaugePercent > 90 ? C.red : gaugePercent > 75 ? C.yellow : C.green;

    return (
        <div>
            {/* Command bar */}
            <div style={{ background: C.bar, color: '#fff', display: 'flex', alignItems: 'stretch', borderBottom: `2px solid ${C.accent}`, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}><LayoutGrid size={16} /></div>
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>DASHBOARD // DEMAND</div>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>ควบคุมเฝ้าระวังความต้องการกำลังไฟพีคของระบบ (Demand Peak Control)</div>
                    </div>
                </div>
            </div>

            <FilterBar onSubmit={fetchData} loading={loading} showMeterType={false} showZone={false} />

            {/* Summary Cards */}
            {summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
                    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 0, padding: '20px', textAlign: 'center' }}>
                        <div style={{ fontSize: 11, fontFamily: MONO, color: C.sub, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.8px', marginBottom: 8 }}>Current Demand</div>
                        <div style={{ fontSize: 32, fontWeight: 700, fontFamily: MONO, color: gaugeColor }}>{Number(summary.currentDemand).toLocaleString()}</div>
                        <div style={{ fontSize: 12, fontFamily: MONO, color: C.sub }}>kW</div>
                        <div style={{ marginTop: 12, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 0, height: 10, overflow: 'hidden' }}>
                            <div style={{ width: `${gaugePercent}%`, height: '100%', background: gaugeColor, transition: 'width 0.5s ease' }} />
                        </div>
                        <div style={{ fontSize: 10, fontFamily: MONO, color: C.sub, marginTop: 4 }}>{gaugePercent.toFixed(1)}% of setpoint</div>
                    </div>
                    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 0, padding: '20px', textAlign: 'center' }}>
                        <div style={{ fontSize: 11, fontFamily: MONO, color: C.sub, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.8px', marginBottom: 8 }}>Peak Demand</div>
                        <div style={{ fontSize: 32, fontWeight: 700, fontFamily: MONO, color: C.red }}>{Number(summary.peakDemand).toLocaleString()}</div>
                        <div style={{ fontSize: 12, fontFamily: MONO, color: C.sub }}>kW</div>
                    </div>
                    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 0, padding: '20px', textAlign: 'center' }}>
                        <div style={{ fontSize: 11, fontFamily: MONO, color: C.sub, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.8px', marginBottom: 8 }}>Setpoint</div>
                        <div style={{ fontSize: 32, fontWeight: 700, fontFamily: MONO, color: C.green }}>{Number(summary.setpoint).toLocaleString()}</div>
                        <div style={{ fontSize: 12, fontFamily: MONO, color: C.sub }}>kW</div>
                    </div>
                    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 0, padding: '20px', textAlign: 'center' }}>
                        <div style={{ fontSize: 11, fontFamily: MONO, color: C.sub, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.8px', marginBottom: 8 }}>Warning Level</div>
                        <div style={{ fontSize: 32, fontWeight: 700, fontFamily: MONO, color: C.yellow }}>{Number(summary.warningLevel).toLocaleString()}</div>
                        <div style={{ fontSize: 12, fontFamily: MONO, color: C.sub }}>kW</div>
                    </div>
                </div>
            )}

            {/* Chart */}
            {chartData && (
                <div style={{
                    background: C.panel,
                    borderRadius: 0,
                    border: `1px solid ${C.line}`,
                    padding: '20px 24px',
                }}>
                    <h3 style={{ marginBottom: 16, fontWeight: 700, fontFamily: MONO, fontSize: 14, color: C.ink, letterSpacing: '0.5px' }}>DEMAND PEAK VS SETPOINT</h3>
                    <div style={{ height: 400 }}>
                        <Line
                            data={chartData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                interaction: { mode: 'index', intersect: false },
                                plugins: {
                                    legend: { 
                                        position: 'top',
                                        labels: {
                                            color: C.ink,
                                            font: { family: MONO, size: 11 }
                                        }
                                    },
                                },
                                scales: {
                                    y: { 
                                        beginAtZero: true, 
                                        grid: { color: C.line },
                                        ticks: { color: C.sub, font: { family: MONO, size: 10 } }
                                    },
                                    x: { 
                                        grid: { display: false },
                                        ticks: { color: C.sub, font: { family: MONO, size: 10 } }
                                    },
                                },
                            }}
                        />
                    </div>
                </div>
            )}

            {loading && (
                <div style={{ textAlign: 'center', padding: 60, fontFamily: MONO, color: C.sub }}>
                    ⏳ LOADING DEMAND TELEMETRY...
                </div>
            )}
        </div>
    );
};

export default DemandDashboard;
