import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { usersApi } from '../../api/client';

interface UserForm {
    userName: string;
    displayName: string;
    email: string;
    password: string;
    groupId: number;
    isActive: boolean;
}

const emptyForm: UserForm = {
    userName: '', displayName: '', email: '', password: '', groupId: 1, isActive: true,
};

const UsersPage: React.FC = () => {
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    // Groups list for dropdown
    const [groups, setGroups] = useState<any[]>([]);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<UserForm>(emptyForm);
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
            const res = await usersApi.getAll({ page, limit, search });
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [page, limit, search]);

    const fetchGroups = useCallback(async () => {
        try {
            const res = await usersApi.getGroups({ limit: 100 });
            setGroups(res.data.data || []);
        } catch (err) { console.error(err); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { fetchGroups(); }, [fetchGroups]);

    // Auto-hide success
    useEffect(() => {
        if (successMsg) {
            const t = setTimeout(() => setSuccessMsg(''), 3000);
            return () => clearTimeout(t);
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
        setEditId(row.user_id);
        setForm({
            userName: row.user_name || '',
            displayName: row.display_name || '',
            email: row.email || '',
            password: '', // don't pre-fill password
            groupId: row.group_id || 1,
            isActive: row.is_active ?? true,
        });
        setFormError('');
        setShowModal(true);
    };

    // ===== SAVE =====
    const handleSave = async () => {
        if (!form.userName.trim()) {
            setFormError('Username is required');
            return;
        }
        if (!editId && (!form.password || form.password.length < 6)) {
            setFormError('Password must be at least 6 characters');
            return;
        }
        setSaving(true);
        setFormError('');
        try {
            if (editId) {
                await usersApi.update(editId, {
                    displayName: form.displayName,
                    email: form.email,
                    groupId: form.groupId,
                    isActive: form.isActive,
                });
                setSuccessMsg('User updated successfully!');
            } else {
                await usersApi.create({
                    userName: form.userName,
                    displayName: form.displayName,
                    email: form.email,
                    password: form.password,
                    groupId: form.groupId,
                });
                setSuccessMsg('User created successfully!');
            }
            setShowModal(false);
            fetchData();
        } catch (err: any) {
            setFormError(err.response?.data?.message || 'Failed to save user');
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
            await usersApi.delete(deleteTarget.user_id);
            setSuccessMsg('User deleted successfully!');
            setShowDelete(false);
            setDeleteTarget(null);
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to delete user');
        }
        setDeleting(false);
    };

    const columns = [
        { key: 'user_name', title: 'Username' },
        { key: 'display_name', title: 'Display Name' },
        { key: 'email', title: 'Email' },
        {
            key: 'group_name', title: 'Group',
            render: (v: string) => (
                <span className="badge badge-primary">{v || '-'}</span>
            ),
        },
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
            {successMsg && <div className="toast-success">✅ {successMsg}</div>}

            <DataTable
                title="ผู้ใช้งาน (Users)"
                columns={columns}
                data={data}
                total={total}
                page={page}
                limit={limit}
                loading={loading}
                onPageChange={setPage}
                onLimitChange={(l) => { setLimit(l); setPage(1); }}
                onSearch={(s) => { setSearch(s); setPage(1); }}
                onCreate={handleCreate}
                createLabel="Create User"
            />

            {/* Create/Edit User Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editId ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}
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

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">
                            Username <span style={{ color: 'var(--danger)' }}>*</span>
                        </label>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Enter username"
                            value={form.userName}
                            onChange={(e) => setForm({ ...form, userName: e.target.value })}
                            disabled={!!editId}
                            autoFocus
                            style={editId ? { background: '#f1f5f9', cursor: 'not-allowed' } : {}}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Display Name</label>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Enter display name"
                            value={form.displayName}
                            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                        />
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            type="email"
                            className="form-control"
                            placeholder="Enter email"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Group</label>
                        <select
                            className="form-control"
                            value={form.groupId}
                            onChange={(e) => setForm({ ...form, groupId: parseInt(e.target.value) })}
                        >
                            {groups.map((g: any) => (
                                <option key={g.group_id} value={g.group_id}>{g.group_name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {!editId && (
                    <div className="form-group">
                        <label className="form-label">
                            Password <span style={{ color: 'var(--danger)' }}>*</span>
                        </label>
                        <input
                            type="password"
                            className="form-control"
                            placeholder="Minimum 6 characters"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                        />
                    </div>
                )}

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
                        Are you sure you want to delete user
                    </p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>
                        "{deleteTarget?.user_name}" ({deleteTarget?.display_name})
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 8 }}>
                        This action cannot be undone.
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default UsersPage;
