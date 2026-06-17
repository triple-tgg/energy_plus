import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { Sun, Moon, User, Lock, Eye, EyeOff, Terminal, ShieldAlert } from 'lucide-react';

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, "Cascadia Mono", monospace';

const THEMES = {
    light: {
        bg: '#EAE7DA', panel: '#FBFAF4', panel2: '#F1EFE3', ink: '#23261E', sub: '#6E705F',
        line: '#D4D1C0', bar: '#23261E', barSub: '#A6A892', accent: '#2B4C7E',
        gridColor: 'rgba(43, 76, 126, 0.04)', gridColorBold: 'rgba(43, 76, 126, 0.1)',
        red: '#dc2626'
    },
    dark: {
        bg: '#0E1116', panel: '#161B22', panel2: '#1C232E', ink: '#E6EDF3', sub: '#8B98A6',
        line: '#2A313C', bar: '#080A0E', barSub: '#8B98A6', accent: '#36C2CE',
        gridColor: 'rgba(54, 194, 206, 0.03)', gridColorBold: 'rgba(54, 194, 206, 0.08)',
        red: '#f85149'
    },
};

const LoginPage: React.FC = () => {
    const { login, isAuthenticated } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPw, setShowPw] = useState(false);

    if (isAuthenticated) return <Navigate to="/admin/company" replace />;

    const C = THEMES[theme] || THEMES.dark;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(username, password);
            navigate('/admin/company');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    // Blueprint grid styling
    const containerStyle = {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: C.bg,
        backgroundImage: `
            linear-gradient(to right, ${C.gridColorBold} 1px, transparent 1px),
            linear-gradient(to bottom, ${C.gridColorBold} 1px, transparent 1px),
            linear-gradient(to right, ${C.gridColor} 1px, transparent 1px),
            linear-gradient(to bottom, ${C.gridColor} 1px, transparent 1px)
        `,
        backgroundSize: '100px 100px, 100px 100px, 20px 20px, 20px 20px',
        position: 'relative' as const,
        overflow: 'hidden',
        fontFamily: MONO,
        transition: 'all 0.2s ease-in-out',
    };

    const cardStyle = {
        width: '420px',
        maxWidth: '92%',
        background: C.panel,
        border: `2px solid ${C.line}`,
        borderTop: `6px solid ${C.accent}`,
        borderRadius: 0,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
        zIndex: 2,
    };

    const headerStyle = {
        background: C.bar,
        color: '#fff',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: `2px solid ${C.line}`,
        fontSize: '11px',
        letterSpacing: '1.5px',
        fontWeight: 700,
    };

    const inputWrapStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 12px',
        background: C.panel2,
        border: `1px solid ${C.line}`,
        borderRadius: 0,
        transition: 'border-color 0.2s ease',
    };

    const inputStyle = {
        flex: 1,
        border: 'none',
        outline: 'none',
        background: 'none',
        padding: '12px 0',
        fontSize: '14px',
        color: C.ink,
        fontFamily: MONO,
    };

    const buttonStyle = {
        width: '100%',
        padding: '12px',
        background: C.accent,
        color: theme === 'dark' ? '#0E1116' : '#ffffff',
        border: 'none',
        borderRadius: 0,
        fontSize: '15px',
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: MONO,
        marginTop: '8px',
        letterSpacing: '0.5px',
        transition: 'opacity 0.2s ease',
    };

    return (
        <div style={containerStyle}>
            {/* Corner theme switcher */}
            <button
                type="button"
                onClick={toggleTheme}
                style={{
                    position: 'absolute',
                    top: 24,
                    right: 24,
                    background: C.panel,
                    border: `1px solid ${C.line}`,
                    color: C.ink,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '1px',
                    fontFamily: MONO,
                    borderRadius: 0,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                }}
            >
                {theme === 'dark' ? (
                    <>
                        <Sun size={14} style={{ color: C.accent }} /> LIGHT MODE
                    </>
                ) : (
                    <>
                        <Moon size={14} style={{ color: C.accent }} /> DARK MODE
                    </>
                )}
            </button>

            {/* Login console block */}
            <div style={cardStyle}>
                <div style={headerStyle}>
                    <Terminal size={14} style={{ color: C.accent }} />
                    <span>SYSTEM // AUTHENTICATION GATEWAY</span>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '32px 28px' }}>
                    {/* Brand display */}
                    <div style={{ textAlign: 'center', marginBottom: 28 }}>
                        <h1 style={{ fontSize: '24px', fontWeight: 800, color: C.ink, margin: 0, letterSpacing: '1px' }}>
                            [ <span style={{ color: C.accent }}>MAC</span> ENERGY ]
                        </h1>
                        <p style={{ fontSize: '10px', color: C.sub, marginTop: 4, letterSpacing: '0.5px' }}>
                            SMART ENERGY MONITORING CONSOLE
                        </p>
                    </div>

                    {/* Error display */}
                    {error && (
                        <div style={{
                            display: 'flex',
                            gap: 10,
                            background: C.panel2,
                            border: `1px solid ${C.line}`,
                            borderLeft: `4px solid ${C.red}`,
                            color: C.red,
                            padding: '10px 14px',
                            fontSize: '12px',
                            marginBottom: 20,
                            lineHeight: 1.4,
                        }}>
                            <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Username field */}
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: C.sub, marginBottom: 6, letterSpacing: '1px' }}>
                            USER IDENTIFICATION
                        </label>
                        <div style={inputWrapStyle}>
                            <User size={16} style={{ color: C.sub }} />
                            <input
                                type="text"
                                placeholder="Enter username"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                required
                                autoFocus
                                style={inputStyle}
                            />
                        </div>
                    </div>

                    {/* Password field */}
                    <div style={{ marginBottom: 24 }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: C.sub, marginBottom: 6, letterSpacing: '1px' }}>
                            ACCESS CREDENTIAL
                        </label>
                        <div style={inputWrapStyle}>
                            <Lock size={16} style={{ color: C.sub }} />
                            <input
                                type={showPw ? 'text' : 'password'}
                                placeholder="Enter password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                style={inputStyle}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPw(!showPw)}
                                tabIndex={-1}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: C.sub,
                                    padding: '4px',
                                    display: 'flex',
                                }}
                            >
                                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button type="submit" disabled={loading} style={buttonStyle}>
                        {loading ? 'INITIALIZING ACCESS...' : 'SECURE SIGN IN'}
                    </button>

                    <p style={{ textAlign: 'center', fontSize: '9px', color: C.sub, marginTop: 24, margin: '24px 0 0 0' }}>
                        © 2026 MAC Energy // ACCESS AUDITED
                    </p>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;

