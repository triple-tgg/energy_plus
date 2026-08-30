import React, { useState, useCallback, useEffect } from 'react';
import FilterBar from '../../components/ui/FilterBar';
import type { FilterValues } from '../../components/ui/FilterBar';
import ExportButtons from '../../components/ui/ExportButtons';
import DataTable from '../../components/ui/DataTable';
import { dashboardApi } from '../../api/client';
import { exportReport, fetchAllReportRows, type ReportExportFormat } from '../../utils/reportExport';
import { LayoutGrid } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, "Cascadia Mono", monospace';
const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const THEMES = {
    light: {
        bg: '#EAE7DA', panel: '#FBFAF4', panel2: '#F1EFE3', ink: '#23261E', sub: '#6E705F',
        line: '#D4D1C0', bar: '#F1EFE3', barSub: '#8A8C7A', accent: '#2B4C7E',
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
    const [exporting, setExporting] = useState(false);
    const [meterOptions, setMeterOptions] = useState<any[]>([]);
    const [currentFilters, setCurrentFilters] = useState<FilterValues>({ startDate: today, endDate: today });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await dashboardApi.getConsumptionTable({
                ...currentFilters,
                page, limit,
            });
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    }, [currentFilters, page, limit]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        const loadMeterOptions = async () => {
            try {
                const res = await dashboardApi.getConsumptionMeters(currentFilters);
                setMeterOptions(res.data.data || []);
            } catch (err) { console.error(err); }
        };
        loadMeterOptions();
    }, [currentFilters.siteId, currentFilters.buildingId, currentFilters.zoneId,
        currentFilters.meterTypeId, currentFilters.startDate, currentFilters.endDate]);

    const handleFilterSubmit = (filters: FilterValues) => {
        setPage(1);
        setCurrentFilters(filters);
    };

    const handleExport = async (format: ReportExportFormat) => {
        setExporting(true);
        try {
            const rows = await fetchAllReportRows((exportPage, exportLimit) =>
                dashboardApi.getConsumptionTable({ ...currentFilters, page: exportPage, limit: exportLimit })
            );
            const exportRows = rows.map((row: any) => ({
                [t('รหัสมิเตอร์', 'Meter Code')]: row.meter_code,
                [t('ชื่อมิเตอร์', 'Meter Name')]: row.meter_name,
                [t('อาคาร', 'Building')]: row.building_name,
                [t('โซน', 'Zone')]: row.zone_name,
                [t('วันที่', 'Date')]: row.date,
                KWh: row.kwh,
                [t('การใช้ไฟ (kWh)', 'Consumption (kWh)')]: row.consumption,
            }));
            exportReport(exportRows, `consumption_${today}`, 'Consumption', format);
        } catch (err) {
            console.error(err);
            alert(t('การส่งออกข้อมูลล้มเหลว', 'Export failed'));
        } finally { setExporting(false); }
    };

    const columns = [
        { key: 'meter_code', title: t('รหัสมิเตอร์', 'Meter Code') },
        { key: 'meter_name', title: t('ชื่อมิเตอร์', 'Meter Name') },
        { key: 'building_name', title: t('อาคาร', 'Building') },
        { key: 'zone_name', title: t('โซน', 'Zone') },
        {
            key: 'date', title: t('วันที่', 'Date'),
            render: (v: string) => v ? new Date(v + 'T00:00:00').toLocaleDateString(t('th-TH', 'en-GB')) : '—',
        },
        {
            key: 'kwh', title: 'KWh',
            render: (v: number) => v != null ? <strong>{Number(v).toLocaleString(t('th-TH', 'en-US'), { maximumFractionDigits: 2 })}</strong> : '—',
        },
        {
            key: 'consumption', title: t('การใช้ไฟ (kWh)', 'Consumption (kWh)'),
            render: (v: number) => v != null ? Number(v).toLocaleString(t('th-TH', 'en-US'), { maximumFractionDigits: 2 }) : '—',
        },
    ];

    return (
        <div>
            {/* Command bar */}
            <div style={{ background: C.bar, color: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${C.accent}`, marginBottom: 16, flexWrap: 'wrap', gap: 10, paddingRight: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}><LayoutGrid size={16} /></div>
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>{t('รายงาน // การใช้พลังงาน', 'REPORT // CONSUMPTION')}</div>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>{t('รายงานแสดงการใช้พลังงานจำแนกตามมิเตอร์และช่วงเวลา', 'Report displaying energy consumption classified by meter and time period')}</div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                    <ExportButtons onExport={handleExport} loading={exporting} />
                </div>
            </div>

            <FilterBar
                onSubmit={handleFilterSubmit}
                loading={loading}
                showSearchMeter
                meterOptions={meterOptions}
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
                onSearch={(searchMeter) => { setPage(1); setCurrentFilters(prev => ({ ...prev, searchMeter })); }}
            />
        </div>
    );
};

export default ConsumptionTable;
