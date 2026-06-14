import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Zap, Droplet, Flame, Sun, ChevronRight, Home, Activity,
    ArrowUpDown, X, Gauge, Search, Wifi, WifiOff, AlertTriangle,
    Network, Pencil, Bell, PowerOff, LayoutGrid, BarChart3,
    Compass, HelpCircle, Layers, CheckCircle2
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell,
} from 'recharts';

/* ---------------------------------------------------------------------------
   Energy Monitoring Dashboard — ระบบติดตามพลังงานแบบ drill-down
   สาขา → ตึก → ชั้น → โซน → ห้อง(Meter) + ตาราง Realtime + สถานะสี
   ข้อมูลจำลองอิงตาม schema meter_data_realtime (3-phase + import_kwhr)
 --------------------------------------------------------------------------- */

// ── Color tokens using design system variables ──
const C = {
    bg: 'var(--bg)',
    surface: 'var(--surface)',
    text: 'var(--text)',
    textSecondary: 'var(--text-secondary)',
    textMuted: 'var(--text-muted)',
    border: 'var(--border)',
    borderLight: 'var(--border-light)',
    primary: 'var(--primary-600)',
    primaryHover: 'var(--primary-700)',
    primaryLight: 'var(--primary-50)',
    accent: 'var(--rose-500)',
    accentLight: 'var(--rose-50)',
    
    // Status colors
    green: '#10B981',
    greenLight: '#ECFDF5',
    greenBorder: '#A7F3D0',
    
    yellow: '#F59E0B',
    yellowLight: '#FFFBEB',
    yellowBorder: '#FDE68A',
    
    red: '#EF4444',
    redLight: '#FEF2F2',
    redBorder: '#FCA5A5',
    
    gray: '#6B7280',
    grayLight: '#F3F4F6',
    grayBorder: '#E5E7EB',
};

// ── Status & Mode maps ──
const STATUS: Record<string, { color: string; bg: string; border: string; label: string }> = {
    normal: { color: C.green, bg: C.greenLight, border: C.greenBorder, label: 'ปกติ' },
    warning: { color: C.yellow, bg: C.yellowLight, border: C.yellowBorder, label: 'เตือน' },
    over: { color: C.red, bg: C.redLight, border: C.redBorder, label: 'เกินเกณฑ์' },
    offline: { color: C.gray, bg: C.grayLight, border: C.grayBorder, label: 'ไม่มีสัญญาณ' },
};

const MODE: Record<string, { label: string; color: string; bg: string }> = {
    auto: { label: 'Auto', color: 'var(--primary-600)', bg: 'var(--primary-50)' },
    manual: { label: 'กรอกมือ', color: C.yellow, bg: C.yellowLight },
    disabled: { label: 'ปิดใช้งาน', color: C.gray, bg: C.grayLight },
};

const STALE_MS = 30000;

// ── Types ──
interface MeterData {
    id: string;
    code: string;
    channel: string;
    site_id: number;
    address_id: number;
    device: string;
    type: string;
    loop: number;
    pathIds: string[];
    pathNames: string[];
    threshold: number;
    disabled: boolean;
    inputMode: string;
    periodStart_kwhr: number;
    import_kwhr: number;
    _pf: number;
    _v: number;
    kw_3ph: number;
    kw1: number; kw2: number; kw3: number;
    pf1: number; pf2: number; pf3: number;
    kva_3ph: number; kvar_3ph: number;
    kva1: number; kva2: number; kva3: number;
    kvar1: number; kvar2: number; kvar3: number;
    vl1: number; vl2: number; vl3: number;
    vl12: number; vl23: number; vl31: number;
    il1: number; il2: number; il3: number;
    hz: number;
    received_at: number;
    device_datetime: number;
}

interface TreeNode {
    id: string;
    name: string;
    level: string;
    children?: TreeNode[];
}

interface ItemData {
    node: TreeNode;
    kwh: number;
    status: string;
    count: number;
    m?: MeterData;
}

