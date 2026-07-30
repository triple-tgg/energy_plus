import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { alarmsApi, metersApi } from '../../api/client';
import { useLanguage } from '../../contexts/LanguageContext';

interface ConfigForm {
    alarmType: 'threshold' | 'offline';
    meterId: string;
    energyValueId: string;
    lowerValue: string;
    higherValue: string;
    lowerMessage: string;
    higherMessage: string;
    offlineTimeoutSec: string;
    cooldownMinutes: string;
    alarmGroupId: string;
    isActive: boolean;
    isLampOn: boolean;
    isBuzzerOn: boolean;
    lampAddress: string;
    buzzerAddress: string;
}

const emptyForm: ConfigForm = {
    alarmType: 'threshold', meterId: '', energyValueId: '', lowerValue: '', higherValue: '',
    lowerMessage: '', higherMessage: '', offlineTimeoutSec: '60', cooldownMinutes: '5',
    alarmGroupId: '', isActive: true,
    isLampOn: false, isBuzzerOn: false, lampAddress: '', buzzerAddress: '',
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

    const handleCreate = () => { setEditId(null); setForm(emptyForm); setFormError(''); setShowModal(true); };

    const handleEdit = (row: any) => {
        setEditId(row.alarm_config_id);
        setForm({
            alarmType: row.alarm_type || 'threshold',
            meterId: row.meter_id?.toString() || '',
            energyValueId: row.energy_value_id?.toString() || '',
            lowerValue: row.lower_value?.toString() || '',
            higherValue: row.higher_value?.toString() || '',
            lowerMessage: row.lower_message || '',
            higherMessage: row.higher_message || '',
            offlineTimeoutSec: row.offline_timeout_sec?.toString() || '60',
            cooldownMinutes: row.cooldown_minutes?.toString() || '5',
            alarmGroupId: row.alarm_group_id?.toString() || '',
            isActive: row.is_active ?? true,
            isLampOn: row.is_lamp_on ?? false,
            isBuzzerOn: row.is_buzzer_on ?? false,
            lampAddress: row.lamp_address?.toString() || '',
            buzzerAddress: row.buzzer_address?.toString() || '',
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
                lampAddress: form.lampAddress ? parseInt(form.lampAddress) : null,
                buzzerAddress: form.buzzerAddress ? parseInt(form.buzzerAddress) : null,
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

    const columns = [
        {
            key: 'alarm_type', title: t('ประเภท', 'Type'),
            render: (v: string) => (
                <span style={{
                    padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                    background: v === 'offline' ? '#EF444420' : '#3B82F620',
                    color: v === 'offline' ? '#EF4444' : '#3B82F6',
                }}>
                    {v === 'offline' ? t('🔴 ขาดการติดต่อ', '🔴 Offline') : t('📊 เกณฑ์', '📊 Threshold')}
                </span>
            ),
        },
        {
            key: 'meter_name', title: t('มิเตอร์', 'Meter'),
            render: (v: string, row: any) => <span>{row.meter_code} — {v}</span>,
        },
        {
            key: 'energy_value_name', title: t('พารามิเตอร์', 'Parameter'),
            render: (v: string, row: any) => row.alarm_type === 'offline'
                ? <span style={{ color: '#888' }}>—</span>
                : v || '—',
        },
        {
            key: 'lower_value', title: t('ขั้นต่ำ', 'Min'),
            render: (v: any, row: any) => row.alarm_type === 'offline'
                ? <span style={{ color: '#888' }}>—</span>
                : v ?? '—',
        },
        {
            key: 'higher_value', title: t('ขั้นสูง', 'Max'),
            render: (v: any, row: any) => row.alarm_type === 'offline'
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
                                { value: 'offline' as const, emoji: '🔴', labelTh: 'ขาดการติดต่อ', labelEn: 'Offline Detection' },
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
                        <select className="form-control" value={form.meterId} onChange={e => setForm({ ...form, meterId: e.target.value })}>
                            <option value="">{t('— เลือกมิเตอร์ —', '— Select Meter —')}</option>
                            {meters.map(m => <option key={m.meter_id} value={m.meter_id}>{m.meter_code} — {m.meter_name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('กลุ่มแจ้งเตือน (Telegram)', 'Alarm Group (Telegram)')}</label>
                        <select className="form-control" value={form.alarmGroupId} onChange={e => setForm({ ...form, alarmGroupId: e.target.value })}>
                            <option value="">{t('— เลือกกลุ่ม —', '— Select Group —')}</option>
                            {groups.map(g => <option key={g.alarm_group_id} value={g.alarm_group_id}>{g.group_name}</option>)}
                        </select>
                    </div>
                </div>

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
                                <label className="form-label">{t('ข้อความเตือนขั้นต่ำ', 'Lower Alert Message')}</label>
                                <input type="text" className="form-control" placeholder={t('ข้อความเมื่อต่ำกว่าเกณฑ์', 'Message when below limit')} value={form.lowerMessage} onChange={e => setForm({ ...form, lowerMessage: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('ข้อความเตือนขั้นสูง', 'Higher Alert Message')}</label>
                                <input type="text" className="form-control" placeholder={t('ข้อความเมื่อสูงกว่าเกณฑ์', 'Message when above limit')} value={form.higherMessage} onChange={e => setForm({ ...form, higherMessage: e.target.value })} />
                            </div>
                        </div>
                    </>
                )}

                {/* Offline-specific fields */}
                {form.alarmType === 'offline' && (
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
                                <input type="text" className="form-control" placeholder={t('เช่น กรุณาติดต่อช่างไฟอาคาร A โทร 081-xxx-xxxx', 'e.g. Please contact electrician ext 1234')} value={form.lowerMessage} onChange={e => setForm({ ...form, lowerMessage: e.target.value, higherMessage: e.target.value })} />
                                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{t('ข้อความนี้จะถูกแนบไปกับ Telegram และ Alarm Log เมื่อมีการแจ้งเตือน', 'This note will be attached to Telegram and Alarm Log messages')}</div>
                            </div>
                        </div>
                    </>
                )}

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

                <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('อุปกรณ์แจ้งเตือน', 'Warning Devices')}</div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <input type="checkbox" checked={form.isLampOn} onChange={e => setForm({ ...form, isLampOn: e.target.checked })} style={{ width: 18, height: 18 }} />
                            {t('💡 เปิดใช้งานไฟเตือน', '💡 Enable Warning Lamp')}
                        </label>
                    </div>
                    <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <input type="checkbox" checked={form.isBuzzerOn} onChange={e => setForm({ ...form, isBuzzerOn: e.target.checked })} style={{ width: 18, height: 18 }} />
                            {t('🔔 เปิดใช้งานไซเรนเตือน', '🔔 Enable Warning Buzzer')}
                        </label>
                    </div>
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
        </div>
    );
};

export default AlarmConfigsPage;
