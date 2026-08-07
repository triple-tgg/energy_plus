import * as XLSX from 'xlsx';

export type ReportExportFormat = 'excel' | 'csv';

export const exportReport = (
    rows: Record<string, unknown>[],
    fileName: string,
    sheetName: string,
    format: ReportExportFormat,
) => {
    const worksheet = XLSX.utils.json_to_sheet(rows);

    if (format === 'excel') {
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
        XLSX.writeFile(workbook, `${fileName}.xlsx`);
        return;
    }

    // BOM keeps Thai text readable when the CSV is opened directly in Excel.
    const csv = `\uFEFF${XLSX.utils.sheet_to_csv(worksheet)}`;
    const url = window.URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
};

export const fetchAllReportRows = async (
    fetchPage: (page: number, limit: number) => Promise<any>,
    pageSize = 100,
) => {
    const first = await fetchPage(1, pageSize);
    const firstRows = first.data.data || [];
    const totalPages = first.data.pagination?.totalPages || 1;
    const remaining = totalPages > 1
        ? await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => fetchPage(index + 2, pageSize)))
        : [];
    return [...firstRows, ...remaining.flatMap(response => response.data.data || [])];
};
