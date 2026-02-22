import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { metersApi } from '../../api/client';

interface LoopForm {
    portNo: string;
    baudrate: string;
    stopbit: string;
    parity: string;
    databit: string;
    remark: string;
    isActive: boolean;
}

const emptyForm: LoopForm = {
    portNo: '', baudrate: '9600', stopbit: '1', parity: 'N', databit: '8', remark: '', isActive: true,
};

const LoopsPage: React.FC = () => {
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<LoopForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const [showDelete, setShowDelete] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await metersApi.getLoops({ page, limit });
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [page, limit]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { if (successMsg) { const t = setTimeout(() => setSuccessMsg(''), 3000); return () => clearTimeout(t); } }, [successMsg]);

    const handleCreate = () => { setEditId(null); setForm(emptyForm); setFormError(''); setShowModal(true); };

    const handleEdit = (row: any) => {
        setEditId(row.loop_id);
        setForm({
            portNo: row.port_no || '',
            baudrate: row.baudrate?.toString() || '9600',
            stopbit: row.stopbit?.toString() || '1',
            parity: row.parity || 'N',
            databit: row.databit?.toString() || '8',
            remark: row.remark || '',
            isActive: row.is_active ?? true,
        });
        setFormError('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.portNo.trim()) { setFormError('Port No is required'); return; }
        setSaving(true); setFormError('');
        try {
            const payload = {
                portNo: form.portNo,
                baudrate: parseInt(form.baudrate) || 9600,
                stopbit: parseInt(form.stopbit) || 1,
                parity: form.parity,
                databit: parseInt(form.databit) || 8,
                remark: form.remark,
                isActive: form.isActive,
            };
            if (editId) {
                await metersApi.updateLoop(editId, payload);
                setSuccessMsg('Loop updated successfully!');
            } else {
                await metersApi.createLoop(payload);
                setSuccessMsg('Loop created successfully!');
            }
            setShowModal(false); fetchData();
        } catch (err: any) { setFormError(err.response?.data?.message || 'Failed to save loop'); }
        setSaving(false);
    };

    const handleDeleteClick = (row: any) => { setDeleteTarget(row); setShowDelete(true); };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await metersApi.deleteLoop(deleteTarget.loop_id);
            setSuccessMsg('Loop deleted successfully!');
            setShowDelete(false); setDeleteTarget(null); fetchData();
        } catch (err: any) { alert(err.response?.data?.message || 'Failed to delete loop'); }
        setDeleting(false);
    };

    const columns = [
        { key: 'port_no', title: 'Port No' },
        { key: 'baudrate', title: 'Baudrate' },
        { key: 'stopbit', title: 'Stopbit' },
        { key: 'parity', title: 'Parity' },
        { key: 'databit', title: 'Databit' },
        { key: 'remark', title: 'Remark' },
        {
            key: 'is_active', title: 'Status',
            render: (v: boolean) => <span className={`badge ${v ? 'badge-success' : 'badge-danger'}`}>{v ? 'Active' : 'Inactive'}</span>,
        },
        {
            key: 'actions', title: 'Actions',
            render: (_: any, row: any) => (
                <div className="table-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => handleEdit(row)}>✏️ Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteClick(row)}>🗑️ Delete</button>
                </div>
            ),
        },
    ];

    return (
        <div>
            {successMsg && <div className="toast-success">✅ {successMsg}</div>}
            <DataTable title="ลูปสื่อสาร" columns={columns} data={data} total={total} page={page} limit={limit} loading={loading} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} onCreate={handleCreate} createLabel="เพิ่มลูป" />

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? 'แก้ไขลูป' : 'เพิ่มลูป'} size="md"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editId ? 'Update' : 'Create'}</button></div>}
            >
                {formError && <div className="form-error-banner">{formError}</div>}
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Port No <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input type="text" className="form-control" placeholder="e.g. COM1" value={form.portNo} onChange={(e) => setForm({ ...form, portNo: e.target.value })} autoFocus />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Baudrate</label>
                        <select className="form-control" value={form.baudrate} onChange={(e) => setForm({ ...form, baudrate: e.target.value })}>
                            {[1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200].map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Stopbit</label>
                        <select className="form-control" value={form.stopbit} onChange={(e) => setForm({ ...form, stopbit: e.target.value })}>
                            <option value="1">1</option><option value="2">2</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Parity</label>
                        <select className="form-control" value={form.parity} onChange={(e) => setForm({ ...form, parity: e.target.value })}>
                            <option value="N">None</option><option value="E">Even</option><option value="O">Odd</option>
                        </select>
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Databit</label>
                        <select className="form-control" value={form.databit} onChange={(e) => setForm({ ...form, databit: e.target.value })}>
                            <option value="7">7</option><option value="8">8</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Remark</label>
                        <input type="text" className="form-control" placeholder="Optional remark" value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--success)' }} />
                        Active
                    </label>
                </div>
            </Modal>

            <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title="ยืนยันการลบ" size="sm"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowDelete(false)} disabled={deleting}>Cancel</button><button className="btn btn-danger" onClick={handleDeleteConfirm} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</button></div>}
            >
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                    <p style={{ fontSize: 16, marginBottom: 8 }}>Delete loop</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>"{deleteTarget?.port_no}"</p>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>Meters using this loop will be affected.</p>
                </div>
            </Modal>
        </div>
    );
};

export default LoopsPage;
