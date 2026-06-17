import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

interface ExportButtonsProps {
    onExportExcel?: () => void;
    onExportText?: () => void;
    onExportPdf?: () => void;
    loading?: boolean;
}

const ExportButtons: React.FC<ExportButtonsProps> = ({
    onExportExcel,
    onExportText,
    onExportPdf,
    loading = false,
}) => {
    const { t } = useLanguage();

    return (
        <div className="export-buttons">
            {onExportExcel && (
                <button
                    className="btn btn-success btn-sm"
                    onClick={onExportExcel}
                    disabled={loading}
                >
                    📥 {t('ส่งออก Excel', 'Export Excel')}
                </button>
            )}
            {onExportText && (
                <button
                    className="btn btn-info btn-sm"
                    onClick={onExportText}
                    disabled={loading}
                >
                    📄 {t('ส่งออกข้อความ', 'Export Text')}
                </button>
            )}
            {onExportPdf && (
                <button
                    className="btn btn-danger btn-sm"
                    onClick={onExportPdf}
                    disabled={loading}
                >
                    📑 {t('ส่งออก PDF', 'Export PDF')}
                </button>
            )}
        </div>
    );
};

export default ExportButtons;
