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
    const [muted, setMuted] = useState(false);
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
                if (newAlerts.length > 0 && !muted) {
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
    }, [muted]);

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

    return (
        <div style={{
            position: 'fixed', top: 16, right: 16, zIndex: 9999,
            display: 'flex', flexDirection: 'column', gap: 8,
            maxWidth: 380, maxHeight: 'calc(100vh - 100px)', overflowY: 'auto',
        }}>
            {/* Controls */}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => setMuted(m => !m)} style={{
                    padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: muted ? '#EF444430' : '#10B98130',
                    color: muted ? '#EF4444' : '#10B981',
                    fontSize: 11, fontWeight: 600,
                }}>
                    {muted ? '🔇 เสียงปิด' : '🔊 เสียงเปิด'}
                </button>
                {visibleAlerts.length > 1 && (
                    <button onClick={dismissAll} style={{
                        padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: '#64748B20', color: '#64748B', fontSize: 11, fontWeight: 600,
                    }}>
                        ปิดทั้งหมด ({visibleAlerts.length})
                    </button>
                )}
            </div>

            {/* Alert cards */}
            {visibleAlerts.slice(0, 5).map(alert => (
                <div key={alert.id} style={{
                    background: alert.alarm_type === 'offline'
                        ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
                        : 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)',
                    border: alert.alarm_type === 'offline' ? '1px solid #EF4444' : '1px solid #F59E0B',
                    borderRadius: 10, padding: '12px 14px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                    animation: 'slideIn 0.3s ease-out',
                    color: '#fff',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{
                            fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
                            color: alert.alarm_type === 'offline' ? '#EF4444' : '#F59E0B',
                        }}>
                            {alert.alarm_type === 'offline' ? '🔴 OFFLINE' : alert.alarm_type === 'threshold_high' ? '🔺 เกินขั้นสูง' : '🔻 ต่ำกว่าขั้นต่ำ'}
                        </span>
                        <button onClick={() => dismiss(alert.id)} style={{
                            background: 'none', border: 'none', color: '#888', cursor: 'pointer',
                            fontSize: 16, lineHeight: 1, padding: '0 2px',
                        }}>×</button>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                        [{alert.meter_code}] {alert.meter_name}
                    </div>
                    <div style={{ fontSize: 11, color: '#aaa' }}>
                        🕒 {new Date(alert.occurred_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
                    </div>
                </div>
            ))}

            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default AlarmNotification;
