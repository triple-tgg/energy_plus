import React, { useState, useCallback } from 'react';
import FilterBar from '../../components/ui/FilterBar';
import type { FilterValues } from '../../components/ui/FilterBar';
import ExportButtons from '../../components/ui/ExportButtons';
import DataTable from '../../components/ui/DataTable';
import { reportsApi } from '../../api/client';

const HistoryReportPage: React.FC = () => {
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
            const res = await reportsApi.getHistory({ ...filters, page, limit });
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [page, limit]);

    const handleExport = async () => {
        try {
            const res = await reportsApi.exportExcel('history', currentFilters);
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `history_${new Date().toISOString().substring(0, 10)}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) { alert('Export failed'); }
    };

    const numCol = (key: string, title: string, digits = 2) => ({
        key, title,
        render: (v: number) => v != null ? Number(v).toLocaleString('th-TH', { maximumFractionDigits: digits }) : '—',
    });

    const columns = [
        {
            key: 'timestamp', title: 'วันที่',
            render: (v: string) => v ? new Date(v).toLocaleString('th-TH') : '—',
        },
        numCol('kwh', 'KWh'),
        numCol('kva', 'Kva'),
        numCol('kw', 'Kw'),
        numCol('kvar', 'Kvar'),
        numCol('frequency', 'Frequency'),
        numCol('pwl1', 'PWL1'),
        numCol('pwl2', 'PWL2'),
        numCol('pwl3', 'PWL3'),
        numCol('kw1', 'KW1'),
        numCol('kw2', 'KW2'),
        numCol('kw3', 'KW3'),
        numCol('kvah', 'KVAh'),
        numCol('kvarh', 'KVARh'),
        numCol('volt_p1', 'VoltP1'),
        numCol('volt_p2', 'VoltP2'),
        numCol('volt_p3', 'VoltP3'),
        numCol('volt_l1', 'VoltL1'),
        numCol('volt_l2', 'VoltL2'),
        numCol('volt_l3', 'VoltL3'),
        numCol('amp1', 'Amp1'),
        numCol('amp2', 'Amp2'),
        numCol('amp3', 'Amp3'),
    ];

    return (
        <div>
            <h1 className="page-title"><span className="page-title__icon">📜</span>ข้อมูลพลังงานย้อนหลัง</h1>
            <FilterBar
                onSubmit={fetchData}
                loading={loading}
                showSearchMeter
                actions={<ExportButtons onExportExcel={handleExport} />}
            />
            <DataTable title="ข้อมูลพลังงานย้อนหลัง" columns={columns} data={data} total={total} page={page} limit={limit} loading={loading} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />
        </div>
    );
};

export default HistoryReportPage;
