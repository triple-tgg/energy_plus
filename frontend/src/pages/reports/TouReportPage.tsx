import React, { useState, useCallback, useEffect } from 'react';
import FilterBar from '../../components/ui/FilterBar';
import type { FilterValues } from '../../components/ui/FilterBar';
import ExportButtons from '../../components/ui/ExportButtons';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { dashboardApi, reportsApi } from '../../api/client';
import { exportReport, fetchAllReportRows, type ReportExportFormat } from '../../utils/reportExport';
import { Clock, FileText, Printer, Zap, AlertCircle } from 'lucide-react';
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

const TouReportPage: React.FC = () => {
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
            const res = await reportsApi.getTouReport({
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
        currentFilters.meterTypeId, currentFilters.startDate, currentFilters.endDate]);

    const handleFilterSubmit = (filters: FilterValues) => {
        setPage(1);
        setCurrentFilters(filters);
    };

    const handleExport = async (format: ReportExportFormat) => {
        setExporting(true);
        try {
            const rows = await fetchAllReportRows((exportPage, exportLimit) =>
                reportsApi.getTouReport({ ...currentFilters, page: exportPage, limit: exportLimit })
            );
            const exportRows = rows.map((r: any) => ({
                [t('รหัสมิเตอร์', 'Meter Code')]: r.meter_code,
                [t('ชื่อลูกค้า/มิเตอร์', 'Customer / Meter Name')]: r.customer_name,
                [t('อาคาร', 'Building')]: r.building_name,
                [t('ชั้น', 'Floor')]: r.floor,
                [t('รหัสสถานที่', 'Site Code')]: r.site_code,
                [t('ชื่อสถานที่', 'Site Name')]: r.site_name,
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

            exportReport(exportRows, `tou_report_${today}`, 'TOU Energy Report', format);
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
            title: t('Peak Demand (บาท)', 'Demand (THB)'),
            render: (_: any, r: any) => (
                <div>
                    <div style={{ fontFamily: MONO, color: '#ef4444', fontWeight: 600 }}>฿{Number(r.demand_amount || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div style={{ fontSize: 10, color: C.sub }}>{Number(r.peak_demand_kw || 0).toFixed(2)} kW</div>
                </div>
            ),
        },
        {
            key: 'pf_penalty_amount',
            title: t('ค่าปรับ PF (บาท)', 'PF Penalty (THB)'),
            render: (_: any, r: any) => {
                const amt = Number(r.pf_penalty_amount || 0);
                return (
                    <div>
                        <div style={{ fontFamily: MONO, color: amt > 0 ? '#ef4444' : C.sub, fontWeight: amt > 0 ? 600 : 400 }}>
                            {amt > 0 ? `฿${amt.toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                        </div>
                        {amt > 0 && <div style={{ fontSize: 10, color: '#ef4444' }}>+{Number(r.kvar_excess || 0).toFixed(2)} kVAR</div>}
                    </div>
                );
            },
        },
        {
            key: 'ft_amount',
            title: t('ค่า Ft (บาท)', 'Ft (THB)'),
            render: (v: number) => <span style={{ fontFamily: MONO }}>฿{Number(v || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>,
        },
        {
            key: 'total_amount',
            title: t('ยอดรวมสุทธิ (บาท)', 'Net Total (THB)'),
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

    return (
        <div>
            {/* Command bar */}
            <div style={{ background: C.bar, color: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${C.accent}`, marginBottom: 16, flexWrap: 'wrap', gap: 10, paddingRight: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}><Clock size={16} /></div>
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>{t('รายงาน // ค่าไฟฟ้าแบบ TOU', 'REPORTS // TOU DEMAND & ENERGY')}</div>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>{t('รายงานการคำนวณค่าไฟฟ้าแบบ TOU (On-Peak, Off-Peak, Peak Demand, ค่าปรับ PF, Ft และใบแจ้งหนี้)', 'TOU Electricity Billing Report (On-Peak, Off-Peak, Peak Demand, PF Penalty, Ft, and Invoice Breakdown)')}</div>
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
                title={t('รายงานการใช้พลังงานและการคิดค่าไฟฟ้าแบบ TOU', 'TOU Energy & Billing Consumption Report')}
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

            {/* Bill Invoice Modal (ตามรูปแบบ Excel TOU) */}
            {selectedInvoice && (
                <Modal
                    isOpen={!!selectedInvoice}
                    onClose={() => setSelectedInvoice(null)}
                    title={t('ใบแจ้งหนี้ / รายละเอียดการคำนวณค่าไฟฟ้า TOU', 'TOU Electricity Bill Breakdown')}
                    size="lg"
                    footer={
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {t('อ้างอิงอัตราค่าไฟ TOU ณ วันที่:', 'Tariff effective date:')} {selectedInvoice.tariff_info?.effective_date || '—'}
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
                        {/* Header Box */}
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
                                    {t('ใบแจ้งหนี้ค่าไฟฟ้า TOU (Bills)', 'Electricity Bill (TOU)')}
                                </div>
                                <div style={{ fontSize: 13, marginTop: 4 }}>
                                    <strong>{t('ชื่อผู้เช่า / มิเตอร์:', 'Customer / Meter:')}</strong> {selectedInvoice.customer_name || selectedInvoice.meter_name || '—'}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                    {t('รหัสมิเตอร์:', 'Meter Code:')} <strong>{selectedInvoice.meter_code}</strong> | {t('สถานที่:', 'Location:')} {selectedInvoice.building_name} {selectedInvoice.floor ? `${t('ชั้น', 'Fl.')} ${selectedInvoice.floor}` : ''} ({selectedInvoice.site_name || '—'})
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 12, fontFamily: MONO, color: 'var(--text-muted)' }}>
                                    {t('ช่วงวันที่คิดเงิน:', 'Billing Period:')}
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: MONO }}>
                                    {currentFilters.startDate} — {currentFilters.endDate}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                    {t('หน่วยรวม:', 'Total Energy:')} <strong>{Number(selectedInvoice.units_used || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh</strong>
                                </div>
                            </div>
                        </div>

                        {/* Breakdown Table (Matching Excel Sheet TOU) */}
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
                                    {/* 1.1 On-Peak */}
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>1.1</td>
                                        <td style={{ padding: '8px 10px' }}>
                                            <div style={{ fontWeight: 600, color: '#f59e0b' }}>{t('ค่าพลังงานไฟฟ้า On-Peak', 'On-Peak Energy')}</div>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('(09.00 - 22.00 น. จันทร์ - ศุกร์)', '(09:00 - 22:00 Mon - Fri)')}</div>
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>฿{Number(selectedInvoice.on_peak_rate || 0).toFixed(2)}</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{Number(selectedInvoice.on_peak_kwh || 0).toFixed(2)} kWh</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                                            ฿{Number(selectedInvoice.on_peak_amount || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>

                                    {/* 1.2 Off-Peak */}
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>1.2</td>
                                        <td style={{ padding: '8px 10px' }}>
                                            <div style={{ fontWeight: 600, color: '#10b981' }}>{t('ค่าพลังงานไฟฟ้า Off-Peak', 'Off-Peak Energy')}</div>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('(22.00 - 09.00 น. จันทร์ - ศุกร์ + วันหยุดราชการ)', '(22:00 - 09:00 Mon - Fri + Weekends/Holidays)')}</div>
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>฿{Number(selectedInvoice.off_peak_rate || 0).toFixed(2)}</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{Number(selectedInvoice.off_peak_kwh || 0).toFixed(2)} kWh</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                                            ฿{Number(selectedInvoice.off_peak_amount || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>

                                    {/* 1.3 Peak Demand */}
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>1.3</td>
                                        <td style={{ padding: '8px 10px' }}>
                                            <div style={{ fontWeight: 600, color: '#ef4444' }}>{t('ความต้องการพลังงานไฟฟ้า (Peak Demand)', 'Peak Demand')}</div>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('(kW สูงสุดใน 15 นาทีช่วง On-Peak)', '(Max 15-min kW during On-Peak)')}</div>
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>฿{Number(selectedInvoice.demand_rate || 0).toFixed(2)}</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{Number(selectedInvoice.peak_demand_kw || 0).toFixed(2)} kW</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                                            ฿{Number(selectedInvoice.demand_amount || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>

                                    {/* 1.4 Power Factor Penalty */}
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>1.4</td>
                                        <td style={{ padding: '8px 10px' }}>
                                            <div style={{ fontWeight: 600 }}>{t('ค่าปรับเพาเวอร์แฟคเตอร์ (Power Factor Penalty)', 'Power Factor Penalty')}</div>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                                {t(`kVAR รวม: ${Number(selectedInvoice.total_kvar || 0).toFixed(2)} | เกณฑ์ยอมรับได้ (61.97%): ${Number(selectedInvoice.kvar_allowable || 0).toFixed(2)} kVAR`,
                                                    `Total kVAR: ${Number(selectedInvoice.total_kvar || 0).toFixed(2)} | Allowable (61.97%): ${Number(selectedInvoice.kvar_allowable || 0).toFixed(2)} kVAR`)}
                                            </div>
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>฿{Number(selectedInvoice.pf_penalty_rate || 0).toFixed(2)}</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                            {Number(selectedInvoice.kvar_excess || 0) > 0 ? `${Number(selectedInvoice.kvar_excess).toFixed(2)} kVAR` : '0.00 kVAR'}
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: Number(selectedInvoice.pf_penalty_amount || 0) > 0 ? '#ef4444' : 'inherit' }}>
                                            ฿{Number(selectedInvoice.pf_penalty_amount || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>

                                    {/* 1.5 Service Charge */}
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>1.5</td>
                                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{t('ค่าบริการรายเดือน (Service Charge)', 'Monthly Service Charge')}</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>—</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>1 {t('เดือน', 'Month')}</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                                            ฿{Number(selectedInvoice.service_charge || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>

                                    {/* 1.6 Fuel Adjustment (Ft) */}
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>1.6</td>
                                        <td style={{ padding: '8px 10px' }}>
                                            <div style={{ fontWeight: 600 }}>{t('ค่าไฟฟ้าแปรผัน (Ft)', 'Fuel Adjustment (Ft)')}</div>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t(`อัตรา ${Number(selectedInvoice.ft_rate || 0).toFixed(2)} ฿/หน่วย × หน่วยไฟฟ้ารวม`, `Rate ${Number(selectedInvoice.ft_rate || 0).toFixed(2)} ฿/kWh × Total kWh`)}</div>
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>฿{Number(selectedInvoice.ft_rate || 0).toFixed(2)}</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{Number(selectedInvoice.units_used || 0).toFixed(2)} kWh</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                                            ฿{Number(selectedInvoice.ft_amount || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>

                                    {/* Subtotal Before VAT */}
                                    <tr style={{ borderBottom: '1px solid var(--border)', background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                                        <td colSpan={4} style={{ padding: '10px', fontWeight: 700, textAlign: 'right' }}>
                                            {t('รวมค่าไฟฟ้าก่อนภาษีมูลค่าเพิ่ม (Subtotal Before VAT):', 'Subtotal Before VAT:')}
                                        </td>
                                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                                            ฿{Number(selectedInvoice.subtotal || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>

                                    {/* 1.7 VAT 7% */}
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>1.7</td>
                                        <td colSpan={3} style={{ padding: '8px 10px', fontWeight: 600 }}>
                                            {t(`ภาษีมูลค่าเพิ่ม VAT ${Number(selectedInvoice.vat_percent || 7).toFixed(0)}%`, `Value Added Tax (VAT ${Number(selectedInvoice.vat_percent || 7).toFixed(0)}%)`)}
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                                            ฿{Number(selectedInvoice.vat_amount || 0).toLocaleString(t('th-TH', 'en-US'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>

                                    {/* Total Net Amount */}
                                    <tr style={{ background: theme === 'dark' ? 'rgba(37,99,235,0.15)' : '#EFF6FF', borderTop: '2px solid #2563eb' }}>
                                        <td colSpan={4} style={{ padding: '12px 10px', fontWeight: 700, fontSize: 14, textAlign: 'right', color: '#2563eb' }}>
                                            {t('รวมเงินค่าไฟฟ้าทั้งสิ้น (Total Net Amount):', 'Total Net Amount:')}
                                        </td>
                                        <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700, fontSize: 16, color: '#2563eb' }}>
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

export default TouReportPage;
