import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Zap, Droplet, Flame, Sun, Home, Activity, ArrowUpDown, X, Gauge, Search,
    Wifi, WifiOff, AlertTriangle, Network, Pencil, Bell, PowerOff, LayoutGrid, BarChart3, Moon,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';

/* ===========================================================================
   Energy Console — ต้นแบบ Dashboard พลังงาน
   Drill-down: สาขา → ตึก → ชั้น → โซน → ห้อง(Meter) + ตาราง Realtime + กราฟ
   ข้อมูลจำลองอิง schema meter_data_realtime (3-phase + import_kwhr + received_at)
=========================================================================== */

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
    green: string;
    yellow: string;
    red: string;
    grey: string;
    palette: string[];
}

const THEMES: Record<'light' | 'dark', Theme> = {
    light: { // Engineering Paper
        bg: '#EAE7DA', panel: '#FBFAF4', panel2: '#F1EFE3', ink: '#23261E', sub: '#6E705F',
        line: '#D4D1C0', bar: '#23261E', barSub: '#A6A892', accent: '#2B4C7E',
        green: '#2E7D46', yellow: '#C08A1E', red: '#B4452E', grey: '#9AA08C',
        palette: ['#2B4C7E', '#B45309', '#2E7D46', '#8C2F39', '#5B6B2E', '#6B4E86', '#9A6B2F', '#356E73'],
    },
    dark: { // Control Room
        bg: '#0E1116', panel: '#161B22', panel2: '#1C232E', ink: '#E6EDF3', sub: '#8B98A6',
        line: '#2A313C', bar: '#080A0E', barSub: '#8B98A6', accent: '#36C2CE',
        green: '#3FB950', yellow: '#D29922', red: '#F85149', grey: '#6E7681',
        palette: ['#58A6FF', '#36C2CE', '#3FB950', '#F85149', '#BC8CFF', '#D29922', '#39C5CF', '#FF7B72'],
    },
};

const getStatusInfo = (s: string, C: Theme) => {
    switch (s) {
        case 'over':
            return { color: C.red, label: 'เกินเกณฑ์' };
        case 'offline':
            return { color: C.grey, label: 'ไม่มีสัญญาณ' };
        default:
            return { color: C.green, label: 'ปกติ' };
    }
};

const getModeInfo = (m: string, C: Theme) => {
    switch (m) {
        case 'manual':
            return { label: 'MANUAL', color: C.yellow };
        case 'disabled':
            return { label: 'OFF', color: C.grey };
        default:
            return { label: 'AUTO', color: C.accent };
    }
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

/* ---------- Seeded RNG ---------- */
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
                        const period0 = rnd() * threshold * 1.25;
                        const m = {
                            id: rId, code, channel: `CH${String(ch++).padStart(4, '0')}`,
                            site_id: bi + 1, address_id: addr++, device: `PM${2200 + ri(0, 99)}`,
                            type: '3P4W', loop: Math.floor((r - 1) / 32) + 1,
                            pathIds: [`b${bi}`, bdId, fId, zId],
                            pathNames: [bn, `ตึก ${String.fromCharCode(65 + j)}`, `ชั้น ${f}`, `โซน ${String.fromCharCode(65 + z)}`],
                            threshold, disabled, inputMode,
                            periodStart_kwhr: +startCum.toFixed(3),
                            import_kwhr: +(startCum + period0).toFixed(3),
                            _pf: 0.86 + rnd() * 0.1, _v: 228 + rnd() * 6,
                            kw_3ph: 3 + rnd() * 42,
                            received_at: disabled ? Date.now() - 600000
                                : Date.now() - (rnd() < 0.08 ? 60000 + rnd() * 60000 : rnd() * 8000),
                            device_datetime: Date.now(),
                        } as MeterData;
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
    return 'normal';
}
function aggStatus(list: MeterData[], now: number): string {
    let n = false;
    for (const m of list) {
        const s = meterStatus(m, now);
        if (s === 'over') return 'over';
        if (s === 'normal') n = true;
    }
    return n ? 'normal' : 'offline';
}
const fmt = (v: number, d = 0) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const LEVEL_LABEL = ['สาขา', 'ตึก', 'ชั้น', 'โซน', 'ห้อง (Meter)'];
const LEVEL_EN = ['BRANCH', 'BUILDING', 'FLOOR', 'ZONE', 'ROOM'];

/* ----------------------------- atoms ----------------------------- */
interface StatusDotProps {
    s: string;
    size?: number;
    pulse?: boolean;
    C: Theme;
}
function StatusDot({ s, size = 9, pulse, C }: StatusDotProps) {
    const c = getStatusInfo(s, C).color;
    return (
        <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size }}>
            <span style={{
                width: size, height: size, background: c, borderRadius: 2,
                boxShadow: `0 0 5px ${c}AA, inset 0 0 0 1px rgba(255,255,255,.4)`
            }} />
            {pulse && s !== 'offline' && (
                <span style={{
                    position: 'absolute', inset: 0, borderRadius: 2, background: c, opacity: 0.5,
                    animation: 'ec-ping 1.7s cubic-bezier(0,0,.2,1) infinite'
                }} />
            )}
        </span>
    );
}

interface CapProps {
    idx?: string;
    en: string;
    th?: string;
    right?: React.ReactNode;
    C: Theme;
}
function Cap({ idx, en, th, right, C }: CapProps) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
            {idx && <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: '#fff', background: C.bar, padding: '2px 6px' }}>{idx}</span>}
            <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: C.accent, fontWeight: 700 }}>{en}</span>
            {th && <span style={{ fontSize: 12.5, color: C.sub }}>{th}</span>}
            <span style={{ flex: 1, height: 1, background: C.line }} />
            {right}
        </div>
    );
}

interface ReadoutProps {
    label: string;
    value: string;
    unit: string;
    accent?: string;
    C: Theme;
}
function Readout({ label, value, unit, accent, C }: ReadoutProps) {
    return (
        <div style={{ background: C.panel2, border: `1px solid ${C.line}`, padding: '9px 11px' }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 0.5, color: C.sub, marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 18, fontWeight: 600, color: accent || C.ink }}>{value}</span>
                <span style={{ fontSize: 11, color: C.sub }}>{unit}</span>
            </div>
        </div>
    );
}

