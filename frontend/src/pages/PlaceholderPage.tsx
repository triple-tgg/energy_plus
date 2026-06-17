import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { LayoutGrid, Cpu } from 'lucide-react';

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, "Cascadia Mono", monospace';

const THEMES = {
    light: {
        bg: '#EAE7DA', panel: '#FBFAF4', panel2: '#F1EFE3', ink: '#23261E', sub: '#6E705F',
        line: '#D4D1C0', bar: '#23261E', barSub: '#A6A892', accent: '#2B4C7E',
        gridColor: 'rgba(43, 76, 126, 0.06)', gridColorBold: 'rgba(43, 76, 126, 0.15)',
    },
    dark: {
        bg: '#0E1116', panel: '#161B22', panel2: '#1C232E', ink: '#E6EDF3', sub: '#8B98A6',
        line: '#2A313C', bar: '#080A0E', barSub: '#8B98A6', accent: '#36C2CE',
        gridColor: 'rgba(54, 194, 206, 0.05)', gridColorBold: 'rgba(54, 194, 206, 0.12)',
    },
};

const PlaceholderPage: React.FC<{ title: string; icon?: string }> = ({ title, icon = '🔌' }) => {
    const { theme } = useTheme();
    const { t } = useLanguage();
    const C = THEMES[theme] || THEMES.dark;

    // Grid CSS for the blueprint aesthetic
    const gridStyle = {
        backgroundImage: `
            linear-gradient(to right, ${C.gridColorBold} 1px, transparent 1px),
            linear-gradient(to bottom, ${C.gridColorBold} 1px, transparent 1px),
            linear-gradient(to right, ${C.gridColor} 1px, transparent 1px),
            linear-gradient(to bottom, ${C.gridColor} 1px, transparent 1px)
        `,
        backgroundSize: '100px 100px, 100px 100px, 20px 20px, 20px 20px',
        backgroundColor: C.panel,
        border: `1px solid ${C.line}`,
        borderRadius: 0,
        position: 'relative' as const,
        minHeight: '400px',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        overflow: 'hidden',
    };

    return (
        <div>
            {/* Command bar */}
            <div style={{ background: C.bar, color: '#fff', display: 'flex', alignItems: 'stretch', borderBottom: `2px solid ${C.accent}`, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}>
                        <Cpu size={16} />
                    </div>
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>{t('การเฝ้าระวัง // แผนผังระบบไฟฟ้า', 'MONITORING // SINGLE LINE DIAGRAM')}</div>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>{t('ผังระบบไฟฟ้าและเส้นทางการจ่ายพลังงาน (Single Line Diagram)', 'Electrical single line diagram and energy distribution paths')}</div>
                    </div>
                </div>
            </div>

            <div style={gridStyle}>
                {/* Visual draft representation */}
                <div style={{ 
                    border: `2px dashed ${C.accent}`, 
                    padding: '24px 36px', 
                    background: C.panel2, 
                    color: C.ink, 
                    maxWidth: '600px',
                    width: '100%',
                    textAlign: 'center',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    zIndex: 1
                }}>
                    <div style={{ fontSize: 48, marginBottom: 16, animation: 'pulse 2s infinite' }}>{icon}</div>
                    <h2 style={{ fontSize: 18, fontFamily: MONO, fontWeight: 700, marginBottom: 8, color: C.accent }}>
                        {t('[ อยู่ระหว่างการวาดผังระบบ ]', '[ SCHEMA DRAWING IN PROGRESS ]')}
                    </h2>
                    <div style={{ 
                        fontFamily: MONO, 
                        fontSize: 12, 
                        color: C.sub, 
                        marginBottom: 20, 
                        padding: '10px', 
                        border: `1px solid ${C.line}`,
                        background: C.panel,
                        textAlign: 'left'
                    }}>
                        <div style={{ color: C.accent, fontWeight: 'bold' }}>{t('// ข้อมูลระบบ:', '// SYSTEM SPECIFICATIONS:')}</div>
                        <div>PATH: /monitoring/layout</div>
                        <div>{t('ส่วนประกอบ: เครื่องมือแสดงผังทางเดินไฟฟ้า', 'COMPONENT: Single Line Diagram Visualizer')}</div>
                        <div>{t('สถานะ: กำลังออกแบบ / เชื่อมโยงแผนผัง', 'STATUS: DRAFTING / LAYOUT INTEGRATION')}</div>
                        <div>{t('เวอร์ชัน: 2.0.0-BETA', 'VERSION: 2.0.0-BETA')}</div>
                    </div>

                    <p style={{ color: C.ink, fontSize: 14, marginBottom: 0 }}>
                        {t('หน้าจอแสดงผังทางเดินไฟฟ้าและอุปกรณ์จ่ายไฟของอาคาร อยู่ระหว่างการพัฒนาระบบเชื่อมต่อแผนผังแบบเรียลไทม์', 'The electrical schematic and building power distribution layout page is currently under development for real-time monitoring integration.')}
                    </p>
                </div>

                {/* Decorative retro elements in the grid corner */}
                <div style={{ 
                    position: 'absolute', 
                    bottom: 12, 
                    right: 12, 
                    fontFamily: MONO, 
                    fontSize: 9, 
                    color: C.sub, 
                    pointerEvents: 'none',
                    textAlign: 'right'
                }}>
                    ENERGY PLUS INDUSTRIES © 2026<br />
                    {t('ความละเอียดกริด: 20px', 'GRID RESOLUTION: 20px')} // ACCENT: {C.accent}
                </div>
            </div>
        </div>
    );
};

export default PlaceholderPage;

