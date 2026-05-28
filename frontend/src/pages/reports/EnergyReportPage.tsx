import React, { useState, useCallback } from 'react';
import FilterBar from '../../components/ui/FilterBar';
import type { FilterValues } from '../../components/ui/FilterBar';
import ExportButtons from '../../components/ui/ExportButtons';
import DataTable from '../../components/ui/DataTable';
import { reportsApi } from '../../api/client';

const EnergyReportPage: React.FC = () => {
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(false);
    const [currentFilters, setCurrentFilters] = useState<FilterValues>({});

    const fetchData = useCallback(async (filters: FilterValues) => {
        setLoading(true);
        setCurrentFilters(filters);
        try {
            const res = await reportsApi.getEnergyConsumption({
                ...filters, page, limit,
            });
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [page, limit]);

    const handleExport = async (type: 'excel' | 'text') => {
        try {
            const res = type === 'excel'
                ? await reportsApi.exportExcel('energy-consumption', currentFilters)
                : await reportsApi.exportText('energy-consumption', currentFilters);
            const ext = type === 'excel' ? 'xlsx' : 'txt';
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `energy_report_${new Date().toISOString().substring(0, 10)}.${ext}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) { alert('Export failed'); }
    };

    const columns = [
        { key: 'meter_code', title: 'รหัสมิเตอร์' },
        { key: 'customer_name', title: 'ชื่อลูกค้า' },
        { key: 'building_name', title: 'อาคาร' },
        { key: 'floor', title: 'ชั้น' },
        { key: 'site_code', title: 'รหัสสถานที่' },
        { key: 'site_name', title: 'ชื่อสถานที่' },
        {
            key: 'start_date', title: 'วันที่เริ่มจด',
            render: (v: string) => v ? new Date(v).toLocaleDateString('th-TH') : '—',
        },
        {
            key: 'start_reading', title: 'จำนวนเริ่มจด',
            render: (v: number) => v != null ? Number(v).toLocaleString('th-TH', { maximumFractionDigits: 2 }) : '—',
        },
        {
            key: 'end_date', title: 'วันที่ล่าสุด',
            render: (v: string) => v ? new Date(v).toLocaleDateString('th-TH') : '—',
        },
        {
            key: 'end_reading', title: 'จำนวนล่าสุด',
            render: (v: number) => v != null ? Number(v).toLocaleString('th-TH', { maximumFractionDigits: 2 }) : '—',
        },
        {
            key: 'units_used', title: 'จำนวนหน่วยที่ใช้',
            render: (v: number) => v != null ? <strong>{Number(v).toLocaleString('th-TH', { maximumFractionDigits: 2 })}</strong> : '—',
        },
        {
            key: 'unit_price', title: 'ราคาต่อหน่วย',
            render: (v: number) => v != null ? `฿${Number(v).toFixed(4)}` : '—',
        },
        {
            key: 'total_amount', title: 'จำนวนเงิน',
            render: (v: number) => v != null ? <strong style={{ color: 'var(--accent)' }}>฿{Number(v).toLocaleString('th-TH', { maximumFractionDigits: 2 })}</strong> : '—',
        },
    ];

    return (
        <div>
            <h1 className="page-title"><span className="page-title__icon">📊</span>การใช้พลังงานตามช่วงเวลา</h1>
            <FilterBar
                onSubmit={fetchData}
                loading={loading}
                actions={
                    <ExportButtons
                        onExportExcel={() => handleExport('excel')}
                        onExportText={() => handleExport('text')}
                    />
                }
            />
            <DataTable title="รายงานการใช้พลังงาน" columns={columns} data={data} total={total} page={page} limit={limit} loading={loading} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />
        </div>
    );
};

export default EnergyReportPage;
