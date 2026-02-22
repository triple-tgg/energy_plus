import React from 'react';

const PlaceholderPage: React.FC<{ title: string; icon?: string }> = ({ title, icon = '🚧' }) => (
    <div className="card">
        <div className="card-body" style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{title}</h2>
            <p style={{ color: 'var(--text-secondary)' }}>This page is under development. Coming soon!</p>
        </div>
    </div>
);

export default PlaceholderPage;
