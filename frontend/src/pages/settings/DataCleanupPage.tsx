import React, { useEffect, useState, useCallback } from 'react';
import { dataCleanupApi } from '../../api/client';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Database, Trash2, Clock, HardDrive, AlertTriangle, CheckCircle, RefreshCw, LayoutGrid } from 'lucide-react';

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, "Cascadia Mono", monospace';
const THEMES = {
    light: {
        bg: '#EAE7DA', panel: '#FBFAF4', panel2: '#F1EFE3', ink: '#23261E', sub: '#6E705F',
        line: '#D4D1C0', bar: '#23261E', barSub: '#A6A892', accent: '#2B4C7E',
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
    const [result, setResult] = useState<{ deleted: number; message: string } | null>(null);
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
            <div style={{ background: C.bar, color: '#fff', display: 'flex', alignItems: 'stretch', borderBottom: `2px solid ${C.accent}`, marginBottom: 16 }}>
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
                        <CheckCircle size={16} /> {t(`ลบข้อมูลสำเร็จ ${result.deleted.toLocaleString()} รายการ`, `Successfully deleted ${result.deleted.toLocaleString()} records`)}
                    </div>
                )}

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
                        {t('ล้างข้อมูล REALTIME', 'PURGE REALTIME DATA')}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <label style={{ color: C.sub, fontSize: 13 }}>{t('ลบข้อมูลที่เก่ากว่า:', 'Delete data older than:')}</label>
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
                            disabled={purging || !stats || stats.total_rows === 0}
                            style={{
                                background: C.red, color: '#fff', border: 'none', borderRadius: 6,
                                padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                opacity: (purging || !stats || stats.total_rows === 0) ? 0.5 : 1,
                                display: 'flex', alignItems: 'center', gap: 6, fontFamily: MONO,
                                transition: 'opacity 0.2s',
                            }}
                        >
                            <Trash2 size={14} />
                            {purging ? t('กำลังลบ...', 'Deleting...') : t('ลบข้อมูล', 'Purge Data')}
                        </button>
                    </div>

                    <div style={{ color: C.sub, fontSize: 11, marginTop: 10, fontStyle: 'italic' }}>
                        {t(
                            `⚠️ การลบข้อมูลนี้ไม่สามารถย้อนกลับได้ — ข้อมูลที่ถูกลบจะหายถาวร`,
                            `⚠️ This action is irreversible — deleted data cannot be recovered`
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
