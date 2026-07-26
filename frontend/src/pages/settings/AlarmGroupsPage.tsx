import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { alarmsApi } from '../../api/client';
import { useLanguage } from '../../contexts/LanguageContext';

interface GroupForm {
    groupName: string;
    email: string;
    telegramToken: string;
    telegramChatId: string;
    isActive: boolean;
}

const emptyForm: GroupForm = { groupName: '', email: '', telegramToken: '', telegramChatId: '', isActive: true };

const AlarmGroupsPage: React.FC = () => {
    const { t } = useLanguage();
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<GroupForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const [showDelete, setShowDelete] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [testingId, setTestingId] = useState<number | null>(null);
    const [showHowTo, setShowHowTo] = useState(false);
    const [detecting, setDetecting] = useState(false);
    const [detectedChats, setDetectedChats] = useState<{ id: number; title: string; type: string }[]>([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await alarmsApi.getGroups({ page, limit });
            setData(res.data.data || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [page, limit]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { if (successMsg) { const t = setTimeout(() => setSuccessMsg(''), 3000); return () => clearTimeout(t); } }, [successMsg]);

    const handleCreate = () => { setEditId(null); setForm(emptyForm); setFormError(''); setDetectedChats([]); setShowModal(true); };

    const handleEdit = (row: any) => {
        setEditId(row.alarm_group_id);
        setForm({
            groupName: row.group_name || '',
            email: row.email || '',
            telegramToken: row.telegram_token || '',
            telegramChatId: row.telegram_chat_id || '',
            isActive: row.is_active ?? true,
        });
        setFormError('');
        setDetectedChats([]);
        setShowModal(true);
    };

    const handleDetectChats = async () => {
        if (!form.telegramToken.trim()) { setFormError(t('กรุณากรอก Telegram Token ก่อนดึง Chat ID', 'Enter the Telegram Token before detecting Chat ID')); return; }
        setDetecting(true); setFormError('');
        try {
            const res = await alarmsApi.detectChats(form.telegramToken.trim());
            const chats = res.data.data || [];
            setDetectedChats(chats);
            if (chats.length === 0) {
                setFormError(t('ไม่พบกลุ่ม/แชท — เพิ่มบอทเข้ากลุ่มแล้วพิมพ์ข้อความในกลุ่ม 1 ครั้ง จากนั้นกดใหม่', 'No chats found — add the bot to the group, send one message there, then try again'));
            } else {
                // Auto-select: prefer group/supergroup, otherwise first chat
                const groupChat = chats.find((c: any) => c.type === 'group' || c.type === 'supergroup');
                const autoChat = groupChat || chats[0];
                setForm(prev => ({ ...prev, telegramChatId: String(autoChat.id) }));
            }
        } catch (err: any) {
            setFormError(err.response?.data?.message || t('ดึง Chat ID ไม่สำเร็จ', 'Failed to detect Chat ID'));
        }
        setDetecting(false);
    };

    const selectChat = (chatId: number) => {
        setForm(prev => ({ ...prev, telegramChatId: String(chatId) }));
    };

    const handleSave = async () => {
        if (!form.groupName.trim()) { setFormError(t('กรุณาระบุชื่อกลุ่ม', 'Group name is required')); return; }
        setSaving(true); setFormError('');
        try {
            if (editId) {
                await alarmsApi.updateGroup(editId, form);
                setSuccessMsg(t('อัปเดตกลุ่มการแจ้งเตือนสำเร็จ!', 'Updated alarm group successfully!'));
            } else {
                await alarmsApi.createGroup(form);
                setSuccessMsg(t('สร้างกลุ่มการแจ้งเตือนสำเร็จ!', 'Created alarm group successfully!'));
            }
            setShowModal(false); fetchData();
        } catch (err: any) { setFormError(err.response?.data?.message || t('บันทึกไม่สำเร็จ', 'Save failed')); }
        setSaving(false);
    };

    const handleTest = async (row: any) => {
        setTestingId(row.alarm_group_id);
        try {
            await alarmsApi.testGroup(row.alarm_group_id);
            setSuccessMsg(t(`ส่งข้อความทดสอบไปยัง "${row.group_name}" สำเร็จ! ตรวจสอบใน Telegram`, `Test message sent to "${row.group_name}"! Check Telegram`));
        } catch (err: any) {
            alert(err.response?.data?.message || t('ส่งข้อความทดสอบไม่สำเร็จ', 'Test message failed'));
        }
        setTestingId(null);
    };

    const handleDeleteClick = (row: any) => { setDeleteTarget(row); setShowDelete(true); };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await alarmsApi.deleteGroup(deleteTarget.alarm_group_id);
            setSuccessMsg(t('ลบกลุ่มการแจ้งเตือนสำเร็จ!', 'Deleted alarm group successfully!'));
            setShowDelete(false); setDeleteTarget(null); fetchData();
        } catch (err: any) { alert(err.response?.data?.message || t('ลบไม่สำเร็จ', 'Delete failed')); }
        setDeleting(false);
    };

    const columns = [
        { key: 'group_name', title: t('ชื่อกลุ่ม', 'Group Name') },
        { key: 'email', title: t('อีเมล', 'Email') },
        { key: 'telegram_chat_id', title: t('Telegram Chat ID', 'Telegram Chat ID') },
        {
            key: 'is_active', title: t('สถานะ', 'Status'),
            render: (v: boolean) => (
                <span className={`badge ${v ? 'badge-success' : 'badge-danger'}`}>
                    {v ? t('ใช้งาน', 'Active') : t('ปิดใช้งาน', 'Inactive')}
                </span>
            ),
        },
        {
            key: 'actions', title: t('การจัดการ', 'Actions'),
            render: (_: any, row: any) => (
                <div className="table-actions">
                    <button className="btn btn-outline btn-sm" onClick={() => handleTest(row)} disabled={testingId === row.alarm_group_id} title={t('ส่งข้อความทดสอบไปยัง Telegram', 'Send a test message to Telegram')}>
                        {testingId === row.alarm_group_id ? t('⏳ กำลังส่ง...', '⏳ Sending...') : t('✈️ ทดสอบ Telegram', '✈️ Test Telegram')}
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => handleEdit(row)}>{t('✏️ แก้ไข', '✏️ Edit')}</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteClick(row)}>{t('🗑️ ลบ', '🗑️ Delete')}</button>
                </div>
            ),
        },
    ];

    const stepBox: React.CSSProperties = { display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px dashed var(--border)' };
    const stepNum: React.CSSProperties = { flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: 'var(--accent, #2B4C7E)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 };
    const code: React.CSSProperties = { fontFamily: 'ui-monospace, Menlo, monospace', background: 'var(--surface-2, rgba(127,127,127,0.12))', padding: '1px 6px', borderRadius: 4, fontSize: 12 };

    return (
        <div>
            {successMsg && <div className="toast-success">✅ {successMsg}</div>}

            {/* How-to: สร้างบอท Telegram ผ่าน BotFather */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, marginBottom: 16, overflow: 'hidden', background: 'var(--surface, #fff)' }}>
                <button
                    onClick={() => setShowHowTo(v => !v)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)', fontWeight: 700, fontSize: 14 }}
                >
                    <span style={{ fontSize: 18 }}>✈️</span>
                    <span>{t('วิธีสร้างบอท Telegram (BotFather) และเชื่อมการแจ้งเตือน', 'How to create a Telegram bot (BotFather) & connect notifications')}</span>
                    <span style={{ marginLeft: 'auto', transition: 'transform .2s', transform: showHowTo ? 'rotate(180deg)' : 'none' }}>▾</span>
                </button>

                {showHowTo && (
                    <div style={{ padding: '4px 18px 16px' }}>
                        <div style={stepBox}>
                            <span style={stepNum}>1</span>
                            <div>{t('เปิดแอป Telegram ค้นหา ', 'Open Telegram and search for ')}<b>@BotFather</b>{t(' (มีเครื่องหมายติ๊กฟ้า) แล้วกดเริ่มแชท', ' (blue checkmark), then start the chat')}</div>
                        </div>
                        <div style={stepBox}>
                            <span style={stepNum}>2</span>
                            <div>{t('พิมพ์ ', 'Send ')}<span style={code}>/newbot</span>{t(' → ตั้งชื่อบอท และตั้ง username (ต้องลงท้ายด้วย ', ' → set a bot name and a username (must end with ')}<span style={code}>bot</span>{t(')', ')')}</div>
                        </div>
                        <div style={stepBox}>
                            <span style={stepNum}>3</span>
                            <div>{t('BotFather จะส่ง ', 'BotFather sends the ')}<b>{t('โทเคนบอต (Bot Token)', 'Bot Token')}</b>{t(' กลับมา — คัดลอกเก็บไว้ (เช่น ', ' back — copy it (e.g. ')}<span style={code}>123456789:AAE...xyz</span>{t(')', ')')}</div>
                        </div>
                        <div style={stepBox}>
                            <span style={stepNum}>4</span>
                            <div>{t('กด ', 'Click ')}<b>{t('“เพิ่มกลุ่ม”', '“Add Group”')}</b>{t(' ด้านล่าง แล้ววาง Token ในช่อง ', ' below, then paste the token into the ')}<b>Telegram Token</b>{t(' (ตั้งค่าในแอปได้เลย ไม่ต้องแก้ไฟล์)', ' field (configured right in the app — no file editing)')}</div>
                        </div>
                        <div style={stepBox}>
                            <span style={stepNum}>5</span>
                            <div>{t('สร้าง/เปิดกลุ่ม Telegram แล้ว ', 'Create/open your Telegram group, then ')}<b>{t('เพิ่มบอทเข้ากลุ่ม', 'add the bot to the group')}</b>{t(' (ให้สิทธิ์ส่งข้อความ)', ' (allow it to send messages)')}</div>
                        </div>
                        <div style={stepBox}>
                            <span style={stepNum}>6</span>
                            <div>
                                {t('พิมพ์ข้อความอะไรก็ได้ในกลุ่ม 1 ครั้ง แล้วในฟอร์มกดปุ่ม ', 'Send any message in the group once, then in the form click ')}<b>{t('“🔍 ดึง Chat ID อัตโนมัติ”', '“🔍 Detect Chat ID”')}</b>{t(' → เลือกกลุ่มที่พบ ระบบจะเติม Chat ID ให้เอง', ' → pick the detected group and the Chat ID fills in automatically')}</div>
                        </div>
                        <div style={{ ...stepBox, borderBottom: 'none' }}>
                            <span style={stepNum}>7</span>
                            <div>{t('กด ', 'Click ')}<b>{t('“เพิ่มกลุ่ม”', '“Add Group”')}</b>{t(' กรอก Chat ID (และ Token ถ้าจำเป็น) บันทึก แล้วกดปุ่ม ', ', enter the Chat ID (and Token if needed), save, then click ')}<b>{t('“✈️ ทดสอบ Telegram”', '“✈️ Test Telegram”')}</b>{t(' — ต้องเห็นข้อความเด้งในกลุ่ม', ' — you should see a message appear in the group')}</div>
                        </div>
                        <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--surface-2, rgba(43,76,126,0.08))', borderLeft: '3px solid var(--accent, #2B4C7E)', borderRadius: 6, fontSize: 12.5 }}>
                            💡 {t('เคล็ดลับ: อยากใช้บอทตัวเดียวหลายกลุ่มก็ได้ — วาง Bot Token เดียวกันในทุกกลุ่ม แล้วแต่ละกลุ่มใส่ Chat ID ของตัวเอง (ตั้งค่าในแอปทั้งหมด ไม่ต้องรีสตาร์ต)', 'Tip: to reuse one bot for many groups, paste the same Bot Token in each group and give each its own Chat ID — all configured in-app, no restart needed')}
                        </div>
                    </div>
                )}
            </div>

            <DataTable title={t('กลุ่มการแจ้งเตือน', 'Alarm Groups')} columns={columns} data={data} total={total} page={page} limit={limit} loading={loading} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} onCreate={handleCreate} createLabel={t('เพิ่มกลุ่ม', 'Add Group')} />

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? t('แก้ไขกลุ่มการแจ้งเตือน', 'Edit Alarm Group') : t('เพิ่มกลุ่มการแจ้งเตือน', 'Add Alarm Group')} size="md"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>{t('ยกเลิก', 'Cancel')}</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('กำลังบันทึก...', 'Saving...') : editId ? t('อัปเดต', 'Update') : t('สร้าง', 'Create')}</button></div>}
            >
                {formError && <div className="form-error-banner">{formError}</div>}
                <div className="form-group">
                    <label className="form-label">{t('ชื่อกลุ่ม', 'Group Name')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input type="text" className="form-control" placeholder={t('เช่น ทีมซ่อมบำรุง', 'e.g. Maintenance Team')} value={form.groupName} onChange={e => setForm({ ...form, groupName: e.target.value })} autoFocus />
                </div>
                <div className="form-group">
                    <label className="form-label">{t('อีเมล', 'Email')}</label>
                    <input type="email" className="form-control" placeholder="email@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label">{t('Telegram Token', 'Telegram Token')}</label>
                    <input type="text" className="form-control" placeholder={t('เช่น 123456789:AAE...xyz', 'e.g. 123456789:AAE...xyz')} value={form.telegramToken} onChange={e => setForm({ ...form, telegramToken: e.target.value })} />
                    <small style={{ color: 'var(--text-muted)' }}>{t('Bot Token จาก @BotFather (จำเป็นสำหรับส่งแจ้งเตือน)', 'Bot Token from @BotFather (required to send notifications)')}</small>
                </div>
                <div className="form-group">
                    <label className="form-label">{t('Telegram Chat ID', 'Telegram Chat ID')}</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input type="text" className="form-control" style={{ flex: 1 }} placeholder={t('เช่น -1001234567890', 'e.g. -1001234567890')} value={form.telegramChatId} onChange={e => setForm({ ...form, telegramChatId: e.target.value })} />
                        <button type="button" className="btn btn-outline" style={{ whiteSpace: 'nowrap' }} onClick={handleDetectChats} disabled={detecting}>
                            {detecting ? t('⏳ กำลังดึง...', '⏳ Detecting...') : t('🔍 ดึง Chat ID อัตโนมัติ', '🔍 Detect Chat ID')}
                        </button>
                    </div>
                    <small style={{ color: 'var(--text-muted)' }}>{t('เพิ่มบอทเข้ากลุ่ม + พิมพ์ข้อความในกลุ่ม 1 ครั้ง แล้วกด “ดึง Chat ID อัตโนมัติ”', 'Add the bot to the group + send one message there, then click “Detect Chat ID”')}</small>

                    {detectedChats.length > 0 && (
                        <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                            <div style={{ padding: '6px 10px', fontSize: 12, fontWeight: 700, background: 'var(--surface-2, rgba(127,127,127,0.1))' }}>
                                {t('เลือกกลุ่ม/แชทที่พบ', 'Select a detected chat')} ({detectedChats.length})
                            </div>
                            {detectedChats.map(chat => {
                                const selected = String(chat.id) === form.telegramChatId;
                                return (
                                    <button
                                        key={chat.id}
                                        type="button"
                                        onClick={() => selectChat(chat.id)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                                            padding: '8px 10px', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer',
                                            background: selected ? 'var(--accent, #2B4C7E)' : 'transparent', color: selected ? '#fff' : 'var(--text)',
                                        }}
                                    >
                                        <span>{chat.type === 'private' ? '👤' : '👥'}</span>
                                        <span style={{ flex: 1 }}>{chat.title}</span>
                                        <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, opacity: selected ? 0.9 : 0.6 }}>{chat.id}</span>
                                        {selected && <span>✓</span>}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--success)' }} />
                        {t('เปิดใช้งาน', 'Active')}
                    </label>
                </div>
            </Modal>

            <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title={t('ยืนยันการลบ', 'Confirm Delete')} size="sm"
                footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => setShowDelete(false)} disabled={deleting}>{t('ยกเลิก', 'Cancel')}</button><button className="btn btn-danger" onClick={handleDeleteConfirm} disabled={deleting}>{deleting ? t('กำลังลบ...', 'Deleting...') : t('ลบ', 'Delete')}</button></div>}
            >
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                    <p style={{ fontSize: 16, marginBottom: 8 }}>{t('ต้องการลบกลุ่มการแจ้งเตือน', 'Delete alarm group')}</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>"{deleteTarget?.group_name}"</p>
                </div>
            </Modal>
        </div>
    );
};

export default AlarmGroupsPage;
