import React, { useState, useCallback } from 'react';
import FilterBar from '../../components/ui/FilterBar';
import type { FilterValues } from '../../components/ui/FilterBar';
import { dashboardApi } from '../../api/client';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale, LinearScale, PointElement, LineElement,
    Title, Tooltip, Legend, Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const DemandDashboard: React.FC = () => {
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

            setSummary({
                currentDemand: d.currentDemand || d.current_demand || 0,
                peakDemand: d.peakDemand || d.peak_demand || 0,
                setpoint: d.setpoint || d.demand_setpoint || 0,
                warningLevel: d.warningLevel || d.warning_level || 0,
            });

            const history = d.history || d.timeseries || [];
            if (history.length > 0) {
                setChartData({
                    labels: history.map((h: any) => h.time || h.timestamp),
                    datasets: [
                        {
                            label: 'Actual Demand (kW)',
                            data: history.map((h: any) => h.demand || h.kw || 0),
                            borderColor: '#6366f1',
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            fill: true,
                            tension: 0.4,
                        },
                        {
                            label: 'Setpoint (kW)',
                            data: history.map(() => d.setpoint || d.demand_setpoint || 0),
                            borderColor: '#10b981',
                            borderDash: [8, 4],
                            pointRadius: 0,
                        },
                        {
                            label: 'Warning Level (kW)',
                            data: history.map(() => d.warningLevel || d.warning_level || 0),
                            borderColor: '#f59e0b',
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
    const gaugeColor = gaugePercent > 90 ? 'var(--danger)' : gaugePercent > 75 ? 'var(--warning)' : 'var(--success)';

    return (
        <div>
            <h1 className="page-title">
                <span className="page-title__icon">📈</span>
                Demand Dashboard
            </h1>

            <FilterBar onSubmit={fetchData} loading={loading} showMeterType={false} showZone={false} />

            {/* Summary Cards */}
            {summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', padding: '20px', boxShadow: 'var(--shadow-sm)', textAlign: 'center' }}>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Current Demand</div>
                        <div style={{ fontSize: 32, fontWeight: 700, color: gaugeColor }}>{Number(summary.currentDemand).toLocaleString()}</div>
                        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>kW</div>
                        <div style={{ marginTop: 12, background: 'var(--slate-100)', borderRadius: 'var(--radius-full)', height: 8, overflow: 'hidden' }}>
                            <div style={{ width: `${gaugePercent}%`, height: '100%', background: gaugeColor, borderRadius: 'var(--radius-full)', transition: 'width 0.5s ease' }} />
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{gaugePercent.toFixed(1)}% of setpoint</div>
                    </div>
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', padding: '20px', boxShadow: 'var(--shadow-sm)', textAlign: 'center' }}>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Peak Demand</div>
                        <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--danger)' }}>{Number(summary.peakDemand).toLocaleString()}</div>
                        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>kW</div>
                    </div>
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', padding: '20px', boxShadow: 'var(--shadow-sm)', textAlign: 'center' }}>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Setpoint</div>
                        <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--success)' }}>{Number(summary.setpoint).toLocaleString()}</div>
                        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>kW</div>
                    </div>
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', padding: '20px', boxShadow: 'var(--shadow-sm)', textAlign: 'center' }}>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Warning Level</div>
                        <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--warning)' }}>{Number(summary.warningLevel).toLocaleString()}</div>
                        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>kW</div>
                    </div>
                </div>
            )}

            {/* Chart */}
            {chartData && (
                <div style={{
                    background: 'var(--surface)',
                    borderRadius: 'var(--radius-xl)',
                    border: '1px solid var(--border-light)',
                    padding: '20px 24px',
                    boxShadow: 'var(--shadow-sm)',
                }}>
                    <h3 style={{ marginBottom: 16, fontWeight: 600 }}>Demand Peak vs Setpoint</h3>
                    <div style={{ height: 400 }}>
                        <Line
                            data={chartData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                interaction: { mode: 'index', intersect: false },
                                plugins: {
                                    legend: { position: 'top' },
                                },
                                scales: {
                                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' } },
                                    x: { grid: { display: false } },
                                },
                            }}
                        />
                    </div>
                </div>
            )}

            {loading && (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                    ⏳ กำลังโหลดข้อมูล...
                </div>
            )}
        </div>
    );
};

export default DemandDashboard;
