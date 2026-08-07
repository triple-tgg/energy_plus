import nodemailer from 'nodemailer';

export interface EmailSendResult {
    ok: boolean;
    messageId?: string;
    description?: string;
}

const smtpPort = Number(process.env.SMTP_PORT || 587);

const createTransport = () => nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: process.env.SMTP_SECURE
        ? ['true', '1', 'yes', 'on'].includes(process.env.SMTP_SECURE.toLowerCase())
        : smtpPort === 465,
    auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || '' }
        : undefined,
});

export const isEmailConfigured = (): boolean => Boolean(
    process.env.SMTP_HOST && (process.env.SMTP_FROM || process.env.SMTP_USER)
);

export async function sendAlertEmail(to: string, subject: string, message: string): Promise<EmailSendResult> {
    if (!isEmailConfigured()) {
        return { ok: false, description: 'SMTP is not configured' };
    }

    try {
        const text = message.replace(/<[^>]*>/g, '');
        const html = message.replace(/\n/g, '<br>');
        const info = await createTransport().sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to,
            subject,
            text,
            html,
        });
        return { ok: true, messageId: info.messageId };
    } catch (error: any) {
        return { ok: false, description: error.message || 'Unknown email error' };
    }
}
