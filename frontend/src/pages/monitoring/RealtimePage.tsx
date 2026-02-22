import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import { meterDataApi } from '../../api/client';

const RealtimePage: React.FC = () => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await meterDataApi.getRealtime();
            setData(res.data.data || []);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // refresh every 30s
        return () => clearInterval(interval);
    }, [fetchData]);

    const columns = [
        { key: 'meter_code', title: 'Code' },
        { key: 'meter_name', title: 'Meter' },
        { key: 'zone_name', title: 'Zone' },
        { key: 'building_name', title: 'Building' },
        { key: 'energy_kwh', title: 'kWh', render: (v: number) => v?.toFixed(2) ?? '-' },
        { key: 'energy_kw', title: 'kW', render: (v: number) => v?.toFixed(2) ?? '-' },
        { key: 'energy_kva', title: 'kVA', render: (v: number) => v?.toFixed(2) ?? '-' },
        { key: 'energy_frequency', title: 'Hz', render: (v: number) => v?.toFixed(1) ?? '-' },
        {
            key: 'status', title: 'Status',
            render: (v: string) => {
                const color = v === 'online' ? 'badge-success' : v === 'warning' ? 'badge-warning' : 'badge-danger';
                return <span className={`badge ${color}`}>{v || 'Unknown'}</span>;
            },
        },
        {
            key: 'date_keep', title: 'Last Update',
            render: (v: string) => v ? new Date(v).toLocaleString('en-GB') : '-',
        },
    ];

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700 }}>📡 Realtime Monitoring</h2>
                <button className="btn btn-primary" onClick={fetchData}>🔄 Refresh</button>
            </div>
            <DataTable
                title="ข้อมูลการใช้พลังงาน Realtime"
                columns={columns}
                data={data}
                total={data.length}
                page={1}
                limit={data.length || 10}
                loading={loading}
            />
        </div>
    );
};

export default RealtimePage;
