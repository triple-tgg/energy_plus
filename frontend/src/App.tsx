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
import LayoutSettingsPage from './pages/settings/LayoutSettingsPage';
import ExportSettingsPage from './pages/settings/ExportSettingsPage';

// Monitoring
import RealtimePage from './pages/monitoring/RealtimePage';
import DemandPeakPage from './pages/monitoring/DemandPeakPage';

// Dashboard
import ZoneDashboard from './pages/dashboard/ZoneDashboard';
import MdbDashboard from './pages/dashboard/MdbDashboard';
import DemandDashboard from './pages/dashboard/DemandDashboard';
import ConsumptionTable from './pages/dashboard/ConsumptionTable';

// Reports
import EnergyReportPage from './pages/reports/EnergyReportPage';
import HistoryReportPage from './pages/reports/HistoryReportPage';
import ComparisonReportPage from './pages/reports/ComparisonReportPage';
import AlarmReportPage from './pages/reports/AlarmReportPage';

// Placeholder (for pages not yet implemented)
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
                        <Route path="/settings/layouts" element={<LayoutSettingsPage />} />
                        <Route path="/settings/export" element={<ExportSettingsPage />} />

                        {/* Monitoring */}
                        <Route path="/monitoring/realtime" element={<RealtimePage />} />
                        <Route path="/monitoring/layout" element={<PlaceholderPage title="สายทาง (Single Line Diagram)" icon="🔌" />} />
                        <Route path="/monitoring/demand-peak" element={<DemandPeakPage />} />

                        {/* Reports */}
                        <Route path="/reports/energy" element={<EnergyReportPage />} />
                        <Route path="/reports/history" element={<HistoryReportPage />} />
                        <Route path="/reports/comparison" element={<ComparisonReportPage />} />
                        <Route path="/reports/alarms" element={<AlarmReportPage />} />

                        {/* Dashboard */}
                        <Route path="/dashboard/zone" element={<ZoneDashboard />} />
                        <Route path="/dashboard/mdb" element={<MdbDashboard />} />
                        <Route path="/dashboard/demand" element={<DemandDashboard />} />
                        <Route path="/dashboard/consumption" element={<ConsumptionTable />} />

                        {/* Default */}
                        <Route path="/" element={<Navigate to="/dashboard/zone" replace />} />
                    </Route>
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
};

export default App;
