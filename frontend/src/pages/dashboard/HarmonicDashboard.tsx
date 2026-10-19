import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine,
    ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Activity, AlertTriangle, BarChart3, Clock, Gauge, RefreshCw, ShieldAlert, Waves, Zap } from 'lucide-react';
import { powerQualityApi } from '../../api/client';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';

/* ─────────────────────────── theme / constants ─────────────────────────── */

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, "Cascadia Mono", monospace';
const THEMES = {
    light: {
        bg: '#EAE7DA', panel: '#FBFAF4', panel2: '#F1EFE3', ink: '#23261E', sub: '#6E705F',
        line: '#D4D1C0', bar: '#F1EFE3', barSub: '#8A8C7A', accent: '#2B4C7E',
        green: '#16a34a', yellow: '#C08A1E', red: '#dc2626', cardBg: '#FFFFFF', grid: '#E4E1D2',
    },
    dark: {
        bg: '#0E1116', panel: '#161B22', panel2: '#1C232E', ink: '#E6EDF3', sub: '#8B98A6',
        line: '#2A313C', bar: '#080A0E', barSub: '#8B98A6', accent: '#36C2CE',
        green: '#34d399', yellow: '#D29922', red: '#f85149', cardBg: '#1C232E', grid: '#252C37',
    },
};
/** Phase colours (R / Y / B convention). */
const PHASE_COLORS = ['#E5484D', '#E2A400', '#3E7BFA'];
const ORDER_COLORS = ['#E5484D', '#E2A400', '#3E7BFA', '#30A46C', '#8E4EC6', '#12A594', '#F76B15'];

type Datatype = 'HD33-VL' | 'HD33-VLL' | 'HD33-IL';

const DATATYPES: Record<Datatype, {
    th: string; en: string; phases: [string, string, string]; thdKeys: [string, string, string]; kind: 'V' | 'I';
}> = {
    'HD33-VL': { th: 'แรงดันเฟส (L-N)', en: 'Voltage L-N', phases: ['V1', 'V2', 'V3'], thdKeys: ['thd_vl1', 'thd_vl2', 'thd_vl3'], kind: 'V' },
    'HD33-VLL': { th: 'แรงดันระหว่างสาย (L-L)', en: 'Voltage L-L', phases: ['V12', 'V23', 'V31'], thdKeys: ['thd_vl12', 'thd_vl23', 'thd_vl31'], kind: 'V' },
    'HD33-IL': { th: 'กระแส', en: 'Current', phases: ['I1', 'I2', 'I3'], thdKeys: ['thd_il1', 'thd_il2', 'thd_il3'], kind: 'I' },
};

/**
 * Reference thresholds (IEEE 519-2014, LV ≤ 1 kV): voltage THD 8 %, individual voltage harmonic 5 %.
 * Current limits depend on Isc/IL; 8 % / 20 % used here as a visual guide only.
 */
const LIMITS = {
    V: { thdWarn: 5, thdBad: 8, individual: 5 },
    I: { thdWarn: 8, thdBad: 20, individual: null as number | null },
};

const ORDERS = Array.from({ length: 32 }, (_, i) => i + 2); // H2..H33
const HOURS_OPTIONS = [6, 24, 72, 168];
const LATEST_REFRESH_MS = 30_000;
const HISTORY_REFRESH_MS = 5 * 60_000;
const STALE_MS = 5 * 60_000;

/* ─────────────────────────── types ─────────────────────────── */

interface Source {
    site_id: number; address_id: number; channel: string;
    harmonic_types: string[]; has_demand: boolean; last_seen: string | null;
    meter_id: number | null; meter_code: string | null; meter_name: string | null; site_name: string | null;
}
interface Spectrum { datatype: string; phases: Array<Array<number | null>>; device: string | null; code: string | null; sampleCount: number; bucketStart: string; deviceDatetime: string }
interface Latest {
    siteId: number; addressId: number; channel: string;
    spectra: Record<string, Spectrum>;
    thd: Record<string, any> | null;
    base: Record<string, any> | null;
    maxDemand: Record<string, any> | null;
}
interface Snapshot { bucketStart: string; phases: Array<Array<number | null>> }

/* ─────────────────────────── helpers ─────────────────────────── */

