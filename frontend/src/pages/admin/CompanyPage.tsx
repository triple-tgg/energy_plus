import React, { useEffect, useState } from 'react';
import { companyApi } from '../../api/client';
import { LayoutGrid, Moon, Sun, Shield, Lock, Save, X, Pencil } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

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
}

const THEMES: Record<'light' | 'dark', Theme> = {
    light: {
        bg: '#EAE7DA', panel: '#FBFAF4', panel2: '#F1EFE3', ink: '#23261E', sub: '#6E705F',
        line: '#D4D1C0', bar: '#23261E', barSub: '#A6A892', accent: '#2B4C7E',
        yellow: '#C08A1E', grey: '#9AA08C',
    },
    dark: {
        bg: '#0E1116', panel: '#161B22', panel2: '#1C232E', ink: '#E6EDF3', sub: '#8B98A6',
        line: '#2A313C', bar: '#080A0E', barSub: '#8B98A6', accent: '#36C2CE',
        yellow: '#D29922', grey: '#6E7681',
    },
};

const CompanyPage: React.FC = () => {
    const [company, setCompany] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({ companyName: '', address: '', contactName: '', contactPhone: '', domain: '' });
    const { theme, toggleTheme } = useTheme();
    const C = THEMES[theme];

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

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', fontFamily: MONO, color: C.sub }}>LOADING CONSOLE...</div>;

    const inputStyle = (disabled: boolean): React.CSSProperties => ({
        width: '100%',
        padding: '10px 12px',
        background: disabled ? C.panel2 : C.panel,
        color: C.ink,
        border: `1px solid ${C.line}`,
        fontFamily: MONO,
        fontSize: '13.5px',
        borderRadius: 0,
        outline: 'none',
        boxSizing: 'border-box',
    });

    const labelStyle: React.CSSProperties = {
        display: 'block',
        fontFamily: MONO,
        fontSize: '10.5px',
        fontWeight: 700,
        letterSpacing: '0.8px',
        color: C.sub,
        marginBottom: '6px',
        textTransform: 'uppercase',
    };

    const btnStyle = (active: boolean, type: 'primary' | 'cancel' | 'success'): React.CSSProperties => {
        let bg = C.panel;
        let color = C.ink;
        let border = `1px solid ${C.line}`;
        
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
        }
        
        return {
            fontFamily: MONO,
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '1px',
            padding: '8px 16px',
            background: bg,
            color: color,
            border: border,
            borderRadius: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'opacity 0.1s',
            textTransform: 'uppercase',
        };
    };

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
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>ADMIN // COMPANY</div>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>ตั้งค่าข้อมูลและรายละเอียดผู้ใช้งานระดับบริษัท</div>
                    </div>
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', fontFamily: MONO, fontSize: 11.5 }}>
                    <button onClick={toggleTheme}
                        title={theme === 'light' ? 'สลับเป็นโหมดมืด (Control Room)' : 'สลับเป็นโหมดสว่าง (Engineering Paper)'}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 5, fontFamily: MONO, fontSize: 11, color: '#fff',
                            background: 'transparent', border: `1px solid #ffffff33`, padding: '5px 9px', cursor: 'pointer'
                        }}>
                        {theme === 'light' ? <Moon size={13} /> : <Sun size={13} />} {theme === 'light' ? 'DARK' : 'LIGHT'}
                    </button>
                </div>
            </div>

            {/* Panel */}
            <div style={{ margin: '0 16px' }}>
                <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: '0px', boxSizing: 'border-box' }}>
                    {/* Panel Header */}
                    <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.line}`, background: C.panel2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Shield size={14} color={C.accent} />
                            <span style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: 1, fontWeight: 700 }}>COMPANY CONFIGURATION</span>
                        </div>
                        <div>
                            {!editing ? (
                                <button style={btnStyle(true, 'primary')} onClick={() => setEditing(true)}><Pencil size={12} /> Edit</button>
                            ) : (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button style={btnStyle(true, 'success')} onClick={handleSave}><Save size={12} /> Save</button>
                                    <button style={btnStyle(true, 'cancel')} onClick={() => setEditing(false)}><X size={12} /> Cancel</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Panel Body */}
                    <div style={{ padding: '20px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                            <div>
                                <label style={labelStyle}>Company Name</label>
                                <input style={inputStyle(!editing)} value={form.companyName} disabled={!editing} onChange={e => setForm({ ...form, companyName: e.target.value })} />
                            </div>
                            <div>
                                <label style={labelStyle}>Domain</label>
                                <input style={inputStyle(!editing)} value={form.domain} disabled={!editing} onChange={e => setForm({ ...form, domain: e.target.value })} />
                            </div>
                        </div>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={labelStyle}>Address</label>
                            <input style={inputStyle(!editing)} value={form.address} disabled={!editing} onChange={e => setForm({ ...form, address: e.target.value })} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div>
                                <label style={labelStyle}>Contact Name</label>
                                <input style={inputStyle(!editing)} value={form.contactName} disabled={!editing} onChange={e => setForm({ ...form, contactName: e.target.value })} />
                            </div>
                            <div>
                                <label style={labelStyle}>Contact Phone</label>
                                <input style={inputStyle(!editing)} value={form.contactPhone} disabled={!editing} onChange={e => setForm({ ...form, contactPhone: e.target.value })} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompanyPage;
