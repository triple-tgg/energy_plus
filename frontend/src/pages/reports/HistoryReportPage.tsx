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
                [t('วันที่', 'Date')]: r.timestamp || r.date,
                [t('รหัสมิเตอร์', 'Meter Code')]: r.meter_code,
                [t('ชื่อมิเตอร์', 'Meter Name')]: r.meter_name,
                [t('หน่วยที่ใช้ต่อวัน (kWh)', 'Daily Energy (kWh)')]: Number(r.kwh_used || 0),
                [t('พลังงานไฟฟ้าสะสม (kWh)', 'Accumulated Energy (kWh)')]: Number(r.kwh || 0),
                [t('กำลังไฟฟ้าสูงสุด (kW)', 'Peak Power (kW)')]: Number(r.max_kw || 0),
                [t('กำลังไฟฟ้าเฉลี่ย (kW)', 'Avg Active Power (kW)')]: Number(r.kw || 0),
                [t('กำลังไฟฟ้าปรากฏเฉลี่ย (kVA)', 'Avg Apparent Power (kVA)')]: Number(r.kva || 0),
                [t('กำลังไฟฟ้ารีแอคทีฟเฉลี่ย (kVAR)', 'Avg Reactive Power (kVAR)')]: Number(r.kvar || 0),
                [t('ความถี่เฉลี่ย (Hz)', 'Avg Frequency (Hz)')]: Number(r.frequency || 0),
                'PF 1 (Avg)': Number(r.pwl1 || 0),
                'PF 2 (Avg)': Number(r.pwl2 || 0),
                'PF 3 (Avg)': Number(r.pwl3 || 0),
                'Volt P1 Avg (V)': Number(r.volt_p1 || 0),
                'Volt P2 Avg (V)': Number(r.volt_p2 || 0),
                'Volt P3 Avg (V)': Number(r.volt_p3 || 0),
                'Amp 1 Avg (A)': Number(r.amp1 || 0),
                'Amp 2 Avg (A)': Number(r.amp2 || 0),
                'Amp 3 Avg (A)': Number(r.amp3 || 0),
                [t('จำนวนรอบอ่าน (ครั้ง/วัน)', 'Readings Count')]: Number(r.readings_count || 0),
            }));
            exportReport(exportRows, `history_daily_${today}`, 'Daily History Report', format);
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
            key: 'timestamp', title: t('วันที่', 'Date'),
            render: (v: string) => v ? v : '—',
        },
        { key: 'meter_code', title: t('รหัสมิเตอร์', 'Meter Code') },
        { key: 'meter_name', title: t('ชื่อมิเตอร์', 'Meter Name') },
        numCol('kwh_used', t('หน่วยที่ใช้ (kWh)', 'Daily Used (kWh)')),
        numCol('kwh', t('เลขสะสม (kWh)', 'Acc. kWh')),
        numCol('max_kw', t('Peak kW', 'Peak kW')),
        numCol('kw', t('Avg kW', 'Avg kW')),
        numCol('kva', 'Avg kVA'),
        numCol('kvar', 'Avg kVAR'),
        numCol('frequency', 'Avg Hz'),
        numCol('pwl1', 'PF1', 3),
        numCol('pwl2', 'PF2', 3),
        numCol('pwl3', 'PF3', 3),
        numCol('volt_p1', 'Volt P1'),
        numCol('volt_p2', 'Volt P2'),
        numCol('volt_p3', 'Volt P3'),
        numCol('amp1', 'Amp 1'),
        numCol('amp2', 'Amp 2'),
        numCol('amp3', 'Amp 3'),
        numCol('readings_count', t('รอบอ่าน/วัน', 'Readings/Day'), 0),
    ];

    return (
        <div>
            {/* Command bar */}
            <div style={{ background: C.bar, color: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${C.accent}`, marginBottom: 16, flexWrap: 'wrap', gap: 10, paddingRight: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}><LayoutGrid size={16} /></div>
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>{t('รายงาน // ประวัติข้อมูลรายวัน', 'REPORTS // DAILY HISTORY')}</div>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>{t('รายงานสรุปประวัติพารามิเตอร์พลังงานไฟฟ้ารายวันตามมิเตอร์', 'Daily historical power parameters summary report by meter')}</div>
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
            <DataTable title={t('ข้อมูลพลังงานรายวันย้อนหลัง', 'Daily Historical Energy Data')} columns={columns} data={data} total={total} page={page} limit={limit} loading={loading} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} onSearch={(search) => { setPage(1); setCurrentFilters(prev => ({ ...prev, search })); }} />
        </div>
    );
};

export default HistoryReportPage;
