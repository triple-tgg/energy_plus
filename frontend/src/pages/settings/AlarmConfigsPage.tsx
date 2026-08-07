import React, { useEffect, useState, useCallback, useRef } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { alarmsApi, metersApi } from '../../api/client';
import { useLanguage } from '../../contexts/LanguageContext';
import * as XLSX from 'xlsx';

interface ConfigForm {
    alarmType: 'threshold' | 'disconnect';
    meterId: string;
    energyValueId: string;
    lowerValue: string;
    higherValue: string;
    lowerMessage: string;
    offlineTimeoutSec: string;
    cooldownMinutes: string;
    alarmGroupId: string;
    isActive: boolean;
    activeDays: number[];
    activeTimeStart: string;
    activeTimeEnd: string;
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DAY_LABELS_TH = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const DAY_LABELS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const emptyForm: ConfigForm = {
    alarmType: 'threshold', meterId: '', energyValueId: '', lowerValue: '', higherValue: '',
    lowerMessage: '', offlineTimeoutSec: '60', cooldownMinutes: '5',
    alarmGroupId: '', isActive: true,
    activeDays: [...ALL_DAYS], activeTimeStart: '', activeTimeEnd: '',
};

const AlarmConfigsPage: React.FC = () => {
    const { t } = useLanguage();
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(true);

    const [meters, setMeters] = useState<any[]>([]);
    const [energyValues, setEnergyValues] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);

    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<ConfigForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const [showDelete, setShowDelete] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [recentData, setRecentData] = useState<any[]>([]);
    const [recentLoading, setRecentLoading] = useState(false);
    const [showRecent, setShowRecent] = useState(false);
    const importInputRef = useRef<HTMLInputElement>(null);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<any>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await alarmsApi.getConfigs({ page, limit });
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [page, limit]);

    const fetchLookups = useCallback(async () => {
        try {
            const [mRes, evRes, gRes] = await Promise.all([
                metersApi.getAll({ limit: 200 }),
                metersApi.getEnergyValues(),
                alarmsApi.getGroups({ limit: 100 }),
            ]);
            setMeters(mRes.data.data || []);
            setEnergyValues(evRes.data.data || []);
            setGroups(gRes.data.data || []);
        } catch (err) { console.error(err); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { fetchLookups(); }, [fetchLookups]);
    useEffect(() => { if (successMsg) { const t = setTimeout(() => setSuccessMsg(''), 3000); return () => clearTimeout(t); } }, [successMsg]);

    const handleCreate = () => { setEditId(null); setForm(emptyForm); setFormError(''); setShowRecent(false); setRecentData([]); setShowModal(true); };

    const handleEdit = (row: any) => {
        setEditId(row.alarm_config_id);
        setShowRecent(false);
        setRecentData([]);
        const rawDays = row.active_days;
        const parsedDays = Array.isArray(rawDays) ? rawDays : (typeof rawDays === 'string' ? JSON.parse(rawDays) : [...ALL_DAYS]);
        setForm({
            alarmType: row.alarm_type || 'threshold',
            meterId: row.meter_id?.toString() || '',
            energyValueId: row.energy_value_id?.toString() || '',
            lowerValue: row.lower_value?.toString() || '',
            higherValue: row.higher_value?.toString() || '',
            lowerMessage: row.lower_message || '',
            offlineTimeoutSec: row.offline_timeout_sec?.toString() || '60',
            cooldownMinutes: row.cooldown_minutes?.toString() || '5',
            alarmGroupId: row.alarm_group_id?.toString() || '',
            isActive: row.is_active ?? true,
            activeDays: parsedDays,
            activeTimeStart: row.active_time_start || '',
            activeTimeEnd: row.active_time_end || '',
        });
        setFormError('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.meterId) { setFormError(t('กรุณาเลือกมิเตอร์', 'Please select a meter')); return; }
        if (form.alarmType === 'threshold' && !form.energyValueId) { setFormError(t('กรุณาเลือกพารามิเตอร์พลังงาน', 'Please select an energy parameter')); return; }
        setSaving(true); setFormError('');
        try {
            const payload = {
                ...form,
                meterId: parseInt(form.meterId),
                energyValueId: form.energyValueId ? parseInt(form.energyValueId) : null,
                lowerValue: form.lowerValue ? parseFloat(form.lowerValue) : null,
                higherValue: form.higherValue ? parseFloat(form.higherValue) : null,
                offlineTimeoutSec: parseInt(form.offlineTimeoutSec) || 60,
                cooldownMinutes: parseInt(form.cooldownMinutes) || 5,
                alarmGroupId: form.alarmGroupId ? parseInt(form.alarmGroupId) : null,
                activeDays: form.activeDays,
                activeTimeStart: form.activeTimeStart || null,
                activeTimeEnd: form.activeTimeEnd || null,
            };
            if (editId) {
                await alarmsApi.updateConfig(editId, payload);
                setSuccessMsg(t('อัปเดตการตั้งค่าการแจ้งเตือนสำเร็จ!', 'Updated alarm configuration successfully!'));
            } else {
                await alarmsApi.createConfig(payload);
                setSuccessMsg(t('สร้างการตั้งค่าการแจ้งเตือนสำเร็จ!', 'Created alarm configuration successfully!'));
            }
            setShowModal(false); fetchData();
        } catch (err: any) { setFormError(err.response?.data?.message || t('บันทึกไม่สำเร็จ', 'Save failed')); }
        setSaving(false);
    };

    const handleDeleteClick = (row: any) => { setDeleteTarget(row); setShowDelete(true); };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await alarmsApi.deleteConfig(deleteTarget.alarm_config_id);
            setSuccessMsg(t('ลบการตั้งค่าการแจ้งเตือนสำเร็จ!', 'Deleted alarm configuration successfully!'));
            setShowDelete(false); setDeleteTarget(null); fetchData();
        } catch (err: any) { alert(err.response?.data?.message || t('ลบไม่สำเร็จ', 'Delete failed')); }
        setDeleting(false);
    };

    const downloadTemplate = () => {
        const headers = [
            'meterCode', 'alarmType', 'energyValue', 'alarmGroup', 'lowerValue', 'higherValue',
            'message', 'offlineTimeoutSec', 'cooldownMinutes', 'activeDays',
            'activeTimeStart', 'activeTimeEnd', 'isActive',
        ];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers]), 'Alarm Configs');
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(meters.map(m => ({ meterCode: m.meter_code, meterName: m.meter_name }))), 'Meters');
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(energyValues.map(v => ({ energyValue: v.energy_value_name, id: v.energy_value_id }))), 'Energy Values');
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(groups.map(g => ({ alarmGroup: g.group_name, id: g.alarm_group_id }))), 'Alarm Groups');
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
            ['Field', 'Description'],
            ['alarmType', 'threshold or disconnect'],
            ['activeDays', '0=Sun, 1=Mon, ... 6=Sat; separate with commas'],
            ['activeTimeStart / activeTimeEnd', 'HH:mm; leave blank for 24 hours'],
            ['isActive', 'true or false'],
            ['threshold', 'Requires energyValue and at least lowerValue or higherValue'],
            ['disconnect', 'Uses offlineTimeoutSec; energyValue can be blank'],
        ]), 'Instructions');
        XLSX.writeFile(workbook, 'alarm_settings_import_template.xlsx');
    };

    const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        try {
            const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
            const sheet = workbook.Sheets['Alarm Configs'] || workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' })
                .filter(row => String(row.meterCode || '').trim());
            if (!rows.length) {
                alert(t('ไม่พบข้อมูลสำหรับนำเข้าใน Sheet "Alarm Configs"', 'No import rows found in the "Alarm Configs" sheet'));
                return;
            }
            if (!window.confirm(t(`ยืนยันนำเข้า Alarm Settings จำนวน ${rows.length} รายการ?`, `Import ${rows.length} alarm configurations?`))) return;
            setImporting(true);
            const response = await alarmsApi.importConfigs(rows);
            setImportResult(response.data.data);
            setPage(1);
            await fetchData();
        } catch (error: any) {
            alert(error.response?.data?.message || t('นำเข้า Alarm Settings ไม่สำเร็จ', 'Alarm settings import failed'));
        } finally { setImporting(false); }
    };

    const columns = [
        {
            key: 'alarm_type', title: t('ประเภท', 'Type'),
            render: (v: string) => (
                <span style={{
                    padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                    background: v === 'disconnect' ? '#EF444420' : '#3B82F620',
                    color: v === 'disconnect' ? '#EF4444' : '#3B82F6',
                }}>
                    {v === 'disconnect' ? t('🔴 ขาดการติดต่อ', '🔴 Disconnect') : t('📊 เกณฑ์', '📊 Threshold')}
                </span>
            ),
        },
        {
            key: 'meter_name', title: t('มิเตอร์', 'Meter'),
            render: (v: string, row: any) => <span>{row.meter_code} — {v}</span>,
        },
        {
            key: 'energy_value_name', title: t('พารามิเตอร์', 'Parameter'),
            render: (v: string, row: any) => row.alarm_type === 'disconnect'
                ? <span style={{ color: '#888' }}>—</span>
                : v || '—',
        },
        {
            key: 'lower_value', title: t('ขั้นต่ำ', 'Min'),
            render: (v: any, row: any) => row.alarm_type === 'disconnect'
                ? <span style={{ color: '#888' }}>—</span>
                : v ?? '—',
        },
        {
            key: 'higher_value', title: t('ขั้นสูง', 'Max'),
            render: (v: any, row: any) => row.alarm_type === 'disconnect'
                ? <span style={{ fontSize: 11 }}>{row.offline_timeout_sec || 60}s</span>
                : v ?? '—',
        },
        {
            key: 'cooldown_minutes', title: t('Cooldown', 'Cooldown'),
            render: (v: any) => <span style={{ fontSize: 11 }}>{v || 5} {t('นาที', 'min')}</span>,
        },
        {
            key: 'is_active', title: t('สถานะ', 'Status'),
            render: (v: boolean) => (
                <span className={`badge ${v ? 'badge-success' : 'badge-danger'}`}>
                    {v ? t('ใช้งาน', 'Active') : t('ปิดใช้งาน', 'Inactive')}
                </span>
            ),
        },
        {
            key: 'actions', title: t('การจัดการ', 'Actions'),
            render: (_: any, row: any) => (
                <div className="table-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => handleEdit(row)}>{t('✏️ แก้ไข', '✏️ Edit')}</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteClick(row)}>{t('🗑️ ลบ', '🗑️ Delete')}</button>
                </div>
            ),
        },
    ];

    return (
        <div>
            {successMsg && <div className="toast-success">✅ {successMsg}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={downloadTemplate}>
                    📄 {t('ดาวน์โหลด Template', 'Download Template')}
                </button>
                <button type="button" className="btn btn-success btn-sm" onClick={() => importInputRef.current?.click()} disabled={importing}>
                    {importing ? t('⏳ กำลังนำเข้า...', '⏳ Importing...') : t('📥 Import Template', '📥 Import Template')}
                </button>
                <input ref={importInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportFile} style={{ display: 'none' }} />
            </div>
            <DataTable title={t('ตั้งค่าการแจ้งเตือน', 'Alarm Settings')} columns={columns} data={data} total={total} page={page} limit={limit} loading={loading} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} onCreate={handleCreate} createLabel={t('เพิ่มการตั้งค่าการแจ้งเตือน', 'Add Alarm Configuration')} />

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? t('แก้ไขการตั้งค่าการแจ้งเตือน', 'Edit Alarm Configuration') : t('เพิ่มการตั้งค่าการแจ้งเตือน', 'Add Alarm Configuration')} size="lg"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>{t('ยกเลิก', 'Cancel')}</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('กำลังบันทึก...', 'Saving...') : editId ? t('อัปเดต', 'Update') : t('สร้าง', 'Create')}</button></div>}
            >
                {formError && <div className="form-error-banner">{formError}</div>}

                {/* Alarm Type */}
                <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 13, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('ประเภทการแจ้งเตือน', 'Alert Type')}</div>
                <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {([
                                { value: 'disconnect' as const, emoji: '🔴', labelTh: 'ขาดการติดต่อ', labelEn: 'Disconnect Detection' },
                                { value: 'threshold' as const, emoji: '📊', labelTh: 'เกินเกณฑ์', labelEn: 'Threshold' },
                            ]).map(opt => (
                                <button key={opt.value}
                                    onClick={() => setForm({ ...form, alarmType: opt.value })}
                                    style={{
                                        flex: 1, padding: '10px 14px', borderRadius: 6, cursor: 'pointer',
                                        border: form.alarmType === opt.value ? '2px solid var(--accent)' : '1px solid var(--border)',
                                        background: form.alarmType === opt.value ? 'var(--accent-bg, rgba(54,194,206,0.1))' : 'transparent',
                                        color: form.alarmType === opt.value ? 'var(--accent)' : 'var(--text-secondary)',
                                        fontWeight: form.alarmType === opt.value ? 700 : 400,
                                        fontSize: 13, textAlign: 'center',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    {opt.emoji} {t(opt.labelTh, opt.labelEn)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Meter Selection */}
                <div style={{ marginBottom: 8, marginTop: 8, fontWeight: 600, fontSize: 13, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('มิเตอร์', 'Meter')}</div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">{t('มิเตอร์', 'Meter')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <select className="form-control" value={form.meterId} onChange={e => { setForm({ ...form, meterId: e.target.value }); setShowRecent(false); setRecentData([]); }}>
                            <option value="">{t('— เลือกมิเตอร์ —', '— Select Meter —')}</option>
                            {meters.map(m => <option key={m.meter_id} value={m.meter_id}>{m.meter_code} — {m.meter_name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('กลุ่มแจ้งเตือน (Telegram / Email)', 'Alarm Group (Telegram / Email)')}</label>
                        <select className="form-control" value={form.alarmGroupId} onChange={e => setForm({ ...form, alarmGroupId: e.target.value })}>
                            <option value="">{t('— เลือกกลุ่ม —', '— Select Group —')}</option>
                            {groups.map(g => <option key={g.alarm_group_id} value={g.alarm_group_id}>{g.group_name}</option>)}
                        </select>
                    </div>
                </div>

                {/* Recent Data Preview */}
                {form.meterId && (
                    <div style={{ marginBottom: 10 }}>
                        <button type="button" onClick={async () => {
                            if (showRecent) { setShowRecent(false); return; }
                            setRecentLoading(true); setShowRecent(true);
                            try {
                                const res = await alarmsApi.getRecentMeterData(parseInt(form.meterId));
                                setRecentData(res.data.data || []);
                            } catch { setRecentData([]); }
                            setRecentLoading(false);
                        }} style={{
                            padding: '6px 14px', borderRadius: 4, cursor: 'pointer',
                            border: '1px solid var(--accent)', background: 'var(--accent-bg, rgba(43,76,126,0.08))',
                            color: 'var(--accent)', fontWeight: 600, fontSize: 12, transition: 'all 0.15s',
                        }}>
                            {showRecent ? t('🔼 ซ่อนข้อมูล', '🔼 Hide Data') : t('📊 ดูข้อมูลล่าสุด', '📊 View Recent Data')}
                        </button>

                        {showRecent && (
                            <div style={{ marginTop: 8, padding: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2, rgba(127,127,127,0.05))', fontSize: 12, maxHeight: 220, overflowY: 'auto' }}>
                                {recentLoading ? (
                                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>⏳ {t('กำลังโหลด...', 'Loading...')}</div>
                                ) : recentData.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>⚠️ {t('ไม่มีข้อมูลสำหรับมิเตอร์นี้', 'No data found for this meter')}</div>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                                <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--text-secondary)' }}>{t('เวลา', 'Time')}</th>
                                                <th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--text-secondary)' }}>kW</th>
                                                <th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--text-secondary)' }}>kVA</th>
                                                <th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--text-secondary)' }}>V (P1)</th>
                                                <th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--text-secondary)' }}>A (P1)</th>
                                                <th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--text-secondary)' }}>PF1</th>
                                                <th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--text-secondary)' }}>Hz</th>
                                                <th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--text-secondary)' }}>kWh</th>
                                                <th style={{ textAlign: 'center', padding: '4px 6px', color: 'var(--text-secondary)' }}>{t('สถานะ', 'Status')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {recentData.map((row: any, i: number) => (
                                                <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                                    <td style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>{new Date(row.date_keep).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                                                    <td style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>{Number(row.energy_kw || 0).toFixed(2)}</td>
                                                    <td style={{ textAlign: 'right', padding: '4px 6px' }}>{Number(row.energy_kva || 0).toFixed(2)}</td>
                                                    <td style={{ textAlign: 'right', padding: '4px 6px' }}>{Number(row.energy_volt_p1 || 0).toFixed(1)}</td>
                                                    <td style={{ textAlign: 'right', padding: '4px 6px' }}>{Number(row.energy_amp1 || 0).toFixed(2)}</td>
                                                    <td style={{ textAlign: 'right', padding: '4px 6px' }}>{Number(row.energy_pf1 || 0).toFixed(3)}</td>
                                                    <td style={{ textAlign: 'right', padding: '4px 6px' }}>{Number(row.energy_frequency || 0).toFixed(1)}</td>
                                                    <td style={{ textAlign: 'right', padding: '4px 6px' }}>{Number(row.energy_kwh || 0).toFixed(2)}</td>
                                                    <td style={{ textAlign: 'center', padding: '4px 6px' }}>
                                                        <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600, background: row.status === 'online' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: row.status === 'online' ? '#10b981' : '#ef4444' }}>
                                                            {row.status || 'online'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Threshold-specific fields */}
                {form.alarmType === 'threshold' && (
                    <>
                        <div style={{ marginBottom: 8, marginTop: 8, fontWeight: 600, fontSize: 13, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('พารามิเตอร์และขีดจำกัด', 'Parameter and Limits')}</div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">{t('พารามิเตอร์พลังงาน', 'Energy Parameter')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                <select className="form-control" value={form.energyValueId} onChange={e => setForm({ ...form, energyValueId: e.target.value })}>
                                    <option value="">{t('— เลือก —', '— Select —')}</option>
                                    {energyValues.map(ev => <option key={ev.energy_value_id} value={ev.energy_value_id}>{ev.energy_value_name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">{t('ขั้นต่ำ (Lower)', 'Lower Limit')}</label>
                                <input type="number" className="form-control" placeholder="0" value={form.lowerValue} onChange={e => setForm({ ...form, lowerValue: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('ขั้นสูง (Higher)', 'Higher Limit')}</label>
                                <input type="number" className="form-control" placeholder="0" value={form.higherValue} onChange={e => setForm({ ...form, higherValue: e.target.value })} />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">{t('บันทึกข้อความเพิ่มเติม (Custom Note)', 'Custom Alert Note')}</label>
                                <input type="text" className="form-control" placeholder={t('เช่น ตรวจสอบระบบไฟฟ้าชั้น 3', 'e.g. Check electrical system floor 3')} value={form.lowerMessage} onChange={e => setForm({ ...form, lowerMessage: e.target.value })} />
                                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{t('ข้อความนี้จะถูกแนบไปกับ Telegram และ Alarm Log เมื่อมีการแจ้งเตือน', 'This note will be attached to Telegram and Alarm Log messages')}</div>
                            </div>
                        </div>
                    </>
                )}

                {/* Disconnect-specific fields */}
                {form.alarmType === 'disconnect' && (
                    <>
                        <div style={{ marginBottom: 8, marginTop: 8, fontWeight: 600, fontSize: 13, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('ตั้งค่าการตรวจจับและข้อความเพิ่มเติม', 'Detection & Custom Note')}</div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">{t('ระยะเวลา Timeout (วินาที)', 'Timeout (seconds)')}</label>
                                <input type="number" className="form-control" placeholder="60" value={form.offlineTimeoutSec} onChange={e => setForm({ ...form, offlineTimeoutSec: e.target.value })} />
                                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{t('หากไม่ได้รับข้อมูลเกินเวลานี้ จะส่งเตือน', 'Alert if no data received for this duration')}</div>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">{t('บันทึกข้อความเพิ่มเติม (Custom Note)', 'Custom Alert Note')}</label>
                                <input type="text" className="form-control" placeholder={t('เช่น กรุณาติดต่อช่างไฟอาคาร A โทร 081-xxx-xxxx', 'e.g. Please contact electrician ext 1234')} value={form.lowerMessage} onChange={e => setForm({ ...form, lowerMessage: e.target.value })} />
                                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{t('ข้อความนี้จะถูกแนบไปกับ Telegram และ Alarm Log เมื่อมีการแจ้งเตือน', 'This note will be attached to Telegram and Alarm Log messages')}</div>
                            </div>
                        </div>
                    </>
                )}

                {/* Schedule */}
                <div style={{ marginBottom: 8, marginTop: 8, fontWeight: 600, fontSize: 13, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('ตารางเวลาทำงาน', 'Active Schedule')}</div>
                <div className="form-row">
                    <div className="form-group" style={{ flex: 2 }}>
                        <label className="form-label">{t('วันที่แจ้งเตือน', 'Active Days')}</label>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {ALL_DAYS.map(d => {
                                const selected = form.activeDays.includes(d);
                                return (
                                    <button key={d} type="button"
                                        onClick={() => {
                                            const next = selected
                                                ? form.activeDays.filter(x => x !== d)
                                                : [...form.activeDays, d].sort();
                                            setForm({ ...form, activeDays: next });
                                        }}
                                        style={{
                                            width: 40, height: 36, borderRadius: 6, cursor: 'pointer',
                                            border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
                                            background: selected ? 'var(--accent-bg, rgba(54,194,206,0.15))' : 'transparent',
                                            color: selected ? 'var(--accent)' : 'var(--text-secondary)',
                                            fontWeight: selected ? 700 : 400,
                                            fontSize: 12, transition: 'all 0.15s',
                                        }}
                                    >
                                        {t(DAY_LABELS_TH[d], DAY_LABELS_EN[d])}
                                    </button>
                                );
                            })}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                            <button type="button" onClick={() => setForm({ ...form, activeDays: [...ALL_DAYS] })} style={{ fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                                {t('เลือกทุกวัน', 'All days')}
                            </button>
                            <button type="button" onClick={() => setForm({ ...form, activeDays: [1, 2, 3, 4, 5] })} style={{ fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                                {t('จันทร์–ศุกร์', 'Mon–Fri')}
                            </button>
                            <button type="button" onClick={() => setForm({ ...form, activeDays: [0, 6] })} style={{ fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                                {t('เสาร์–อาทิตย์', 'Sat–Sun')}
                            </button>
                        </div>
                        <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{t('เลือกวันที่ต้องการให้ระบบแจ้งเตือนทำงาน', 'Select which days the alarm should be active')}</div>
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">{t('เวลาเริ่ม', 'Start Time')}</label>
                        <input type="time" className="form-control" value={form.activeTimeStart} onChange={e => setForm({ ...form, activeTimeStart: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('เวลาสิ้นสุด', 'End Time')}</label>
                        <input type="time" className="form-control" value={form.activeTimeEnd} onChange={e => setForm({ ...form, activeTimeEnd: e.target.value })} />
                    </div>
                </div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>{t('หากไม่ระบุเวลา ระบบจะแจ้งเตือนตลอด 24 ชั่วโมง (เช่น 08:00–18:00 = เฉพาะเวลาทำงาน)', 'Leave empty for 24h alerting. e.g. 08:00–18:00 = business hours only')}</div>

                {/* Common fields */}
                <div style={{ marginBottom: 8, marginTop: 8, fontWeight: 600, fontSize: 13, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('ตั้งค่าทั่วไป', 'General Settings')}</div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">{t('Cooldown (นาที)', 'Cooldown (minutes)')}</label>
                        <input type="number" className="form-control" placeholder="5" value={form.cooldownMinutes} onChange={e => setForm({ ...form, cooldownMinutes: e.target.value })} />
                        <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{t('ป้องกันส่งซ้ำภายในเวลานี้', 'Prevent duplicate alerts within this period')}</div>
                    </div>
                </div>

                <div style={{ marginBottom: 8, marginTop: 8, fontWeight: 600, fontSize: 13, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('ช่องทางแจ้งเตือน', 'Notification Channels')}</div>
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--surface-2, rgba(127,127,127,0.08))', fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 10 }}>
                    ✈️ {t('Telegram — ส่งข้อความเข้ากลุ่มที่เลือก', 'Telegram — sends message to selected group')}<br/>
                    ✉️ {t('Email — ส่งไปยังอีเมลที่กำหนดในกลุ่มแจ้งเตือน', 'Email — sends to recipients configured in the alarm group')}<br/>
                    🔊 {t('เสียงเตือนบนเว็บ — เมื่อมี alert ใหม่จะดังเสียง beep (~0.8 วินาที)', 'Web sound — plays beep when new alert fires (~0.8s)')}
                    <button type="button" onClick={() => {
                        try {
                            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                            const playBeep = (freq: number, startTime: number, dur: number) => {
                                const osc = ctx.createOscillator();
                                const gain = ctx.createGain();
                                osc.type = 'square';
                                osc.frequency.value = freq;
                                gain.gain.setValueAtTime(0.15, startTime);
                                gain.gain.exponentialRampToValueAtTime(0.01, startTime + dur);
                                osc.connect(gain);
                                gain.connect(ctx.destination);
                                osc.start(startTime);
                                osc.stop(startTime + dur);
                            };
                            const now = ctx.currentTime;
                            playBeep(880, now, 0.15);
                            playBeep(880, now + 0.25, 0.15);
                            playBeep(1100, now + 0.5, 0.3);
                        } catch (e) { console.warn(e); }
                    }} style={{
                        marginLeft: 10, padding: '3px 10px', borderRadius: 5, border: '1px solid var(--border)',
                        background: 'transparent', cursor: 'pointer', fontSize: 11, color: 'var(--accent)',
                    }}>
                        🔊 {t('ทดสอบเสียง', 'Test Sound')}
                    </button>
                </div>


                <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--success)' }} />
                        {t('เปิดใช้งาน', 'Active')}
                    </label>
                </div>
            </Modal>

            <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title={t('ยืนยันการลบ', 'Confirm Delete')} size="sm"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowDelete(false)} disabled={deleting}>{t('ยกเลิก', 'Cancel')}</button><button className="btn btn-danger" onClick={handleDeleteConfirm} disabled={deleting}>{deleting ? t('กำลังลบ...', 'Deleting...') : t('ลบ', 'Delete')}</button></div>}
            >
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                    <p style={{ fontSize: 16, marginBottom: 8 }}>{t('ต้องการลบการตั้งค่าการแจ้งเตือนสำหรับ', 'Delete alarm configuration for')}</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>"{deleteTarget?.meter_name}"</p>
                </div>
            </Modal>

            <Modal isOpen={Boolean(importResult)} onClose={() => setImportResult(null)} title={t('ผลการนำเข้า Alarm Settings', 'Alarm Settings Import Result')} size="md"
                footer={<button className="btn btn-primary" onClick={() => setImportResult(null)}>{t('ปิด', 'Close')}</button>}
            >
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                    <div className="badge badge-success">{t('สำเร็จ', 'Imported')}: {importResult?.imported || 0}</div>
                    <div className="badge">{t('ข้าม', 'Skipped')}: {importResult?.skipped || 0}</div>
                    <div className="badge badge-danger">{t('ผิดพลาด', 'Errors')}: {importResult?.errors?.length || 0}</div>
                </div>
                {importResult?.errors?.length > 0 && (
                    <div style={{ maxHeight: 300, overflow: 'auto', border: '1px solid var(--border)' }}>
                        {importResult.errors.map((error: any, index: number) => (
                            <div key={index} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                                <strong>{t('แถว', 'Row')} {error.row}:</strong> {error.message}
                            </div>
                        ))}
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default AlarmConfigsPage;
