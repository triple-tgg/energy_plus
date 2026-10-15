import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Code2, EyeOff, Eye, Link2, Link2Off,
    Radio, RefreshCw, Search, Sparkles, X,
} from 'lucide-react';
import { redisDiscoveryApi } from '../../api/client';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';

/* ─────────────────────────── theme ─────────────────────────── */

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, "Cascadia Mono", monospace';
const THEMES = {
    light: {
        bg: '#EAE7DA', panel: '#FBFAF4', panel2: '#F1EFE3', ink: '#23261E', sub: '#6E705F',
        line: '#D4D1C0', bar: '#F1EFE3', barSub: '#8A8C7A', accent: '#2B4C7E',
        green: '#16a34a', yellow: '#C08A1E', red: '#dc2626', violet: '#7c3aed', cardBg: '#FFFFFF', rowHover: '#F6F4EA',
    },
    dark: {
        bg: '#0E1116', panel: '#161B22', panel2: '#1C232E', ink: '#E6EDF3', sub: '#8B98A6',
        line: '#2A313C', bar: '#080A0E', barSub: '#8B98A6', accent: '#36C2CE',
        green: '#34d399', yellow: '#D29922', red: '#f85149', violet: '#a78bfa', cardBg: '#1C232E', rowHover: '#202836',
    },
};

/* ─────────────────────────── types ─────────────────────────── */

interface MeterRef {
    meterId: number; meterCode: string | null; meterName: string | null; siteId: number | null; siteName: string | null;
    siteEl: string | null; address: string | null; isActive: boolean; siteActive: boolean; ingesting: boolean;
    score?: number; reason?: string; currentChannel?: string | null;
}
interface ChannelRow {
    channel: string; datatype: string; device: string | null; code: string | null; handlerSupported: boolean;
    firstSeen: string; lastSeen: string; msgCount: number; ratePerMin: number | null; online: boolean;
}
interface Group {
    baseChannel: string; siteId: number; addressId: number; channels: ChannelRow[]; firstSeen: string; lastSeen: string;
    online: boolean; ignored: boolean; ratePerMin: number; msgCount: number; devices: string[];
    status: 'linked' | 'new' | 'ignored'; isNew: boolean; unsupportedDatatypes: string[];
    linkedMeters: MeterRef[]; suggestions: MeterRef[];
}
interface Summary { total: number; linked: number; unlinked: number; ignored: number; offline: number; newToday: number; unsupported: number; channels: number }
interface Runtime { enabled: boolean; redisEnabled: boolean; running: boolean; startedAt: string | null; lastFlushAt: string | null; lastFlushError: string | null; flushIntervalMs: number }
interface DiscoveryData { runtime: Runtime; staleMinutes: number; supportedDatatypes: string[]; summary: Summary; groups: Group[] }

type Filter = 'all' | 'new' | 'linked' | 'offline' | 'newToday' | 'unsupported' | 'ignored';

/* ─────────────────────────── helpers ─────────────────────────── */

const unwrap = (res: any) => res?.data?.data ?? res?.data;
const errMsg = (err: any, fallback: string) => err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || fallback;
const fmtDateTime = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '–';
const REFRESH_MS = 30_000;

