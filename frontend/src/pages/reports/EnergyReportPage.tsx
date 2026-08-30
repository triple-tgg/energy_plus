import React, { useState, useCallback, useEffect } from 'react';
import FilterBar from '../../components/ui/FilterBar';
import type { FilterValues } from '../../components/ui/FilterBar';
import ExportButtons from '../../components/ui/ExportButtons';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { dashboardApi, reportsApi } from '../../api/client';
import { exportReport, fetchAllReportRows, type ReportExportFormat } from '../../utils/reportExport';
import { LayoutGrid, FileText, Printer, Zap } from 'lucide-react';
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

    // Invoice breakdown modal state
    const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await reportsApi.getEnergyConsumption({
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
        currentFilters.meterTypeId, currentFilters.startDate, currentFilters.endDate]);

    const handleFilterSubmit = (filters: FilterValues) => {
        setPage(1);
        setCurrentFilters(filters);
    };

    const handleExport = async (format: ReportExportFormat) => {
        setExporting(true);
        try {
            const rows = await fetchAllReportRows((exportPage, exportLimit) =>
                reportsApi.getEnergyConsumption({ ...currentFilters, mdb: 'exclude', page: exportPage, limit: exportLimit })
            );
            const exportRows = rows.map((r: any) => ({
                [t('รหัสมิเตอร์', 'Meter Code')]: r.meter_code,
                [t('ชื่อลูกค้า/ผู้เช่า', 'Customer / Tenant')]: r.customer_name,
                [t('อาคาร', 'Building')]: r.building_name,
                [t('ชั้น', 'Floor')]: r.floor,
                [t('รหัสห้อง/สถานที่', 'Room / Site Code')]: r.site_code,
                [t('ชื่อห้อง/สถานที่', 'Room / Site Name')]: r.site_name,
                [t('วันที่มิเตอร์ก่อนหน้า', 'Previous Reading Date')]: r.start_date,
                [t('เลขมิเตอร์ก่อนหน้า', 'Previous Reading')]: Number(r.start_reading || 0),
                [t('วันที่มิเตอร์ล่าสุด', 'Latest Reading Date')]: r.end_date,
                [t('เลขมิเตอร์ล่าสุด', 'Latest Reading')]: Number(r.end_reading || 0),
                [t('จำนวนหน่วยที่ใช้ (kWh)', 'Units Used (kWh)')]: Number(r.units_used || 0),
                [t('ค่าพลังงานไฟฟ้า (บาท)', 'Energy Amount (THB)')]: Number(r.energy_amount || 0),
                [t('ค่าบริการ (บาท)', 'Service Charge (THB)')]: Number(r.service_charge || 0),
                [t('ค่า Ft (บาท)', 'Ft Amount (THB)')]: Number(r.ft_amount || 0),
                [t('รวมก่อน VAT (บาท)', 'Subtotal (THB)')]: Number(r.subtotal || 0),
                [t('VAT 7% (บาท)', 'VAT 7% (THB)')]: Number(r.vat_amount || 0),
                [t('จำนวนเงินสุทธิ (บาท)', 'Total Net Amount (THB)')]: Number(r.total_amount || 0),
            }));

            exportReport(exportRows, `energy_report_${today}`, 'Energy Consumption Report', format);
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
            key: 'start_reading', title: t('เลขก่อนหน้า', 'Prev Reading'),
            render: (v: number) => v != null ? <span style={{ fontFamily: MONO }}>{Number(v).toLocaleString(t('th-TH', 'en-US'), { maximumFractionDigits: 2 })}</span> : '—',
        },
        {
            key: 'end_reading', title: t('เลขล่าสุด', 'Latest Reading'),
            render: (v: number) => v != null ? <span style={{ fontFamily: MONO }}>{Number(v).toLocaleString(t('th-TH', 'en-US'), { maximumFractionDigits: 2 })}</span> : '—',
        },
        {
            key: 'units_used', title: t('หน่วยที่ใช้ (kWh)', 'Units Used (kWh)'),
            render: (v: number) => v != null ? <strong style={{ fontFamily: MONO }}>{Number(v).toLocaleString(t('th-TH', 'en-US'), { maximumFractionDigits: 2 })}</strong> : '—',
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

    return (
        <div>
            {/* Command bar */}
            <div style={{ background: C.bar, color: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${C.accent}`, marginBottom: 16, flexWrap: 'wrap', gap: 10, paddingRight: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}><LayoutGrid size={16} /></div>
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>{t('รายงาน // การคิดค่าไฟฟ้าทั่วไป', 'REPORTS // GENERAL ENERGY BILLING')}</div>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>{t('รายงานการใช้พลังงานและการคิดค่าไฟฟ้าประเภท 1.2 (อัตราก้าวหน้า/Flat Rate สำหรับผู้เช่าและมิเตอร์ลูก)', 'Summary report of energy consumption and billing based on Type 1.2 tariff (Stepped/Flat Rate for tenants and sub-meters)')}</div>
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
                title={t('รายงานการใช้พลังงานและการคิดค่าไฟฟ้าทั่วไป', 'General Energy Consumption & Billing Report')}
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

            {/* Bill Invoice Modal (ตามรูปแบบ Excel Sheet 1) */}
            {selectedInvoice && (
                <Modal
                    isOpen={!!selectedInvoice}
                    onClose={() => setSelectedInvoice(null)}
                    title={t('ใบแจ้งหนี้ค่าใช้จ่าย / ใบเสร็จรับเงิน (Bills)', 'Utility & Energy Bill Invoice')}
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
                                    {t('ใบแจ้งหนี้ค่าใช้จ่าย (Bills)', 'Utility & Energy Bill')}
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
                                    {t('เลขที่ใบแจ้งหนี้:', 'Bill No.:')} <strong style={{ color: C.accent }}>{`Bill-${selectedInvoice.meter_code}`}</strong>
                                </div>
                                <div style={{ fontSize: 12, fontFamily: MONO, color: 'var(--text-muted)', marginTop: 2 }}>
                                    {t('ช่วงวันที่คิดเงิน:', 'Billing Period:')}
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: MONO }}>
                                    {currentFilters.startDate} — {currentFilters.endDate}
                                </div>
                            </div>
                        </div>

                        {/* Invoice Items Table (Matching Excel Sheet1) */}
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: MONO }}>
                                <thead>
                                    <tr style={{ background: theme === 'dark' ? '#1c232e' : '#f1efe3', borderBottom: '2px solid var(--border)' }}>
                                        <th style={{ padding: '8px 10px', textAlign: 'left', width: 45 }}>No.</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>{t('รายการ (Description)', 'Description')}</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>{t('อัตรา (Rate)', 'Rate')}</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>{t('หน่วย (Unit)', 'Unit')}</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>{t('จำนวนเงิน (บาท)', 'Amount (THB)')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* 1. Electricity Header */}
                                    <tr style={{ background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', fontWeight: 700 }}>
                                        <td style={{ padding: '8px 10px' }}>1</td>
                                        <td style={{ padding: '8px 10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Zap size={14} color="#f59e0b" />
                                                <span>{t('ค่าไฟฟ้า ประเภท 1.2', 'Electricity Charge (Type 1.2)')}</span>
                                            </div>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>
                                                {t('มิเตอร์ No.', 'Meter No.')} {selectedInvoice.meter_code} ({selectedInvoice.start_reading} - {selectedInvoice.end_reading})
                                            </div>
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>—</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{Number(selectedInvoice.units_used || 0).toFixed(2)} kWh</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>—</td>
                                    </tr>

                                    {/* 1.1 Tier 1 */}
                                    {selectedInvoice.rate_mode === 'tiered' ? (
                                        <>
                                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '6px 10px', color: 'var(--text-muted)', paddingLeft: 20 }}>1.1</td>
                                                <td style={{ padding: '6px 10px' }}>
                                                    <div>{t(`200 หน่วยแรก (1-${selectedInvoice.tier1_limit || 200})`, `First 200 units (1-${selectedInvoice.tier1_limit || 200})`)}</div>
                                                </td>
                                                <td style={{ padding: '6px 10px', textAlign: 'right' }}>฿{Number(selectedInvoice.tier1_rate || 3).toFixed(2)}</td>
                                                <td style={{ padding: '6px 10px', textAlign: 'right' }}>{Number(selectedInvoice.tier1_units || 0).toFixed(2)}</td>
                                                <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                                                    ฿{Number(selectedInvoice.tier1_amount || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>

                                            {/* 1.2 Tier 2 */}
                                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '6px 10px', color: 'var(--text-muted)', paddingLeft: 20 }}>1.2</td>
                                                <td style={{ padding: '6px 10px' }}>
                                                    <div>{t(`หน่วยต่อไป (${Number(selectedInvoice.tier1_limit || 200) + 1}-xxx)`, `Next units (${Number(selectedInvoice.tier1_limit || 200) + 1}-xxx)`)}</div>
                                                </td>
                                                <td style={{ padding: '6px 10px', textAlign: 'right' }}>฿{Number(selectedInvoice.tier2_rate || 4.22).toFixed(2)}</td>
                                                <td style={{ padding: '6px 10px', textAlign: 'right' }}>{Number(selectedInvoice.tier2_units || 0).toFixed(2)}</td>
                                                <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                                                    ฿{Number(selectedInvoice.tier2_amount || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        </>
                                    ) : (
                                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '6px 10px', color: 'var(--text-muted)', paddingLeft: 20 }}>1.1</td>
                                            <td style={{ padding: '6px 10px' }}>{t('อัตราคงที่ต่อหน่วย (Flat Rate)', 'Flat Rate')}</td>
                                            <td style={{ padding: '6px 10px', textAlign: 'right' }}>฿{Number(selectedInvoice.unit_price || 4.15).toFixed(2)}</td>
                                            <td style={{ padding: '6px 10px', textAlign: 'right' }}>{Number(selectedInvoice.units_used || 0).toFixed(2)}</td>
                                            <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                                                ฿{Number(selectedInvoice.energy_amount || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    )}

                                    {/* 1.3 Service Charge */}
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '6px 10px', color: 'var(--text-muted)', paddingLeft: 20 }}>1.3</td>
                                        <td style={{ padding: '6px 10px' }}>{t('ค่าบริการรายเดือน (Service Charge)', 'Monthly Service Charge')}</td>
                                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>—</td>
                                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>1 {t('เดือน', 'Month')}</td>
                                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                                            ฿{Number(selectedInvoice.service_charge || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>

                                    {/* 1.4 Fuel Adjustment Ft */}
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '6px 10px', color: 'var(--text-muted)', paddingLeft: 20 }}>1.4</td>
                                        <td style={{ padding: '6px 10px' }}>
                                            <div>{t('ค่าไฟฟ้าแปรผัน (Ft)', 'Fuel Adjustment (Ft)')}</div>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t(`อัตรา ${Number(selectedInvoice.ft_rate || 0.1623).toFixed(2)} ฿/หน่วย × หน่วยไฟฟ้ารวม`, `Rate ${Number(selectedInvoice.ft_rate || 0.1623).toFixed(2)} ฿/kWh × Total kWh`)}</div>
                                        </td>
                                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>฿{Number(selectedInvoice.ft_rate || 0.1623).toFixed(2)}</td>
                                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>{Number(selectedInvoice.units_used || 0).toFixed(2)}</td>
                                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                                            ฿{Number(selectedInvoice.ft_amount || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>

                                    {/* Subtotal Before VAT */}
                                    <tr style={{ borderBottom: '1px solid var(--border)', background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                                        <td colSpan={4} style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>
                                            {t('รวมค่าไฟฟ้าก่อนภาษีมูลค่าเพิ่ม:', 'Subtotal Electricity Before VAT:')}
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                                            ฿{Number(selectedInvoice.subtotal || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>

                                    {/* 1.5 VAT 7% */}
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '6px 10px', color: 'var(--text-muted)', paddingLeft: 20 }}>1.5</td>
                                        <td colSpan={3} style={{ padding: '6px 10px' }}>
                                            {t(`ภาษีมูลค่าเพิ่ม VAT ${Number(selectedInvoice.vat_percent || 7).toFixed(0)}%`, `VAT (${Number(selectedInvoice.vat_percent || 7).toFixed(0)}%)`)}
                                        </td>
                                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                                            ฿{Number(selectedInvoice.vat_amount || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>

                                    {/* Total Electricity Amount */}
                                    <tr style={{ background: theme === 'dark' ? 'rgba(37,99,235,0.15)' : '#EFF6FF', borderTop: '2px solid #2563eb' }}>
                                        <td colSpan={4} style={{ padding: '10px', fontWeight: 700, fontSize: 13, textAlign: 'right', color: '#2563eb' }}>
                                            {t('รวมค่าไฟฟ้าสุทธิ (Net Electricity Amount):', 'Net Electricity Amount:')}
                                        </td>
                                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, fontSize: 15, color: '#2563eb' }}>
                                            ฿{Number(selectedInvoice.total_amount || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default EnergyReportPage;
