import React, { useState, useCallback } from 'react';
import FilterBar from '../../components/ui/FilterBar';
import type { FilterValues } from '../../components/ui/FilterBar';
import ExportButtons from '../../components/ui/ExportButtons';
import DataTable from '../../components/ui/DataTable';
import { reportsApi } from '../../api/client';

const ComparisonReportPage: React.FC = () => {
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
            const res = await reportsApi.getComparison({ ...filters, page, limit });
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [page, limit]);

    const handleExport = async () => {
        try {
            const res = await reportsApi.exportExcel('comparison', currentFilters);
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `comparison_${new Date().toISOString().substring(0, 10)}.xlsx`);
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
        { key: 'zone_name', title: 'โซน' },
        { key: 'room_code', title: 'รหัสห้อง' },
        { key: 'room_name', title: 'ชื่อห้อง' },
        {
            key: 'prev_month', title: 'เดือนก่อนหน้า(1)',
            render: (v: string) => v || '—',
        },
        {
            key: 'prev_units', title: 'หน่วยที่ใช้(1)',
            render: (v: number) => v != null ? Number(v).toLocaleString('th-TH', { maximumFractionDigits: 2 }) : '—',
        },
        {
            key: 'current_month', title: 'เดือนปัจจุบัน(2)',
            render: (v: string) => v || '—',
        },
        {
            key: 'current_units', title: 'หน่วยที่ใช้(2)',
            render: (v: number) => v != null ? Number(v).toLocaleString('th-TH', { maximumFractionDigits: 2 }) : '—',
        },
        {
            key: 'diff_percent', title: '% เปรียบเทียบ',
            render: (v: number) => {
                if (v == null) return '—';
                const color = v > 0 ? 'var(--danger)' : v < 0 ? 'var(--success)' : 'var(--text)';
                const arrow = v > 0 ? '▲' : v < 0 ? '▼' : '—';
                return (
                    <strong style={{ color }}>
                        {arrow} {Math.abs(v).toFixed(2)}%
                    </strong>
                );
            },
        },
    ];

    return (
        <div>
            <h1 className="page-title"><span className="page-title__icon">📈</span>การใช้พลังงานเปรียบเทียบเดือนก่อน</h1>
            <FilterBar
                onSubmit={fetchData}
                loading={loading}
                showDateRange={false}
                showMonthYear
                actions={<ExportButtons onExportExcel={handleExport} />}
            />
            <DataTable title="เปรียบเทียบการใช้พลังงาน" columns={columns} data={data} total={total} page={page} limit={limit} loading={loading} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />
        </div>
    );
};

export default ComparisonReportPage;
