import React, { useEffect, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { layoutsApi, meterDataApi } from '../../api/client';
import { LayoutGrid, ZoomIn, ZoomOut, Maximize2, X } from 'lucide-react';

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, "Cascadia Mono", monospace';

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

const POINT_TYPES: Record<string, { icon: string; color: string; label: string }> = {
    meter: { icon: '⚡', color: '#F59E0B', label: 'Meter' },
    sensor: { icon: '📡', color: '#3B82F6', label: 'Sensor' },
    gen: { icon: '🔋', color: '#10B981', label: 'Generator' },
    ups: { icon: '🔌', color: '#EF4444', label: 'UPS' },
};

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 5;
const ZOOM_STEP = 0.25;

/** Meter data fields to display in popup */
const METER_FIELDS: { key: string; label: string; unit?: string }[] = [
    { key: 'energy_kva', label: 'Kva' },
    { key: 'energy_kw', label: 'Kw' },
    { key: 'energy_kvar', label: 'Kvar' },
    { key: 'energy_frequency', label: 'Frequency', unit: 'Hz' },
    { key: 'energy_kwh', label: 'KWh' },
    { key: 'energy_volt_p1', label: 'VoltP1', unit: 'V' },
    { key: 'energy_volt_p2', label: 'VoltP2', unit: 'V' },
    { key: 'energy_volt_p3', label: 'VoltP3', unit: 'V' },
    { key: 'energy_amp1', label: 'Amp1', unit: 'A' },
    { key: 'energy_amp2', label: 'Amp2', unit: 'A' },
    { key: 'energy_amp3', label: 'Amp3', unit: 'A' },
    { key: 'energy_pf1', label: 'Pf1' },
    { key: 'energy_pf2', label: 'Pf2' },
    { key: 'energy_pf3', label: 'Pf3' },
];

interface LayoutPoint {
    id: number;
    layout_id: number;
    point_type: string;
    label: string;
    x_percent: number;
    y_percent: number;
    meter_id: number | null;
    meter_name?: string;
    meter_code?: string;
}

const LayoutViewPage: React.FC = () => {
    const { theme } = useTheme();
    const C = THEMES[theme];

    const [layouts, setLayouts] = useState<any[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [selectedLayout, setSelectedLayout] = useState<any>(null);
    const [points, setPoints] = useState<LayoutPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

    // Zoom state
    const [zoom, setZoom] = useState(1);

    // Meter popup state
    const [popupPoint, setPopupPoint] = useState<LayoutPoint | null>(null);
    const [meterData, setMeterData] = useState<any>(null);
    const [meterLoading, setMeterLoading] = useState(false);

    // Load all layouts
    useEffect(() => {
        (async () => {
            try {
                const res = await layoutsApi.getAll({ limit: 100 });
                const items = res.data.data || [];
                setLayouts(items);
                if (items.length > 0) setSelectedId(items[0].id);
            } catch (err) { console.error(err); }
            setLoading(false);
        })();
    }, []);

    // Load points when layout changes
    useEffect(() => {
        if (!selectedId) return;
        setZoom(1);
        setPopupPoint(null);
        (async () => {
            try {
                const [layoutRes, pointsRes] = await Promise.all([
                    layoutsApi.getById(selectedId),
                    layoutsApi.getPoints(selectedId),
                ]);
                setSelectedLayout(layoutRes.data.data);
                setPoints((pointsRes.data.data || []).map((pt: any) => ({
                    ...pt,
                    x_percent: parseFloat(pt.x_percent) || 0,
                    y_percent: parseFloat(pt.y_percent) || 0,
                })));
            } catch (err) {
                console.error(err);
                setSelectedLayout(null);
                setPoints([]);
            }
        })();
    }, [selectedId]);

    // Zoom handlers
    const handleZoomIn = () => setZoom(z => Math.min(ZOOM_MAX, z + ZOOM_STEP));
    const handleZoomOut = () => setZoom(z => Math.max(ZOOM_MIN, z - ZOOM_STEP));
    const handleZoomReset = () => setZoom(1);

    // Point click — fetch meter realtime data
    const handlePointClick = async (pt: LayoutPoint) => {
        setPopupPoint(pt);
        setMeterData(null);

        if (!pt.meter_id) {
            // No linked meter — just show point info
            setMeterData(null);
            return;
        }

        setMeterLoading(true);
        try {
            const res = await meterDataApi.getRealtime({ meter_id: pt.meter_id });
            const rows = res.data.data || [];
            // Find the matching meter row
            const match = rows.find((r: any) => r.meter_id === pt.meter_id) || rows[0] || null;
            setMeterData(match);
        } catch (err) {
            console.error(err);
            setMeterData(null);
        }
        setMeterLoading(false);
    };

    // Count by type
    const typeCounts = points.reduce((acc, pt) => {
        acc[pt.point_type] = (acc[pt.point_type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const zoomPercent = Math.round(zoom * 100);

    return (
        <div style={{ color: C.ink, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
            {/* Command Bar */}
            <div style={{
                background: C.bar, padding: '10px 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: `2px solid ${C.accent}`, flexShrink: 0,
                flexWrap: 'wrap', gap: 8,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}><LayoutGrid size={16} /></div>
                    <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '1px', textTransform: 'uppercase' }}>
                        แผนผังสถานที่
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: C.barSub || C.sub }}>
                        Single Line Diagram / Layout View
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <label style={{ fontFamily: MONO, fontSize: 11, color: C.barSub || C.sub }}>เลือกแผนผัง:</label>
                    <select value={selectedId || ''} onChange={e => setSelectedId(parseInt(e.target.value, 10))}
                        style={{ padding: '5px 10px', fontFamily: MONO, fontSize: 12, background: C.panel2, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 4, outline: 'none', minWidth: 200 }}>
                        {layouts.map(l => (<option key={l.id} value={l.id}>{l.name}</option>))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 60, fontFamily: MONO, color: C.sub }}>
                    <div style={{ fontSize: 24, marginBottom: 12 }}>⏳</div>
                    กำลังโหลด...
                </div>
            ) : layouts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 24px', fontFamily: MONO, color: C.sub }}>
                    <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>🗺️</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>ยังไม่มีแผนผัง</div>
                    <div style={{ fontSize: 11, marginTop: 6 }}>ไปที่ Settings → ตั้งค่าแผนผัง เพื่อสร้างแผนผังใหม่</div>
                </div>
            ) : selectedLayout ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px 16px 16px' }}>
                    {/* Top bar: Legend + Zoom Controls */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center', flexShrink: 0 }}>
                        {/* Legend */}
                        <div style={{
                            flex: 1, display: 'flex', gap: 12, padding: '8px 16px',
                            background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, alignItems: 'center',
                            flexWrap: 'wrap', minWidth: 0,
                        }}>
                            <span style={{ fontFamily: MONO, fontSize: 10, color: C.sub, textTransform: 'uppercase', letterSpacing: '1px' }}>อุปกรณ์:</span>
                            {Object.entries(POINT_TYPES).map(([key, info]) => (
                                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: info.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{info.icon}</span>
                                    <span style={{ fontFamily: MONO, fontSize: 11, color: C.ink }}>{info.label}</span>
                                    <span style={{ fontFamily: MONO, fontSize: 10, color: C.sub, background: C.panel2, padding: '1px 6px', borderRadius: 8, border: `1px solid ${C.line}` }}>{typeCounts[key] || 0}</span>
                                </div>
                            ))}
                            <div style={{ flex: 1 }} />
                            <span style={{ fontFamily: MONO, fontSize: 10, color: C.sub }}>รวม {points.length} จุด</span>
                        </div>

                        {/* Zoom Controls */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: '4px 8px',
                        }}>
                            <button onClick={handleZoomOut} title="ซูมออก (−)"
                                style={{ background: 'transparent', border: `1px solid ${C.line}`, borderRadius: 4, width: 30, height: 30, display: 'grid', placeItems: 'center', cursor: 'pointer', color: C.ink, transition: 'all 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = C.panel2; e.currentTarget.style.borderColor = C.accent; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = C.line; }}>
                                <ZoomOut size={16} />
                            </button>
                            <div style={{
                                fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.ink,
                                minWidth: 48, textAlign: 'center', padding: '0 4px',
                                background: C.panel2, borderRadius: 4, lineHeight: '28px',
                                border: `1px solid ${C.line}`,
                            }}>{zoomPercent}%</div>
                            <button onClick={handleZoomIn} title="ซูมเข้า (+)"
                                style={{ background: 'transparent', border: `1px solid ${C.line}`, borderRadius: 4, width: 30, height: 30, display: 'grid', placeItems: 'center', cursor: 'pointer', color: C.ink, transition: 'all 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = C.panel2; e.currentTarget.style.borderColor = C.accent; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = C.line; }}>
                                <ZoomIn size={16} />
                            </button>
                            <div style={{ width: 1, height: 20, background: C.line, margin: '0 4px' }} />
                            <button onClick={handleZoomReset} title="รีเซ็ตซูม (100%)"
                                style={{ background: 'transparent', border: `1px solid ${C.line}`, borderRadius: 4, width: 30, height: 30, display: 'grid', placeItems: 'center', cursor: 'pointer', color: C.ink, transition: 'all 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = C.panel2; e.currentTarget.style.borderColor = C.accent; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = C.line; }}>
                                <Maximize2 size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Layout Image + Points — zoom contained in this box */}
                    <div style={{
                        flex: 1, overflow: 'auto', position: 'relative',
                        background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6,
                    }}>
                        <div style={{
                            width: `${zoom * 100}%`,
                            minHeight: zoom > 1 ? `${zoom * 100}%` : '100%',
                            padding: 12,
                            position: 'relative',
                            transition: 'width 0.2s ease, min-height 0.2s ease',
                        }}>
                            <div style={{
                                position: 'relative', display: 'inline-block',
                                width: '100%',
                            }}>
                                <img src={selectedLayout.image_url} alt={selectedLayout.name}
                                    style={{
                                        width: '100%',
                                        objectFit: 'contain', display: 'block',
                                        border: `2px solid ${C.line}`, userSelect: 'none',
                                    }}
                                    draggable={false} />

                                {/* Points */}
                                {points.map((pt, idx) => {
                                    const info = POINT_TYPES[pt.point_type] || POINT_TYPES.meter;
                                    const isHovered = hoveredPoint === idx;
                                    const isActive = popupPoint?.id === pt.id;
                                    const pointScale = Math.max(0.5, Math.min(1.5, 1 / Math.sqrt(zoom)));
                                    return (
                                        <div key={pt.id}
                                            style={{
                                                position: 'absolute', left: `${pt.x_percent}%`, top: `${pt.y_percent}%`,
                                                transform: `translate(-50%, -50%) scale(${pointScale})`,
                                                zIndex: isHovered || isActive ? 20 : 10, cursor: 'pointer',
                                            }}
                                            onMouseEnter={() => setHoveredPoint(idx)}
                                            onMouseLeave={() => setHoveredPoint(null)}
                                            onClick={() => handlePointClick(pt)}>
                                            {/* Pulse */}
                                            {(isHovered || isActive) && (
                                                <div style={{
                                                    position: 'absolute', inset: -6, borderRadius: '50%',
                                                    border: `2px solid ${info.color}`,
                                                    animation: 'pulse-ring 1s ease-out infinite', opacity: 0.6,
                                                }} />
                                            )}
                                            {/* Circle */}
                                            <div style={{
                                                width: isHovered || isActive ? 38 : 32, height: isHovered || isActive ? 38 : 32,
                                                borderRadius: '50%', background: info.color,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: isHovered || isActive ? 18 : 16, lineHeight: 1,
                                                border: isActive ? '3px solid #fff' : `2px solid ${theme === 'dark' ? '#000' : '#fff'}`,
                                                boxShadow: isHovered || isActive
                                                    ? `0 0 12px ${info.color}80, 0 4px 12px rgba(0,0,0,0.4)`
                                                    : '0 2px 6px rgba(0,0,0,0.3)',
                                                transition: 'all 0.2s ease', userSelect: 'none',
                                            }}>{info.icon}</div>
                                            {/* Label */}
                                            <div style={{
                                                position: 'absolute', top: '100%', left: '50%',
                                                transform: 'translateX(-50%)', marginTop: 3,
                                                whiteSpace: 'nowrap', fontFamily: MONO, fontSize: 9, fontWeight: 700,
                                                color: '#fff', background: 'rgba(0,0,0,0.75)',
                                                padding: '2px 6px', borderRadius: 3, letterSpacing: '0.3px',
                                            }}>{pt.label}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* ═══════════════════════════════════════════════════════
                Meter Data Popup (Modal)
                ═══════════════════════════════════════════════════════ */}
            {popupPoint && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1200,
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                    onClick={() => setPopupPoint(null)}>
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8,
                            width: 480, maxHeight: '80vh', overflow: 'hidden',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
                            display: 'flex', flexDirection: 'column',
                        }}>
                        {/* Header */}
                        <div style={{
                            padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            background: C.bar, borderBottom: `2px solid ${(POINT_TYPES[popupPoint.point_type] || POINT_TYPES.meter).color}`,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{
                                    width: 30, height: 30, borderRadius: '50%',
                                    background: (POINT_TYPES[popupPoint.point_type] || POINT_TYPES.meter).color,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 16,
                                }}>{(POINT_TYPES[popupPoint.point_type] || POINT_TYPES.meter).icon}</span>
                                <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '0.5px' }}>
                                    {popupPoint.label}
                                </span>
                            </div>
                            <button onClick={() => setPopupPoint(null)}
                                style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, display: 'grid', placeItems: 'center' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
                            {/* Meter Info */}
                            {popupPoint.meter_id && meterData ? (
                                <>
                                    {/* Meter name */}
                                    <div style={{
                                        padding: '12px 18px', background: C.panel2,
                                        borderBottom: `1px solid ${C.line}`,
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    }}>
                                        <div>
                                            <div style={{ fontFamily: MONO, fontSize: 10, color: C.sub, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 2 }}>มิเตอร์</div>
                                            <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: C.ink }}>
                                                [{meterData.meter_code}] {meterData.meter_name}
                                            </div>
                                        </div>
                                        <div style={{
                                            fontFamily: MONO, fontSize: 10, padding: '3px 10px',
                                            borderRadius: 12,
                                            background: meterData.status === 'online' ? '#10B98120' : '#EF444420',
                                            color: meterData.status === 'online' ? '#10B981' : '#EF4444',
                                            border: `1px solid ${meterData.status === 'online' ? '#10B981' : '#EF4444'}40`,
                                            fontWeight: 600, textTransform: 'uppercase',
                                        }}>
                                            {meterData.status === 'online' ? '🟢' : '🔴'} {meterData.status}
                                        </div>
                                    </div>

                                    {/* Location info */}
                                    <div style={{
                                        padding: '8px 18px', background: C.panel,
                                        borderBottom: `1px solid ${C.line}`,
                                        display: 'flex', gap: 20,
                                    }}>
                                        {meterData.building_name && (
                                            <div style={{ fontFamily: MONO, fontSize: 10, color: C.sub }}>
                                                🏢 {meterData.building_name}
                                            </div>
                                        )}
                                        {meterData.room_name && (
                                            <div style={{ fontFamily: MONO, fontSize: 10, color: C.sub }}>
                                                📍 {meterData.room_name}
                                            </div>
                                        )}
                                        {meterData.date_keep && (
                                            <div style={{ fontFamily: MONO, fontSize: 10, color: C.sub, marginLeft: 'auto' }}>
                                                🕐 {new Date(meterData.date_keep).toLocaleString('th-TH')}
                                            </div>
                                        )}
                                    </div>

                                    {/* Data Table */}
                                    <div style={{ padding: '0' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 12 }}>
                                            <tbody>
                                                {METER_FIELDS.map((field, i) => {
                                                    const val = meterData[field.key];
                                                    if (val === undefined || val === null) return null;
                                                    const numVal = parseFloat(val);
                                                    return (
                                                        <tr key={field.key} style={{
                                                            borderBottom: `1px solid ${C.line}`,
                                                            background: i % 2 === 0 ? C.panel : C.panel2,
                                                        }}>
                                                            <td style={{
                                                                padding: '8px 18px', fontWeight: 600, color: C.ink,
                                                                width: '45%',
                                                            }}>{field.label}</td>
                                                            <td style={{
                                                                padding: '8px 18px', textAlign: 'right',
                                                                color: C.ink, fontWeight: 500,
                                                            }}>
                                                                {isNaN(numVal) ? val : numVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                {field.unit && <span style={{ color: C.sub, fontSize: 10, marginLeft: 4 }}>{field.unit}</span>}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            ) : popupPoint.meter_id && meterLoading ? (
                                <div style={{ textAlign: 'center', padding: '40px 20px', fontFamily: MONO, color: C.sub }}>
                                    <div style={{ fontSize: 24, marginBottom: 8, animation: 'pulse-ring 1s ease-out infinite' }}>⏳</div>
                                    กำลังโหลดข้อมูลมิเตอร์...
                                </div>
                            ) : (
                                <div style={{ padding: '30px 20px', textAlign: 'center', fontFamily: MONO }}>
                                    <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📊</div>
                                    <div style={{ fontSize: 13, color: C.ink, fontWeight: 600, marginBottom: 4 }}>
                                        {popupPoint.label}
                                    </div>
                                    <div style={{ fontSize: 11, color: C.sub }}>
                                        {(POINT_TYPES[popupPoint.point_type] || POINT_TYPES.meter).label}
                                    </div>
                                    {!popupPoint.meter_id && (
                                        <div style={{ fontSize: 11, color: C.sub, marginTop: 12, padding: '8px 16px', background: C.panel2, borderRadius: 6, border: `1px solid ${C.line}`, display: 'inline-block' }}>
                                            ⚠️ ยังไม่ได้เชื่อมต่อมิเตอร์
                                            <br />
                                            <span style={{ fontSize: 10 }}>ไปที่ Settings → แผนผัง → 📌 จุด เพื่อ Link Meter</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* CSS */}
            <style>{`
                @keyframes pulse-ring {
                    0% { transform: scale(1); opacity: 0.6; }
                    100% { transform: scale(1.8); opacity: 0; }
                }
            `}</style>
        </div>
    );
};

export default LayoutViewPage;
