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
        line: '#D4D1C0', bar: '#F1EFE3', barSub: '#8A8C7A', accent: '#2B4C7E',
    },
    dark: {
        bg: '#0E1116', panel: '#161B22', panel2: '#1C232E', ink: '#E6EDF3', sub: '#8B98A6',
        line: '#2A313C', bar: '#080A0E', barSub: '#8B98A6', accent: '#36C2CE',
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
            const exportRows = rows.map((r: any) => ({
                [t('วันเวลา', 'Date/Time')]: r.timestamp,
                [t('รหัสมิเตอร์', 'Meter Code')]: r.meter_code,
                [t('ชื่อมิเตอร์', 'Meter Name')]: r.meter_name,
                [t('พลังงานไฟฟ้าสะสม (kWh)', 'Energy (kWh)')]: Number(r.kwh || 0),
                [t('กำลังไฟฟ้า (kW)', 'Active Power (kW)')]: Number(r.kw || 0),
                [t('กำลังไฟฟ้าปรากฏ (kVA)', 'Apparent Power (kVA)')]: Number(r.kva || 0),
                [t('กำลังไฟฟ้ารีแอคทีฟ (kVAR)', 'Reactive Power (kVAR)')]: Number(r.kvar || 0),
                [t('ความถี่ (Hz)', 'Frequency (Hz)')]: Number(r.frequency || 0),
                'PF 1': Number(r.pwl1 || 0),
                'PF 2': Number(r.pwl2 || 0),
                'PF 3': Number(r.pwl3 || 0),
                'Volt P1 (V)': Number(r.volt_p1 || 0),
                'Volt P2 (V)': Number(r.volt_p2 || 0),
                'Volt P3 (V)': Number(r.volt_p3 || 0),
                'Volt L1 (V)': Number(r.volt_l1 || 0),
                'Volt L2 (V)': Number(r.volt_l2 || 0),
                'Volt L3 (V)': Number(r.volt_l3 || 0),
                'Amp 1 (A)': Number(r.amp1 || 0),
                'Amp 2 (A)': Number(r.amp2 || 0),
                'Amp 3 (A)': Number(r.amp3 || 0),
            }));
            exportReport(exportRows, `history_15min_${today}`, '15-Min History', format);
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
        { key: 'meter_code', title: t('รหัสมิเตอร์', 'Meter Code') },
        { key: 'meter_name', title: t('ชื่อมิเตอร์', 'Meter Name') },
        numCol('kwh', 'kWh'),
        numCol('kw', 'kW'),
        numCol('kva', 'kVA'),
        numCol('kvar', 'kVAR'),
        numCol('frequency', 'Hz'),
        numCol('pwl1', 'PF1', 4),
        numCol('pwl2', 'PF2', 4),
        numCol('pwl3', 'PF3', 4),
        numCol('volt_p1', 'Volt P1'),
        numCol('volt_p2', 'Volt P2'),
        numCol('volt_p3', 'Volt P3'),
        numCol('amp1', 'Amp 1'),
        numCol('amp2', 'Amp 2'),
        numCol('amp3', 'Amp 3'),
    ];

    return (
        <div>
            {/* Command bar */}
            <div style={{ background: C.bar, color: C.ink, display: 'flex', alignItems: 'stretch', borderBottom: `2px solid ${C.accent}`, marginBottom: 16 }}>
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
