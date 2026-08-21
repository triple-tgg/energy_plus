import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Zap, Droplet, Flame, Sun, Home, Activity, ArrowUpDown, X, Gauge, Search,
    Wifi, WifiOff, AlertTriangle, Network, Pencil, Bell, PowerOff, LayoutGrid, BarChart3, Moon, ChevronRight,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, ComposedChart,
} from 'recharts';
import { dashboardApi } from '../../api/client';
import { LoadingScreen } from '../../components/ui/LoadingScreen';

/* ===========================================================================
   Energy Console — Dashboard พลังงาน
   Drill-down: สาขา → ตึก → ชั้น → โซน → ห้อง(Meter) + ตาราง Realtime + กราฟ
   ใช้ข้อมูลที่ aggregate แล้วจาก actual_meter_data / daily / monthly
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
        line: '#D4D1C0', bar: '#F1EFE3', barSub: '#8A8C7A', accent: '#2B4C7E',
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
        case 'offline':
            return { color: '#EF4444', labelTh: 'ไม่มีสัญญาณ', labelEn: 'No Signal' };
        case 'zero':
            // Meter is reporting on schedule but every reading is 0 — a wiring/CT issue, not a comms one
            return { color: '#F59E0B', labelTh: 'ค่าเป็นศูนย์', labelEn: 'Zero Reading' };
        case 'inactive':
            return { color: '#6B7280', labelTh: 'ไม่ใช้งาน', labelEn: 'Inactive' };
        case 'online':
        case 'normal':
        default:
            return { color: '#10B981', labelTh: 'ออนไลน์', labelEn: 'Online' };
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

const STALE_MS = 120000;

// ── Types ──
interface MeterData {
    id: string;
    code: string;
    channel: string;
    site_id: number;
    address_id: number;
    source_site_id?: number;
    device: string;
    type: string;
    meter_type_id: number;
    loop: number;
    pathIds: string[];
    pathNames: string[];
    threshold: number;
    disabled: boolean;
    is_active?: boolean;
    inputMode: string;
    periodStart_kwhr: number;
    import_kwhr: number;
    data_source?: string;
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
    counts: StatusCount;
    m?: MeterData;
}

interface ComparisonRow {
    gran: string;
    bucket: string;
    entityType: string;
    entityId: number;
    entityName: string;
    kwh: number;
}

interface ZoneDashboardPayload {
    tree: TreeNode[];
    meters: MeterData[];
    trend: { t: number; kw: number; kwh?: number; readings?: number }[];
    comparison: ComparisonRow[];
}

type TrendPoint = ZoneDashboardPayload['trend'][number];

const METER_TYPE_INFO: Record<number, { icon: string; color: string }> = {
    1: { icon: '⚡', color: '#F59E0B' },  // Electricity
    2: { icon: '💧', color: '#3B82F6' },  // Water
    3: { icon: '🔥', color: '#EF4444' },  // Gas
    4: { icon: '☀️', color: '#10B981' },  // Solar
    8: { icon: '🔌', color: '#8B5CF6' },  // MDB
    10: { icon: '☀️', color: '#F97316' }, // Solar
    11: { icon: '🌫️', color: '#14B8A6' }, // Humidity
    12: { icon: '🌡️', color: '#F43F5E' }, // Temperature
};
const getMeterTypeInfo = (id: number) => METER_TYPE_INFO[id] || METER_TYPE_INFO[1];

const period = (m: MeterData) => Math.max(0, m.import_kwhr - m.periodStart_kwhr);
const isRealtime = (m: MeterData) => m.data_source === 'realtime' || m.data_source === 'actual';
function meterStatus(m: MeterData, now: number): string {
    if (m.disabled || m.is_active === false) return 'inactive';
    if (now - m.received_at > STALE_MS) return 'offline';
    // Reporting on time but every reading is 0 — the meter is reachable, the measurement is not
    if (m.vl1 === 0 && m.vl2 === 0 && m.vl3 === 0
        && m.il1 === 0 && m.il2 === 0 && m.il3 === 0
        && m.kw_3ph === 0 && m.kva_3ph === 0
        && m.hz === 0 && m.import_kwhr === 0) return 'zero';
    return 'online';
}
export interface StatusCount { online: number; zero: number; offline: number; inactive: number }
/** Order used everywhere a tally is rendered: healthy first, then by how urgent the fault is */
const STATUS_ORDER: Array<keyof StatusCount> = ['online', 'zero', 'offline', 'inactive'];
function statusCounts(list: MeterData[], now: number): StatusCount {
    const c: StatusCount = { online: 0, zero: 0, offline: 0, inactive: 0 };
    for (const m of list) {
        const s = meterStatus(m, now);
        if (s === 'offline') c.offline++;
        else if (s === 'zero') c.zero++;
        else if (s === 'inactive') c.inactive++;
        else c.online++;
    }
    return c;
}
function aggStatus(list: MeterData[], now: number): string {
    const c = statusCounts(list, now);
    if (c.offline > 0) return 'offline';
    if (c.zero > 0) return 'zero';
    if (c.online > 0) return 'online';
    return 'inactive';
}
function latestAge(list: MeterData[], now: number): number | null {
    const active = list.filter((m) => !m.disabled && m.received_at > 0);
    if (!active.length) return null;
    return Math.round((now - Math.max(...active.map((m) => m.received_at))) / 1000);
}
const fmt = (v: number, d = 2) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const LEVEL_TH = ['สาขา', 'อาคาร', 'ชั้น', 'โซน', 'ห้อง'];
const LEVEL_EN = ['BRANCH', 'BUILDING', 'FLOOR', 'ZONE', 'ROOM'];

const formatNodeName = (name: string, t: (th: string, en: string) => string) => {
    return name
        .replace('สาขาสุขุมวิท', t('สาขาสุขุมวิท', 'Sukhumvit Branch'))
        .replace('สาขาพระราม 9', t('สาขาพระราม 9', 'Rama 9 Branch'))
        .replace('สาขาเชียงใหม่', t('สาขาเชียงใหม่', 'Chiang Mai Branch'))
        .replace('สาขา', t('สาขา', 'Branch'))
        .replace('ตึก', t('ตึก', 'Building'))
        .replace('ชั้น', t('ชั้น', 'Floor'))
        .replace('โซน', t('โซน', 'Zone'));
};

const formatShortBranchName = (name: string, t: (th: string, en: string) => string) => {
    return name
        .replace('ภูเก็ต', t('ภูเก็ต', 'Phuket'))
        .replace('เชียงใหม่', t('เชียงใหม่', 'Chiang Mai'))
        .replace('สุขุมวิท', t('สุขุมวิท', 'Sukhumvit'))
        .replace('พระราม 9', t('พระราม 9', 'Rama 9'));
};

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

/** Online / offline / inactive meter tally for a group — shown next to the group's status dot
 *  so one dead meter in a large branch no longer reads as "the whole branch is down". */
interface StatusTallyProps {
    counts: StatusCount;
    size?: number;
    C: Theme;
}
function StatusTally({ counts, size = 10.5, C }: StatusTallyProps) {
    const parts = STATUS_ORDER.map((s) => ({ key: s, s, n: counts[s] })).filter((p) => p.n > 0);
    if (!parts.length) return null;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: MONO, fontSize: size, fontVariantNumeric: 'tabular-nums',
        }}>
            {parts.map((p, i) => (
                <React.Fragment key={p.key}>
                    {i > 0 && <span style={{ color: C.sub, opacity: 0.6 }}>·</span>}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 600, color: getStatusInfo(p.s, C).color }}>
                        <StatusDot s={p.s} size={size * 0.62} C={C} />{p.n}
                    </span>
                </React.Fragment>
            ))}
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
    const { language } = useLanguage();
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
            {idx && <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: C.ink, background: C.bar, padding: '2px 6px', border: `1px solid ${C.line}` }}>{idx}</span>}
            <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: C.accent, fontWeight: 700 }}>{en}</span>
            {th && language === 'th' && <span style={{ fontSize: 12.5, color: C.sub }}>{th}</span>}
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
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, overflow: 'hidden' }}>
                <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 14, fontWeight: 600, color: accent || C.ink, whiteSpace: 'nowrap' }}>{value}</span>
                <span style={{ fontSize: 10, color: C.sub, flexShrink: 0 }}>{unit}</span>
            </div>
        </div>
    );
}

