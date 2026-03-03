import React, { useState, useCallback } from 'react';
import FilterBar from '../../components/ui/FilterBar';
import type { FilterValues } from '../../components/ui/FilterBar';
import DataTable from '../../components/ui/DataTable';
import { demandPeakApi } from '../../api/client';

const DemandPeakPage: React.FC = () => {
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
                const color = v > 90 ? 'var(--danger)' : v > 75 ? 'var(--warning)' : 'var(--success)';
                return <strong style={{ color }}>{v.toFixed(1)}%</strong>;
            },
        },
    ];

    return (
        <div>
            <h1 className="page-title"><span className="page-title__icon">⚡</span>พยากรณ์ Demand Peak</h1>
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
