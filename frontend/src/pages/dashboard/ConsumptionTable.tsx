import React, { useState, useCallback } from 'react';
import FilterBar from '../../components/ui/FilterBar';
import type { FilterValues } from '../../components/ui/FilterBar';
import ExportButtons from '../../components/ui/ExportButtons';
import DataTable from '../../components/ui/DataTable';
import { dashboardApi, reportsApi } from '../../api/client';
import { LayoutGrid } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';

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

const ConsumptionTable: React.FC = () => {
    const { theme } = useTheme();
    const { t } = useLanguage();
    const C = THEMES[theme];
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
            alert(t('การส่งออกข้อมูลล้มเหลว', 'Export failed'));
        }
    };

    const columns = [
        { key: 'meter_code', title: t('รหัสมิเตอร์', 'Meter Code') },
        { key: 'meter_name', title: t('ชื่อมิเตอร์', 'Meter Name') },
        { key: 'building_name', title: t('อาคาร', 'Building') },
        { key: 'zone_name', title: t('โซน', 'Zone') },
        { key: 'room_name', title: t('ห้อง', 'Room') },
        {
            key: 'kwh', title: 'KWh',
            render: (v: number) => v != null ? <strong>{Number(v).toLocaleString(t('th-TH', 'en-US'), { maximumFractionDigits: 2 })}</strong> : '—',
        },
        {
            key: 'kw', title: 'KW',
            render: (v: number) => v != null ? Number(v).toLocaleString(t('th-TH', 'en-US'), { maximumFractionDigits: 2 }) : '—',
        },
        {
            key: 'kva', title: 'KVA',
            render: (v: number) => v != null ? Number(v).toLocaleString(t('th-TH', 'en-US'), { maximumFractionDigits: 2 }) : '—',
        },
        {
            key: 'frequency', title: 'Frequency',
            render: (v: number) => v != null ? Number(v).toFixed(2) : '—',
        },
    ];

    return (
        <div>
            {/* Command bar */}
            <div style={{ background: C.bar, color: '#fff', display: 'flex', alignItems: 'stretch', borderBottom: `2px solid ${C.accent}`, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}><LayoutGrid size={16} /></div>
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>{t('แดชบอร์ด // การใช้ไฟ', 'DASHBOARD // CONSUMPTION')}</div>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>{t('ตารางแสดงการใช้พลังงานจำแนกตามมิเตอร์และช่วงเวลา', 'Table displaying energy consumption classified by meter and time period')}</div>
                    </div>
                </div>
            </div>

            <FilterBar
                onSubmit={fetchData}
                loading={loading}
                showSearchMeter
                actions={
                    <ExportButtons onExportExcel={handleExportExcel} />
                }
            />

            <DataTable
                title={t('ข้อมูลการใช้ไฟรายมิเตอร์', 'Meter Energy Consumption')}
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
