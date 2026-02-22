import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { sitesApi } from '../../api/client';

interface SiteForm {
    siteName: string;
    siteAddress: string;
    siteStatus: boolean;
}

const emptyForm: SiteForm = { siteName: '', siteAddress: '', siteStatus: true };

const SitesPage: React.FC = () => {
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<SiteForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    // Delete state
    const [showDelete, setShowDelete] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);

    // Success
    const [successMsg, setSuccessMsg] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await sitesApi.getAll({ page, limit });
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
        setEditId(row.site_id);
        setForm({
            siteName: row.site_name || '',
            siteAddress: row.site_address || '',
            siteStatus: row.site_status ?? true,
        });
        setFormError('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.siteName.trim()) {
            setFormError('Site Name is required');
            return;
        }
        setSaving(true);
        setFormError('');
        try {
            if (editId) {
                await sitesApi.update(editId, form);
                setSuccessMsg('Site updated successfully!');
            } else {
                await sitesApi.create(form);
                setSuccessMsg('Site created successfully!');
            }
            setShowModal(false);
            fetchData();
        } catch (err: any) {
            setFormError(err.response?.data?.message || 'Failed to save site');
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
            await sitesApi.delete(deleteTarget.site_id);
            setSuccessMsg('Site deleted successfully!');
            setShowDelete(false);
            setDeleteTarget(null);
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to delete site');
        }
        setDeleting(false);
    };

    const columns = [
        { key: 'site_name', title: 'Site Name' },
        { key: 'site_address', title: 'Address' },
        {
            key: 'site_status', title: 'Status',
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
                    <button className="btn btn-primary btn-sm" onClick={() => handleEdit(row)}>
                        ✏️ Edit
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteClick(row)}>
                        🗑️ Delete
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div>
            {successMsg && <div className="toast-success">✅ {successMsg}</div>}

            <DataTable
                title="สถานที่ (Sites)"
                columns={columns}
                data={data}
                total={total}
                page={page}
                limit={limit}
                loading={loading}
                onPageChange={setPage}
                onLimitChange={(l) => { setLimit(l); setPage(1); }}
                onCreate={handleCreate}
                createLabel="Create Site"
            />

            {/* Create/Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editId ? 'แก้ไขสถานที่' : 'เพิ่มสถานที่ใหม่'}
                size="md"
                footer={
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>
                            Cancel
                        </button>
                        <button className="btn btn-success" onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
                        </button>
                    </div>
                }
            >
                {formError && <div className="form-error-banner">{formError}</div>}

                <div className="form-group">
                    <label className="form-label">
                        Site Name <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Enter site name"
                        value={form.siteName}
                        onChange={(e) => setForm({ ...form, siteName: e.target.value })}
                        autoFocus
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Address</label>
                    <textarea
                        className="form-control"
                        placeholder="Enter site address"
                        rows={3}
                        value={form.siteAddress}
                        onChange={(e) => setForm({ ...form, siteAddress: e.target.value })}
                        style={{ resize: 'vertical' }}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                            type="checkbox"
                            checked={form.siteStatus}
                            onChange={(e) => setForm({ ...form, siteStatus: e.target.checked })}
                            style={{ width: 18, height: 18, accentColor: 'var(--success)' }}
                        />
                        Active
                    </label>
                </div>
            </Modal>

            {/* Delete Confirmation */}
            <Modal
                isOpen={showDelete}
                onClose={() => setShowDelete(false)}
                title="ยืนยันการลบ"
                size="sm"
                footer={
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline" onClick={() => setShowDelete(false)} disabled={deleting}>
                            Cancel
                        </button>
                        <button className="btn btn-danger" onClick={handleDeleteConfirm} disabled={deleting}>
                            {deleting ? 'Deleting...' : 'Delete'}
                        </button>
                    </div>
                }
            >
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                    <p style={{ fontSize: 16, marginBottom: 8 }}>
                        Are you sure you want to delete site
                    </p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>
                        "{deleteTarget?.site_name}"
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 8 }}>
                        All buildings and zones under this site will also be affected.
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default SitesPage;
