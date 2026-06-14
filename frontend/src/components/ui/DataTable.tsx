import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, "Cascadia Mono", monospace';

interface Column {
    key: string;
    title: string;
    render?: (value: any, row: any) => React.ReactNode;
}

interface DataTableProps {
    title: string;
    columns: Column[];
    data: any[];
    total?: number;
    page?: number;
    limit?: number;
    onPageChange?: (page: number) => void;
    onLimitChange?: (limit: number) => void;
    onSearch?: (search: string) => void;
    onCreate?: () => void;
    createLabel?: string;
    loading?: boolean;
    theme?: 'light' | 'dark';
}

const THEMES = {
    light: {
        bg: '#EAE7DA', panel: '#FBFAF4', panel2: '#F1EFE3', ink: '#23261E', sub: '#6E705F',
        line: '#D4D1C0', bar: '#23261E', barSub: '#A6A892', accent: '#2B4C7E',
    },
    dark: {
        bg: '#0E1116', panel: '#161B22', panel2: '#1C232E', ink: '#E6EDF3', sub: '#8B98A6',
        line: '#2A313C', bar: '#080A0E', barSub: '#8B98A6', accent: '#36C2CE',
    },
};

const DataTable: React.FC<DataTableProps> = ({
    title, columns, data, total = 0, page = 1, limit = 10,
    onPageChange, onLimitChange, onSearch, onCreate, createLabel = 'Create New',
    loading = false, theme
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const { theme: globalTheme } = useTheme();
    const activeTheme = theme || globalTheme;
    const C = THEMES[activeTheme];

    const totalPages = Math.ceil(total / limit) || 1;
    const from = data.length > 0 ? (page - 1) * limit + 1 : 0;
    const to = Math.min(page * limit, total);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        onSearch?.(e.target.value);
    };

    const inputStyle: React.CSSProperties = {
        padding: '6px 10px',
        background: C.panel,
        color: C.ink,
        border: `1px solid ${C.line}`,
        fontFamily: MONO,
        fontSize: '12.5px',
        borderRadius: 0,
        outline: 'none',
    };

    const btnStyle = (type: 'primary' | 'outline'): React.CSSProperties => ({
        fontFamily: MONO,
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '1px',
        padding: '7px 12px',
        background: type === 'primary' ? C.accent : C.panel,
        color: type === 'primary' ? '#fff' : C.sub,
        border: type === 'primary' ? 'none' : `1px solid ${C.line}`,
        borderRadius: 0,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        textTransform: 'uppercase',
    });

    return (
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: 0, borderRadius: 0 }}>
            {/* Header */}
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.line}`, background: C.panel2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <h2 style={{ fontFamily: MONO, fontSize: '13px', fontWeight: 700, letterSpacing: '1px', color: C.ink, margin: 0, textTransform: 'uppercase' }}>{title}</h2>
                    <span style={{ fontFamily: MONO, fontSize: '10.5px', color: C.sub }}>[{total} RECORDS]</span>
                </div>
                <div>
                    {onCreate && (
                        <button style={btnStyle('primary')} onClick={onCreate}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            {createLabel}
                        </button>
                    )}
                </div>
            </div>

            {/* Toolbar */}
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: '11.5px', color: C.sub }}>
                    <span>SHOW</span>
                    <select value={limit} onChange={e => onLimitChange?.(parseInt(e.target.value))} style={{ ...inputStyle, padding: '3px 6px' }}>
                        {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <span>ENTRIES</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={handleSearch}
                        style={{ ...inputStyle, paddingLeft: '28px' }}
                    />
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div style={{ padding: '40px 0', textAlign: 'center', fontFamily: MONO, fontSize: '13px', color: C.sub }}>
                    LOADING CONSOLE DATA...
                </div>
            ) : (
                <div style={{ overflowX: 'auto', width: '100%' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                            <tr style={{ background: C.bar, color: '#fff', fontFamily: MONO, textAlign: 'left' }}>
                                <th style={{ padding: '8px 11px', fontWeight: 700, fontSize: '10.5px', letterSpacing: '1px', width: '50px' }}>#</th>
                                {columns.map(col => (
                                    <th key={col.key} style={{ padding: '8px 11px', fontWeight: 700, fontSize: '10.5px', letterSpacing: '1px' }}>{col.title.toUpperCase()}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length + 1} style={{ padding: '30px 0', textAlign: 'center', color: C.sub, background: C.panel2 }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                                                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                                                <polyline points="13 2 13 9 20 9" />
                                            </svg>
                                            <span style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.5px' }}>NO RECORDS AVAILABLE</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                data.map((row, idx) => (
                                    <tr key={idx} style={{ borderBottom: `1px solid ${C.line}`, background: idx % 2 === 0 ? 'transparent' : C.panel2 }} className="ec-row-admin">
                                        <td style={{ padding: '10px 11px', color: C.sub, fontFamily: MONO }}>{String((page - 1) * limit + idx + 1).padStart(2, '0')}</td>
                                        {columns.map(col => (
                                            <td key={col.key} style={{ padding: '10px 11px', color: C.ink }}>
                                                {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Footer */}
            <div style={{ padding: '12px 14px', borderTop: `1px solid ${C.line}`, background: C.panel2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ fontFamily: MONO, fontSize: '11px', color: C.sub }}>
                    {data.length > 0 ? (
                        <>SHOWING <b>{from}</b> TO <b>{to}</b> OF <b>{total}</b> ENTRIES</>
                    ) : 'NO ENTRIES TO SHOW'}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                    <button
                        style={{ ...btnStyle('outline'), padding: '4px 8px' }}
                        disabled={page <= 1}
                        onClick={() => onPageChange?.(page - 1)}
                    >
                        PREV
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                        .map((p, idx, arr) => {
                            const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                            return (
                                <React.Fragment key={p}>
                                    {showEllipsis && <span style={{ padding: '4px 8px', color: C.sub, fontFamily: MONO }}>...</span>}
                                    <button
                                        style={{
                                            ...btnStyle(p === page ? 'primary' : 'outline'),
                                            padding: '4px 8px',
                                            fontWeight: p === page ? 700 : 400
                                        }}
                                        onClick={() => onPageChange?.(p)}
                                    >
                                        {p}
                                    </button>
                                </React.Fragment>
                            );
                        })}
                    <button
                        style={{ ...btnStyle('outline'), padding: '4px 8px' }}
                        disabled={page >= totalPages}
                        onClick={() => onPageChange?.(page + 1)}
                    >
                        NEXT
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DataTable;
