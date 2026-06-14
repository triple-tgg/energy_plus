import React, { useState, useCallback } from 'react';
import FilterBar from '../../components/ui/FilterBar';
import type { FilterValues } from '../../components/ui/FilterBar';
import DataTable from '../../components/ui/DataTable';
import { reportsApi } from '../../api/client';
import { LayoutGrid } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, "Cascadia Mono", monospace';

const THEMES = {
    light: {
        bg: '#EAE7DA', panel: '#FBFAF4', panel2: '#F1EFE3', ink: '#23261E', sub: '#6E705F',
        line: '#D4D1C0', bar: '#23261E', barSub: '#A6A892', accent: '#2B4C7E',
        yellow: '#C08A1E',
    },
    dark: {
        bg: '#0E1116', panel: '#161B22', panel2: '#1C232E', ink: '#E6EDF3', sub: '#8B98A6',
        line: '#2A313C', bar: '#080A0E', barSub: '#8B98A6', accent: '#36C2CE',
        yellow: '#D29922',
    },
};

const AlarmReportPage: React.FC = () => {
    const { theme } = useTheme();
    const C = THEMES[theme];
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const fetchData = useCallback(async (filters: FilterValues) => {
        setLoading(true);
        try {
            const res = await reportsApi.getAlarms({
                startDate: filters.startDate,
                endDate: filters.endDate,
                page, limit,
            });
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [page, limit]);

    const handleAcknowledge = async (row: any) => {
        try {
            await reportsApi.acknowledgeAlarm(row.id);
            setSuccessMsg('Acknowledge สำเร็จ!');
            // Refresh current data
            setData(prev => prev.map(d => d.id === row.id ? { ...d, acknowledged: true, acknowledged_at: new Date().toISOString() } : d));
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            alert('Acknowledge failed');
        }
    };

    const columns = [
        {
            key: 'alarm_date', title: 'วันที่',
            render: (v: string) => v ? new Date(v).toLocaleDateString('th-TH') : '—',
        },
        {
            key: 'message', title: 'ข้อความแจ้งเตือน',
            render: (v: string) => <span style={{ fontSize: 13, maxWidth: 400, display: 'inline-block' }}>{v || '—'}</span>,
        },
        {
            key: 'occurred_at', title: 'วันเวลาที่เกิด',
            render: (v: string) => v ? new Date(v).toLocaleString('th-TH') : '—',
        },
        { key: 'alarm_type', title: 'ประเภท' },
        {
            key: 'resolved_at', title: 'วันเวลาที่แก้ไข',
            render: (v: string) => v ? new Date(v).toLocaleString('th-TH') : '—',
        },
        { key: 'resolved_by', title: 'ผู้แก้ไข' },
        {
            key: 'actions', title: 'จัดการ',
            render: (_: any, row: any) => (
                row.acknowledged ? (
                    <span className="badge badge-success" style={{ fontFamily: MONO, borderRadius: 0 }}>Acknowledged</span>
                ) : (
                    <button
                        className="btn btn-sm"
                        style={{ background: C.yellow, color: '#fff', border: 'none', fontWeight: 700, fontFamily: MONO, borderRadius: 0 }}
                        onClick={() => handleAcknowledge(row)}
                    >
                        Acknowledge
                    </button>
                )
            ),
        },
    ];

    return (
        <div>
            {successMsg && <div className="toast-success" style={{ fontFamily: MONO, borderRadius: 0 }}>✅ {successMsg}</div>}
            {/* Command bar */}
            <div style={{ background: C.bar, color: '#fff', display: 'flex', alignItems: 'stretch', borderBottom: `2px solid ${C.accent}`, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}><LayoutGrid size={16} /></div>
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>REPORTS // ALARMS</div>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>ประวัติรายการตรวจสอบและการรายงานสัญญาณเตือน (Alarm Notifications)</div>
                    </div>
                </div>
            </div>
            <FilterBar
                onSubmit={fetchData}
                loading={loading}
                showMeterType={false}
                showSite={false}
                showBuilding={false}
                showZone={false}
            />
            <DataTable title="ข้อมูลการแจ้งเตือน" columns={columns} data={data} total={total} page={page} limit={limit} loading={loading} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />
        </div>
    );
};

export default AlarmReportPage;
