import React, { useEffect, useState } from 'react';
import { companyApi } from '../../api/client';

const CompanyPage: React.FC = () => {
    const [company, setCompany] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({ companyName: '', address: '', contactName: '', contactPhone: '', domain: '' });

    useEffect(() => {
        (async () => {
            try {
                const res = await companyApi.get();
                const d = res.data.data;
                if (d) {
                    setCompany(d);
                    setForm({ companyName: d.company_name || '', address: d.address || '', contactName: d.contact_name || '', contactPhone: d.contact_phone || '', domain: d.domain || '' });
                }
            } catch (e) { console.error(e); }
            setLoading(false);
        })();
    }, []);

    const handleSave = async () => {
        try {
            await companyApi.update(form);
            setEditing(false);
            alert('บันทึกข้อมูลบริษัทเรียบร้อย');
        } catch (e) { console.error(e); }
    };

    if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

    return (
        <div className="card">
            <div className="card-header">
                <h2 className="card-title">ข้อมูลบริษัท (Company Information)</h2>
                {!editing ? (
                    <button className="btn btn-primary" onClick={() => setEditing(true)}>Edit</button>
                ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-success" onClick={handleSave}>Save</button>
                        <button className="btn btn-outline" onClick={() => setEditing(false)}>Cancel</button>
                    </div>
                )}
            </div>
            <div className="card-body">
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Company Name</label>
                        <input className="form-control" value={form.companyName} disabled={!editing} onChange={e => setForm({ ...form, companyName: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Domain</label>
                        <input className="form-control" value={form.domain} disabled={!editing} onChange={e => setForm({ ...form, domain: e.target.value })} />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">Address</label>
                    <input className="form-control" value={form.address} disabled={!editing} onChange={e => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Contact Name</label>
                        <input className="form-control" value={form.contactName} disabled={!editing} onChange={e => setForm({ ...form, contactName: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Contact Phone</label>
                        <input className="form-control" value={form.contactPhone} disabled={!editing} onChange={e => setForm({ ...form, contactPhone: e.target.value })} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompanyPage;
