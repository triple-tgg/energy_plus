import React, { createContext, useContext, useState, useEffect } from 'react';

export type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<Theme>(() => {
        return (localStorage.getItem('ec-theme') as Theme) || 'light';
    });

    const toggleTheme = () => {
        setThemeState((prev) => {
            const next = prev === 'light' ? 'dark' : 'light';
            localStorage.setItem('ec-theme', next);
            return next;
        });
    };

    const setTheme = (t: Theme) => {
        setThemeState(t);
        localStorage.setItem('ec-theme', t);
    };

    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'ec-theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
                setThemeState(e.newValue);
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
