import React, { useState, useCallback, useEffect } from 'react';
import FilterBar from '../../components/ui/FilterBar';
import type { FilterValues } from '../../components/ui/FilterBar';
import ExportButtons from '../../components/ui/ExportButtons';
import DataTable from '../../components/ui/DataTable';
import { dashboardApi, reportsApi } from '../../api/client';
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
        line: '#D4D1C0', bar: '#23261E', barSub: '#A6A892', accent: '#2B4C7E',
    },
    dark: {
        bg: '#0E1116', panel: '#161B22', panel2: '#1C232E', ink: '#E6EDF3', sub: '#8B98A6',
        line: '#2A313C', bar: '#080A0E', barSub: '#8B98A6', accent: '#36C2CE',
    },
};

const EnergyReportPage: React.FC = () => {
    const { theme } = useTheme();
    const { t } = useLanguage();
    const C = THEMES[theme];
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [currentFilters, setCurrentFilters] = useState<FilterValues>({ startDate: today, endDate: today });
    const [meterOptions, setMeterOptions] = useState<any[]>([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await reportsApi.getEnergyConsumption({
                ...currentFilters, page, limit,
            });
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [currentFilters, page, limit]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        dashboardApi.getConsumptionMeters(currentFilters)
            .then(res => setMeterOptions(res.data.data || []))
            .catch(console.error);
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
                reportsApi.getEnergyConsumption({ ...currentFilters, page: exportPage, limit: exportLimit })
            );
            const exportRows = rows.map((r: any) => ({
                [t('รหัสมิเตอร์', 'Meter Code')]: r.meter_code,
                [t('ชื่อลูกค้า', 'Customer Name')]: r.customer_name,
                [t('อาคาร', 'Building')]: r.building_name,
                [t('ชั้น', 'Floor')]: r.floor,
                [t('รหัสสถานที่', 'Site Code')]: r.site_code,
                [t('ชื่อสถานที่', 'Site Name')]: r.site_name,
                [t('วันที่มิเตอร์ก่อนหน้า', 'Previous Reading Date')]: r.start_date,
                [t('จำนวนหน่วยก่อนหน้า', 'Previous Reading')]: Number(r.start_reading || 0),
                [t('วันที่มิเตอร์ล่าสุด', 'Latest Reading Date')]: r.end_date,
                [t('จำนวนหน่วยล่าสุด', 'Latest Reading')]: Number(r.end_reading || 0),
                [t('จำนวนหน่วยที่ใช้', 'Units Used')]: Number(r.units_used || 0),
                [t('ราคาต่อหน่วย', 'Unit Price')]: Number(r.unit_price || 0),
                [t('จำนวนเงิน', 'Amount')]: Number(r.total_amount || 0),
            }));

            exportReport(exportRows, `energy_report_${today}`, 'Energy Report', format);
        } catch (err) {
            alert(t('การส่งออกข้อมูลล้มเหลว', 'Export failed'));
        } finally { setExporting(false); }
    };

    const columns = [
        { key: 'meter_code', title: t('รหัสมิเตอร์', 'Meter Code') },
        { key: 'customer_name', title: t('ชื่อลูกค้า', 'Customer Name') },
        { key: 'building_name', title: t('อาคาร', 'Building') },
        { key: 'floor', title: t('ชั้น', 'Floor') },
        { key: 'site_code', title: t('รหัสสถานที่', 'Site Code') },
        { key: 'site_name', title: t('ชื่อสถานที่', 'Site Name') },
        {
            key: 'start_date', title: t('วันที่มิเตอร์ก่อนหน้า', 'Previous Reading Date'),
            render: (v: string) => v ? new Date(v).toLocaleString(t('th-TH', 'en-GB')) : '—',
        },
        {
            key: 'start_reading', title: t('จำนวนหน่วยก่อนหน้า', 'Previous Reading'),
            render: (v: number) => v != null ? Number(v).toLocaleString(t('th-TH', 'en-US'), { maximumFractionDigits: 2 }) : '—',
        },
        {
            key: 'end_date', title: t('วันที่มิเตอร์ล่าสุด', 'Latest Reading Date'),
            render: (v: string) => v ? new Date(v).toLocaleString(t('th-TH', 'en-GB')) : '—',
        },
        {
            key: 'end_reading', title: t('จำนวนหน่วยล่าสุด', 'Latest Reading'),
            render: (v: number) => v != null ? Number(v).toLocaleString(t('th-TH', 'en-US'), { maximumFractionDigits: 2 }) : '—',
        },
        {
            key: 'units_used', title: t('จำนวนหน่วยที่ใช้', 'Units Used'),
            render: (v: number) => v != null ? <strong>{Number(v).toLocaleString(t('th-TH', 'en-US'), { maximumFractionDigits: 2 })}</strong> : '—',
        },
        {
            key: 'unit_price', title: t('ราคาต่อหน่วย', 'Unit Price'),
            render: (v: number) => v != null ? `฿${Number(v).toFixed(4)}` : '—',
        },
        {
            key: 'total_amount', title: t('จำนวนเงิน', 'Amount'),
            render: (v: number) => v != null ? <strong style={{ color: C.accent }}>฿{Number(v).toLocaleString(t('th-TH', 'en-US'), { maximumFractionDigits: 2 })}</strong> : '—',
        },
    ];

    return (
        <div>
            {/* Command bar */}
            <div style={{ background: C.bar, color: '#fff', display: 'flex', alignItems: 'stretch', borderBottom: `2px solid ${C.accent}`, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}><LayoutGrid size={16} /></div>
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>REPORTS // ENERGY</div>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>{t('รายงานสรุปปริมาณการใช้พลังงานและคิดเงินตามกิโลวัตต์-ชั่วโมง', 'Summary report of energy consumption and billing based on kWh')}</div>
                    </div>
                </div>
            </div>
            <FilterBar
                onSubmit={handleFilterSubmit}
                loading={loading}
                showSearchMeter
                meterOptions={meterOptions}
                actions={
                    <ExportButtons onExport={handleExport} loading={exporting} />
                }
            />
            <DataTable title={t('รายงานการใช้พลังงาน', 'Energy Consumption Report')} columns={columns} data={data} total={total} page={page} limit={limit} loading={loading} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} onSearch={(search) => { setPage(1); setCurrentFilters(prev => ({ ...prev, search })); }} />
        </div>
    );
};

export default EnergyReportPage;