/* ---------- Seeded RNG (stable layout across refreshes) ---------- */
function mulberry32(a: number) {
    return function () {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function refreshElectrical(m: MeterData) {
    const pf = m._pf, v = m._v;
    const load = Math.max(0.4, m.kw_3ph * (0.975 + Math.random() * 0.05));
    m.kw_3ph = +load.toFixed(3);
    const per = load / 3;
    m.kw1 = +(per * (0.96 + Math.random() * 0.08)).toFixed(3);
    m.kw2 = +(per * (0.96 + Math.random() * 0.08)).toFixed(3);
    m.kw3 = +Math.max(0, load - m.kw1 - m.kw2).toFixed(3);
    m.pf1 = +(pf + (Math.random() - 0.5) * 0.02).toFixed(4);
    m.pf2 = +(pf + (Math.random() - 0.5) * 0.02).toFixed(4);
    m.pf3 = +(pf + (Math.random() - 0.5) * 0.02).toFixed(4);
    m.kva_3ph = +(load / pf).toFixed(3);
    m.kvar_3ph = +Math.sqrt(Math.max(0, m.kva_3ph ** 2 - load ** 2)).toFixed(3);
    m.kva1 = +(m.kva_3ph / 3).toFixed(3); m.kva2 = m.kva1; m.kva3 = m.kva1;
    m.kvar1 = +(m.kvar_3ph / 3).toFixed(3); m.kvar2 = m.kvar1; m.kvar3 = m.kvar1;
    m.vl1 = +(v + (Math.random() - 0.5) * 4).toFixed(2);
    m.vl2 = +(v + (Math.random() - 0.5) * 4).toFixed(2);
    m.vl3 = +(v + (Math.random() - 0.5) * 4).toFixed(2);
    m.vl12 = +(v * 1.732 + (Math.random() - 0.5) * 5).toFixed(2);
    m.vl23 = +(v * 1.732 + (Math.random() - 0.5) * 5).toFixed(2);
    m.vl31 = +(v * 1.732 + (Math.random() - 0.5) * 5).toFixed(2);
    m.il1 = +((m.kw1 * 1000) / (m.vl1 * m.pf1)).toFixed(3);
    m.il2 = +((m.kw2 * 1000) / (m.vl2 * m.pf2)).toFixed(3);
    m.il3 = +((m.kw3 * 1000) / (m.vl3 * m.pf3)).toFixed(3);
    m.hz = +(50 + (Math.random() - 0.5) * 0.1).toFixed(2);
}

function generateData() {
    const rnd = mulberry32(20260613);
    const ri = (a: number, b: number) => Math.floor(rnd() * (b - a + 1)) + a;
    const meters: MeterData[] = [];
    let addr = 1000, ch = 0;
    const branchNames = ['สาขาสุขุมวิท', 'สาขาพระราม 9', 'สาขาเชียงใหม่'];
    const tree: TreeNode[] = branchNames.map((bn, bi) => {
        const buildings: TreeNode[] = [];
        for (let j = 0; j < ri(2, 3); j++) {
            const bdId = `b${bi}-bd${j}`, floors: TreeNode[] = [];
            for (let f = 1; f <= ri(2, 4); f++) {
                const fId = `${bdId}-f${f}`, zones: TreeNode[] = [];
                for (let z = 0; z < ri(2, 3); z++) {
                    const zId = `${fId}-z${z}`, rooms: TreeNode[] = [];
                    for (let r = 1; r <= ri(6, 38); r++) {
                        const rId = `${zId}-r${r}`;
                        const code = `R${f}${z + 1}${String(r).padStart(2, '0')}`;
                        const threshold = 60 + rnd() * 360;
                        const roll = rnd();
                        const inputMode = roll < 0.05 ? 'disabled' : roll < 0.17 ? 'manual' : 'auto';
                        const disabled = inputMode === 'disabled';
                        const startCum = 10000 + rnd() * 90000;
                        const periodVal = rnd() * threshold * 1.25;
                        const m: MeterData = {
                            id: rId, code, channel: `CH${String(ch++).padStart(4, '0')}`,
                            site_id: bi + 1, address_id: addr++, device: `PM${2200 + ri(0, 99)}`,
                            type: '3P4W', loop: Math.floor((r - 1) / 32) + 1,
                            pathIds: [`b${bi}`, bdId, fId, zId],
                            pathNames: [bn, `ตึก ${String.fromCharCode(65 + j)}`, `ชั้น ${f}`, `โซน ${String.fromCharCode(65 + z)}`],
                            threshold, disabled, inputMode,
                            periodStart_kwhr: +startCum.toFixed(3),
                            import_kwhr: +(startCum + periodVal).toFixed(3),
                            _pf: 0.86 + rnd() * 0.1, _v: 228 + rnd() * 6,
                            kw_3ph: 3 + rnd() * 42,
                            kw1: 0, kw2: 0, kw3: 0,
                            pf1: 0, pf2: 0, pf3: 0,
                            kva_3ph: 0, kvar_3ph: 0,
                            kva1: 0, kva2: 0, kva3: 0,
                            kvar1: 0, kvar2: 0, kvar3: 0,
                            vl1: 0, vl2: 0, vl3: 0,
                            vl12: 0, vl23: 0, vl31: 0,
                            il1: 0, il2: 0, il3: 0,
                            hz: 0,
                            received_at: disabled ? Date.now() - 600000
                                : Date.now() - (rnd() < 0.08 ? 60000 + rnd() * 60000 : rnd() * 8000),
                            device_datetime: Date.now(),
                        };
                        refreshElectrical(m);
                        meters.push(m);
                        rooms.push({ id: rId, name: code, level: 'room' });
                    }
                    zones.push({ id: zId, name: `โซน ${String.fromCharCode(65 + z)}`, level: 'zone', children: rooms });
                }
                floors.push({ id: fId, name: `ชั้น ${f}`, level: 'floor', children: zones });
            }
            buildings.push({ id: bdId, name: `ตึก ${String.fromCharCode(65 + j)}`, level: 'building', children: floors });
        }
        return { id: `b${bi}`, name: bn, level: 'branch', children: buildings };
    });
    return { tree, meters };
}

const period = (m: MeterData) => Math.max(0, m.import_kwhr - m.periodStart_kwhr);

function meterStatus(m: MeterData, now: number): string {
    if (m.disabled) return 'offline';
    if (now - m.received_at > STALE_MS) return 'offline';
    const p = period(m), t = m.threshold;
    if (p > t) return 'over';
    if (p > t * 0.8) return 'warning';
    return 'normal';
}

function aggStatus(list: MeterData[], now: number): string {
    let n = false, o = false;
    for (const m of list) {
        const s = meterStatus(m, now);
        if (s === 'over') return 'over';
        if (s === 'warning') o = true;
        if (s === 'normal') n = true;
    }
    return o ? 'warning' : n ? 'normal' : 'offline';
}

const fmt = (v: number, d = 0) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

const LEVEL_LABEL = ['สาขา', 'ตึก', 'ชั้น', 'โซน', 'ห้อง (Meter)'];

/* ──────────────────── UI Atoms ──────────────────── */
function StatusDot({ s, size = 10, pulse }: { s: string; size?: number; pulse?: boolean }) {
    const c = STATUS[s]?.color || C.gray;
    return (
        <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <span style={{
                width: size, height: size, borderRadius: '50%', background: c, display: 'inline-block',
                boxShadow: `0 0 0 3px ${c}22`
            }} />
            {pulse && s !== 'offline' && (
                <span style={{
                    position: 'absolute', inset: 0, borderRadius: '50%', background: c, opacity: 0.5,
                    animation: 'ed-ping 1.6s cubic-bezier(0,0,.2,1) infinite'
                }} />
            )}
        </span>
    );
}

function StatusTag({ s }: { s: string }) {
    const info = STATUS[s] || { color: C.gray, bg: C.grayLight, border: C.grayBorder, label: 'ไม่มีสถานะ' };
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 10px',
            borderRadius: '9999px',
            fontSize: '11.5px',
            fontWeight: 600,
            color: info.color,
            background: info.bg,
            border: `1px solid ${info.border}`
        }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: info.color, display: 'inline-block' }} />
            {info.label}
        </span>
    );
}

function Readout({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: string }) {
    return (
        <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius)',
            padding: '12px 14px',
            boxShadow: 'var(--shadow-sm)',
            transition: 'var(--transition)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
        }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 6 }}>{label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 20,
                    fontWeight: 700,
                    color: accent || 'var(--text)'
                }}>{value}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{unit}</span>
            </div>
        </div>
    );
}

