import React, { useEffect, useState, useCallback } from 'react';
import { dataCleanupApi } from '../../api/client';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Database, Trash2, Clock, HardDrive, AlertTriangle, CheckCircle, RefreshCw, LayoutGrid } from 'lucide-react';

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, "Cascadia Mono", monospace';
const THEMES = {
    light: {
        bg: '#EAE7DA', panel: '#FBFAF4', panel2: '#F1EFE3', ink: '#23261E', sub: '#6E705F',
        line: '#D4D1C0', bar: '#F1EFE3', barSub: '#8A8C7A', accent: '#2B4C7E',
        green: '#16a34a', yellow: '#C08A1E', red: '#dc2626', cardBg: '#FFFFFF',
    },
    dark: {
        bg: '#0E1116', panel: '#161B22', panel2: '#1C232E', ink: '#E6EDF3', sub: '#8B98A6',
        line: '#2A313C', bar: '#080A0E', barSub: '#8B98A6', accent: '#36C2CE',
        green: '#34d399', yellow: '#D29922', red: '#f85149', cardBg: '#1C232E',
    },
};

const RETENTION_OPTIONS = [
    { hours: 1, labelEn: '1 Hour', labelTh: '1 ชั่วโมง' },
    { hours: 6, labelEn: '6 Hours', labelTh: '6 ชั่วโมง' },
    { hours: 12, labelEn: '12 Hours', labelTh: '12 ชั่วโมง' },
    { hours: 24, labelEn: '24 Hours (1 Day)', labelTh: '24 ชั่วโมง (1 วัน)' },
    { hours: 48, labelEn: '48 Hours (2 Days)', labelTh: '48 ชั่วโมง (2 วัน)' },
    { hours: 168, labelEn: '7 Days', labelTh: '7 วัน' },
    { hours: 720, labelEn: '30 Days', labelTh: '30 วัน' },
];

interface RealtimeStats {
    total_rows: number;
    oldest_record: string | null;
    newest_record: string | null;
    table_size: string;
    rows_older_than_24h: number;
    rows_older_than_7d: number;
    rows_older_than_30d: number;
    historical?: {
        actual_total_rows: number;
        actual_oldest_record: string | null;
        actual_newest_record: string | null;
        actual_table_size: string;
        actual_within_3m: number;
        actual_older_than_3m: number;
        kwh_rows: number;
        ele_rows: number;
        mdb_tou_rows: number;
        water_rows: number;
    };
}

