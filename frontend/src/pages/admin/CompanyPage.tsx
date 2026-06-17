import React, { useEffect, useState } from 'react';
import { companyApi } from '../../api/client';
import { Shield, Save, X, Pencil } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

const CompanyPage: React.FC = () => {
    const { t } = useLanguage();
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
                    setForm({
                        companyName: d.company_name || '',
                        address: d.address || '',
                        contactName: d.contact_name || '',
                        contactPhone: d.contact_phone || '',
                        domain: d.domain || ''
                    });
                }
            } catch (e) { console.error(e); }
            setLoading(false);
        })();
    }, []);

    const handleSave = async () => {
        try {
            await companyApi.update(form);
            setEditing(false);
            alert(t('บันทึกข้อมูลบริษัทสำเร็จ', 'Company information saved successfully'));
        } catch (e) { console.error(e); }
    };

    if (loading) return <div className="text-center" style={{ padding: '40px' }}>{t('กำลังโหลด...', 'Loading...')}</div>;

    return (
        <div>
            {/* Title / Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700 }}>{t('ข้อมูลบริษัท', 'Company Information')}</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>{t('จัดการข้อมูลและผู้ติดต่อของบริษัท', 'Manage company details and contact information')}</p>
                </div>
            </div>

            {/* Panel */}
            <div className="card">
                {/* Panel Header */}
                <div className="card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Shield size={18} color="var(--accent)" />
                        <span style={{ fontSize: '15px', fontWeight: 700 }}>{t('ข้อมูลทั่วไป', 'General Information')}</span>
                    </div>
                    <div>
                        {!editing ? (
                            <button className="btn btn-primary" onClick={() => setEditing(true)}>
                                <Pencil size={14} /> {t('แก้ไข', 'Edit')}
                            </button>
                        ) : (
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-success" onClick={handleSave}>
                                    <Save size={14} /> {t('บันทึก', 'Save')}
                                </button>
                                <button className="btn btn-outline" onClick={() => setEditing(false)}>
                                    <X size={14} /> {t('ยกเลิก', 'Cancel')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Panel Body */}
                <div className="card-body">
                    <div className="form-row" style={{ marginBottom: '20px' }}>
                        <div className="form-group">
                            <label className="form-label">{t('ชื่อบริษัท', 'Company Name')}</label>
                            <input className="form-control" value={form.companyName} disabled={!editing} onChange={e => setForm({ ...form, companyName: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('โดเมน', 'Domain')}</label>
                            <input className="form-control" value={form.domain} disabled={!editing} onChange={e => setForm({ ...form, domain: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: '20px' }}>
                        <label className="form-label">{t('ที่อยู่', 'Address')}</label>
                        <input className="form-control" value={form.address} disabled={!editing} onChange={e => setForm({ ...form, address: e.target.value })} />
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">{t('ผู้ติดต่อ', 'Contact Person')}</label>
                            <input className="form-control" value={form.contactName} disabled={!editing} onChange={e => setForm({ ...form, contactName: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('เบอร์โทรศัพท์ผู้ติดต่อ', 'Contact Phone')}</label>
                            <input className="form-control" value={form.contactPhone} disabled={!editing} onChange={e => setForm({ ...form, contactPhone: e.target.value })} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompanyPage;
