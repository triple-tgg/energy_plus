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
        bg: '#F0F2F5', panel: '#FFFFFF', panel2: '#F5F6F8', ink: '#1A1D23', sub: '#5F6B7A',
        line: '#D8DCE3', bar: '#E8EBF0', barSub: '#8892A0', accent: '#2B6CB0',
    },
};

const HistoryReportPage: React.FC = () => {
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
            const res = await reportsApi.getHistory({ ...currentFilters, page, limit });
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
                reportsApi.getHistory({ ...currentFilters, page: exportPage, limit: exportLimit })
            );
            const exportRows = rows.map(({ meter_id, ...row }: any) => row);
            exportReport(exportRows, `history_${today}`, 'History', format);
        } catch (err) {
            alert(t('การส่งออกข้อมูลล้มเหลว', 'Export failed'));
        } finally { setExporting(false); }
    };

    const numCol = (key: string, title: string, digits = 2) => ({
        key, title,
        render: (v: number) => v != null ? Number(v).toLocaleString(t('th-TH', 'en-US'), { maximumFractionDigits: digits }) : '—',
    });

    const columns = [
        {
            key: 'timestamp', title: t('วันเวลา', 'Date/Time'),
            render: (v: string) => v ? new Date(v).toLocaleString(t('th-TH', 'en-US')) : '—',
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
            {/* Command bar */}
            <div style={{ background: C.bar, color: '#fff', display: 'flex', alignItems: 'stretch', borderBottom: `2px solid ${C.accent}`, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}><LayoutGrid size={16} /></div>
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>REPORTS // HISTORY</div>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>{t('ประวัติการบันทึกพารามิเตอร์พลังงานไฟฟ้าเชิงลึกย้อนหลังรายมิเตอร์', 'In-depth historical power parameters log by meter')}</div>
                    </div>
                </div>
            </div>
            <FilterBar
                onSubmit={handleFilterSubmit}
                loading={loading}
                showSearchMeter
                meterOptions={meterOptions}
                actions={<ExportButtons onExport={handleExport} loading={exporting} />}
            />
            <DataTable title={t('ข้อมูลพลังงานย้อนหลัง', 'Historical Energy Data')} columns={columns} data={data} total={total} page={page} limit={limit} loading={loading} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} onSearch={(search) => { setPage(1); setCurrentFilters(prev => ({ ...prev, search })); }} />
        </div>
    );
};

export default HistoryReportPage;
