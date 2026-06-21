import React, { useState, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
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
    labelEn: string;
    labelTh: string;
    path: string;
    icon: LucideIcon;
    permissionKey: string;
}

interface NavGroup {
    titleEn: string;
    titleTh: string;
    icon: LucideIcon;
    items: NavItem[];
}

const navGroups: NavGroup[] = [
    {
        titleEn: 'Administration',
        titleTh: 'การจัดการระบบ',
        icon: Settings,
        items: [
            { labelEn: 'Company Info', labelTh: 'ข้อมูลบริษัท', path: '/admin/company', icon: Building2, permissionKey: 'company' },
            { labelEn: 'User Groups', labelTh: 'กลุ่มผู้ใช้งาน', path: '/admin/groups', icon: Users, permissionKey: 'users' },
            { labelEn: 'Users', labelTh: 'ผู้ใช้งาน', path: '/admin/users', icon: User, permissionKey: 'users' },
            { labelEn: 'Sites', labelTh: 'สถานที่ / สาขา', path: '/admin/sites', icon: MapPin, permissionKey: 'sites' },
            { labelEn: 'Buildings', labelTh: 'อาคาร', path: '/admin/buildings', icon: Construction, permissionKey: 'sites' },
        ],
    },
    {
        titleEn: 'Master Data',
        titleTh: 'ข้อมูลหลัก',
        icon: Package,
        items: [
            { labelEn: 'Meter Types', labelTh: 'ประเภทมิเตอร์', path: '/master/types', icon: Plug, permissionKey: 'meters' },
            { labelEn: 'Brands', labelTh: 'แบรนด์ / ยี่ห้อ', path: '/master/brands', icon: Tag, permissionKey: 'meters' },
            { labelEn: 'Loops', labelTh: 'วงจรการจ่ายไฟ', path: '/master/loops', icon: RefreshCw, permissionKey: 'meters' },
            { labelEn: 'Meters', labelTh: 'มิเตอร์', path: '/master/meters', icon: Zap, permissionKey: 'meters' },
        ],
    },
    {
        titleEn: 'Settings',
        titleTh: 'การตั้งค่า',
        icon: Wrench,
        items: [
            { labelEn: 'Alarm Groups', labelTh: 'กลุ่มแจ้งเตือน', path: '/settings/alarm-groups', icon: Bell, permissionKey: 'alarms' },
            { labelEn: 'Alarm Settings', labelTh: 'ตั้งค่าแจ้งเตือน', path: '/settings/alarm-configs', icon: AlertTriangle, permissionKey: 'alarms' },
            { labelEn: 'Billing Tariffs', labelTh: 'อัตราค่าไฟฟ้า', path: '/settings/billing', icon: Coins, permissionKey: 'billing' },
            { labelEn: 'Demand & Savings', labelTh: 'ดีมานด์ & ประหยัด', path: '/settings/demand', icon: TrendingDown, permissionKey: 'settings' },
            { labelEn: 'Layout Settings', labelTh: 'ตั้งค่าแผนผัง', path: '/settings/layouts', icon: Map, permissionKey: 'settings' },
            { labelEn: 'Export Settings', labelTh: 'ตั้งค่าการ Export', path: '/settings/export', icon: Upload, permissionKey: 'settings' },
        ],
    },
    {
        titleEn: 'Monitoring',
        titleTh: 'การตรวจสอบระบบ',
        icon: Radio,
        items: [
            { labelEn: 'Realtime Data', labelTh: 'ข้อมูลเรียลไทม์', path: '/monitoring/realtime', icon: Activity, permissionKey: 'monitoring' },
            { labelEn: 'Single Line Diagram', labelTh: 'แผนผังระบบไฟฟ้า', path: '/monitoring/layout', icon: Network, permissionKey: 'monitoring' },
            { labelEn: 'Demand Peak Forecast', labelTh: 'คาดการณ์ดีมานด์สูงสุด', path: '/monitoring/demand-peak', icon: Zap, permissionKey: 'monitoring' },
        ],
    },
    {
        titleEn: 'Reports',
        titleTh: 'รายงาน',
        icon: FileText,
        items: [
            { labelEn: 'Energy Report', labelTh: 'รายงานการใช้พลังงาน', path: '/reports/energy', icon: BarChartBig, permissionKey: 'reports' },
            { labelEn: 'Historical Report', labelTh: 'รายงานข้อมูลย้อนหลัง', path: '/reports/history', icon: History, permissionKey: 'reports' },
            { labelEn: 'Monthly Comparison', labelTh: 'รายงานเปรียบเทียบรายเดือน', path: '/reports/comparison', icon: GitCompare, permissionKey: 'reports' },
            { labelEn: 'Alarm Reports', labelTh: 'รายงานการแจ้งเตือน', path: '/reports/alarms', icon: Clock, permissionKey: 'reports' },
        ],
    },
    {
        titleEn: 'Dashboards',
        titleTh: 'แดชบอร์ด',
        icon: LayoutDashboard,
        items: [
            { labelEn: 'Zone Consumption', labelTh: 'ปริมาณการใช้ไฟรายโซน', path: '/dashboard/zone', icon: MapPinned, permissionKey: 'dashboard' },
            { labelEn: 'MDB Consumption', labelTh: 'ปริมาณการใช้ไฟรายตู้ MDB', path: '/dashboard/mdb', icon: Gauge, permissionKey: 'dashboard' },
            { labelEn: 'Demand Dashboard', labelTh: 'แดชบอร์ดดีมานด์พีค', path: '/dashboard/demand', icon: TrendingDown, permissionKey: 'dashboard' },
            { labelEn: 'Consumption Table', labelTh: 'ตารางการใช้พลังงาน', path: '/dashboard/consumption', icon: Table, permissionKey: 'dashboard' },
        ],
    },
];

