import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

interface NavGroup {
    title: string;
    icon: string;
    items: { label: string; path: string; icon: string }[];
}

const navGroups: NavGroup[] = [
    {
        title: 'ผู้ดูแลระบบ',
        icon: '⚙',
        items: [
            { label: 'ข้อมูลบริษัท', path: '/admin/company', icon: '🏢' },
            { label: 'กลุ่มผู้ใช้', path: '/admin/groups', icon: '👥' },
            { label: 'ผู้ใช้งาน', path: '/admin/users', icon: '👤' },
            { label: 'สถานที่', path: '/admin/sites', icon: '📍' },
            { label: 'อาคาร', path: '/admin/buildings', icon: '🏗' },
        ],
    },
    {
        title: 'ข้อมูลหลัก',
        icon: '📦',
        items: [
            { label: 'ประเภทมิเตอร์', path: '/master/types', icon: '🔌' },
            { label: 'ยี่ห้อ', path: '/master/brands', icon: '🏷' },
            { label: 'ลูป', path: '/master/loops', icon: '🔄' },
            { label: 'มิเตอร์', path: '/master/meters', icon: '⚡' },
        ],
    },
    {
        title: 'ตั้งค่า',
        icon: '🔧',
        items: [
            { label: 'กลุ่มแจ้งเตือน', path: '/settings/alarm-groups', icon: '🔔' },
            { label: 'ตั้งค่าแจ้งเตือน', path: '/settings/alarm-configs', icon: '⚠' },
            { label: 'อัตราค่าไฟ', path: '/settings/billing', icon: '💰' },
            { label: 'ดีมานด์ / ประหยัด', path: '/settings/demand', icon: '📉' },
            { label: 'ตั้งค่าภาพแผนผัง', path: '/settings/layouts', icon: '🗺' },
            { label: 'ตั้งค่าการ Export', path: '/settings/export', icon: '📤' },
        ],
    },
    {
        title: 'ตรวจสอบ',
        icon: '📡',
        items: [
            { label: 'ข้อมูลเรียลไทม์', path: '/monitoring/realtime', icon: '📊' },
            { label: 'สายทาง', path: '/monitoring/layout', icon: '🔌' },
            { label: 'พยากรณ์ Demand Peak', path: '/monitoring/demand-peak', icon: '⚡' },
        ],
    },
    {
        title: 'รายงาน',
        icon: '📄',
        items: [
            { label: 'พลังงานตามช่วงเวลา', path: '/reports/energy', icon: '📈' },
            { label: 'ข้อมูลพลังงานย้อนหลัง', path: '/reports/history', icon: '📜' },
            { label: 'เปรียบเทียบเดือนก่อน', path: '/reports/comparison', icon: '🔀' },
            { label: 'ข้อมูลการแจ้งเตือน', path: '/reports/alarms', icon: '🕐' },
        ],
    },
    {
        title: 'แดชบอร์ด',
        icon: '📊',
        items: [
            { label: 'การใช้พลังงานตามโซน', path: '/dashboard/zone', icon: '🗺' },
            { label: 'การใช้พลังงาน MDB', path: '/dashboard/mdb', icon: '⚡' },
            { label: 'ดีมานด์', path: '/dashboard/demand', icon: '📉' },
            { label: 'ตารางการใช้พลังงาน', path: '/dashboard/consumption', icon: '📋' },
        ],
    },
];

const Sidebar: React.FC = () => {
    const location = useLocation();
    const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(navGroups.map(g => g.title)));
    const [collapsed, setCollapsed] = useState(false);

    const toggleGroup = (title: string) => {
        setOpenGroups(prev => {
            const next = new Set(prev);
            if (next.has(title)) next.delete(title);
            else next.add(title);
            return next;
        });
    };

    return (
        <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
            {/* Logo */}
            <div className="sidebar-brand">
                <div className="sidebar-brand__icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                </div>
                {!collapsed && (
                    <div className="sidebar-brand__text">
                        <span className="sidebar-brand__name">MAC <span>Energy</span></span>
                        <span className="sidebar-brand__sub">Energy Monitoring</span>
                    </div>
                )}
                <button
                    className="sidebar-toggle"
                    onClick={() => setCollapsed(!collapsed)}
                    title={collapsed ? 'Expand' : 'Collapse'}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
            </div>

            {/* Nav */}
            <nav className="sidebar-nav">
                {navGroups.map(group => (
                    <div key={group.title} className="sidebar-section">
                        <button
                            className="sidebar-section__title"
                            onClick={() => toggleGroup(group.title)}
                        >
                            {!collapsed && <span>{group.title}</span>}
                            {!collapsed && (
                                <svg
                                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                    style={{ transition: 'transform 0.25s', transform: openGroups.has(group.title) ? 'rotate(180deg)' : 'rotate(0)' }}
                                >
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                            )}
                        </button>
                        <div className={`sidebar-section__items ${openGroups.has(group.title) ? 'sidebar-section__items--open' : ''}`}>
                            {group.items.map(item => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    className={({ isActive }) =>
                                        `sidebar-link ${isActive ? 'sidebar-link--active' : ''}`
                                    }
                                    title={item.label}
                                >
                                    <span className="sidebar-link__icon">{item.icon}</span>
                                    {!collapsed && <span className="sidebar-link__label">{item.label}</span>}
                                </NavLink>
                            ))}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Footer */}
            {!collapsed && (
                <div className="sidebar-footer">
                    <span>v2.0 — MAC Energy</span>
                </div>
            )}
        </aside>
    );
};

export default Sidebar;
