import React, { useEffect, useState } from 'react';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { dashboardApi } from '../../api/client';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const ZoneDashboard: React.FC = () => {
    const [barData, setBarData] = useState<any>(null);
    const [pieData, setPieData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await dashboardApi.getZoneConsumption({ period: 'week' });
                const raw = res.data.data || [];
                // Group data for charts
                const zones = [...new Set(raw.map((r: any) => r.zone_name))] as string[];
                const dates = [...new Set(raw.map((r: any) => r.date))] as string[];
                dates.sort();
                const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

                // Bar chart
                setBarData({
                    labels: dates.map((d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })),
                    datasets: zones.map((zone: string, idx: number) => ({
                        label: zone,
                        data: dates.map((date: string) => {
                            const row = raw.find((r: any) => r.zone_name === zone && r.date === date);
                            return row ? parseFloat(row.total_kwh) : 0;
                        }),
                        backgroundColor: colors[idx % colors.length],
                        borderRadius: 4,
                    })),
                });

                // Pie chart
                const zoneTotals = zones.map((zone: string) => ({
                    zone,
                    total: raw.filter((r: any) => r.zone_name === zone).reduce((sum: number, r: any) => sum + parseFloat(r.total_kwh || 0), 0),
                }));
                setPieData({
                    labels: zoneTotals.map((z: any) => z.zone),
                    datasets: [{
                        data: zoneTotals.map((z: any) => z.total),
                        backgroundColor: colors.slice(0, zoneTotals.length),
                        borderWidth: 0,
                    }],
                });
            } catch (e) { console.error(e); }
            setLoading(false);
        })();
    }, []);

    if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

    return (
        <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>📊 Zone Consumption Dashboard</h2>
            <div className="charts-grid">
                <div className="chart-container">
                    <div className="chart-header">
                        <span className="chart-title">Energy Consumption by Zone (kWh)</span>
                    </div>
                    {barData ? (
                        <Bar data={barData} options={{ responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }} />
                    ) : <p style={{ color: 'var(--text-light)', textAlign: 'center' }}>No data available</p>}
                </div>
                <div className="chart-container">
                    <div className="chart-header">
                        <span className="chart-title">Zone Distribution</span>
                    </div>
                    {pieData ? (
                        <Pie data={pieData} options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }} />
                    ) : <p style={{ color: 'var(--text-light)', textAlign: 'center' }}>No data available</p>}
                </div>
            </div>
        </div>
    );
};

export default ZoneDashboard;
