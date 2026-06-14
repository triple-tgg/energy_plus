import React, { useState, useCallback } from 'react';
import FilterBar from '../../components/ui/FilterBar';
import type { FilterValues } from '../../components/ui/FilterBar';
import DataTable from '../../components/ui/DataTable';
import { dashboardApi } from '../../api/client';
import { Bar } from 'react-chartjs-2';
import { LayoutGrid } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, "Cascadia Mono", monospace';

const THEMES = {
    light: {
        bg: '#EAE7DA', panel: '#FBFAF4', panel2: '#F1EFE3', ink: '#23261E', sub: '#6E705F',
        line: '#D4D1C0', bar: '#23261E', barSub: '#A6A892', accent: '#2B4C7E',
    },
    dark: {
        bg: '#0E1116', panel: '#161B22', panel2: '#1C232E', ink: '#E6EDF3', sub: '#8B98A6',
        line: '#2A313C', bar: '#080A0E', barSub: '#8B98A6', accent: '#36C2CE',
    },
};

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const MdbDashboard: React.FC = () => {
    const { theme } = useTheme();
    const C = THEMES[theme];
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
                const activeC = THEMES[localStorage.getItem('ec-theme') as 'light' | 'dark' || 'light'];
                setChartData({
                    labels: items.map((d: any) => d.mdb_name || d.name || `MDB-${d.id}`),
                    datasets: [{
                        label: 'Energy (kWh)',
                        data: items.map((d: any) => d.kwh || d.total_kwh || 0),
                        backgroundColor: activeC.accent + 'cc',
                        borderColor: activeC.accent,
                        borderWidth: 1,
                        borderRadius: 0,
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
            {/* Command bar */}
            <div style={{ background: C.bar, color: '#fff', display: 'flex', alignItems: 'stretch', borderBottom: `2px solid ${C.accent}`, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}><LayoutGrid size={16} /></div>
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>DASHBOARD // MDB</div>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>แดชบอร์ดติดตามข้อมูลการใช้พลังงานแยกตามตู้ไฟ MDB</div>
                    </div>
                </div>
            </div>

            <FilterBar onSubmit={fetchData} loading={loading} showSearchMeter={false} />

            {chartData && (
                <div style={{
                    background: C.panel,
                    borderRadius: 0,
                    border: `1px solid ${C.line}`,
                    padding: '20px 24px',
                    marginBottom: 20,
                }}>
                    <h3 style={{ marginBottom: 16, fontWeight: 700, fontFamily: MONO, fontSize: 14, color: C.ink, letterSpacing: '0.5px' }}>ENERGY CONSUMPTION BY MDB (KWH)</h3>
                    <div style={{ height: 350 }}>
                        <Bar
                            data={chartData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
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
