import React, { useState } from 'react';

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
}

const DataTable: React.FC<DataTableProps> = ({
    title, columns, data, total = 0, page = 1, limit = 10,
    onPageChange, onLimitChange, onSearch, onCreate, createLabel = 'Create New',
    loading = false,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const totalPages = Math.ceil(total / limit) || 1;
    const from = data.length > 0 ? (page - 1) * limit + 1 : 0;
    const to = Math.min(page * limit, total);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        onSearch?.(e.target.value);
    };

    return (
        <div className="dt">
            {/* Header */}
            <div className="dt__header">
                <div className="dt__header-left">
                    <h2 className="dt__title">{title}</h2>
                    <span className="dt__count">{total} records</span>
                </div>
                <div className="dt__header-right">
                    {onCreate && (
                        <button className="dt__create-btn" onClick={onCreate}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            {createLabel}
                        </button>
                    )}
                </div>
            </div>

            {/* Toolbar */}
            <div className="dt__toolbar">
                <div className="dt__per-page">
                    <span>Show</span>
                    <select value={limit} onChange={e => onLimitChange?.(parseInt(e.target.value))}>
                        {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <span>entries</span>
                </div>
                <div className="dt__search">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={handleSearch}
                    />
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="dt__loading">
                    <div className="dt__loading-spinner" />
                    <span>Loading data...</span>
                </div>
            ) : (
                <div className="dt__table-wrap">
                    <table className="dt__table">
                        <thead>
                            <tr>
                                <th className="dt__th-num">#</th>
                                {columns.map(col => (
                                    <th key={col.key}>{col.title}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length + 1} className="dt__empty">
                                        <div className="dt__empty-content">
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
                                                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                                                <polyline points="13 2 13 9 20 9" />
                                            </svg>
                                            <span>No data available</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                data.map((row, idx) => (
                                    <tr key={idx}>
                                        <td className="dt__td-num">{(page - 1) * limit + idx + 1}</td>
                                        {columns.map(col => (
                                            <td key={col.key}>
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
            <div className="dt__footer">
                <div className="dt__info">
                    {data.length > 0 ? (
                        <>Showing <strong>{from}</strong> to <strong>{to}</strong> of <strong>{total}</strong> entries</>
                    ) : 'No entries to show'}
                </div>
                <div className="dt__pagination">
                    <button
                        className="dt__page-btn"
                        disabled={page <= 1}
                        onClick={() => onPageChange?.(page - 1)}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let p: number;
                        if (totalPages <= 5) { p = i + 1; }
                        else if (page <= 3) { p = i + 1; }
                        else if (page >= totalPages - 2) { p = totalPages - 4 + i; }
                        else { p = page - 2 + i; }
                        if (p > totalPages || p < 1) return null;
                        return (
                            <button
                                key={p}
                                className={`dt__page-btn ${p === page ? 'dt__page-btn--active' : ''}`}
                                onClick={() => onPageChange?.(p)}
                            >
                                {p}
                            </button>
                        );
                    })}
                    <button
                        className="dt__page-btn"
                        disabled={page >= totalPages}
                        onClick={() => onPageChange?.(page + 1)}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DataTable;