const Sidebar: React.FC = () => {
    const location = useLocation();
    const { theme } = useTheme();
    const { user } = useAuth();
    const { t } = useLanguage();
    const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(navGroups.map(g => g.titleEn)));

    // Filter nav groups and items based on user permissions
    const filteredNavGroups = useMemo(() => {
        const perms = user?.permissions || [];
        return navGroups
            .map(group => ({
                ...group,
                items: group.items.filter(item => perms.includes(item.permissionKey)),
            }))
            .filter(group => group.items.length > 0);
    }, [user?.permissions]);
    const [collapsed, setCollapsed] = useState(false);

    const toggleGroup = (titleEn: string) => {
        setOpenGroups(prev => {
            const next = new Set(prev);
            if (next.has(titleEn)) next.delete(titleEn);
            else next.add(titleEn);
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
            </div>

            {/* Toggle — separate row below brand */}
            <div className="sidebar-toggle-row">
                <button
                    className="sidebar-toggle"
                    onClick={() => setCollapsed(!collapsed)}
                    title={collapsed ? t('ขยาย', 'Expand') : t('ยุบ', 'Collapse')}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
            </div>

            {/* Nav */}
            <nav className="sidebar-nav">
                {filteredNavGroups.map(group => {
                    const groupTitle = t(group.titleTh, group.titleEn);
                    return (
                        <div key={group.titleEn} className="sidebar-section">
                            <button
                                className="sidebar-section__title"
                                onClick={() => toggleGroup(group.titleEn)}
                            >
                                {!collapsed && <span>{groupTitle}</span>}
                                {!collapsed && (
                                    <svg
                                        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                        style={{ transition: 'transform 0.25s', transform: openGroups.has(group.titleEn) ? 'rotate(180deg)' : 'rotate(0)' }}
                                    >
                                        <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                )}
                            </button>
                            <div className={`sidebar-section__items ${openGroups.has(group.titleEn) ? 'sidebar-section__items--open' : ''}`}>
                                {group.items.map(item => {
                                    const IconComp = item.icon;
                                    const itemLabel = t(item.labelTh, item.labelEn);
                                    return (
                                        <NavLink
                                            key={item.path}
                                            to={item.path}
                                            className={({ isActive }) =>
                                                `sidebar-link ${isActive ? 'sidebar-link--active' : ''}`
                                            }
                                            title={itemLabel}
                                        >
                                            <span className="sidebar-link__icon">
                                                <IconComp size={18} strokeWidth={1.8} />
                                            </span>
                                            {!collapsed && <span className="sidebar-link__label">{itemLabel}</span>}
                                        </NavLink>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
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
