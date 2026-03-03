import axios from 'axios';

const API_BASE = '/api/v1';

const api = axios.create({
    baseURL: API_BASE,
    headers: { 'Content-Type': 'application/json' },
});

// JWT interceptor
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;

// Auth
export const authApi = {
    login: (data: { username: string; password: string }) => api.post('/auth/login', data),
    me: () => api.get('/auth/me'),
    refresh: (refreshToken: string) => api.post('/auth/refresh', { refreshToken }),
};

// Users
export const usersApi = {
    getAll: (params?: any) => api.get('/users', { params }),
    getById: (id: number) => api.get(`/users/${id}`),
    create: (data: any) => api.post('/users', data),
    update: (id: number, data: any) => api.put(`/users/${id}`, data),
    delete: (id: number) => api.delete(`/users/${id}`),
    getGroups: (params?: any) => api.get('/users/groups/list', { params }),
    createGroup: (data: any) => api.post('/users/groups', data),
    updateGroup: (id: number, data: any) => api.put(`/users/groups/${id}`, data),
    deleteGroup: (id: number) => api.delete(`/users/groups/${id}`),
};

// Sites
export const sitesApi = {
    getAll: (params?: any) => api.get('/sites', { params }),
    getById: (id: number) => api.get(`/sites/${id}`),
    getHierarchy: (id: number) => api.get(`/sites/${id}/hierarchy`),
    create: (data: any) => api.post('/sites', data),
    update: (id: number, data: any) => api.put(`/sites/${id}`, data),
    delete: (id: number) => api.delete(`/sites/${id}`),
    getBuildings: (siteId: number, params?: any) => api.get(`/sites/${siteId}/buildings`, { params }),
    getAllBuildings: (params?: any) => api.get('/sites/buildings/list', { params }),
    createBuilding: (data: any) => api.post('/sites/buildings', data),
    updateBuilding: (id: number, data: any) => api.put(`/sites/buildings/${id}`, data),
    deleteBuilding: (id: number) => api.delete(`/sites/buildings/${id}`),
    getZones: (params?: any) => api.get('/sites/zones/list', { params }),
    createZone: (data: any) => api.post('/sites/zones', data),
    updateZone: (id: number, data: any) => api.put(`/sites/zones/${id}`, data),
    deleteZone: (id: number) => api.delete(`/sites/zones/${id}`),
};

// Meters
export const metersApi = {
    getAll: (params?: any) => api.get('/meters', { params }),
    getById: (id: number) => api.get(`/meters/${id}`),
    create: (data: any) => api.post('/meters', data),
    update: (id: number, data: any) => api.put(`/meters/${id}`, data),
    delete: (id: number) => api.delete(`/meters/${id}`),
    getBrands: (params?: any) => api.get('/meters/brands/list', { params }),
    createBrand: (data: any) => api.post('/meters/brands', data),
    updateBrand: (id: number, data: any) => api.put(`/meters/brands/${id}`, data),
    deleteBrand: (id: number) => api.delete(`/meters/brands/${id}`),
    getTypes: (params?: any) => api.get('/meters/types/list', { params }),
    createType: (data: any) => api.post('/meters/types', data),
    updateType: (id: number, data: any) => api.put(`/meters/types/${id}`, data),
    deleteType: (id: number) => api.delete(`/meters/types/${id}`),
    getLoops: (params?: any) => api.get('/meters/loops/list', { params }),
    createLoop: (data: any) => api.post('/meters/loops', data),
    updateLoop: (id: number, data: any) => api.put(`/meters/loops/${id}`, data),
    deleteLoop: (id: number) => api.delete(`/meters/loops/${id}`),
    getEnergyValues: () => api.get('/meters/energy-values'),
};

// Meter Data
export const meterDataApi = {
    getRealtime: (params?: any) => api.get('/meter-data/realtime', { params }),
    getHistory: (params?: any) => api.get('/meter-data/history', { params }),
    getDaily: (params?: any) => api.get('/meter-data/daily', { params }),
    getMonthly: (params?: any) => api.get('/meter-data/monthly', { params }),
};

