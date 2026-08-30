import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { alarmsApi, reportsApi, sitesApi } from '../../api/client';

interface AlertItem {
    id: number;
    alarm_type: string;
    message: string;
    meter_code: string;
    meter_name: string;
    occurred_at: string;
    acknowledged: boolean;
}

const ThaiFlag: React.FC = () => (
    <svg width="18" height="12" viewBox="0 0 900 600" style={{ borderRadius: '2px', flexShrink: 0, boxShadow: '0 0 1px rgba(0,0,0,0.4)', display: 'block' }}>
        <rect fill="#A51931" width="900" height="600"/>
        <rect fill="#F4F5F8" y="100" width="900" height="400"/>
        <rect fill="#2D2A4A" y="200" width="900" height="200"/>
    </svg>
);

const UsFlag: React.FC = () => (
    <svg width="18" height="12" viewBox="0 0 7410 3900" style={{ borderRadius: '2px', flexShrink: 0, boxShadow: '0 0 1px rgba(0,0,0,0.4)', display: 'block' }}>
        <rect width="7410" height="3900" fill="#b22234"/>
        <path d="M0,450H7410M0,1050H7410M0,1650H7410M0,2250H7410M0,2850H7410M0,3450H7410" stroke="#fff" strokeWidth="300"/>
        <rect width="2964" height="2100" fill="#3c3b6e"/>
        <g fill="#fff">
            <circle cx="500" cy="350" r="120" />
            <circle cx="1000" cy="350" r="120" />
            <circle cx="1500" cy="350" r="120" />
            <circle cx="2000" cy="350" r="120" />
            <circle cx="2500" cy="350" r="120" />
            <circle cx="750" cy="700" r="120" />
            <circle cx="1250" cy="700" r="120" />
            <circle cx="1750" cy="700" r="120" />
            <circle cx="2250" cy="700" r="120" />
            <circle cx="500" cy="1050" r="120" />
            <circle cx="1000" cy="1050" r="120" />
            <circle cx="1500" cy="1050" r="120" />
            <circle cx="2000" cy="1050" r="120" />
            <circle cx="2500" cy="1050" r="120" />
            <circle cx="750" cy="1400" r="120" />
            <circle cx="1250" cy="1400" r="120" />
            <circle cx="1750" cy="1400" r="120" />
            <circle cx="2250" cy="1400" r="120" />
            <circle cx="500" cy="1750" r="120" />
            <circle cx="1000" cy="1750" r="120" />
            <circle cx="1500" cy="1750" r="120" />
            <circle cx="2000" cy="1750" r="120" />
            <circle cx="2500" cy="1750" r="120" />
        </g>
    </svg>
);

