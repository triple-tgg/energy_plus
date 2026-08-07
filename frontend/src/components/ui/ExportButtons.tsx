import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

export type ExportFormat = 'excel' | 'csv';

interface ExportButtonsProps {
    onExport: (format: ExportFormat) => void | Promise<void>;
    loading?: boolean;
}

const ExportButtons: React.FC<ExportButtonsProps> = ({ onExport, loading = false }) => {
    const { t } = useLanguage();
    const [format, setFormat] = useState<ExportFormat>('excel');

    return (
        <div className="export-buttons">
            <select
                className="form-control form-control-sm export-format-select"
                value={format}
                onChange={event => setFormat(event.target.value as ExportFormat)}
                disabled={loading}
                aria-label={t('เลือกรูปแบบไฟล์', 'Select export format')}
            >
                <option value="excel">Excel (.xlsx)</option>
                <option value="csv">CSV (.csv)</option>
            </select>
            <button type="button" className="btn btn-success btn-sm" onClick={() => onExport(format)} disabled={loading}>
                📥 {loading ? t('กำลังส่งออก...', 'Exporting...') : t('ส่งออก', 'Export')}
            </button>
        </div>
    );
};

export default ExportButtons;
