import React, { useState, useCallback, useEffect } from 'react';
import FilterBar from '../../components/ui/FilterBar';
import type { FilterValues } from '../../components/ui/FilterBar';
import ExportButtons from '../../components/ui/ExportButtons';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { dashboardApi, reportsApi } from '../../api/client';
import { exportReport, fetchAllReportRows, type ReportExportFormat } from '../../utils/reportExport';
import { CalendarDays, FileText, Printer, Zap } from 'lucide-react';
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

const EnergyMonthlyReportPage: React.FC = () => {
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
            const res = await reportsApi.getEnergyMonthly({
                ...currentFilters, mdb: 'exclude', page, limit,
            });
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [currentFilters, page, limit]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        dashboardApi.getConsumptionMeters({ ...currentFilters, mdb: 'exclude' })
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
                reportsApi.getEnergyMonthly({ ...currentFilters, mdb: 'exclude', page: exportPage, limit: exportLimit })
            );
            const exportRows = rows.map((r: any) => ({
                [t('รหัสมิเตอร์', 'Meter Code')]: r.meter_code,
                [t('ชื่อลูกค้า/ผู้เช่า', 'Customer / Tenant')]: r.customer_name,
                [t('อาคาร', 'Building')]: r.building_name,
                [t('ชั้น', 'Floor')]: r.floor,
                [t('รหัสห้อง/สถานที่', 'Room / Site Code')]: r.site_code,
                [t('ชื่อห้อง/สถานที่', 'Room / Site Name')]: r.site_name,
                [t('เดือนที่เรียกเก็บ', 'Billing Month')]: r.billing_month,
                [t('เลขมิเตอร์ต้นเดือน', 'Start Reading')]: Number(r.start_reading || 0),
                [t('เลขมิเตอร์ปลายเดือน', 'End Reading')]: Number(r.end_reading || 0),
                [t('จำนวนหน่วยที่ใช้ (kWh)', 'Units Used (kWh)')]: Number(r.units_used || 0),
                [t('ค่าพลังงานไฟฟ้า (บาท)', 'Energy Amount (THB)')]: Number(r.energy_amount || 0),
                [t('ค่าบริการ (บาท)', 'Service Charge (THB)')]: Number(r.service_charge || 0),
                [t('ค่า Ft (บาท)', 'Ft Amount (THB)')]: Number(r.ft_amount || 0),
                [t('รวมก่อน VAT (บาท)', 'Subtotal (THB)')]: Number(r.subtotal || 0),
                [t('VAT 7% (บาท)', 'VAT 7% (THB)')]: Number(r.vat_amount || 0),
                [t('จำนวนเงินสุทธิ (บาท)', 'Total Net Amount (THB)')]: Number(r.total_amount || 0),
            }));

            const monthStr = `${currentFilters.year || now.getFullYear()}-${String(currentFilters.month || now.getMonth() + 1).padStart(2, '0')}`;
            exportReport(exportRows, `energy_monthly_report_${monthStr}`, 'Energy Monthly Report', format);
        } catch (err) {
            alert(t('การส่งออกข้อมูลล้มเหลว', 'Export failed'));
        } finally { setExporting(false); }
    };

    const handlePrintInvoice = () => {
        window.print();
    };

    const columns = [
        { key: 'meter_code', title: t('รหัสมิเตอร์', 'Meter Code') },
        { key: 'customer_name', title: t('ชื่อลูกค้า/ผู้เช่า', 'Customer/Tenant') },
        { key: 'building_name', title: t('อาคาร', 'Building') },
        { key: 'floor', title: t('ชั้น', 'Floor') },
        { key: 'site_code', title: t('รหัสห้อง', 'Room Code') },
        {
            key: 'start_reading', title: t('เลขต้นเดือน', 'Start Reading'),
            render: (v: number) => v != null ? <span style={{ fontFamily: MONO }}>{Number(v).toLocaleString(t('th-TH', 'en-US'), { maximumFractionDigits: 2 })}</span> : '0.00',
        },
        {
            key: 'end_reading', title: t('เลขปลายเดือน', 'End Reading'),
            render: (v: number) => v != null ? <span style={{ fontFamily: MONO }}>{Number(v).toLocaleString(t('th-TH', 'en-US'), { maximumFractionDigits: 2 })}</span> : '0.00',
        },
        {
            key: 'units_used', title: t('หน่วยที่ใช้ (kWh)', 'Units Used (kWh)'),
            render: (v: number) => v != null ? <strong style={{ fontFamily: MONO }}>{Number(v).toLocaleString(t('th-TH', 'en-US'), { maximumFractionDigits: 2 })}</strong> : '0.00',
        },
        {
            key: 'energy_amount', title: t('ค่าพลังงาน (บาท)', 'Energy (THB)'),
            render: (v: number) => <span style={{ fontFamily: MONO, color: '#f59e0b', fontWeight: 600 }}>฿{Number(v || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>,
        },
        {
            key: 'service_charge', title: t('ค่าบริการ (บาท)', 'Service (THB)'),
            render: (v: number) => <span style={{ fontFamily: MONO }}>฿{Number(v || 0).toFixed(2)}</span>,
        },
        {
            key: 'ft_amount', title: t('ค่า Ft (บาท)', 'Ft (THB)'),
            render: (v: number) => <span style={{ fontFamily: MONO }}>฿{Number(v || 0).toFixed(2)}</span>,
        },
        {
            key: 'total_amount', title: t('ยอดสุทธิ (บาท)', 'Net Total (THB)'),
            render: (v: number) => v != null ? <strong style={{ fontFamily: MONO, color: C.accent, fontSize: 13 }}>฿{Number(v).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> : '—',
        },
        {
            key: 'actions', title: t('ใบแจ้งหนี้', 'Invoice'),
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
            <div style={{ background: C.bar, color: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${C.accent}`, marginBottom: 16, flexWrap: 'wrap', gap: 10, paddingRight: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}><CalendarDays size={16} /></div>
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>{t('รายงาน // ค่าไฟฟ้ารายเดือนทั่วไป', 'REPORTS // ENERGY MONTHLY BILLING')}</div>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>{t('รายงานการใช้พลังงานและการคิดค่าไฟฟ้ารายเดือน (ตัดรอบต้นเดือน-ปลายเดือน พร้อมออกบิลสำหรับผู้เช่า)', 'Monthly summary report of energy consumption and billing with automated start-of-month and end-of-month meter readings')}</div>
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
                showMonthYear={true}
                showSearchMeter
                meterOptions={meterOptions}
            />

            <DataTable
                title={`${t('รายงานค่าไฟฟ้ารายเดือน', 'Energy Monthly Consumption & Billing Report')} (${selectedMonthFormatted})`}
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

            {/* Bill Invoice Modal */}
            {selectedInvoice && (
                <Modal
                    isOpen={!!selectedInvoice}
                    onClose={() => setSelectedInvoice(null)}
                    title={t('ใบแจ้งหนี้ค่าใช้จ่ายรายเดือน / ใบเสร็จรับเงิน (Monthly Bills)', 'Monthly Utility & Energy Bill Invoice')}
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
                                    {t('ใบแจ้งหนี้ค่าใช้จ่ายรายเดือน (Monthly Bill)', 'Monthly Energy & Utility Bill')}
                                </div>
                                <div style={{ fontSize: 13, marginTop: 4 }}>
                                    <strong>{t('ชื่อผู้เช่า / ผู้รับบริการ:', 'Customer / Tenant Name:')}</strong> {selectedInvoice.customer_name || '—'}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                    {t('โครงการ:', 'Project:')} <strong>{selectedInvoice.site_name || '—'}</strong> | {t('อาคาร:', 'Building:')} {selectedInvoice.building_name} | {t('ชั้น:', 'Floor:')} {selectedInvoice.floor || '—'} | {t('ห้อง:', 'Room:')} {selectedInvoice.site_code || '—'}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 12, fontFamily: MONO, color: 'var(--text-muted)' }}>
                                    {t('เลขที่ใบแจ้งหนี้:', 'Bill No.:')} <strong style={{ color: C.accent }}>{`BILL-${selectedInvoice.billing_month || selectedMonthFormatted}-${selectedInvoice.meter_code}`}</strong>
                                </div>
                                <div style={{ fontSize: 12, fontFamily: MONO, color: 'var(--text-muted)', marginTop: 2 }}>
                                    {t('รอบเดือนที่เรียกเก็บ:', 'Billing Month:')}
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: MONO }}>
                                    {selectedInvoice.billing_period || selectedInvoice.billing_month || selectedMonthFormatted}
                                </div>
                            </div>
                        </div>

                        {/* Meter Readings Box */}
                        <div style={{
                            background: 'var(--bg-secondary)',
                            borderRadius: 6,
                            padding: '12px 16px',
                            marginBottom: 16,
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                            gap: 12,
                        }}>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('รหัสมิเตอร์', 'Meter Code')}</div>
                                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: MONO }}>{selectedInvoice.meter_code}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('เลขมิเตอร์ต้นเดือน', 'Start Reading')}</div>
                                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: MONO }}>{Number(selectedInvoice.start_reading || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('เลขมิเตอร์ปลายเดือน', 'End Reading')}</div>
                                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: MONO }}>{Number(selectedInvoice.end_reading || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('จำนวนหน่วยที่ใช้ (kWh)', 'Units Used')}</div>
                                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: MONO, color: C.accent }}>
                                    {Number(selectedInvoice.units_used || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: 11, fontWeight: 400 }}>kWh</span>
                                </div>
                            </div>
                        </div>

                        {/* Calculation Breakdown Table */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-secondary)' }}>
                                    <th style={{ textAlign: 'left', padding: '8px 10px' }}>{t('รายการคำนวณ', 'Description')}</th>
                                    <th style={{ textAlign: 'right', padding: '8px 10px' }}>{t('จำนวนหน่วย', 'Units')}</th>
                                    <th style={{ textAlign: 'right', padding: '8px 10px' }}>{t('อัตราต่อหน่วย (฿)', 'Rate (THB)')}</th>
                                    <th style={{ textAlign: 'right', padding: '8px 10px' }}>{t('จำนวนเงิน (บาท)', 'Amount (THB)')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedInvoice.rate_mode === 'tiered' ? (
                                    <>
                                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '8px 10px' }}>
                                                {t('ค่าพลังงานไฟฟ้า ขั้นที่ 1 (1 - ', 'Energy Charge Tier 1 (1 - ')}{selectedInvoice.tier1_limit || 200} {t('หน่วย)', 'Units)')}
                                            </td>
                                            <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO }}>{Number(selectedInvoice.tier1_units || 0).toFixed(2)}</td>
                                            <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO }}>฿{Number(selectedInvoice.tier1_rate || 3).toFixed(4)}</td>
                                            <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO }}>฿{Number(selectedInvoice.tier1_amount || 0).toFixed(2)}</td>
                                        </tr>
                                        {Number(selectedInvoice.tier2_units || 0) > 0 && (
                                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '8px 10px' }}>
                                                    {t('ค่าพลังงานไฟฟ้า ขั้นที่ 2 (ส่วนที่เกิน ', 'Energy Charge Tier 2 (Excess over ')}{selectedInvoice.tier1_limit || 200} {t('หน่วย)', 'Units)')}
                                                </td>
                                                <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO }}>{Number(selectedInvoice.tier2_units || 0).toFixed(2)}</td>
                                                <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO }}>฿{Number(selectedInvoice.tier2_rate || 4.22).toFixed(4)}</td>
                                                <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO }}>฿{Number(selectedInvoice.tier2_amount || 0).toFixed(2)}</td>
                                            </tr>
                                        )}
                                    </>
                                ) : (
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '8px 10px' }}>{t('ค่าพลังงานไฟฟ้า (Flat Rate)', 'Energy Charge (Flat Rate)')}</td>
                                        <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO }}>{Number(selectedInvoice.units_used || 0).toFixed(2)}</td>
                                        <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO }}>฿{Number(selectedInvoice.tariff_info?.unit_price || 4.15).toFixed(4)}</td>
                                        <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO }}>฿{Number(selectedInvoice.energy_amount || 0).toFixed(2)}</td>
                                    </tr>
                                )}

                                <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(245,158,11,0.03)' }}>
                                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{t('รวมค่าพลังงานไฟฟ้า (Base Energy Charge)', 'Total Energy Base Charge')}</td>
                                    <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO }}>{Number(selectedInvoice.units_used || 0).toFixed(2)}</td>
                                    <td></td>
                                    <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO, fontWeight: 600, color: '#f59e0b' }}>
                                        ฿{Number(selectedInvoice.energy_amount || 0).toFixed(2)}
                                    </td>
                                </tr>

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
                                    <td style={{ textAlign: 'right', padding: '8px 10px', fontFamily: MONO }}>{Number(selectedInvoice.units_used || 0).toFixed(2)}</td>
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

export default EnergyMonthlyReportPage;