const Header: React.FC = () => {
    const { user, logout, selectedSiteId, setSelectedSiteId } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { language, toggleLanguage, t } = useLanguage();
    const navigate = useNavigate();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [sitesList, setSitesList] = useState<{ siteId: number; siteName: string }[]>([]);

    // Load active sites only
    useEffect(() => {
        let isMounted = true;
        const fetchActiveSites = async () => {
            try {
                const res = await sitesApi.getAll({ limit: 200, activeOnly: true });
                const data = res.data.data || [];
                const mapped = data.map((s: any) => ({
                    siteId: s.site_id,
                    siteName: language === 'en' ? (s.site_name_en || s.site_name) : (s.site_name_th || s.site_name),
                    siteNameTh: s.site_name_th || s.site_name,
                    siteNameEn: s.site_name_en || s.site_name,
                }));
                if (isMounted) {
                    let activeSites = mapped;
                    if (user?.siteAccessMode !== 'all' && user?.sites) {
                        const allowedIds = new Set(user.sites.map((us: any) => us.siteId));
                        activeSites = mapped.filter((s: any) => allowedIds.has(s.siteId));
                    }
                    setSitesList(activeSites);

                    // Reset selectedSiteId if current selection is inactive
                    if (selectedSiteId) {
                        const stillExists = activeSites.some((s: { siteId: number }) => s.siteId === selectedSiteId);
                        if (!stillExists) {
                            setSelectedSiteId(activeSites.length > 0 ? activeSites[0].siteId : null);
                        }
                    }
                }
            } catch {
                // silent — keep empty list until next retry
            }
        };
        fetchActiveSites();
        return () => { isMounted = false; };
    }, [user?.siteAccessMode, user?.sites]);

    // Notification state
    const [notifOpen, setNotifOpen] = useState(false);
    const [alerts, setAlerts] = useState<AlertItem[]>([]);
    const [alertCount, setAlertCount] = useState(0);
    const notifRef = useRef<HTMLDivElement>(null);
    const readIdsRef = useRef<Set<number>>(new Set());

    const now = new Date();
    const dateStr = now.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = now.toLocaleTimeString(language === 'th' ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit' });

    // Close dropdowns on outside click
    useEffect(() => {
        const close = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setNotifOpen(false);
            }
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const markAllRead = () => {
        alerts.forEach(a => readIdsRef.current.add(a.id));
        setAlertCount(0);
    };

    const handleAcknowledgeAll = async () => {
        try {
            const unacknowledged = alerts.filter(a => !a.acknowledged);
            await Promise.allSettled(unacknowledged.map(a => reportsApi.acknowledgeAlarm(a.id)));
            alerts.forEach(a => readIdsRef.current.add(a.id));
            setAlerts(prev => prev.map(a => ({ ...a, acknowledged: true })));
            setAlertCount(0);
        } catch (e) {
            console.error(e);
        }
    };

    const handleAcknowledgeItem = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await reportsApi.acknowledgeAlarm(id);
            readIdsRef.current.add(id);
            setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
            setAlertCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error(err);
        }
    };

    // Poll alerts
    const fetchAlerts = useCallback(async () => {
        try {
            const res = await alarmsApi.getRecentAlerts(60); // last 60 minutes
            const items: AlertItem[] = (res.data.data || []).map((r: any) => ({
                id: r.id,
                alarm_type: r.alarm_type,
                message: r.message || '',
                meter_code: r.meter_code || '',
                meter_name: r.meter_name || '',
                occurred_at: r.occurred_at,
                acknowledged: r.acknowledged ?? false,
            }));
            setAlerts(items);
            // Only count alerts that haven't been read yet
            const unread = items.filter(a => !a.acknowledged && !readIdsRef.current.has(a.id));
            setAlertCount(unread.length);
        } catch (e) {
            // silent
        }
    }, []);

    useEffect(() => {
        fetchAlerts();
        const timer = setInterval(fetchAlerts, 30_000);
        return () => clearInterval(timer);
    }, [fetchAlerts]);

    const displayName = (user as any)?.displayName || (user as any)?.userName || 'User';
    const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

    const getAlertIcon = (type: string) => {
        if (type === 'disconnect') return '🔴';
        if (type === 'threshold_high') return '🔺';
        if (type === 'threshold_low') return '🔻';
        return '⚠️';
    };

    const getAlertLabel = (type: string) => {
        if (type === 'disconnect') return t('ขาดการติดต่อ', 'Disconnect');
        if (type === 'threshold_high') return t('เกินขั้นสูง', 'Over Max');
        if (type === 'threshold_low') return t('ต่ำกว่าขั้นต่ำ', 'Under Min');
        return t('แจ้งเตือน', 'Alert');
    };

    const formatTime = (dt: string) => {
        try {
            return new Date(dt).toLocaleString(language === 'th' ? 'th-TH' : 'en-US', {
                timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short',
            });
        } catch { return dt; }
    };

    return (
        <header className="topbar">
            <div className="topbar__left">
                <div className="topbar__breadcrumb">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    <span>M Soft</span>
                </div>
            </div>

            <div className="topbar__right">
                {/* Date/Time Pill */}
                <div className="topbar__datetime">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>{dateStr} · {timeStr}</span>
                </div>

                {/* Theme Toggle */}
                <button 
                    className="topbar__icon-btn theme-toggle-btn" 
                    onClick={toggleTheme} 
                    title={theme === 'light' ? t('เปลี่ยนเป็นโหมดมืด (ห้องควบคุม)', 'Switch to Dark Mode (Control Room)') : t('เปลี่ยนเป็นโหมดสว่าง (กระดาษวิศวกรรม)', 'Switch to Light Mode (Engineering Paper)')}
                >
                    {theme === 'light' ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="5" />
                            <line x1="12" y1="1" x2="12" y2="3" />
                            <line x1="12" y1="21" x2="12" y2="23" />
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                            <line x1="1" y1="12" x2="3" y2="12" />
                            <line x1="21" y1="12" x2="23" y2="12" />
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                        </svg>
                    )}
                </button>

                {/* Language Toggle */}
                <button 
                    className="topbar__icon-btn" 
                    onClick={toggleLanguage} 
                    title={language === 'en' ? 'เปลี่ยนเป็นภาษาไทย (Switch to Thai)' : 'Switch to English (เปลี่ยนเป็นภาษาอังกฤษ)'}
                    style={{ 
                        fontSize: '11px', 
                        fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, monospace', 
                        fontWeight: 'bold', 
                        minWidth: '58px', 
                        padding: '0 8px', 
                        border: '1px solid var(--line)', 
                        borderRadius: '4px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        justifyContent: 'center',
                        cursor: 'pointer',
                    }}
                >
                    {language === 'th' ? <ThaiFlag /> : <UsFlag />}
                    <span>{language.toUpperCase()}</span>
                </button>

                {/* Notification Bell */}
                <div style={{ position: 'relative' }} ref={notifRef}>
                    <button
                        className="topbar__icon-btn"
                        title={t('การแจ้งเตือน', 'Notifications')}
                        onClick={() => { setNotifOpen(v => !v); markAllRead(); }}
                        style={{ position: 'relative' }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                        </svg>
                        {alertCount > 0 && (
                            <span className="topbar__icon-badge" style={{
                                animation: 'pulse 2s infinite',
                            }}>
                                {alertCount > 99 ? '99+' : alertCount}
                            </span>
                        )}
                    </button>

                    {/* Notification Dropdown */}
                    {notifOpen && (
                        <div style={{
                            position: 'absolute', top: '100%', right: 0, marginTop: 8,
                            width: 380, maxHeight: 480, overflowY: 'auto',
                            background: 'var(--surface, #fff)', border: '1px solid var(--border)',
                            borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                            zIndex: 9999,
                        }}>
                            {/* Header */}
                            <div style={{
                                padding: '12px 16px', borderBottom: '1px solid var(--border)',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontWeight: 700, fontSize: 14 }}>
                                        🔔 {t('การแจ้งเตือน', 'Notifications')}
                                    </span>
                                    {alertCount > 0 && (
                                        <span style={{
                                            padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                                            background: '#EF444420', color: '#EF4444',
                                        }}>
                                            {alertCount} {t('รายการใหม่', 'new')}
                                        </span>
                                    )}
                                </div>
                                {alertCount > 0 && (
                                    <button
                                        onClick={handleAcknowledgeAll}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'var(--accent, #2B4C7E)',
                                            fontSize: 11,
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            textDecoration: 'underline',
                                            padding: 0,
                                        }}
                                        title={t('รับทราบการแจ้งเตือนทั้งหมด', 'Acknowledge all alerts')}
                                    >
                                        ✓ {t('รับทราบทั้งหมด', 'Acknowledge all')}
                                    </button>
                                )}
                            </div>

                            {/* Alert List */}
                            {alerts.length === 0 ? (
                                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                                    <div style={{ fontSize: 13 }}>{t('ไม่มีการแจ้งเตือน', 'No notifications')}</div>
                                </div>
                            ) : (
                                alerts.map(alert => (
                                    <div key={alert.id} style={{
                                        padding: '10px 16px', borderBottom: '1px solid var(--border)',
                                        display: 'flex', gap: 10, alignItems: 'flex-start',
                                        background: alert.acknowledged ? 'transparent' : 'var(--surface-2, rgba(239,68,68,0.04))',
                                        cursor: 'default',
                                    }}>
                                        <div style={{
                                            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                                            display: 'grid', placeItems: 'center', fontSize: 16,
                                            background: alert.alarm_type === 'disconnect' ? '#EF444415' : '#F59E0B15',
                                        }}>
                                            {getAlertIcon(alert.alarm_type)}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                                                <span style={{
                                                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                                                    padding: '1px 5px', borderRadius: 3,
                                                    background: alert.alarm_type === 'disconnect' ? '#EF444420' : '#F59E0B20',
                                                    color: alert.alarm_type === 'disconnect' ? '#EF4444' : '#F59E0B',
                                                }}>
                                                    {getAlertLabel(alert.alarm_type)}
                                                </span>
                                                {!alert.acknowledged ? (
                                                    <button
                                                        onClick={(e) => handleAcknowledgeItem(alert.id, e)}
                                                        style={{
                                                            marginLeft: 'auto',
                                                            background: '#EF444415',
                                                            color: '#EF4444',
                                                            border: '1px solid #EF444440',
                                                            borderRadius: 4,
                                                            fontSize: 10,
                                                            fontWeight: 600,
                                                            padding: '2px 6px',
                                                            cursor: 'pointer',
                                                        }}
                                                        title={t('รับทราบการแจ้งเตือนนี้', 'Acknowledge this alert')}
                                                    >
                                                        {t('รับทราบ', 'Acknowledge')}
                                                    </button>
                                                ) : (
                                                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>
                                                        ✓ {t('รับทราบแล้ว', 'Acknowledged')}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                [{alert.meter_code}] {alert.meter_name}
                                            </div>
                                            {alert.message && (
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {alert.message}
                                                </div>
                                            )}
                                            <div style={{ fontSize: 10, color: '#999', marginTop: 3 }}>
                                                🕒 {formatTime(alert.occurred_at)}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}

                            {/* Footer */}
                            <div style={{ padding: '10px 16px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
                                <a href="/reports/alarms" style={{
                                    fontSize: 12, fontWeight: 600, color: 'var(--accent)',
                                    textDecoration: 'none',
                                }}>
                                    {t('ดูประวัติทั้งหมด →', 'View all history →')}
                                </a>
                            </div>
                        </div>
                    )}
                </div>

                {/* User Dropdown */}
                <div className="topbar__user" ref={dropdownRef}>
                    <button
                        className="topbar__user-btn"
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                    >
                        <div className="topbar__avatar">{initials}</div>
                        <div className="topbar__user-info">
                            <span className="topbar__user-name">{displayName}</span>
                            <span className="topbar__user-role">{t('ผู้ดูแลระบบ', 'Administrator')}</span>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>

                    {dropdownOpen && (
                        <div className="topbar__dropdown">
                            <button className="topbar__dropdown-item" onClick={() => { setDropdownOpen(false); navigate('/account/profile'); }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                                {t('ตั้งค่าโปรไฟล์', 'Profile Settings')}
                            </button>
                            <button className="topbar__dropdown-item" onClick={() => { setDropdownOpen(false); navigate('/account/change-password'); }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                {t('เปลี่ยนรหัสผ่าน', 'Change Password')}
                            </button>
                            <div className="topbar__dropdown-divider" />
                            <button className="topbar__dropdown-item topbar__dropdown-item--danger" onClick={logout}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                    <polyline points="16 17 21 12 16 7" />
                                    <line x1="21" y1="12" x2="9" y2="12" />
                                </svg>
                                {t('ออกจากระบบ', 'Sign Out')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.2); }
                }
            `}</style>
        </header>
    );
};

export default Header;
