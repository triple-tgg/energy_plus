import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { alarmsApi, metersApi } from '../../api/client';

interface ConfigForm {
    meterId: string;
    energyValueId: string;
    lowerValue: string;
    higherValue: string;
    lowerMessage: string;
    higherMessage: string;
    isActive: boolean;
    isLampOn: boolean;
    isBuzzerOn: boolean;
    lampAddress: string;
    buzzerAddress: string;
}

const emptyForm: ConfigForm = {
    meterId: '', energyValueId: '', lowerValue: '', higherValue: '',
    lowerMessage: '', higherMessage: '', isActive: true,
    isLampOn: false, isBuzzerOn: false, lampAddress: '', buzzerAddress: '',
};

const AlarmConfigsPage: React.FC = () => {
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(true);

    const [meters, setMeters] = useState<any[]>([]);
    const [energyValues, setEnergyValues] = useState<any[]>([]);

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
            const [mRes, evRes] = await Promise.all([
                metersApi.getAll({ limit: 200 }),
                metersApi.getEnergyValues(),
            ]);
            setMeters(mRes.data.data || []);
            setEnergyValues(evRes.data.data || []);
        } catch (err) { console.error(err); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { fetchLookups(); }, [fetchLookups]);
    useEffect(() => { if (successMsg) { const t = setTimeout(() => setSuccessMsg(''), 3000); return () => clearTimeout(t); } }, [successMsg]);

    const handleCreate = () => { setEditId(null); setForm(emptyForm); setFormError(''); setShowModal(true); };

    const handleEdit = (row: any) => {
        setEditId(row.alarm_config_id);
        setForm({
            meterId: row.meter_id?.toString() || '',
            energyValueId: row.energy_value_id?.toString() || '',
            lowerValue: row.lower_value?.toString() || '',
            higherValue: row.higher_value?.toString() || '',
            lowerMessage: row.lower_message || '',
            higherMessage: row.higher_message || '',
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
        if (!form.meterId) { setFormError('กรุณาเลือกมิเตอร์'); return; }
        setSaving(true); setFormError('');
        try {
            const payload = {
                ...form,
                meterId: parseInt(form.meterId),
                energyValueId: form.energyValueId ? parseInt(form.energyValueId) : null,
                lowerValue: form.lowerValue ? parseFloat(form.lowerValue) : null,
                higherValue: form.higherValue ? parseFloat(form.higherValue) : null,
                lampAddress: form.lampAddress ? parseInt(form.lampAddress) : null,
                buzzerAddress: form.buzzerAddress ? parseInt(form.buzzerAddress) : null,
            };
            if (editId) {
                await alarmsApi.updateConfig(editId, payload);
                setSuccessMsg('อัพเดตการตั้งค่าแจ้งเตือนสำเร็จ!');
            } else {
                await alarmsApi.createConfig(payload);
                setSuccessMsg('สร้างการตั้งค่าแจ้งเตือนสำเร็จ!');
            }
            setShowModal(false); fetchData();
        } catch (err: any) { setFormError(err.response?.data?.message || 'บันทึกไม่สำเร็จ'); }
        setSaving(false);
    };

    const handleDeleteClick = (row: any) => { setDeleteTarget(row); setShowDelete(true); };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await alarmsApi.deleteConfig(deleteTarget.alarm_config_id);
            setSuccessMsg('ลบการตั้งค่าแจ้งเตือนสำเร็จ!');
            setShowDelete(false); setDeleteTarget(null); fetchData();
        } catch (err: any) { alert(err.response?.data?.message || 'ลบไม่สำเร็จ'); }
        setDeleting(false);
    };

    const columns = [
        {
            key: 'meter_name', title: 'มิเตอร์',
            render: (v: string, row: any) => <span>{row.meter_code} — {v}</span>,
        },
        { key: 'energy_value_name', title: 'ค่าพลังงาน' },
        { key: 'lower_value', title: 'ค่าต่ำสุด' },
        { key: 'higher_value', title: 'ค่าสูงสุด' },
        {
            key: 'is_active', title: 'สถานะ',
            render: (v: boolean) => <span className={`badge ${v ? 'badge-success' : 'badge-danger'}`}>{v ? 'ใช้งาน' : 'ปิด'}</span>,
        },
        {
            key: 'actions', title: 'จัดการ',
            render: (_: any, row: any) => (
                <div className="table-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => handleEdit(row)}>✏️ แก้ไข</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteClick(row)}>🗑️ ลบ</button>
                </div>
            ),
        },
    ];

    return (
        <div>
            {successMsg && <div className="toast-success">✅ {successMsg}</div>}
            <DataTable title="ตั้งค่าแจ้งเตือน" columns={columns} data={data} total={total} page={page} limit={limit} loading={loading} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} onCreate={handleCreate} createLabel="เพิ่มการแจ้งเตือน" />

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? 'แก้ไขการแจ้งเตือน' : 'เพิ่มการแจ้งเตือน'} size="lg"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>ยกเลิก</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'กำลังบันทึก...' : editId ? 'อัพเดต' : 'สร้าง'}</button></div>}
            >
                {formError && <div className="form-error-banner">{formError}</div>}

                <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>มิเตอร์และค่าพลังงาน</div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">มิเตอร์ <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <select className="form-control" value={form.meterId} onChange={e => setForm({ ...form, meterId: e.target.value })}>
                            <option value="">— เลือกมิเตอร์ —</option>
                            {meters.map(m => <option key={m.meter_id} value={m.meter_id}>{m.meter_code} — {m.meter_name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">ค่าพลังงาน</label>
                        <select className="form-control" value={form.energyValueId} onChange={e => setForm({ ...form, energyValueId: e.target.value })}>
                            <option value="">— เลือก —</option>
                            {energyValues.map(ev => <option key={ev.energy_value_id} value={ev.energy_value_id}>{ev.energy_value_name}</option>)}
                        </select>
                    </div>
                </div>

                <div style={{ marginBottom: 8, marginTop: 8, fontWeight: 600, fontSize: 13, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ขีดจำกัด</div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">ค่าต่ำสุด</label>
                        <input type="number" className="form-control" placeholder="0" value={form.lowerValue} onChange={e => setForm({ ...form, lowerValue: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">ค่าสูงสุด</label>
                        <input type="number" className="form-control" placeholder="0" value={form.higherValue} onChange={e => setForm({ ...form, higherValue: e.target.value })} />
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">ข้อความค่าต่ำ</label>
                        <input type="text" className="form-control" placeholder="ข้อความแจ้งเตือนค่าต่ำ" value={form.lowerMessage} onChange={e => setForm({ ...form, lowerMessage: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">ข้อความค่าสูง</label>
                        <input type="text" className="form-control" placeholder="ข้อความแจ้งเตือนค่าสูง" value={form.higherMessage} onChange={e => setForm({ ...form, higherMessage: e.target.value })} />
                    </div>
                </div>

                <div style={{ marginBottom: 8, marginTop: 8, fontWeight: 600, fontSize: 13, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>อุปกรณ์เตือน</div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <input type="checkbox" checked={form.isLampOn} onChange={e => setForm({ ...form, isLampOn: e.target.checked })} style={{ width: 18, height: 18 }} />
                            เปิดไฟเตือน
                        </label>
                    </div>
                    <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <input type="checkbox" checked={form.isBuzzerOn} onChange={e => setForm({ ...form, isBuzzerOn: e.target.checked })} style={{ width: 18, height: 18 }} />
                            เปิดเสียงเตือน
                        </label>
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--success)' }} />
                        ใช้งาน
                    </label>
                </div>
            </Modal>

            <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title="ยืนยันการลบ" size="sm"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowDelete(false)} disabled={deleting}>ยกเลิก</button><button className="btn btn-danger" onClick={handleDeleteConfirm} disabled={deleting}>{deleting ? 'กำลังลบ...' : 'ลบ'}</button></div>}
            >
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                    <p style={{ fontSize: 16, marginBottom: 8 }}>ลบการแจ้งเตือนของ</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>"{deleteTarget?.meter_name}"</p>
                </div>
            </Modal>
        </div>
    );
};

export default AlarmConfigsPage;
