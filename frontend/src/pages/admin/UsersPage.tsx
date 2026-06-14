import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { usersApi } from '../../api/client';
import { LayoutGrid, Moon, Sun, Users, Save, X, Plus, Pencil, Trash2 } from 'lucide-react';

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, "Cascadia Mono", monospace';

interface Theme {
    bg: string;
    panel: string;
    panel2: string;
    ink: string;
    sub: string;
    line: string;
    bar: string;
    barSub: string;
    accent: string;
    yellow: string;
    grey: string;
    red: string;
}

const THEMES: Record<'light' | 'dark', Theme> = {
    light: {
        bg: '#EAE7DA', panel: '#FBFAF4', panel2: '#F1EFE3', ink: '#23261E', sub: '#6E705F',
        line: '#D4D1C0', bar: '#23261E', barSub: '#A6A892', accent: '#2B4C7E',
        yellow: '#C08A1E', grey: '#9AA08C', red: '#B4452E',
    },
    dark: {
        bg: '#0E1116', panel: '#161B22', panel2: '#1C232E', ink: '#E6EDF3', sub: '#8B98A6',
        line: '#2A313C', bar: '#080A0E', barSub: '#8B98A6', accent: '#36C2CE',
        yellow: '#D29922', grey: '#6E7681', red: '#F85149',
    },
};

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

    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        return (localStorage.getItem('ec-theme') as 'light' | 'dark') || 'light';
    });
    const C = THEMES[theme];

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
        setEditId(row.user_id);
        setForm({
            userName: row.user_name || '',
            displayName: row.display_name || '',
            email: row.email || '',
            password: '',
            groupId: row.group_id || 1,
            isActive: row.is_active ?? true,
        });
        setFormError('');
        setShowModal(true);
    };

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

    const btnStyle = (type: 'primary' | 'cancel' | 'success' | 'danger' | 'sm-edit' | 'sm-danger'): React.CSSProperties => {
        let bg = C.panel;
        let color = C.ink;
        let border = `1px solid ${C.line}`;
        let padding = '8px 16px';
        
        if (type === 'primary') {
            bg = C.accent;
            color = '#fff';
            border = 'none';
        } else if (type === 'success') {
            bg = theme === 'light' ? '#2E7D46' : '#3FB950';
            color = '#fff';
            border = 'none';
        } else if (type === 'cancel') {
            bg = C.panel2;
            color = C.sub;
            border = `1px solid ${C.line}`;
        } else if (type === 'danger') {
            bg = C.red;
            color = '#fff';
            border = 'none';
        } else if (type === 'sm-edit') {
            bg = C.accent;
            color = '#fff';
            border = 'none';
            padding = '4px 8px';
        } else if (type === 'sm-danger') {
            bg = C.red;
            color = '#fff';
            border = 'none';
            padding = '4px 8px';
        }
        
        return {
            fontFamily: MONO,
            fontSize: type.startsWith('sm-') ? '10px' : '11px',
            fontWeight: 700,
            letterSpacing: '0.8px',
            padding: padding,
            background: bg,
            color: color,
            border: border,
            borderRadius: 0,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            textTransform: 'uppercase',
        };
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '8px 10px',
        background: C.panel2,
        color: C.ink,
        border: `1px solid ${C.line}`,
        fontFamily: MONO,
        fontSize: '13px',
        borderRadius: 0,
        outline: 'none',
        boxSizing: 'border-box',
    };

    const labelStyle: React.CSSProperties = {
        display: 'block',
        fontFamily: MONO,
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.8px',
        color: C.sub,
        marginBottom: '4px',
        textTransform: 'uppercase',
    };

    const columns = [
        { key: 'user_name', title: 'Username' },
        { key: 'display_name', title: 'Display Name' },
        { key: 'email', title: 'Email' },
        {
            key: 'group_name', title: 'Group',
            render: (v: string) => (
                <span style={{
                    fontFamily: MONO, fontSize: '10px', fontWeight: 700, padding: '2px 8px',
                    color: C.accent, background: theme === 'light' ? '#EBF3FE' : '#14273E',
                    border: `1px solid ${C.line}`
                }}>
                    {v ? v.toUpperCase() : '—'}
                </span>
            ),
        },
        {
            key: 'is_active', title: 'Status',
            render: (v: boolean) => (
                <span style={{
                    fontFamily: MONO, fontSize: '10px', fontWeight: 700, padding: '2px 8px',
                    color: v ? (theme === 'light' ? '#2E7D46' : '#3FB950') : C.red,
                    background: v ? (theme === 'light' ? '#E8F5E9' : '#143A1D') : (theme === 'light' ? '#FEEBEE' : '#3E1616'),
                    border: `1px solid ${v ? (theme === 'light' ? '#A5D6A7' : '#225B2D') : (theme === 'light' ? '#FFCDD2' : '#6A1B1B')}`
                }}>
                    {v ? 'ACTIVE' : 'INACTIVE'}
                </span>
            ),
        },
        {
            key: 'actions', title: 'Actions',
            render: (_: any, row: any) => (
                <div style={{ display: 'flex', gap: 6 }}>
                    <button style={btnStyle('sm-edit')} onClick={() => handleEdit(row)}>
                        <Pencil size={11} /> Edit
                    </button>
                    <button style={btnStyle('sm-danger')} onClick={() => handleDeleteClick(row)}>
                        <Trash2 size={11} /> Delete
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div className="ec-grid" style={{ fontFamily: "'Noto Sans Thai', system-ui, sans-serif", background: C.bg, minHeight: 'calc(100vh - 120px)', color: C.ink, padding: '0 0 24px 0' }}>
            <style>{`
                .ec-grid {
                    background-image: linear-gradient(${theme === 'light' ? 'rgba(35,38,30,.04)' : 'rgba(230,237,243,.02)'} 1px,transparent 1px),
                                      linear-gradient(90deg,${theme === 'light' ? 'rgba(35,38,30,.04)' : 'rgba(230,237,243,.02)'} 1px,transparent 1px);
                    background-size: 24px 24px;
                }
            `}</style>

            {/* Command bar */}
            <div style={{ background: C.bar, color: '#fff', display: 'flex', alignItems: 'stretch', borderBottom: `2px solid ${C.accent}`, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}><LayoutGrid size={16} /></div>
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>ADMIN // USERS</div>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>บริหารจัดการบัญชีผู้ใช้งานระบบ (Accounts) และระดับสิทธิ์เข้าถึง</div>
                    </div>
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', fontFamily: MONO, fontSize: 11.5 }}>
                    <button onClick={() => {
                        const next = theme === 'light' ? 'dark' : 'light';
                        setTheme(next);
                        localStorage.setItem('ec-theme', next);
                    }}
                        title={theme === 'light' ? 'สลับเป็นโหมดมืด (Control Room)' : 'สลับเป็นโหมดสว่าง (Engineering Paper)'}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 5, fontFamily: MONO, fontSize: 11, color: '#fff',
                            background: 'transparent', border: `1px solid #ffffff33`, padding: '5px 9px', cursor: 'pointer'
                        }}>
                        {theme === 'light' ? <Moon size={13} /> : <Sun size={13} />} {theme === 'light' ? 'DARK' : 'LIGHT'}
                    </button>
                </div>
            </div>

            {successMsg && (
                <div style={{ margin: '0 16px 12px', background: theme === 'light' ? '#E8F5E9' : '#143A1D', color: theme === 'light' ? '#2E7D46' : '#3FB950', padding: '10px 14px', border: `1px solid ${theme === 'light' ? '#A5D6A7' : '#225B2D'}`, fontFamily: MONO, fontSize: '12px' }}>
                    [SUCCESS] · {successMsg}
                </div>
            )}

            {/* Data Table */}
            <div style={{ margin: '0 16px' }}>
                <DataTable
                    title="ผู้ใช้งานระบบ (System Users)"
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
                    theme={theme}
                />
            </div>

            {/* Create/Edit User Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editId ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}
                size="md"
                theme={theme}
                footer={
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button style={btnStyle('cancel')} onClick={() => setShowModal(false)} disabled={saving}>
                            Cancel
                        </button>
                        <button style={btnStyle('success')} onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
                        </button>
                    </div>
                }
            >
                {formError && (
                    <div style={{ background: '#FEEBEE', color: '#C62828', padding: '10px', border: '1px solid #FFCDD2', fontFamily: MONO, fontSize: '11.5px', marginBottom: '14px' }}>
                        [ERROR] · {formError}
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
                    <div>
                        <label style={labelStyle}>Username <span style={{ color: C.red }}>*</span></label>
                        <input
                            type="text"
                            style={{ ...inputStyle, ...(editId ? { background: C.panel2, cursor: 'not-allowed', opacity: 0.7 } : {}) }}
                            placeholder="Enter username"
                            value={form.userName}
                            onChange={(e) => setForm({ ...form, userName: e.target.value })}
                            disabled={!!editId}
                            autoFocus
                        />
                    </div>

                    <div>
                        <label style={labelStyle}>Display Name</label>
                        <input
                            type="text"
                            style={inputStyle}
                            placeholder="Enter display name"
                            value={form.displayName}
                            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
                    <div>
                        <label style={labelStyle}>Email</label>
                        <input
                            type="email"
                            style={inputStyle}
                            placeholder="Enter email address"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                        />
                    </div>

                    <div>
                        <label style={labelStyle}>User Group</label>
                        <select
                            style={inputStyle}
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
                    <div style={{ marginBottom: '14px' }}>
                        <label style={labelStyle}>Password <span style={{ color: C.red }}>*</span></label>
                        <input
                            type="password"
                            style={inputStyle}
                            placeholder="Minimum 6 characters"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                        />
                    </div>
                )}

                <div>
                    <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={form.isActive}
                            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                            style={{ width: 16, height: 16, accentColor: C.accent }}
                        />
                        Active Status
                    </label>
                </div>
            </Modal>

            {/* Delete Confirmation */}
            <Modal
                isOpen={showDelete}
                onClose={() => setShowDelete(false)}
                title="ยืนยันการลบ"
                size="sm"
                theme={theme}
                footer={
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button style={btnStyle('cancel')} onClick={() => setShowDelete(false)} disabled={deleting}>
                            Cancel
                        </button>
                        <button style={btnStyle('danger')} onClick={handleDeleteConfirm} disabled={deleting}>
                            {deleting ? 'Deleting...' : 'Delete'}
                        </button>
                    </div>
                }
            >
                <div style={{ textAlign: 'center', padding: '12px 0', fontFamily: MONO }}>
                    <div style={{ fontSize: 36, marginBottom: 12, color: C.yellow }}>⚠️</div>
                    <p style={{ fontSize: '13.5px', marginBottom: 8, color: C.ink }}>
                        ARE YOU SURE YOU WANT TO DELETE USER
                    </p>
                    <p style={{ fontSize: '15px', fontWeight: 700, color: C.red, letterSpacing: '0.5px' }}>
                        "{deleteTarget?.user_name}"
                    </p>
                    <p style={{ fontSize: '12.5px', color: C.sub, marginTop: 4 }}>
                        ({deleteTarget?.display_name})
                    </p>
                    <p style={{ fontSize: '11px', color: C.sub, marginTop: 8 }}>
                        THIS ACTION CANNOT BE UNDONE.
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default UsersPage;
