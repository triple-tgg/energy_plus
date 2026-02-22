import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { metersApi } from '../../api/client';

interface TypeForm {
    meterTypeName: string;
    iconName: string;
    isActive: boolean;
}

const emptyForm: TypeForm = { meterTypeName: '', iconName: '', isActive: true };

const MeterTypesPage: React.FC = () => {
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(true);

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<TypeForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    // Delete
    const [showDelete, setShowDelete] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);

    // Toast
    const [successMsg, setSuccessMsg] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await metersApi.getTypes({ page, limit });
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [page, limit]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        if (successMsg) {
            const t = setTimeout(() => setSuccessMsg(''), 3000);
            return () => clearTimeout(t);
        }
    }, [successMsg]);

    const handleCreate = () => {
        setEditId(null);
        setForm(emptyForm);
        setFormError('');
        setShowModal(true);
    };

    const handleEdit = (row: any) => {
        setEditId(row.meter_type_id);
        setForm({
            meterTypeName: row.meter_type_name || '',
            iconName: row.icon_name || '',
            isActive: row.is_active ?? true,
        });
        setFormError('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.meterTypeName.trim()) {
            setFormError('Meter Type Name is required');
            return;
        }
        setSaving(true);
        setFormError('');
        try {
            if (editId) {
                await metersApi.updateType(editId, form);
                setSuccessMsg('Meter type updated successfully!');
            } else {
                await metersApi.createType(form);
                setSuccessMsg('Meter type created successfully!');
            }
            setShowModal(false);
            fetchData();
        } catch (err: any) {
            setFormError(err.response?.data?.message || 'Failed to save meter type');
        }
        setSaving(false);
    };

    const handleDeleteClick = (row: any) => {
        setDeleteTarget(row);
        setShowDelete(true);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await metersApi.deleteType(deleteTarget.meter_type_id);
            setSuccessMsg('Meter type deleted successfully!');
            setShowDelete(false);
            setDeleteTarget(null);
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to delete meter type');
        }
        setDeleting(false);
    };

    const columns = [
        { key: 'meter_type_name', title: 'Type Name' },
        { key: 'icon_name', title: 'Icon' },
        {
            key: 'is_active', title: 'Status',
            render: (v: boolean) => (
                <span className={`badge ${v ? 'badge-success' : 'badge-danger'}`}>
                    {v ? 'Active' : 'Inactive'}
                </span>
            ),
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

            <DataTable
                title="ประเภทมิเตอร์"
                columns={columns}
                data={data}
                total={total}
                page={page}
                limit={limit}
                loading={loading}
                onPageChange={setPage}
                onLimitChange={(l) => { setLimit(l); setPage(1); }}
                onCreate={handleCreate}
                createLabel="เพิ่มประเภท"
            />

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editId ? 'แก้ไขประเภทมิเตอร์' : 'เพิ่มประเภทมิเตอร์'}
                size="md"
                footer={
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
                        </button>
                    </div>
                }
            >
                {formError && <div className="form-error-banner">{formError}</div>}

                <div className="form-group">
                    <label className="form-label">Type Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Electricity, Water, Gas"
                        value={form.meterTypeName}
                        onChange={(e) => setForm({ ...form, meterTypeName: e.target.value })}
                        autoFocus
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Icon Name</label>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. ⚡ or icon class name"
                        value={form.iconName}
                        onChange={(e) => setForm({ ...form, iconName: e.target.value })}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                            type="checkbox"
                            checked={form.isActive}
                            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                            style={{ width: 18, height: 18, accentColor: 'var(--success)' }}
                        />
                        Active
                    </label>
                </div>
            </Modal>

            <Modal
                isOpen={showDelete}
                onClose={() => setShowDelete(false)}
                title="ยืนยันการลบ"
                size="sm"
                footer={
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline" onClick={() => setShowDelete(false)} disabled={deleting}>Cancel</button>
                        <button className="btn btn-danger" onClick={handleDeleteConfirm} disabled={deleting}>
                            {deleting ? 'Deleting...' : 'Delete'}
                        </button>
                    </div>
                }
            >
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                    <p style={{ fontSize: 16, marginBottom: 8 }}>Delete meter type</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>
                        "{deleteTarget?.meter_type_name}"
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                        Meters using this type may be affected.
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default MeterTypesPage;
