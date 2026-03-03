import React from 'react';

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
    return (
        <div className="export-buttons">
            {onExportExcel && (
                <button
                    className="btn btn-success btn-sm"
                    onClick={onExportExcel}
                    disabled={loading}
                >
                    📥 Export Excel
                </button>
            )}
            {onExportText && (
                <button
                    className="btn btn-info btn-sm"
                    onClick={onExportText}
                    disabled={loading}
                >
                    📄 Export Text
                </button>
            )}
            {onExportPdf && (
                <button
                    className="btn btn-danger btn-sm"
                    onClick={onExportPdf}
                    disabled={loading}
                >
                    📑 Export PDF
                </button>
            )}
        </div>
    );
};

export default ExportButtons;
