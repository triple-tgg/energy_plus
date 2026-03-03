import React, { useState, useCallback } from 'react';
import FilterBar from '../../components/ui/FilterBar';
import type { FilterValues } from '../../components/ui/FilterBar';
import DataTable from '../../components/ui/DataTable';
import { dashboardApi } from '../../api/client';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const MdbDashboard: React.FC = () => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [chartData, setChartData] = useState<any>(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);

    const fetchData = useCallback(async (filters: FilterValues) => {
        setLoading(true);
        try {
            const res = await dashboardApi.getMdbConsumption({
                siteId: filters.siteId,
                buildingId: filters.buildingId,
                zoneId: filters.zoneId,
                startDate: filters.startDate,
                endDate: filters.endDate,
                page, limit,
            });
            const items = res.data.data || [];
            setData(items);
            setTotal(res.data.pagination?.total || items.length);

            // Build chart
            if (items.length > 0) {
                setChartData({
                    labels: items.map((d: any) => d.mdb_name || d.name || `MDB-${d.id}`),
                    datasets: [{
                        label: 'Energy (kWh)',
                        data: items.map((d: any) => d.kwh || d.total_kwh || 0),
                        backgroundColor: 'rgba(99, 102, 241, 0.7)',
                        borderColor: 'rgba(99, 102, 241, 1)',
                        borderWidth: 1,
                        borderRadius: 6,
                    }],
                });
            }
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    }, [page, limit]);

    const columns = [
        { key: 'mdb_name', title: 'MDB' },
        { key: 'meter_code', title: 'รหัสมิเตอร์' },
        { key: 'building_name', title: 'อาคาร' },
        { key: 'zone_name', title: 'โซน' },
        {
            key: 'kwh', title: 'KWh',
            render: (v: number) => v != null ? Number(v).toLocaleString('th-TH', { maximumFractionDigits: 2 }) : '—',
        },
        {
            key: 'kw', title: 'KW',
            render: (v: number) => v != null ? Number(v).toLocaleString('th-TH', { maximumFractionDigits: 2 }) : '—',
        },
        {
            key: 'kva', title: 'KVA',
            render: (v: number) => v != null ? Number(v).toLocaleString('th-TH', { maximumFractionDigits: 2 }) : '—',
        },
    ];

    return (
        <div>
            <h1 className="page-title">
                <span className="page-title__icon">⚡</span>
                MDB Consumption Dashboard
            </h1>

            <FilterBar onSubmit={fetchData} loading={loading} showSearchMeter={false} />

            {chartData && (
                <div style={{
                    background: 'var(--surface)',
                    borderRadius: 'var(--radius-xl)',
                    border: '1px solid var(--border-light)',
                    padding: '20px 24px',
                    marginBottom: 20,
                    boxShadow: 'var(--shadow-sm)',
                }}>
                    <h3 style={{ marginBottom: 16, fontWeight: 600 }}>Energy Consumption by MDB (kWh)</h3>
                    <div style={{ height: 350 }}>
                        <Bar
                            data={chartData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
                                scales: {
                                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' } },
                                    x: { grid: { display: false } },
                                },
                            }}
                        />
                    </div>
                </div>
            )}

            <DataTable
                title="รายละเอียด MDB"
                columns={columns}
                data={data}
                total={total}
                page={page}
                limit={limit}
                loading={loading}
                onPageChange={setPage}
                onLimitChange={(l) => { setLimit(l); setPage(1); }}
            />
        </div>
    );
};

export default MdbDashboard;
