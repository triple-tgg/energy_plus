import React, { useState, useCallback } from 'react';
import FilterBar from '../../components/ui/FilterBar';
import type { FilterValues } from '../../components/ui/FilterBar';
import ExportButtons from '../../components/ui/ExportButtons';
import DataTable from '../../components/ui/DataTable';
import { dashboardApi, reportsApi } from '../../api/client';

const ConsumptionTable: React.FC = () => {
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
            const res = await dashboardApi.getConsumptionTable({
                siteId: filters.siteId,
                buildingId: filters.buildingId,
                zoneId: filters.zoneId,
                startDate: filters.startDate,
                endDate: filters.endDate,
                meterTypeId: filters.meterTypeId,
                page, limit,
            });
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    }, [page, limit]);

    const handleExportExcel = async () => {
        try {
            const res = await reportsApi.exportExcel('energy-consumption', currentFilters);
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `consumption_${new Date().toISOString().substring(0, 10)}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error(err);
            alert('Export failed');
        }
    };

    const columns = [
        { key: 'meter_code', title: 'รหัสมิเตอร์' },
        { key: 'meter_name', title: 'ชื่อมิเตอร์' },
        { key: 'building_name', title: 'อาคาร' },
        { key: 'zone_name', title: 'โซน' },
        { key: 'room_name', title: 'ห้อง' },
        {
            key: 'kwh', title: 'KWh',
            render: (v: number) => v != null ? <strong>{Number(v).toLocaleString('th-TH', { maximumFractionDigits: 2 })}</strong> : '—',
        },
        {
            key: 'kw', title: 'KW',
            render: (v: number) => v != null ? Number(v).toLocaleString('th-TH', { maximumFractionDigits: 2 }) : '—',
        },
        {
            key: 'kva', title: 'KVA',
            render: (v: number) => v != null ? Number(v).toLocaleString('th-TH', { maximumFractionDigits: 2 }) : '—',
        },
        {
            key: 'frequency', title: 'Frequency',
            render: (v: number) => v != null ? Number(v).toFixed(2) : '—',
        },
    ];

    return (
        <div>
            <h1 className="page-title">
                <span className="page-title__icon">📋</span>
                Consumption Table
            </h1>

            <FilterBar
                onSubmit={fetchData}
                loading={loading}
                showSearchMeter
                actions={
                    <ExportButtons onExportExcel={handleExportExcel} />
                }
            />

            <DataTable
                title="ข้อมูลการใช้ไฟรายมิเตอร์"
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

export default ConsumptionTable;
