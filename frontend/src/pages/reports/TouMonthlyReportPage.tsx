import React, { useState, useCallback, useEffect } from 'react';
import FilterBar from '../../components/ui/FilterBar';
import type { FilterValues } from '../../components/ui/FilterBar';
import ExportButtons from '../../components/ui/ExportButtons';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { dashboardApi, reportsApi } from '../../api/client';
import { exportReport, fetchAllReportRows, type ReportExportFormat } from '../../utils/reportExport';
import { CalendarRange, FileText, Printer, Zap, AlertCircle } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, "Cascadia Mono", monospace';
const now = new Date();

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

const TouMonthlyReportPage: React.FC = () => {
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
        month: String(now.getMonth() + 1),
        year: String(now.getFullYear()),
    });
    const [meterOptions, setMeterOptions] = useState<any[]>([]);
    const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await reportsApi.getTouMonthly({
                ...currentFilters, page, limit,
            });
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [currentFilters, page, limit]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        dashboardApi.getConsumptionMeters({ ...currentFilters, mdb: 'only' })
            .then(res => setMeterOptions(res.data.data || []))
            .catch(console.error);
    }, [currentFilters.siteId, currentFilters.buildingId, currentFilters.zoneId,
        currentFilters.meterTypeId, currentFilters.month, currentFilters.year]);

    const handleFilterSubmit = (filters: FilterValues) => {
        setPage(1);
        setCurrentFilters(filters);
    };

    const handleExport = async (format: ReportExportFormat) => {
        setExporting(true);
        try {
            const rows = await fetchAllReportRows((exportPage, exportLimit) =>
                reportsApi.getTouMonthly({ ...currentFilters, page: exportPage, limit: exportLimit })
            );
            const exportRows = rows.map((r: any) => ({
                [t('รหัสมิเตอร์', 'Meter Code')]: r.meter_code,
                [t('ชื่อลูกค้า/มิเตอร์', 'Customer / Meter Name')]: r.customer_name,
                [t('อาคาร', 'Building')]: r.building_name,
                [t('ชั้น', 'Floor')]: r.floor,
                [t('รหัสสถานที่', 'Site Code')]: r.site_code,
                [t('ชื่อสถานที่', 'Site Name')]: r.site_name,
                [t('เดือนที่เรียกเก็บ', 'Billing Month')]: r.billing_month,
                [t('หน่วยรวม (kWh)', 'Total Units (kWh)')]: Number(r.units_used || 0),
                [t('หน่วย On-Peak (kWh)', 'On-Peak (kWh)')]: Number(r.on_peak_kwh || 0),
                [t('อัตรา On-Peak (฿)', 'On-Peak Rate (฿)')]: Number(r.on_peak_rate || 0),
                [t('ค่าไฟ On-Peak (บาท)', 'On-Peak Amount (THB)')]: Number(r.on_peak_amount || 0),
                [t('หน่วย Off-Peak (kWh)', 'Off-Peak (kWh)')]: Number(r.off_peak_kwh || 0),
                [t('อัตรา Off-Peak (฿)', 'Off-Peak Rate (฿)')]: Number(r.off_peak_rate || 0),
                [t('ค่าไฟ Off-Peak (บาท)', 'Off-Peak Amount (THB)')]: Number(r.off_peak_amount || 0),
                [t('Peak Demand (kW)', 'Peak Demand (kW)')]: Number(r.peak_demand_kw || 0),
                [t('อัตรา Demand (฿)', 'Demand Rate (฿)')]: Number(r.demand_rate || 0),
                [t('ค่า Demand (บาท)', 'Demand Amount (THB)')]: Number(r.demand_amount || 0),
                [t('kVAR รวม', 'Total kVAR')]: Number(r.total_kvar || 0),
                [t('kVAR เกณฑ์ยอมรับได้', 'kVAR Allowable')]: Number(r.kvar_allowable || 0),
                [t('kVAR ส่วนเกิน', 'Excess kVAR')]: Number(r.kvar_excess || 0),
                [t('ค่าปรับ PF (บาท)', 'PF Penalty (THB)')]: Number(r.pf_penalty_amount || 0),
                [t('ค่าบริการ (บาท)', 'Service Charge (THB)')]: Number(r.service_charge || 0),
                [t('ค่า Ft (บาท)', 'Ft Amount (THB)')]: Number(r.ft_amount || 0),
                [t('รวมก่อน VAT (บาท)', 'Subtotal (THB)')]: Number(r.subtotal || 0),
                [t('VAT 7% (บาท)', 'VAT 7% (THB)')]: Number(r.vat_amount || 0),
                [t('ยอดรวมสุทธิ (บาท)', 'Total Net Amount (THB)')]: Number(r.total_amount || 0),
            }));

            const monthStr = `${currentFilters.year || now.getFullYear()}-${String(currentFilters.month || now.getMonth() + 1).padStart(2, '0')}`;
            exportReport(exportRows, `tou_monthly_report_${monthStr}`, 'TOU Monthly Report', format);
        } catch (err) {
            alert(t('การส่งออกข้อมูลล้มเหลว', 'Export failed'));
        } finally { setExporting(false); }
    };

    const handlePrintInvoice = () => {
        window.print();
    };

    const columns = [
        { key: 'meter_code', title: t('รหัสมิเตอร์', 'Meter Code') },
        { key: 'customer_name', title: t('ชื่อลูกค้า/มิเตอร์', 'Customer/Meter') },
        { key: 'building_name', title: t('อาคาร', 'Building') },
        { key: 'floor', title: t('ชั้น', 'Floor') },
        {
            key: 'units_used',
            title: t('หน่วยรวม (kWh)', 'Total kWh'),
            render: (v: number) => <strong style={{ fontFamily: MONO }}>{Number(v || 0).toLocaleString(t('th-TH', 'en-US'), { maximumFractionDigits: 2 })}</strong>,
        },
        {
            key: 'on_peak_amount',
            title: t('On-Peak (บาท)', 'On-Peak (THB)'),
            render: (_: any, r: any) => (
                <div>
                    <div style={{ fontFamily: MONO, color: '#f59e0b', fontWeight: 600 }}>฿{Number(r.on_peak_amount || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div style={{ fontSize: 10, color: C.sub }}>{Number(r.on_peak_kwh || 0).toFixed(2)} kWh</div>
                </div>
            ),
        },
        {
            key: 'off_peak_amount',
            title: t('Off-Peak (บาท)', 'Off-Peak (THB)'),
            render: (_: any, r: any) => (
                <div>
                    <div style={{ fontFamily: MONO, color: '#10b981', fontWeight: 600 }}>฿{Number(r.off_peak_amount || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div style={{ fontSize: 10, color: C.sub }}>{Number(r.off_peak_kwh || 0).toFixed(2)} kWh</div>
                </div>
            ),
        },
        {
            key: 'demand_amount',
            title: t('Peak Demand (kW)', 'Peak Demand (kW)'),
            render: (_: any, r: any) => (
                <div>
                    <div style={{ fontFamily: MONO, fontWeight: 600 }}>{Number(r.peak_demand_kw || 0).toFixed(2)} kW</div>
                    <div style={{ fontSize: 10, color: C.sub }}>฿{Number(r.demand_amount || 0).toFixed(2)}</div>
                </div>
            ),
        },
        {
            key: 'pf_penalty_amount',
            title: t('ค่าปรับ PF (บาท)', 'PF Penalty (THB)'),
            render: (v: number) => Number(v || 0) > 0 ? (
                <span style={{ fontFamily: MONO, color: '#ef4444', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <AlertCircle size={12} />
                    ฿{Number(v).toFixed(2)}
                </span>
            ) : <span style={{ fontFamily: MONO, color: C.sub }}>฿0.00</span>,
        },
        {
            key: 'service_charge',
            title: t('ค่าบริการ (บาท)', 'Service (THB)'),
            render: (v: number) => <span style={{ fontFamily: MONO }}>฿{Number(v || 0).toFixed(2)}</span>,
        },
        {
            key: 'total_amount',
            title: t('ยอดสุทธิ (บาท)', 'Net Total (THB)'),
            render: (v: number) => <strong style={{ fontFamily: MONO, color: C.accent, fontSize: 13 }}>฿{Number(v || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>,
        },
        {
            key: 'actions',
            title: t('ใบแจ้งหนี้', 'Invoice'),
            render: (_: any, r: any) => (
                <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setSelectedInvoice(r)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '4px 8px' }}
                >
                    <FileText size={14} />
                    {t('ดูบิล', 'View Bill')}
                </button>
            ),
        },
    ];

    const selectedMonthFormatted = `${currentFilters.year || now.getFullYear()}-${String(currentFilters.month || now.getMonth() + 1).padStart(2, '0')}`;

    return (
        <div>
            {/* Command bar */}
            <div style={{ background: C.bar, color: C.ink, display: 'flex', alignItems: 'stretch', borderBottom: `2px solid ${C.accent}`, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}><CalendarRange size={16} /></div>
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>REPORTS // TOU MONTHLY BILLING</div>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>{t('รายงานการใช้พลังงานและคิดค่าไฟฟ้าตามช่วงเวลา TOU รายเดือน (On-Peak, Off-Peak, Peak Demand, PF Penalty)', 'Monthly TOU billing report with On-Peak, Off-Peak, Peak Demand, and Power Factor calculations')}</div>
                    </div>
                </div>
            </div>

            <FilterBar
                onSubmit={handleFilterSubmit}
                loading={loading}
                showDateRange={false}
                showMonthYear={true}
                showSearchMeter
                meterOptions={meterOptions}
                actions={
                    <ExportButtons onExport={handleExport} loading={exporting} />
                }
            />

            <DataTable
                title={`${t('รายงานค่าไฟฟ้า TOU รายเดือน', 'TOU Monthly Consumption & Billing Report')} (${selectedMonthFormatted})`}
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

            {/* TOU Bill Invoice Modal */}
            {selectedInvoice && (
                <Modal
                    isOpen={!!selectedInvoice}
                    onClose={() => setSelectedInvoice(null)}
                    title={t('ใบแจ้งหนี้ค่าไฟฟ้า TOU รายเดือน (TOU Monthly Bill)', 'TOU Monthly Utility & Energy Bill')}
                    size="lg"
                    footer={
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {t('อ้างอิงอัตราค่าไฟฟ้า ณ วันที่:', 'Tariff effective date:')} {selectedInvoice.tariff_info?.effective_date || '—'}
                            </div>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button className="btn btn-outline" onClick={handlePrintInvoice} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Printer size={16} />
                                    {t('พิมพ์ใบแจ้งหนี้', 'Print Bill')}
                                </button>
                                <button className="btn btn-primary" onClick={() => setSelectedInvoice(null)}>
                                    {t('ปิด', 'Close')}
                                </button>
                            </div>
                        </div>
                    }
                >
                    <div style={{ padding: '10px 4px', color: 'var(--text-main)' }}>
                        {/* Invoice Header */}
                        <div style={{
                            borderBottom: '2px solid var(--border)',
                            paddingBottom: 14,
                            marginBottom: 16,
                            display: 'flex',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 12,
                        }}>
                            <div>
                                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: MONO, color: C.accent }}>
                                    {t('ใบแจ้งหนี้ค่าไฟฟ้า TOU รายเดือน (TOU Bill)', 'TOU Monthly Energy Bill')}
                                </div>
                                <div style={{ fontSize: 13, marginTop: 4 }}>
                                    <strong>{t('ชื่อผู้เช่า / สถานที่:', 'Customer / Meter Name:')}</strong> {selectedInvoice.customer_name || '—'}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                    {t('โครงการ:', 'Project:')} <strong>{selectedInvoice.site_name || '—'}</strong> | {t('อาคาร:', 'Building:')} {selectedInvoice.building_name} | {t('ชั้น:', 'Floor:')} {selectedInvoice.floor || '—'} | {t('รหัส:', 'Code:')} {selectedInvoice.site_code || '—'}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 12, fontFamily: MONO, color: 'var(--text-muted)' }}>
                                    {t('เลขที่ใบแจ้งหนี้:', 'Bill No.:')} <strong style={{ color: C.accent }}>{`TOU-${selectedInvoice.billing_month || selectedMonthFormatted}-${selectedInvoice.meter_code}`}</strong>
                                </div>
                                <div style={{ fontSize: 12, fontFamily: MONO, color: 'var(--text-muted)', marginTop: 2 }}>
                                    {t('รอบเดือนที่คิดเงิน:', 'Billing Month:')}
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: MONO }}>
                                    {selectedInvoice.billing_period || selectedInvoice.billing_month || selectedMonthFormatted}
                                </div>
                            </div>
                        </div>

                        {/* Energy Summary Cards */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                            gap: 10,
                            marginBottom: 16,
                        }}>
                            <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 6, border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('หน่วย On-Peak', 'On-Peak Units')}</div>
                                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: MONO, color: '#f59e0b', marginTop: 2 }}>
                                    {Number(selectedInvoice.on_peak_kwh || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: 10 }}>kWh</span>
                                </div>
                            </div>
                            <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 6, border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('หน่วย Off-Peak', 'Off-Peak Units')}</div>
                                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: MONO, color: '#10b981', marginTop: 2 }}>
                                    {Number(selectedInvoice.off_peak_kwh || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: 10 }}>kWh</span>
                                </div>
                            </div>
                            <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 6, border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('หน่วยไฟฟ้ารวม', 'Total Units')}</div>
                                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: MONO, color: C.accent, marginTop: 2 }}>
                                    {Number(selectedInvoice.units_used || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: 10 }}>kWh</span>
                                </div>
                            </div>
                            <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 6, border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('Peak Demand', 'Peak Demand')}</div>
                                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: MONO, marginTop: 2 }}>
                                    {Number(selectedInvoice.peak_demand_kw || 0).toFixed(2)} <span style={{ fontSize: 10 }}>kW</span>
                                </div>
                            </div>
                        </div>

                        {/* Breakdown Table */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-secondary)' }}>
                                    <th style={{ textAlign: 'left', padding: '8px 10px' }}>{t('รายการคำนวณ', 'Description')}</th>
                                    <th style={{ textAlign: 'right', padding: '8px 10px' }}>{t('ปริมาณ', 'Quantity')}</th>
                                    <th style={{ textAlign: 'right', padding: '8px 10px' }}>{t('อัตรา (฿)', 'Rate (THB)')}</th>
                                    <th style={{ textAlign: 'right', padding: '8px 10px' }}>{t('จำนวนเงิน (บาท)', 'Amount (THB)')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '8px 10px' }}>{t('ค่าพลังงานไฟฟ้า On-Peak (จ.-ศ. 09:00 - 22:00)', 'On-Peak Energy Charge')}</td>
                                    <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO }}>{Number(selectedInvoice.on_peak_kwh || 0).toFixed(2)} kWh</td>
                                    <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO }}>฿{Number(selectedInvoice.on_peak_rate || 5.7982).toFixed(4)}</td>
                                    <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO, color: '#f59e0b', fontWeight: 600 }}>฿{Number(selectedInvoice.on_peak_amount || 0).toFixed(2)}</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '8px 10px' }}>{t('ค่าพลังงานไฟฟ้า Off-Peak (นอกเวลา & ส.-อา.)', 'Off-Peak Energy Charge')}</td>
                                    <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO }}>{Number(selectedInvoice.off_peak_kwh || 0).toFixed(2)} kWh</td>
                                    <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO }}>฿{Number(selectedInvoice.off_peak_rate || 2.6369).toFixed(4)}</td>
                                    <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO, color: '#10b981', fontWeight: 600 }}>฿{Number(selectedInvoice.off_peak_amount || 0).toFixed(2)}</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(245,158,11,0.03)' }}>
                                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{t('รวมค่าพลังงานไฟฟ้า (Energy Charge Subtotal)', 'Energy Charge Subtotal')}</td>
                                    <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO }}>{Number(selectedInvoice.units_used || 0).toFixed(2)} kWh</td>
                                    <td></td>
                                    <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO, fontWeight: 600 }}>฿{Number(selectedInvoice.energy_amount || 0).toFixed(2)}</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '8px 10px' }}>{t('ค่าความต้องการพลังไฟฟ้า (Peak Demand Charge)', 'Peak Demand Charge')}</td>
                                    <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO }}>{Number(selectedInvoice.peak_demand_kw || 0).toFixed(2)} kW</td>
                                    <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO }}>฿{Number(selectedInvoice.demand_rate || 210).toFixed(2)}</td>
                                    <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO }}>฿{Number(selectedInvoice.demand_amount || 0).toFixed(2)}</td>
                                </tr>
                                {Number(selectedInvoice.pf_penalty_amount || 0) > 0 && (
                                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(239,68,68,0.04)' }}>
                                        <td style={{ padding: '8px 10px', color: '#ef4444' }}>
                                            {t('ค่าเพาเวอร์แฟคเตอร์ส่วนเกิน (PF Penalty)', 'Power Factor Penalty')}
                                            <div style={{ fontSize: 11, opacity: 0.8 }}>{t('kVAR ส่วนเกิน:', 'Excess kVAR:')} {Number(selectedInvoice.kvar_excess || 0).toFixed(2)} kVAR</div>
                                        </td>
                                        <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO }}>{Number(selectedInvoice.kvar_excess || 0).toFixed(2)} kVAR</td>
                                        <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO }}>฿{Number(selectedInvoice.pf_penalty_rate || 56.07).toFixed(2)}</td>
                                        <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO, color: '#ef4444', fontWeight: 600 }}>฿{Number(selectedInvoice.pf_penalty_amount || 0).toFixed(2)}</td>
                                    </tr>
                                )}
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '8px 10px' }}>{t('ค่าบริการรายเดือน (Service Charge)', 'Monthly Service Charge')}</td>
                                    <td style={{ textAlign: 'right', padding: '8px 10px' }}>—</td>
                                    <td style={{ textAlign: 'right', padding: '8px 10px' }}>—</td>
                                    <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO }}>฿{Number(selectedInvoice.service_charge || 0).toFixed(2)}</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '8px 10px' }}>
                                        {t('ค่าไฟฟ้าผันแปร Ft (', 'Fuel Adjustment Charge Ft (')}{Number(selectedInvoice.ft_rate || 0).toFixed(4)} {t('บาท/หน่วย)', 'THB/Unit)')}
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO }}>{Number(selectedInvoice.units_used || 0).toFixed(2)} kWh</td>
                                    <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO }}>฿{Number(selectedInvoice.ft_rate || 0).toFixed(4)}</td>
                                    <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO }}>฿{Number(selectedInvoice.ft_amount || 0).toFixed(2)}</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', fontWeight: 600 }}>
                                    <td colSpan={3} style={{ padding: '8px 10px', textAlign: 'right' }}>{t('รวมเงินก่อนภาษีมูลค่าเพิ่ม (Subtotal)', 'Subtotal before VAT')}</td>
                                    <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO }}>฿{Number(selectedInvoice.subtotal || 0).toFixed(2)}</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td colSpan={3} style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>
                                        {t('ภาษีมูลค่าเพิ่ม VAT', 'VAT')} ({Number(selectedInvoice.vat_percent || 7)}%)
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO }}>฿{Number(selectedInvoice.vat_amount || 0).toFixed(2)}</td>
                                </tr>
                                <tr style={{ borderTop: '2px solid var(--border)', background: 'rgba(43,76,126,0.08)' }}>
                                    <td colSpan={3} style={{ padding: '10px', textAlign: 'right', fontSize: 14, fontWeight: 700 }}>
                                        {t('จำนวนเงินสุทธิรวมทั้งสิ้น (Total Net Amount)', 'Grand Total Net Amount')}
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '10px', fontFamily: MONO, fontSize: 16, fontWeight: 700, color: C.accent }}>
                                        ฿{Number(selectedInvoice.total_amount || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default TouMonthlyReportPage;
