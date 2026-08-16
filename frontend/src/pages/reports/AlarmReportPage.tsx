import React, { useState, useCallback, useEffect } from 'react';
import FilterBar from '../../components/ui/FilterBar';
import type { FilterValues } from '../../components/ui/FilterBar';
import ExportButtons from '../../components/ui/ExportButtons';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { reportsApi } from '../../api/client';
import { exportReport, fetchAllReportRows, type ReportExportFormat } from '../../utils/reportExport';
import { LayoutGrid, Trash2, DownloadCloud, AlertTriangle } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, "Cascadia Mono", monospace';
const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const AUTO_REFRESH_INTERVAL_MS = 30_000;

const THEMES = {
    light: {
        bg: '#EAE7DA', panel: '#FBFAF4', panel2: '#F1EFE3', ink: '#23261E', sub: '#6E705F',
        line: '#D4D1C0', bar: '#F1EFE3', barSub: '#8A8C7A', accent: '#2B4C7E',
        yellow: '#C08A1E',
    },
    dark: {
        bg: '#0E1116', panel: '#161B22', panel2: '#1C232E', ink: '#E6EDF3', sub: '#8B98A6',
        line: '#2A313C', bar: '#080A0E', barSub: '#8B98A6', accent: '#36C2CE',
        yellow: '#D29922',
    },
};

