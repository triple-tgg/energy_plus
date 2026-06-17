import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

const AccessDeniedPage: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useLanguage();

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            textAlign: 'center',
            padding: '40px 20px',
        }}>
            <div style={{
                fontSize: 72,
                marginBottom: 16,
                lineHeight: 1,
            }}>
                🔒
            </div>
            <h1 style={{
                fontSize: 28,
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: '0 0 8px 0',
            }}>
                {t('ปฏิเสธการเข้าถึง', 'Access Denied')}
            </h1>
            <p style={{
                fontSize: 16,
                color: 'var(--text-secondary)',
                margin: '0 0 24px 0',
                maxWidth: 400,
            }}>
                {t('คุณไม่มีสิทธิ์เข้าถึงหน้านี้ กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์การเข้าถึง', 'You do not have permission to access this page. Please contact your administrator to request access.')}
            </p>
            <button
                className="btn btn-primary"
                onClick={() => navigate(-1)}
                style={{ minWidth: 140 }}
            >
                {t('← ย้อนกลับ', '← Go Back')}
            </button>
        </div>
    );
};

export default AccessDeniedPage;
