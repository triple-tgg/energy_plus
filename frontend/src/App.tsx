import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
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
import LayoutViewPage from './pages/monitoring/LayoutViewPage';

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
            <ThemeProvider>
                <LanguageProvider>
                    <AuthProvider>
                        <Routes>
                            <Route path="/login" element={<LoginPage />} />
                            <Route element={<MainLayout />}>
                                {/* Admin */}
                                <Route path="/admin/company" element={<ProtectedRoute permissionKey="company"><CompanyPage /></ProtectedRoute>} />
                                <Route path="/admin/groups" element={<ProtectedRoute permissionKey="users"><GroupsPage /></ProtectedRoute>} />
                                <Route path="/admin/users" element={<ProtectedRoute permissionKey="users"><UsersPage /></ProtectedRoute>} />
                                <Route path="/admin/sites" element={<ProtectedRoute permissionKey="sites"><SitesPage /></ProtectedRoute>} />
                                <Route path="/admin/buildings" element={<ProtectedRoute permissionKey="sites"><BuildingsPage /></ProtectedRoute>} />

                                {/* Master Data */}
                                <Route path="/master/types" element={<ProtectedRoute permissionKey="meters"><MeterTypesPage /></ProtectedRoute>} />
                                <Route path="/master/brands" element={<ProtectedRoute permissionKey="meters"><BrandsPage /></ProtectedRoute>} />
                                <Route path="/master/loops" element={<ProtectedRoute permissionKey="meters"><LoopsPage /></ProtectedRoute>} />
                                <Route path="/master/meters" element={<ProtectedRoute permissionKey="meters"><MetersPage /></ProtectedRoute>} />

                                {/* Settings */}
                                <Route path="/settings/alarm-groups" element={<ProtectedRoute permissionKey="alarms"><AlarmGroupsPage /></ProtectedRoute>} />
                                <Route path="/settings/alarm-configs" element={<ProtectedRoute permissionKey="alarms"><AlarmConfigsPage /></ProtectedRoute>} />
                                <Route path="/settings/billing" element={<ProtectedRoute permissionKey="billing"><BillingPage /></ProtectedRoute>} />
                                <Route path="/settings/demand" element={<ProtectedRoute permissionKey="settings"><DemandPage /></ProtectedRoute>} />
                                <Route path="/settings/layouts" element={<ProtectedRoute permissionKey="settings"><LayoutSettingsPage /></ProtectedRoute>} />
                                <Route path="/settings/export" element={<ProtectedRoute permissionKey="settings"><ExportSettingsPage /></ProtectedRoute>} />

                                {/* Monitoring */}
                                <Route path="/monitoring/realtime" element={<ProtectedRoute permissionKey="monitoring"><RealtimePage /></ProtectedRoute>} />
                                <Route path="/monitoring/layout" element={<ProtectedRoute permissionKey="monitoring"><LayoutViewPage /></ProtectedRoute>} />
                                <Route path="/monitoring/demand-peak" element={<ProtectedRoute permissionKey="monitoring"><DemandPeakPage /></ProtectedRoute>} />

                                {/* Reports */}
                                <Route path="/reports/energy" element={<ProtectedRoute permissionKey="reports"><EnergyReportPage /></ProtectedRoute>} />
                                <Route path="/reports/history" element={<ProtectedRoute permissionKey="reports"><HistoryReportPage /></ProtectedRoute>} />
                                <Route path="/reports/comparison" element={<ProtectedRoute permissionKey="reports"><ComparisonReportPage /></ProtectedRoute>} />
                                <Route path="/reports/alarms" element={<ProtectedRoute permissionKey="reports"><AlarmReportPage /></ProtectedRoute>} />

                                {/* Dashboard */}
                                <Route path="/dashboard/zone" element={<ProtectedRoute permissionKey="dashboard"><ZoneDashboard /></ProtectedRoute>} />
                                <Route path="/dashboard/mdb" element={<ProtectedRoute permissionKey="dashboard"><MdbDashboard /></ProtectedRoute>} />
                                <Route path="/dashboard/demand" element={<ProtectedRoute permissionKey="dashboard"><DemandDashboard /></ProtectedRoute>} />
                                <Route path="/dashboard/consumption" element={<ProtectedRoute permissionKey="dashboard"><ConsumptionTable /></ProtectedRoute>} />

                                {/* Default */}
                                <Route path="/" element={<Navigate to="/dashboard/zone" replace />} />
                            </Route>
                        </Routes>
                    </AuthProvider>
                </LanguageProvider>
            </ThemeProvider>
        </BrowserRouter>
    );
};

export default App;