/* ──────────────────── Meter Detail Popup ──────────────────── */
function MeterDetail({ m, now, onClose }: { m: MeterData; now: number; onClose: () => void }) {
    const s = meterStatus(m, now);
    const ago = Math.round((now - m.received_at) / 1000);
    const md = MODE[m.inputMode];
    const consumed = period(m);
    const pct = Math.min(100, (consumed / m.threshold) * 100);
    const isOver = consumed > m.threshold;

    return (
        <div onClick={onClose} style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(10px)',
            display: 'grid', placeItems: 'center', padding: 20, zIndex: 1050
        }}>
            <div onClick={(e) => e.stopPropagation()} style={{
                background: 'var(--surface)',
                borderRadius: 'var(--radius-2xl)',
                width: 'min(720px, 100%)',
                maxHeight: '90vh',
                overflow: 'hidden',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-xl)',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'linear-gradient(to right, var(--primary-50), var(--surface))'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <StatusDot s={s} size={12} pulse />
                        <div>
                            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                {m.code}
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>({m.device})</span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, fontWeight: 500 }}>
                                {m.pathNames.join('  ›  ')}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700,
                            color: md.color, background: md.bg, borderRadius: 'var(--radius-full)', padding: '4px 10px',
                            border: `1px solid ${md.color}20`
                        }}>
                            {m.inputMode === 'manual' ? <Pencil size={11} /> : m.inputMode === 'disabled' ? <PowerOff size={11} /> : <Zap size={11} />}
                            {md.label}
                        </span>
                        
                        <StatusTag s={s} />

                        <button onClick={onClose} style={{
                            background: 'var(--gray-100)', border: 'none', borderRadius: '50%',
                            width: 32, height: 32, cursor: 'pointer', display: 'grid', placeItems: 'center',
                            color: 'var(--text-secondary)', transition: 'var(--transition)'
                        }}><X size={16} /></button>
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                    <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
                        {/* kwh gauge card */}
                        <div style={{
                            flex: 1, minWidth: 260,
                            background: 'var(--gray-950)', color: '#fff',
                            borderRadius: 'var(--radius-xl)', padding: '20px',
                            boxShadow: 'var(--shadow-md)', position: 'relative', overflow: 'hidden'
                        }}>
                            <div style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 500, marginBottom: 4 }}>พลังงานสะสมงวดนี้</div>
                            <div style={{
                                fontFamily: 'ui-monospace, monospace', fontVariantNumeric: 'tabular-nums',
                                fontSize: 32, fontWeight: 800
                            }}>{fmt(consumed, 1)} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--gray-400)' }}>kWh</span></div>
                            
                            {/* Gauge bar */}
                            <div style={{ marginTop: 14 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4, color: 'var(--gray-400)' }}>
                                    <span>ใช้จริง: {fmt(pct, 0)}%</span>
                                    <span>เกณฑ์: {fmt(m.threshold, 0)} kWh</span>
                                </div>
                                <div style={{ height: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 99, overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${pct}%`, height: '100%',
                                        background: isOver ? C.red : pct > 80 ? C.yellow : C.green,
                                        borderRadius: 99, transition: 'width 0.4s ease'
                                    }} />
                                </div>
                            </div>
                        </div>

                        {/* kw monitor card */}
                        <div style={{
                            flex: 1, minWidth: 260,
                            background: 'var(--primary-50)', border: '1px solid var(--primary-100)',
                            borderRadius: 'var(--radius-xl)', padding: '20px',
                            boxShadow: 'var(--shadow-sm)'
                        }}>
                            <div style={{ fontSize: 12, color: 'var(--primary-700)', fontWeight: 600, marginBottom: 4 }}>กำลังไฟรวมปัจจุบัน</div>
                            <div style={{
                                fontFamily: 'ui-monospace, monospace', fontVariantNumeric: 'tabular-nums',
                                fontSize: 32, fontWeight: 800, color: 'var(--primary-700)'
                            }}>{fmt(m.kw_3ph, 2)} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--primary-600)' }}>kW</span></div>
                            
                            <div style={{ display: 'flex', gap: 12, marginTop: 14, borderTop: '1px solid var(--primary-100)', paddingTop: 10, fontSize: 11.5, color: 'var(--primary-600)' }}>
                                <div>kVA: <b>{fmt(m.kva_3ph, 1)}</b></div>
                                <div>kVAR: <b>{fmt(m.kvar_3ph, 1)}</b></div>
                                <div style={{ marginLeft: 'auto' }}>อัปเดต: <b>{ago}s ที่แล้ว</b></div>
                            </div>
                        </div>
                    </div>

                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Layers size={14} color="var(--primary-600)" />
                        ค่าวัดระบบไฟฟ้าแบบ 3 เฟส
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
                        <Readout label="แรงดันไฟฟ้า L-N" value={`${fmt(m.vl1)}/${fmt(m.vl2)}/${fmt(m.vl3)}`} unit="V" />
                        <Readout label="แรงดันไฟฟ้า L-L" value={`${fmt(m.vl12)}/${fmt(m.vl23)}/${fmt(m.vl31)}`} unit="V" />
                        <Readout label="กระแสไฟฟ้า" value={`${fmt(m.il1, 1)}/${fmt(m.il2, 1)}/${fmt(m.il3, 1)}`} unit="A" />
                        <Readout label="กำลังไฟฟ้า kW" value={`${fmt(m.kw1, 1)}/${fmt(m.kw2, 1)}/${fmt(m.kw3, 1)}`} unit="kW" />
                        <Readout label="Power Factor" value={`${m.pf1.toFixed(2)}/${m.pf2.toFixed(2)}/${m.pf3.toFixed(2)}`} unit="" accent="var(--primary-600)" />
                        <Readout label="ความถี่ไฟฟ้า" value={fmt(m.hz, 2)} unit="Hz" />
                    </div>

                    <div style={{
                        marginTop: 20, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
                        background: 'var(--gray-50)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '12px 16px'
                    }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>ข้อมูลจำเพาะมิเตอร์</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
                            <div>Channel: <b style={{ fontFamily: 'monospace' }}>{m.channel}</b></div>
                            <div>Wiring Type: <b>{m.type}</b></div>
                            <div>Site ID: <b>{m.site_id}</b></div>
                            <div>Modbus Address ID: <b>{m.address_id}</b></div>
                            <div>วันเวลาในอุปกรณ์: <b>{new Date(m.device_datetime).toLocaleTimeString('th-TH')}</b></div>
                            <div>อัปเดตระบบ: <b>{new Date(m.received_at).toLocaleTimeString('th-TH')}</b></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ──────────────────── Zone Floor Plan ──────────────────── */
function ZonePlan({ items, onPick }: { items: ItemData[]; onPick: (it: ItemData) => void }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {items.map((it) => {
                const info = STATUS[it.status];
                return (
                    <button key={it.node.id} onClick={() => onPick(it)} style={{
                        textAlign: 'left', cursor: 'pointer',
                        border: `1px solid ${info.border}`,
                        borderRadius: 'var(--radius-xl)',
                        background: 'var(--surface)',
                        padding: '16px 20px',
                        display: 'flex', flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: 120,
                        boxShadow: 'var(--shadow-sm)',
                        transition: 'var(--transition)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                        e.currentTarget.style.borderColor = info.color;
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                        e.currentTarget.style.borderColor = info.border;
                    }}
                    >
                        {/* Visual accent bar at the top */}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: info.color }} />

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text)' }}>{it.node.name}</span>
                            <StatusTag s={it.status} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 'auto' }}>
                            <span style={{
                                fontFamily: 'ui-monospace, monospace', fontVariantNumeric: 'tabular-nums',
                                fontSize: 26, fontWeight: 800, color: 'var(--text)'
                            }}>{fmt(it.kwh)}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>kWh</span>
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4, fontWeight: 500 }}>
                            ติดตั้งแล้ว {it.count} มิเตอร์
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

/* ──────────────────── Loop / Room Grid ──────────────────── */
function LoopGrid({ groups, onPick }: { groups: { loop: number; items: ItemData[] }[]; onPick: (m: MeterData) => void }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {groups.map((g) => (
                <div key={g.loop} style={{
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-xl)',
                    background: 'var(--surface)',
                    padding: 16,
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <span style={{
                            fontWeight: 700, fontSize: 13,
                            background: 'var(--gray-950)', color: '#fff',
                            borderRadius: 'var(--radius-sm)', padding: '4px 12px'
                        }}>
                            Loop {g.loop}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                            ความหนาแน่นอุปกรณ์: <b>{g.items.length}</b> / 32 Meter
                        </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(96px,1fr))', gap: 10 }}>
                        {g.items.map((it) => {
                            const info = STATUS[it.status];
                            const md = MODE[it.m!.inputMode];
                            const dim = it.m!.inputMode === 'disabled';
                            return (
                                <button key={it.node.id} onClick={() => onPick(it.m!)} title={`${it.node.name} · ${md.label}`} style={{
                                    cursor: 'pointer', border: `1px solid var(--border-light)`,
                                    borderRadius: 'var(--radius-lg)', padding: '12px 8px',
                                    background: dim ? 'var(--gray-50)' : 'var(--surface)',
                                    opacity: dim ? 0.6 : 1, display: 'flex',
                                    flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative',
                                    transition: 'var(--transition)',
                                    boxShadow: 'var(--shadow-xs)'
                                }}
                                onMouseEnter={(e) => {
                                    if (!dim) {
                                        e.currentTarget.style.transform = 'scale(1.04)';
                                        e.currentTarget.style.borderColor = info.color;
                                        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!dim) {
                                        e.currentTarget.style.transform = 'scale(1)';
                                        e.currentTarget.style.borderColor = 'var(--border-light)';
                                        e.currentTarget.style.boxShadow = 'var(--shadow-xs)';
                                    }
                                }}
                                >
                                    {it.m!.inputMode === 'manual' && (
                                        <span style={{ position: 'absolute', top: 6, right: 6, color: C.yellow }}><Pencil size={11} /></span>
                                    )}
                                    <span style={{
                                        width: 10, height: 10, borderRadius: '50%', background: info.color,
                                        boxShadow: `0 0 8px ${info.color}`, display: 'block'
                                    }} />
                                    <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)' }}>{it.node.name}</span>
                                    <span style={{
                                        fontFamily: 'ui-monospace, monospace', fontVariantNumeric: 'tabular-nums',
                                        fontSize: 13, fontWeight: 800, color: 'var(--text)'
                                    }}>{fmt(it.kwh)}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}

/* ──────────────────── Single Line Diagram ──────────────────── */
function SingleLine({ main, feeders, onPick }: {
    main: { name: string; kwh: number; status: string };
    feeders: ItemData[];
    onPick: (id: string) => void;
}) {
    const info = STATUS[main.status];
    return (
        <div style={{
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--surface)',
            padding: '24px 16px',
            boxShadow: 'var(--shadow-sm)'
        }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* Main */}
                <div style={{
                    border: `2px solid ${info.color}`,
                    borderRadius: 'var(--radius-lg)',
                    padding: '12px 20px',
                    minWidth: 180,
                    textAlign: 'center',
                    background: 'var(--surface)',
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
                        <StatusDot s={main.status} />
                        <span style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--text)' }}>Main · {main.name}</span>
                    </div>
                    <div style={{ fontFamily: 'ui-monospace, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>
                        {fmt(main.kwh)} <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>kWh</span>
                    </div>
                </div>

                {/* Busbar Line */}
                <div style={{ width: 3, height: 24, background: 'var(--gray-950)' }} />
                
                {/* Horizontal Busbar */}
                <div style={{
                    height: 4,
                    background: 'var(--gray-950)',
                    width: `${Math.max(60, Math.min(96, feeders.length * 12))}%`,
                    borderRadius: 99
                }} />

                {/* Feeders Grid */}
                <div style={{ display: 'flex', gap: 14, marginTop: 0, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {feeders.map((f, i) => {
                        const sInfo = STATUS[f.status];
                        return (
                            <div key={f.node.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ width: 2, height: 20, background: 'var(--gray-950)', borderStyle: 'dashed' }} />
                                <button onClick={() => onPick(f.node.id)} style={{
                                    cursor: 'pointer', border: '1px solid var(--border-light)',
                                    borderTop: `4px solid ${sInfo.color}`,
                                    borderRadius: 'var(--radius)', padding: '12px 14px',
                                    background: 'var(--surface)', textAlign: 'center',
                                    minWidth: 110, transition: 'var(--transition)',
                                    boxShadow: 'var(--shadow-xs)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(2px)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-xs)';
                                }}
                                >
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 2 }}>F{i + 1}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
                                        <StatusDot s={f.status} size={8} />
                                        <span style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text)' }}>{f.node.name}</span>
                                    </div>
                                    <div style={{ fontFamily: 'ui-monospace, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
                                        {fmt(f.kwh)} <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 500 }}>kWh</span>
                                    </div>
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/* ──────────────────── Compare / Analytics ──────────────────── */
const PALETTE = ['var(--primary-600)', '#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#CA8A04', '#16A34A', '#0891B2'];

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div style={{
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(8px)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius)',
                padding: '12px 14px',
                boxShadow: 'var(--shadow-lg)'
            }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 8 }}>{label}</p>
                {payload.map((p: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, marginBottom: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{p.name}:</span>
                        <span style={{ fontWeight: 800, marginLeft: 'auto', fontFamily: 'monospace' }}>{p.value.toLocaleString()} kWh</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

function Compare({ meters, tree, now }: { meters: MeterData[]; tree: TreeNode[]; now: number }) {
    const [dim, setDim] = useState('overview');
    const [gran, setGran] = useState('year');
    const [billing, setBilling] = useState(false);

    const entities = useMemo(() => {
        if (dim === 'building' || dim === 'mdb') {
            const list: { id: string; name: string; weight: number }[] = [];
            tree.forEach((b) => b.children?.forEach((bd) => {
                const w = meters.filter((m) => m.pathIds[1] === bd.id).reduce((s, m) => s + period(m), 0);
                const short = b.name.replace('สาขา', '');
                list.push({ id: bd.id, name: `${dim === 'mdb' ? 'MDB ' : ''}${short}·${bd.name}`, weight: w });
            }));
            return list;
        }
        return tree.map((b) => ({
            id: b.id, name: b.name.replace('สาขา', ''),
            weight: meters.filter((m) => m.pathIds[0] === b.id).reduce((s, m) => s + period(m), 0),
        }));
    }, [dim, tree, meters]);

    const buckets = useMemo(() => {
        if (gran === 'year') return ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        if (gran === 'month') return Array.from({ length: 30 }, (_, i) => String(i + 1));
        if (gran === 'week') return ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];
        return Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    }, [gran]);

    const seasonal = [0.9, 0.92, 1.0, 1.15, 1.2, 1.12, 1.06, 1.05, 1.0, 0.98, 0.93, 1.0];
    const loadCurve = [.35, .3, .28, .28, .32, .45, .6, .8, .95, 1, 1.05, 1.08, 1.05, 1, 1.02, 1.05, 1.1, 1.15, 1.12, 1, .85, .7, .55, .45];
    const hashf = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };

    const data = useMemo(() => buckets.map((lb, bi) => {
        const row: Record<string, any> = { label: lb };
        entities.forEach((e) => {
            let v: number;
            if (gran === 'year') v = e.weight * seasonal[bi];
            else if (gran === 'month') v = (e.weight / 30) * (0.7 + hashf(e.id + 'm' + bi) * 0.7);
            else if (gran === 'week') v = (e.weight / 30) * (0.7 + hashf(e.id + 'w' + bi) * 0.7);
            else v = (e.weight / 720) * loadCurve[bi] * (0.85 + hashf(e.id + 'h' + bi) * 0.3);
            row[e.name] = +v.toFixed(1);
        });
        return row;
    }), [buckets, entities, gran]);

    const totals = entities.map((e) => ({ name: e.name, value: +data.reduce((s, r) => s + (r[e.name] || 0), 0).toFixed(1) }))
        .sort((a, b) => b.value - a.value);
    const grand = totals.reduce((s, t) => s + t.value, 0) || 1;
    const colorOf: Record<string, string> = {}; entities.forEach((e, i) => (colorOf[e.name] = PALETTE[i % PALETTE.length]));

    const yr = 2569;
    const windowText = gran === 'year'
        ? `รอบปี ${yr - 1} · ค่ามิเตอร์ 00:00 น. 1 ม.ค. ${yr} − 00:00 น. 1 ม.ค. ${yr - 1}`
        : gran === 'month'
            ? (billing ? `รอบบิล (ตัดวันที่ 20) · 00:00 น. 20 ธ.ค. ${yr - 1} − 00:00 น. 20 ม.ค. ${yr}` : `รอบปฏิทิน · 1 ม.ค. − 31 ม.ค. ${yr}`)
            : gran === 'week' ? 'สัปดาห์ล่าสุด · จันทร์ − อาทิตย์' : 'วันล่าสุด · 00:00 − 24:00 น. (รายชั่วโมง)';

    const DIMS: [string, string][] = [['overview', 'ภาพรวม'], ['branch', 'ตามสาขา'], ['building', 'ตามตึก'], ['mdb', 'ตาม MDB']];
    const GRANS: [string, string][] = [['year', 'รายปี'], ['month', 'รายเดือน'], ['week', 'รายสัปดาห์'], ['day', 'รายวัน']];
    
    const tabStyle = (a: boolean): React.CSSProperties => ({
        fontSize: 12.5, padding: '8px 16px', borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer',
        fontWeight: a ? 700 : 500,
        background: a ? 'var(--primary-600)' : 'var(--surface)',
        color: a ? '#fff' : 'var(--text-secondary)',
        boxShadow: a ? 'var(--shadow-sm)' : 'inset 0 0 0 1px var(--border-light)',
        transition: 'var(--transition)'
    });

    return (
        <div style={{ padding: '8px 0' }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                <div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>เปรียบเทียบตาม</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {DIMS.map(([k, lb]) => <button key={k} onClick={() => setDim(k)} style={tabStyle(dim === k)}>{lb}</button>)}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>ช่วงเวลา (รูปแบบ)</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {GRANS.map(([k, lb]) => <button key={k} onClick={() => setGran(k)} style={tabStyle(gran === k)}>{lb}</button>)}
                    </div>
                </div>
                {gran === 'month' && (
                    <div>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>การตัดรอบ</div>
                        <button onClick={() => setBilling((v) => !v)} style={tabStyle(billing)}>
                            {billing ? 'รอบบิล 20→20' : 'รอบปฏิทิน'}
                        </button>
                    </div>
                )}
            </div>

            <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--primary-50)', color: 'var(--primary-700)',
                borderRadius: 'var(--radius-lg)', padding: '10px 16px', fontSize: 12.5, marginBottom: 18,
                fontWeight: 600, border: '1px solid var(--primary-100)'
            }}>
                <Gauge size={15} /> ช่วงข้อมูล: {windowText}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 16 }}>
                {/* Stacked Bar */}
                <div style={{
                    background: 'var(--surface)', border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-xl)', padding: '20px 18px', boxShadow: 'var(--shadow-sm)'
                }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
                        ปริมาณไฟฟ้า (kWh) {gran === 'year' ? 'รายเดือน' : gran === 'month' ? 'รายวัน' : gran === 'week' ? 'รายวัน' : 'รายชั่วโมง'} · {DIMS.find((d) => d[0] === dim)?.[1]}
                    </div>
                    <div style={{ height: 350 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} interval={gran === 'month' ? 2 : 0} />
                                <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={48} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 11.5, paddingTop: 10 }} />
                                {entities.map((e, i) => (
                                    <Bar key={e.id} dataKey={e.name} stackId="a" fill={PALETTE[i % PALETTE.length]}
                                        radius={i === entities.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Pie + share */}
                <div style={{
                    background: 'var(--surface)', border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-xl)', padding: '20px 18px', boxShadow: 'var(--shadow-sm)',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                }}>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>สัดส่วนการใช้พลังงาน (%)</div>
                        <div style={{ height: 180, position: 'relative' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={totals} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                                        {totals.map((t) => <Cell key={t.name} fill={colorOf[t.name]} />)}
                                    </Pie>
                                    <Tooltip formatter={(v: any) => `${fmt(v)} kWh`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                        {totals.map((t) => (
                            <div key={t.name} style={{
                                display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5,
                                padding: '6px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--gray-50)'
                            }}>
                                <span style={{ width: 10, height: 10, borderRadius: '50%', background: colorOf[t.name], display: 'inline-block' }} />
                                <span style={{ flex: 1, color: 'var(--text-secondary)', fontWeight: 500 }}>{t.name}</span>
                                <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>{fmt(t.value)}</span>
                                <b style={{ fontFamily: 'ui-monospace, monospace', minWidth: 46, textAlign: 'right', color: 'var(--primary-600)' }}>
                                    {((t.value / grand) * 100).toFixed(1)}%</b>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ──────────────────── Style helpers ──────────────────── */
const crumb = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--radius)',
    border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: active ? 700 : 500,
    background: active ? 'var(--primary-50)' : 'transparent',
    color: active ? 'var(--primary-600)' : 'var(--text-secondary)',
    transition: 'var(--transition)',
    boxShadow: active ? 'var(--shadow-xs)' : 'none'
});

const kpi = (primary = false): React.CSSProperties => ({
    background: 'var(--surface)',
    border: primary ? '1px solid var(--primary-100)' : '1px solid var(--border-light)',
    borderTop: primary ? '4px solid var(--primary-600)' : '4px solid var(--border-light)',
    borderRadius: 'var(--radius-xl)',
    padding: '16px 20px',
    minWidth: 130,
    flex: 1,
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    transition: 'var(--transition)',
    position: 'relative',
    overflow: 'hidden'
});

const th = (): React.CSSProperties => ({
    padding: '12px 14px', fontWeight: 700, fontSize: 12,
    color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-light)'
});
const td = (): React.CSSProperties => ({
    padding: '14px', fontSize: 13, color: 'var(--text)'
});

/* ═══════════════════ MAIN DASHBOARD ═══════════════════ */
const ZoneDashboard: React.FC = () => {
    const dataRef = useRef<{ tree: TreeNode[]; meters: MeterData[] } | null>(null);
    if (!dataRef.current) dataRef.current = generateData();
    const { tree, meters } = dataRef.current;

    const [path, setPath] = useState<string[]>([]);
    const [selected, setSelected] = useState<MeterData | null>(null);
    const [sortDesc, setSortDesc] = useState(true);
    const [bldgView, setBldgView] = useState('side');
    const [, setTick] = useState(0);
    const [clock, setClock] = useState(Date.now());
    const [mode, setMode] = useState('monitor');

    useEffect(() => {
        const a = setInterval(() => {
            const now = Date.now();
            for (const m of meters) {
                if (m.disabled) continue;
                refreshElectrical(m);
                m.import_kwhr = +(m.import_kwhr + m.kw_3ph * (2 / 3600)).toFixed(3);
                m.received_at = Math.random() < 0.012 ? now - 90000 : now;
                m.device_datetime = now;
            }
            setTick((t) => t + 1);
        }, 2000);
        const b = setInterval(() => setClock(Date.now()), 1000);
        return () => { clearInterval(a); clearInterval(b); };
    }, [meters]);

    const now = clock;
    const metersUnder = (p: string[]) => meters.filter((m) => p.every((id, i) => m.pathIds[i] === id));

    // Current level items
    let nodes: TreeNode[] = tree;
    for (const id of path) nodes = (nodes.find((n) => n.id === id)?.children) || [];
    const level = path.length;

    const items: ItemData[] = nodes.map((node) => {
        if (node.level === 'room') {
            const m = meters.find((x) => x.id === node.id)!;
            return { node, kwh: period(m), status: meterStatus(m, now), count: 1, m };
        }
        const sub = metersUnder([...path, node.id]);
        return { node, kwh: sub.reduce((s, m) => s + period(m), 0), status: aggStatus(sub, now), count: sub.length };
    });
    const sorted = [...items].sort((a, b) => (sortDesc ? b.kwh - a.kwh : a.kwh - b.kwh));

    // Floor view
    const fnum = (n: string) => parseInt((String(n).match(/\d+/) || ['0'])[0], 10);
    const floorView = level === 2;
    const floorItems = floorView ? [...items].sort((a, b) => fnum(b.node.name) - fnum(a.node.name)) : [];
    const maxFloorKwh = floorView ? Math.max(1, ...items.map((i) => i.kwh)) : 1;
    const currentName = (() => { let n: TreeNode[] = tree; let node: TreeNode | undefined; for (let k = 0; k < path.length; k++) { node = n.find((x) => x.id === path[k]); n = node?.children || []; } return node?.name; })();

    // Loop groups for room view
    const loopGroups = level === 4
        ? Object.values(items.reduce((a: Record<number, { loop: number; items: ItemData[] }>, it) => {
            const L = it.m!.loop; (a[L] = a[L] || { loop: L, items: [] }).items.push(it); return a;
        }, {})).sort((a, b) => a.loop - b.loop)
        : [];

    // Zone items
    const zoneItems = level === 3 ? [...items].sort((a, b) => a.node.name.localeCompare(b.node.name, 'th')) : [];

    // Card renderer for Branches/General Cards
    const renderCard = (it: ItemData) => {
        const info = STATUS[it.status];
        const over = it.node.level === 'room' && it.m && period(it.m) > it.m.threshold;
        return (
            <button key={it.node.id} onClick={() => openItem(it)} style={{
                textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border-light)',
                borderTop: `4px solid ${info.color}`, borderRadius: 'var(--radius-xl)', padding: '16px',
                cursor: 'pointer', boxShadow: 'var(--shadow-sm)', transition: 'var(--transition)',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 110
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{it.node.name}</span>
                    <StatusTag s={it.status} />
                </div>
                
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 12 }}>
                    <span style={{
                        fontFamily: 'ui-monospace, monospace', fontVariantNumeric: 'tabular-nums',
                        fontSize: 24, fontWeight: 800, color: 'var(--text)'
                    }}>{fmt(it.kwh)}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 500 }}>kWh</span>
                </div>
                
                <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', width: '100%', borderTop: '1px solid var(--border-light)', paddingTop: 6 }}>
                    <span style={{ fontWeight: 500 }}>{it.node.level === 'room' ? `${it.m!.device} · Loop ${it.m!.loop}` : `${it.count} meter`}</span>
                    {over && <span style={{ color: C.red, display: 'flex', alignItems: 'center', gap: 3, fontWeight: 700 }}>
                        <AlertTriangle size={12} /> {fmt((period(it.m!) / it.m!.threshold) * 100)}%</span>}
                </div>
            </button>
        );
    };

    // Status counts
    const scope = metersUnder(path);
    const counts = scope.reduce((acc: Record<string, number>, m) => { acc[meterStatus(m, now)]++; return acc; },
        { normal: 0, warning: 0, over: 0, offline: 0 });
    const totalKwh = scope.reduce((s, m) => s + period(m), 0);

    const go = (id: string) => { setPath([...path, id]); setSelected(null); };
    const jump = (i: number) => { setPath(path.slice(0, i)); setSelected(null); };
    const openItem = (it: ItemData) => { it.node.level === 'room' ? setSelected(it.m!) : go(it.node.id); };

    return (
        <div style={{ fontFamily: "'Noto Sans Thai', 'Plus Jakarta Sans', system-ui, sans-serif", color: 'var(--text)' }}>
            <style>{`@keyframes ed-ping{75%,100%{transform:scale(2.2);opacity:0}}`}</style>

            {/* Dashboard Header Title (Consistent with system layout) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 className="page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="page-title__icon" style={{
                            background: 'var(--primary-50)', color: 'var(--primary-600)',
                            width: 36, height: 36, borderRadius: 'var(--radius-lg)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center'
                        }}><Compass size={20} /></span>
                        Zone Monitoring
                    </h1>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, fontWeight: 500 }}>
                        ระบบวิเคราะห์การใช้พลังงานเชิงโครงสร้างแบบเจาะลึก
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Live indicator block */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: 'var(--surface)', padding: '6px 12px',
                        borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)',
                        boxShadow: 'var(--shadow-sm)', fontSize: 12.5, fontWeight: 600
                    }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.green }}>
                            <Activity size={14} style={{ animation: 'pulse 1.8s infinite' }} /> Realtime
                        </span>
                        <span style={{ width: 1, height: 14, background: 'var(--border)' }} />
                        <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--text-secondary)' }}>
                            {new Date(now).toLocaleTimeString('th-TH')}
                        </span>
                    </div>

                    {/* Mode toggler slider */}
                    <div style={{ display: 'flex', background: 'var(--gray-100)', padding: 4, borderRadius: 'var(--radius-xl)' }}>
                        {([['monitor', 'ภาพรวมโครงสร้าง', Layers], ['compare', 'วิเคราะห์เปรียบเทียบ', BarChart3]] as [string, string, any][]).map(([k, lb, Ic]) => (
                            <button key={k} onClick={() => setMode(k)} style={{
                                display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, padding: '8px 16px',
                                borderRadius: 'var(--radius-lg)', border: 'none', cursor: 'pointer',
                                fontWeight: mode === k ? 700 : 500,
                                background: mode === k ? 'var(--surface)' : 'transparent',
                                color: mode === k ? 'var(--primary-600)' : 'var(--text-secondary)',
                                boxShadow: mode === k ? 'var(--shadow-sm)' : 'none',
                                transition: 'var(--transition)'
                            }}>
                                <Ic size={14} /> {lb}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sensor / Source Selector Strip */}
            <div style={{
                display: 'flex', gap: 8, padding: '12px 18px', background: 'var(--surface)',
                borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-sm)', marginBottom: 18, alignItems: 'center', flexWrap: 'wrap'
            }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', marginRight: 6 }}>
                    ประเภทแหล่งพลังงาน:
                </span>
                {[
                    { k: 'e', icon: Zap, label: 'กระแสไฟฟ้า', on: true, activeBg: 'var(--primary-50)', activeColor: 'var(--primary-600)', activeBorder: 'var(--primary-200)' },
                    { k: 'w', icon: Droplet, label: 'น้ำประปา', on: false },
                    { k: 'g', icon: Flame, label: 'แก๊สเชื้อเพลิง', on: false },
                    { k: 's', icon: Sun, label: 'โซลาร์เซลล์', on: false },
                ].map((t) => {
                    const Ico = t.icon;
                    return (
                        <div key={t.k} title={t.on ? '' : 'ยังไม่เปิดใช้งานในสาขานี้'} style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                            borderRadius: 'var(--radius-lg)', fontSize: 12.5, fontWeight: 600,
                            cursor: t.on ? 'default' : 'not-allowed',
                            background: t.on ? t.activeBg : 'transparent',
                            color: t.on ? t.activeColor : 'var(--text-muted)',
                            border: t.on ? `1px solid ${t.activeBorder}` : '1px solid transparent'
                        }}>
                            <Ico size={14} /> {t.label}
                        </div>
                    );
                })}
            </div>

            {mode === 'monitor' ? (
                <React.Fragment>
                    {/* Navigation Path Breadcrumbs */}
                    <div style={{
                        padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 6,
                        flexWrap: 'wrap', background: 'var(--surface)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-xl)',
                        boxShadow: 'var(--shadow-sm)',
                        marginBottom: 14
                    }}>
                        <button onClick={() => jump(0)} style={crumb(path.length === 0)}>
                            <Home size={13} /> ทุกสาขา
                        </button>
                        {path.map((id, i) => {
                            let n: TreeNode[] = tree; let node: TreeNode | undefined;
                            for (let k = 0; k <= i; k++) { node = n.find((x) => x.id === path[k]); n = node?.children || []; }
                            return (
                                <React.Fragment key={id}>
                                    <ChevronRight size={13} color="var(--border)" />
                                    <button onClick={() => jump(i + 1)} style={crumb(i === path.length - 1)}>{node?.name}</button>
                                </React.Fragment>
                            );
                        })}
                        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                            โครงสร้างระดับ: <span style={{ color: 'var(--primary-600)', fontWeight: 700 }}>{LEVEL_LABEL[level]}</span>
                        </span>
                    </div>

                    {/* Summary Counters Block */}
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
                        {/* kwh total card */}
                        <div style={kpi(true)}>
                            <div style={{ fontSize: 11.5, color: 'var(--primary-700)', fontWeight: 700 }}>การใช้ไฟฟ้าสะสมงวดนี้</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 8 }}>
                                <span style={{
                                    fontFamily: 'ui-monospace, monospace', fontVariantNumeric: 'tabular-nums',
                                    fontSize: 26, fontWeight: 800, color: 'var(--primary-700)'
                                }}>{fmt(totalKwh)}</span>
                                <span style={{ fontSize: 12, color: 'var(--primary-600)', fontWeight: 600 }}>kWh</span>
                            </div>
                        </div>

                        {/* Status grids */}
                        {(['normal', 'warning', 'over', 'offline'] as string[]).map((s) => {
                            const info = STATUS[s];
                            return (
                                <div key={s} style={{
                                    ...kpi(false),
                                    borderTop: `4px solid ${info.color}`
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 600 }}>{info.label}</span>
                                        <StatusDot s={s} size={10} pulse={s === 'over' || s === 'warning'} />
                                    </div>
                                    <div style={{
                                        fontFamily: 'ui-monospace, monospace', fontSize: 24,
                                        fontWeight: 800, color: 'var(--text)', marginTop: 8
                                    }}>
                                        {counts[s]} <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>จุด</span>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Total meters */}
                        <div style={kpi(false)}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                                <Search size={14} color="var(--primary-600)" />
                                <span style={{ fontSize: 11.5, fontWeight: 600 }}>มิเตอร์ที่ตรวจสอบ</span>
                            </div>
                            <div style={{
                                fontFamily: 'ui-monospace, monospace', fontSize: 24,
                                fontWeight: 800, color: 'var(--text)', marginTop: 8
                            }}>
                                {scope.length} <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>เครื่อง</span>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)',
                        gap: 16, padding: '4px 0 20px'
                    }}>
                        {/* Left Panel: Modular Architectural Visualizations */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Layers size={14} color="var(--primary-600)" />
                                    {level === 2 ? (bldgView === 'sld' ? `ผังวงจรไฟฟ้าทางเดียว (Single Line Diagram) · ${currentName}` : `ผังอาคารทางกายภาพ (Side Deck View) · ${currentName}`)
                                        : level === 3 ? `ผังเชิงโซนพื้นที่ (Zone Plan) · ${currentName}`
                                            : level === 4 ? `การกระจายอุปกรณ์ใน Loop · ${currentName}`
                                                : `ข้อมูลแยกตาม${LEVEL_LABEL[level]}`}
                                </div>
                                {level === 2 && (
                                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, background: 'var(--gray-100)', padding: 3, borderRadius: 'var(--radius-lg)' }}>
                                        {([['side', 'ผังอาคารกึ่งสามมิติ', LayoutGrid], ['sld', 'วงจรไฟฟ้าหลัก (SLD)', Network]] as [string, string, any][]).map(([k, lb, Ic]) => (
                                            <button key={k} onClick={() => setBldgView(k)} style={{
                                                display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, padding: '6px 12px',
                                                borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer',
                                                background: bldgView === k ? 'var(--surface)' : 'transparent',
                                                color: bldgView === k ? 'var(--primary-600)' : 'var(--text-secondary)',
                                                fontWeight: bldgView === k ? 700 : 500,
                                                boxShadow: bldgView === k ? 'var(--shadow-sm)' : 'none',
                                                transition: 'var(--transition)'
                                            }}>
                                                <Ic size={13} /> {lb}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Warning alert ribbon */}
                            {(counts.over > 0 || counts.offline > 0) && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    background: 'var(--rose-50)', border: '1px solid rgba(244, 63, 94, 0.2)',
                                    borderRadius: 'var(--radius-lg)', padding: '10px 16px', marginBottom: 12
                                }}>
                                    <Bell size={15} color="var(--rose-500)" style={{ animation: 'bounce 1.5s infinite' }} />
                                    <span style={{ fontSize: 13, color: 'var(--rose-700)', fontWeight: 600 }}>
                                        ระบบตรวจพบเหตุการณ์แจ้งเตือน: <b>{counts.over}</b> จุดใช้ไฟเกินขีดจำกัด และ <b>{counts.offline}</b> จุดออฟไลน์/ปิดใช้งาน
                                    </span>
                                </div>
                            )}

                            {level === 2 ? (
                                bldgView === 'sld' ? (
                                    <SingleLine main={{ name: currentName || '', kwh: totalKwh, status: aggStatus(scope, now) }}
                                        feeders={[...items].sort((a, b) => fnum(a.node.name) - fnum(b.node.name))} onPick={go} />
                                ) : (
                                    <div style={{
                                        border: '1px solid var(--border-light)',
                                        borderRadius: 'var(--radius-xl)',
                                        overflow: 'hidden',
                                        background: 'var(--surface)',
                                        boxShadow: 'var(--shadow-sm)'
                                    }}>
                                        {/* Roof visual component */}
                                        <div style={{ height: 12, background: 'linear-gradient(90deg, var(--gray-900), var(--gray-800))' }} />
                                        
                                        {floorItems.map((it, idx) => {
                                            const info = STATUS[it.status];
                                            return (
                                                <button key={it.node.id} onClick={() => openItem(it)} style={{
                                                    display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
                                                    background: 'var(--surface)', border: 'none',
                                                    borderTop: idx === 0 ? 'none' : '1px solid var(--border-light)',
                                                    borderLeft: `5px solid ${info.color}`, padding: '16px 20px', cursor: 'pointer',
                                                    transition: 'var(--transition)'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = 'var(--gray-50)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'var(--surface)';
                                                }}
                                                >
                                                    <div style={{ width: 64, fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{it.node.name}</div>
                                                    
                                                    {/* Graphical representation bar */}
                                                    <div style={{ flex: 1, height: 26, background: 'var(--gray-50)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', position: 'relative', border: '1px solid var(--border-light)' }}>
                                                        <div style={{
                                                            width: `${(it.kwh / maxFloorKwh) * 100}%`, height: '100%',
                                                            background: info.color, opacity: 0.18, transition: 'width 0.4s ease'
                                                        }} />
                                                        <span style={{ position: 'absolute', left: 10, top: 0, lineHeight: '24px', fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 600 }}>
                                                            {it.count} Meter ติดตั้งแล้ว
                                                        </span>
                                                    </div>
                                                    
                                                    <div style={{ textAlign: 'right', minWidth: 100 }}>
                                                        <span style={{ fontFamily: 'ui-monospace, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{fmt(it.kwh)}</span>
                                                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}> kWh</span>
                                                    </div>
                                                    
                                                    <StatusTag s={it.status} />
                                                </button>
                                            );
                                        })}
                                        {/* Foundation visual component */}
                                        <div style={{ height: 10, background: 'var(--gray-200)' }} />
                                    </div>
                                )
                            ) : level === 3 ? (
                                <ZonePlan items={zoneItems} onPick={openItem} />
                            ) : level === 4 ? (
                                <LoopGrid groups={loopGroups} onPick={(m) => setSelected(m)} />
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
                                    {sorted.map(renderCard)}
                                </div>
                            )}
                        </div>

                        {/* Right Panel: Sleek Live Data Feed List */}
                        <div style={{
                            background: 'var(--surface)', border: '1px solid var(--border-light)',
                            borderRadius: 'var(--radius-xl)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
                            display: 'flex', flexDirection: 'column'
                        }}>
                            <div style={{
                                padding: '14px 18px', borderBottom: '1px solid var(--border-light)',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                background: 'linear-gradient(to right, var(--gray-50), var(--surface))'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Activity size={15} color="var(--primary-600)" />
                                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>ฟีดข้อมูลตามเวลาจริง</span>
                                </div>
                                <button onClick={() => setSortDesc((v) => !v)} style={{
                                    fontSize: 11.5, fontWeight: 600,
                                    color: 'var(--primary-700)', background: 'var(--primary-50)', border: '1px solid var(--primary-100)',
                                    borderRadius: 'var(--radius-sm)', padding: '5px 10px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 4, transition: 'var(--transition)'
                                }}>
                                    <ArrowUpDown size={12} /> {sortDesc ? 'เรียง: มาก → น้อย' : 'เรียง: น้อย → มาก'}
                                </button>
                            </div>
                            
                            <div style={{ maxHeight: 550, overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ position: 'sticky', top: 0, background: 'var(--gray-50)', zIndex: 10 }}>
                                            <th style={th()}>ลำดับ</th>
                                            <th style={th()}>{level === 4 ? 'Meter / รหัสอุปกรณ์' : LEVEL_LABEL[level]}</th>
                                            <th style={{ ...th(), textAlign: 'right' }}>ปริมาณไฟฟ้า</th>
                                            <th style={{ ...th(), textAlign: 'center' }}>สถานะ</th>
                                            <th style={{ ...th(), textAlign: 'right' }}>ฟีดเวลา</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sorted.map((it, i) => {
                                            const ago = it.m ? Math.round((now - it.m.received_at) / 1000) : null;
                                            return (
                                                <tr key={it.node.id} onClick={() => openItem(it)}
                                                    style={{
                                                        borderTop: '1px solid var(--border-light)', cursor: 'pointer',
                                                        transition: 'var(--transition)'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gray-50)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <td style={{ ...td(), color: 'var(--text-secondary)', fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>{i + 1}</td>
                                                    <td style={{ ...td(), fontWeight: 700 }}>
                                                        {it.node.name}
                                                        {it.node.level === 'room' && (
                                                            <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
                                                                {it.m!.channel}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{
                                                        ...td(), textAlign: 'right', fontFamily: 'ui-monospace, monospace',
                                                        fontVariantNumeric: 'tabular-nums', fontWeight: 800
                                                    }}>{fmt(it.kwh)} <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', fontWeight: 500 }}>kWh</span></td>
                                                    
                                                    <td style={{ ...td(), textAlign: 'center' }}>
                                                        <span style={{ display: 'inline-flex' }}><StatusDot s={it.status} size={8} pulse={it.status === 'over'} /></span>
                                                    </td>
                                                    
                                                    <td style={{ ...td(), textAlign: 'right', color: ago && ago > 30 ? 'var(--rose-500)' : 'var(--text-secondary)', fontSize: 11.5, fontWeight: 500 }}>
                                                        {ago === null ? '—' : ago > 30 ? `${ago}s ⚠` : `${ago}s`}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </React.Fragment>
            ) : (
                <Compare meters={meters} tree={tree} now={now} />
            )}

            {/* Meter detail popup dialog */}
            {selected && <MeterDetail m={selected} now={now} onClose={() => setSelected(null)} />}
        </div>
    );
};

export default ZoneDashboard;
