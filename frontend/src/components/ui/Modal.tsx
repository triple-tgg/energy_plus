import React, { useEffect, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, "Cascadia Mono", monospace';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    theme?: 'light' | 'dark';
}

const THEMES = {
    light: {
        bg: '#EAE7DA', panel: '#FBFAF4', panel2: '#F1EFE3', ink: '#23261E', sub: '#6E705F',
        line: '#D4D1C0', bar: '#23261E', barSub: '#A6A892', accent: '#2B4C7E',
    },
    dark: {
        bg: '#0E1116', panel: '#161B22', panel2: '#1C232E', ink: '#E6EDF3', sub: '#8B98A6',
        line: '#2A313C', bar: '#080A0E', barSub: '#8B98A6', accent: '#36C2CE',
    },
};

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, size = 'md', theme }) => {
    const overlayRef = useRef<HTMLDivElement>(null);
    const { theme: globalTheme } = useTheme();
    const activeTheme = theme || globalTheme;
    const C = THEMES[activeTheme];

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        if (isOpen) {
            document.addEventListener('keydown', handleEsc);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const widths = { sm: 400, md: 560, lg: 780, xl: 1100 };

    return (
        <div style={{
            position: 'fixed', inset: 0,
            background: activeTheme === 'light' ? 'rgba(35, 38, 30, 0.5)' : 'rgba(8, 10, 14, 0.7)',
            backdropFilter: 'blur(3px)',
            display: 'grid', placeItems: 'center', padding: '16px', zIndex: 1060
        }} ref={overlayRef} onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}>
            <div style={{
                background: C.panel,
                width: '100%',
                maxWidth: widths[size],
                border: `2px solid ${C.ink}`,
                borderRadius: 0,
                boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '90vh'
            }}>
                {/* Header */}
                <div style={{
                    padding: '12px 16px',
                    background: C.bar,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: `1px solid ${C.line}`
                }}>
                    <h3 style={{ margin: 0, fontFamily: MONO, fontSize: '13px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>{title}</h3>
                    <button onClick={onClose} style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#fff',
                        fontSize: '20px',
                        lineHeight: 1,
                        cursor: 'pointer',
                        padding: '0 4px',
                    }}>&times;</button>
                </div>

                {/* Body */}
                <div style={{ padding: '18px 20px', overflowY: 'auto', color: C.ink }}>
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div style={{
                        padding: '12px 16px',
                        background: C.panel2,
                        borderTop: `1px solid ${C.line}`,
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '8px'
                    }}>
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Modal;
