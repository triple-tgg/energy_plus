import React, { useState, useEffect } from 'react';
import { sitesApi, metersApi } from '../../api/client';

export interface FilterValues {
    startDate?: string;
    endDate?: string;
    meterTypeId?: string;
    siteId?: string;
    buildingId?: string;
    zoneId?: string;
    searchMeter?: string;
    month?: string;
    year?: string;
}

interface FilterBarProps {
    onSubmit: (filters: FilterValues) => void;
    showDateRange?: boolean;
    showMonthYear?: boolean;
    showMeterType?: boolean;
    showSite?: boolean;
    showBuilding?: boolean;
    showZone?: boolean;
    showSearchMeter?: boolean;
    loading?: boolean;
    actions?: React.ReactNode;
}

const today = new Date().toISOString().substring(0, 10);

const FilterBar: React.FC<FilterBarProps> = ({
    onSubmit,
    showDateRange = true,
    showMonthYear = false,
    showMeterType = true,
    showSite = true,
    showBuilding = true,
    showZone = true,
    showSearchMeter = false,
    loading = false,
    actions,
}) => {
    const [filters, setFilters] = useState<FilterValues>({
        startDate: today,
        endDate: today,
        meterTypeId: '',
        siteId: '',
        buildingId: '',
        zoneId: '',
        searchMeter: '',
        month: String(new Date().getMonth() + 1),
        year: String(new Date().getFullYear()),
    });

    const [meterTypes, setMeterTypes] = useState<any[]>([]);
    const [sites, setSites] = useState<any[]>([]);
    const [buildings, setBuildings] = useState<any[]>([]);
    const [zones, setZones] = useState<any[]>([]);

    useEffect(() => {
        const loadMaster = async () => {
            try {
                const [typeRes, siteRes] = await Promise.all([
                    metersApi.getTypes(),
                    sitesApi.getAll(),
                ]);
                setMeterTypes(typeRes.data.data || []);
                setSites(siteRes.data.data || []);
            } catch (e) { console.error(e); }
        };
        loadMaster();
    }, []);

    useEffect(() => {
        if (!filters.siteId) { setBuildings([]); setZones([]); return; }
        const loadBuildings = async () => {
            try {
                const res = await sitesApi.getBuildings(Number(filters.siteId));
                setBuildings(res.data.data || []);
            } catch (e) { console.error(e); }
        };
        loadBuildings();
    }, [filters.siteId]);

    useEffect(() => {
        if (!filters.buildingId) { setZones([]); return; }
        const loadZones = async () => {
            try {
                const res = await sitesApi.getZones({ buildingId: filters.buildingId });
                setZones(res.data.data || []);
            } catch (e) { console.error(e); }
        };
        loadZones();
    }, [filters.buildingId]);

    const update = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = () => {
        onSubmit(filters);
    };

    const months = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
    ];

    return (
        <div className="filter-bar">
            <div className="filter-bar__controls">
                {showDateRange && (
                    <>
                        <div className="filter-bar__item">
                            <input
                                type="date"
                                className="form-control form-control-sm"
                                value={filters.startDate}
                                onChange={e => update('startDate', e.target.value)}
                            />
                        </div>
                        <div className="filter-bar__item">
                            <input
                                type="date"
                                className="form-control form-control-sm"
                                value={filters.endDate}
                                onChange={e => update('endDate', e.target.value)}
                            />
                        </div>
                    </>
                )}

                {showMonthYear && (
                    <>
                        <div className="filter-bar__item">
                            <select className="form-control form-control-sm" value={filters.month} onChange={e => update('month', e.target.value)}>
                                {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                            </select>
                        </div>
                        <div className="filter-bar__item">
                            <select className="form-control form-control-sm" value={filters.year} onChange={e => update('year', e.target.value)}>
                                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                    </>
                )}

                {showMeterType && (
                    <div className="filter-bar__item">
                        <select className="form-control form-control-sm" value={filters.meterTypeId} onChange={e => update('meterTypeId', e.target.value)}>
                            <option value="">ทุกประเภท</option>
                            {meterTypes.map((t: any) => (
                                <option key={t.meter_type_id} value={t.meter_type_id}>{t.meter_type_name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {showSite && (
                    <div className="filter-bar__item">
                        <select className="form-control form-control-sm" value={filters.siteId} onChange={e => { update('siteId', e.target.value); update('buildingId', ''); update('zoneId', ''); }}>
                            <option value="">ทุก Site</option>
                            {sites.map((s: any) => (
                                <option key={s.site_id} value={s.site_id}>{s.site_name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {showBuilding && (
                    <div className="filter-bar__item">
                        <select className="form-control form-control-sm" value={filters.buildingId} onChange={e => { update('buildingId', e.target.value); update('zoneId', ''); }}>
                            <option value="">ทุกอาคาร</option>
                            {buildings.map((b: any) => (
                                <option key={b.building_id} value={b.building_id}>{b.building_name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {showZone && (
                    <div className="filter-bar__item">
                        <select className="form-control form-control-sm" value={filters.zoneId} onChange={e => update('zoneId', e.target.value)}>
                            <option value="">ทุกโซน</option>
                            {zones.map((z: any) => (
                                <option key={z.zone_id} value={z.zone_id}>{z.zone_name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {showSearchMeter && (
                    <div className="filter-bar__item">
                        <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Search Meter..."
                            value={filters.searchMeter}
                            onChange={e => update('searchMeter', e.target.value)}
                        />
                    </div>
                )}

                <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={loading}>
                    {loading ? '⏳ กำลังโหลด...' : '🔍 Show Data'}
                </button>

                {actions}
            </div>
        </div>
    );
};

export default FilterBar;