/* ──────────────────── Single Line Diagram ──────────────────── */
interface SingleLineProps {
    main: { name: string | undefined; kwh: number; status: string };
    feeders: ItemData[];
    onPick: (id: string) => void;
    C: Theme;
}
function SingleLine({ main, feeders, onPick, C }: SingleLineProps) {
    const ms = getStatusInfo(main.status, C);
    return (
        <div style={{ border: `1px solid ${C.line}`, background: C.panel, padding: '22px 14px 26px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ border: `2px solid ${ms.color}`, padding: '10px 18px', minWidth: 170, textAlign: 'center', background: C.panel2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <StatusDot s={main.status} C={C} />
                        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 12, letterSpacing: 0.5 }}>MAIN · {main.name}</span>
                    </div>
                    <div style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 19, fontWeight: 700, marginTop: 2 }}>{fmt(main.kwh)} <span style={{ fontSize: 11, color: C.sub }}>kWh</span></div>
                </div>
                <div style={{ width: 2, height: 20, background: C.ink }} />
                <div style={{ height: 2, background: C.ink, width: `${Math.min(100, feeders.length * 22)}%`, maxWidth: '100%' }} />
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {feeders.map((f, i) => {
                        const st = getStatusInfo(f.status, C);
                        return (
                            <div key={f.node.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ width: 2, height: 18, background: C.ink }} />
                                <button className="ec-card" onClick={() => onPick(f.node.id)} style={{
                                    cursor: 'pointer', border: `1px solid ${C.line}`, borderTop: `3px solid ${st.color}`, padding: '9px 11px', background: C.panel, textAlign: 'center', minWidth: 96
                                }}>
                                    <div style={{ fontFamily: MONO, fontSize: 10, color: C.sub }}>F{i + 1}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                                        <StatusDot s={f.status} size={8} C={C} /><span style={{ fontWeight: 600, fontSize: 12 }}>{f.node.name}</span>
                                    </div>
                                    <div style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 700 }}>{fmt(f.kwh)} <span style={{ fontSize: 10, color: C.sub }}>kWh</span></div>
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/* ──────────────────── Zone Floor Plan ──────────────────── */
interface ZonePlanProps {
    items: ItemData[];
    onPick: (it: ItemData) => void;
    C: Theme;
}
function ZonePlan({ items, onPick, C }: ZonePlanProps) {
    return (
        <div style={{ border: `2px solid ${C.ink}`, background: C.panel, padding: 6 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {items.map((it) => {
                    const st = getStatusInfo(it.status, C);
                    return (
                        <button key={it.node.id} className="ec-card" onClick={() => onPick(it)} style={{
                            textAlign: 'left', cursor: 'pointer', border: `1px solid ${C.line}`, borderTop: `3px solid ${st.color}`,
                            background: C.panel2, padding: 15, minHeight: 108, display: 'flex', flexDirection: 'column'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <StatusDot s={it.status} pulse C={C} /><span style={{ fontWeight: 700, fontSize: 14 }}>{it.node.name}</span>
                            </div>
                            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'baseline', gap: 5 }}>
                                <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 24, fontWeight: 700 }}>{fmt(it.kwh)}</span>
                                <span style={{ fontFamily: MONO, fontSize: 11, color: C.sub }}>kWh</span>
                            </div>
                            <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.sub }}>{it.count} METERS</div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/* ──────────────────── Loop / Room Grid ──────────────────── */
interface LoopGridProps {
    groups: { loop: number; items: ItemData[] }[];
    onPick: (m: MeterData) => void;
    C: Theme;
}
function LoopGrid({ groups, onPick, C }: LoopGridProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {groups.map((g) => (
                <div key={g.loop} style={{ border: `1px solid ${C.line}`, background: C.panel, padding: 11 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11.5, letterSpacing: 1, background: C.bar, color: '#fff', padding: '3px 9px' }}>LOOP {g.loop}</span>
                        <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.sub }}>{g.items.length} / 32 METER</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(76px,1fr))', gap: 7 }}>
                        {g.items.map((it) => {
                            const dim = it.m!.inputMode === 'disabled';
                            return (
                                <button key={it.node.id} className="ec-card" onClick={() => onPick(it.m!)} title={`${it.node.name} · ${getModeInfo(it.m!.inputMode, C).label}`} style={{
                                    cursor: 'pointer', border: `1px solid ${C.line}`, padding: '9px 6px 7px', background: dim ? C.panel2 : C.panel,
                                    opacity: dim ? 0.7 : 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, position: 'relative'
                                }}>
                                    {it.m!.inputMode === 'manual' && <span style={{ position: 'absolute', top: 3, right: 3, color: C.yellow }}><Pencil size={9} /></span>}
                                    <StatusDot s={it.status} size={14} C={C} />
                                    <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>{it.node.name}</span>
                                    <span style={{ fontFamily: MONO, fontSize: 10, color: C.sub }}>{dim ? '—' : `${fmt(it.kwh)} kWh`}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}

/* ──────────────────── Detailed Meter Table (Level 4) ──────────────────── */
interface MeterTableProps {
    groups: { loop: number; items: ItemData[] }[];
    now: number;
    onPick: (m: MeterData) => void;
    C: Theme;
}
function MeterTable({ groups, now, onPick, C }: MeterTableProps) {
    const avg = (a: number, b: number, c: number) => (a + b + c) / 3;
    const thx = (): React.CSSProperties => ({ padding: '8px 9px', fontWeight: 700, fontSize: 10, letterSpacing: 0.8, textAlign: 'right', fontFamily: MONO });
    const tdx = (): React.CSSProperties => ({ padding: '7px 9px', textAlign: 'right', fontFamily: MONO, fontVariantNumeric: 'tabular-nums' });

    return (
        <div style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div style={{ maxHeight: 600, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                    <thead>
                        <tr style={{ position: 'sticky', top: 0, background: C.bar, color: '#fff', fontFamily: MONO, zIndex: 1 }}>
                            <th style={{ ...thx(), textAlign: 'left' }}>#</th>
                            <th style={{ ...thx(), textAlign: 'left' }}>METER</th>
                            <th style={{ ...thx(), textAlign: 'center' }}>STS</th>
                            <th style={{ ...thx(), textAlign: 'center' }}>MODE</th>
                            <th style={thx()}>kWh</th>
                            <th style={thx()}>kW</th>
                            <th style={thx()}>V</th>
                            <th style={thx()}>A</th>
                            <th style={thx()}>PF</th>
                            <th style={thx()}>Hz</th>
                            <th style={thx()}>AGE</th>
                        </tr>
                    </thead>
                    <tbody>
                        {groups.map((g) => (
                            <React.Fragment key={g.loop}>
                                <tr style={{ background: C.panel2 }}>
                                    <td colSpan={11} style={{ padding: '6px 11px', fontFamily: MONO, fontSize: 10.5, letterSpacing: 1, color: C.sub, borderTop: `1px solid ${C.line}` }}>
                                        <b style={{ color: C.ink }}>LOOP {g.loop}</b> · {g.items.length}/32 METER
                                    </td>
                                </tr>
                                {g.items.map((it, i) => {
                                    const m = it.m!;
                                    const md = getModeInfo(m.inputMode, C);
                                    const off = m.inputMode === 'disabled' || it.status === 'offline';
                                    const ago = Math.round((now - m.received_at) / 1000);
                                    const dash = (x: number, d = 0) => (off ? '—' : fmt(x, d));
                                    return (
                                        <tr key={it.node.id} className="ec-row" onClick={() => onPick(m)} style={{ borderTop: `1px solid ${C.line}`, opacity: off ? 0.6 : 1 }}>
                                            <td style={{ ...tdx(), textAlign: 'left', color: C.sub }}>{String(i + 1).padStart(2, '0')}</td>
                                            <td style={{ ...tdx(), textAlign: 'left', whiteSpace: 'nowrap' }}><b>{m.code}</b> <span style={{ color: C.sub }}>{m.device}</span></td>
                                            <td style={{ ...tdx(), textAlign: 'center' }}><span style={{ display: 'inline-flex' }}><StatusDot s={it.status} C={C} /></span></td>
                                            <td style={{ ...tdx(), textAlign: 'center', color: md.color, fontSize: 10 }}>{md.label}</td>
                                            <td style={{ ...tdx(), fontWeight: 700 }}>{dash(it.kwh)}</td>
                                            <td style={tdx()}>{dash(m.kw_3ph, 2)}</td>
                                            <td style={tdx()}>{dash(avg(m.vl1, m.vl2, m.vl3), 0)}</td>
                                            <td style={tdx()}>{dash(avg(m.il1, m.il2, m.il3), 1)}</td>
                                            <td style={tdx()}>{off ? '—' : avg(m.pf1, m.pf2, m.pf3).toFixed(2)}</td>
                                            <td style={tdx()}>{dash(m.hz, 2)}</td>
                                            <td style={{ ...tdx(), color: C.sub, fontSize: 10 }}>{off ? '—' : ago > 30 ? `${ago}s!` : `${ago}s`}</td>
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
            <div style={{ padding: '7px 12px', borderTop: `1px solid ${C.line}`, fontFamily: MONO, fontSize: 10, color: C.sub, letterSpacing: 0.3 }}>
                คลิกแถวเพื่อดูค่า 3 เฟสเต็ม · V = เฉลี่ย L-N · A = เฉลี่ย L1–L3 · PF = เฉลี่ย
            </div>
        </div>
    );
}

/* ──────────────────── Meter Detail ──────────────────── */
interface MeterDetailProps {
    m: MeterData;
    now: number;
    onClose: () => void;
    C: Theme;
}
function MeterDetail({ m, now, onClose, C }: MeterDetailProps) {
    const s = meterStatus(m, now);
    const st = getStatusInfo(s, C);
    const md = getModeInfo(m.inputMode, C);
    const ago = Math.round((now - m.received_at) / 1000);
    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: '#23261ECC', display: 'grid', placeItems: 'center', padding: 16, zIndex: 1050 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, width: 'min(690px,100%)', maxHeight: '90vh', overflow: 'auto', border: `1px solid ${C.ink}` }}>
                <div style={{ padding: '13px 16px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 11, background: C.bar, color: '#fff' }}>
                    <StatusDot s={s} size={13} pulse C={C} />
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 15, letterSpacing: 0.5 }}>{m.code}<span style={{ fontSize: 11, color: C.barSub, fontWeight: 400 }}> · {m.device}</span></div>
                        <div style={{ fontSize: 11, color: C.barSub }}>{m.pathNames.join('  ›  ')}</div>
                    </div>
                    <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: '#fff', border: `1px solid ${md.color}`, padding: '3px 7px' }}>
                        {m.inputMode === 'manual' ? '✎ ' : m.inputMode === 'disabled' ? '⏻ ' : '⚡ '}{md.label}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: st.color, fontFamily: MONO, fontSize: 11.5, fontWeight: 700 }}>
                        {s === 'offline' ? <WifiOff size={13} /> : <Wifi size={13} />} {st.label}
                    </span>
                    <button onClick={onClose} style={{ background: 'transparent', border: `1px solid #ffffff33`, width: 28, height: 28, cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#fff' }}><X size={15} /></button>
                </div>

                <div style={{ padding: 16 }}>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 190, background: C.bar, color: '#fff', padding: 14 }}>
                            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 0.5, color: C.barSub }}>IMPORT_KWHR · สะสม</div>
                            <div style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 25, fontWeight: 700 }}>{fmt(m.import_kwhr, 1)} <span style={{ fontSize: 12 }}>kWh</span></div>
                            <div style={{ fontFamily: MONO, fontSize: 11, color: C.barSub, marginTop: 6 }}>งวดนี้ <b style={{ color: '#8FBF9C' }}>{fmt(period(m), 1)}</b> / เกณฑ์ {fmt(m.threshold)}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 190, background: C.panel2, border: `1px solid ${C.line}`, padding: 14 }}>
                            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 0.5, color: C.accent }}>KW_3PH · กำลังไฟ</div>
                            <div style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 25, fontWeight: 700, color: C.ink }}>{fmt(m.kw_3ph, 2)} <span style={{ fontSize: 12 }}>kW</span></div>
                            <div style={{ fontFamily: MONO, fontSize: 11, color: C.sub, marginTop: 6 }}>kVA {fmt(m.kva_3ph, 1)} · kVAR {fmt(m.kvar_3ph, 1)} · {ago}s</div>
                        </div>
                    </div>

                    <Cap en="3-PHASE" th="ค่าวัดแบบ 3 เฟส" C={C} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8 }}>
                        <Readout label="V L-N 1/2/3" value={`${fmt(m.vl1)}/${fmt(m.vl2)}/${fmt(m.vl3)}`} unit="V" C={C} />
                        <Readout label="V L-L 12/23/31" value={`${fmt(m.vl12)}/${fmt(m.vl23)}/${fmt(m.vl31)}`} unit="V" C={C} />
                        <Readout label="I L1/L2/L3" value={`${fmt(m.il1, 1)}/${fmt(m.il2, 1)}/${fmt(m.il3, 1)}`} unit="A" C={C} />
                        <Readout label="kW L1/L2/L3" value={`${fmt(m.kw1, 1)}/${fmt(m.kw2, 1)}/${fmt(m.kw3, 1)}`} unit="kW" C={C} />
                        <Readout label="PF L1/L2/L3" value={`${m.pf1.toFixed(2)}/${m.pf2.toFixed(2)}/${m.pf3.toFixed(2)}`} unit="" accent={C.accent} C={C} />
                        <Readout label="FREQ" value={fmt(m.hz, 2)} unit="Hz" C={C} />
                    </div>

                    <div style={{ marginTop: 14, fontFamily: MONO, fontSize: 10.5, color: C.sub, lineHeight: 1.8, background: C.panel2, border: `1px solid ${C.line}`, padding: '10px 12px' }}>
                        site_id={m.site_id} · address_id={m.address_id} · channel={m.channel} · type={m.type} ·
                        device_dt={new Date(m.device_datetime).toLocaleTimeString('th-TH')} · received={new Date(m.received_at).toLocaleTimeString('th-TH')}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ──────────────────── Compare / Analytics Mode ──────────────────── */
interface CompareProps {
    meters: MeterData[];
    tree: TreeNode[];
    now: number;
    C: Theme;
}
function Compare({ meters, tree, now, C }: CompareProps) {
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

    const totals = entities.map((e) => ({ name: e.name, value: +data.reduce((s, r) => s + (r[e.name] || 0), 0).toFixed(1) })).sort((a, b) => b.value - a.value);
    const grand = totals.reduce((s, t) => s + t.value, 0) || 1;
    const colorOf: Record<string, string> = {}; entities.forEach((e, i) => (colorOf[e.name] = C.palette[i % C.palette.length]));

    const yr = 2569;
    const windowText = gran === 'year'
        ? `รอบปี ${yr - 1} · 00:00 น. 1 ม.ค. ${yr} − 00:00 น. 1 ม.ค. ${yr - 1}`
        : gran === 'month'
            ? (billing ? `รอบบิล (ตัดวันที่ 20) · 00:00 น. 20 ธ.ค. ${yr - 1} − 00:00 น. 20 ม.ค. ${yr}` : `รอบปฏิทิน · 1 ม.ค. − 31 ม.ค. ${yr}`)
            : gran === 'week' ? 'สัปดาห์ล่าสุด · จันทร์ − อาทิตย์' : 'วันล่าสุด · 00:00 − 24:00 น. (รายชั่วโมง)';

    const DIMS = [['overview', 'ภาพรวม'], ['branch', 'ตามสาขา'], ['building', 'ตามตึก'], ['mdb', 'ตาม MDB']];
    const GRANS = [['year', 'รายปี'], ['month', 'รายเดือน'], ['week', 'รายสัปดาห์'], ['day', 'รายวัน']];
    const chip = (a: boolean): React.CSSProperties => ({
        fontFamily: MONO, fontSize: 11.5, letterSpacing: 0.3, padding: '6px 12px', border: `1px solid ${a ? C.accent : C.line}`,
        cursor: 'pointer', background: a ? C.accent : C.panel, color: a ? '#fff' : C.sub, marginRight: 6, marginBottom: 6,
        borderRadius: 0,
    });
    const axisTick = { fontSize: 10.5, fill: C.sub, fontFamily: MONO };

    return (
        <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 12 }}>
                <div>
                    <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: C.sub, marginBottom: 6, textTransform: 'uppercase' }}>เปรียบเทียบตาม</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap' }}>{DIMS.map(([k, lb]) => <button key={k} onClick={() => setDim(k)} style={chip(dim === k)}>{lb}</button>)}</div>
                </div>
                <div>
                    <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: C.sub, marginBottom: 6, textTransform: 'uppercase' }}>ช่วงเวลา</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap' }}>{GRANS.map(([k, lb]) => <button key={k} onClick={() => setGran(k)} style={chip(gran === k)}>{lb}</button>)}</div>
                </div>
                {gran === 'month' && (
                    <div>
                        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: C.sub, marginBottom: 6, textTransform: 'uppercase' }}>การตัดรอบ</div>
                        <button onClick={() => setBilling((v) => !v)} style={chip(billing)}>{billing ? 'รอบบิล 20→20' : 'รอบปฏิทิน'}</button>
                    </div>
                )}
            </div>

            <div style={{
                display: 'flex', alignItems: 'center', gap: 8, background: C.panel, border: `1px solid ${C.line}`,
                borderLeft: `3px solid ${C.accent}`, padding: '8px 13px', fontFamily: MONO, fontSize: 11.5, color: C.ink, marginBottom: 14, letterSpacing: 0.2
            }}>
                <Gauge size={14} color={C.accent} /> WINDOW · {windowText}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 14 }}>
                <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: '12px 10px 6px' }}>
                    <Cap en="ENERGY" th={`(kWh) ${gran === 'year' ? 'รายเดือน' : gran === 'day' ? 'รายชั่วโมง' : 'รายวัน'} · ${DIMS.find((d) => d[0] === dim)![1].replace('ตาม', '').replace('ภาพรวม', 'สาขา')}`} C={C} />
                    <div style={{ height: 330 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 2 }}>
                                <CartesianGrid strokeDasharray="2 3" stroke={C.line} vertical={false} />
                                <XAxis dataKey="label" tick={axisTick} interval={gran === 'month' ? 2 : 0} tickLine={{ stroke: C.line }} axisLine={{ stroke: C.line }} />
                                <YAxis tick={axisTick} width={46} tickLine={{ stroke: C.line }} axisLine={{ stroke: C.line }} />
                                <Tooltip contentStyle={{ fontSize: 12, fontFamily: MONO, borderRadius: 0, border: `1px solid ${C.line}`, background: C.panel, color: C.ink }} formatter={(v) => [`${fmt(Number(v))} kWh`, '']} />
                                <Legend wrapperStyle={{ fontSize: 11, fontFamily: MONO, color: C.sub }} />
                                {entities.map((e, i) => <Bar key={e.id} dataKey={e.name} stackId="a" fill={C.palette[i % C.palette.length]} />)}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: 12 }}>
                    <Cap en="SHARE" th="สัดส่วน %" C={C} />
                    <div style={{ height: 175 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={totals} dataKey="value" nameKey="name" innerRadius={40} outerRadius={68} paddingAngle={1} stroke={C.panel}>
                                    {totals.map((t) => <Cell key={t.name} fill={colorOf[t.name]} />)}
                                </Pie>
                                <Tooltip formatter={(v) => `${fmt(Number(v))} kWh`} contentStyle={{ fontSize: 12, fontFamily: MONO, borderRadius: 0, border: `1px solid ${C.line}`, background: C.panel, color: C.ink }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {totals.map((t) => (
                            <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                <span style={{ width: 10, height: 10, background: colorOf[t.name] }} />
                                <span style={{ flex: 1 }}>{t.name}</span>
                                <span style={{ fontFamily: MONO, color: C.sub, fontSize: 11 }}>{fmt(t.value)}</span>
                                <b style={{ fontFamily: MONO, minWidth: 44, textAlign: 'right' }}>{((t.value / grand) * 100).toFixed(1)}%</b>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

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
    const { theme } = useTheme(); // light = Engineering Paper, dark = Control Room
    const C = THEMES[theme];

    const crumb = (active: boolean): React.CSSProperties => ({
        display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', border: 'none', cursor: 'pointer',
        fontFamily: MONO, fontSize: 12, fontWeight: active ? 700 : 400,
        background: active ? C.accent : 'transparent', color: active ? '#fff' : C.sub,
    });

    const histRef = useRef<{ t: number; kw: number }[]>([]); // บัฟเฟอร์กราฟ Realtime (kW ของขอบเขตปัจจุบัน)
    const [, setHistVer] = useState(0);
    const [trendTick, setTrendTick] = useState(0); // ตัวจับเวลากราฟ (ทุก 1 นาที)

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
        const c = setInterval(() => setTrendTick((t) => t + 1), 60000); // กราฟ Realtime: เก็บจุดทุก 1 นาที
        return () => { clearInterval(a); clearInterval(b); clearInterval(c); };
    }, [meters]);

    const now = clock;
    const metersUnder = (p: string[]) => meters.filter((m) => p.every((id, i) => m.pathIds[i] === id));
    const scopeKw = () => metersUnder(path).reduce((s, m) => s + (m.disabled ? 0 : m.kw_3ph), 0);

    // กราฟ Realtime: รีเซ็ตเมื่อเปลี่ยนขอบเขต, เก็บตัวอย่างทุก 1 นาที (สูงสุด ~1 ชั่วโมง)
    useEffect(() => {
        histRef.current = [{ t: Date.now(), kw: +scopeKw().toFixed(1) }];
        setHistVer((v) => v + 1);
    }, [path.join('/')]);

    useEffect(() => {
        if (mode !== 'monitor') return;
        const buf = histRef.current;
        buf.push({ t: Date.now(), kw: +scopeKw().toFixed(1) });
        if (buf.length > 60) buf.shift();
        setHistVer((v) => v + 1);
    }, [trendTick]);

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

    const fnum = (n: string) => parseInt((String(n).match(/\d+/) || ['0'])[0], 10);
    const floorView = level === 2;
    const floorItems = floorView ? [...items].sort((a, b) => fnum(b.node.name) - fnum(a.node.name)) : [];
    const maxFloorKwh = floorView ? Math.max(1, ...items.map((i) => i.kwh)) : 1;
    const currentName = (() => { let n = tree; let node: TreeNode | undefined; for (let k = 0; k < path.length; k++) { node = n.find((x) => x.id === path[k]); n = node?.children || []; } return node?.name; })();

    const loopGroups = level === 4
        ? Object.values(items.reduce((a: Record<number, { loop: number; items: ItemData[] }>, it) => {
            const L = it.m!.loop;
            (a[L] = a[L] || { loop: L, items: [] }).items.push(it);
            return a;
        }, {})).sort((a, b) => a.loop - b.loop)
        : [];
    const zoneItems = level === 3 ? [...items].sort((a, b) => a.node.name.localeCompare(b.node.name, 'th')) : [];

    const renderCard = (it: ItemData) => {
        const st = getStatusInfo(it.status, C);
        const over = it.node.level === 'room' && it.m && period(it.m) > it.m.threshold;
        return (
            <button key={it.node.id} className="ec-card" onClick={() => openItem(it)} style={{
                textAlign: 'left', background: C.panel, border: `1px solid ${C.line}`, borderTop: `2px solid ${st.color}`,
                padding: 12, cursor: 'pointer', borderRadius: 0,
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: C.ink }}>{it.node.name}</span>
                    <StatusDot s={it.status} pulse C={C} />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 10 }}>
                    <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 22, fontWeight: 700, color: C.ink }}>{fmt(it.kwh)}</span>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: C.sub }}>kWh</span>
                </div>
                <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 10.5, color: C.sub, display: 'flex', justifyContent: 'space-between', letterSpacing: 0.3 }}>
                    <span>{it.node.level === 'room' ? `${it.m!.device} · L${it.m!.loop}` : `${it.count} MTR`}</span>
                    {over && <span style={{ color: C.red, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <AlertTriangle size={10} /> {fmt((period(it.m!) / it.m!.threshold) * 100)}%</span>}
                </div>
            </button>
        );
    };

    const scope = metersUnder(path);
    const counts = scope.reduce((acc: Record<string, number>, m) => { acc[meterStatus(m, now)]++; return acc; }, { normal: 0, over: 0, offline: 0 });
    const totalKwh = scope.reduce((s, m) => s + period(m), 0);

    const go = (id: string) => { setPath([...path, id]); setSelected(null); };
    const jump = (i: number) => { setPath(path.slice(0, i)); setSelected(null); };
    const openItem = (it: ItemData) => { it.node.level === 'room' ? setSelected(it.m!) : go(it.node.id); };

    const tabBar = (active: boolean): React.CSSProperties => ({
        display: 'flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 11.5, letterSpacing: 0.5,
        padding: '6px 12px', border: 'none', cursor: 'pointer', textTransform: 'uppercase',
        background: active ? C.accent : 'transparent', color: active ? '#fff' : C.barSub, borderRadius: 0,
    });

    const th = (): React.CSSProperties => ({ padding: '8px 11px', fontWeight: 700, fontSize: 10.5, letterSpacing: 1 });
    const td = (): React.CSSProperties => ({ padding: '8px 11px' });

    return (
        <div className="ec-grid" style={{ fontFamily: "'Noto Sans Thai', system-ui, sans-serif", background: C.bg, minHeight: 660, color: C.ink }}>
            <style>{`
                @keyframes ec-ping{75%,100%{transform:scale(2.4);opacity:0}}
                .ec-grid{
                    background-image: linear-gradient(${theme === 'light' ? 'rgba(35,38,30,.04)' : 'rgba(230,237,243,.02)'} 1px,transparent 1px),
                                      linear-gradient(90deg,${theme === 'light' ? 'rgba(35,38,30,.04)' : 'rgba(230,237,243,.02)'} 1px,transparent 1px);
                    background-size: 24px 24px;
                    padding-bottom: 24px;
                }
                .ec-card{transition:border-color .12s,transform .08s; border-radius: 0px !important;}
                .ec-card:hover{border-top-width:2px;transform:translateY(-1px);outline:1px solid ${C.ink}33;}
                .ec-row{transition:background .1s;cursor:pointer;}
                .ec-row:hover{background:${C.panel2};}
            `}</style>

            {/* Command bar */}
            <div style={{ background: C.bar, color: '#fff', display: 'flex', alignItems: 'stretch', borderBottom: `2px solid ${C.accent}`, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderRight: `1px solid #ffffff1a` }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}><Gauge size={16} /></div>
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>ENERGY//CONSOLE</div>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>ระบบติดตามการใช้พลังงาน · ต้นแบบ</div>
                    </div>
                </div>

                <div style={{ display: 'flex' }}>
                    {([['monitor', 'REALTIME', Activity], ['compare', 'เปรียบเทียบ', BarChart3]] as [string, string, any][]).map(([k, lb, Ic]) => (
                        <button key={k} onClick={() => setMode(k)} style={{ ...tabBar(mode === k), borderRight: `1px solid #ffffff14` }}>
                            <Ic size={14} /> {lb}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 1, padding: '0 8px', borderLeft: `1px solid #ffffff14` }}>
                    {[
                        { k: 'e', icon: Zap, label: 'ไฟฟ้า', on: true },
                        { k: 'w', icon: Droplet, label: 'น้ำ' },
                        { k: 'g', icon: Flame, label: 'แก๊ส' },
                        { k: 's', icon: Sun, label: 'Solar' },
                    ].map((t) => {
                        const Ico = t.icon;
                        return (
                            <div key={t.k} title={t.on ? '' : 'เร็วๆ นี้'} style={{
                                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', fontFamily: MONO, fontSize: 11,
                                cursor: t.on ? 'default' : 'not-allowed', color: t.on ? '#fff' : '#6b6e5f',
                                borderBottom: t.on ? `2px solid ${C.accent}` : '2px solid transparent'
                            }}>
                                <Ico size={13} /> {t.label}
                            </div>
                        );
                    })}
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', fontFamily: MONO, fontSize: 11.5 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#fff' }}>
                        <StatusDot s="normal" size={8} pulse C={C} /> LIVE
                    </span>
                    <span style={{ color: C.barSub, fontVariantNumeric: 'tabular-nums' }}>{new Date(now).toLocaleTimeString('th-TH')}</span>
                </div>
            </div>

            {mode === 'monitor' ? (
                <React.Fragment>
                    {/* Breadcrumb */}
                    <div style={{
                        padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                        background: C.panel, borderBottom: `1px solid ${C.line}`, fontFamily: MONO, fontSize: 12,
                        margin: '0 16px 12px'
                    }}>
                        <button onClick={() => jump(0)} style={crumb(path.length === 0)}><Home size={12} /> ROOT</button>
                        {path.map((id, i) => {
                            let n = tree; let node: TreeNode | undefined;
                            for (let k = 0; k <= i; k++) { node = n.find((x) => x.id === path[k]); n = node?.children || []; }
                            return (
                                <React.Fragment key={id}>
                                    <span style={{ color: C.sub }}>/</span>
                                    <button onClick={() => jump(i + 1)} style={crumb(i === path.length - 1)}>{node?.name}</button>
                                </React.Fragment>
                            );
                        })}
                        <span style={{ marginLeft: 'auto', color: C.sub, letterSpacing: 1 }}>
                            LEVEL: <b style={{ color: C.accent }}>{LEVEL_EN[level]}</b>
                        </span>
                    </div>

                    {/* Summary strip */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', background: C.panel, borderBottom: `1px solid ${C.line}`, margin: '0 16px 16px', border: `1px solid ${C.line}` }}>
                        <div style={{ padding: '11px 18px', borderRight: `1px solid ${C.line}`, minWidth: 180 }}>
                            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: C.sub, textTransform: 'uppercase' }}>Total · งวดนี้</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                                <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 24, fontWeight: 700, color: C.accent }}>{fmt(totalKwh)}</span>
                                <span style={{ fontFamily: MONO, fontSize: 11, color: C.sub }}>kWh</span>
                            </div>
                        </div>
                        {['normal', 'over', 'offline'].map((s) => (
                            <div key={s} style={{ padding: '11px 16px', borderRight: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 9, minWidth: 110 }}>
                                <StatusDot s={s} size={11} C={C} />
                                <div>
                                    <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: 0.5, color: C.sub, textTransform: 'uppercase' }}>{getStatusInfo(s, C).label}</div>
                                    <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, color: C.ink }}>{counts[s]}</div>
                                </div>
                            </div>
                        ))}
                        <div style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 9 }}>
                            <Search size={15} color={C.accent} />
                            <div>
                                <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: 0.5, color: C.sub }}>METERS</div>
                                <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, color: C.ink }}>{scope.length}</div>
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div style={{ display: 'grid', gridTemplateColumns: level === 4 ? '1fr' : 'minmax(0,1.55fr) minmax(0,1fr)', gap: 14, padding: '0 16px 16px' }}>
                        <div>
                            <Cap idx={`0${level + 1}`} en={level === 2 ? (bldgView === 'sld' ? 'SINGLE LINE' : 'FLOOR VIEW') : level === 3 ? 'ZONE PLAN' : level === 4 ? 'UNITS' : LEVEL_EN[level]}
                                th={level === 2 ? `${currentName} · ${bldgView === 'sld' ? 'ไดอะแกรมเส้นเดียว' : 'ผังด้านข้าง (บน→ล่าง)'}` : level === 3 ? `${currentName} · ผังพื้นที่` : level === 4 ? `${currentName} · ตาราง Realtime (ทุกค่า)` : 'เรียงมาก→น้อย'}
                                C={C}
                                right={level === 2 && (
                                    <div style={{ display: 'flex', border: `1px solid ${C.line}` }}>
                                        {([['side', LayoutGrid], ['sld', Network]] as [string, any][]).map(([k, Ic]) => (
                                            <button key={k} onClick={() => setBldgView(k)} style={{
                                                display: 'grid', placeItems: 'center', width: 30, height: 24, border: 'none', cursor: 'pointer',
                                                background: bldgView === k ? C.accent : C.panel, color: bldgView === k ? '#fff' : C.sub
                                            }}><Ic size={13} /></button>
                                        ))}
                                    </div>
                                )} />

                            {(counts.over > 0 || counts.offline > 0) && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 9, background: C.panel,
                                    borderLeft: `3px solid ${C.red}`, border: `1px solid ${C.line}`, padding: '9px 12px', marginBottom: 12
                                }}>
                                    <Bell size={14} color={C.red} />
                                    <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.ink, letterSpacing: 0.3 }}>
                                        ALERT · <b style={{ color: C.red }}>{counts.over}</b> เกินเกณฑ์ · <b>{counts.offline}</b> ไม่มีสัญญาณ/ปิด
                                    </span>
                                </div>
                            )}

                            {level === 2 ? (
                                bldgView === 'sld' ? (
                                    <SingleLine main={{ name: currentName, kwh: totalKwh, status: aggStatus(scope, now) }}
                                        feeders={[...items].sort((a, b) => fnum(a.node.name) - fnum(b.node.name))} onPick={go} C={C} />
                                ) : (
                                    <div style={{ border: `2px solid ${C.ink}`, background: C.panel }}>
                                        <div style={{ height: 16, background: `repeating-linear-gradient(135deg, ${C.ink}, ${C.ink} 6px, ${C.panel2} 6px, ${C.panel2} 12px)` }} />
                                        {floorItems.map((it, idx) => {
                                            const st = getStatusInfo(it.status, C);
                                            return (
                                                <button key={it.node.id} className="ec-row" onClick={() => openItem(it)} style={{
                                                    display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                                                    background: 'transparent', border: 'none', borderTop: idx === 0 ? 'none' : `1px solid ${C.line}`,
                                                    borderLeft: `4px solid ${st.color}`, padding: '12px 14px'
                                                }}>
                                                    <div style={{ width: 52, fontFamily: MONO, fontWeight: 700, fontSize: 13, color: C.ink }}>{it.node.name}</div>
                                                    <div style={{ flex: 1, height: 22, background: C.panel2, position: 'relative', border: `1px solid ${C.line}` }}>
                                                        <div style={{ width: `${(it.kwh / maxFloorKwh) * 100}%`, height: '100%', background: st.color, opacity: 0.3 }} />
                                                        <span style={{ position: 'absolute', left: 8, top: 0, lineHeight: '22px', fontFamily: MONO, fontSize: 10, color: C.sub }}>{it.count} MTR</span>
                                                    </div>
                                                    <div style={{ textAlign: 'right', minWidth: 92, fontFamily: MONO, color: C.ink }}>
                                                        <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 15, fontWeight: 700 }}>{fmt(it.kwh)}</span>
                                                        <span style={{ fontSize: 10, color: C.sub }}> kWh</span>
                                                    </div>
                                                    <StatusDot s={it.status} pulse C={C} />
                                                </button>
                                            );
                                        })}
                                        <div style={{ height: 10, background: C.ink }} />
                                    </div>
                                )
                            ) : level === 3 ? (
                                <ZonePlan items={zoneItems} onPick={openItem} C={C} />
                            ) : level === 4 ? (
                                <MeterTable groups={loopGroups} now={now} onPick={(m) => setSelected(m)} C={C} />
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
                                    {sorted.map(renderCard)}
                                </div>
                            )}
                        </div>

                        {/* Realtime table (ซ่อนที่ระดับห้อง เพราะใช้ตารางเต็มแทน) */}
                        {level !== 4 && (
                            <div style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                                <div style={{ padding: '10px 12px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 8, background: C.panel2 }}>
                                    <Activity size={14} color={C.accent} />
                                    <span style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: 1, fontWeight: 700 }}>REALTIME</span>
                                    <button onClick={() => setSortDesc((v) => !v)} style={{
                                        marginLeft: 'auto', fontFamily: MONO, fontSize: 10.5,
                                        color: C.accent, background: 'transparent', border: `1px solid ${C.line}`, padding: '4px 8px', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 4
                                    }}>
                                        <ArrowUpDown size={11} /> kWh {sortDesc ? '↓' : '↑'}
                                    </button>
                                </div>
                                <div style={{ maxHeight: 430, overflow: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                        <thead>
                                            <tr style={{ position: 'sticky', top: 0, background: C.panel2, color: C.sub, textAlign: 'left', fontFamily: MONO }}>
                                                <th style={th()}>#</th>
                                                <th style={th()}>{level === 4 ? 'METER' : LEVEL_EN[level]}</th>
                                                <th style={{ ...th(), textAlign: 'right' }}>kWh</th>
                                                <th style={{ ...th(), textAlign: 'center' }}>STS</th>
                                                <th style={{ ...th(), textAlign: 'right' }}>AGE</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sorted.map((it, i) => {
                                                const ago = it.m ? Math.round((now - it.m.received_at) / 1000) : null;
                                                return (
                                                    <tr key={it.node.id} className="ec-row" onClick={() => openItem(it)} style={{ borderTop: `1px solid ${C.line}` }}>
                                                        <td style={{ ...td(), color: C.sub, fontFamily: MONO }}>{String(i + 1).padStart(2, '0')}</td>
                                                        <td style={{ ...td(), color: C.ink }}>{it.node.name}{it.node.level === 'room' && <span style={{ color: C.sub, fontFamily: MONO, fontSize: 10.5 }}> {it.m!.channel}</span>}</td>
                                                        <td style={{ ...td(), textAlign: 'right', fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: C.ink }}>{fmt(it.kwh)}</td>
                                                        <td style={{ ...td(), textAlign: 'center' }}><span style={{ display: 'inline-flex' }}><StatusDot s={it.status} C={C} /></span></td>
                                                        <td style={{ ...td(), textAlign: 'right', color: C.sub, fontFamily: MONO, fontSize: 10.5 }}>{ago === null ? '—' : ago > 30 ? `${ago}s!` : `${ago}s`}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Realtime trend (kW line) — bottom */}
                    <div style={{ padding: '0 16px 16px' }}>
                        {(() => {
                            const buf = histRef.current;
                            const curKw = buf.length ? buf[buf.length - 1].kw : 0;
                            const peak = buf.reduce((mx, p) => Math.max(mx, p.kw), 0);
                            const tdata = buf.map((p, idx) => ({ idx, kw: p.kw, t: new Date(p.t).toLocaleTimeString('th-TH') }));
                            return (
                                <div style={{ background: C.panel, border: `1px solid ${C.line}`, margin: '0 16px' }}>
                                    <div style={{ padding: '9px 14px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 10, background: C.panel2, flexWrap: 'wrap' }}>
                                        <Activity size={14} color={C.accent} />
                                        <span style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: 1, fontWeight: 700 }}>REALTIME TREND</span>
                                        <span style={{ fontSize: 12, color: C.sub }}>กำลังไฟรวม (kW) · {level === 0 ? 'ทุกสาขา' : currentName}</span>
                                        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 5 }}>
                                            <StatusDot s="normal" size={8} pulse C={C} />
                                            <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 20, fontWeight: 700, color: C.accent }}>{fmt(curKw, 1)}</span>
                                            <span style={{ fontFamily: MONO, fontSize: 11, color: C.sub }}>kW</span>
                                            <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.sub, marginLeft: 8 }}>PEAK {fmt(peak, 1)}</span>
                                        </span>
                                    </div>
                                    <div style={{ height: 150, padding: '8px 8px 0' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={tdata} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="2 3" stroke={C.line} vertical={false} />
                                                <XAxis dataKey="t" tick={{ fontSize: 9.5, fill: C.sub, fontFamily: MONO }} minTickGap={60} tickLine={false} axisLine={{ stroke: C.line }} />
                                                <YAxis tick={{ fontSize: 10, fill: C.sub, fontFamily: MONO }} width={44} tickLine={false} axisLine={{ stroke: C.line }} domain={[0, 'auto']} />
                                                <Tooltip contentStyle={{ fontSize: 12, fontFamily: MONO, borderRadius: 0, border: `1px solid ${C.line}`, background: C.panel, color: C.ink }} formatter={(v) => [`${fmt(Number(v), 1)} kW`, 'kW']} />
                                                <Line type="monotone" dataKey="kw" stroke={C.accent} strokeWidth={2} dot={false} isAnimationActive={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div style={{ padding: '3px 14px 8px', fontFamily: MONO, fontSize: 9.5, color: C.sub, letterSpacing: 0.5 }}>
                                        ← ย้อนหลัง ~1 ชั่วโมง · อัปเดตทุก 1 นาที · รีเซ็ตเมื่อเปลี่ยนขอบเขต
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </React.Fragment>
            ) : (
                <Compare meters={meters} tree={tree} now={now} C={C} />
            )}

            {selected && <MeterDetail m={selected} now={now} onClose={() => setSelected(null)} C={C} />}
        </div>
    );
};

export default ZoneDashboard;
