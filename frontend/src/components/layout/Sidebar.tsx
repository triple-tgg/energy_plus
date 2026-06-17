import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import {
    Settings, Building2, Users, User, MapPin, Construction,
    Package, Plug, Tag, RefreshCw, Zap,
    Wrench, Bell, AlertTriangle, Coins, TrendingDown, Map, Upload,
    Radio, BarChart3, Network, Activity,
    FileText, BarChartBig, History, GitCompare, Clock,
    LayoutDashboard, MapPinned, Gauge, Table,
    type LucideIcon,
} from 'lucide-react';

interface NavItem {
    label: string;
    path: string;
    icon: LucideIcon;
}

interface NavGroup {
    title: string;
    icon: LucideIcon;
    items: NavItem[];
}

const navGroups: NavGroup[] = [
    {
        title: 'ผู้ดูแลระบบ',
        icon: Settings,
        items: [
            { label: 'ข้อมูลบริษัท', path: '/admin/company', icon: Building2 },
            { label: 'กลุ่มผู้ใช้', path: '/admin/groups', icon: Users },
            { label: 'ผู้ใช้งาน', path: '/admin/users', icon: User },
            { label: 'สถานที่', path: '/admin/sites', icon: MapPin },
            { label: 'อาคาร', path: '/admin/buildings', icon: Construction },
        ],
    },
    {
        title: 'ข้อมูลหลัก',
        icon: Package,
        items: [
            { label: 'ประเภทมิเตอร์', path: '/master/types', icon: Plug },
            { label: 'ยี่ห้อ', path: '/master/brands', icon: Tag },
            { label: 'ลูป', path: '/master/loops', icon: RefreshCw },
            { label: 'มิเตอร์', path: '/master/meters', icon: Zap },
        ],
    },
    {
        title: 'ตั้งค่า',
        icon: Wrench,
        items: [
            { label: 'กลุ่มแจ้งเตือน', path: '/settings/alarm-groups', icon: Bell },
            { label: 'ตั้งค่าแจ้งเตือน', path: '/settings/alarm-configs', icon: AlertTriangle },
            { label: 'อัตราค่าไฟ', path: '/settings/billing', icon: Coins },
            { label: 'ดีมานด์ / ประหยัด', path: '/settings/demand', icon: TrendingDown },
            { label: 'ตั้งค่าภาพแผนผัง', path: '/settings/layouts', icon: Map },
            { label: 'ตั้งค่าการ Export', path: '/settings/export', icon: Upload },
        ],
    },
    {
        title: 'ตรวจสอบ',
        icon: Radio,
        items: [
            { label: 'ข้อมูลเรียลไทม์', path: '/monitoring/realtime', icon: Activity },
            { label: 'Single Line Diagram', path: '/monitoring/layout', icon: Network },
            { label: 'พยากรณ์ Demand Peak', path: '/monitoring/demand-peak', icon: Zap },
        ],
    },
    {
        title: 'รายงาน',
        icon: FileText,
        items: [
            { label: 'พลังงานตามช่วงเวลา', path: '/reports/energy', icon: BarChartBig },
            { label: 'ข้อมูลพลังงานย้อนหลัง', path: '/reports/history', icon: History },
            { label: 'เปรียบเทียบเดือนก่อน', path: '/reports/comparison', icon: GitCompare },
            { label: 'ข้อมูลการแจ้งเตือน', path: '/reports/alarms', icon: Clock },
        ],
    },
    {
        title: 'แดชบอร์ด',
        icon: LayoutDashboard,
        items: [
            { label: 'การใช้พลังงานตามโซน', path: '/dashboard/zone', icon: MapPinned },
            { label: 'การใช้พลังงาน MDB', path: '/dashboard/mdb', icon: Gauge },
            { label: 'ดีมานด์', path: '/dashboard/demand', icon: TrendingDown },
            { label: 'ตารางการใช้พลังงาน', path: '/dashboard/consumption', icon: Table },
        ],
    },
];

const Sidebar: React.FC = () => {
    const location = useLocation();
    const { theme } = useTheme();
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
                    <span style={{ fontSize: '22px', fontWeight: 800, color: '#dc2626', lineHeight: 1 }}>M</span>
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
                            {group.items.map(item => {
                                const IconComp = item.icon;
                                return (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        className={({ isActive }) =>
                                            `sidebar-link ${isActive ? 'sidebar-link--active' : ''}`
                                        }
                                        title={item.label}
                                    >
                                        <span className="sidebar-link__icon">
                                            <IconComp size={18} strokeWidth={1.8} />
                                        </span>
                                        {!collapsed && <span className="sidebar-link__label">{item.label}</span>}
                                    </NavLink>
                                );
                            })}
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
