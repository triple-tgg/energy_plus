import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { billingApi } from '../../api/client';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Zap, Clock, Coins, Info } from 'lucide-react';

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, "Cascadia Mono", monospace';

interface GeneralBillingForm {
    effectiveDate: string;
    rateMode: 'tiered' | 'flat';
    unitPrice: string;
    tier1Limit: string;
    tier1Rate: string;
    tier2Rate: string;
    serviceCharge: string;
    ftRate: string;
    vatPercent: string;
    isActive: boolean;
}

interface TouBillingForm {
    effectiveDate: string;
    onPeakRate: string;
    offPeakRate: string;
    demandRate: string;
    pfPenaltyRate: string;
    pfThresholdFactor: string;
    serviceCharge: string;
    ftRate: string;
    vatPercent: string;
    isActive: boolean;
}

const emptyGeneralForm: GeneralBillingForm = {
    effectiveDate: new Date().toISOString().slice(0, 10),
    rateMode: 'tiered',
    unitPrice: '4.1500',
    tier1Limit: '200',
    tier1Rate: '3.0000',
    tier2Rate: '4.2200',
    serviceCharge: '24.6200',
    ftRate: '0.1623',
    vatPercent: '7.00',
    isActive: true,
};

const emptyTouForm: TouBillingForm = {
    effectiveDate: new Date().toISOString().slice(0, 10),
    onPeakRate: '5.7982',
    offPeakRate: '2.6369',
    demandRate: '210.0000',
    pfPenaltyRate: '56.0700',
    pfThresholdFactor: '0.6197',
    serviceCharge: '38.2200',
    ftRate: '0.1623',
    vatPercent: '7.00',
    isActive: true,
};

