import React from 'react';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, "Cascadia Mono", monospace';

interface LoadingScreenProps {
    /** Optional message to display */
    message?: string;
    /** Inline mode: shows inside a container instead of full page */
    inline?: boolean;
    /** Theme colors */
    theme?: 'light' | 'dark';
}

/**
 * Shared loading screen component.
 * - Full page: covers the entire content area with a centered spinner
 * - Inline: shows as a padded block within a parent container
 */
export function LoadingScreen({ message, inline = false, theme = 'dark' }: LoadingScreenProps) {
    const { t } = useLanguage();
    const displayMessage = message || t('กำลังโหลดข้อมูล...', 'Loading data...');

    const isDark = theme === 'dark';
    const bg = isDark ? '#0E1116' : '#EAE7DA';
    const panelBg = isDark ? '#161B22' : '#FBFAF4';
    const borderColor = isDark ? '#2A313C' : '#D4D1C0';
    const textColor = isDark ? '#8B98A6' : '#6E705F';
    const accentColor = isDark ? '#36C2CE' : '#2B4C7E';

    const content = (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: inline ? '40px 20px' : '0',
            minHeight: inline ? undefined : '60vh',
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 48,
                height: 48,
                border: `2px solid ${borderColor}`,
                background: panelBg,
                animation: 'ec-loading-pulse 1.5s ease-in-out infinite',
            }}>
                <Loader2 size={22} color={accentColor} style={{ animation: 'ec-loading-spin 1s linear infinite' }} />
            </div>
            <div style={{
                fontFamily: MONO,
                fontSize: 12,
                letterSpacing: 1.5,
                color: textColor,
                textTransform: 'uppercase',
            }}>
                {displayMessage}
            </div>
            <div style={{
                width: 120,
                height: 2,
                background: borderColor,
                overflow: 'hidden',
                position: 'relative',
            }}>
                <div style={{
                    width: '40%',
                    height: '100%',
                    background: accentColor,
                    animation: 'ec-loading-bar 1.2s ease-in-out infinite',
                }} />
            </div>

            {/* CSS animations injected inline */}
            <style>{`
                @keyframes ec-loading-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes ec-loading-pulse {
                    0%, 100% { opacity: 0.7; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.05); }
                }
                @keyframes ec-loading-bar {
                    0% { transform: translateX(-100%); }
                    50% { transform: translateX(150%); }
                    100% { transform: translateX(350%); }
                }
            `}</style>
        </div>
    );

    if (inline) {
        return (
            <div style={{
                background: panelBg,
                border: `1px solid ${borderColor}`,
                width: '100%',
            }}>
                {content}
            </div>
        );
    }

    return (
        <div style={{
            width: '100%',
            minHeight: '60vh',
            background: bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            {content}
        </div>
    );
}

export default LoadingScreen;
