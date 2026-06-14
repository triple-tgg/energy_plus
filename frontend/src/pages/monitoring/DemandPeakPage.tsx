import React, { useState, useCallback } from 'react';
import FilterBar from '../../components/ui/FilterBar';
import type { FilterValues } from '../../components/ui/FilterBar';
import DataTable from '../../components/ui/DataTable';
import { demandPeakApi } from '../../api/client';
import { LayoutGrid } from 'lucide-react';
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

const DemandPeakPage: React.FC = () => {
    const { theme } = useTheme();
    const C = THEMES[theme];
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(false);

    const fetchData = useCallback(async (filters: FilterValues) => {
        setLoading(true);
        try {
            const res = await demandPeakApi.getData({
                startDate: filters.startDate,
                endDate: filters.endDate,
                siteId: filters.siteId,
                buildingId: filters.buildingId,
                zoneId: filters.zoneId,
                searchMeter: filters.searchMeter,
                page, limit,
            });
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [page, limit]);

    const columns = [
        {
            key: 'timestamp', title: 'วันที่/เวลา',
            render: (v: string) => v ? new Date(v).toLocaleString('th-TH') : '—',
        },
        { key: 'meter_code', title: 'รหัสมิเตอร์' },
        { key: 'meter_name', title: 'ชื่อมิเตอร์' },
        { key: 'building_name', title: 'อาคาร' },
        { key: 'zone_name', title: 'โซน' },
        {
            key: 'demand_kw', title: 'Demand (kW)',
            render: (v: number) => v != null ? <strong>{Number(v).toLocaleString('th-TH', { maximumFractionDigits: 2 })}</strong> : '—',
        },
        {
            key: 'setpoint', title: 'Setpoint (kW)',
            render: (v: number) => v != null ? Number(v).toLocaleString('th-TH', { maximumFractionDigits: 2 }) : '—',
        },
        {
            key: 'peak_percent', title: '% of Peak',
            render: (v: number) => {
                if (v == null) return '—';
                const color = v > 90 ? C.red : v > 75 ? C.yellow : C.green;
                return <strong style={{ color }}>{v.toFixed(1)}%</strong>;
            },
        },
    ];

    return (
        <div>
            {/* Command bar */}
            <div style={{ background: C.bar, color: '#fff', display: 'flex', alignItems: 'stretch', borderBottom: `2px solid ${C.accent}`, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}><LayoutGrid size={16} /></div>
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>MONITORING // DEMAND PEAK</div>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>พยากรณ์และเฝ้าระวังความต้องการพลังงานไฟฟ้าสูงสุดระดับพื้นที่</div>
                    </div>
                </div>
            </div>
            <FilterBar
                onSubmit={fetchData}
                loading={loading}
                showSearchMeter
            />
            <DataTable title="ข้อมูล Demand Peak" columns={columns} data={data} total={total} page={page} limit={limit} loading={loading} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />
        </div>
    );
};

export default DemandPeakPage;
