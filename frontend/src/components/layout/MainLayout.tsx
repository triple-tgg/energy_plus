import React from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../../contexts/AuthContext';

const MainLayout: React.FC = () => {
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="app-loader">
                <div className="app-loader__spinner" />
                <p>Loading MAC Energy...</p>
            </div>
        );
    }

    if (!isAuthenticated) return <Navigate to="/login" replace />;

    return (
        <div className="app">
            <Sidebar />
            <div className="app__main">
                <Header />
                <main className="app__content" key={location.pathname}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
