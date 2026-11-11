/**
 * Utility to export Recharts (SVG) and Chart.js (Canvas) charts to JPG image files.
 */

export interface ExportChartOptions {
    /** Container element wrapping the chart (SVG or Canvas) */
    element: HTMLElement;
    /** Output file name without extension */
    fileName: string;
    /** Main title displayed at top of exported image */
    title?: string;
    /** Subtitle / details (location, range, timestamp) */
    subtitle?: string;
    /** Background color for JPG (default #ffffff for light, #1E293B for dark) */
    backgroundColor?: string;
    /** Text color (default #1e293b for light, #f8fafc for dark) */
    textColor?: string;
    /** Optional legend items to draw at the bottom */
    legend?: { label: string; color: string; unit?: string }[];
}

export const exportChartToJpg = async (options: ExportChartOptions): Promise<void> => {
    const {
        element,
        fileName,
        title,
        subtitle,
        backgroundColor = '#ffffff',
        textColor = '#1e293b',
        legend = [],
    } = options;

    if (!element) return;

    // Check if element has an SVG (Recharts) or a Canvas (Chart.js)
    const svgEl = element.querySelector('svg');
    const canvasEl = element.querySelector('canvas');

    if (!svgEl && !canvasEl) {
        console.warn('exportChartToJpg: No svg or canvas found in element');
        return;
    }

    const scale = 2; // 2x DPI for crisp high-resolution export

    let chartImage: HTMLImageElement | HTMLCanvasElement;
    let chartWidth = 0;
    let chartHeight = 0;

    if (svgEl) {
        // Clone SVG and inline critical computed styles
        const clone = svgEl.cloneNode(true) as SVGSVGElement;
        const origNodes = svgEl.querySelectorAll('*');
        const cloneNodes = clone.querySelectorAll('*');

        const rect = svgEl.getBoundingClientRect();
        chartWidth = rect.width || 800;
        chartHeight = rect.height || 350;

        clone.setAttribute('width', String(chartWidth));
        clone.setAttribute('height', String(chartHeight));
        clone.setAttribute('viewBox', `0 0 ${chartWidth} ${chartHeight}`);

        for (let i = 0; i < origNodes.length; i++) {
            const orig = origNodes[i] as SVGElement;
            const cln = cloneNodes[i] as SVGElement;
            const cs = window.getComputedStyle(orig);

            if (cs.fill && cs.fill !== 'none') cln.setAttribute('fill', cs.fill);
            if (cs.stroke && cs.stroke !== 'none') cln.setAttribute('stroke', cs.stroke);
            if (cs.strokeWidth) cln.setAttribute('stroke-width', cs.strokeWidth);
            if (cs.strokeDasharray && cs.strokeDasharray !== 'none') cln.setAttribute('stroke-dasharray', cs.strokeDasharray);
            if (cs.opacity && cs.opacity !== '1') cln.setAttribute('opacity', cs.opacity);
            if (cs.fontSize) cln.style.fontSize = cs.fontSize;
            if (cs.fontFamily) cln.style.fontFamily = cs.fontFamily;
            if (cs.fontWeight) cln.style.fontWeight = cs.fontWeight;
        }

        const serializer = new XMLSerializer();
        const svgStr = serializer.serializeToString(clone);
        const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
        const blobUrl = URL.createObjectURL(svgBlob);

        chartImage = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = (e) => reject(e);
            img.src = blobUrl;
        });

        URL.revokeObjectURL(blobUrl);
    } else {
        // Chart.js Canvas
        chartImage = canvasEl!;
        chartWidth = canvasEl!.width / (window.devicePixelRatio || 1);
        chartHeight = canvasEl!.height / (window.devicePixelRatio || 1);
    }

    // Measure header and footer
    const pad = 24 * scale;
    const headerHeight = (title ? 36 : 0) + (subtitle ? 24 : 0);
    const legendHeight = legend.length > 0 ? 36 : 0;

    const totalWidth = chartWidth * scale + (pad * 2);
    const totalHeight = chartHeight * scale + (headerHeight * scale) + (legendHeight * scale) + (pad * 2);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = totalWidth;
    outCanvas.height = totalHeight;

    const ctx = outCanvas.getContext('2d');
    if (!ctx) return;

    // 1. Fill solid background (JPG does not support transparency)
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    let curY = pad;

    // 2. Draw Title
    if (title) {
        ctx.fillStyle = textColor;
        ctx.font = `bold ${16 * scale}px "JetBrains Mono", Consolas, -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillText(title, pad, curY + (14 * scale));
        curY += 28 * scale;
    }

    // 3. Draw Subtitle
    if (subtitle) {
        ctx.fillStyle = textColor;
        ctx.globalAlpha = 0.65;
        ctx.font = `${11 * scale}px "JetBrains Mono", Consolas, -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillText(subtitle, pad, curY + (10 * scale));
        ctx.globalAlpha = 1.0;
        curY += 20 * scale;
    }

    // 4. Draw Chart
    curY += 6 * scale;
    ctx.drawImage(chartImage, pad, curY, chartWidth * scale, chartHeight * scale);
    curY += chartHeight * scale + (12 * scale);

    // 5. Draw Legend (if any)
    if (legend.length > 0) {
        ctx.font = `600 ${10.5 * scale}px "JetBrains Mono", Consolas, -apple-system, BlinkMacSystemFont, sans-serif`;
        let legX = pad;
        const boxSize = 9 * scale;

        for (const item of legend) {
            // Draw color dot / square
            ctx.fillStyle = item.color;
            ctx.fillRect(legX, curY, boxSize, boxSize);
            legX += boxSize + (6 * scale);

            // Draw label
            ctx.fillStyle = textColor;
            const text = item.unit ? `${item.label} (${item.unit})` : item.label;
            ctx.fillText(text, legX, curY + (8 * scale));
            const textWidth = ctx.measureText(text).width;
            legX += textWidth + (16 * scale);

            // Wrap to next line if exceeds width
            if (legX > totalWidth - (pad * 2)) {
                legX = pad;
                curY += 18 * scale;
            }
        }
    }

    // 6. Convert to JPG and download
    const jpgUrl = outCanvas.toDataURL('image/jpeg', 0.95);
    const link = document.createElement('a');
    link.download = `${fileName.replace(/[\/\\:*?"<>|]/g, '_')}.jpg`;
    link.href = jpgUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