/* ──────────────────── Single Line Diagram ──────────────────── */
interface SingleLineProps {
    main: { name: string | undefined; kwh: number; status: string; counts: StatusCount };
    feeders: ItemData[];
    onPick: (id: string) => void;
    C: Theme;
}
function SingleLine({ main, feeders, onPick, C }: SingleLineProps) {
    const { t } = useLanguage();
    const ms = getStatusInfo(main.status, C);
    return (
        <div style={{ border: `1px solid ${C.line}`, background: C.panel, padding: '22px 14px 26px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ border: `2px solid ${ms.color}`, padding: '10px 18px', minWidth: 170, textAlign: 'center', background: C.panel2, color: C.ink }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <StatusDot s={main.status} C={C} />
                        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 12, letterSpacing: 0.5, color: C.ink }}>MAIN · {formatNodeName(main.name || '', t)}</span>
                    </div>
                    <div style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 19, fontWeight: 700, marginTop: 2, color: C.ink }}>{fmt(main.kwh)} <span style={{ fontSize: 11, color: C.sub }}>kWh</span></div>
                    <div style={{ marginTop: 3 }}><StatusTally counts={main.counts} C={C} /></div>
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
                                    cursor: 'pointer', border: `1px solid ${C.line}`, borderTop: `3px solid ${st.color}`, padding: '9px 11px', background: C.panel, color: C.ink, textAlign: 'center', minWidth: 96
                                }}>
                                    <div style={{ fontFamily: MONO, fontSize: 10, color: C.sub }}>F{i + 1}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                                        <StatusDot s={f.status} size={8} C={C} /><span style={{ fontWeight: 600, fontSize: 12, color: C.ink }}>{formatNodeName(f.node.name, t)}</span>
                                    </div>
                                    <div style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 700, color: C.ink }}>{fmt(f.kwh)} <span style={{ fontSize: 10, color: C.sub }}>kWh</span></div>
                                    <div style={{ marginTop: 2 }}><StatusTally counts={f.counts} size={9.5} C={C} /></div>
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
    const { t } = useLanguage();
    return (
        <div style={{ border: `2px solid ${C.ink}`, background: C.panel, padding: 6 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {items.map((it) => {
                    const st = getStatusInfo(it.status, C);
                    return (
                        <button key={it.node.id} className="ec-card" onClick={() => onPick(it)} style={{
                            textAlign: 'left', cursor: 'pointer', border: `1px solid ${C.line}`, borderTop: `3px solid ${st.color}`,
                            background: C.panel2, color: C.ink, padding: 15, minHeight: 108, display: 'flex', flexDirection: 'column'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <StatusDot s={it.status} pulse C={C} /><span style={{ fontWeight: 700, fontSize: 14, color: C.ink }}>{formatNodeName(it.node.name, t)}</span>
                            </div>
                            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'baseline', gap: 5 }}>
                                <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 24, fontWeight: 700, color: C.ink }}>{fmt(it.kwh)}</span>
                                <span style={{ fontFamily: MONO, fontSize: 11, color: C.sub }}>kWh</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.sub }}>{it.count} METERS</span>
                                <StatusTally counts={it.counts} C={C} />
                            </div>
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
                        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11.5, letterSpacing: 1, background: C.bar, color: C.ink, padding: '3px 9px', border: `1px solid ${C.line}` }}>LOOP {g.loop}</span>
                        <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.sub }}>{g.items.length} / 32 METER</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(76px,1fr))', gap: 7 }}>
                        {g.items.map((it) => {
                            const dim = it.m!.inputMode === 'disabled';
                            return (
                                <button key={it.node.id} className="ec-card" onClick={() => onPick(it.m!)} title={`${it.node.name} · ${getModeInfo(it.m!.inputMode, C).label}`} style={{
                                    cursor: 'pointer', border: `1px solid ${C.line}`, padding: '9px 6px 7px', background: dim ? C.panel2 : C.panel, color: C.ink,
                                    opacity: dim ? 0.7 : 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, position: 'relative'
                                }}>
                                    {it.m!.inputMode === 'manual' && <span style={{ position: 'absolute', top: 3, right: 3, color: C.yellow }}><Pencil size={9} /></span>}
                                    <StatusDot s={it.status} size={14} C={C} />
                                    <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.ink }}>{it.node.name}</span>
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
    const { t } = useLanguage();
    const thx = (): React.CSSProperties => ({ padding: '8px 6px', fontWeight: 700, fontSize: 9.5, letterSpacing: 0.5, textAlign: 'right', fontFamily: MONO, whiteSpace: 'nowrap' });
    const tdx = (): React.CSSProperties => ({ padding: '6px 6px', textAlign: 'right', fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 11, whiteSpace: 'nowrap' });
    const TOTAL_COLS = 30;
    const sep = (extra?: React.CSSProperties): React.CSSProperties => ({ ...thx(), borderLeft: `1px solid ${C.line}`, ...extra });

    return (
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, overflow: 'hidden', width: '100%', maxWidth: '100%' }}>
            <div style={{ maxHeight: 600, overflowX: 'auto', overflowY: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', fontSize: 11, minWidth: 1800 }}>
                    <thead>
                        <tr style={{ position: 'sticky', top: 0, background: C.bar, color: C.ink, fontFamily: MONO, zIndex: 1, borderBottom: `2px solid ${C.line}` }}>
                            <th style={{ ...thx(), textAlign: 'left', position: 'sticky', left: 0, background: C.bar, zIndex: 2 }}>#</th>
                            <th style={{ ...thx(), textAlign: 'left', position: 'sticky', left: 30, background: C.bar, zIndex: 2, minWidth: 140 }}>METER</th>
                            <th style={{ ...thx(), textAlign: 'center' }}>STS</th>
                            <th style={{ ...thx(), textAlign: 'center' }}>MODE</th>
                            {/* ── Energy ── */}
                            <th style={sep()}>kWh</th>
                            <th style={thx()}>kW 3ph</th>
                            <th style={thx()}>kW L1</th>
                            <th style={thx()}>kW L2</th>
                            <th style={thx()}>kW L3</th>
                            {/* ── Power ── */}
                            <th style={sep()}>kVA 3ph</th>
                            <th style={thx()}>kVA L1</th>
                            <th style={thx()}>kVA L2</th>
                            <th style={thx()}>kVA L3</th>
                            <th style={sep()}>kVAR 3ph</th>
                            <th style={thx()}>kVAR L1</th>
                            <th style={thx()}>kVAR L2</th>
                            <th style={thx()}>kVAR L3</th>
                            {/* ── Voltage ── */}
                            <th style={sep()}>V L1</th>
                            <th style={thx()}>V L2</th>
                            <th style={thx()}>V L3</th>
                            <th style={sep()}>V L12</th>
                            <th style={thx()}>V L23</th>
                            <th style={thx()}>V L31</th>
                            {/* ── Current ── */}
                            <th style={sep()}>A L1</th>
                            <th style={thx()}>A L2</th>
                            <th style={thx()}>A L3</th>
                            {/* ── PF / Hz ── */}
                            <th style={sep()}>PF L1</th>
                            <th style={thx()}>PF L2</th>
                            <th style={thx()}>PF L3</th>
                            <th style={sep()}>Hz</th>
                            <th style={thx()}>AGE</th>
                        </tr>
                    </thead>
                    <tbody>
                        {groups.map((g) => (
                            <React.Fragment key={g.loop}>
                                <tr style={{ background: C.panel2 }}>
                                    <td colSpan={TOTAL_COLS + 1} style={{ padding: '6px 11px', fontFamily: MONO, fontSize: 10.5, letterSpacing: 1, color: C.sub, borderTop: `1px solid ${C.line}` }}>
                                        <b style={{ color: C.ink }}>LOOP {g.loop}</b> · {g.items.length}/32 METER
                                    </td>
                                </tr>
                                {g.items.map((it, i) => {
                                    const m = it.m!;
                                    const md = getModeInfo(m.inputMode, C);
                                    const off = m.inputMode === 'disabled' || it.status === 'offline';
                                    const ago = Math.round((now - m.received_at) / 1000);
                                    const d = (x: number, dp = 2) => (off ? '—' : fmt(x, dp));
                                    const sepTd = (extra?: React.CSSProperties): React.CSSProperties => ({ ...tdx(), borderLeft: `2px solid ${C.line}`, ...extra });
                                    return (
                                        <tr key={it.node.id} className="ec-row" onClick={() => onPick(m)} style={{ borderTop: `1px solid ${C.line}`, opacity: off ? 0.6 : 1 }}>
                                            <td style={{ ...tdx(), textAlign: 'left', color: C.sub, position: 'sticky', left: 0, background: C.panel, zIndex: 1 }}>{String(i + 1).padStart(2, '0')}</td>
                                            <td style={{ ...tdx(), textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', left: 30, background: C.panel, zIndex: 1 }}>
                                                <b>{m.code}</b>
                                                {isRealtime(m) && <span style={{ marginLeft: 6, color: C.green, fontSize: 10, fontWeight: 700 }}>RT</span>}
                                                <span style={{ color: C.sub }}> {m.device}</span>
                                            </td>
                                            <td style={{ ...tdx(), textAlign: 'center' }}><span style={{ display: 'inline-flex' }}><StatusDot s={it.status} C={C} /></span></td>
                                            <td style={{ ...tdx(), textAlign: 'center', color: md.color, fontSize: 10 }}>{md.label}</td>
                                            {/* Energy */}
                                            <td style={{ ...sepTd(), fontWeight: 700 }}>{d(it.kwh)}</td>
                                            <td style={tdx()}>{d(m.kw_3ph)}</td>
                                            <td style={tdx()}>{d(m.kw1)}</td>
                                            <td style={tdx()}>{d(m.kw2)}</td>
                                            <td style={tdx()}>{d(m.kw3)}</td>
                                            {/* kVA */}
                                            <td style={sepTd()}>{d(m.kva_3ph)}</td>
                                            <td style={tdx()}>{d(m.kva1)}</td>
                                            <td style={tdx()}>{d(m.kva2)}</td>
                                            <td style={tdx()}>{d(m.kva3)}</td>
                                            {/* kVAR */}
                                            <td style={sepTd()}>{d(m.kvar_3ph)}</td>
                                            <td style={tdx()}>{d(m.kvar1)}</td>
                                            <td style={tdx()}>{d(m.kvar2)}</td>
                                            <td style={tdx()}>{d(m.kvar3)}</td>
                                            {/* Voltage L-N */}
                                            <td style={sepTd()}>{d(m.vl1)}</td>
                                            <td style={tdx()}>{d(m.vl2)}</td>
                                            <td style={tdx()}>{d(m.vl3)}</td>
                                            {/* Voltage L-L */}
                                            <td style={sepTd()}>{d(m.vl12)}</td>
                                            <td style={tdx()}>{d(m.vl23)}</td>
                                            <td style={tdx()}>{d(m.vl31)}</td>
                                            {/* Current */}
                                            <td style={sepTd()}>{d(m.il1)}</td>
                                            <td style={tdx()}>{d(m.il2)}</td>
                                            <td style={tdx()}>{d(m.il3)}</td>
                                            {/* PF */}
                                            <td style={sepTd()}>{d(m.pf1)}</td>
                                            <td style={tdx()}>{d(m.pf2)}</td>
                                            <td style={tdx()}>{d(m.pf3)}</td>
                                            {/* Hz & Age */}
                                            <td style={sepTd()}>{d(m.hz)}</td>
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
                {t('เลื่อนตารางไปทางขวาเพื่อดูข้อมูลเพิ่มเติม · คลิกแถวเพื่อดูรายละเอียด', 'Scroll right for more data · Click row for details')}
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
    const { t } = useLanguage();
    const s = meterStatus(m, now);
    const st = getStatusInfo(s, C);
    const md = getModeInfo(m.inputMode, C);
    const ago = Math.round((now - m.received_at) / 1000);
    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1050 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, width: 480, maxHeight: '80vh', overflow: 'hidden', border: `1px solid ${C.line}`, borderRadius: 8, boxShadow: '0 12px 40px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div style={{
                    padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: C.bar, borderBottom: `2px solid ${getMeterTypeInfo(m.meter_type_id).color}`,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                            width: 30, height: 30, borderRadius: '50%',
                            background: getMeterTypeInfo(m.meter_type_id).color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 14, color: '#fff',
                        }}>{getMeterTypeInfo(m.meter_type_id).icon}</span>
                        <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: C.ink, letterSpacing: '0.5px' }}>
                            {m.code}
                        </span>
                    </div>
                    <button onClick={onClose}
                        style={{ background: 'transparent', border: 'none', color: C.ink, cursor: 'pointer', padding: 4, display: 'grid', placeItems: 'center' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Scrollable Body */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                {/* Meter Info */}
                <div style={{
                    padding: '12px 16px', background: C.panel2,
                    borderBottom: `1px solid ${C.line}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <div>
                        <div style={{ fontFamily: MONO, fontSize: 10, color: C.sub, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 2 }}>{t('มิเตอร์', 'Meter')}</div>
                        <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: C.ink }}>
                            [{m.code}] {m.device}
                        </div>
                    </div>
                    {(() => {
                        const si = getStatusInfo(s, C);
                        const icon = s === 'offline' ? '🔴' : s === 'zero' ? '🟠' : s === 'inactive' ? '⚫' : '🟢';
                        return (
                            <div style={{
                                fontFamily: MONO, fontSize: 10, padding: '3px 10px',
                                borderRadius: 12,
                                background: `${si.color}20`,
                                color: si.color,
                                border: `1px solid ${si.color}40`,
                                fontWeight: 600, textTransform: 'uppercase',
                            }}>
                                {icon} {t(si.labelTh, si.labelEn)}
                            </div>
                        );
                    })()}
                </div>

                {/* Location info */}
                <div style={{
                    padding: '8px 16px', background: C.panel,
                    borderBottom: `1px solid ${C.line}`,
                    display: 'flex', gap: 20,
                }}>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: C.sub }}>
                        📍 {m.pathNames.map(p => formatNodeName(p, t)).join(' › ')}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: C.sub, marginLeft: 'auto' }}>
                        🕐 {new Date(m.received_at).toLocaleString(t('th-TH', 'en-US'))}
                    </div>
                </div>

                {/* Data Table */}
                <div style={{ padding: '0' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 12 }}>
                        <tbody>
                            {([
                                { labelTh: 'พลังงานไฟฟ้ารวม (KWh)', labelEn: 'KWh', value: m.import_kwhr, unit: 'kWh' },
                                { labelTh: 'กำลังไฟฟ้าปรากฏ (Kva)', labelEn: 'Kva', value: m.kva_3ph, unit: 'kVA' },
                                { labelTh: 'กำลังไฟฟ้าจริง (Kw)', labelEn: 'Kw', value: m.kw_3ph, unit: 'kW' },
                                { labelTh: 'กำลังไฟฟ้ารีแอคทีฟ (Kvar)', labelEn: 'Kvar', value: m.kvar_3ph, unit: 'kVAR' },
                                { labelTh: 'ความถี่ (Frequency)', labelEn: 'Frequency', value: m.hz, unit: 'Hz' },
                                { labelTh: 'แรงดันไฟฟ้า L1 (VoltP1)', labelEn: 'VoltP1', value: m.vl1, unit: 'V' },
                                { labelTh: 'แรงดันไฟฟ้า L2 (VoltP2)', labelEn: 'VoltP2', value: m.vl2, unit: 'V' },
                                { labelTh: 'แรงดันไฟฟ้า L3 (VoltP3)', labelEn: 'VoltP3', value: m.vl3, unit: 'V' },
                                { labelTh: 'แรงดันไฟฟ้า L1-L2 (VoltL1)', labelEn: 'VoltL1', value: m.vl12, unit: 'V' },
                                { labelTh: 'แรงดันไฟฟ้า L2-L3 (VoltL2)', labelEn: 'VoltL2', value: m.vl23, unit: 'V' },
                                { labelTh: 'แรงดันไฟฟ้า L3-L1 (VoltL3)', labelEn: 'VoltL3', value: m.vl31, unit: 'V' },
                                { labelTh: 'กระแสไฟฟ้า L1 (Amp1)', labelEn: 'Amp1', value: m.il1, unit: 'A' },
                                { labelTh: 'กระแสไฟฟ้า L2 (Amp2)', labelEn: 'Amp2', value: m.il2, unit: 'A' },
                                { labelTh: 'กระแสไฟฟ้า L3 (Amp3)', labelEn: 'Amp3', value: m.il3, unit: 'A' },
                                { labelTh: 'กำลังไฟฟ้า L1 (Kw1)', labelEn: 'Kw1', value: m.kw1, unit: 'kW' },
                                { labelTh: 'กำลังไฟฟ้า L2 (Kw2)', labelEn: 'Kw2', value: m.kw2, unit: 'kW' },
                                { labelTh: 'กำลังไฟฟ้า L3 (Kw3)', labelEn: 'Kw3', value: m.kw3, unit: 'kW' },
                                { labelTh: 'Kva L1', labelEn: 'Kva1', value: m.kva1, unit: 'kVA' },
                                { labelTh: 'Kva L2', labelEn: 'Kva2', value: m.kva2, unit: 'kVA' },
                                { labelTh: 'Kva L3', labelEn: 'Kva3', value: m.kva3, unit: 'kVA' },
                                { labelTh: 'Kvar L1', labelEn: 'Kvar1', value: m.kvar1, unit: 'kVAR' },
                                { labelTh: 'Kvar L2', labelEn: 'Kvar2', value: m.kvar2, unit: 'kVAR' },
                                { labelTh: 'Kvar L3', labelEn: 'Kvar3', value: m.kvar3, unit: 'kVAR' },
                                { labelTh: 'ตัวประกอบกำลัง L1 (Pf1)', labelEn: 'Pf1', value: m.pf1, unit: '' },
                                { labelTh: 'ตัวประกอบกำลัง L2 (Pf2)', labelEn: 'Pf2', value: m.pf2, unit: '' },
                                { labelTh: 'ตัวประกอบกำลัง L3 (Pf3)', labelEn: 'Pf3', value: m.pf3, unit: '' },
                            ] as { labelTh: string; labelEn: string; value: number; unit: string }[]).map((field, i) => (
                                <tr key={i} style={{
                                    borderBottom: `1px solid ${C.line}`,
                                    background: i % 2 === 0 ? C.panel : C.panel2,
                                }}>
                                    <td style={{
                                        padding: '8px 16px', fontWeight: 600, color: C.ink,
                                        width: '50%',
                                    }}>{t(field.labelTh, field.labelEn)}</td>
                                    <td style={{
                                        padding: '8px 16px', textAlign: 'right',
                                        color: C.ink, fontWeight: 500,
                                    }}>
                                        {fmt(field.value)}
                                        {field.unit && <span style={{ color: C.sub, fontSize: 10, marginLeft: 4 }}>{field.unit}</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
    comparison: ComparisonRow[];
}
function Compare({ meters, tree, now, C, comparison }: CompareProps) {
    const { t } = useLanguage();
    const [dim, setDim] = useState('overview');
    const [gran, setGran] = useState('year');
    const [billing, setBilling] = useState(false);

    const entities = useMemo(() => {
        const entityType = dim === 'building' ? 'building' : 'site';
        // Build entities from comparison data to show ALL sites/buildings regardless of realtime filter
        const map = new Map<number, string>();
        comparison.forEach((c) => {
            if (c.entityType === entityType && !map.has(c.entityId)) {
                map.set(c.entityId, c.entityName);
            }
        });
        // Fallback to tree if no comparison data yet
        if (map.size === 0) {
            if (dim === 'building') {
                const list: { id: string; name: string; weight: number }[] = [];
                tree.forEach((b) => b.children?.forEach((bd) => {
                    const w = meters.filter((m) => m.pathIds[1] === bd.id).reduce((s, m) => s + period(m), 0);
                    const short = b.name.replace('สาขา', '');
                    list.push({ id: bd.id, name: `${formatShortBranchName(short, t)}·${formatNodeName(bd.name, t)}`, weight: w });
                }));
                return list;
            }
            return tree.map((b) => ({
                id: b.id, name: formatShortBranchName(b.name.replace('สาขา', ''), t),
                weight: meters.filter((m) => m.pathIds[0] === b.id).reduce((s, m) => s + period(m), 0),
            }));
        }
        return Array.from(map.entries()).map(([id, name]) => ({
            id: `${entityType}-${id}`,
            name: entityType === 'site'
                ? formatShortBranchName(name.replace('สาขา', ''), t)
                : name, // building names already have "site·building" format
            weight: 0,
        }));
    }, [dim, tree, meters, comparison, t]);

    const now2 = new Date();
    const curYear = now2.getFullYear();
    const thisYear = curYear + 543; // พ.ศ.

    // Build dynamic year buckets from comparison data
    const yearBuckets = useMemo(() => {
        const years = new Set<number>();
        comparison.filter(c => c.gran === 'yearly').forEach(c => {
            years.add(new Date(c.bucket).getFullYear());
        });
        if (years.size === 0) {
            // fallback: show last 3 years
            return [curYear - 2, curYear - 1, curYear];
        }
        return Array.from(years).sort((a, b) => a - b);
    }, [comparison, curYear]);

    const buckets = useMemo(() => {
        if (gran === 'year') {
            // เปรียบเทียบระหว่างปี — แต่ละแท่งคือ 1 ปี
            return yearBuckets.map(y => String(y));
        }
        if (gran === 'month') {
            // กราฟ 12 แท่ง เดือน 1-12
            return [
                t('ม.ค.', 'Jan'), t('ก.พ.', 'Feb'), t('มี.ค.', 'Mar'), t('เม.ย.', 'Apr'),
                t('พ.ค.', 'May'), t('มิ.ย.', 'Jun'), t('ก.ค.', 'Jul'), t('ส.ค.', 'Aug'),
                t('ก.ย.', 'Sep'), t('ต.ค.', 'Oct'), t('พ.ย.', 'Nov'), t('ธ.ค.', 'Dec')
            ];
        }
        if (gran === 'day') {
            // ข้อมูลรายวันของเดือนปัจจุบัน 1 ถึง วันนี้ (เช่น วันที่ 1-15)
            const currentDay = now2.getDate();
            return Array.from({ length: currentDay }, (_, i) => String(i + 1));
        }
        // weekly — จันทร์ ถึง อาทิตย์
        return [
            t('จ.', 'Mon'), t('อ.', 'Tue'), t('พ.', 'Wed'), t('พฤ.', 'Thu'),
            t('ศ.', 'Fri'), t('ส.', 'Sat'), t('อา.', 'Sun')
        ];
    }, [gran, t, yearBuckets, now2]);

    const data = useMemo(() => buckets.map((lb, bi) => {
        const row: Record<string, any> = { label: lb };
        const entityType = dim === 'building' || dim === 'mdb' ? 'building' : 'site';
        entities.forEach((e) => {
            const entityId = Number(e.id.replace(/^\D+/, ''));
            // Map gran to backend gran name
            const backendGran = gran === 'year' ? 'yearly' : gran === 'month' ? 'year' : gran === 'week' ? 'week' : 'day';
            const v = comparison
                .filter((item) => item.gran === backendGran && item.entityType === entityType && item.entityId === entityId)
                .filter((item) => {
                    const str = String(item.bucket);
                    const parts = str.split(/[-T :]/);
                    const y = Number(parts[0]);
                    const m = Number(parts[1]) - 1;
                    const d = Number(parts[2]);
                    if (gran === 'year') return y === yearBuckets[bi];
                    if (gran === 'month') return m === bi;
                    if (gran === 'day') return d === bi + 1 && m === now2.getMonth() && y === curYear;
                    if (gran === 'week') {
                        const dt = new Date(str);
                        return ((dt.getDay() + 6) % 7) === bi;
                    }
                    return false;
                })
                .reduce((sum, item) => sum + item.kwh, 0);
            row[e.name] = +v.toFixed(1);
        });
        return row;
    }), [buckets, comparison, dim, entities, gran, yearBuckets, curYear, now2]);

    const [hiddenEntities, setHiddenEntities] = useState<Set<string>>(new Set());

    const toggleEntity = (name: string) => {
        setHiddenEntities((prev) => {
            const next = new Set(prev);
            if (next.has(name)) {
                next.delete(name);
            } else {
                next.add(name);
            }
            return next;
        });
    };

    const handleSetDim = (k: string) => {
        setDim(k);
        setHiddenEntities(new Set());
    };

    const totals = entities.map((e) => ({ name: e.name, value: +data.reduce((s, r) => s + (r[e.name] || 0), 0).toFixed(1) })).sort((a, b) => b.value - a.value);
    const visibleTotals = totals.filter((t) => !hiddenEntities.has(t.name));
    const visibleGrand = visibleTotals.reduce((s, t) => s + t.value, 0) || 1;
    const grand = totals.reduce((s, t) => s + t.value, 0) || 1;
    const colorOf: Record<string, string> = {}; entities.forEach((e, i) => (colorOf[e.name] = C.palette[i % C.palette.length]));

    const monthNames = [
        t('ม.ค.', 'Jan'), t('ก.พ.', 'Feb'), t('มี.ค.', 'Mar'), t('เม.ย.', 'Apr'),
        t('พ.ค.', 'May'), t('มิ.ย.', 'Jun'), t('ก.ค.', 'Jul'), t('ส.ค.', 'Aug'),
        t('ก.ย.', 'Sep'), t('ต.ค.', 'Oct'), t('พ.ย.', 'Nov'), t('ธ.ค.', 'Dec')
    ];

    const windowText = gran === 'year'
        ? t(`เปรียบเทียบรายปี · ${yearBuckets[0] || ''} − ${yearBuckets[yearBuckets.length - 1] || ''}`, `Yearly Comparison · ${yearBuckets[0] || ''} − ${yearBuckets[yearBuckets.length - 1] || ''}`)
        : gran === 'month'
            ? t(`ข้อมูลรายเดือน ปี ${thisYear} · ม.ค. − ธ.ค. (เดือนที่ยังไม่มีข้อมูล = 0)`, `Monthly Data ${curYear} · Jan − Dec (months with no data = 0)`)
            : gran === 'day'
                ? t(`ข้อมูลรายวัน (1 − ${now2.getDate()} ${monthNames[now2.getMonth()]} ${thisYear})`, `Daily Data (1 − ${now2.getDate()} ${monthNames[now2.getMonth()]} ${curYear})`)
                : t('สัปดาห์ล่าสุด · จันทร์ − อาทิตย์', 'Last Week · Mon − Sun');

    const DIMS = [['overview', t('ภาพรวม', 'Overview')], ['branch', t('ตามไซต์', 'By Site')], ['building', t('ตามตึก', 'By Building')]];
    const GRANS = [['year', t('รายปี', 'Yearly')], ['month', t('รายเดือน', 'Monthly')], ['week', t('รายสัปดาห์', 'Weekly')], ['day', t('รายวัน', 'Daily')]];
    const chip = (a: boolean): React.CSSProperties => ({
        fontFamily: MONO, fontSize: 11.5, letterSpacing: 0.3, padding: '6px 12px', border: `1px solid ${a ? C.accent : C.line}`,
        cursor: 'pointer', background: a ? C.accent : C.panel, color: a ? '#fff' : C.sub, marginRight: 6, marginBottom: 6,
        borderRadius: 0,
    });
    const axisTick = { fontSize: 10.5, fill: C.sub, fontFamily: MONO };

    const dimLabel = DIMS.find((d) => d[0] === dim)![1];
    const dimLabelClean = dim === 'overview' 
        ? t('ไซต์', 'Site') 
        : dimLabel.replace(t('ตาม', 'By '), '');
    const granLabel = gran === 'year' 
        ? t('รายปี', 'Yearly') 
        : gran === 'month'
            ? t('รายเดือน', 'Monthly')
            : gran === 'day'
                ? t('รายวัน', 'Daily')
                : t('รายวัน', 'Daily');
    const thText = `(kWh) ${granLabel} · ${dimLabelClean}`;

    return (
        <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 12 }}>
                <div>
                    <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: C.sub, marginBottom: 6, textTransform: 'uppercase' }}>{t('เปรียบเทียบตาม', 'Compare By')}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap' }}>{DIMS.map(([k, lb]) => <button key={k} onClick={() => handleSetDim(k)} style={chip(dim === k)}>{lb}</button>)}</div>
                </div>
                <div>
                    <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: C.sub, marginBottom: 6, textTransform: 'uppercase' }}>{t('ช่วงเวลา', 'Period')}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap' }}>{GRANS.map(([k, lb]) => <button key={k} onClick={() => setGran(k)} style={chip(gran === k)}>{lb}</button>)}</div>
                </div>
            </div>

            <div style={{
                display: 'flex', alignItems: 'center', gap: 8, background: C.panel, border: `1px solid ${C.line}`,
                borderLeft: `3px solid ${C.accent}`, padding: '8px 13px', fontFamily: MONO, fontSize: 11.5, color: C.ink, marginBottom: 14, letterSpacing: 0.2
            }}>
                <Gauge size={14} color={C.accent} /> WINDOW · {windowText}
                {hiddenEntities.size > 0 && (
                    <button
                        onClick={() => setHiddenEntities(new Set())}
                        style={{
                            marginLeft: 'auto', background: 'transparent', border: `1px solid ${C.line}`,
                            color: C.accent, fontFamily: MONO, fontSize: 10.5, padding: '2px 8px', cursor: 'pointer',
                        }}
                    >
                        {t('แสดงทั้งหมด', 'Show All')} ({hiddenEntities.size} {t('ซ่อนอยู่', 'hidden')})
                    </button>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 14 }}>
                <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: '12px 10px 6px' }}>
                    <Cap en="ENERGY" th={thText} C={C} />
                    <div style={{ height: 330 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 2 }}>
                                <CartesianGrid strokeDasharray="2 3" stroke={C.line} vertical={false} />
                                <XAxis dataKey="label" tick={axisTick} interval={0} tickLine={{ stroke: C.line }} axisLine={{ stroke: C.line }} />
                                <YAxis tick={axisTick} width={46} tickLine={{ stroke: C.line }} axisLine={{ stroke: C.line }} />
                                <Tooltip contentStyle={{ fontSize: 12, fontFamily: MONO, borderRadius: 0, border: `1px solid ${C.line}`, background: C.panel, color: C.ink }} formatter={(v) => [`${fmt(Number(v))} kWh`, '']} />
                                <Legend
                                    wrapperStyle={{ fontSize: 11, fontFamily: MONO, color: C.sub, cursor: 'pointer', paddingTop: 6 }}
                                    onClick={(e) => {
                                        if (e && e.dataKey) {
                                            toggleEntity(String(e.dataKey));
                                        }
                                    }}
                                    formatter={(value) => {
                                        const isHidden = hiddenEntities.has(value);
                                        return (
                                            <span
                                                style={{
                                                    color: isHidden ? C.sub : C.ink,
                                                    opacity: isHidden ? 0.35 : 1,
                                                    textDecoration: isHidden ? 'line-through' : 'none',
                                                    cursor: 'pointer',
                                                    userSelect: 'none',
                                                    padding: '0 4px',
                                                }}
                                                title={isHidden ? t('คลิกเพื่อเปิดแสดง', 'Click to show') : t('คลิกเพื่อปิดซ่อน', 'Click to hide')}
                                            >
                                                {value}
                                            </span>
                                        );
                                    }}
                                />
                                {entities.map((e, i) => (
                                    <Bar
                                        key={e.id}
                                        dataKey={e.name}
                                        stackId="a"
                                        fill={colorOf[e.name]}
                                        hide={hiddenEntities.has(e.name)}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: 12 }}>
                    <Cap en="SHARE" th={t('สัดส่วน %', 'Share %')} C={C} />
                    <div style={{ height: 175 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={visibleTotals} dataKey="value" nameKey="name" innerRadius={40} outerRadius={68} paddingAngle={1} stroke={C.panel}>
                                    {visibleTotals.map((t) => <Cell key={t.name} fill={colorOf[t.name]} />)}
                                </Pie>
                                <Tooltip formatter={(v) => `${fmt(Number(v))} kWh`} contentStyle={{ fontSize: 12, fontFamily: MONO, borderRadius: 0, border: `1px solid ${C.line}`, background: C.panel, color: C.ink }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {totals.map((item) => {
                            const isHidden = hiddenEntities.has(item.name);
                            const pct = isHidden ? 0 : ((item.value / visibleGrand) * 100);
                            return (
                                <div
                                    key={item.name}
                                    onClick={() => toggleEntity(item.name)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
                                        cursor: 'pointer', userSelect: 'none',
                                        opacity: isHidden ? 0.35 : 1,
                                        textDecoration: isHidden ? 'line-through' : 'none',
                                        transition: 'all 0.15s ease',
                                        padding: '2px 4px',
                                        borderRadius: 4,
                                    }}
                                    title={isHidden ? t('คลิกเพื่อเปิดแสดง', 'Click to show') : t('คลิกเพื่อปิดซ่อน', 'Click to hide')}
                                >
                                    <span style={{ width: 10, height: 10, background: isHidden ? C.sub : colorOf[item.name], borderRadius: 2, flexShrink: 0 }} />
                                    <span style={{ flex: 1, color: isHidden ? C.sub : C.ink }}>{item.name}</span>
                                    <span style={{ fontFamily: MONO, color: C.sub, fontSize: 11 }}>{fmt(item.value)}</span>
                                    <b style={{ fontFamily: MONO, minWidth: 44, textAlign: 'right', color: isHidden ? C.sub : C.ink }}>
                                        {isHidden ? 'OFF' : `${pct.toFixed(1)}%`}
                                    </b>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════ MAIN DASHBOARD ═══════════════════ */
interface ZoneDashboardProps {
    // 'zone' = ตัดมิเตอร์ MDB ออก · 'mdb' = เอาเฉพาะมิเตอร์ชนิด MDB
    variant?: 'zone' | 'mdb';
}
const ZoneDashboard: React.FC<ZoneDashboardProps> = ({ variant = 'zone' }) => {
    const { t, language } = useLanguage();
    const [dashboardData, setDashboardData] = useState<ZoneDashboardPayload>({
        tree: [],
        meters: [],
        trend: [],
        comparison: [],
    });
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const { tree, meters } = dashboardData;

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
        background: active ? C.accent : 'transparent', color: active ? '#fff' : C.accent,
        textDecoration: active ? 'none' : 'underline', textUnderlineOffset: 3,
    });

    const histRef = useRef<TrendPoint[]>([]); // บัฟเฟอร์กราฟ Realtime history
    const [, setHistVer] = useState(0);

    // Extract siteId, buildingId, floor, zoneId from path to filter trend/comparison data
    const currentSiteId = path[0] ? path[0].replace(/^\D+/, '') : undefined;
    const currentBuildingId = path[1] ? path[1].replace(/^\D+/, '') : undefined;
    // floor path has format "floor-{buildingId}-{floorNumber}"
    const currentFloor = path[2] ? (() => {
        const parts = path[2].split('-');
        return parts.length >= 3 ? parts[parts.length - 1] : undefined;
    })() : undefined;
    // zone path has format "zone-{zoneId}-{floorNumber}"
    const currentZoneId = path[3] ? (() => {
        const parts = path[3].split('-');
        return parts.length >= 3 ? parts[1] : undefined;
    })() : undefined;

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                const params: any = { mdb: variant === 'mdb' ? 'only' : 'exclude' };
                if (currentSiteId) params.siteId = currentSiteId;
                if (currentBuildingId) params.buildingId = currentBuildingId;
                if (currentFloor) params.floor = currentFloor;
                if (currentZoneId) params.zoneId = currentZoneId;
                const res = await dashboardApi.getZoneDashboard(params);
                if (!mounted) return;
                const next = res.data.data as ZoneDashboardPayload;
                setDashboardData({
                    tree: next.tree || [],
                    meters: next.meters || [],
                    trend: next.trend || [],
                    comparison: next.comparison || [],
                });
                histRef.current = (next.trend || []).slice(-120);
                setLoadError(null);
                setTick((t) => t + 1);
            } catch (error: any) {
                if (!mounted) return;
                setLoadError(error?.response?.data?.message || error?.message || (language === 'th' ? 'โหลดข้อมูลไม่สำเร็จ' : 'Unable to load data'));
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        const a = setInterval(load, 10000);
        const b = setInterval(() => setClock(Date.now()), 1000);
        return () => { mounted = false; clearInterval(a); clearInterval(b); };
    }, [language, currentSiteId, currentBuildingId, currentFloor, currentZoneId, variant]);

    const now = clock;
    const metersUnder = (p: string[]) => meters.filter((m) => p.every((id, i) => m.pathIds[i] === id));
    const scopeKw = () => metersUnder(path).reduce((s, m) => s + (m.disabled ? 0 : m.kw_3ph), 0);

    // กราฟ Realtime: รีเซ็ตเมื่อเปลี่ยนขอบเขต, เก็บตัวอย่างทุก 1 นาที (สูงสุด ~1 ชั่วโมง)
    useEffect(() => {
        histRef.current = dashboardData.trend.slice(-120);
        setHistVer((v) => v + 1);
    }, [dashboardData.trend]);

    let nodes: TreeNode[] = tree;
    for (const id of path) nodes = (nodes.find((n) => n.id === id)?.children) || [];
    const level = path.length;

    const items: ItemData[] = nodes.map((node) => {
        if (node.level === 'room') {
            const m = meters.find((x) => x.id === node.id)!;
            return { node, kwh: period(m), status: meterStatus(m, now), count: 1, counts: statusCounts([m], now), m };
        }
        const sub = metersUnder([...path, node.id]);
        return { node, kwh: sub.reduce((s, m) => s + period(m), 0), status: aggStatus(sub, now), count: sub.length, counts: statusCounts(sub, now) };
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
                <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 10.5, color: C.sub, display: 'flex', justifyContent: 'space-between', alignItems: 'center', letterSpacing: 0.3 }}>
                    <span>{it.node.level === 'room' ? `${it.m!.device} · L${it.m!.loop}` : `${it.count} MTR`}</span>
                    {it.node.level === 'room'
                        ? <span style={{ color: st.color, fontWeight: 600 }}>{t(st.labelTh, st.labelEn)}</span>
                        : <StatusTally counts={it.counts} C={C} />}
                </div>
            </button>
        );
    };

    const scope = metersUnder(path);
    const counts = statusCounts(scope, now);
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
            <div style={{ background: C.bar, color: C.ink, display: 'flex', alignItems: 'stretch', borderBottom: `2px solid ${C.accent}`, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderRight: `1px solid ${C.line}` }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}>{variant === 'mdb' ? <LayoutGrid size={16} /> : <Gauge size={16} />}</div>
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>{variant === 'mdb' ? 'DASHBOARD // MDB' : 'DASHBOARD // METER'}</div>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>{variant === 'mdb' ? t('ติดตามการใช้พลังงานเฉพาะตู้ MDB', 'MDB Energy Monitoring · Console') : t('ระบบติดตามการใช้พลังงาน', 'Energy Consumption Monitoring · Console')}</div>
                    </div>
                </div>

                <div style={{ display: 'flex' }}>
                    {([['monitor', t('สถานะปัจจุบัน', 'Current Status'), Activity], ['compare', t('วิเคราะห์เปรียบเทียบ', 'Comparative Analysis'), BarChart3]] as [string, string, any][]).map(([k, lb, Ic]) => (
                        <button key={k} onClick={() => setMode(k)} style={{ ...tabBar(mode === k), borderRight: `1px solid ${C.line}` }}>
                            <Ic size={14} /> {lb}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 1, padding: '0 8px', borderLeft: `1px solid ${C.line}` }}>
                    {[
                        { k: 'e', icon: Zap, label: t('ไฟฟ้า', 'Electricity'), on: true },
                        { k: 'w', icon: Droplet, label: t('น้ำ', 'Water') },
                        { k: 'g', icon: Flame, label: t('แก๊ส', 'Gas') },
                        { k: 's', icon: Sun, label: 'Solar' },
                    ].map((item) => {
                        const Ico = item.icon;
                        return (
                            <div key={item.k} title={item.on ? '' : t('เร็วๆ นี้', 'Coming Soon')} style={{
                                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', fontFamily: MONO, fontSize: 11,
                                cursor: item.on ? 'default' : 'not-allowed', color: item.on ? C.ink : C.sub,
                                borderBottom: item.on ? `2px solid ${C.accent}` : '2px solid transparent'
                            }}>
                                <Ico size={13} /> {item.label}
                            </div>
                        );
                    })}
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', fontFamily: MONO, fontSize: 11.5 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.ink }}>
                        <StatusDot s="normal" size={8} pulse C={C} /> LIVE
                    </span>
                    <span style={{ color: C.barSub, fontVariantNumeric: 'tabular-nums' }}>{new Date(now).toLocaleTimeString(t('th-TH', 'en-US'))}</span>
                </div>
            </div>

            {loading && (
                <LoadingScreen inline theme={theme} />
            )}

            {!loading && (loadError || meters.length === 0) && (
                <div style={{
                    margin: '0 16px 12px', padding: '10px 13px', background: C.panel,
                    border: `1px solid ${loadError ? C.red : C.line}`, borderLeft: `3px solid ${loadError ? C.red : C.accent}`,
                    fontFamily: MONO, fontSize: 11.5, color: C.ink
                }}>
                    {loadError
                        ? `${t('โหลดข้อมูลไม่สำเร็จ', 'Unable to load data')}: ${loadError}`
                        : t('ไม่พบข้อมูลมิเตอร์ในฐานข้อมูล', 'No meter data found in database')}
                </div>
            )}

            {mode === 'monitor' ? (
                <React.Fragment>
                    {/* Breadcrumb */}
                    <div style={{
                        padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                        background: C.panel, borderBottom: `1px solid ${C.line}`, fontFamily: MONO, fontSize: 12,
                        margin: '0 16px 12px'
                    }}>
                        <button onClick={() => jump(0)} style={crumb(path.length === 0)}><Home size={12} /> {t('ทุกสาขา', 'All Sites')}</button>
                        {path.map((id, i) => {
                            let n = tree; let node: TreeNode | undefined;
                            for (let k = 0; k <= i; k++) { node = n.find((x) => x.id === path[k]); n = node?.children || []; }
                            return (
                                <React.Fragment key={id}>
                                    <span style={{ color: C.sub }}>/</span>
                                    <button onClick={() => jump(i + 1)} style={crumb(i === path.length - 1)}>{formatNodeName(node?.name || '', t)}</button>
                                </React.Fragment>
                            );
                        })}
                        <span style={{ marginLeft: 'auto', color: C.sub, letterSpacing: 1 }}>
                            {t('ระดับ', 'LEVEL')}: <b style={{ color: C.accent }}>{t(LEVEL_TH[level], LEVEL_EN[level])}</b>
                        </span>
                    </div>

                    {/* Summary strip */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', background: C.panel, borderBottom: `1px solid ${C.line}`, margin: '0 16px 16px', border: `1px solid ${C.line}` }}>
                        <div style={{ padding: '11px 18px', borderRight: `1px solid ${C.line}`, minWidth: 180 }}>
                            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: C.sub, textTransform: 'uppercase' }}>{t('รวม · งวดนี้', 'Total · This Period')}</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                                <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 24, fontWeight: 700, color: C.accent }}>{fmt(totalKwh)}</span>
                                <span style={{ fontFamily: MONO, fontSize: 11, color: C.sub }}>kWh</span>
                            </div>
                        </div>
                        {STATUS_ORDER.map((s) => (
                            <div key={s} style={{ padding: '11px 16px', borderRight: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 9, minWidth: 110 }}>
                                <StatusDot s={s} size={11} C={C} />
                                <div>
                                    <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: 0.5, color: C.sub, textTransform: 'uppercase' }}>{t(getStatusInfo(s, C).labelTh, getStatusInfo(s, C).labelEn)}</div>
                                    <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, color: C.ink }}>{counts[s] || 0}</div>
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
                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                            <Cap idx={`0${level + 1}`} en={level === 2 ? (bldgView === 'sld' ? 'LAYOUT DIAGRAM' : 'FLOOR VIEW') : level === 3 ? 'ZONE PLAN' : level === 4 ? 'UNITS' : LEVEL_EN[level]}
                                th={level === 2 ? `${formatNodeName(currentName || '', t)} · ${bldgView === 'sld' ? t('ไดอะแกรมเส้นเดียว', 'Layout Diagram') : t('ผังด้านข้าง (บน→ล่าง)', 'Building Side View')}` : level === 3 ? `${formatNodeName(currentName || '', t)} · ${t('ผังพื้นที่', 'Floor Layout')}` : level === 4 ? `${formatNodeName(currentName || '', t)} · ${t('ตาราง Realtime (ทุกค่า)', 'Realtime Table')}` : t('เรียงมาก→น้อย', 'Sorted High → Low')}
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

                            {(counts.offline > 0 || counts.zero > 0) && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: C.panel,
                                    borderLeft: `3px solid ${counts.offline > 0 ? '#EF4444' : '#F59E0B'}`, border: `1px solid ${C.line}`, padding: '9px 12px', marginBottom: 12
                                }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                                        <Bell size={14} color={counts.offline > 0 ? '#EF4444' : '#F59E0B'} />
                                        <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.sub, letterSpacing: 0.3 }}>{t('แจ้งเตือน', 'ALERT')}</span>
                                    </span>
                                    {counts.offline > 0 && (
                                        <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.ink, letterSpacing: 0.3 }}>
                                            <b style={{ color: '#EF4444' }}>{counts.offline}</b> {t('มิเตอร์ไม่มีสัญญาณ (ขาดการติดต่อ)', 'Meters With No Signal (Lost Contact)')}
                                        </span>
                                    )}
                                    {counts.zero > 0 && (
                                        <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.ink, letterSpacing: 0.3 }}>
                                            <b style={{ color: '#F59E0B' }}>{counts.zero}</b> {t('มิเตอร์ส่งค่าเป็นศูนย์ (ติดต่อได้ แต่ไม่มีค่าวัด)', 'Meters Reading Zero (Reachable, No Measurement)')}
                                        </span>
                                    )}
                                </div>
                            )}

                            {level === 2 ? (
                                bldgView === 'sld' ? (
                                    <SingleLine main={{ name: currentName, kwh: totalKwh, status: aggStatus(scope, now), counts: statusCounts(scope, now) }}
                                        feeders={[...items].sort((a, b) => fnum(a.node.name) - fnum(b.node.name))} onPick={go} C={C} />
                                ) : (
                                    <div style={{
                                        border: `1px solid ${C.line}`, background: C.panel,
                                        boxShadow: theme === 'light' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                                    }}>
                                        {/* Floor View Header Bar */}
                                        <div style={{
                                            padding: '10px 16px', background: C.bar,
                                            borderBottom: `1px solid ${C.line}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            fontFamily: MONO, fontSize: 11, color: C.sub,
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: C.ink }}>
                                                <span>🏢</span>
                                                <span>{formatNodeName(currentName || '', t)}</span>
                                            </div>
                                            <div>
                                                <span>{floorItems.length} {t('ชั้น', 'Floors')} · {t('เรียงจากชั้นบนลงล่าง', 'Top to Bottom')}</span>
                                            </div>
                                        </div>

                                        {/* Floor Rows */}
                                        {floorItems.map((it, idx) => {
                                            const st = getStatusInfo(it.status, C);
                                            const floorPct = maxFloorKwh > 0 ? (it.kwh / maxFloorKwh) * 100 : 0;
                                            const totalPct = totalKwh > 0 ? ((it.kwh / totalKwh) * 100).toFixed(1) : '0';

                                            return (
                                                <button key={it.node.id} className="ec-row" onClick={() => openItem(it)} style={{
                                                    display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
                                                    background: 'transparent', border: 'none',
                                                    borderTop: idx === 0 ? 'none' : `1px solid ${C.line}`,
                                                    borderLeft: `4px solid ${st.color}`, padding: '14px 18px',
                                                    cursor: 'pointer', transition: 'background-color 0.15s ease',
                                                }}>
                                                    {/* Floor Label Badge */}
                                                    <div style={{
                                                        minWidth: 90, display: 'flex', alignItems: 'center', gap: 6,
                                                        fontFamily: MONO, fontWeight: 700, fontSize: 13, color: C.ink,
                                                    }}>
                                                        <span style={{
                                                            display: 'inline-block', padding: '3px 8px', background: C.panel2,
                                                            border: `1px solid ${C.line}`, fontSize: 12,
                                                        }}>
                                                            {formatNodeName(it.node.name, t)}
                                                        </span>
                                                    </div>

                                                    {/* Meter count pill + online/offline tally */}
                                                    <div style={{
                                                        minWidth: 128, fontFamily: MONO, fontSize: 11, color: C.sub,
                                                        display: 'flex', alignItems: 'center', gap: 6,
                                                    }}>
                                                        <span style={{
                                                            padding: '2px 6px', background: C.panel2, border: `1px solid ${C.line}80`,
                                                            fontSize: 10.5, fontWeight: 600,
                                                        }}>
                                                            {it.count} {t('มิเตอร์', 'MTR')}
                                                        </span>
                                                        <StatusTally counts={it.counts} C={C} />
                                                    </div>

                                                    {/* Energy Distribution Bar */}
                                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
                                                        <div style={{ height: 10, background: C.panel2, position: 'relative', border: `1px solid ${C.line}`, borderRadius: 2, overflow: 'hidden' }}>
                                                            <div style={{
                                                                width: `${Math.max(floorPct, 1)}%`, height: '100%',
                                                                background: `linear-gradient(90deg, ${C.accent}aa, ${st.color})`,
                                                                transition: 'width 0.5s ease',
                                                            }} />
                                                        </div>
                                                    </div>

                                                    {/* Total energy & % of building */}
                                                    <div style={{ textAlign: 'right', minWidth: 110, fontFamily: MONO }}>
                                                        <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 15, fontWeight: 700, color: C.ink }}>
                                                            {fmt(it.kwh)} <span style={{ fontSize: 10, color: C.sub, fontWeight: 500 }}>kWh</span>
                                                        </div>
                                                        <div style={{ fontSize: 10, color: C.sub }}>
                                                            {totalPct}% {t('ของทั้งตึก', 'of bldg')}
                                                        </div>
                                                    </div>

                                                    {/* Status & Navigation */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <StatusDot s={it.status} pulse C={C} />
                                                        <ChevronRight size={14} style={{ color: C.sub }} />
                                                    </div>
                                                </button>
                                            );
                                        })}
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
                                    <span style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: 1, fontWeight: 700 }}>{t('สถานะปัจจุบัน', 'CURRENT STATUS')}</span>
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
                                                <th style={th()}>{level === 4 ? 'METER' : t(LEVEL_TH[level], LEVEL_EN[level])}</th>
                                                <th style={{ ...th(), textAlign: 'right' }}>kWh</th>
                                                <th style={{ ...th(), textAlign: 'center' }}>STS</th>
                                                <th style={{ ...th(), textAlign: 'right' }}>AGE</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sorted.map((it, i) => {
                                                const scopedMeters = it.m ? [it.m] : metersUnder([...path, it.node.id]);
                                                const ago = latestAge(scopedMeters, now);
                                                const hasRealtime = scopedMeters.some(isRealtime);
                                                return (
                                                    <tr key={it.node.id} className="ec-row" onClick={() => openItem(it)} style={{ borderTop: `1px solid ${C.line}` }}>
                                                        <td style={{ ...td(), color: C.sub, fontFamily: MONO }}>{String(i + 1).padStart(2, '0')}</td>
                                                        <td style={{ ...td(), color: C.ink }}>
                                                            {formatNodeName(it.node.name, t)}
                                                            {hasRealtime && <span style={{ marginLeft: 6, color: C.green, fontFamily: MONO, fontSize: 10, fontWeight: 700 }}>RT</span>}
                                                            {it.node.level === 'room' && <span style={{ color: C.sub, fontFamily: MONO, fontSize: 10.5 }}> {it.m!.channel}</span>}
                                                        </td>
                                                        <td style={{ ...td(), textAlign: 'right', fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: C.ink }}>{fmt(it.kwh)}</td>
                                                        <td style={{ ...td(), textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                            <span style={{ display: 'inline-flex' }}>
                                                                {it.node.level === 'room'
                                                                    ? <StatusDot s={it.status} C={C} />
                                                                    : <StatusTally counts={it.counts} size={10} C={C} />}
                                                            </span>
                                                        </td>
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

                    {/* Realtime history — bottom */}
                    <div style={{ padding: '0 16px 16px' }}>
                        {(() => {
                            const buf = histRef.current;
                            const curKw = buf.length ? buf[buf.length - 1].kw : 0;
                            const peak = buf.reduce((mx, p) => Math.max(mx, p.kw), 0);
                            const curKwh = buf.length ? (buf[buf.length - 1].kwh || 0) : 0;
                            const totalReadings = buf.reduce((sum, p) => sum + (p.readings || 0), 0);
                            const tdata = buf.map((p, idx) => ({
                                idx,
                                kw: p.kw,
                                kwh: p.kwh || 0,
                                readings: p.readings || 0,
                                t: new Date(p.t).toLocaleTimeString(t('th-TH', 'en-US'), { hour: '2-digit', minute: '2-digit' }),
                            }));
                            return (
                                <div style={{ background: C.panel, border: `1px solid ${C.line}`, margin: '0 16px' }}>
                                    <div style={{ padding: '9px 14px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 10, background: C.panel2, flexWrap: 'wrap' }}>
                                        <Activity size={14} color={C.accent} />
                                        <span style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: 1, fontWeight: 700 }}>REALTIME TREND</span>
                                        <span style={{ fontSize: 12, color: C.sub }}>{t('ข้อมูลย้อนหลัง 24 ชม. · ', 'Last 24h history · ')}{level === 0 ? t('ทุกสาขา', 'All Branches') : (() => {
                                            const parts: string[] = [];
                                            let n = tree;
                                            for (let k = 0; k < path.length; k++) {
                                                const node = n.find((x) => x.id === path[k]);
                                                if (node) { parts.push(formatNodeName(node.name, t)); n = node.children || []; }
                                            }
                                            return parts.join(' › ') || formatNodeName(currentName || '', t);
                                        })()}</span>
                                        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 5 }}>
                                            <StatusDot s="normal" size={8} pulse C={C} />
                                            <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 20, fontWeight: 700, color: C.accent }}>{fmt(curKwh, 2)}</span>
                                            <span style={{ fontFamily: MONO, fontSize: 11, color: C.sub }}>kWh</span>
                                            <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.sub, marginLeft: 8 }}>{fmt(curKw, 2)} kW · PEAK {fmt(peak, 2)}</span>
                                        </span>
                                    </div>

                                    {/* kWh trend chart */}
                                    <div style={{ padding: '4px 14px 0', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                        <span style={{ width: 10, height: 3, background: C.accent, display: 'inline-block' }} />
                                        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 0.5, color: C.sub }}>kWh · {t('พลังงานสะสม', 'Cumulative Energy')}</span>
                                    </div>
                                    <div style={{ height: 160, padding: '4px 8px 0' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={tdata} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="2 3" stroke={C.line} vertical={false} />
                                                <XAxis dataKey="t" tick={{ fontSize: 9.5, fill: C.sub, fontFamily: MONO }} minTickGap={60} tickLine={false} axisLine={{ stroke: C.line }} />
                                                <YAxis tick={{ fontSize: 10, fill: C.sub, fontFamily: MONO }} width={70} tickLine={false} axisLine={{ stroke: C.line }} domain={['dataMin', 'dataMax']} />
                                                <Tooltip
                                                    contentStyle={{ fontSize: 12, fontFamily: MONO, borderRadius: 0, border: `1px solid ${C.line}`, background: C.panel, color: C.ink }}
                                                    formatter={(v: any) => [`${fmt(Number(v), 2)} kWh`, 'kWh']}
                                                />
                                                <Line type="monotone" dataKey="kwh" stroke={C.accent} strokeWidth={2} dot={{ r: 2, fill: C.accent, strokeWidth: 0 }} isAnimationActive={false} />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>

                                    {/* Records bar chart */}
                                    <div style={{ borderTop: `1px solid ${C.line}`, margin: '4px 14px 0', paddingTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ width: 10, height: 8, background: C.green, opacity: 0.5, display: 'inline-block' }} />
                                        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 0.5, color: C.sub }}>RECORDS · {t('จำนวนข้อมูลที่ได้รับ', 'Received Data Count')}</span>
                                        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 10.5, color: C.sub }}>{t('รวม', 'Total')} <b style={{ color: C.ink }}>{fmt(totalReadings, 0)}</b> REC</span>
                                    </div>
                                    <div style={{ height: 90, padding: '4px 8px 0' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={tdata} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="2 3" stroke={C.line} vertical={false} />
                                                <XAxis dataKey="t" tick={{ fontSize: 9.5, fill: C.sub, fontFamily: MONO }} minTickGap={60} tickLine={false} axisLine={{ stroke: C.line }} />
                                                <YAxis tick={{ fontSize: 10, fill: C.sub, fontFamily: MONO }} width={70} tickLine={false} axisLine={{ stroke: C.line }} allowDecimals={false} />
                                                <Tooltip
                                                    contentStyle={{ fontSize: 12, fontFamily: MONO, borderRadius: 0, border: `1px solid ${C.line}`, background: C.panel, color: C.ink }}
                                                    formatter={(v: any) => [`${fmt(Number(v), 0)} records`, 'records']}
                                                />
                                                <Bar dataKey="readings" fill={C.green} opacity={0.4} isAnimationActive={false} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>

                                    <div style={{ padding: '3px 14px 8px', fontFamily: MONO, fontSize: 9.5, color: C.sub, letterSpacing: 0.5 }}>
                                        {t('← ย้อนหลัง 24 ชั่วโมง · bucket ทุก 15 นาที', '← Last 24 hours · 15-min buckets')}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </React.Fragment>
            ) : (
                <Compare meters={meters} tree={tree} now={now} C={C} comparison={dashboardData.comparison} />
            )}

            {selected && <MeterDetail m={selected} now={now} onClose={() => setSelected(null)} C={C} />}
        </div>
    );
};

export default ZoneDashboard;
