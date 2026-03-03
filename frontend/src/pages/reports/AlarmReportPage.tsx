import React, { useState, useCallback } from 'react';
import FilterBar from '../../components/ui/FilterBar';
import type { FilterValues } from '../../components/ui/FilterBar';
import DataTable from '../../components/ui/DataTable';
import { reportsApi } from '../../api/client';

const AlarmReportPage: React.FC = () => {
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
                    <span className="badge badge-success">Acknowledged</span>
                ) : (
                    <button
                        className="btn btn-sm"
                        style={{ background: '#f59e0b', color: 'white', border: 'none', fontWeight: 600 }}
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
            {successMsg && <div className="toast-success">✅ {successMsg}</div>}
            <h1 className="page-title"><span className="page-title__icon">🔔</span>ข้อมูลการแจ้งเตือน</h1>
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
