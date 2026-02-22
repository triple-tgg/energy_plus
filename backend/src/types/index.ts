// ===== Common Types =====

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    message?: string;
    errors?: ValidationError[];
    pagination?: Pagination;
    meta?: ResponseMeta;
}

export interface ValidationError {
    field: string;
    message: string;
}

export interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface ResponseMeta {
    timestamp: string;
    requestId?: string;
}

// ===== Auth =====
export interface JwtPayload {
    userId: number;
    userName: string;
    groupId: number;
    groupName: string;
    siteIds: number[];
}

export interface LoginRequest {
    username: string;
    password: string;
    siteId?: number;
}

export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: UserProfile;
}

export interface UserProfile {
    userId: number;
    userName: string;
    displayName: string;
    email: string;
    group: string;
    groupId: number;
    permissions: string[];
    sites: { siteId: number; siteName: string }[];
}

// ===== Infrastructure =====
export interface Site {
    siteId: number;
    siteName: string;
}

export interface Building {
    buildingId: number;
    buildingName: string;
    siteId: number;
    isActive: boolean;
    createdBy?: string;
    createdOn?: Date;
    lastModifiedBy?: string;
    lastModifiedOn?: Date;
}

export interface Zone {
    zoneId: number;
    zoneName: string;
    buildingId: number;
    isShowDashboard?: boolean;
}

// ===== Company =====
export interface Company {
    companyId: number;
    companyName: string;
    address?: string;
    contactName?: string;
    contactPhone?: string;
    domain?: string;
}

// ===== Meters =====
export interface Meter {
    meterId: number;
    meterCode: string;
    meterName: string;
    address: number;
    meterBrandId: number;
    meterTypeId: number;
    loopId: number;
    siteId: number;
    buildingId: number;
    zoneId: number;
    isActive: boolean;
    ipAddress?: string;
    portNumber?: number;
    protocolId?: number;
    roomCode?: string;
    roomName?: string;
    phase?: number;
    circuit?: string;
    billingRate?: number;
}

export interface MeterBrand {
    meterBrandId: number;
    meterBrandName: string;
    modelName?: string;
    notes?: string;
    isActive: boolean;
    createdBy?: string;
    createdOn?: Date;
    lastModifiedBy?: string;
    lastModifiedOn?: Date;
}

export interface MeterType {
    meterTypeId: number;
    meterTypeName: string;
    iconName?: string;
    isActive: boolean;
    createdBy?: string;
    createdOn?: Date;
    lastModifiedBy?: string;
    lastModifiedOn?: Date;
}

export interface Loop {
    loopId: number;
    portNo: number;
    baudrate: number;
    stopbit: number;
    parity: string;
    databit: number;
    isActive: boolean;
    remark?: string;
}

// ===== Users =====
export interface AppUser {
    userId: number;
    userName: string;
    displayName: string;
    email: string;
    groupId: number;
    isActive: boolean;
    createdBy?: string;
    createdOn?: Date;
}

export interface GroupUser {
    groupId: number;
    groupName: string;
    isActive: boolean;
    createdBy?: string;
    createdOn?: Date;
    lastModifiedBy?: string;
    lastModifiedOn?: Date;
}

export interface UserPermission {
    permissionId: number;
    groupId: number;
    permissionName: string;
    canView: boolean;
    canEdit: boolean;
}

// ===== Alarms =====
export interface AlarmConfig {
    alarmConfigId: number;
    meterId: number;
    energyValueId: number;
    lowerValue: number;
    higherValue: number;
    lowerMessage?: string;
    higherMessage?: string;
    isActive: boolean;
    isLampOn: boolean;
    isBuzzerOn: boolean;
    lampAddress: number;
    buzzerAddress: number;
}

export interface AlarmGroup {
    alarmGroupId: number;
    groupName: string;
    email: string;
    telegramToken: string;
    telegramChatId: string;
    isActive: boolean;
}

// ===== Billing =====
export interface BillingConfig {
    id: number;
    effectiveDate: Date;
    unitPrice: number;
    isActive: boolean;
    createdBy?: string;
    createdOn?: Date;
    lastModifiedBy?: string;
    lastModifiedOn?: Date;
}

// ===== Demand Peak =====
export interface DemandPeakConfig {
    configId: number;
    displayName: string;
    warningSetpoint: number;
    peakSetpoint: number;
    savingRate: number;
    flatRate: number;
    tou: number;
    savingTarget: number;
    isActive: boolean;
    createdBy?: string;
    createdOn?: Date;
    lastModifiedBy?: string;
    lastModifiedOn?: Date;
}

// ===== Layouts =====
export interface Layout {
    layoutId: number;
    layoutName: string;
    imageName?: string;
    imageData?: string;
    position?: string;
}

// ===== Export Config =====
export interface ExportConfig {
    id: number;
    name: string;
    exportPath: string;
    scheduleEvery: string;
    isActive: boolean;
    createdBy?: string;
    createdOn?: Date;
    lastModifiedBy?: string;
    lastModifiedOn?: Date;
}

// ===== Energy Value =====
export interface EnergyValue {
    energyValueId: number;
    energyValueName: string;
    columnName: string;
}

// ===== Meter Data =====
export interface MeterReading {
    meterId: number;
    meterName?: string;
    meterCode?: string;
    roomCode?: string;
    roomName?: string;
    status?: string;
    dateKeep: Date;
    energyKWh: number;
    energyKva: number;
    energyKw: number;
    energyKvar: number;
    energyFrequency: number;
    energyVoltP1: number;
    energyVoltP2: number;
    energyVoltP3: number;
    energyAmp1: number;
    energyAmp2: number;
    energyAmp3: number;
    energyPf1: number;
    energyPf2: number;
    energyPf3: number;
}

// Express Request extension
import { Request } from 'express';

export interface AuthRequest extends Request {
    user?: JwtPayload;
}