const fmt = (v: number | null | undefined, digits = 2) =>
    v === null || v === undefined || Number.isNaN(v) ? '–' : Number(v).toFixed(digits);
const fmtTime = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '–';
const fmtAxisTime = (iso: string, hours: number) => {
    const d = new Date(iso);
    return hours > 24
        ? d.toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
        : d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
};
const sourceKey = (s: { site_id: number; address_id: number }) => `${s.site_id}_${s.address_id}`;
const unwrap = (res: any) => res?.data?.data ?? res?.data;

/* ─────────────────────────── component ─────────────────────────── */

const HarmonicDashboard: React.FC = () => {
    const { theme } = useTheme();
    const { t } = useLanguage();
    const { user } = useAuth();
    const C = THEMES[theme];

    const [sources, setSources] = useState<Source[]>([]);
    const [selected, setSelected] = useState<string>('');
    const [datatype, setDatatype] = useState<Datatype>('HD33-VL');
    const [hours, setHours] = useState(24);
    const [trendPhase, setTrendPhase] = useState(0);
    const [trendOrders, setTrendOrders] = useState<number[]>([3, 5, 7, 11, 13]);
    const [oddOnly, setOddOnly] = useState(false);

    const [latest, setLatest] = useState<Latest | null>(null);
    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
    const [thdHistory, setThdHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [lastFetch, setLastFetch] = useState<Date | null>(null);
    const [now, setNow] = useState(Date.now());

    const source = useMemo(() => sources.find((s) => sourceKey(s) === selected) || null, [sources, selected]);
    const params = useMemo(() => (source ? { siteId: source.site_id, addressId: source.address_id } : null), [source]);
    const cfg = DATATYPES[datatype];
    const limits = LIMITS[cfg.kind];

    /* data loading */
    const loadSources = useCallback(async () => {
        try {
            const list: Source[] = unwrap(await powerQualityApi.getSources({ days: 7 })) || [];
            setSources(list);
            setSelected((prev) => (prev && list.some((s) => sourceKey(s) === prev) ? prev : list[0] ? sourceKey(list[0]) : ''));
            setError('');
        } catch (err: any) {
            setError(err?.response?.data?.error?.message || err?.message || t('โหลดรายการอุปกรณ์ไม่สำเร็จ', 'Failed to load devices'));
        }
    }, [t]);

    const loadLatest = useCallback(async () => {
        if (!params) return;
        try {
            setLatest(unwrap(await powerQualityApi.getLatest(params)));
            setLastFetch(new Date());
            setError('');
        } catch (err: any) {
            setError(err?.response?.data?.error?.message || err?.message || t('โหลดข้อมูลไม่สำเร็จ', 'Failed to load data'));
        }
    }, [params, t]);

    const loadHarmonics = useCallback(async () => {
        if (!params) return;
        try {
            const h = unwrap(await powerQualityApi.getHarmonicsHistory({ ...params, datatype, hours }));
            setSnapshots(h || []);
        } catch (err: any) {
            setError(err?.response?.data?.error?.message || err?.message || t('โหลดข้อมูลย้อนหลังไม่สำเร็จ', 'Failed to load history'));
        }
    }, [params, datatype, hours, t]);

    const loadThd = useCallback(async () => {
        if (!params) return;
        try {
            const thd = unwrap(await powerQualityApi.getThdHistory({ ...params, hours }));
            setThdHistory(thd || []);
        } catch (err: any) {
            setError(err?.response?.data?.error?.message || err?.message || t('โหลดข้อมูลย้อนหลังไม่สำเร็จ', 'Failed to load history'));
        }
    }, [params, hours, t]);

    const refreshAll = useCallback(async () => {
        setLoading(true);
        await loadSources();
        await Promise.all([loadLatest(), loadHarmonics(), loadThd()]);
        setLoading(false);
    }, [loadSources, loadLatest, loadHarmonics, loadThd]);

    useEffect(() => { loadSources(); }, [loadSources]);
    useEffect(() => {
        setLatest(null);
        if (!params) return;
        setLoading(true);
        loadLatest().finally(() => setLoading(false));
        const id = setInterval(loadLatest, LATEST_REFRESH_MS);
        return () => clearInterval(id);
    }, [loadLatest, params]);
    useEffect(() => {
        loadHarmonics();
        const id = setInterval(loadHarmonics, HISTORY_REFRESH_MS);
        return () => clearInterval(id);
    }, [loadHarmonics]);
    useEffect(() => {
        loadThd();
        const id = setInterval(loadThd, HISTORY_REFRESH_MS);
        return () => clearInterval(id);
    }, [loadThd]);
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 10_000);
        return () => clearInterval(id);
    }, []);

    /* derived data */
    const spectrum = latest?.spectra?.[datatype] || null;
    const availableTypes = useMemo(() => new Set(Object.keys(latest?.spectra || {})), [latest]);

    const spectrumData = useMemo(() => {
        if (!spectrum) return [];
        return ORDERS
            .map((h, i) => ({
                order: `H${h}`, h,
                p0: spectrum.phases[0]?.[i] ?? null,
                p1: spectrum.phases[1]?.[i] ?? null,
                p2: spectrum.phases[2]?.[i] ?? null,
            }))
            .filter((row) => !oddOnly || row.h % 2 === 1);
    }, [spectrum, oddOnly]);

    const topHarmonics = useMemo(() => {
        if (!spectrum) return [];
        return ORDERS.map((h, i) => {
            const vals = [0, 1, 2].map((p) => spectrum.phases[p]?.[i] ?? null);
            const max = Math.max(...vals.map((v) => v ?? 0));
            return { h, vals, max };
        }).sort((a, b) => b.max - a.max).slice(0, 6);
    }, [spectrum]);

    /** Per-phase THD computed from the spectrum: sqrt(Σ Hn²) (H2..H33, % of fundamental). */
    const composition = useMemo(() => {
        if (!spectrum) return null;
        return [0, 1, 2].map((p) => {
            let odd = 0, even = 0, triplen = 0;
            ORDERS.forEach((h, i) => {
                const v = spectrum.phases[p]?.[i] ?? 0;
                const sq = v * v;
                if (h % 3 === 0 && h % 2 === 1) triplen += sq;
                if (h % 2 === 1) odd += sq; else even += sq;
            });
            return { total: Math.sqrt(odd + even), odd: Math.sqrt(odd), even: Math.sqrt(even), triplen: Math.sqrt(triplen) };
        });
    }, [spectrum]);

    const trendData = useMemo(() => snapshots.map((s) => {
        const row: Record<string, any> = { t: s.bucketStart };
        trendOrders.forEach((h) => { row[`H${h}`] = s.phases[trendPhase]?.[h - 2] ?? null; });
        return row;
    }), [snapshots, trendOrders, trendPhase]);

    const thdTrendData = useMemo(() => thdHistory.map((r) => ({
        t: r.bucket_start,
        p0: r[cfg.thdKeys[0]], p1: r[cfg.thdKeys[1]], p2: r[cfg.thdKeys[2]],
    })), [thdHistory, cfg]);

    const lastSeen = latest?.thd?.deviceDatetime || spectrum?.deviceDatetime || source?.last_seen || null;
    const isStale = lastSeen ? now - new Date(lastSeen).getTime() > STALE_MS : true;

    const thdColor = (v: number | null | undefined, kind: 'V' | 'I') => {
        if (v === null || v === undefined) return C.sub;
        const l = LIMITS[kind];
        return v > l.thdBad ? C.red : v > l.thdWarn ? C.yellow : C.green;
    };

    /* ─────────────── render helpers ─────────────── */

    const card: React.CSSProperties = { background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10, padding: '14px 16px' };
    const cardTitle = (icon: React.ReactNode, text: string, right?: React.ReactNode) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ color: C.accent, display: 'flex' }}>{icon}</span>
            <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 12, letterSpacing: 1, color: C.ink }}>{text}</span>
            <div style={{ flex: 1 }} />
            {right}
        </div>
    );
    const pill = (active: boolean, disabled = false): React.CSSProperties => ({
        background: active ? C.accent : 'transparent', color: active ? '#fff' : disabled ? C.line : C.ink,
        border: `1px solid ${active ? C.accent : C.line}`, borderRadius: 6, padding: '5px 10px',
        fontSize: 12, fontFamily: MONO, cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
    });
    const tooltipStyle = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, fontFamily: MONO, fontSize: 12, color: C.ink };
    const empty = (text: string, height = 220) => (
        <div style={{ height, display: 'grid', placeItems: 'center', color: C.sub, fontSize: 13, textAlign: 'center' }}>{text}</div>
    );

    const ThdCard: React.FC<{ title: string; keys: string[]; labels: string[]; kind: 'V' | 'I' }> = ({ title, keys, labels, kind }) => (
        <div style={card}>
            <div style={{ color: C.sub, fontSize: 11, fontFamily: MONO, letterSpacing: 1, marginBottom: 8 }}>{title}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {keys.map((k, i) => {
                    const v = latest?.thd?.[k] as number | null | undefined;
                    return (
                        <div key={k}>
                            <div style={{ fontSize: 10, color: PHASE_COLORS[i], fontFamily: MONO, fontWeight: 700 }}>{labels[i]}</div>
                            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: MONO, color: thdColor(v, kind) }}>
                                {fmt(v)}<span style={{ fontSize: 11, color: C.sub, marginLeft: 2 }}>%</span>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div style={{ fontSize: 10, color: C.sub, marginTop: 6 }}>
                {t('เกณฑ์อ้างอิง', 'Reference')}: ≤{LIMITS[kind].thdWarn}% {t('ปกติ', 'good')} · &gt;{LIMITS[kind].thdBad}% {t('เกินเกณฑ์', 'exceeds')}
            </div>
        </div>
    );

    /* ─────────────── render ─────────────── */

    return (
        <div>
            {/* Command bar */}
            <div style={{ background: C.bar, color: C.ink, display: 'flex', alignItems: 'stretch', borderBottom: `2px solid ${C.accent}`, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}><Waves size={16} /></div>
                    <div>
                        <h1 style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2, margin: 0 }}>{t('แดชบอร์ด // ฮาร์มอนิก', 'DASHBOARD // HARMONICS')}</h1>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>{t('คุณภาพไฟฟ้า: THD, สเปกตรัมฮาร์มอนิก H2–H33, Max Demand', 'Power quality: THD, H2–H33 harmonic spectrum, max demand')}</div>
                    </div>
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', flexWrap: 'wrap' }}>
                    <select
                        id="harmonic-source-select"
                        value={selected}
                        onChange={(e) => setSelected(e.target.value)}
                        style={{ background: C.panel2, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 6, padding: '6px 10px', fontSize: 12, fontFamily: MONO, minWidth: 260 }}
                    >
                        {sources.length === 0 && <option value="">{t('— ไม่มีมิเตอร์ที่สามารถเลือกได้ —', '— No meters available —')}</option>}
                        {sources.map((s) => (
                            <option key={sourceKey(s)} value={sourceKey(s)}>
                                {s.channel} · {s.meter_name || s.meter_code || t('ยังไม่ผูกมิเตอร์', 'unmapped')}
                            </option>
                        ))}
                    </select>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: MONO, color: isStale ? C.yellow : C.green }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: isStale ? C.yellow : C.green, animation: isStale ? 'none' : 'hd-pulse 2s infinite' }} />
                        {isStale ? t('ไม่มีข้อมูลใหม่', 'STALE') : 'LIVE'}
                    </span>
                    <button id="harmonic-refresh" onClick={refreshAll} disabled={loading} style={{
                        background: 'transparent', border: 'none', color: C.accent, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: MONO,
                    }}><RefreshCw size={14} style={{ animation: loading ? 'hd-spin 1s linear infinite' : 'none' }} /> {t('รีเฟรช', 'Refresh')}</button>
                </div>
            </div>

            <div style={{ padding: '0 16px 24px' }}>
                {error && (
                    <div style={{ background: C.red + '18', color: C.red, padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AlertTriangle size={16} /> {error}
                    </div>
                )}

                {!source ? (
                    <div style={{ ...card, padding: 40 }}>
                        {empty(
                            sources.length === 0
                                ? t('ไม่มีมิเตอร์ที่มีข้อมูลฮาร์มอนิกในสิทธิ์การเข้าถึงของคุณ', 'No harmonic meters available for your permitted sites')
                                : t('ยังไม่มีข้อมูลฮาร์มอนิก — กรุณาเลือกมิเตอร์', 'No harmonic data — please select a meter'),
                            160
                        )}
                    </div>
                ) : (
                    <>
                        {/* Source strip */}
                        <div style={{ ...card, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16, padding: '10px 16px' }}>
                            {[
                                { label: t('มิเตอร์', 'METER'), value: source.meter_name ? `${source.meter_code ?? ''} ${source.meter_name}`.trim() : t('ยังไม่ผูกมิเตอร์', 'Not mapped') },
                                { label: t('ไซต์', 'SITE'), value: source.site_name || '–' },
                                { label: 'CHANNEL', value: source.channel },
                                { label: t('อุปกรณ์', 'DEVICE'), value: spectrum?.device || latest?.base?.device || '–' },
                                { label: t('อัปเดตล่าสุด', 'LAST DATA'), value: fmtTime(lastSeen) },
                                { label: 'Hz', value: fmt(latest?.base?.hz) },
                                { label: 'PF', value: latest?.base ? `${fmt(latest.base.pf1, 3)} / ${fmt(latest.base.pf2, 3)} / ${fmt(latest.base.pf3, 3)}` : '–' },
                            ].map((f) => (
                                <div key={f.label}>
                                    <div style={{ fontSize: 10, color: C.sub, fontFamily: MONO, letterSpacing: 1 }}>{f.label}</div>
                                    <div style={{ fontSize: 13, color: C.ink, fontFamily: MONO, fontWeight: 600 }}>{f.value}</div>
                                </div>
                            ))}
                            <div style={{ flex: 1 }} />
                            <span style={{ fontSize: 10, color: C.sub, fontFamily: MONO }}>
                                <Clock size={11} style={{ verticalAlign: 'middle' }} /> {t('ดึงข้อมูล', 'fetched')} {lastFetch ? lastFetch.toLocaleTimeString('th-TH') : '–'}
                            </span>
                        </div>

                        {/* THD KPI */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 16 }}>
                            <ThdCard title={t('THD แรงดันเฟส (L-N)', 'THD VOLTAGE L-N')} keys={DATATYPES['HD33-VL'].thdKeys} labels={DATATYPES['HD33-VL'].phases} kind="V" />
                            <ThdCard title={t('THD แรงดันระหว่างสาย (L-L)', 'THD VOLTAGE L-L')} keys={DATATYPES['HD33-VLL'].thdKeys} labels={DATATYPES['HD33-VLL'].phases} kind="V" />
                            <ThdCard title={t('THD กระแส', 'THD CURRENT')} keys={DATATYPES['HD33-IL'].thdKeys} labels={DATATYPES['HD33-IL'].phases} kind="I" />
                        </div>

                        {/* Datatype tabs */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                            {(Object.keys(DATATYPES) as Datatype[]).map((dt) => {
                                const has = availableTypes.has(dt);
                                return (
                                    <button key={dt} id={`harmonic-tab-${dt}`} onClick={() => setDatatype(dt)} style={pill(datatype === dt, !has)} title={has ? dt : t('ไม่มีข้อมูล', 'no data')}>
                                        {t(DATATYPES[dt].th, DATATYPES[dt].en)} <span style={{ opacity: 0.7 }}>· {dt}</span>
                                    </button>
                                );
                            })}
                            <div style={{ flex: 1 }} />
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.sub, cursor: 'pointer' }}>
                                <input id="harmonic-odd-only" type="checkbox" checked={oddOnly} onChange={(e) => setOddOnly(e.target.checked)} />
                                {t('เฉพาะลำดับคี่', 'Odd orders only')}
                            </label>
                        </div>

                        {/* Spectrum + Top table */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2.2fr) minmax(280px, 1fr)', gap: 12, marginBottom: 16 }}>
                            <div style={card}>
                                {cardTitle(<BarChart3 size={14} />, `${t('สเปกตรัมฮาร์มอนิก', 'HARMONIC SPECTRUM')} — ${t(cfg.th, cfg.en)} (% ${t('ของ fundamental', 'of fundamental')})`,
                                    <span style={{ fontSize: 10, color: C.sub, fontFamily: MONO }}>
                                        {spectrum ? `${t('ช่วง 15 นาที', '15-min bucket')} ${fmtTime(spectrum.bucketStart)} · ${spectrum.sampleCount} ${t('ตัวอย่าง', 'samples')}` : ''}
                                    </span>)}
                                {spectrumData.length === 0 ? empty(t('ไม่มีข้อมูลสเปกตรัมสำหรับประเภทนี้', 'No spectrum for this type'), 300) : (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={spectrumData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={1} barCategoryGap="18%">
                                            <CartesianGrid stroke={C.grid} vertical={false} />
                                            <XAxis dataKey="order" tick={{ fill: C.sub, fontSize: 10, fontFamily: MONO }} interval={0} angle={-45} textAnchor="end" height={40} />
                                            <YAxis tick={{ fill: C.sub, fontSize: 10, fontFamily: MONO }} unit="%" />
                                            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: C.accent + '14' }} formatter={(v: any) => `${fmt(v)} %`} />
                                            <Legend wrapperStyle={{ fontFamily: MONO, fontSize: 11 }} />
                                            {limits.individual !== null && (
                                                <ReferenceLine y={limits.individual} stroke={C.red} strokeDasharray="4 4"
                                                    label={{ value: `${t('เกณฑ์', 'limit')} ${limits.individual}%`, fill: C.red, fontSize: 10, position: 'insideTopRight' }} />
                                            )}
                                            {[0, 1, 2].map((p) => (
                                                <Bar key={p} dataKey={`p${p}`} name={cfg.phases[p]} fill={PHASE_COLORS[p]} radius={[2, 2, 0, 0]} isAnimationActive={false} />
                                            ))}
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>

                            <div style={card}>
                                {cardTitle(<Activity size={14} />, t('ลำดับที่สูงสุด', 'TOP ORDERS'))}
                                {topHarmonics.length === 0 ? empty('–', 120) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 12 }}>
                                        <thead>
                                            <tr style={{ color: C.sub, fontSize: 10, textAlign: 'right' }}>
                                                <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 600 }}>{t('ลำดับ', 'ORDER')}</th>
                                                {cfg.phases.map((p, i) => <th key={p} style={{ padding: '4px 0', fontWeight: 600, color: PHASE_COLORS[i] }}>{p}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {topHarmonics.map((row) => (
                                                <tr key={row.h} style={{ borderTop: `1px solid ${C.line}` }}>
                                                    <td style={{ padding: '6px 0', color: C.ink, fontWeight: 700 }}>
                                                        H{row.h} <span style={{ fontSize: 9, color: C.sub, fontWeight: 400 }}>{row.h * 50} Hz</span>
                                                    </td>
                                                    {row.vals.map((v, i) => (
                                                        <td key={i} style={{ padding: '6px 0', textAlign: 'right', color: limits.individual !== null && (v ?? 0) > limits.individual ? C.red : C.ink }}>{fmt(v)}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}

                                {composition && (
                                    <>
                                        <div style={{ fontFamily: MONO, fontSize: 10, color: C.sub, letterSpacing: 1, margin: '16px 0 6px' }}>
                                            {t('องค์ประกอบ (√Σh², H2–H33)', 'COMPOSITION (√Σh², H2–H33)')}
                                        </div>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 12 }}>
                                            <tbody>
                                                {[
                                                    { k: 'total', label: t('รวม (THD คำนวณ)', 'Total (calc. THD)') },
                                                    { k: 'odd', label: t('ลำดับคี่', 'Odd') },
                                                    { k: 'even', label: t('ลำดับคู่', 'Even') },
                                                    { k: 'triplen', label: t('Triplen (3,9,15…)', 'Triplen (3,9,15…)') },
                                                ].map((r) => (
                                                    <tr key={r.k} style={{ borderTop: `1px solid ${C.line}` }}>
                                                        <td style={{ padding: '5px 0', color: C.sub }}>{r.label}</td>
                                                        {composition.map((c, i) => (
                                                            <td key={i} style={{ padding: '5px 0', textAlign: 'right', color: C.ink, fontWeight: r.k === 'total' ? 700 : 400 }}>{fmt((c as any)[r.k])}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Trends */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: MONO, fontSize: 11, color: C.sub, letterSpacing: 1 }}>{t('ช่วงเวลา', 'RANGE')}</span>
                            {HOURS_OPTIONS.map((h) => (
                                <button key={h} id={`harmonic-range-${h}`} onClick={() => setHours(h)} style={pill(hours === h)}>
                                    {h < 24 ? `${h}${t(' ชม.', 'h')}` : `${h / 24}${t(' วัน', 'd')}`}
                                </button>
                            ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 12, marginBottom: 16 }}>
                            <div style={card}>
                                {cardTitle(<Waves size={14} />, `${t('แนวโน้มรายลำดับ', 'ORDER TREND')} — ${cfg.phases[trendPhase]}`,
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        {cfg.phases.map((p, i) => (
                                            <button key={p} onClick={() => setTrendPhase(i)} style={{ ...pill(trendPhase === i), padding: '3px 8px', fontSize: 11 }}>{p}</button>
                                        ))}
                                    </div>)}
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                                    {ORDERS.filter((h) => h <= 25).map((h) => {
                                        const on = trendOrders.includes(h);
                                        return (
                                            <button key={h} onClick={() => setTrendOrders((prev) => on ? prev.filter((x) => x !== h) : [...prev, h].sort((a, b) => a - b).slice(-7))}
                                                style={{ ...pill(on), padding: '2px 6px', fontSize: 10 }}>H{h}</button>
                                        );
                                    })}
                                </div>
                                {trendData.length === 0 ? empty(t('ยังไม่มีข้อมูลย้อนหลัง (เก็บทุก 15 นาที)', 'No history yet (stored every 15 min)')) : (
                                    <ResponsiveContainer width="100%" height={240}>
                                        <LineChart data={trendData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                                            <CartesianGrid stroke={C.grid} vertical={false} />
                                            <XAxis dataKey="t" tickFormatter={(v) => fmtAxisTime(v, hours)} tick={{ fill: C.sub, fontSize: 10, fontFamily: MONO }} minTickGap={24} />
                                            <YAxis tick={{ fill: C.sub, fontSize: 10, fontFamily: MONO }} unit="%" />
                                            <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => fmtTime(v as string)} formatter={(v: any) => `${fmt(v)} %`} />
                                            <Legend wrapperStyle={{ fontFamily: MONO, fontSize: 11 }} />
                                            {trendOrders.map((h, i) => (
                                                <Line key={h} type="monotone" dataKey={`H${h}`} stroke={ORDER_COLORS[i % ORDER_COLORS.length]} strokeWidth={2}
                                                    dot={trendData.length < 3} connectNulls isAnimationActive={false} />
                                            ))}
                                        </LineChart>
                                    </ResponsiveContainer>
                                )}
                            </div>

                            <div style={card}>
                                {cardTitle(<Gauge size={14} />, `${t('แนวโน้ม THD', 'THD TREND')} — ${t(cfg.th, cfg.en)} (${t('เฉลี่ย 15 นาที', '15-min avg')})`)}
                                {thdTrendData.length === 0 ? empty(t('ยังไม่มีข้อมูล THD', 'No THD history yet'), 270) : (
                                    <ResponsiveContainer width="100%" height={270}>
                                        <LineChart data={thdTrendData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                                            <CartesianGrid stroke={C.grid} vertical={false} />
                                            <XAxis dataKey="t" tickFormatter={(v) => fmtAxisTime(v, hours)} tick={{ fill: C.sub, fontSize: 10, fontFamily: MONO }} minTickGap={24} />
                                            <YAxis tick={{ fill: C.sub, fontSize: 10, fontFamily: MONO }} unit="%" />
                                            <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => fmtTime(v as string)} formatter={(v: any) => `${fmt(v)} %`} />
                                            <Legend wrapperStyle={{ fontFamily: MONO, fontSize: 11 }} />
                                            <ReferenceLine y={limits.thdBad} stroke={C.red} strokeDasharray="4 4"
                                                label={{ value: `${limits.thdBad}%`, fill: C.red, fontSize: 10, position: 'insideTopRight' }} />
                                            {[0, 1, 2].map((p) => (
                                                <Line key={p} type="monotone" dataKey={`p${p}`} name={cfg.phases[p]} stroke={PHASE_COLORS[p]} strokeWidth={2}
                                                    dot={thdTrendData.length < 3} connectNulls isAnimationActive={false} />
                                            ))}
                                        </LineChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>

                        {/* Max demand */}
                        <div style={card}>
                            {cardTitle(<Zap size={14} />, t('MAX DEMAND (ค่าสูงสุดสะสมจากมิเตอร์)', 'MAX DEMAND (peak values reported by the meter)'),
                                <span style={{ fontSize: 10, color: C.sub, fontFamily: MONO }}>{latest?.maxDemand ? fmtTime(latest.maxDemand.deviceDatetime) : ''}</span>)}
                            {!latest?.maxDemand ? empty(t('อุปกรณ์นี้ไม่ได้ส่ง PM3-THD-DEMAND', 'This device does not publish PM3-THD-DEMAND'), 80) : (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
                                        {[
                                            { label: 'kW 3Ph', v: latest.maxDemand.kw_3ph, color: C.accent },
                                            { label: 'kVA 3Ph', v: latest.maxDemand.kva_3ph, color: C.yellow },
                                            { label: 'kVar 3Ph', v: latest.maxDemand.kvar_3ph, color: C.sub },
                                            { label: 'I 3Ph (A)', v: latest.maxDemand.il_3ph, color: C.red },
                                            { label: 'V L-N 3Ph', v: latest.maxDemand.vln_3ph, color: C.green },
                                            { label: 'V L-L 3Ph', v: latest.maxDemand.vll_3ph, color: C.green },
                                        ].map((k) => (
                                            <div key={k.label} style={{ background: k.color + '12', border: `1px solid ${k.color}33`, borderRadius: 8, padding: '10px 12px' }}>
                                                <div style={{ fontSize: 10, color: C.sub, fontFamily: MONO, letterSpacing: 1 }}>{k.label}</div>
                                                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: MONO, color: C.ink }}>{fmt(k.v)}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 12 }}>
                                        <thead>
                                            <tr style={{ color: C.sub, fontSize: 10, textAlign: 'right' }}>
                                                <th style={{ textAlign: 'left', padding: '4px 0' }}>{t('เฟส', 'PHASE')}</th>
                                                <th>V L-N</th><th>V L-L</th><th>I (A)</th><th>kW</th><th>kVar</th><th>kVA</th><th>PF</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[0, 1, 2].map((i) => {
                                                const md = latest.maxDemand!;
                                                const n = i + 1;
                                                const ll = ['vl12', 'vl23', 'vl31'][i];
                                                return (
                                                    <tr key={i} style={{ borderTop: `1px solid ${C.line}`, textAlign: 'right', color: C.ink }}>
                                                        <td style={{ textAlign: 'left', padding: '6px 0', color: PHASE_COLORS[i], fontWeight: 700 }}>L{n}</td>
                                                        <td>{fmt(md[`vl${n}`])}</td><td>{fmt(md[ll])}</td><td>{fmt(md[`il${n}`])}</td>
                                                        <td>{fmt(md[`kw${n}`])}</td><td>{fmt(md[`kvar${n}`])}</td><td>{fmt(md[`kva${n}`])}</td><td>{fmt(md[`pf${n}`], 3)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </>
                            )}
                        </div>

                        <div style={{ color: C.sub, fontSize: 10, marginTop: 10, fontStyle: 'italic' }}>
                            {t(
                                '* ค่าฮาร์มอนิกเป็น % ของ fundamental เก็บเป็น snapshot ทุก 15 นาที · เกณฑ์อ้างอิง IEEE 519-2014 (LV): THD แรงดัน 8%, ฮาร์มอนิกแรงดันแต่ละลำดับ 5% · เกณฑ์กระแสขึ้นกับ Isc/IL ใช้เป็นแนวทางเท่านั้น',
                                '* Harmonics are % of fundamental, stored as 15-minute snapshots · Reference IEEE 519-2014 (LV): voltage THD 8 %, individual voltage harmonic 5 % · Current limits depend on Isc/IL and are indicative only',
                            )}
                        </div>
                    </>
                )}
            </div>

            <style>{`
                @keyframes hd-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes hd-pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
            `}</style>
        </div>
    );
};

export default HarmonicDashboard;
