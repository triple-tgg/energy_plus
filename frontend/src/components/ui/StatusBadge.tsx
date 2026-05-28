import React from 'react';

type BadgeType = 'success' | 'danger' | 'warning' | 'info' | 'default';

interface StatusBadgeProps {
    status: string;
    type?: BadgeType;
    size?: 'sm' | 'md';
}

const statusMap: Record<string, { label: string; type: BadgeType }> = {
    'online': { label: 'Normal', type: 'success' },
    'normal': { label: 'Normal', type: 'success' },
    'active': { label: 'Active', type: 'success' },
    'connected': { label: 'Connected', type: 'success' },
    'disconnect': { label: 'DisConnect', type: 'danger' },
    'disconnected': { label: 'DisConnect', type: 'danger' },
    'offline': { label: 'Offline', type: 'danger' },
    'inactive': { label: 'Inactive', type: 'danger' },
    'warning': { label: 'Warning', type: 'warning' },
    'manual': { label: 'Manual', type: 'info' },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type, size = 'md' }) => {
    const key = (status || '').toLowerCase();
    const mapped = statusMap[key];
    const badgeType = type || mapped?.type || 'default';
    const label = mapped?.label || status || 'Unknown';

    const classNames = [
        'badge',
        `badge-${badgeType}`,
        size === 'sm' ? 'badge-sm' : '',
    ].filter(Boolean).join(' ');

    return <span className={classNames}>{label}</span>;
};

export default StatusBadge;