const BillingPage: React.FC = () => {
    const { t, language } = useLanguage();
    const { theme } = useTheme();
    const [activeTab, setActiveTab] = useState<'general' | 'tou'>('tou');

    // General Tariff State
    const [generalData, setGeneralData] = useState<any[]>([]);
    const [generalTotal, setGeneralTotal] = useState(0);
    const [generalPage, setGeneralPage] = useState(1);
    const [generalLimit, setGeneralLimit] = useState(10);
    const [generalLoading, setGeneralLoading] = useState(false);
    const [generalModal, setGeneralModal] = useState(false);
    const [generalEditId, setGeneralEditId] = useState<number | null>(null);
    const [generalForm, setGeneralForm] = useState<GeneralBillingForm>(emptyGeneralForm);

    // TOU Tariff State
    const [touData, setTouData] = useState<any[]>([]);
    const [touTotal, setTouTotal] = useState(0);
    const [touPage, setTouPage] = useState(1);
    const [touLimit, setTouLimit] = useState(10);
    const [touLoading, setTouLoading] = useState(false);
    const [touModal, setTouModal] = useState(false);
    const [touEditId, setTouEditId] = useState<number | null>(null);
    const [touForm, setTouForm] = useState<TouBillingForm>(emptyTouForm);

    // Delete State
    const [showDelete, setShowDelete] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deleteType, setDeleteType] = useState<'general' | 'tou'>('general');
    const [deleting, setDeleting] = useState(false);

    // Form feedback
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Fetch General
    const fetchGeneral = useCallback(async () => {
        setGeneralLoading(true);
        try {
            const res = await billingApi.getConfigs({ page: generalPage, limit: generalLimit });
            setGeneralData(res.data.data || []);
            setGeneralTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setGeneralLoading(false);
    }, [generalPage, generalLimit]);

    // Fetch TOU
    const fetchTou = useCallback(async () => {
        setTouLoading(true);
        try {
            const res = await billingApi.getTouConfigs({ page: touPage, limit: touLimit });
            setTouData(res.data.data || []);
            setTouTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setTouLoading(false);
    }, [touPage, touLimit]);

    useEffect(() => {
        if (activeTab === 'general') fetchGeneral();
        else fetchTou();
    }, [activeTab, fetchGeneral, fetchTou]);

    useEffect(() => {
        if (successMsg) {
            const timer = setTimeout(() => setSuccessMsg(''), 3500);
            return () => clearTimeout(timer);
        }
    }, [successMsg]);

    // General Handlers
    const handleCreateGeneral = () => {
        setGeneralEditId(null);
        setGeneralForm({ ...emptyGeneralForm, effectiveDate: new Date().toISOString().slice(0, 10) });
        setFormError('');
        setGeneralModal(true);
    };

    const handleEditGeneral = (row: any) => {
        setGeneralEditId(row.id);
        setGeneralForm({
            effectiveDate: row.effective_date ? row.effective_date.substring(0, 10) : '',
            rateMode: row.rate_mode || 'tiered',
            unitPrice: row.unit_price?.toString() || '4.1500',
            tier1Limit: row.tier1_limit?.toString() || '200',
            tier1Rate: row.tier1_rate?.toString() || '3.0000',
            tier2Rate: row.tier2_rate?.toString() || '4.2200',
            serviceCharge: row.service_charge?.toString() || '24.6200',
            ftRate: row.ft_rate?.toString() || '0.1623',
            vatPercent: row.vat_percent?.toString() || '7.00',
            isActive: row.is_active ?? true,
        });
        setFormError('');
        setGeneralModal(true);
    };

    const handleSaveGeneral = async () => {
        if (!generalForm.effectiveDate) {
            setFormError(t('กรุณาระบุวันที่มีผลบังคับใช้', 'Please specify the effective date'));
            return;
        }
        setSaving(true);
        setFormError('');
        try {
            const payload = {
                effectiveDate: generalForm.effectiveDate,
                rateMode: generalForm.rateMode,
                unitPrice: parseFloat(generalForm.unitPrice || '4.15'),
                tier1Limit: parseFloat(generalForm.tier1Limit || '200'),
                tier1Rate: parseFloat(generalForm.tier1Rate || '3.00'),
                tier2Rate: parseFloat(generalForm.tier2Rate || '4.22'),
                serviceCharge: parseFloat(generalForm.serviceCharge || '24.62'),
                ftRate: parseFloat(generalForm.ftRate || '0.1623'),
                vatPercent: parseFloat(generalForm.vatPercent || '7.00'),
                isActive: generalForm.isActive,
            };
            if (generalEditId) {
                await billingApi.updateConfig(generalEditId, payload);
                setSuccessMsg(t('อัปเดตอัตราค่าไฟฟ้าทั่วไปสำเร็จ!', 'Updated general electricity rate successfully!'));
            } else {
                await billingApi.createConfig(payload);
                setSuccessMsg(t('สร้างอัตราค่าไฟฟ้าทั่วไปสำเร็จ!', 'Created general electricity rate successfully!'));
            }
            setGeneralModal(false);
            fetchGeneral();
        } catch (err: any) {
            setFormError(err.response?.data?.message || t('บันทึกไม่สำเร็จ', 'Save failed'));
        }
        setSaving(false);
    };

    // TOU Handlers
    const handleCreateTou = () => {
        setTouEditId(null);
        setTouForm({ ...emptyTouForm, effectiveDate: new Date().toISOString().slice(0, 10) });
        setFormError('');
        setTouModal(true);
    };

    const handleEditTou = (row: any) => {
        setTouEditId(row.id);
        setTouForm({
            effectiveDate: row.effective_date ? row.effective_date.substring(0, 10) : '',
            onPeakRate: row.on_peak_rate?.toString() || '5.7982',
            offPeakRate: row.off_peak_rate?.toString() || '2.6369',
            demandRate: row.demand_rate?.toString() || '210.0000',
            pfPenaltyRate: row.pf_penalty_rate?.toString() || '56.0700',
            pfThresholdFactor: row.pf_threshold_factor?.toString() || '0.6197',
            serviceCharge: row.service_charge?.toString() || '38.2200',
            ftRate: row.ft_rate?.toString() || '0.1623',
            vatPercent: row.vat_percent?.toString() || '7.00',
            isActive: row.is_active ?? true,
        });
        setFormError('');
        setTouModal(true);
    };

    const handleSaveTou = async () => {
        if (!touForm.effectiveDate) {
            setFormError(t('กรุณาระบุวันที่มีผลบังคับใช้', 'Please specify the effective date'));
            return;
        }
        if (!touForm.onPeakRate || !touForm.offPeakRate || !touForm.demandRate) {
            setFormError(t('กรุณาระบุอัตราค่าไฟให้ครบถ้วน', 'Please fill in all rate fields'));
            return;
        }
        setSaving(true);
        setFormError('');
        try {
            const payload = {
                effectiveDate: touForm.effectiveDate,
                onPeakRate: parseFloat(touForm.onPeakRate),
                offPeakRate: parseFloat(touForm.offPeakRate),
                demandRate: parseFloat(touForm.demandRate),
                pfPenaltyRate: parseFloat(touForm.pfPenaltyRate),
                pfThresholdFactor: parseFloat(touForm.pfThresholdFactor),
                serviceCharge: parseFloat(touForm.serviceCharge),
                ftRate: parseFloat(touForm.ftRate),
                vatPercent: parseFloat(touForm.vatPercent),
                isActive: touForm.isActive,
            };
            if (touEditId) {
                await billingApi.updateTouConfig(touEditId, payload);
                setSuccessMsg(t('อัปเดตอัตราค่าไฟฟ้า TOU สำเร็จ!', 'Updated TOU electricity tariff successfully!'));
            } else {
                await billingApi.createTouConfig(payload);
                setSuccessMsg(t('สร้างอัตราค่าไฟฟ้า TOU สำเร็จ!', 'Created TOU electricity tariff successfully!'));
            }
            setTouModal(false);
            fetchTou();
        } catch (err: any) {
            setFormError(err.response?.data?.message || t('บันทึกไม่สำเร็จ', 'Save failed'));
        }
        setSaving(false);
    };

    // Delete Handlers
    const handleDeleteClick = (row: any, type: 'general' | 'tou') => {
        setDeleteTarget(row);
        setDeleteType(type);
        setShowDelete(true);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            if (deleteType === 'general') {
                await billingApi.deleteConfig(deleteTarget.id);
                setSuccessMsg(t('ลบอัตราค่าไฟฟ้าทั่วไปสำเร็จ!', 'Deleted general rate successfully!'));
                fetchGeneral();
            } else {
                await billingApi.deleteTouConfig(deleteTarget.id);
                setSuccessMsg(t('ลบอัตราค่าไฟฟ้า TOU สำเร็จ!', 'Deleted TOU tariff successfully!'));
                fetchTou();
            }
            setShowDelete(false);
            setDeleteTarget(null);
        } catch (err: any) {
            alert(err.response?.data?.message || t('ลบไม่สำเร็จ', 'Delete failed'));
        }
        setDeleting(false);
    };

    // Columns
    const generalColumns = [
        {
            key: 'effective_date',
            title: t('วันที่มีผลบังคับใช้', 'Effective Date'),
            render: (v: string) => v ? new Date(v).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—',
        },
        {
            key: 'rate_mode',
            title: t('รูปแบบอัตรา', 'Rate Mode'),
            render: (v: string) => (
                <span className={`badge ${v === 'flat' ? 'badge-info' : 'badge-primary'}`}>
                    {v === 'flat' ? t('อัตราคงที่ (Flat)', 'Flat Rate') : t('ขั้นบันได (Tiered)', 'Tiered Rate')}
                </span>
            ),
        },
        {
            key: 'tier1_rate',
            title: t('ขั้นที่ 1 (1-200 หน่วย)', 'Tier 1 (1-200 kWh)'),
            render: (v: number, r: any) => r.rate_mode === 'flat' ? '—' : <span style={{ fontFamily: MONO, fontWeight: 600 }}>฿{Number(v || 3).toFixed(2)}</span>,
        },
        {
            key: 'tier2_rate',
            title: t('ขั้นที่ 2 (201+ หน่วย)', 'Tier 2 (201+ kWh)'),
            render: (v: number, r: any) => r.rate_mode === 'flat' ? '—' : <span style={{ fontFamily: MONO, fontWeight: 600, color: '#f59e0b' }}>฿{Number(v || 4.22).toFixed(2)}</span>,
        },
        {
            key: 'unit_price',
            title: t('ราคาคงที่ (Flat ฿/kWh)', 'Flat Rate (฿/kWh)'),
            render: (v: number, r: any) => r.rate_mode === 'flat' ? <strong style={{ fontFamily: MONO }}>฿{Number(v).toFixed(2)}</strong> : '—',
        },
        {
            key: 'service_charge',
            title: t('ค่าบริการ (฿)', 'Service (฿)'),
            render: (v: number) => <span style={{ fontFamily: MONO }}>฿{Number(v || 24.62).toFixed(2)}</span>,
        },
        {
            key: 'ft_rate',
            title: t('ค่า Ft (฿/kWh)', 'Ft (฿/kWh)'),
            render: (v: number) => <span style={{ fontFamily: MONO }}>฿{Number(v || 0.16).toFixed(2)}</span>,
        },
        {
            key: 'is_active',
            title: t('สถานะ', 'Status'),
            render: (v: boolean) => (
                <span className={`badge ${v ? 'badge-success' : 'badge-danger'}`}>
                    {v ? t('ใช้งาน', 'Active') : t('ปิดใช้งาน', 'Inactive')}
                </span>
            ),
        },
        {
            key: 'actions',
            title: t('การจัดการ', 'Actions'),
            render: (_: any, row: any) => (
                <div className="table-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => handleEditGeneral(row)}>{t('✏️ แก้ไข', '✏️ Edit')}</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteClick(row, 'general')}>{t('🗑️ ลบ', '🗑️ Delete')}</button>
                </div>
            ),
        },
    ];

    const touColumns = [
        {
            key: 'effective_date',
            title: t('วันที่มีผลบังคับใช้', 'Effective Date'),
            render: (v: string) => v ? new Date(v).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—',
        },
        {
            key: 'on_peak_rate',
            title: t('On-Peak (฿/kWh)', 'On-Peak (฿/kWh)'),
            render: (v: number) => <span style={{ fontFamily: MONO, color: '#f59e0b', fontWeight: 600 }}>฿{Number(v || 0).toFixed(2)}</span>,
        },
        {
            key: 'off_peak_rate',
            title: t('Off-Peak (฿/kWh)', 'Off-Peak (฿/kWh)'),
            render: (v: number) => <span style={{ fontFamily: MONO, color: '#10b981', fontWeight: 600 }}>฿{Number(v || 0).toFixed(2)}</span>,
        },
        {
            key: 'demand_rate',
            title: t('Peak Demand (฿/kW)', 'Peak Demand (฿/kW)'),
            render: (v: number) => <span style={{ fontFamily: MONO, color: '#ef4444', fontWeight: 600 }}>฿{Number(v || 0).toFixed(2)}</span>,
        },
        {
            key: 'pf_penalty_rate',
            title: t('ค่าปรับ PF (฿/kVAR)', 'PF Penalty (฿/kVAR)'),
            render: (v: number) => <span style={{ fontFamily: MONO }}>฿{Number(v || 0).toFixed(2)}</span>,
        },
        {
            key: 'service_charge',
            title: t('ค่าบริการ (฿)', 'Service (฿)'),
            render: (v: number) => <span style={{ fontFamily: MONO }}>฿{Number(v || 0).toFixed(2)}</span>,
        },
        {
            key: 'ft_rate',
            title: t('ค่า Ft (฿/kWh)', 'Ft Rate (฿/kWh)'),
            render: (v: number) => <span style={{ fontFamily: MONO }}>฿{Number(v || 0).toFixed(2)}</span>,
        },
        {
            key: 'vat_percent',
            title: t('VAT (%)', 'VAT (%)'),
            render: (v: number) => <span style={{ fontFamily: MONO }}>{Number(v || 7).toFixed(2)}%</span>,
        },
        {
            key: 'is_active',
            title: t('สถานะ', 'Status'),
            render: (v: boolean) => (
                <span className={`badge ${v ? 'badge-success' : 'badge-danger'}`}>
                    {v ? t('ใช้งาน', 'Active') : t('ปิดใช้งาน', 'Inactive')}
                </span>
            ),
        },
        {
            key: 'actions',
            title: t('การจัดการ', 'Actions'),
            render: (_: any, row: any) => (
                <div className="table-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => handleEditTou(row)}>{t('✏️ แก้ไข', '✏️ Edit')}</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteClick(row, 'tou')}>{t('🗑️ ลบ', '🗑️ Delete')}</button>
                </div>
            ),
        },
    ];

    return (
        <div>
            {/* Command Header */}
            <div style={{
                background: theme === 'dark' ? '#161B22' : '#FBFAF4',
                border: `1px solid ${theme === 'dark' ? '#2A313C' : '#D4D1C0'}`,
                borderLeft: '4px solid #2563eb',
                padding: '14px 20px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: 8,
                        background: 'rgba(37, 99, 235, 0.12)',
                        color: '#2563eb',
                        display: 'grid',
                        placeItems: 'center',
                    }}>
                        <Coins size={20} />
                    </div>
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 14, letterSpacing: 1.5 }}>
                            SETTINGS // ELECTRICITY TARIFFS
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {t('ตั้งค่าอัตราค่าไฟฟ้าสำหรับการคำนวณบิล (TOU Tariff สำหรับ MDB และอัตราปกติ/ขั้นบันไดสำหรับผู้เช่า)', 'Configure electricity rate tariffs for billing (TOU Tariff for MDB and General/Tiered Tariff for Tenants)')}
                        </div>
                    </div>
                </div>
            </div>

            {successMsg && <div className="toast-success" style={{ marginBottom: 16 }}>✅ {successMsg}</div>}

            {/* Tariff Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '2px solid var(--border)' }}>
                <button
                    onClick={() => setActiveTab('tou')}
                    style={{
                        padding: '10px 20px',
                        fontWeight: 700,
                        fontSize: 13,
                        border: 'none',
                        background: activeTab === 'tou' ? 'var(--card-bg)' : 'transparent',
                        color: activeTab === 'tou' ? '#2563eb' : 'var(--text-muted)',
                        borderBottom: activeTab === 'tou' ? '3px solid #2563eb' : '3px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        transition: 'all 0.2s',
                        borderRadius: '6px 6px 0 0',
                    }}
                >
                    <Clock size={16} />
                    {t('อัตราค่าไฟฟ้า TOU (Time of Use - มิเตอร์ MDB)', 'TOU Tariff (Time of Use - MDB Meters)')}
                </button>
                <button
                    onClick={() => setActiveTab('general')}
                    style={{
                        padding: '10px 20px',
                        fontWeight: 700,
                        fontSize: 13,
                        border: 'none',
                        background: activeTab === 'general' ? 'var(--card-bg)' : 'transparent',
                        color: activeTab === 'general' ? '#2563eb' : 'var(--text-muted)',
                        borderBottom: activeTab === 'general' ? '3px solid #2563eb' : '3px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        transition: 'all 0.2s',
                        borderRadius: '6px 6px 0 0',
                    }}
                >
                    <Zap size={16} />
                    {t('อัตราค่าไฟฟ้าทั่วไป (ประเภท 1.2 / ขั้นบันได / Flat Rate)', 'General Tariff (Type 1.2 / Tiered / Flat)')}
                </button>
            </div>

            {/* Tab 1: TOU Tariff */}
            {activeTab === 'tou' && (
                <div>
                    {/* Info Card */}
                    <div style={{
                        background: theme === 'dark' ? 'rgba(37,99,235,0.08)' : '#EFF6FF',
                        border: '1px solid rgba(37,99,235,0.2)',
                        padding: '12px 18px',
                        borderRadius: 6,
                        marginBottom: 16,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        fontSize: 12,
                        color: theme === 'dark' ? '#93C5FD' : '#1E40AF',
                    }}>
                        <Info size={18} style={{ flexShrink: 0 }} />
                        <div>
                            <strong>{t('เงื่อนไขช่วงเวลา TOU:', 'TOU Time Schedule:')}</strong>{' '}
                            {t('On-Peak = 09:00 - 22:00 น. (จันทร์ - ศุกร์) | Off-Peak = 22:00 - 09:00 น. (จันทร์ - ศุกร์ + เสาร์-อาทิตย์ + วันหยุดราชการ) | Peak Demand = ค่า kW สูงสุดใน 15 นาทีช่วง On-Peak | ค่าปรับ PF เมื่อ kVAR เกิน 0.6197 ของ On-Peak kWh',
                                'On-Peak = 09:00 - 22:00 (Mon-Fri) | Off-Peak = 22:00 - 09:00 (Mon-Fri + Weekends + Holidays) | Peak Demand = Max 15-min kW during On-Peak | PF Penalty applies when kVAR exceeds 0.6197 of On-Peak kWh')}
                        </div>
                    </div>

                    <DataTable
                        title={t('ตารางอัตราค่าไฟฟ้า TOU', 'TOU Electricity Tariff Schedule')}
                        columns={touColumns}
                        data={touData}
                        total={touTotal}
                        page={touPage}
                        limit={touLimit}
                        loading={touLoading}
                        onPageChange={setTouPage}
                        onLimitChange={(l) => { setTouLimit(l); setTouPage(1); }}
                        onCreate={handleCreateTou}
                        createLabel={t('เพิ่มอัตรา TOU', 'Add TOU Tariff')}
                    />
                </div>
            )}

            {/* Tab 2: General Tariff */}
            {activeTab === 'general' && (
                <div>
                    <div style={{
                        background: theme === 'dark' ? 'rgba(37,99,235,0.08)' : '#EFF6FF',
                        border: '1px solid rgba(37,99,235,0.2)',
                        padding: '12px 18px',
                        borderRadius: 6,
                        marginBottom: 16,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        fontSize: 12,
                        color: theme === 'dark' ? '#93C5FD' : '#1E40AF',
                    }}>
                        <Info size={18} style={{ flexShrink: 0 }} />
                        <div>
                            <strong>{t('อัตราประเภท 1.2 (อัตราก้าวหน้า / ขั้นบันได):', 'Type 1.2 Tariff (Stepped/Tiered):')}</strong>{' '}
                            {t('ขั้นที่ 1 = 1 ถึง 200 หน่วยแรก (เช่น 3.00 ฿) | ขั้นที่ 2 = 201 หน่วยขึ้นไป (เช่น 4.22 ฿) | บวกค่าบริการรายเดือน (24.62 ฿) และค่า Ft (0.1623 ฿) + VAT 7%',
                                'Tier 1 = First 1 to 200 units (e.g. 3.00 ฿) | Tier 2 = 201+ units (e.g. 4.22 ฿) | Plus Monthly Service Charge (24.62 ฿) and Ft (0.1623 ฿) + VAT 7%')}
                        </div>
                    </div>

                    <DataTable
                        title={t('ตารางอัตราค่าไฟฟ้าทั่วไป (ประเภท 1.2 / Flat Rate)', 'General Electricity Tariff (Type 1.2 / Flat Rate)')}
                        columns={generalColumns}
                        data={generalData}
                        total={generalTotal}
                        page={generalPage}
                        limit={generalLimit}
                        loading={generalLoading}
                        onPageChange={setGeneralPage}
                        onLimitChange={(l) => { setGeneralLimit(l); setGeneralPage(1); }}
                        onCreate={handleCreateGeneral}
                        createLabel={t('เพิ่มอัตราทั่วไป', 'Add General Rate')}
                    />
                </div>
            )}

            {/* Modal: TOU Tariff Form */}
            <Modal
                isOpen={touModal}
                onClose={() => setTouModal(false)}
                title={touEditId ? t('แก้ไขอัตราค่าไฟฟ้า TOU', 'Edit TOU Tariff') : t('เพิ่มอัตราค่าไฟฟ้า TOU', 'Add TOU Tariff')}
                size="lg"
                footer={
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline" onClick={() => setTouModal(false)} disabled={saving}>{t('ยกเลิก', 'Cancel')}</button>
                        <button className="btn btn-primary" onClick={handleSaveTou} disabled={saving}>
                            {saving ? t('กำลังบันทึก...', 'Saving...') : touEditId ? t('อัปเดต', 'Update') : t('สร้าง', 'Create')}
                        </button>
                    </div>
                }
            >
                {formError && <div className="form-error-banner" style={{ marginBottom: 16 }}>{formError}</div>}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                    <div className="form-group">
                        <label className="form-label">{t('วันที่มีผลบังคับใช้', 'Effective Date')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input type="date" className="form-control" value={touForm.effectiveDate} onChange={e => setTouForm({ ...touForm, effectiveDate: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('อัตรา On-Peak (฿/kWh)', 'On-Peak Rate (฿/kWh)')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input type="number" step="0.0001" className="form-control" placeholder="5.7982" value={touForm.onPeakRate} onChange={e => setTouForm({ ...touForm, onPeakRate: e.target.value })} />
                        <small style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('09.00 - 22.00 น. จันทร์-ศุกร์', '09:00 - 22:00 Mon-Fri')}</small>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('อัตรา Off-Peak (฿/kWh)', 'Off-Peak Rate (฿/kWh)')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input type="number" step="0.0001" className="form-control" placeholder="2.6369" value={touForm.offPeakRate} onChange={e => setTouForm({ ...touForm, offPeakRate: e.target.value })} />
                        <small style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('22.00 - 09.00 น. + ส.-อา. + วันหยุด', '22:00 - 09:00 + Weekends + Holidays')}</small>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('อัตรา Peak Demand (฿/kW)', 'Peak Demand Rate (฿/kW)')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input type="number" step="0.01" className="form-control" placeholder="210.00" value={touForm.demandRate} onChange={e => setTouForm({ ...touForm, demandRate: e.target.value })} />
                        <small style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('kW สูงสุดใน 15 นาทีช่วง On-Peak', 'Max 15-min kW during On-Peak')}</small>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('อัตราค่าปรับ PF (฿/kVAR)', 'PF Penalty Rate (฿/kVAR)')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input type="number" step="0.01" className="form-control" placeholder="56.07" value={touForm.pfPenaltyRate} onChange={e => setTouForm({ ...touForm, pfPenaltyRate: e.target.value })} />
                        <small style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('ปรับ kVAR ส่วนเกิน (PF ต่ำกว่า 0.85)', 'Excess kVAR surcharge (PF < 0.85)')}</small>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('ตัวคูณเกณฑ์ kVAR (PF Factor)', 'kVAR Threshold Factor')}</label>
                        <input type="number" step="0.0001" className="form-control" placeholder="0.6197" value={touForm.pfThresholdFactor} onChange={e => setTouForm({ ...touForm, pfThresholdFactor: e.target.value })} />
                        <small style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('มาตรฐานการไฟฟ้า: 0.6197', 'Standard: 0.6197')}</small>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('ค่าบริการรายเดือน (฿)', 'Monthly Service Charge (฿)')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input type="number" step="0.01" className="form-control" placeholder="38.22" value={touForm.serviceCharge} onChange={e => setTouForm({ ...touForm, serviceCharge: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('ค่าไฟฟ้าผันแปร Ft (฿/kWh)', 'Fuel Adjustment Ft (฿/kWh)')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input type="number" step="0.0001" className="form-control" placeholder="0.1623" value={touForm.ftRate} onChange={e => setTouForm({ ...touForm, ftRate: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('ภาษีมูลค่าเพิ่ม VAT (%)', 'VAT (%)')}</label>
                        <input type="number" step="0.01" className="form-control" placeholder="7.00" value={touForm.vatPercent} onChange={e => setTouForm({ ...touForm, vatPercent: e.target.value })} />
                    </div>
                </div>

                <div className="form-group" style={{ marginTop: 14 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="checkbox" checked={touForm.isActive} onChange={e => setTouForm({ ...touForm, isActive: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--success)' }} />
                        {t('เปิดใช้งาน (Active)', 'Active')}
                    </label>
                </div>
            </Modal>

            {/* Modal: General Form */}
            <Modal
                isOpen={generalModal}
                onClose={() => setGeneralModal(false)}
                title={generalEditId ? t('แก้ไขอัตราค่าไฟฟ้าทั่วไป (ประเภท 1.2)', 'Edit General Tariff (Type 1.2)') : t('เพิ่มอัตราค่าไฟฟ้าทั่วไป (ประเภท 1.2)', 'Add General Tariff (Type 1.2)')}
                size="lg"
                footer={
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline" onClick={() => setGeneralModal(false)} disabled={saving}>{t('ยกเลิก', 'Cancel')}</button>
                        <button className="btn btn-primary" onClick={handleSaveGeneral} disabled={saving}>
                            {saving ? t('กำลังบันทึก...', 'Saving...') : generalEditId ? t('อัปเดต', 'Update') : t('สร้าง', 'Create')}
                        </button>
                    </div>
                }
            >
                {formError && <div className="form-error-banner" style={{ marginBottom: 16 }}>{formError}</div>}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                    <div className="form-group">
                        <label className="form-label">{t('วันที่มีผลบังคับใช้', 'Effective Date')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input type="date" className="form-control" value={generalForm.effectiveDate} onChange={e => setGeneralForm({ ...generalForm, effectiveDate: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('รูปแบบการคิดราคา', 'Rate Calculation Mode')}</label>
                        <select className="form-control" value={generalForm.rateMode} onChange={e => setGeneralForm({ ...generalForm, rateMode: e.target.value as any })}>
                            <option value="tiered">{t('อัตราขั้นบันไดก้าวหน้า (Tiered Rate)', 'Tiered Rate (Step Rate)')}</option>
                            <option value="flat">{t('อัตราคงที่ต่อหน่วย (Flat Rate)', 'Flat Rate')}</option>
                        </select>
                    </div>

                    {generalForm.rateMode === 'tiered' ? (
                        <>
                            <div className="form-group">
                                <label className="form-label">{t('เกณฑ์ขั้นที่ 1 (หน่วยแรก)', 'Tier 1 Limit (Units)')}</label>
                                <input type="number" className="form-control" placeholder="200" value={generalForm.tier1Limit} onChange={e => setGeneralForm({ ...generalForm, tier1Limit: e.target.value })} />
                                <small style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('เช่น 200 หน่วยแรก (1-200)', 'e.g. First 200 units (1-200)')}</small>
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('ราคาขั้นที่ 1 (฿/หน่วย)', 'Tier 1 Rate (฿/kWh)')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                <input type="number" step="0.0001" className="form-control" placeholder="3.0000" value={generalForm.tier1Rate} onChange={e => setGeneralForm({ ...generalForm, tier1Rate: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('ราคาขั้นที่ 2 (201+ ฿/หน่วย)', 'Tier 2 Rate (201+ ฿/kWh)')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                <input type="number" step="0.0001" className="form-control" placeholder="4.2200" value={generalForm.tier2Rate} onChange={e => setGeneralForm({ ...generalForm, tier2Rate: e.target.value })} />
                            </div>
                        </>
                    ) : (
                        <div className="form-group">
                            <label className="form-label">{t('ราคาต่อหน่วยคงที่ (฿/kWh)', 'Flat Rate Price (฿/kWh)')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <input type="number" step="0.0001" className="form-control" placeholder="4.1500" value={generalForm.unitPrice} onChange={e => setGeneralForm({ ...generalForm, unitPrice: e.target.value })} />
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">{t('ค่าบริการรายเดือน (฿)', 'Monthly Service Charge (฿)')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input type="number" step="0.01" className="form-control" placeholder="24.62" value={generalForm.serviceCharge} onChange={e => setGeneralForm({ ...generalForm, serviceCharge: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('ค่าไฟฟ้าผันแปร Ft (฿/kWh)', 'Fuel Adjustment Ft (฿/kWh)')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input type="number" step="0.0001" className="form-control" placeholder="0.1623" value={generalForm.ftRate} onChange={e => setGeneralForm({ ...generalForm, ftRate: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('ภาษีมูลค่าเพิ่ม VAT (%)', 'VAT (%)')}</label>
                        <input type="number" step="0.01" className="form-control" placeholder="7.00" value={generalForm.vatPercent} onChange={e => setGeneralForm({ ...generalForm, vatPercent: e.target.value })} />
                    </div>
                </div>

                <div className="form-group" style={{ marginTop: 14 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="checkbox" checked={generalForm.isActive} onChange={e => setGeneralForm({ ...generalForm, isActive: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--success)' }} />
                        {t('เปิดใช้งาน (Active)', 'Active')}
                    </label>
                </div>
            </Modal>

            {/* Modal: Delete Confirmation */}
            <Modal
                isOpen={showDelete}
                onClose={() => setShowDelete(false)}
                title={t('ยืนยันการลบ', 'Confirm Delete')}
                size="sm"
                footer={
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline" onClick={() => setShowDelete(false)} disabled={deleting}>{t('ยกเลิก', 'Cancel')}</button>
                        <button className="btn btn-danger" onClick={handleDeleteConfirm} disabled={deleting}>
                            {deleting ? t('กำลังลบ...', 'Deleting...') : t('ลบ', 'Delete')}
                        </button>
                    </div>
                }
            >
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                    <p style={{ fontSize: 16, marginBottom: 8 }}>
                        {deleteType === 'general' ? t('ต้องการลบอัตราค่าไฟฟ้าทั่วไป', 'Delete general electricity rate') : t('ต้องการลบอัตราค่าไฟฟ้า TOU', 'Delete TOU electricity tariff')}
                    </p>
                    <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--danger)' }}>
                        {deleteTarget?.effective_date ? new Date(deleteTarget.effective_date).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US') : ''}
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default BillingPage;
