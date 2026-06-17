import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { metersApi, sitesApi } from '../../api/client';
import { useLanguage } from '../../contexts/LanguageContext';

interface MeterForm {
    meterCode: string;
    meterName: string;
    address: string;
    meterBrandId: string;
    meterTypeId: string;
    loopId: string;
    siteId: string;
    buildingId: string;
    zoneId: string;
    ipAddress: string;
    portNumber: string;
    roomCode: string;
    roomName: string;
    phase: string;
    circuit: string;
    isActive: boolean;
}

const emptyForm: MeterForm = {
    meterCode: '', meterName: '', address: '', meterBrandId: '', meterTypeId: '',
    loopId: '', siteId: '', buildingId: '', zoneId: '', ipAddress: '', portNumber: '',
    roomCode: '', roomName: '', phase: '', circuit: '', isActive: true,
};

const MetersPage: React.FC = () => {
    const { t } = useLanguage();
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(true);

    // Lookup data
    const [sites, setSites] = useState<any[]>([]);
    const [buildings, setBuildings] = useState<any[]>([]);
    const [zones, setZones] = useState<any[]>([]);
    const [brands, setBrands] = useState<any[]>([]);
    const [types, setTypes] = useState<any[]>([]);
    const [loops, setLoops] = useState<any[]>([]);

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<MeterForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    // Delete
    const [showDelete, setShowDelete] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await metersApi.getAll({ page, limit });
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [page, limit]);

    const fetchLookups = useCallback(async () => {
        try {
            const [sRes, bRes, zRes, brRes, tRes, lRes] = await Promise.all([
                sitesApi.getAll({ limit: 200 }),
                sitesApi.getAllBuildings({ limit: 200 }),
                sitesApi.getZones({ limit: 200 }),
                metersApi.getBrands({ limit: 200 }),
                metersApi.getTypes({ limit: 200 }),
                metersApi.getLoops({ limit: 200 }),
            ]);
            setSites(sRes.data.data || []);
            setBuildings(bRes.data.data || []);
            setZones(zRes.data.data || []);
            setBrands(brRes.data.data || []);
            setTypes(tRes.data.data || []);
            setLoops(lRes.data.data || []);
        } catch (err) { console.error(err); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { fetchLookups(); }, [fetchLookups]);
    useEffect(() => {
        if (successMsg) {
            const timer = setTimeout(() => setSuccessMsg(''), 3000);
            return () => clearTimeout(timer);
        }
    }, [successMsg]);

    // Filter buildings by selected site
    const filteredBuildings = form.siteId
        ? buildings.filter(b => b.site_id?.toString() === form.siteId)
        : buildings;

    const handleCreate = () => { setEditId(null); setForm(emptyForm); setFormError(''); setShowModal(true); };

    const handleEdit = (row: any) => {
        setEditId(row.meter_id);
        setForm({
            meterCode: row.meter_code || '',
            meterName: row.meter_name || '',
            address: row.address?.toString() || '',
            meterBrandId: row.meter_brand_id?.toString() || '',
            meterTypeId: row.meter_type_id?.toString() || '',
            loopId: row.loop_id?.toString() || '',
            siteId: row.site_id?.toString() || '',
            buildingId: row.building_id?.toString() || '',
            zoneId: row.zone_id?.toString() || '',
            ipAddress: row.ip_address || '',
            portNumber: row.port_number?.toString() || '',
            roomCode: row.room_code || '',
            roomName: row.room_name || '',
            phase: row.phase?.toString() || '',
            circuit: row.circuit?.toString() || '',
            isActive: row.is_active ?? true,
        });
        setFormError('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.meterCode.trim()) { setFormError(t('กรุณากรอกรหัสมิเตอร์', 'Meter Code is required')); return; }
        if (!form.meterName.trim()) { setFormError(t('กรุณากรอกชื่อมิเตอร์', 'Meter Name is required')); return; }
        setSaving(true); setFormError('');
        try {
            const payload = {
                ...form,
                address: form.address ? parseInt(form.address) : null,
                meterBrandId: form.meterBrandId ? parseInt(form.meterBrandId) : null,
                meterTypeId: form.meterTypeId ? parseInt(form.meterTypeId) : null,
                loopId: form.loopId ? parseInt(form.loopId) : null,
                siteId: form.siteId ? parseInt(form.siteId) : null,
                buildingId: form.buildingId ? parseInt(form.buildingId) : null,
                zoneId: form.zoneId ? parseInt(form.zoneId) : null,
                portNumber: form.portNumber ? parseInt(form.portNumber) : null,
                phase: form.phase ? parseInt(form.phase) : null,
                circuit: form.circuit ? parseInt(form.circuit) : null,
            };
            if (editId) {
                await metersApi.update(editId, payload);
                setSuccessMsg(t('อัปเดตมิเตอร์สำเร็จ!', 'Meter updated successfully!'));
            } else {
                await metersApi.create(payload);
                setSuccessMsg(t('สร้างมิเตอร์สำเร็จ!', 'Meter created successfully!'));
            }
            setShowModal(false); fetchData();
        } catch (err: any) { setFormError(err.response?.data?.message || t('บันทึกมิเตอร์ล้มเหลว', 'Failed to save meter')); }
        setSaving(false);
    };

    const handleDeleteClick = (row: any) => { setDeleteTarget(row); setShowDelete(true); };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await metersApi.delete(deleteTarget.meter_id);
            setSuccessMsg(t('ลบมิเตอร์สำเร็จ!', 'Meter deleted successfully!'));
            setShowDelete(false); setDeleteTarget(null); fetchData();
        } catch (err: any) { alert(err.response?.data?.message || t('ลบมิเตอร์ล้มเหลว', 'Failed to delete meter')); }
        setDeleting(false);
    };

    const columns = [
        { key: 'meter_code', title: t('รหัส', 'Code') },
        { key: 'meter_name', title: t('ชื่อมิเตอร์', 'Meter Name') },
        { key: 'site_name', title: t('ไซต์', 'Site') },
        { key: 'building_name', title: t('อาคาร', 'Building') },
        { key: 'zone_name', title: t('โซน', 'Zone') },
        {
            key: 'brand_name', title: t('แบรนด์', 'Brand'),
            render: (v: string) => v ? <span className="badge badge-info">{v}</span> : '—',
        },
        {
            key: 'is_active', title: t('สถานะ', 'Status'),
            render: (v: boolean) => <span className={`badge ${v ? t('ใช้งาน', 'Active') : t('ไม่ใช้งาน', 'Inactive')}`}>{v ? t('ใช้งาน', 'Active') : t('ไม่ใช้งาน', 'Inactive')}</span>,
        },
        {
            key: 'actions', title: t('จัดการ', 'Actions'),
            render: (_: any, row: any) => (
                <div className="table-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => handleEdit(row)}>✏️ {t('แก้ไข', 'Edit')}</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteClick(row)}>🗑️ {t('ลบ', 'Delete')}</button>
                </div>
            ),
        },
    ];

    return (
        <div>
            {successMsg && <div className="toast-success">✅ {successMsg}</div>}
            <DataTable title={t('มิเตอร์', 'Meters')} columns={columns} data={data} total={total} page={page} limit={limit} loading={loading} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} onCreate={handleCreate} createLabel={t('เพิ่มมิเตอร์', 'Add Meter')} />

            {/* Create/Edit Modal — larger size */}
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? t('แก้ไขมิเตอร์', 'Edit Meter') : t('เพิ่มมิเตอร์ใหม่', 'Add New Meter')} size="lg"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>{t('ยกเลิก', 'Cancel')}</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('กำลังบันทึก...', 'Saving...') : editId ? t('อัปเดต', 'Update') : t('สร้าง', 'Create')}</button></div>}
            >
                {formError && <div className="form-error-banner">{formError}</div>}

                {/* Basic Info */}
                <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('ข้อมูลพื้นฐาน', 'Basic Information')}</div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">{t('รหัสมิเตอร์', 'Meter Code')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input type="text" className="form-control" placeholder={t('เช่น MTR-001', 'e.g. MTR-001')} value={form.meterCode} onChange={e => setForm({ ...form, meterCode: e.target.value })} autoFocus />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('ชื่อมิเตอร์', 'Meter Name')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input type="text" className="form-control" placeholder={t('เช่น มิเตอร์ไฟฟ้าหลัก', 'e.g. Main Electricity Meter')} value={form.meterName} onChange={e => setForm({ ...form, meterName: e.target.value })} />
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">{t('ประเภทมิเตอร์', 'Meter Type')}</label>
                        <select className="form-control" value={form.meterTypeId} onChange={e => setForm({ ...form, meterTypeId: e.target.value })}>
                            <option value="">— {t('เลือก', 'Select')} —</option>
                            {types.map(t => <option key={t.meter_type_id} value={t.meter_type_id}>{t.meter_type_name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('แบรนด์', 'Brand')}</label>
                        <select className="form-control" value={form.meterBrandId} onChange={e => setForm({ ...form, meterBrandId: e.target.value })}>
                            <option value="">— {t('เลือก', 'Select')} —</option>
                            {brands.map(b => <option key={b.meter_brand_id} value={b.meter_brand_id}>{b.meter_brand_name}{b.model_name ? ` — ${b.model_name}` : ''}</option>)}
                        </select>
                    </div>
                </div>

                {/* Location */}
                <div style={{ marginBottom: 8, marginTop: 8, fontWeight: 600, fontSize: 13, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('สถานที่', 'Location')}</div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">{t('ไซต์', 'Site')}</label>
                        <select className="form-control" value={form.siteId} onChange={e => setForm({ ...form, siteId: e.target.value, buildingId: '' })}>
                            <option value="">— {t('เลือก', 'Select')} —</option>
                            {sites.map(s => <option key={s.site_id} value={s.site_id}>{s.site_name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('อาคาร', 'Building')}</label>
                        <select className="form-control" value={form.buildingId} onChange={e => setForm({ ...form, buildingId: e.target.value })}>
                            <option value="">— {t('เลือก', 'Select')} —</option>
                            {filteredBuildings.map(b => <option key={b.building_id} value={b.building_id}>{b.building_name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">{t('โซน', 'Zone')}</label>
                        <select className="form-control" value={form.zoneId} onChange={e => setForm({ ...form, zoneId: e.target.value })}>
                            <option value="">— {t('เลือก', 'Select')} —</option>
                            {zones.map(z => <option key={z.zone_id} value={z.zone_id}>{z.zone_name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('รหัสห้อง', 'Room Code')}</label>
                        <input type="text" className="form-control" placeholder={t('รหัสห้อง', 'Room code')} value={form.roomCode} onChange={e => setForm({ ...form, roomCode: e.target.value })} />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">{t('ชื่อห้อง', 'Room Name')}</label>
                    <input type="text" className="form-control" placeholder={t('ชื่อห้อง', 'Room name')} value={form.roomName} onChange={e => setForm({ ...form, roomName: e.target.value })} />
                </div>

                {/* Communication */}
                <div style={{ marginBottom: 8, marginTop: 8, fontWeight: 600, fontSize: 13, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('การสื่อสาร', 'Communication')}</div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">{t('ลูป', 'Loop')}</label>
                        <select className="form-control" value={form.loopId} onChange={e => setForm({ ...form, loopId: e.target.value })}>
                            <option value="">— {t('เลือก', 'Select')} —</option>
                            {loops.map(l => <option key={l.loop_id} value={l.loop_id}>{l.port_no} ({l.baudrate})</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('ที่อยู่ Modbus', 'Modbus Address')}</label>
                        <input type="number" className="form-control" placeholder={t('เช่น 1', 'e.g. 1')} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">{t('ที่อยู่ IP', 'IP Address')}</label>
                        <input type="text" className="form-control" placeholder={t('เช่น 192.168.1.100', 'e.g. 192.168.1.100')} value={form.ipAddress} onChange={e => setForm({ ...form, ipAddress: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('หมายเลขพอร์ต', 'Port Number')}</label>
                        <input type="number" className="form-control" placeholder={t('เช่น 502', 'e.g. 502')} value={form.portNumber} onChange={e => setForm({ ...form, portNumber: e.target.value })} />
                    </div>
                </div>

                {/* Electrical */}
                <div style={{ marginBottom: 8, marginTop: 8, fontWeight: 600, fontSize: 13, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('ระบบไฟฟ้า', 'Electrical')}</div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">{t('เฟส', 'Phase')}</label>
                        <select className="form-control" value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value })}>
                            <option value="">— {t('เลือก', 'Select')} —</option>
                            <option value="1">{t('1 เฟส', '1 Phase')}</option>
                            <option value="3">{t('3 เฟส', '3 Phase')}</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('วงจร (Circuit)', 'Circuit')}</label>
                        <input type="number" className="form-control" placeholder={t('หมายเลขวงจร', 'Circuit number')} value={form.circuit} onChange={e => setForm({ ...form, circuit: e.target.value })} />
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--success)' }} />
                        {t('ใช้งาน', 'Active')}
                    </label>
                </div>
            </Modal>

            {/* Delete */}
            <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title={t('ยืนยันการลบ', 'Confirm Delete')} size="sm"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowDelete(false)} disabled={deleting}>{t('ยกเลิก', 'Cancel')}</button><button className="btn btn-danger" onClick={handleDeleteConfirm} disabled={deleting}>{deleting ? t('กำลังลบ...', 'Deleting...') : t('ลบ', 'Delete')}</button></div>}
            >
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                    <p style={{ fontSize: 16, marginBottom: 8 }}>{t('ลบมิเตอร์', 'Delete meter')}</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>"{deleteTarget?.meter_code} — {deleteTarget?.meter_name}"</p>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>{t('ข้อมูลประวัติทั้งหมดของมิเตอร์นี้จะยังคงอยู่ แต่อาจขาดการเชื่อมโยง', 'All historical data for this meter will remain but may become orphaned.')}</p>
                </div>
            </Modal>
        </div>
    );
};

export default MetersPage;
