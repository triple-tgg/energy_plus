import React from 'react';

export interface MeterTypeMaster {
    id: number;
    name: string;
    labelTh: string;
    labelEn: string;
    icon: string;
    color: string;
    emoji: string;
}

/**
 * Standard 8 Meter Types matching backend ensureMeterMasterData:
 * 1. Power (ไฟฟ้า)
 * 2. Water (น้ำ)
 * 3. Water Quality (คุณภาพน้ำ)
 * 4. Air Quality (คุณภาพอากาศ)
 * 5. Soil Quality (คุณภาพดิน)
 * 6. Power Security (ความปลอดภัยไฟฟ้า)
 * 7. Fire Security (ความปลอดภัยอัคคีภัย)
 * 8. Room Service (บริการห้องพัก)
 */
export const STANDARD_METER_TYPES: MeterTypeMaster[] = [
    { id: 1, name: 'Power',          labelTh: 'ไฟฟ้า (Power)',           labelEn: 'Power',          icon: 'fa fa-bolt',              color: '#F59E0B', emoji: '⚡' },
    { id: 2, name: 'Water',          labelTh: 'น้ำ (Water)',             labelEn: 'Water',          icon: 'fa fa-tint',              color: '#3B82F6', emoji: '💧' },
    { id: 3, name: 'Water Quality',  labelTh: 'คุณภาพน้ำ (Water Q)',     labelEn: 'Water Quality',  icon: 'fa fa-flask',             color: '#06B6D4', emoji: '🧪' },
    { id: 4, name: 'Air Quality',    labelTh: 'คุณภาพอากาศ (Air Q)',     labelEn: 'Air Quality',    icon: 'fa fa-wind',              color: '#8B5CF6', emoji: '🌬️' },
    { id: 5, name: 'Soil Quality',   labelTh: 'คุณภาพดิน (Soil Q)',      labelEn: 'Soil Quality',   icon: 'fa fa-seedling',          color: '#10B981', emoji: '🌱' },
    { id: 6, name: 'Power Security', labelTh: 'ความปลอดภัยไฟฟ้า (Sec)', labelEn: 'Power Security', icon: 'fa fa-shield-alt',        color: '#EF4444', emoji: '🔒' },
    { id: 7, name: 'Fire Security',  labelTh: 'ระบบดับเพลิง (Fire)',     labelEn: 'Fire Security',  icon: 'fa fa-fire-extinguisher', color: '#F97316', emoji: '🔥' },
    { id: 8, name: 'Room Service',   labelTh: 'บริการห้อง (Room)',       labelEn: 'Room Service',   icon: 'fa fa-home',              color: '#EC4899', emoji: '🏠' },
];

/** Resolve Meter Type information dynamically by ID, Name, or fallback */
export const resolveMeterType = (typeId?: number | null, typeName?: string | null): MeterTypeMaster => {
    if (typeId && Number(typeId) > 0) {
        const found = STANDARD_METER_TYPES.find(t => t.id === Number(typeId));
        if (found) return found;
    }

    if (typeName) {
        const lower = typeName.toLowerCase().trim();
        if (lower.includes('water quality') || lower.includes('คุณภาพน้ำ')) return STANDARD_METER_TYPES[2];
        if (lower.includes('air') || lower.includes('อากาศ') || lower.includes('wind') || lower.includes('pm')) return STANDARD_METER_TYPES[3];
        if (lower.includes('soil') || lower.includes('ดิน')) return STANDARD_METER_TYPES[4];
        if (lower.includes('fire') || lower.includes('เพลิง') || lower.includes('แก๊ส') || lower.includes('gas')) return STANDARD_METER_TYPES[6];
        if (lower.includes('room') || lower.includes('ห้อง')) return STANDARD_METER_TYPES[7];
        if (lower.includes('water') || lower.includes('น้ำ')) return STANDARD_METER_TYPES[1];
        if (lower.includes('security') || lower.includes('ปลอดภัย')) return STANDARD_METER_TYPES[5];
        if (lower.includes('power') || lower.includes('ไฟฟ้า') || lower.includes('mdb') || lower.includes('ele') || lower.includes('volt')) return STANDARD_METER_TYPES[0];
    }

    // Default to Power (Type 1)
    return STANDARD_METER_TYPES[0];
};

/** Check if string is FontAwesome icon class */
export const isFaIcon = (v: string) => v && (v.startsWith('fa ') || v.startsWith('fa-') || v.startsWith('fas '));

/** Render icon with FontAwesome or emoji fallback */
export const renderMeterTypeIcon = (iconName: string | null | undefined, fallbackEmoji: string, size: number = 14) => {
    if (iconName && isFaIcon(iconName)) {
        return <i className={iconName} style={{ fontSize: size }} />;
    }
    return <span style={{ fontSize: size, lineHeight: 1 }}>{fallbackEmoji || iconName}</span>;
};

