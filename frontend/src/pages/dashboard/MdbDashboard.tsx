import React from 'react';
import ZoneDashboard from './ZoneDashboard';

/**
 * MDB Dashboard — ใช้ Console ตัวเดียวกับ Zone Dashboard
 * แต่กรองเฉพาะมิเตอร์ชนิด "MDB" (variant="mdb" → ส่ง mdb=only ไป backend)
 */
const MdbDashboard: React.FC = () => <ZoneDashboard variant="mdb" />;

export default MdbDashboard;
