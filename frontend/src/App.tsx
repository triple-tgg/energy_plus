import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/auth/LoginPage';

// Admin pages
import CompanyPage from './pages/admin/CompanyPage';
import GroupsPage from './pages/admin/GroupsPage';
import UsersPage from './pages/admin/UsersPage';
import SitesPage from './pages/admin/SitesPage';
import BuildingsPage from './pages/admin/BuildingsPage';

// Master pages
import MeterTypesPage from './pages/master/MeterTypesPage';
import BrandsPage from './pages/master/BrandsPage';
import LoopsPage from './pages/master/LoopsPage';
import MetersPage from './pages/master/MetersPage';

// Settings pages
import AlarmGroupsPage from './pages/settings/AlarmGroupsPage';
import AlarmConfigsPage from './pages/settings/AlarmConfigsPage';
import BillingPage from './pages/settings/BillingPage';
import DemandPage from './pages/settings/DemandPage';

// Monitoring
import RealtimePage from './pages/monitoring/RealtimePage';

// Dashboard
import ZoneDashboard from './pages/dashboard/ZoneDashboard';

// Placeholder
import PlaceholderPage from './pages/PlaceholderPage';

const App: React.FC = () => {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route element={<MainLayout />}>
                        {/* Admin */}
                        <Route path="/admin/company" element={<CompanyPage />} />
                        <Route path="/admin/groups" element={<GroupsPage />} />
                        <Route path="/admin/users" element={<UsersPage />} />
                        <Route path="/admin/sites" element={<SitesPage />} />
                        <Route path="/admin/buildings" element={<BuildingsPage />} />

                        {/* Master Data */}
                        <Route path="/master/types" element={<MeterTypesPage />} />
                        <Route path="/master/brands" element={<BrandsPage />} />
                        <Route path="/master/loops" element={<LoopsPage />} />
                        <Route path="/master/meters" element={<MetersPage />} />

                        {/* Settings */}
                        <Route path="/settings/alarm-groups" element={<AlarmGroupsPage />} />
                        <Route path="/settings/alarm-configs" element={<AlarmConfigsPage />} />
                        <Route path="/settings/billing" element={<BillingPage />} />
                        <Route path="/settings/demand" element={<DemandPage />} />

                        {/* Monitoring */}
                        <Route path="/monitoring/realtime" element={<RealtimePage />} />

                        {/* Reports */}
                        <Route path="/reports/energy" element={<PlaceholderPage title="Energy Consumption Report" icon="📊" />} />
                        <Route path="/reports/comparison" element={<PlaceholderPage title="Energy Comparison Report" icon="📈" />} />
                        <Route path="/reports/alarms" element={<PlaceholderPage title="Alarm History Report" icon="🔔" />} />

                        {/* Dashboard */}
                        <Route path="/dashboard/zone" element={<ZoneDashboard />} />
                        <Route path="/dashboard/mdb" element={<PlaceholderPage title="MDB Consumption Dashboard" icon="⚡" />} />
                        <Route path="/dashboard/demand" element={<PlaceholderPage title="Demand Dashboard" icon="📈" />} />
                        <Route path="/dashboard/consumption" element={<PlaceholderPage title="Consumption Table" icon="📋" />} />

                        {/* Default */}
                        <Route path="/" element={<Navigate to="/admin/company" replace />} />
                    </Route>
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
};

export default App;
