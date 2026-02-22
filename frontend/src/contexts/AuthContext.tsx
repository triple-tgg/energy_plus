import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authApi } from '../api/client';

interface User {
    userId: number;
    userName: string;
    displayName: string;
    email: string;
    group: string;
    groupId: number;
    permissions: string[];
    sites: { siteId: number; siteName: string }[];
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const stored = localStorage.getItem('user');
        const token = localStorage.getItem('accessToken');
        if (stored && token) {
            try { setUser(JSON.parse(stored)); } catch { /* ignore */ }
        }
        setIsLoading(false);
    }, []);

    const login = async (username: string, password: string) => {
        const res = await authApi.login({ username, password });
        const { accessToken, refreshToken, user: u } = res.data.data;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('user', JSON.stringify(u));
        setUser(u);
    };

    const logout = () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
