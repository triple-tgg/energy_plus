import { query } from '../../config/database';
import { sendTelegramMessage } from '../../utils/telegram';

/* ─── energy_value_id → realtime column mapping ─── */
const ENERGY_VALUE_FIELD: Record<number, string> = {
    1: 'import_kwhr', 22: 'import_kwhr',   // kWh
    2: 'kw_3ph',     23: 'kw_3ph',         // kW
    3: 'kva_3ph',    24: 'kva_3ph',        // kVA
    4: 'kvar_3ph',   25: 'kvar_3ph',       // kVAR
    5: 'hz',         26: 'hz',             // Frequency
    6: 'vl1',        27: 'vl1',            // Volt P1
    7: 'vl2',        28: 'vl2',            // Volt P2
    8: 'vl3',        29: 'vl3',            // Volt P3
    9: 'vl12',       30: 'vl12',           // Volt L1 (L-L)
    10: 'vl23',      31: 'vl23',           // Volt L2
    11: 'vl31',      32: 'vl31',           // Volt L3
    12: 'il1',       33: 'il1',            // Amp P1
    13: 'il2',       34: 'il2',            // Amp P2
    14: 'il3',       35: 'il3',            // Amp P3
    15: 'pf1',       36: 'pf1',            // PF P1
    16: 'pf2',       37: 'pf2',            // PF P2
    17: 'pf3',       38: 'pf3',            // PF P3
};

interface AlarmConfig {
    alarm_config_id: number;
    meter_id: number;
    energy_value_id: number | null;
    alarm_type: string;       // 'offline' | 'threshold'
    lower_value: number | null;
    higher_value: number | null;
    lower_message: string | null;
    higher_message: string | null;
    offline_timeout_sec: number;
    cooldown_minutes: number;
    last_triggered_at: string | null;
    alarm_group_id: number | null;
    // joined
    meter_code: string;
    meter_name: string;
    telegram_token: string | null;
    telegram_chat_id: string | null;
    group_name: string | null;
    energy_value_name: string | null;
}

const fmtDate = (d: Date) =>
    d.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

export class AlertEngine {
    private timer?: NodeJS.Timeout;
    private running = false;