const RedisChannelsPage: React.FC = () => {
    const { theme } = useTheme();
    const { t } = useLanguage();
    const { user } = useAuth() as any;
    const C = THEMES[theme];
    const isAdmin = user?.role === 'admin';

    const [data, setData] = useState<DiscoveryData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
    const [filter, setFilter] = useState<Filter>('all');
    const [search, setSearch] = useState('');
    const [siteFilter, setSiteFilter] = useState<string>('');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [samples, setSamples] = useState<Record<string, any>>({});
    const [linkTarget, setLinkTarget] = useState<Group | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [now, setNow] = useState(Date.now());

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setData(unwrap(await redisDiscoveryApi.list()));
            setError('');
        } catch (err: any) {
            setError(errMsg(err, t('โหลดรายการ channel ไม่สำเร็จ', 'Failed to load channels')));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        load();
        const id = setInterval(load, REFRESH_MS);
        const tick = setInterval(() => setNow(Date.now()), 10_000);
        return () => { clearInterval(id); clearInterval(tick); };
    }, [load]);

    useEffect(() => {
        if (!toast) return;
        const id = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(id);
    }, [toast]);

    const ago = useCallback((iso?: string | null) => {
        if (!iso) return '–';
        const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
        if (s < 60) return t(`${s} วิ.ที่แล้ว`, `${s}s ago`);
        if (s < 3600) return t(`${Math.round(s / 60)} นาทีที่แล้ว`, `${Math.round(s / 60)}m ago`);
        if (s < 86400) return t(`${Math.round(s / 3600)} ชม.ที่แล้ว`, `${Math.round(s / 3600)}h ago`);
        return t(`${Math.round(s / 86400)} วันที่แล้ว`, `${Math.round(s / 86400)}d ago`);
    }, [now, t]);

    const groups = data?.groups || [];
    const siteIds = useMemo(() => [...new Set(groups.map((g) => g.siteId))].sort((a, b) => a - b), [groups]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return groups.filter((g) => {
            if (siteFilter && String(g.siteId) !== siteFilter) return false;
            switch (filter) {
                case 'all': if (g.status === 'ignored') return false; break;
                case 'new': if (g.status !== 'new') return false; break;
                case 'linked': if (g.status !== 'linked') return false; break;
                case 'offline': if (g.online || g.status === 'ignored') return false; break;
                case 'newToday': if (!(g.isNew && g.status === 'new')) return false; break;
                case 'unsupported': if (!g.unsupportedDatatypes.length || g.status === 'ignored') return false; break;
                case 'ignored': if (g.status !== 'ignored') return false; break;
            }
            if (!q) return true;
            const hay = [
                g.baseChannel, ...g.channels.map((c) => c.datatype), ...g.devices,
                ...g.linkedMeters.flatMap((m) => [m.meterCode, m.meterName, m.siteName]),
            ].filter(Boolean).join(' ').toLowerCase();
            return hay.includes(q);
        });
    }, [groups, filter, search, siteFilter]);

    const toggleExpand = (base: string) => setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(base)) next.delete(base); else next.add(base);
        return next;
    });

    const loadSample = async (channel: string) => {
        if (samples[channel]) { setSamples((s) => { const n = { ...s }; delete n[channel]; return n; }); return; }
        try {
            const row = unwrap(await redisDiscoveryApi.sample(channel));
            setSamples((s) => ({ ...s, [channel]: row }));
        } catch (err: any) {
            setToast({ kind: 'err', text: errMsg(err, 'Failed to load sample') });
        }
    };

    const doUnlink = async (g: Group, m: MeterRef) => {
        if (!window.confirm(t(
            `ยกเลิกการผูก ${g.baseChannel} กับมิเตอร์ ${m.meterCode || m.meterId}?\nระบบจะหยุดบันทึกข้อมูลของ channel นี้ (meter.site_el จะถูกล้าง)`,
            `Unlink ${g.baseChannel} from meter ${m.meterCode || m.meterId}?\nIngest for this channel stops (meter.site_el is cleared).`,
        ))) return;
        setBusy(g.baseChannel);
        try {
            await redisDiscoveryApi.unlink(m.meterId);
            setToast({ kind: 'ok', text: t(`ยกเลิกการผูก ${g.baseChannel} แล้ว`, `${g.baseChannel} unlinked`) });
            await load();
        } catch (err: any) {
            setToast({ kind: 'err', text: errMsg(err, 'Unlink failed') });
        } finally {
            setBusy(null);
        }
    };

    const doIgnore = async (g: Group, ignored: boolean) => {
        setBusy(g.baseChannel);
        try {
            await redisDiscoveryApi.ignore(g.baseChannel, ignored);
            setToast({ kind: 'ok', text: ignored ? t(`ซ่อน ${g.baseChannel} แล้ว`, `${g.baseChannel} hidden`) : t(`แสดง ${g.baseChannel} แล้ว`, `${g.baseChannel} restored`) });
            await load();
        } catch (err: any) {
            setToast({ kind: 'err', text: errMsg(err, 'Update failed') });
        } finally {
            setBusy(null);
        }
    };

    /* ─────────────── style helpers ─────────────── */

    const card: React.CSSProperties = { background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10 };
    const chip = (color: string, solid = false): React.CSSProperties => ({
        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 5, fontSize: 11, fontFamily: MONO,
        border: `1px solid ${color}`, color: solid ? '#fff' : color, background: solid ? color : color + '14', whiteSpace: 'nowrap',
    });
    const btn = (color: string, filled = false, disabled = false): React.CSSProperties => ({
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, fontSize: 12, fontFamily: MONO,
        border: `1px solid ${color}`, background: filled ? color : 'transparent', color: filled ? '#fff' : color,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap',
    });
    const dot = (on: boolean): React.CSSProperties => ({
        width: 8, height: 8, borderRadius: '50%', background: on ? C.green : C.red, flexShrink: 0,
        boxShadow: on ? `0 0 0 3px ${C.green}26` : 'none', animation: on ? 'rc-pulse 2s infinite' : 'none',
    });
    const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 10, fontFamily: MONO, letterSpacing: 1, color: C.sub, fontWeight: 600, borderBottom: `1px solid ${C.line}`, whiteSpace: 'nowrap' };
    const td: React.CSSProperties = { padding: '10px 12px', fontSize: 12, color: C.ink, borderBottom: `1px solid ${C.line}`, verticalAlign: 'top' };

    const runtime = data?.runtime;
    const summary = data?.summary;
    const runtimeState = !runtime ? null
        : runtime.running ? { color: C.green, text: t('กำลังค้นหา channel', 'DISCOVERY RUNNING') }
            : !runtime.enabled ? { color: C.yellow, text: t('ปิดใช้งาน (REDIS_CHANNEL_DISCOVERY=false)', 'DISABLED (REDIS_CHANNEL_DISCOVERY=false)') }
                : !runtime.redisEnabled ? { color: C.yellow, text: t('Redis ปิดอยู่ (REDIS_ENABLED=false)', 'REDIS DISABLED (REDIS_ENABLED=false)') }
                    : { color: C.red, text: t('ไม่ได้เชื่อมต่อ Redis', 'NOT CONNECTED') };

    const summaryCards: Array<{ key: Filter; label: string; value: number | undefined; color: string }> = [
        { key: 'all', label: t('ทั้งหมด', 'ALL'), value: summary ? summary.total - summary.ignored : undefined, color: C.accent },
        { key: 'new', label: t('ยังไม่ผูกมิเตอร์', 'UNLINKED'), value: summary?.unlinked, color: C.yellow },
        { key: 'linked', label: t('ผูกแล้ว (บันทึกข้อมูล)', 'LINKED (INGESTING)'), value: summary?.linked, color: C.green },
        { key: 'offline', label: t(`ไม่มีข้อมูล > ${data?.staleMinutes ?? 15} นาที`, `OFFLINE > ${data?.staleMinutes ?? 15} MIN`), value: summary?.offline, color: C.red },
        { key: 'newToday', label: t('พบใหม่ 24 ชม.', 'NEW (24H)'), value: summary?.newToday, color: C.violet },
        { key: 'unsupported', label: t('datatype ไม่รองรับ', 'UNSUPPORTED TYPE'), value: summary?.unsupported, color: C.red },
        { key: 'ignored', label: t('ซ่อนไว้', 'HIDDEN'), value: summary?.ignored, color: C.sub },
    ];

    /* ─────────────── render ─────────────── */

    return (
        <div>
            <style>{`
                @keyframes rc-pulse { 0%,100% { opacity: 1 } 50% { opacity: .45 } }
                @keyframes rc-spin { to { transform: rotate(360deg) } }
                @keyframes rc-in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
                .rc-row:hover > td { background: ${C.rowHover}; }
                .rc-card { transition: transform .15s ease, box-shadow .15s ease; }
                .rc-card:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,.08); }
            `}</style>

            {/* Command bar */}
            <div style={{ background: C.bar, color: C.ink, display: 'flex', alignItems: 'stretch', borderBottom: `2px solid ${C.accent}`, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}><Radio size={16} /></div>
                    <div>
                        <h1 style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2, margin: 0 }}>{t('ตั้งค่า // REDIS CHANNELS', 'SETTINGS // REDIS CHANNELS')}</h1>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>
                            {t('ค้นหา channel ใหม่อัตโนมัติ — ข้อมูลจะถูกบันทึกเมื่อผูก channel กับมิเตอร์แล้วเท่านั้น', 'Auto-discovered channels — data is stored only after a channel is linked to a meter')}
                        </div>
                    </div>
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 16px', flexWrap: 'wrap' }}>
                    {runtimeState && (
                        <span id="discovery-runtime-status" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: MONO, color: runtimeState.color }}>
                            <span style={{ ...dot(!!runtime?.running), background: runtimeState.color }} />
                            {runtimeState.text}
                        </span>
                    )}
                    {runtime?.lastFlushAt && (
                        <span style={{ fontSize: 10, fontFamily: MONO, color: C.sub }}>{t('อัปเดตล่าสุด', 'last flush')} {ago(runtime.lastFlushAt)}</span>
                    )}
                    <button id="discovery-refresh" onClick={load} disabled={loading} style={{ background: 'transparent', border: 'none', color: C.accent, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: MONO }}>
                        <RefreshCw size={14} style={{ animation: loading ? 'rc-spin 1s linear infinite' : 'none' }} /> {t('รีเฟรช', 'Refresh')}
                    </button>
                </div>
            </div>

            <div style={{ padding: '0 16px 24px' }}>
                {error && (
                    <div style={{ background: C.red + '18', color: C.red, padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AlertTriangle size={16} /> {error}
                    </div>
                )}
                {runtime && !runtime.running && (
                    <div style={{ background: C.yellow + '18', color: C.ink, border: `1px solid ${C.yellow}55`, padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AlertTriangle size={16} color={C.yellow} />
                        {t(
                            'Server นี้ไม่ได้ฟัง Redis อยู่ — รายการด้านล่างคือข้อมูลที่บันทึกไว้ล่าสุด และการผูกมิเตอร์จะเริ่มบันทึกข้อมูลเมื่อ server ที่เปิด Redis ซิงก์ (ทุก 30 วินาที)',
                            'This server is not listening to Redis — the list shows last recorded data; linking takes effect when a Redis-enabled server syncs (every 30 s)',
                        )}
                    </div>
                )}
                {runtime?.lastFlushError && (
                    <div style={{ background: C.red + '18', color: C.red, padding: '8px 14px', borderRadius: 8, marginBottom: 16, fontSize: 12 }}>
                        {t('บันทึกสถิติ discovery ไม่สำเร็จ', 'Discovery flush failed')}: {runtime.lastFlushError}
                    </div>
                )}

                {/* Summary cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
                    {summaryCards.map((c) => {
                        const active = filter === c.key;
                        return (
                            <button key={c.key} id={`discovery-filter-${c.key}`} className="rc-card" onClick={() => setFilter(c.key)} style={{
                                ...card, textAlign: 'left', padding: '12px 14px', cursor: 'pointer',
                                borderColor: active ? c.color : C.line, boxShadow: active ? `inset 0 0 0 1px ${c.color}` : 'none',
                                background: active ? c.color + '10' : C.cardBg,
                            }}>
                                <div style={{ fontSize: 10, fontFamily: MONO, letterSpacing: 1, color: C.sub }}>{c.label}</div>
                                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: MONO, color: c.value ? c.color : C.sub, marginTop: 4 }}>{c.value ?? '–'}</div>
                            </button>
                        );
                    })}
                </div>

                {/* Filter bar */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 380 }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: C.sub }} />
                        <input id="discovery-search" value={search} onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('ค้นหา channel, datatype, device, มิเตอร์…', 'Search channel, datatype, device, meter…')}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px 7px 30px', borderRadius: 6, border: `1px solid ${C.line}`, background: C.panel, color: C.ink, fontSize: 12 }} />
                    </div>
                    <select id="discovery-site-filter" value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}
                        style={{ padding: '7px 10px', borderRadius: 6, border: `1px solid ${C.line}`, background: C.panel, color: C.ink, fontSize: 12, fontFamily: MONO }}>
                        <option value="">{t('ทุก Site ID', 'All site IDs')}</option>
                        {siteIds.map((s) => <option key={s} value={s}>siteID {s}</option>)}
                    </select>
                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: 11, color: C.sub, fontFamily: MONO }}>
                        {visible.length} / {groups.length} {t('อุปกรณ์', 'devices')} · {summary?.channels ?? 0} channels
                    </span>
                </div>

                {/* Table */}
                <div style={{ ...card, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
                        <thead>
                            <tr>
                                <th style={{ ...th, width: 28 }} />
                                <th style={th}>CHANNEL</th>
                                <th style={th}>DATATYPES</th>
                                <th style={th}>{t('อุปกรณ์', 'DEVICE')}</th>
                                <th style={th}>{t('สถานะ', 'SIGNAL')}</th>
                                <th style={{ ...th, textAlign: 'right' }}>MSG/MIN</th>
                                <th style={th}>{t('มิเตอร์', 'METER')}</th>
                                <th style={{ ...th, textAlign: 'right' }}>{t('จัดการ', 'ACTIONS')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visible.length === 0 && (
                                <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: C.sub, padding: 40 }}>
                                    {loading && !data ? t('กำลังโหลด…', 'Loading…') : t('ไม่พบ channel ตามเงื่อนไข', 'No channels match the filter')}
                                </td></tr>
                            )}
                            {visible.map((g) => {
                                const isOpen = expanded.has(g.baseChannel);
                                const top = g.suggestions[0];
                                return (
                                    <React.Fragment key={g.baseChannel}>
                                        <tr className="rc-row" style={{ animation: 'rc-in .2s ease', opacity: g.status === 'ignored' ? 0.6 : 1 }}>
                                            <td style={{ ...td, cursor: 'pointer', color: C.sub }} onClick={() => toggleExpand(g.baseChannel)}>
                                                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            </td>
                                            <td style={td}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13 }}>{g.baseChannel}</span>
                                                    {g.isNew && g.status === 'new' && <span style={chip(C.violet, true)}><Sparkles size={10} /> NEW</span>}
                                                </div>
                                                <div style={{ fontSize: 10, color: C.sub, fontFamily: MONO, marginTop: 2 }}>
                                                    siteID {g.siteId} · addr {g.addressId} · {t('พบครั้งแรก', 'first')} {fmtDateTime(g.firstSeen)}
                                                </div>
                                            </td>
                                            <td style={td}>
                                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                    {g.channels.map((c) => (
                                                        <span key={c.channel} title={c.handlerSupported ? c.channel : t('ยังไม่มี handler — จะไม่ถูกบันทึก', 'No handler — not stored')}
                                                            style={chip(c.handlerSupported ? C.accent : C.red)}>
                                                            {!c.handlerSupported && <AlertTriangle size={10} />}{c.datatype}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td style={{ ...td, fontFamily: MONO, fontSize: 11 }}>{g.devices.join(', ') || '–'}</td>
                                            <td style={td}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                                                    <span style={dot(g.online)} />
                                                    <span style={{ fontSize: 11, color: g.online ? C.ink : C.red }}>{ago(g.lastSeen)}</span>
                                                </div>
                                            </td>
                                            <td style={{ ...td, textAlign: 'right', fontFamily: MONO }}>{g.ratePerMin ? g.ratePerMin.toFixed(1) : '–'}</td>
                                            <td style={td}>
                                                {g.linkedMeters.length > 0 ? g.linkedMeters.map((m) => (
                                                    <div key={m.meterId} style={{ marginBottom: 2 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <CheckCircle2 size={13} color={m.ingesting ? C.green : C.yellow} />
                                                            <span style={{ fontFamily: MONO, fontWeight: 600 }}>{m.meterCode || `#${m.meterId}`}</span>
                                                            <span style={{ color: C.sub }}>{m.meterName}</span>
                                                        </div>
                                                        <div style={{ fontSize: 10, color: m.ingesting ? C.sub : C.yellow, marginLeft: 19 }}>
                                                            {m.siteName || '–'}
                                                            {!m.isActive && ` · ${t('มิเตอร์ปิดใช้งาน', 'meter inactive')}`}
                                                            {m.isActive && !m.siteActive && ` · ${t('site ปิดใช้งาน', 'site inactive')}`}
                                                            {m.isActive && m.siteActive && !m.ingesting && ` · ${t('ยังไม่บันทึก (Redis ปิด)', 'not ingesting (Redis off)')}`}
                                                        </div>
                                                    </div>
                                                )) : top ? (
                                                    <div style={{ fontSize: 11, color: C.sub }}>
                                                        <span style={chip(top.score && top.score > 1 ? C.green : C.sub)}><Sparkles size={10} />{t('แนะนำ', 'suggested')}</span>{' '}
                                                        <span style={{ fontFamily: MONO, color: C.ink }}>{top.meterCode}</span> {top.siteName ? `· ${top.siteName}` : ''}
                                                    </div>
                                                ) : <span style={{ color: C.sub, fontSize: 11 }}>{t('ยังไม่ผูก', 'not linked')}</span>}
                                            </td>
                                            <td style={{ ...td, textAlign: 'right' }}>
                                                <div style={{ display: 'inline-flex', gap: 6 }}>
                                                    {g.linkedMeters.length === 0 ? (
                                                        <button id={`discovery-link-${g.baseChannel}`} disabled={!isAdmin || busy === g.baseChannel} onClick={() => setLinkTarget(g)} style={btn(C.accent, true, !isAdmin)}>
                                                            <Link2 size={13} /> {t('ผูกมิเตอร์', 'Link')}
                                                        </button>
                                                    ) : (
                                                        <button id={`discovery-unlink-${g.baseChannel}`} disabled={!isAdmin || busy === g.baseChannel} onClick={() => doUnlink(g, g.linkedMeters[0])} style={btn(C.red, false, !isAdmin)}>
                                                            <Link2Off size={13} /> {t('ยกเลิก', 'Unlink')}
                                                        </button>
                                                    )}
                                                    {g.linkedMeters.length === 0 && (
                                                        <button id={`discovery-ignore-${g.baseChannel}`} title={g.status === 'ignored' ? t('แสดง', 'Show') : t('ซ่อน', 'Hide')}
                                                            disabled={!isAdmin || busy === g.baseChannel} onClick={() => doIgnore(g, g.status !== 'ignored')} style={btn(C.sub, false, !isAdmin)}>
                                                            {g.status === 'ignored' ? <Eye size={13} /> : <EyeOff size={13} />}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        {isOpen && (
                                            <tr>
                                                <td style={{ ...td, background: C.panel2 }} />
                                                <td colSpan={7} style={{ ...td, background: C.panel2, padding: '10px 12px 14px' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                        <thead>
                                                            <tr>
                                                                {['CHANNEL', 'DATATYPE', 'DEVICE / CODE', t('พบครั้งแรก', 'FIRST SEEN'), t('ล่าสุด', 'LAST SEEN'), 'MSG/MIN', t('ข้อความสะสม', 'TOTAL MSG'), 'HANDLER', ''].map((h) => (
                                                                    <th key={h} style={{ ...th, padding: '6px 8px', borderBottom: `1px solid ${C.line}` }}>{h}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {g.channels.map((c) => (
                                                                <React.Fragment key={c.channel}>
                                                                    <tr>
                                                                        <td style={{ ...td, padding: '6px 8px', fontFamily: MONO, borderBottom: 'none' }}>
                                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={dot(c.online)} />{c.channel}</span>
                                                                        </td>
                                                                        <td style={{ ...td, padding: '6px 8px', fontFamily: MONO, borderBottom: 'none' }}>{c.datatype}</td>
                                                                        <td style={{ ...td, padding: '6px 8px', fontFamily: MONO, fontSize: 11, borderBottom: 'none' }}>{c.device || '–'} {c.code ? `· ${c.code}` : ''}</td>
                                                                        <td style={{ ...td, padding: '6px 8px', fontSize: 11, borderBottom: 'none' }}>{fmtDateTime(c.firstSeen)}</td>
                                                                        <td style={{ ...td, padding: '6px 8px', fontSize: 11, borderBottom: 'none' }}>{fmtDateTime(c.lastSeen)}</td>
                                                                        <td style={{ ...td, padding: '6px 8px', fontFamily: MONO, borderBottom: 'none' }}>{c.ratePerMin ?? '–'}</td>
                                                                        <td style={{ ...td, padding: '6px 8px', fontFamily: MONO, borderBottom: 'none' }}>{c.msgCount.toLocaleString()}</td>
                                                                        <td style={{ ...td, padding: '6px 8px', borderBottom: 'none' }}>
                                                                            {c.handlerSupported
                                                                                ? <span style={chip(C.green)}>{t('รองรับ', 'supported')}</span>
                                                                                : <span style={chip(C.red)}>{t('ไม่รองรับ', 'unsupported')}</span>}
                                                                        </td>
                                                                        <td style={{ ...td, padding: '6px 8px', borderBottom: 'none', textAlign: 'right' }}>
                                                                            <button id={`discovery-sample-${c.channel}`} onClick={() => loadSample(c.channel)} style={btn(C.accent)}>
                                                                                <Code2 size={12} /> {samples[c.channel] ? t('ซ่อน', 'Hide') : 'JSON'}
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                    {samples[c.channel] && (
                                                                        <tr><td colSpan={9} style={{ padding: '0 8px 8px' }}>
                                                                            <div style={{ fontSize: 10, color: C.sub, fontFamily: MONO, margin: '2px 0 4px' }}>
                                                                                {t('ข้อความล่าสุด', 'latest message')} · {fmtDateTime(samples[c.channel].sample_at)}
                                                                            </div>
                                                                            <pre style={{ margin: 0, maxHeight: 260, overflow: 'auto', background: C.bar, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 6, padding: 10, fontSize: 11, fontFamily: MONO }}>
                                                                                {JSON.stringify(samples[c.channel].sample_json, null, 2)}
                                                                            </pre>
                                                                        </td></tr>
                                                                    )}
                                                                </React.Fragment>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div style={{ fontSize: 11, color: C.sub, marginTop: 10, fontStyle: 'italic' }}>
                    * {t(
                        `การผูกจะตั้ง meter.site_el = channel (เช่น 1005_1) และอัปเดต realtime_meter_map แล้วระบบจะ subscribe {channel}_* ทันที · datatype ที่รองรับ: ${(data?.supportedDatatypes || []).join(', ')}`,
                        `Linking sets meter.site_el = channel (e.g. 1005_1), updates realtime_meter_map and subscribes {channel}_* immediately · supported datatypes: ${(data?.supportedDatatypes || []).join(', ')}`,
                    )}
                </div>
            </div>

            {linkTarget && (
                <LinkDialog
                    group={linkTarget}
                    C={C}
                    t={t}
                    onClose={() => setLinkTarget(null)}
                    onLinked={async (msg) => {
                        setLinkTarget(null);
                        setToast({ kind: 'ok', text: msg });
                        await load();
                    }}
                />
            )}

            {toast && (
                <div id="discovery-toast" style={{
                    position: 'fixed', right: 24, bottom: 24, zIndex: 1100, padding: '10px 16px', borderRadius: 8, fontSize: 13,
                    background: toast.kind === 'ok' ? C.green : C.red, color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,.2)', animation: 'rc-in .2s ease',
                    display: 'flex', alignItems: 'center', gap: 8, maxWidth: 480,
                }}>
                    {toast.kind === 'ok' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />} {toast.text}
                </div>
            )}
        </div>
    );
};

/* ─────────────────────────── link dialog ─────────────────────────── */

const LinkDialog: React.FC<{
    group: Group;
    C: typeof THEMES.light;
    t: (th: string, en: string) => string;
    onClose: () => void;
    onLinked: (message: string) => void;
}> = ({ group, C, t, onClose, onLinked }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<MeterRef[]>([]);
    const [searching, setSearching] = useState(false);
    const [selected, setSelected] = useState<MeterRef | null>(
        group.suggestions[0] && (group.suggestions[0].score ?? 0) > 1 ? group.suggestions[0] : null,
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!query.trim()) { setResults([]); return; }
        const id = setTimeout(async () => {
            setSearching(true);
            try {
                setResults(unwrap(await redisDiscoveryApi.searchMeters(query)) || []);
            } catch (err: any) {
                setError(errMsg(err, 'Search failed'));
            } finally {
                setSearching(false);
            }
        }, 300);
        return () => clearTimeout(id);
    }, [query]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const list = query.trim() ? results : group.suggestions;
    // Only a meter that is currently visible can be linked (avoid confirming a hidden earlier choice)
    const chosen = selected && list.some((m) => m.meterId === selected.meterId) ? selected : null;

    const submit = async () => {
        if (!chosen) return;
        setSaving(true);
        setError('');
        try {
            await redisDiscoveryApi.link(group.baseChannel, chosen.meterId);
            onLinked(t(`ผูก ${group.baseChannel} กับมิเตอร์ ${chosen.meterCode || chosen.meterId} แล้ว`, `${group.baseChannel} linked to meter ${chosen.meterCode || chosen.meterId}`));
        } catch (err: any) {
            setError(errMsg(err, t('ผูกมิเตอร์ไม่สำเร็จ', 'Link failed')));
        } finally {
            setSaving(false);
        }
    };

    const row = (m: MeterRef, suggested: boolean) => {
        const active = chosen?.meterId === m.meterId;
        const willReplace = m.currentChannel && m.currentChannel !== group.baseChannel;
        return (
            <button key={m.meterId} id={`link-meter-${m.meterId}`} onClick={() => setSelected(m)} style={{
                display: 'flex', width: '100%', textAlign: 'left', gap: 10, alignItems: 'center', padding: '9px 12px', marginBottom: 6,
                borderRadius: 8, border: `1px solid ${active ? C.accent : C.line}`, background: active ? C.accent + '14' : C.panel, color: C.ink, cursor: 'pointer',
            }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${active ? C.accent : C.line}`, background: active ? C.accent : 'transparent', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13 }}>{m.meterCode || `#${m.meterId}`}</span>
                        <span style={{ fontSize: 12, color: C.sub }}>{m.meterName}</span>
                        {suggested && (
                            <span style={{ fontSize: 10, fontFamily: MONO, padding: '1px 6px', borderRadius: 4, color: '#fff', background: m.score && m.score > 1 ? C.green : C.sub }}>
                                {m.reason === 'same-address-same-site' ? t('แนะนำ: address + site ตรง', 'suggested: address + site') : t('แนะนำ: address ตรง', 'suggested: same address')}
                            </span>
                        )}
                        {!m.isActive && <span style={{ fontSize: 10, color: C.yellow }}>{t('ปิดใช้งาน', 'inactive')}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: C.sub, fontFamily: MONO, marginTop: 2 }}>
                        {m.siteName || '–'} · site_el {m.siteEl ?? '–'} · addr {m.address ?? '–'}
                        {willReplace && <span style={{ color: C.yellow }}> · {t(`จะเปลี่ยนจาก ${m.currentChannel}`, `replaces ${m.currentChannel}`)}</span>}
                    </div>
                </div>
            </button>
        );
    };

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(2px)', display: 'grid', placeItems: 'center', padding: 16 }}>
            <div id="link-dialog" onClick={(e) => e.stopPropagation()} style={{
                width: 'min(620px, 100%)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: C.cardBg, color: C.ink,
                borderRadius: 12, border: `1px solid ${C.line}`, boxShadow: '0 20px 60px rgba(0,0,0,.3)', animation: 'rc-in .2s ease',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid ${C.line}` }}>
                    <Link2 size={18} color={C.accent} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 14 }}>{t('ผูก channel กับมิเตอร์', 'Link channel to meter')}</div>
                        <div style={{ fontSize: 11, color: C.sub, fontFamily: MONO }}>
                            {group.baseChannel} · {group.channels.map((c) => c.datatype).join(', ')} · {group.devices.join(', ') || '–'}
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.sub, cursor: 'pointer' }}><X size={18} /></button>
                </div>

                <div style={{ padding: '14px 18px 0' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: C.sub }} />
                        <input id="link-meter-search" autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
                            placeholder={t('ค้นหามิเตอร์: รหัส, ชื่อ, site…', 'Search meter: code, name, site…')}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px 8px 30px', borderRadius: 6, border: `1px solid ${C.line}`, background: C.panel, color: C.ink, fontSize: 13 }} />
                    </div>
                    <div style={{ fontSize: 10, fontFamily: MONO, letterSpacing: 1, color: C.sub, margin: '12px 0 6px' }}>
                        {query.trim() ? (searching ? t('กำลังค้นหา…', 'SEARCHING…') : t(`ผลการค้นหา (${results.length})`, `RESULTS (${results.length})`)) : t('มิเตอร์ที่แนะนำ', 'SUGGESTED METERS')}
                    </div>
                </div>

                <div style={{ padding: '0 18px', overflowY: 'auto', flex: 1, minHeight: 120 }}>
                    {list.length === 0 && !searching && (
                        <div style={{ color: C.sub, fontSize: 12, padding: '18px 0', textAlign: 'center' }}>
                            {query.trim() ? t('ไม่พบมิเตอร์', 'No meters found') : t('ไม่มีมิเตอร์ที่แนะนำ — พิมพ์เพื่อค้นหา', 'No suggestions — type to search')}
                        </div>
                    )}
                    {list.map((m) => row(m, !query.trim() || group.suggestions.some((s) => s.meterId === m.meterId)))}
                </div>

                {error && <div style={{ margin: '8px 18px 0', color: C.red, fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}><AlertTriangle size={14} /> {error}</div>}

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderTop: `1px solid ${C.line}`, marginTop: 10 }}>
                    <div style={{ flex: 1, fontSize: 11, color: C.sub }}>
                        {chosen
                            ? t(`meter.site_el ของ ${chosen.meterCode || chosen.meterId} จะถูกตั้งเป็น ${group.baseChannel}`, `meter.site_el of ${chosen.meterCode || chosen.meterId} will be set to ${group.baseChannel}`)
                            : t('เลือกมิเตอร์ 1 ตัว', 'Select a meter')}
                    </div>
                    <button onClick={onClose} style={{ padding: '7px 14px', borderRadius: 6, border: `1px solid ${C.line}`, background: 'transparent', color: C.ink, cursor: 'pointer', fontSize: 12 }}>
                        {t('ยกเลิก', 'Cancel')}
                    </button>
                    <button id="link-confirm" disabled={!chosen || saving} onClick={submit} style={{
                        padding: '7px 16px', borderRadius: 6, border: 'none', background: C.accent, color: '#fff', fontSize: 12, fontWeight: 600,
                        cursor: !chosen || saving ? 'not-allowed' : 'pointer', opacity: !chosen || saving ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                        <Link2 size={13} /> {saving ? t('กำลังบันทึก…', 'Saving…') : t('ยืนยันการผูก', 'Confirm link')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RedisChannelsPage;
