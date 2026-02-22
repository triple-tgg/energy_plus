import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { usersApi } from '../../api/client';

interface GroupForm {
    groupName: string;
    description: string;
    isActive: boolean;
}

const emptyForm: GroupForm = { groupName: '', description: '', isActive: true };

const GroupsPage: React.FC = () => {
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<GroupForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    // Delete state
    const [showDelete, setShowDelete] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);

    // Success message
    const [successMsg, setSuccessMsg] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await usersApi.getGroups({ page, limit });
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [page, limit]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Auto-hide success message
    useEffect(() => {
        if (successMsg) {
            const timer = setTimeout(() => setSuccessMsg(''), 3000);
            return () => clearTimeout(timer);
        }
    }, [successMsg]);

    // ===== CREATE =====
    const handleCreate = () => {
        setEditId(null);
        setForm(emptyForm);
        setFormError('');
        setShowModal(true);
    };

    // ===== EDIT =====
    const handleEdit = (row: any) => {
        setEditId(row.group_id);
        setForm({
            groupName: row.group_name || '',
            description: row.description || '',
            isActive: row.is_active ?? true,
        });
        setFormError('');
        setShowModal(true);
    };

    // ===== SAVE (Create/Update) =====
    const handleSave = async () => {
        if (!form.groupName.trim()) {
            setFormError('Group Name is required');
            return;
        }
        setSaving(true);
        setFormError('');
        try {
            if (editId) {
                await usersApi.updateGroup(editId, form);
                setSuccessMsg('Group updated successfully!');
            } else {
                await usersApi.createGroup(form);
                setSuccessMsg('Group created successfully!');
            }
            setShowModal(false);
            fetchData();
        } catch (err: any) {
            setFormError(err.response?.data?.message || 'Failed to save group');
        }
        setSaving(false);
    };

    // ===== DELETE =====
    const handleDeleteClick = (row: any) => {
        setDeleteTarget(row);
        setShowDelete(true);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await usersApi.deleteGroup(deleteTarget.group_id);
            setSuccessMsg('Group deleted successfully!');
            setShowDelete(false);
            setDeleteTarget(null);
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to delete group');
        }
        setDeleting(false);
    };

    // ===== COLUMNS =====
    const columns = [
        { key: 'group_name', title: 'Group Name' },
        { key: 'description', title: 'Description' },
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
            {/* Success Toast */}
            {successMsg && (
                <div className="toast-success">
                    ✅ {successMsg}
                </div>
            )}

            {/* Data Table */}
            <DataTable
                title="กลุ่มผู้ใช้งาน (User Groups)"
                columns={columns}
                data={data}
                total={total}
                page={page}
                limit={limit}
                loading={loading}
                onPageChange={setPage}
                onLimitChange={(l) => { setLimit(l); setPage(1); }}
                onCreate={handleCreate}
                createLabel="Create Group"
            />

            {/* Create/Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editId ? 'แก้ไขกลุ่ม' : 'เพิ่มกลุ่มใหม่'}
                size="sm"
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
                {formError && (
                    <div className="form-error-banner">{formError}</div>
                )}

                <div className="form-group">
                    <label className="form-label">Group Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Enter group name"
                        value={form.groupName}
                        onChange={(e) => setForm({ ...form, groupName: e.target.value })}
                        autoFocus
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea
                        className="form-control"
                        placeholder="Enter description"
                        rows={3}
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        style={{ resize: 'vertical' }}
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

            {/* Delete Confirmation Modal */}
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
                        Are you sure you want to delete group
                    </p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>
                        "{deleteTarget?.group_name}"
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 8 }}>
                        This action cannot be undone.
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default GroupsPage;
