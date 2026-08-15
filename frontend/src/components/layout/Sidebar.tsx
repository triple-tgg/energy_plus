import React, { useState, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import {
    Settings, Building2, Users, User, MapPin, Construction,
    Package, Plug, Tag, RefreshCw, Zap,
    Wrench, Bell, AlertTriangle, Coins, TrendingDown, Map, Upload, Trash2,
    Radio, BarChart3, Network, Activity,
    FileText, BarChartBig, History, GitCompare, Clock,
    LayoutDashboard, MapPinned, Gauge, Table,
    type LucideIcon,
} from 'lucide-react';
import logo from '../../assets/logo.jpg';

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
        titleEn: 'Dashboards',
        titleTh: 'แดชบอร์ด',
        icon: LayoutDashboard,
        items: [
            { labelEn: 'Meter Dashboard', labelTh: 'แดชบอร์ดมิเตอร์', path: '/dashboard/zone', icon: MapPinned, permissionKey: 'dashboard' },
            { labelEn: 'MDB Dashboard', labelTh: 'แดชบอร์ด MDB', path: '/dashboard/mdb', icon: Gauge, permissionKey: 'dashboard' },
            { labelEn: 'Demand Dashboard', labelTh: 'แดชบอร์ดดีมานด์พีค', path: '/dashboard/demand', icon: TrendingDown, permissionKey: 'dashboard' },
        ],
    },
    {
        titleEn: 'Monitoring',
        titleTh: 'การตรวจสอบระบบ',
        icon: Radio,
        items: [
            { labelEn: 'Realtime Data', labelTh: 'ข้อมูลเรียลไทม์', path: '/monitoring/realtime', icon: Activity, permissionKey: 'monitoring' },
            { labelEn: 'Layout Diagram', labelTh: 'แผนผังระบบไฟฟ้า', path: '/monitoring/layout', icon: Network, permissionKey: 'monitoring' },
            // { labelEn: 'Demand Peak Forecast', labelTh: 'คาดการณ์ดีมานด์สูงสุด', path: '/monitoring/demand-peak', icon: Zap, permissionKey: 'monitoring' },
        ],
    },
    {
        titleEn: 'Reports',
        titleTh: 'รายงาน',
        icon: FileText,
        items: [
            { labelEn: 'Consumption Report', labelTh: 'รายงานการใช้พลังงาน', path: '/reports/consumption', icon: Table, permissionKey: 'reports' },
            { labelEn: 'Energy Report', labelTh: 'รายงานการใช้พลังงาน', path: '/reports/energy', icon: BarChartBig, permissionKey: 'reports' },
            { labelEn: 'TOU Report', labelTh: 'รายงาน TOU', path: '/reports/tou', icon: Clock, permissionKey: 'reports' },
            { labelEn: 'Monthly Comparison', labelTh: 'รายงานเปรียบเทียบรายเดือน', path: '/reports/comparison', icon: GitCompare, permissionKey: 'reports' },
            { labelEn: 'Historical Report', labelTh: 'รายงานข้อมูลย้อนหลัง', path: '/reports/history', icon: History, permissionKey: 'reports' },
            { labelEn: 'Alarm Reports', labelTh: 'รายงานการแจ้งเตือน', path: '/reports/alarms', icon: Clock, permissionKey: 'reports' },
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
            { labelEn: 'Data Cleanup', labelTh: 'ล้างข้อมูล Realtime', path: '/settings/data-cleanup', icon: Trash2, permissionKey: 'settings' },
        ],
    },
    {
        titleEn: 'Master Data',
        titleTh: 'ข้อมูลหลัก',
        icon: Package,
        items: [
            { labelEn: 'Meter Types', labelTh: 'ประเภทมิเตอร์', path: '/master/types', icon: Plug, permissionKey: 'meters' },
            { labelEn: 'Models', labelTh: 'รุ่นมิเตอร์', path: '/master/brands', icon: Tag, permissionKey: 'meters' },
            { labelEn: 'Loops', labelTh: 'วงจรการจ่ายไฟ', path: '/master/loops', icon: RefreshCw, permissionKey: 'meters' },
            { labelEn: 'Meters', labelTh: 'มิเตอร์', path: '/master/meters', icon: Zap, permissionKey: 'meters' },
        ],
    },
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
];

interface SidebarProps {
    collapsed: boolean;
    mobileOpen: boolean;
    onToggle: () => void;
    onNavigate: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, mobileOpen, onToggle, onNavigate }) => {
    const location = useLocation();
    const { theme } = useTheme();
    const { user } = useAuth();
    const { t } = useLanguage();
    const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

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

    const toggleGroup = (titleEn: string) => {
        setOpenGroups(prev => {
            const next = new Set(prev);
            if (next.has(titleEn)) next.delete(titleEn);
            else next.add(titleEn);
            return next;
        });
    };

    return (
        <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''} ${mobileOpen ? 'sidebar--mobile-open' : ''}`}>
            {/* Logo */}
            <div className="sidebar-brand">
                <div className="sidebar-brand__icon">
                    <img src={logo} alt="M Soft" className="sidebar-brand__logo" />
                </div>
                {!collapsed && (
                    <div className="sidebar-brand__text">
                        <span className="sidebar-brand__name">M <span>Soft</span></span>
                        <span className="sidebar-brand__sub">Energy Monitoring</span>
                    </div>
                )}
                <button className="sidebar-hamburger" onClick={onToggle} title={collapsed ? t('เปิดเมนู', 'Open menu') : t('ยุบเมนู', 'Collapse menu')}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                        <line x1="4" y1="6" x2="20" y2="6" />
                        <line x1="4" y1="12" x2="20" y2="12" />
                        <line x1="4" y1="18" x2="20" y2="18" />
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
                                            onClick={onNavigate}
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
                    <span>v2.0 — M Soft</span>
                </div>
            )}
        </aside>
    );
};

export default Sidebar;
