import { query } from '../../config/database';
import { parsePagination } from '../../utils/pagination';
import { AppError } from '../../middleware/errorHandler';
import { sendTelegramMessage, getTelegramChats } from '../../utils/telegram';
import { sendAlertEmail } from '../../utils/email';

export class AlarmsService {
    // Alarm Configs
    async getAlarmConfigs(queryParams: any) {
        const { page, limit, offset } = parsePagination(queryParams);

        // Ensure schedule columns exist (safe migration)
        await query(`ALTER TABLE alarm_config ADD COLUMN IF NOT EXISTS active_days JSONB DEFAULT '[0,1,2,3,4,5,6]'`);
        await query(`ALTER TABLE alarm_config ADD COLUMN IF NOT EXISTS active_time_start VARCHAR(5) DEFAULT NULL`);
        await query(`ALTER TABLE alarm_config ADD COLUMN IF NOT EXISTS active_time_end VARCHAR(5) DEFAULT NULL`);
        // Migrate alarm_type 'offline' → 'disconnect' (idempotent)
        await query(`UPDATE alarm_config SET alarm_type = 'disconnect' WHERE alarm_type = 'offline'`);
        await query(`UPDATE alarm_log SET alarm_type = 'disconnect' WHERE alarm_type = 'offline'`);

        const countResult = await query(`SELECT COUNT(*) FROM alarm_config`);
        const total = parseInt(countResult.rows[0].count);
        const result = await query(
            `SELECT ac.*, m.meter_name, m.meter_code, ev.energy_value_name, ag.group_name AS alarm_group_name
       FROM alarm_config ac
       LEFT JOIN meter m ON ac.meter_id = m.meter_id
       LEFT JOIN energy_value ev ON ac.energy_value_id = ev.energy_value_id
       LEFT JOIN alarm_group ag ON ac.alarm_group_id = ag.alarm_group_id
       ORDER BY ac.alarm_config_id LIMIT $1 OFFSET $2`, [limit, offset]
        );
        return { data: result.rows, total, page, limit };
    }
    async createAlarmConfig(data: any) {
        const activeDays = data.activeDays && Array.isArray(data.activeDays) ? JSON.stringify(data.activeDays) : '[0,1,2,3,4,5,6]';
        const result = await query(
            `INSERT INTO alarm_config (meter_id, energy_value_id, lower_value, higher_value, lower_message, is_active, alarm_type, offline_timeout_sec, cooldown_minutes, alarm_group_id, active_days, active_time_start, active_time_end, created_by, created_on)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW()) RETURNING *`,
            [data.meterId, data.energyValueId, data.lowerValue, data.higherValue, data.lowerMessage || data.higherMessage || null, data.isActive ?? true, data.alarmType || 'threshold', data.offlineTimeoutSec ?? 60, data.cooldownMinutes ?? 5, data.alarmGroupId || null, activeDays, data.activeTimeStart || null, data.activeTimeEnd || null, data.createdBy]
        );
        return result.rows[0];
    }
    async updateAlarmConfig(id: number, data: any) {
        const activeDays = data.activeDays && Array.isArray(data.activeDays) ? JSON.stringify(data.activeDays) : '[0,1,2,3,4,5,6]';
        const result = await query(
            `UPDATE alarm_config SET meter_id=$1, energy_value_id=$2, lower_value=$3, higher_value=$4, lower_message=$5, is_active=$6, alarm_type=$7, offline_timeout_sec=$8, cooldown_minutes=$9, alarm_group_id=$10, active_days=$11, active_time_start=$12, active_time_end=$13, last_modified_by=$14, last_modified_on=NOW()
       WHERE alarm_config_id=$15 RETURNING *`,
            [data.meterId, data.energyValueId, data.lowerValue, data.higherValue, data.lowerMessage || data.higherMessage || null, data.isActive, data.alarmType || 'threshold', data.offlineTimeoutSec ?? 60, data.cooldownMinutes ?? 5, data.alarmGroupId || null, activeDays, data.activeTimeStart || null, data.activeTimeEnd || null, data.modifiedBy, id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Alarm config not found');
        return result.rows[0];
    }
    async deleteAlarmConfig(id: number) {
        const result = await query(`DELETE FROM alarm_config WHERE alarm_config_id=$1 RETURNING alarm_config_id`, [id]);
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Alarm config not found');
        return result.rows[0];
    }

    async importAlarmConfigs(rows: any[], createdBy: string) {
        const result = { imported: 0, skipped: 0, errors: [] as { row: number; message: string }[] };
        const toNumber = (value: any): number | null => value === '' || value == null ? null : Number(value);
        const toBoolean = (value: any): boolean => !['false', '0', 'no', 'inactive'].includes(String(value ?? 'true').trim().toLowerCase());

        for (let index = 0; index < rows.length; index++) {
            const row = rows[index];
            const rowNumber = index + 2;
            try {
                const meterCode = String(row.meterCode || '').trim();
                const alarmType = String(row.alarmType || 'threshold').trim().toLowerCase();
                if (!meterCode) throw new Error('Meter Code is required');
                if (!['threshold', 'disconnect'].includes(alarmType)) throw new Error('Alarm Type must be threshold or disconnect');

                const meter = await query(`SELECT meter_id FROM meter WHERE LOWER(meter_code) = LOWER($1) LIMIT 1`, [meterCode]);
                if (!meter.rows.length) throw new Error(`Meter Code not found: ${meterCode}`);
                const meterId = meter.rows[0].meter_id;

                let energyValueId: number | null = null;
                if (alarmType === 'threshold') {
                    const energyValue = String(row.energyValue || '').trim();
                    if (!energyValue) throw new Error('Energy Value is required for threshold alarms');
                    const ev = await query(
                        `SELECT energy_value_id FROM energy_value WHERE LOWER(energy_value_name) = LOWER($1) OR energy_value_id::text = $1 LIMIT 1`,
                        [energyValue]
                    );
                    if (!ev.rows.length) throw new Error(`Energy Value not found: ${energyValue}`);
                    energyValueId = ev.rows[0].energy_value_id;
                }

                let alarmGroupId: number | null = null;
                const groupName = String(row.alarmGroup || '').trim();
                if (groupName) {
                    const group = await query(
                        `SELECT alarm_group_id FROM alarm_group WHERE LOWER(group_name) = LOWER($1) OR alarm_group_id::text = $1 LIMIT 1`,
                        [groupName]
                    );
                    if (!group.rows.length) throw new Error(`Alarm Group not found: ${groupName}`);
                    alarmGroupId = group.rows[0].alarm_group_id;
                }

                const duplicate = await query(
                    `SELECT alarm_config_id FROM alarm_config
                     WHERE meter_id=$1 AND alarm_type=$2 AND energy_value_id IS NOT DISTINCT FROM $3 LIMIT 1`,
                    [meterId, alarmType, energyValueId]
                );
                if (duplicate.rows.length) {
                    result.skipped++;
                    result.errors.push({ row: rowNumber, message: 'Configuration already exists' });
                    continue;
                }

                const activeDays = String(row.activeDays ?? '0,1,2,3,4,5,6')
                    .split(',').map(value => Number(value.trim())).filter(value => Number.isInteger(value) && value >= 0 && value <= 6);
                if (!activeDays.length) throw new Error('Active Days must contain values from 0 to 6');

                const lowerValue = toNumber(row.lowerValue);
                const higherValue = toNumber(row.higherValue);
                const offlineTimeoutSec = toNumber(row.offlineTimeoutSec) ?? 60;
                const cooldownMinutes = toNumber(row.cooldownMinutes) ?? 5;
                if (alarmType === 'threshold' && lowerValue == null && higherValue == null) {
                    throw new Error('At least one of Lower Value or Higher Value is required');
                }
                if (offlineTimeoutSec <= 0 || cooldownMinutes <= 0) throw new Error('Timeout and Cooldown must be greater than zero');

                await this.createAlarmConfig({
                    meterId, energyValueId, lowerValue, higherValue,
                    lowerMessage: String(row.message || '').trim() || null,
                    isActive: toBoolean(row.isActive), alarmType,
                    offlineTimeoutSec, cooldownMinutes, alarmGroupId, activeDays,
                    activeTimeStart: String(row.activeTimeStart || '').trim() || null,
                    activeTimeEnd: String(row.activeTimeEnd || '').trim() || null,
                    createdBy,
                });
                result.imported++;
            } catch (error: any) {
                result.errors.push({ row: rowNumber, message: error.message || 'Import failed' });
            }
        }
        return result;
    }

    // Alarm Groups
    async getAlarmGroups(queryParams: any) {
        const { page, limit, offset } = parsePagination(queryParams);
        const countResult = await query(`SELECT COUNT(*) FROM alarm_group`);
        const total = parseInt(countResult.rows[0].count);
        const result = await query(`SELECT * FROM alarm_group ORDER BY alarm_group_id LIMIT $1 OFFSET $2`, [limit, offset]);
        return { data: result.rows, total, page, limit };
    }
    async createAlarmGroup(data: any) {
        const result = await query(
            `INSERT INTO alarm_group (group_name, email, telegram_token, telegram_chat_id, is_active) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [data.groupName, data.email, data.telegramToken, data.telegramChatId, true]
        );
        return result.rows[0];
    }
    async updateAlarmGroup(id: number, data: any) {
        const result = await query(
            `UPDATE alarm_group SET group_name=$1, email=$2, telegram_token=$3, telegram_chat_id=$4, is_active=$5 WHERE alarm_group_id=$6 RETURNING *`,
            [data.groupName, data.email, data.telegramToken, data.telegramChatId, data.isActive, id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Alarm group not found');
        return result.rows[0];
    }
    async deleteAlarmGroup(id: number) {
        // Remove FK references first
        await query(`UPDATE alarm_config SET alarm_group_id = NULL WHERE alarm_group_id = $1`, [id]);
        await query(`DELETE FROM alarm_group_mapping WHERE alarm_group_id = $1`, [id]);
        const result = await query(`DELETE FROM alarm_group WHERE alarm_group_id=$1 RETURNING alarm_group_id`, [id]);
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Alarm group not found');
        return result.rows[0];
    }

    async getAlarmGroupById(id: number) {
        const result = await query(`SELECT * FROM alarm_group WHERE alarm_group_id=$1`, [id]);
        if (result.rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Alarm group not found');
        return result.rows[0];
    }

    // ── Telegram Notifications ──
    // ส่งข้อความแจ้งเตือนเข้ากลุ่ม Telegram (ใช้ Bot Token ของกลุ่มนั้นๆ)
    async notifyGroup(id: number, message: string) {
        const group = await this.getAlarmGroupById(id);
        const token = String(group.telegram_token || '').trim();
        const chatId = String(group.telegram_chat_id || '').trim();

        if (!token) {
            throw new AppError(400, 'TELEGRAM_NO_TOKEN',
                'กลุ่มนี้ยังไม่ได้ตั้งค่า Telegram Bot Token — กรอกช่อง Telegram Token ก่อน');
        }
        if (!chatId) {
            throw new AppError(400, 'TELEGRAM_NO_CHAT', 'กลุ่มนี้ยังไม่ได้ตั้งค่า Telegram Chat ID');
        }

        const res = await sendTelegramMessage(token, chatId, message);
        if (!res.ok) {
            throw new AppError(502, 'TELEGRAM_SEND_FAILED',
                `ส่งข้อความ Telegram ไม่สำเร็จ: ${res.description || 'unknown error'}`);
        }
        return { sent: true, groupName: group.group_name, chatId, messageId: res.messageId };
    }

    // ดึงรายชื่อกลุ่ม/แชทที่บอทเห็น เพื่อเติม Chat ID อัตโนมัติในฟอร์ม
    async detectTelegramChats(token: string) {
        const tk = String(token || '').trim();
        if (!tk) throw new AppError(400, 'TELEGRAM_NO_TOKEN', 'กรุณากรอก Telegram Bot Token ก่อน');
        const res = await getTelegramChats(tk);
        if (!res.ok) throw new AppError(502, 'TELEGRAM_GETUPDATES_FAILED', `ดึงข้อมูลจาก Telegram ไม่สำเร็จ: ${res.description || 'unknown error'}`);
        return res.chats;
    }

    // ส่งข้อความทดสอบเพื่อตรวจว่าการเชื่อมต่อกลุ่ม Telegram ถูกต้อง
    async sendTestMessage(id: number) {
        const time = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
        const text =
            `🔔 <b>Energy Monitoring</b>\n` +
            `✅ ทดสอบการเชื่อมต่อการแจ้งเตือนสำเร็จ\n` +
            `🕒 ${time}`;
        return this.notifyGroup(id, text);
    }

    async sendTestEmail(id: number) {
        const group = await this.getAlarmGroupById(id);
        const recipients = String(group.email || '').trim();
        if (!recipients) {
            throw new AppError(400, 'EMAIL_NO_RECIPIENT', 'กลุ่มนี้ยังไม่ได้ระบุอีเมลผู้รับ');
        }
        const time = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
        const message = `<b>Energy Monitoring</b>\n✅ ทดสอบการแจ้งเตือนทาง Email สำเร็จ\n🕒 ${time}`;
        const result = await sendAlertEmail(recipients, '[Energy Monitoring] Test notification', message);
        if (!result.ok) {
            throw new AppError(502, 'EMAIL_SEND_FAILED', `ส่ง Email ไม่สำเร็จ: ${result.description}`);
        }
        return { sent: true, groupName: group.group_name, recipients, messageId: result.messageId };
    }

    // ดึง alarm log ล่าสุดที่ยังไม่ acknowledge (สำหรับ web notification)
    async getRecentAlerts(sinceMinutes: number = 5) {
        const result = await query(`
            SELECT al.*, m.meter_code, m.meter_name
            FROM alarm_log al
            JOIN meter m ON al.meter_id = m.meter_id
            WHERE al.acknowledged = false
              AND m.is_active = true
              AND al.occurred_at >= NOW() - ($1 || ' minutes')::interval
            ORDER BY al.occurred_at DESC
            LIMIT 20
        `, [sinceMinutes]);
        return result.rows;
    }

    // ดึงข้อมูลสรุปล่าสุดจาก actual_meter_data สำหรับ meter ที่เลือก
    async getRecentMeterData(meterId: number) {
        const result = await query(`
            SELECT
                date_keep,
                energy_kw, energy_kva, energy_kvar,
                energy_volt_p1, energy_volt_p2, energy_volt_p3,
                energy_amp1, energy_amp2, energy_amp3,
                energy_pf1, energy_pf2, energy_pf3,
                energy_frequency, energy_kwh,
                status
            FROM actual_meter_data
            WHERE meter_id = $1
            ORDER BY date_keep DESC
            LIMIT 5
        `, [meterId]);
        return result.rows;
    }
}
