import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'th' | 'en';

interface LanguageContextType {
    language: Language;
    setLanguage: (l: Language) => void;
    toggleLanguage: () => void;
    t: (th: string, en: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>(() => {
        return (localStorage.getItem('ec-lang') as Language) || 'en'; // default to en
    });

    const setLanguage = (l: Language) => {
        setLanguageState(l);
        localStorage.setItem('ec-lang', l);
    };

    const toggleLanguage = () => {
        setLanguageState((prev) => {
            const next = prev === 'th' ? 'en' : 'th';
            localStorage.setItem('ec-lang', next);
            return next;
        });
    };

    const t = (th: string, en: string) => {
        return language === 'th' ? th : en;
    };

    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'ec-lang' && (e.newValue === 'th' || e.newValue === 'en')) {
                setLanguageState(e.newValue);
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    return (
        <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
