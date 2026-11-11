import * as XLSX from 'xlsx';

export type ReportExportFormat = 'excel' | 'csv';

/**
 * Format numeric data cells in the worksheet:
 * - Integer columns: '0'
 * - Meter readings, units, usage, consumption, PF: 3 decimal places ('#,##0.000')
 * - Monetary amounts (THB / บาท), rates, percentages: 2 decimal places ('#,##0.00')
 */
export const applyTwoDecimalFormat = (worksheet: any): void => {
    if (!worksheet || !worksheet['!ref']) return;
    const range = XLSX.utils.decode_range(worksheet['!ref']);

    for (let C = range.s.c; C <= range.e.c; ++C) {
        const headerCell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
        const header = headerCell ? String(headerCell.v || '').trim().toLowerCase() : '';

        // Columns that should stay as integers (not currency / energy measurements)
        const isIntegerOnlyCol = /^(id|meter_id|building_id|zone_id|site_id|year|ปี|floor|ชั้น|ลำดับ|no\.?|readings_count|รอบอ่าน)/i.test(header);

        // Columns for meter readings and usage/consumption: 3 decimal places
        const isThreeDecimalCol = /(reading|เลขมิเตอร์|เลขก่อน|เลขล่าสุด|เลขต้น|เลขปลาย|หน่วย|unit|kwh|usage|consumption|การใช้ไฟ|เดือนก่อน|เดือนปัจจุบัน|prev_month|current_month|prev_units|current_units|acc\.|pf\d?|pwl\d?)/i.test(header);

        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
            const addr = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = worksheet[addr];
            if (!cell) continue;

            if (cell.t === 'n' && typeof cell.v === 'number') {
                if (isIntegerOnlyCol) {
                    cell.z = '0';
                    cell.w = String(Math.round(cell.v));
                } else if (isThreeDecimalCol) {
                    const rounded = Math.round((cell.v + Number.EPSILON) * 1000) / 1000;
                    cell.v = rounded;
                    cell.z = '#,##0.000';
                    cell.w = rounded.toFixed(3);
                } else {
                    const rounded = Math.round((cell.v + Number.EPSILON) * 100) / 100;
                    cell.v = rounded;
                    cell.z = '#,##0.00';
                    cell.w = rounded.toFixed(2);
                }
            } else if (typeof cell.v === 'string') {
                const isCodeOrText = /(code|รหัส|name|ชื่อ|date|วันที่|time|เวลา|เดือนที่|month|status|สถานะ)/i.test(header);
                if (!isCodeOrText && cell.v.trim() !== '' && !isNaN(Number(cell.v))) {
                    const num = Number(cell.v);
                    if (isThreeDecimalCol) {
                        const rounded = Math.round((num + Number.EPSILON) * 1000) / 1000;
                        cell.t = 'n';
                        cell.v = rounded;
                        cell.z = '#,##0.000';
                        cell.w = rounded.toFixed(3);
                    } else {
                        const rounded = Math.round((num + Number.EPSILON) * 100) / 100;
                        cell.t = 'n';
                        cell.v = rounded;
                        cell.z = '#,##0.00';
                        cell.w = rounded.toFixed(2);
                    }
                }
            }
        }
    }

    // Auto-fit column widths
    const colWidths: { wch: number }[] = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
        let maxLen = 10;
        for (let R = range.s.r; R <= range.e.r; ++R) {
            const addr = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = worksheet[addr];
            if (cell && cell.v != null) {
                const str = cell.w || String(cell.v);
                maxLen = Math.max(maxLen, Math.min(str.length + 3, 50));
            }
        }
        colWidths.push({ wch: maxLen });
    }
    worksheet['!cols'] = colWidths;
};

export const exportReport = (
    rows: Record<string, unknown>[],
    fileName: string,
    sheetName: string,
    format: ReportExportFormat,
) => {
    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Apply 2-decimal formatting to all numeric cells
    applyTwoDecimalFormat(worksheet);

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
