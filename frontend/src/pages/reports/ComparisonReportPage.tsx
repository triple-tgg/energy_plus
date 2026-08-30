import React, { useState, useCallback, useEffect } from 'react';
import FilterBar from '../../components/ui/FilterBar';
import type { FilterValues } from '../../components/ui/FilterBar';
import ExportButtons from '../../components/ui/ExportButtons';
import DataTable from '../../components/ui/DataTable';
import { reportsApi } from '../../api/client';
import { exportReport, fetchAllReportRows, type ReportExportFormat } from '../../utils/reportExport';
import { LayoutGrid } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, "Cascadia Mono", monospace';
const currentDate = new Date();

const THEMES = {
    light: {
        bg: '#EAE7DA', panel: '#FBFAF4', panel2: '#F1EFE3', ink: '#23261E', sub: '#6E705F',
        line: '#D4D1C0', bar: '#F1EFE3', barSub: '#8A8C7A', accent: '#2B4C7E',
        red: '#dc2626', green: '#16a34a',
    },
    dark: {
        bg: '#0E1116', panel: '#161B22', panel2: '#1C232E', ink: '#E6EDF3', sub: '#8B98A6',
        line: '#2A313C', bar: '#080A0E', barSub: '#8B98A6', accent: '#36C2CE',
        red: '#f85149', green: '#34d399',
    },
};

const ComparisonReportPage: React.FC = () => {
    const { theme } = useTheme();
    const { t } = useLanguage();
    const C = THEMES[theme];
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [currentFilters, setCurrentFilters] = useState<FilterValues>({
        month: String(currentDate.getMonth() + 1), year: String(currentDate.getFullYear()),
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await reportsApi.getComparison({ ...currentFilters, page, limit });
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [currentFilters, page, limit]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleFilterSubmit = (filters: FilterValues) => {
        setPage(1);
        setCurrentFilters(filters);
    };

    const handleExport = async (format: ReportExportFormat) => {
        setExporting(true);
        try {
            const rows = await fetchAllReportRows((exportPage, exportLimit) =>
                reportsApi.getComparison({ ...currentFilters, page: exportPage, limit: exportLimit })
            );
            const exportRows = rows.map(({ meter_id, ...row }: any) => row);
            exportReport(exportRows, `comparison_${currentFilters.year}-${String(currentFilters.month).padStart(2, '0')}`, 'Comparison', format);
        } catch (err) {
            alert(t('การส่งออกข้อมูลล้มเหลว', 'Export failed'));
        } finally { setExporting(false); }
    };

    const columns = [
        { key: 'meter_code', title: t('รหัสมิเตอร์', 'Meter Code') },
        { key: 'customer_name', title: t('ชื่อลูกค้า', 'Customer Name') },
        { key: 'building_name', title: t('อาคาร', 'Building') },
        { key: 'floor', title: t('ชั้น', 'Floor') },
        { key: 'zone_name', title: t('โซน', 'Zone') },
        { key: 'room_code', title: t('รหัสห้อง', 'Room Code') },
        { key: 'room_name', title: t('ชื่อห้อง', 'Room Name') },
        {
            key: 'prev_month', title: t('เดือนก่อนหน้า (1)', 'Previous Month (1)'),
            render: (v: string) => v || '—',
        },
        {
            key: 'prev_units', title: t('หน่วยที่ใช้ (1)', 'Units Used (1)'),
            render: (v: number) => v != null ? Number(v).toLocaleString(t('th-TH', 'en-US'), { maximumFractionDigits: 2 }) : '—',
        },
        {
            key: 'current_month', title: t('เดือนปัจจุบัน (2)', 'Current Month (2)'),
            render: (v: string) => v || '—',
        },
        {
            key: 'current_units', title: t('หน่วยที่ใช้ (2)', 'Units Used (2)'),
            render: (v: number) => v != null ? Number(v).toLocaleString(t('th-TH', 'en-US'), { maximumFractionDigits: 2 }) : '—',
        },
        {
            key: 'diff_percent', title: t('% เปรียบเทียบ', '% Change'),
            render: (v: number) => {
                if (v == null) return '—';
                const color = v > 0 ? C.red : v < 0 ? C.green : C.ink;
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
            {/* Command bar */}
            <div style={{ background: C.bar, color: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${C.accent}`, marginBottom: 16, flexWrap: 'wrap', gap: 10, paddingRight: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}><LayoutGrid size={16} /></div>
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>{t('รายงาน // เปรียบเทียบการใช้พลังงาน', 'REPORTS // COMPARISON')}</div>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>{t('รายงานเปรียบเทียบสถิติการใช้งานไฟฟ้าเทียบกับเดือนก่อนหน้า', 'Report comparing energy consumption statistics with the previous month')}</div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                    <ExportButtons onExport={handleExport} loading={exporting} />
                </div>
            </div>
            <FilterBar
                onSubmit={handleFilterSubmit}
                loading={loading}
                showDateRange={false}
                showMonthYear
            />
            <DataTable title={t('เปรียบเทียบการใช้พลังงาน', 'Energy Consumption Comparison')} columns={columns} data={data} total={total} page={page} limit={limit} loading={loading} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} onSearch={(search) => { setPage(1); setCurrentFilters(prev => ({ ...prev, search })); }} />
        </div>
    );
};

export default ComparisonReportPage;
