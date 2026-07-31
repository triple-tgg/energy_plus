import React, { useEffect, useRef, useState, useCallback } from 'react';
import { alarmsApi } from '../../api/client';

interface AlertItem {
    id: number;
    alarm_type: string;
    message: string;
    meter_code: string;
    meter_name: string;
    occurred_at: string;
}

const POLL_INTERVAL = 30_000; // 30 seconds

/* ─── Web Audio alarm sound ─── */
const playAlarmSound = () => {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const playBeep = (freq: number, startTime: number, duration: number) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.15, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + duration);
        };
        // 3 beeps: beep-beep-beep
        const now = ctx.currentTime;
        playBeep(880, now, 0.15);
        playBeep(880, now + 0.25, 0.15);
        playBeep(1100, now + 0.5, 0.3);
    } catch (e) {
        console.warn('Cannot play alarm sound:', e);
    }
};

const AlarmNotification: React.FC = () => {
    const [alerts, setAlerts] = useState<AlertItem[]>([]);
    const [dismissed, setDismissed] = useState<Set<number>>(new Set());
    const knownIdsRef = useRef<Set<number>>(new Set());
    const firstLoadRef = useRef(true);

    const fetchAlerts = useCallback(async () => {
        try {
            const res = await alarmsApi.getRecentAlerts(5);
            const items: AlertItem[] = (res.data.data || []).map((r: any) => ({
                id: r.id,
                alarm_type: r.alarm_type,
                message: r.message,
                meter_code: r.meter_code || '',
                meter_name: r.meter_name || '',
                occurred_at: r.occurred_at,
            }));

            // Check for NEW alerts (not seen before)
            if (!firstLoadRef.current) {
                const newAlerts = items.filter(a => !knownIdsRef.current.has(a.id));
                if (newAlerts.length > 0) {
                    playAlarmSound();
                }
            }
            firstLoadRef.current = false;

            // Update known IDs
            items.forEach(a => knownIdsRef.current.add(a.id));

            setAlerts(items);
        } catch (e) {
            // silently fail
        }
    }, []);

    useEffect(() => {
        fetchAlerts();
        const timer = setInterval(fetchAlerts, POLL_INTERVAL);
        return () => clearInterval(timer);
    }, [fetchAlerts]);

    const dismiss = (id: number) => {
        setDismissed(prev => new Set(prev).add(id));
    };

    const dismissAll = () => {
        setDismissed(new Set(alerts.map(a => a.id)));
    };

    const visibleAlerts = alerts.filter(a => !dismissed.has(a.id));
    if (visibleAlerts.length === 0) return null;

    const getAlertColor = (type: string) => {
        if (type === 'disconnect') return { border: '#EF4444', bg: '#EF4444', icon: '🔴', label: 'DISCONNECT' };
        if (type === 'threshold_high') return { border: '#F59E0B', bg: '#F59E0B', icon: '🔺', label: 'เกินขั้นสูง' };
        return { border: '#3B82F6', bg: '#3B82F6', icon: '🔻', label: 'ต่ำกว่าขั้นต่ำ' };
    };

    return (
        <div style={{
            position: 'fixed',
            top: 76,       /* ใต้ topbar 68px + gap 8px */
            right: 16,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            maxWidth: 360,
            maxHeight: 'calc(100vh - 100px)',
            overflowY: 'auto',
        }}>
            {/* Controls */}
            {visibleAlerts.length > 1 && (
                <div style={{
                    display: 'flex', gap: 6, justifyContent: 'flex-end',
                    padding: '4px 0',
                }}>
                    <button onClick={dismissAll} style={{
                        padding: '3px 10px', borderRadius: 12, border: 'none', cursor: 'pointer',
                        background: 'rgba(100,116,139,0.12)', color: '#64748B',
                        fontSize: 10.5, fontWeight: 600, letterSpacing: 0.3,
                    }}>
                        ✕ ปิดทั้งหมด ({visibleAlerts.length})
                    </button>
                </div>
            )}

            {/* Alert cards */}
            {visibleAlerts.slice(0, 5).map(alert => {
                const c = getAlertColor(alert.alarm_type);
                return (
                    <div key={alert.id} style={{
                        background: 'var(--surface, #fff)',
                        borderLeft: `4px solid ${c.border}`,
                        borderRadius: 8,
                        padding: '10px 12px',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.06)',
                        animation: 'alarmSlideIn 0.3s ease-out',
                        color: 'var(--text, #23261E)',
                        position: 'relative',
                    }}>
                        {/* Close button */}
                        <button onClick={() => dismiss(alert.id)} style={{
                            position: 'absolute', top: 6, right: 8,
                            background: 'none', border: 'none', color: 'var(--text-muted, #999)',
                            cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px',
                        }}>×</button>

                        {/* Type badge */}
                        <div style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: `${c.bg}18`,
                            color: c.border,
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: 0.5,
                            textTransform: 'uppercase',
                            marginBottom: 6,
                        }}>
                            {c.icon} {c.label}
                        </div>

                        {/* Meter info */}
                        <div style={{
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: 'var(--text, #23261E)',
                            lineHeight: 1.4,
                            paddingRight: 16,
                        }}>
                            [{alert.meter_code}] {alert.meter_name}
                        </div>

                        {/* Timestamp */}
                        <div style={{
                            fontSize: 10.5,
                            color: 'var(--text-secondary, #888)',
                            marginTop: 4,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                        }}>
                            🕒 {new Date(alert.occurred_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
                        </div>
                    </div>
                );
            })}

            <style>{`
                @keyframes alarmSlideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default AlarmNotification;