const DataCleanupPage: React.FC = () => {
    const { theme } = useTheme();
    const { t } = useLanguage();
    const C = THEMES[theme];

    const [stats, setStats] = useState<RealtimeStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [retentionHours, setRetentionHours] = useState(24);
    const [purging, setPurging] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [result, setResult] = useState<{
        deleted: number;
        realtimeDeleted?: number;
        historicalCompacted?: number;
        message: string;
    } | null>(null);
    const [error, setError] = useState('');

    const fetchStats = useCallback(async () => {
        setLoading(true);
        try {
            const res = await dataCleanupApi.getRealtimeStats();
            setStats(res.data.data || res.data);
            setError('');
        } catch (err: any) {
            setError(err?.response?.data?.message || t('โหลดข้อมูลไม่สำเร็จ', 'Failed to load data'));
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchStats(); }, [fetchStats]);

    const handlePurge = async () => {
        setShowConfirm(false);
        setPurging(true);
        setResult(null);
        try {
            const res = await dataCleanupApi.purgeRealtime(retentionHours);
            const data = res.data.data || res.data;
            setResult(data);
            fetchStats();
        } catch (err: any) {
            setError(err?.response?.data?.message || t('ลบข้อมูลไม่สำเร็จ', 'Failed to purge data'));
        }
        setPurging(false);
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const formatNumber = (n: number) => n?.toLocaleString() || '0';

    const selectedOption = RETENTION_OPTIONS.find(o => o.hours === retentionHours);
    const rowsToDelete = stats ? (
        retentionHours <= 24 ? stats.rows_older_than_24h :
        retentionHours <= 168 ? stats.rows_older_than_7d :
        stats.rows_older_than_30d
    ) : 0;

    return (
        <div>
            {/* Command bar */}
            <div style={{ background: C.bar, color: C.ink, display: 'flex', alignItems: 'stretch', borderBottom: `2px solid ${C.accent}`, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}><LayoutGrid size={16} /></div>
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>{t('ตั้งค่า // ล้างข้อมูล REALTIME', 'SETTINGS // DATA CLEANUP')}</div>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>{t('จัดการลบข้อมูล Realtime เก่าเพื่อประหยัดพื้นที่ฐานข้อมูล', 'Manage and purge old realtime data to save database space')}</div>
                    </div>
                </div>
                <div style={{ flex: 1 }} />
                <button onClick={fetchStats} disabled={loading} style={{
                    background: 'transparent', border: 'none', color: C.accent, cursor: 'pointer',
                    padding: '0 16px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: MONO,
                }}><RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> {t('รีเฟรช', 'Refresh')}</button>
            </div>

            <div style={{ padding: '0 16px 24px', maxWidth: 900, margin: '0 auto' }}>
                {error && (
                    <div style={{ background: C.red + '18', color: C.red, padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AlertTriangle size={16} /> {error}
                    </div>
                )}

                {result && (
                    <div style={{ background: C.green + '18', color: C.green, padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CheckCircle size={16} />
                        {t(
                            `ดำเนินการสำเร็จ: ลบ Realtime เก่า ${(result.realtimeDeleted ?? result.deleted).toLocaleString()} รายการ และบีบอัดข้อมูลเกิน 3 เดือน ${(result.historicalCompacted ?? 0).toLocaleString()} รายการ`,
                            `Completed: Deleted ${(result.realtimeDeleted ?? result.deleted).toLocaleString()} realtime records and compacted ${(result.historicalCompacted ?? 0).toLocaleString()} historical records (> 3 months)`
                        )}
                    </div>
                )}

                {/* Retention Policy Summary Table */}
                <div style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10, padding: '16px 20px', marginBottom: 24 }}>
                    <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, color: C.ink, marginBottom: 12, letterSpacing: 1 }}>
                        {t('นโยบายการเก็บข้อมูลเพื่อประหยัดพื้นที่ (TIME STAMP RETENTION POLICY)', 'TIME STAMP DATA RETENTION POLICY')}
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, fontFamily: MONO }}>
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${C.line}`, color: C.sub, textAlign: 'left' }}>
                                    <th style={{ padding: '8px 10px' }}>{t('ประเภทข้อมูล / มิเตอร์', 'Category / Meter Type')}</th>
                                    <th style={{ padding: '8px 10px' }}>{t('ช่วงที่ 1 (0 - 3 เดือนแรก)', 'First 3 Months')}</th>
                                    <th style={{ padding: '8px 10px' }}>{t('หลัง 3 เดือน (> 3 เดือน)', 'After 3 Months')}</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>{t('จำนวนข้อมูลปัจจุบัน', 'Current Records')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    {
                                        name: t('Realtime (เตือน Alarm)', 'Realtime (Alarm Monitoring)'),
                                        phase1: t('เก็บทุกวินาที (เก็บไว้ 24 ชม.)', 'Every second (Keep 24 hrs)'),
                                        phase2: t('ลบอัตโนมัติหลัง 24 ชม. (อ้างอิงข้อ 1-3)', 'Purged after 24 hrs (Ref. rules 1-3)'),
                                        count: stats ? formatNumber(stats.total_rows) : '-',
                                        badgeColor: C.accent,
                                    },
                                    {
                                        name: t('ไฟฟ้า — 1. kWh', 'Electricity — 1. kWh'),
                                        phase1: t('เก็บทุก 15 นาที (3 เดือนแรก)', 'Every 15 mins (First 3 months)'),
                                        phase2: t('24 ชม. 1 ค่า (วันละ 1 ค่า)', '1 value per 24 hrs (Daily)'),
                                        count: stats?.historical ? formatNumber(stats.historical.kwh_rows) : '-',
                                        badgeColor: C.green,
                                    },
                                    {
                                        name: t('ไฟฟ้า — 2. ELE', 'Electricity — 2. ELE'),
                                        phase1: t('เก็บทุก 15 นาที (3 เดือนแรก)', 'Every 15 mins (First 3 months)'),
                                        phase2: t('ชม.ละ 1 ค่า (ชั่วโมงละ 1 ค่า)', '1 value per hour (Hourly)'),
                                        count: stats?.historical ? formatNumber(stats.historical.ele_rows) : '-',
                                        badgeColor: C.yellow,
                                    },
                                    {
                                        name: t('ไฟฟ้า — 3. Main MDB (TOU)', 'Electricity — 3. Main MDB (TOU)'),
                                        phase1: t('เก็บทุก 15 นาที', 'Every 15 mins'),
                                        phase2: t('เก็บทุก 15 นาที ตลอดการใช้งาน', 'Every 15 mins (Forever)'),
                                        count: stats?.historical ? formatNumber(stats.historical.mdb_tou_rows) : '-',
                                        badgeColor: C.accent,
                                    },
                                    {
                                        name: t('น้ำ — 1. Water', 'Water — 1. Water'),
                                        phase1: t('เก็บทุก 15 นาที (3 เดือนแรก)', 'Every 15 mins (First 3 months)'),
                                        phase2: t('เหลือ 24 ชม. 1 ค่า (วันละ 1 ค่า)', '1 value per 24 hrs (Daily)'),
                                        count: stats?.historical ? formatNumber(stats.historical.water_rows) : '-',
                                        badgeColor: C.green,
                                    },
                                ].map((row, idx) => (
                                    <tr key={idx} style={{ borderBottom: `1px solid ${C.line}60` }}>
                                        <td style={{ padding: '9px 10px', fontWeight: 700, color: C.ink }}>{row.name}</td>
                                        <td style={{ padding: '9px 10px', color: C.sub }}>{row.phase1}</td>
                                        <td style={{ padding: '9px 10px', color: row.badgeColor, fontWeight: 600 }}>{row.phase2}</td>
                                        <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: C.ink }}>{row.count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {stats?.historical && (
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${C.line}`, fontSize: 11.5, color: C.sub, fontFamily: MONO }}>
                            <span>{t('ขนาดตาราง History (15m/1h/24h):', 'History Table Size:')} <strong style={{ color: C.ink }}>{stats.historical.actual_table_size}</strong></span>
                            <span>{t('ภายใน 3 เดือน:', 'Within 3 Months:')} <strong style={{ color: C.green }}>{formatNumber(stats.historical.actual_within_3m)}</strong></span>
                            <span>{t('เก่ากว่า 3 เดือน:', 'Older than 3 Months:')} <strong style={{ color: C.yellow }}>{formatNumber(stats.historical.actual_older_than_3m)}</strong></span>
                        </div>
                    )}
                </div>

                {/* Stats Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                    {[
                        { icon: Database, label: t('จำนวนทั้งหมด', 'Total Records'), value: stats ? formatNumber(stats.total_rows) : '-', color: C.accent },
                        { icon: HardDrive, label: t('ขนาดตาราง', 'Table Size'), value: stats?.table_size || '-', color: C.yellow },
                        { icon: Clock, label: t('เก่าสุด', 'Oldest Record'), value: stats ? formatDate(stats.oldest_record) : '-', color: C.sub },
                        { icon: Clock, label: t('ใหม่สุด', 'Newest Record'), value: stats ? formatDate(stats.newest_record) : '-', color: C.green },
                    ].map((card, i) => (
                        <div key={i} style={{
                            background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10, padding: '14px 16px',
                            transition: 'box-shadow 0.2s', cursor: 'default',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <card.icon size={16} style={{ color: card.color }} />
                                <span style={{ color: C.sub, fontSize: 11, fontFamily: MONO, letterSpacing: 1 }}>{card.label}</span>
                            </div>
                            <div style={{ color: C.ink, fontSize: 14, fontWeight: 700, fontFamily: MONO, whiteSpace: 'nowrap' }}>{card.value}</div>
                        </div>
                    ))}
                </div>

                {/* Breakdown */}
                <div style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10, padding: '16px 20px', marginBottom: 24 }}>
                    <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, color: C.ink, marginBottom: 12, letterSpacing: 1 }}>
                        {t('ข้อมูลตามอายุ', 'DATA BY AGE')}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                        {[
                            { label: t('> 24 ชม.', '> 24 Hours'), count: stats?.rows_older_than_24h || 0, color: C.green },
                            { label: t('> 7 วัน', '> 7 Days'), count: stats?.rows_older_than_7d || 0, color: C.yellow },
                            { label: t('> 30 วัน', '> 30 Days'), count: stats?.rows_older_than_30d || 0, color: C.red },
                        ].map((item, i) => (
                            <div key={i} style={{ textAlign: 'center', padding: 12, background: item.color + '10', borderRadius: 8, border: `1px solid ${item.color}30` }}>
                                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: MONO, color: item.color }}>{formatNumber(item.count)}</div>
                                <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>{item.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Purge Section */}
                <div style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10, padding: '16px 20px' }}>
                    <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, color: C.ink, marginBottom: 12, letterSpacing: 1 }}>
                        <Trash2 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                        {t('ล้างข้อมูล REALTIME และบีบอัดข้อมูลเกิน 3 เดือน', 'PURGE REALTIME & COMPACT HISTORICAL DATA')}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <label style={{ color: C.sub, fontSize: 13 }}>{t('ลบข้อมูล Realtime ที่เก่ากว่า:', 'Delete Realtime data older than:')}</label>
                        <select
                            value={retentionHours}
                            onChange={(e) => setRetentionHours(parseInt(e.target.value, 10))}
                            style={{
                                background: C.panel2, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 6,
                                padding: '8px 12px', fontSize: 13, fontFamily: MONO, cursor: 'pointer', minWidth: 200,
                            }}
                        >
                            {RETENTION_OPTIONS.map(opt => (
                                <option key={opt.hours} value={opt.hours}>{t(opt.labelTh, opt.labelEn)}</option>
                            ))}
                        </select>

                        <button
                            onClick={() => setShowConfirm(true)}
                            disabled={purging || !stats || (stats.total_rows === 0 && (stats.historical?.actual_total_rows || 0) === 0)}
                            style={{
                                background: C.red, color: '#fff', border: 'none', borderRadius: 6,
                                padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                opacity: (purging || !stats || (stats.total_rows === 0 && (stats.historical?.actual_total_rows || 0) === 0)) ? 0.5 : 1,
                                display: 'flex', alignItems: 'center', gap: 6, fontFamily: MONO,
                                transition: 'opacity 0.2s',
                            }}
                        >
                            <Trash2 size={14} />
                            {purging ? t('กำลังดำเนินการ...', 'Processing...') : t('ดำเนินการล้างและบีบอัดข้อมูล', 'Run Cleanup & Compaction')}
                        </button>
                    </div>

                    <div style={{ color: C.sub, fontSize: 11, marginTop: 10, fontStyle: 'italic' }}>
                        {t(
                            `ℹ️ ระบบทำงานอัตโนมัติทุกชั่วโมง: ลบ Realtime เกิน 24 ชม. และย่อข้อมูลที่เกิน 3 เดือน (kWh/น้ำ -> 24 ชม. 1 ค่า, ELE -> ชม.ละ 1 ค่า, Main MDB (TOU) -> เก็บทุก 15 นาทีตลอดการใช้งาน)`,
                            `ℹ️ Runs automatically every hour: purges Realtime > 24h and compacts records > 3 months (kWh/Water -> 1/24h, ELE -> 1/hr, Main MDB (TOU) -> kept at 15m forever)`
                        )}
                    </div>
                </div>
            </div>

            {/* Confirm Modal */}
            {showConfirm && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
                }} onClick={() => setShowConfirm(false)}>
                    <div onClick={e => e.stopPropagation()} style={{
                        background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '24px 28px',
                        maxWidth: 420, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.red + '20', display: 'grid', placeItems: 'center' }}>
                                <AlertTriangle size={20} style={{ color: C.red }} />
                            </div>
                            <div style={{ fontWeight: 700, fontSize: 16, color: C.ink }}>{t('ยืนยันการลบข้อมูล', 'Confirm Data Purge')}</div>
                        </div>

                        <div style={{ color: C.sub, fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
                            {t(
                                `คุณกำลังจะลบข้อมูล Realtime ที่เก่ากว่า ${selectedOption?.labelTh}`,
                                `You are about to delete realtime data older than ${selectedOption?.labelEn}`
                            )}
                            <br />
                            <strong style={{ color: C.red }}>{t(`ข้อมูลประมาณ ${formatNumber(rowsToDelete)} รายการจะถูกลบ`, `Approximately ${formatNumber(rowsToDelete)} records will be deleted`)}</strong>
                            <br /><br />
                            {t('การดำเนินการนี้ไม่สามารถย้อนกลับได้', 'This action cannot be undone.')}
                        </div>

                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowConfirm(false)} style={{
                                background: C.panel2, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 6,
                                padding: '8px 20px', fontSize: 13, cursor: 'pointer', fontFamily: MONO,
                            }}>{t('ยกเลิก', 'Cancel')}</button>
                            <button onClick={handlePurge} style={{
                                background: C.red, color: '#fff', border: 'none', borderRadius: 6,
                                padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: MONO,
                                display: 'flex', alignItems: 'center', gap: 6,
                            }}><Trash2 size={14} /> {t('ยืนยันลบ', 'Confirm Delete')}</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default DataCleanupPage;