    start(): void {
        console.log('🔔 Alert Engine started (check every 60s)');
        // Run first check after 30s (let other services boot)
        setTimeout(() => {
            this.tick().catch(err => console.error('❌ Alert Engine initial tick failed:', err.message));
        }, 30_000);

        this.timer = setInterval(() => {
            this.tick().catch(err => console.error('❌ Alert Engine tick failed:', err.message));
        }, 60_000);
    }

    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }

    private async tick(): Promise<void> {
        if (this.running) return;
        this.running = true;
        try {
            const configs = await this.loadActiveConfigs();
            if (configs.length === 0) { this.running = false; return; }

            const offlineConfigs = configs.filter(c => c.alarm_type === 'offline');
            const thresholdConfigs = configs.filter(c => c.alarm_type === 'threshold');

            if (offlineConfigs.length > 0) await this.checkOffline(offlineConfigs);
            if (thresholdConfigs.length > 0) await this.checkThreshold(thresholdConfigs);
        } catch (err: any) {
            console.error('❌ Alert Engine error:', err.message);
        } finally {
            this.running = false;
        }
    }

    /* ─── Load all active alarm configs with joined info ─── */
    private async loadActiveConfigs(): Promise<AlarmConfig[]> {
        const result = await query(`
            SELECT ac.*,
                   m.meter_code, m.meter_name,
                   ag.telegram_token, ag.telegram_chat_id, ag.group_name,
                   ev.energy_value_name
            FROM alarm_config ac
            LEFT JOIN meter m ON ac.meter_id = m.meter_id
            LEFT JOIN alarm_group ag ON ac.alarm_group_id = ag.alarm_group_id AND ag.is_active = true
            LEFT JOIN energy_value ev ON ac.energy_value_id = ev.energy_value_id
            WHERE ac.is_active = true
        `);
        return result.rows;
    }

    /* ─── OFFLINE DETECTION ─── */
    private async checkOffline(configs: AlarmConfig[]): Promise<void> {
        const meterIds = [...new Set(configs.map(c => c.meter_id))];
        if (meterIds.length === 0) return;

        // Get latest received_at for each meter from realtime data
        const result = await query(`
            SELECT m.meter_id, r.received_at
            FROM meter m
            JOIN LATERAL (
                SELECT r2.received_at FROM meter_data_realtime r2
                WHERE r2.site_id = m.site_el AND r2.address_id = m.address::int
                ORDER BY r2.received_at DESC LIMIT 1
            ) r ON true
            WHERE m.meter_id = ANY($1)
        `, [meterIds]);

        const lastSeen = new Map<number, Date>();
        for (const row of result.rows) {
            lastSeen.set(row.meter_id, new Date(row.received_at));
        }

        const now = new Date();
        for (const cfg of configs) {
            const lastTs = lastSeen.get(cfg.meter_id);
            const timeoutMs = (cfg.offline_timeout_sec || 60) * 1000;

            // Check if meter is offline
            const isOffline = !lastTs || (now.getTime() - lastTs.getTime() > timeoutMs);
            if (!isOffline) continue;

            // Check cooldown
            if (this.inCooldown(cfg, now)) continue;

            // Fire alert
            const agoSec = lastTs ? Math.round((now.getTime() - lastTs.getTime()) / 1000) : -1;
            const msg =
                `🔴 <b>OFFLINE ALERT</b>\n` +
                `Meter: <b>[${cfg.meter_code}]</b> ${cfg.meter_name}\n` +
                `สถานะ: ไม่ได้รับข้อมูลมากกว่า ${cfg.offline_timeout_sec} วินาที\n` +
                (lastTs ? `ข้อมูลล่าสุด: ${fmtDate(lastTs)} (${agoSec}s ago)\n` : `ข้อมูลล่าสุด: ไม่มี\n`) +
                `🕒 ${fmtDate(now)}`;

            await this.fireAlert(cfg, 'offline', msg, now);
        }
    }

    /* ─── THRESHOLD CHECK ─── */
    private async checkThreshold(configs: AlarmConfig[]): Promise<void> {
        const meterIds = [...new Set(configs.map(c => c.meter_id))];
        if (meterIds.length === 0) return;

        // Get latest realtime data for each meter
        const result = await query(`
            SELECT m.meter_id, r.*
            FROM meter m
            JOIN LATERAL (
                SELECT r2.* FROM meter_data_realtime r2
                WHERE r2.site_id = m.site_el AND r2.address_id = m.address::int
                ORDER BY r2.received_at DESC LIMIT 1
            ) r ON true
            WHERE m.meter_id = ANY($1)
        `, [meterIds]);

        const meterData = new Map<number, any>();
        for (const row of result.rows) {
            meterData.set(row.meter_id, row);
        }

        const now = new Date();
        for (const cfg of configs) {
            if (!cfg.energy_value_id) continue;
            const data = meterData.get(cfg.meter_id);
            if (!data) continue;

            const fieldName = ENERGY_VALUE_FIELD[cfg.energy_value_id];
            if (!fieldName) continue;

            const value = parseFloat(data[fieldName]);
            if (isNaN(value)) continue;

            // Check lower bound
            if (cfg.lower_value !== null && value < cfg.lower_value) {
                if (this.inCooldown(cfg, now)) continue;
                const msg =
                    `⚠️ <b>THRESHOLD ALERT — ต่ำกว่าขั้นต่ำ</b>\n` +
                    `Meter: <b>[${cfg.meter_code}]</b> ${cfg.meter_name}\n` +
                    `ค่า: ${cfg.energy_value_name} = <b>${value.toFixed(2)}</b>\n` +
                    `ขั้นต่ำ: ${Number(cfg.lower_value).toFixed(2)}\n` +
                    (cfg.lower_message ? `📝 ${cfg.lower_message}\n` : '') +
                    `🕒 ${fmtDate(now)}`;
                await this.fireAlert(cfg, 'threshold_low', msg, now);
                continue;
            }

            // Check upper bound
            if (cfg.higher_value !== null && value > cfg.higher_value) {
                if (this.inCooldown(cfg, now)) continue;
                const msg =
                    `🔺 <b>THRESHOLD ALERT — เกินขั้นสูง</b>\n` +
                    `Meter: <b>[${cfg.meter_code}]</b> ${cfg.meter_name}\n` +
                    `ค่า: ${cfg.energy_value_name} = <b>${value.toFixed(2)}</b>\n` +
                    `ขั้นสูง: ${Number(cfg.higher_value).toFixed(2)}\n` +
                    (cfg.higher_message ? `📝 ${cfg.higher_message}\n` : '') +
                    `🕒 ${fmtDate(now)}`;
                await this.fireAlert(cfg, 'threshold_high', msg, now);
            }
        }
    }

    /* ─── COOLDOWN CHECK ─── */
    private inCooldown(cfg: AlarmConfig, now: Date): boolean {
        if (!cfg.last_triggered_at) return false;
        const lastFired = new Date(cfg.last_triggered_at);
        const cooldownMs = (cfg.cooldown_minutes || 5) * 60 * 1000;
        return (now.getTime() - lastFired.getTime()) < cooldownMs;
    }

    /* ─── FIRE ALERT: Send Telegram + Write alarm_log + Update last_triggered_at ─── */
    private async fireAlert(cfg: AlarmConfig, alarmType: string, message: string, now: Date): Promise<void> {
        // 1) Send Telegram (if configured)
        const token = (cfg.telegram_token || '').trim();
        const chatId = (cfg.telegram_chat_id || '').trim();
        let telegramSent = false;
        if (token && chatId) {
            try {
                const res = await sendTelegramMessage(token, chatId, message);
                telegramSent = res.ok;
                if (!res.ok) {
                    console.warn(`⚠️ Alert Telegram failed [${cfg.alarm_config_id}]: ${res.description}`);
                }
            } catch (err: any) {
                console.warn(`⚠️ Alert Telegram error [${cfg.alarm_config_id}]: ${err.message}`);
            }
        } else {
            console.warn(`⚠️ Alert [${cfg.alarm_config_id}] has no Telegram config — skipping notification`);
        }

        // 2) Write alarm_log
        try {
            await query(`
                INSERT INTO alarm_log (alarm_config_id, meter_id, alarm_type, message, occurred_at, acknowledged, metadata)
                VALUES ($1, $2, $3, $4, $5, false, $6)
            `, [
                cfg.alarm_config_id,
                cfg.meter_id,
                alarmType,
                message.replace(/<[^>]*>/g, ''),  // strip HTML for log
                now.toISOString(),
                JSON.stringify({ telegram_sent: telegramSent, group: cfg.group_name || null }),
            ]);
        } catch (err: any) {
            console.error(`❌ Alert log write failed [${cfg.alarm_config_id}]:`, err.message);
        }

        // 3) Update last_triggered_at
        try {
            await query(`UPDATE alarm_config SET last_triggered_at = $1 WHERE alarm_config_id = $2`,
                [now.toISOString(), cfg.alarm_config_id]);
        } catch (err: any) {
            console.error(`❌ Alert update last_triggered_at failed:`, err.message);
        }

        console.log(`🔔 Alert fired [${cfg.alarm_config_id}] type=${alarmType} meter=${cfg.meter_code} telegram=${telegramSent}`);
    }

    /* ─── Manual trigger (for API endpoint) ─── */
    async manualCheck(): Promise<{ checked: number; alerts: number }> {
        const configs = await this.loadActiveConfigs();
        const logBefore = await query('SELECT COUNT(*)::int AS cnt FROM alarm_log');
        const before = logBefore.rows[0].cnt;

        const offlineConfigs = configs.filter(c => c.alarm_type === 'offline');
        const thresholdConfigs = configs.filter(c => c.alarm_type === 'threshold');
        if (offlineConfigs.length > 0) await this.checkOffline(offlineConfigs);
        if (thresholdConfigs.length > 0) await this.checkThreshold(thresholdConfigs);

        const logAfter = await query('SELECT COUNT(*)::int AS cnt FROM alarm_log');
        const after = logAfter.rows[0].cnt;

        return { checked: configs.length, alerts: after - before };
    }
}

export const alertEngine = new AlertEngine();
