import { query } from '../../config/database';
import { parsePagination } from '../../utils/pagination';
import { AppError } from '../../middleware/errorHandler';
import { sendTelegramMessage, getTelegramChats } from '../../utils/telegram';

export class AlarmsService {
    // Alarm Configs
    async getAlarmConfigs(queryParams: any) {
        const { page, limit, offset } = parsePagination(queryParams);

        // Ensure schedule columns exist (safe migration)
        await query(`ALTER TABLE alarm_config ADD COLUMN IF NOT EXISTS active_days JSONB DEFAULT '[0,1,2,3,4,5,6]'`);
        await query(`ALTER TABLE alarm_config ADD COLUMN IF NOT EXISTS active_time_start VARCHAR(5) DEFAULT NULL`);
        await query(`ALTER TABLE alarm_config ADD COLUMN IF NOT EXISTS active_time_end VARCHAR(5) DEFAULT NULL`);

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

    // ดึง alarm log ล่าสุดที่ยังไม่ acknowledge (สำหรับ web notification)
    async getRecentAlerts(sinceMinutes: number = 5) {
        const result = await query(`
            SELECT al.*, m.meter_code, m.meter_name
            FROM alarm_log al
            LEFT JOIN meter m ON al.meter_id = m.meter_id
            WHERE al.acknowledged = false
              AND al.occurred_at >= NOW() - ($1 || ' minutes')::interval
            ORDER BY al.occurred_at DESC
            LIMIT 20
        `, [sinceMinutes]);
        return result.rows;
    }
}