const AlarmReportPage: React.FC = () => {
    const { theme } = useTheme();
    const { t } = useLanguage();
    const C = THEMES[theme];
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [currentFilters, setCurrentFilters] = useState<FilterValues>({ startDate: today, endDate: today });

    // Export & Clear Modal State
    const [showExportClearModal, setShowExportClearModal] = useState(false);
    const [exportFormat, setExportFormat] = useState<ReportExportFormat>('excel');

    const fetchData = useCallback(async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const res = await reportsApi.getAlarms({
                ...currentFilters,
                page, limit,
            });
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        if (showLoading) setLoading(false);
    }, [currentFilters, page, limit]);

    useEffect(() => {
        fetchData();
        const intervalId = window.setInterval(() => {
            if (document.visibilityState === 'visible') fetchData(false);
        }, AUTO_REFRESH_INTERVAL_MS);

        return () => window.clearInterval(intervalId);
    }, [fetchData]);

    const handleFilterSubmit = (filters: FilterValues) => {
        setPage(1);
        setCurrentFilters(filters);
    };

    const handleAcknowledge = async (row: any) => {
        try {
            await reportsApi.acknowledgeAlarm(row.id);
            setSuccessMsg(t('ยืนยัน (Acknowledge) สำเร็จ!', 'Acknowledged successfully!'));
            setData(prev => prev.map(d => d.id === row.id ? { ...d, acknowledged: true, acknowledged_at: new Date().toISOString() } : d));
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            alert(t('การยืนยัน (Acknowledge) ล้มเหลว', 'Acknowledgement failed'));
        }
    };

    const runExport = async (format: ReportExportFormat): Promise<boolean> => {
        const rows = await fetchAllReportRows((exportPage, exportLimit) =>
            reportsApi.getAlarms({ ...currentFilters, page: exportPage, limit: exportLimit })
        );
        if (!rows.length) {
            alert(t('ไม่มีข้อมูลสำหรับส่งออก', 'No data to export'));
            return false;
        }
        const exportRows = rows.map((row: any) => ({
            [t('วันที่', 'Date')]: row.alarm_date,
            [t('รหัสมิเตอร์', 'Meter Code')]: row.meter_code,
            [t('ชื่อมิเตอร์', 'Meter Name')]: row.meter_name,
            [t('ข้อความแจ้งเตือน', 'Alarm Message')]: row.message,
            [t('วันเวลาที่เกิด', 'Occurred At')]: row.occurred_at,
            [t('ประเภท', 'Type')]: row.alarm_type,
            [t('วันเวลาที่แก้ไข', 'Resolved At')]: row.resolved_at,
            [t('ผู้แก้ไข', 'Resolved By')]: row.resolved_by,
            [t('สถานะรับทราบ', 'Acknowledgement Status')]: row.acknowledged
                ? t('รับทราบแล้ว', 'Acknowledged')
                : t('ยังไม่รับทราบ', 'Not Acknowledged'),
            [t('วันเวลาที่รับทราบ', 'Acknowledged At')]: row.acknowledged_at,
        }));
        exportReport(exportRows, `alarm_report_${today}`, 'Alarm Report', format);
        return true;
    };

    const handleExport = async (format: ReportExportFormat) => {
        setExporting(true);
        try {
            await runExport(format);
        } catch (err) {
            alert(t('การส่งออกข้อมูลล้มเหลว', 'Export failed'));
        } finally { setExporting(false); }
    };

    const handleExportAndClear = async () => {
        setClearing(true);
        try {
            // 1. Export file first
            const exported = await runExport(exportFormat);
            if (!exported) {
                setClearing(false);
                return;
            }

            // 2. Clear / Delete data from database
            const res = await reportsApi.clearAlarms(currentFilters);
            const deletedCount = res.data?.data?.deletedCount ?? total;

            setShowExportClearModal(false);
            setSuccessMsg(t(`ส่งออกและลบข้อมูล Alarm สำเร็จ (${deletedCount} รายการ)!`, `Exported and cleared ${deletedCount} alarm records!`));
            setTimeout(() => setSuccessMsg(''), 4000);

            // 3. Refresh table
            setPage(1);
            await fetchData();
        } catch (err: any) {
            alert(err.response?.data?.message || t('การล้างข้อมูลล้มเหลว', 'Failed to clear data'));
        } finally {
            setClearing(false);
        }
    };

    const columns = [
        {
            key: 'alarm_date', title: t('วันที่', 'Date'),
            render: (v: string) => v ? new Date(v).toLocaleDateString(t('th-TH', 'en-US')) : '—',
        },
        {
            key: 'meter_code', title: t('รหัสมิเตอร์', 'Meter Code'),
            render: (v: string) => <span style={{ fontFamily: MONO, fontWeight: 600 }}>{v || '—'}</span>,
        },
        {
            key: 'message', title: t('ข้อความแจ้งเตือน', 'Alarm Message'),
            render: (v: string) => <span style={{ fontSize: 13, maxWidth: 350, display: 'inline-block' }}>{v || '—'}</span>,
        },
        {
            key: 'occurred_at', title: t('วันเวลาที่เกิด', 'Occurred At'),
            render: (v: string) => v ? new Date(v).toLocaleString(t('th-TH', 'en-US')) : '—',
        },
        { key: 'alarm_type', title: t('ประเภท', 'Type') },
        {
            key: 'resolved_at', title: t('วันเวลาที่แก้ไข', 'Resolved At'),
            render: (v: string) => v ? new Date(v).toLocaleString(t('th-TH', 'en-US')) : '—',
        },
        { key: 'resolved_by', title: t('ผู้แก้ไข', 'Resolved By') },
        {
            key: 'actions', title: t('จัดการ', 'Actions'),
            render: (_: any, row: any) => (
                row.acknowledged ? (
                    <span className="badge badge-success" style={{ fontFamily: MONO, borderRadius: 0 }}>{t('รับทราบแล้ว', 'Acknowledged')}</span>
                ) : (
                    <button
                        className="btn btn-sm"
                        style={{ background: C.yellow, color: '#fff', border: 'none', fontWeight: 700, fontFamily: MONO, borderRadius: 0 }}
                        onClick={() => handleAcknowledge(row)}
                    >
                        {t('รับทราบ', 'Acknowledge')}
                    </button>
                )
            ),
        },
    ];

    return (
        <div>
            {successMsg && <div className="toast-success" style={{ fontFamily: MONO, borderRadius: 0, marginBottom: 16 }}>✅ {successMsg}</div>}
            {/* Command bar */}
            <div style={{ background: C.bar, color: C.ink, display: 'flex', alignItems: 'stretch', borderBottom: `2px solid ${C.accent}`, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}><LayoutGrid size={16} /></div>
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>REPORTS // ALARMS</div>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>{t('ประวัติรายการตรวจสอบและการรายงานสัญญาณเตือน (Alarm Notifications)', 'History of inspections and alarm reports (Alarm Notifications)')}</div>
                    </div>
                </div>
            </div>

            <FilterBar
                onSubmit={handleFilterSubmit}
                loading={loading}
                showMeterType={false}
                showSite={false}
                showBuilding={false}
                showZone={false}
                actions={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <ExportButtons onExport={handleExport} loading={exporting} />
                        <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => setShowExportClearModal(true)}
                            disabled={loading || clearing || total === 0}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, borderRadius: 4 }}
                        >
                            <Trash2 size={15} />
                            {t('Export แล้ว Clear Data', 'Export & Clear Data')}
                        </button>
                    </div>
                }
            />

            <DataTable
                title={t('ข้อมูลการแจ้งเตือน', 'Alarm Logs')}
                columns={columns}
                data={data}
                total={total}
                page={page}
                limit={limit}
                loading={loading}
                onPageChange={setPage}
                onLimitChange={(l) => { setLimit(l); setPage(1); }}
                onSearch={(search) => { setPage(1); setCurrentFilters(prev => ({ ...prev, search })); }}
            />

            {/* Modal: Confirmation for Export and Clear Data */}
            <Modal
                isOpen={showExportClearModal}
                onClose={() => !clearing && setShowExportClearModal(false)}
                title={t('ส่งออกและล้างข้อมูล Alarm (Export & Clear Data)', 'Export & Clear Alarm Logs')}
                size="md"
                footer={
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline" onClick={() => setShowExportClearModal(false)} disabled={clearing}>
                            {t('ยกเลิก', 'Cancel')}
                        </button>
                        <button className="btn btn-danger" onClick={handleExportAndClear} disabled={clearing}>
                            {clearing ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <DownloadCloud size={16} className="animate-spin" />
                                    {t('กำลังส่งออกและลบข้อมูล...', 'Exporting & Clearing...')}
                                </span>
                            ) : (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Trash2 size={16} />
                                    {t('ยืนยันส่งออกและลบข้อมูล', 'Confirm Export & Clear')}
                                </span>
                            )}
                        </button>
                    </div>
                }
            >
                <div style={{ padding: '6px 4px' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 16px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: 6,
                        marginBottom: 16,
                        color: '#ef4444',
                    }}>
                        <AlertTriangle size={24} style={{ flexShrink: 0 }} />
                        <div style={{ fontSize: 13 }}>
                            <strong>{t('คำเตือนสำคัญ:', 'Warning:')}</strong> {t('ระบบจะทำการส่งออกไฟล์ข้อมูลก่อน แล้วทำการลบข้อมูลประวัติ Alarm ในช่วงวันที่เลือกออกจากฐานข้อมูลทันที และไม่สามารถกู้คืนได้', 'The system will export a backup file first and then permanently delete the filtered alarm logs from the database.')}
                        </div>
                    </div>

                    <div style={{ fontSize: 13, marginBottom: 14, lineHeight: 1.6 }}>
                        <div>
                            <strong>{t('ช่วงวันที่:', 'Date Range:')}</strong> <span style={{ fontFamily: MONO }}>{currentFilters.startDate} — {currentFilters.endDate}</span>
                        </div>
                        {currentFilters.search && (
                            <div>
                                <strong>{t('คำค้นหา:', 'Search Filter:')}</strong> "{currentFilters.search}"
                            </div>
                        )}
                        <div>
                            <strong>{t('จำนวนรายการที่จะถูกส่งออกและลบ:', 'Total records to export & clear:')}</strong> <strong style={{ color: '#ef4444', fontSize: 15 }}>{total.toLocaleString()} {t('รายการ', 'records')}</strong>
                        </div>
                    </div>

                    <div className="form-group" style={{ marginTop: 12 }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>
                            {t('เลือกรูปแบบไฟล์สำหรับ Export ก่อนลบ:', 'Select Export Format before clearing:')}
                        </label>
                        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                            {(['excel', 'csv'] as const).map((fmt) => (
                                <label
                                    key={fmt}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        padding: '8px 14px',
                                        border: exportFormat === fmt ? '2px solid var(--accent)' : '1px solid var(--border)',
                                        background: exportFormat === fmt ? 'var(--accent-bg, rgba(54,194,206,0.1))' : 'transparent',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                        fontWeight: exportFormat === fmt ? 700 : 400,
                                        fontSize: 12,
                                    }}
                                >
                                    <input
                                        type="radio"
                                        name="exportFormat"
                                        checked={exportFormat === fmt}
                                        onChange={() => setExportFormat(fmt)}
                                        style={{ accentColor: 'var(--accent)' }}
                                    />
                                    {fmt === 'excel' ? 'Excel (.xlsx)' : 'CSV (.csv)'}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default AlarmReportPage;