// Company
export const companyApi = {
    get: () => api.get('/company'),
    update: (data: any) => api.put('/company', data),
};

// Alarms
export const alarmsApi = {
    getConfigs: (params?: any) => api.get('/alarms/configs', { params }),
    createConfig: (data: any) => api.post('/alarms/configs', data),
    updateConfig: (id: number, data: any) => api.put(`/alarms/configs/${id}`, data),
    deleteConfig: (id: number) => api.delete(`/alarms/configs/${id}`),
    getGroups: (params?: any) => api.get('/alarms/groups', { params }),
    createGroup: (data: any) => api.post('/alarms/groups', data),
    updateGroup: (id: number, data: any) => api.put(`/alarms/groups/${id}`, data),
    deleteGroup: (id: number) => api.delete(`/alarms/groups/${id}`),
};

// Billing
export const billingApi = {
    getConfigs: (params?: any) => api.get('/billing/configs', { params }),
    createConfig: (data: any) => api.post('/billing/configs', data),
    updateConfig: (id: number, data: any) => api.put(`/billing/configs/${id}`, data),
    deleteConfig: (id: number) => api.delete(`/billing/configs/${id}`),
    getDemandConfigs: (params?: any) => api.get('/billing/demand', { params }),
    createDemandConfig: (data: any) => api.post('/billing/demand', data),
    updateDemandConfig: (id: number, data: any) => api.put(`/billing/demand/${id}`, data),
    deleteDemandConfig: (id: number) => api.delete(`/billing/demand/${id}`),
};

// Dashboard
export const dashboardApi = {
    getZoneConsumption: (params?: any) => api.get('/dashboard/zone-consumption', { params }),
    getMdbConsumption: (params?: any) => api.get('/dashboard/mdb-consumption', { params }),
    getDemand: (params?: any) => api.get('/dashboard/demand', { params }),
    getConsumptionTable: (params?: any) => api.get('/dashboard/consumption-table', { params }),
};

// Reports
export const reportsApi = {
    getEnergyConsumption: (params?: any) => api.get('/reports/energy-consumption', { params }),
    getHistory: (params?: any) => api.get('/reports/history', { params }),
    getComparison: (params?: any) => api.get('/reports/comparison', { params }),
    getAlarms: (params?: any) => api.get('/reports/alarms', { params }),
    acknowledgeAlarm: (id: number) => api.put(`/reports/alarms/${id}/acknowledge`),
    exportExcel: (reportType: string, params?: any) => api.get(`/reports/${reportType}/export/excel`, { params, responseType: 'blob' }),
    exportText: (reportType: string, params?: any) => api.get(`/reports/${reportType}/export/text`, { params, responseType: 'blob' }),
};

// Layouts
export const layoutsApi = {
    getAll: (params?: any) => api.get('/layouts', { params }),
    getById: (id: number) => api.get(`/layouts/${id}`),
    create: (data: FormData) => api.post('/layouts', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
    update: (id: number, data: FormData) => api.put(`/layouts/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
    delete: (id: number) => api.delete(`/layouts/${id}`),
    getPositions: (id: number) => api.get(`/layouts/${id}/positions`),
    updatePositions: (id: number, data: any) => api.put(`/layouts/${id}/positions`, data),
    getLiveData: (id: number) => api.get(`/layouts/${id}/live`),
};

// Export Settings
export const exportApi = {
    getAll: (params?: any) => api.get('/exports', { params }),
    getById: (id: number) => api.get(`/exports/${id}`),
    create: (data: any) => api.post('/exports', data),
    update: (id: number, data: any) => api.put(`/exports/${id}`, data),
    delete: (id: number) => api.delete(`/exports/${id}`),
};

// Demand Peak
export const demandPeakApi = {
    getData: (params?: any) => api.get('/demand-peak', { params }),
    getCurrent: (params?: any) => api.get('/demand-peak/current', { params }),
};
