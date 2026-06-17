import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AccessDeniedPage from '../../pages/AccessDeniedPage';

interface ProtectedRouteProps {
    permissionKey: string;
    children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ permissionKey, children }) => {
    const { user } = useAuth();

    if (!user?.permissions?.includes(permissionKey)) {
        return <AccessDeniedPage />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;
