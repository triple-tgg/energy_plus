/**
 * Telegram Bot API helper — ส่งข้อความแจ้งเตือนเข้ากลุ่ม Telegram
 * ใช้ global fetch (Node 18+)
 */

export interface TelegramSendResult {
    ok: boolean;
    description?: string;
    messageId?: number;
}

/**
 * ส่งข้อความไปยัง chat/group ผ่าน Telegram Bot API
 * @param token   Bot token (จาก @BotFather)
 * @param chatId  Chat ID ปลายทาง (กลุ่มขึ้นต้นด้วย -100...)
 * @param text    ข้อความ (รองรับ HTML)
 */
export async function sendTelegramMessage(
    token: string,
    chatId: string,
    text: string,
): Promise<TelegramSendResult> {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
            }),
            signal: controller.signal,
        });
        clearTimeout(timer);
        const data: any = await resp.json().catch(() => ({}));
        return {
            ok: Boolean(data?.ok),
            description: data?.description,
            messageId: data?.result?.message_id,
        };
    } catch (err: any) {
        return { ok: false, description: err?.name === 'AbortError' ? 'Request timed out' : (err?.message || 'Network error') };
    }
}

export interface TelegramChat {
    id: number;
    title: string;
    type: string;
}

/**
 * ดึงรายชื่อแชท/กลุ่มที่บอทเห็นล่าสุดผ่าน getUpdates (ใช้เติม Chat ID อัตโนมัติ)
 * หมายเหตุ: บอทจะเห็นกลุ่มก็ต่อเมื่อถูกเพิ่มเข้ากลุ่มและมีข้อความเข้ามาในช่วง ~24 ชม.
 */
export async function getTelegramChats(
    token: string,
): Promise<{ ok: boolean; description?: string; chats: TelegramChat[] }> {
    const url = `https://api.telegram.org/bot${token}/getUpdates?limit=100&timeout=0`;
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        const data: any = await resp.json().catch(() => ({}));
        if (!data?.ok) {
            return { ok: false, description: data?.description || `HTTP ${resp.status}`, chats: [] };
        }
        const map = new Map<number, TelegramChat>();
        for (const upd of data.result || []) {
            const src = upd.message || upd.edited_message || upd.channel_post
                || upd.edited_channel_post || upd.my_chat_member || upd.chat_member;
            const chat = src?.chat;
            if (chat && chat.id != null && !map.has(chat.id)) {
                const title = chat.title
                    || chat.username
                    || [chat.first_name, chat.last_name].filter(Boolean).join(' ')
                    || String(chat.id);
                map.set(chat.id, { id: chat.id, title, type: chat.type });
            }
        }
        return { ok: true, chats: Array.from(map.values()) };
    } catch (err: any) {
        return {
            ok: false,
            description: err?.name === 'AbortError' ? 'Request timed out' : (err?.message || 'Network error'),
            chats: [],
        };
    }
}
