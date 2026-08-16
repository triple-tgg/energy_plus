import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { dashboardApi } from '../../api/client';
import { Line } from 'react-chartjs-2';
import { LayoutGrid, Zap, TrendingUp, Activity, BarChart3 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import FilterBar from '../../components/ui/FilterBar';
import type { FilterValues } from '../../components/ui/FilterBar';
import {
    Chart as ChartJS,
    CategoryScale, LinearScale, PointElement, LineElement,
    Title, Tooltip, Legend, Filler,
} from 'chart.js';

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, "Cascadia Mono", monospace';

const THEMES = {
    light: {
        bg: '#EAE7DA', panel: '#FBFAF4', panel2: '#F1EFE3', ink: '#23261E', sub: '#6E705F',
        line: '#D4D1C0', bar: '#F1EFE3', barSub: '#8A8C7A', accent: '#2B4C7E',
        green: '#16a34a', yellow: '#C08A1E', red: '#dc2626',
        gradStart: 'rgba(43,76,126,0.35)', gradEnd: 'rgba(43,76,126,0.02)',
        peakLine: '#dc2626', avgLine: '#16a34a',
    },
    dark: {
        bg: '#0E1116', panel: '#161B22', panel2: '#1C232E', ink: '#E6EDF3', sub: '#8B98A6',
        line: '#2A313C', bar: '#080A0E', barSub: '#8B98A6', accent: '#36C2CE',
        green: '#34d399', yellow: '#D29922', red: '#f85149',
        gradStart: 'rgba(54,194,206,0.30)', gradEnd: 'rgba(54,194,206,0.02)',
        peakLine: '#f85149', avgLine: '#34d399',
    },
};

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

/** Generate sample demo data for a given month (when API returns no data) */
function generateSampleData(year: number, month: number) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const data: { time: string; kw: number }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 15) {
                const date = new Date(year, month - 1, d, h, m);
                // Simulate realistic demand: base load + time-of-day pattern + noise
                const hourFactor = h >= 8 && h <= 18
                    ? 0.6 + 0.4 * Math.sin(((h - 8) / 10) * Math.PI)
                    : 0.15 + 0.1 * Math.random();
                const base = 120 + Math.random() * 30;
                const kw = base * hourFactor + (Math.random() - 0.5) * 15;
                data.push({ time: date.toISOString(), kw: Math.max(kw, 5) });
            }
        }
    }
    return data;
}

const DemandDashboard: React.FC = () => {
    const { theme } = useTheme();
    const { t } = useLanguage();
    const C = THEMES[theme];

    const now = new Date();
    const [filters, setFilters] = useState<FilterValues>({
        month: String(now.getMonth() + 1),
        year: String(now.getFullYear()),
    });
    const [loading, setLoading] = useState(false);
    const [rawData, setRawData] = useState<{ time: string; kw: number }[]>([]);
    const [isDemo, setIsDemo] = useState(false);

    const year = parseInt(filters.year || String(now.getFullYear()));
    const month = parseInt(filters.month || String(now.getMonth() + 1));

    const monthName = new Date(year, month - 1).toLocaleString('th-TH', { month: 'long', year: 'numeric' });
    const monthNameEn = new Date(year, month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const daysInMonth = new Date(year, month, 0).getDate();

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await dashboardApi.getDemandMonthly({
                year,
                month,
                siteId: filters.siteId || undefined,
                buildingId: filters.buildingId || undefined,
                floor: filters.floor || undefined,
            });
            const d = res.data.data || res.data;
            if (d.timeseries && d.timeseries.length > 0) {
                setRawData(d.timeseries);
                setIsDemo(false);
            } else {
                setRawData(generateSampleData(year, month));
                setIsDemo(true);
            }
        } catch {
            setRawData(generateSampleData(year, month));
            setIsDemo(true);
        }
        setLoading(false);
    }, [year, month, filters.siteId, filters.buildingId, filters.floor]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Group data by day
    const dailyPeaks = useMemo(() => {
        const map = new Map<number, number>();
        rawData.forEach(p => {
            const d = new Date(p.time);
            const day = d.getDate();
            map.set(day, Math.max(map.get(day) || 0, p.kw));
        });
        return map;
    }, [rawData]);

    // Calculate summary
    const summary = useMemo(() => {
        if (rawData.length === 0) return { peak: 0, avg: 0, current: 0, points: 0 };
        const peak = rawData.reduce((max, p) => Math.max(max, p.kw), 0);
        const avg = rawData.reduce((sum, p) => sum + p.kw, 0) / rawData.length;
        const current = rawData[rawData.length - 1]?.kw || 0;
        return { peak, avg, current, points: rawData.length };
    }, [rawData]);

    // Build chart data: every 15-minute data point
    const chartConfig = useMemo(() => {
        // Sort by time and build labels + data
        const sorted = [...rawData].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        const labels: string[] = [];
        const dataPoints: number[] = [];
        let lastDay = -1;

        sorted.forEach(p => {
            const d = new Date(p.time);
            const day = d.getDate();
            const hour = d.getHours();
            const min = d.getMinutes();
            // Show day label only at 00:00 of each day (or first point of the day)
            if (day !== lastDay) {
                labels.push(String(day));
                lastDay = day;
            } else {
                labels.push(''); // empty label for non-midnight points
            }
            dataPoints.push(p.kw);
        });

        // Store sorted data for tooltip access
        return { labels, dataPoints, sorted };
    }, [rawData]);

    // Find peak day
    const peakDay = useMemo(() => {
        let maxDay = 1, maxKw = 0;
        dailyPeaks.forEach((kw, day) => {
            if (kw > maxKw) { maxKw = kw; maxDay = day; }
        });
        return { day: maxDay, kw: maxKw };
    }, [dailyPeaks]);

    const handleFilterSubmit = (newFilters: FilterValues) => {
        setFilters(newFilters);
    };

    // Format time for tooltip
    const formatTime = (isoStr: string) => {
        const d = new Date(isoStr);
        const day = d.getDate();
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        return { day, timeStr: `${h}:${m}` };
    };

    return (
        <div>
            {/* Command bar */}
            <div style={{ background: C.bar, color: C.ink, display: 'flex', alignItems: 'stretch', borderBottom: `2px solid ${C.accent}`, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}><LayoutGrid size={16} /></div>
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>{t('แดชบอร์ด // ดีมานด์ MDB', 'DASHBOARD // MDB DEMAND')}</div>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>{t('กราฟดีมานด์ (kW) ของมิเตอร์ MDB ราย 15 นาที ทั้งเดือน', 'MDB Meter Demand (kW) — 15-minute intervals, Full Month View')}</div>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <FilterBar
                onSubmit={handleFilterSubmit}
                loading={loading}
                showDateRange={false}
                showMonthYear
                showSite
                showBuilding
                showFloor
                showZone={false}
                showMeterType={false}
                showSearchMeter={false}
            />

            {/* Demo banner */}
            {isDemo && !loading && (
                <div style={{
                    background: theme === 'light' ? '#FEF3C7' : '#78350F',
                    border: `1px solid ${C.yellow}`,
                    padding: '8px 16px', marginBottom: 16,
                    fontFamily: MONO, fontSize: 11, color: theme === 'light' ? '#92400E' : '#FDE68A',
                    display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    <Activity size={14} />
                    {t('⚠ แสดงข้อมูลตัวอย่าง (Demo) — ไม่พบข้อมูลจริงจาก API', '⚠ Showing demo/sample data — No real data available from API')}
                </div>
            )}

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14, marginBottom: 20 }}>
                {/* Peak Demand */}
                <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 12, right: 14, opacity: 0.12 }}><TrendingUp size={48} color={C.red} /></div>
                    <div style={{ fontSize: 10, fontFamily: MONO, color: C.sub, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
                        {t('ดีมานด์สูงสุด', 'PEAK DEMAND')}
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 700, fontFamily: MONO, color: C.red }}>{summary.peak.toFixed(1)}</div>
                    <div style={{ fontSize: 11, fontFamily: MONO, color: C.sub }}>
                        kW · {t(`วันที่ ${peakDay.day}`, `Day ${peakDay.day}`)}
                    </div>
                </div>
                {/* Average Demand */}
                <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 12, right: 14, opacity: 0.12 }}><BarChart3 size={48} color={C.accent} /></div>
                    <div style={{ fontSize: 10, fontFamily: MONO, color: C.sub, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
                        {t('ดีมานด์เฉลี่ย', 'AVG DEMAND')}
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 700, fontFamily: MONO, color: C.accent }}>{summary.avg.toFixed(1)}</div>
                    <div style={{ fontSize: 11, fontFamily: MONO, color: C.sub }}>kW</div>
                </div>
                {/* Current / Latest */}
                <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 12, right: 14, opacity: 0.12 }}><Zap size={48} color={C.green} /></div>
                    <div style={{ fontSize: 10, fontFamily: MONO, color: C.sub, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
                        {t('ค่าล่าสุด', 'LATEST')}
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 700, fontFamily: MONO, color: C.green }}>{summary.current.toFixed(1)}</div>
                    <div style={{ fontSize: 11, fontFamily: MONO, color: C.sub }}>kW</div>
                </div>
                {/* Data points */}
                <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 12, right: 14, opacity: 0.12 }}><Activity size={48} color={C.yellow} /></div>
                    <div style={{ fontSize: 10, fontFamily: MONO, color: C.sub, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
                        {t('จุดข้อมูล', 'DATA POINTS')}
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 700, fontFamily: MONO, color: C.yellow }}>{summary.points.toLocaleString()}</div>
                    <div style={{ fontSize: 11, fontFamily: MONO, color: C.sub }}>{t('ราย 15 นาที', '15-min intervals')}</div>
                </div>
            </div>

            {/* Main Chart — 15-minute intervals */}
            <div style={{
                background: C.panel,
                border: `1px solid ${C.line}`,
                padding: '20px 24px',
                marginBottom: 20,
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontWeight: 700, fontFamily: MONO, fontSize: 13, color: C.ink, letterSpacing: 0.5 }}>
                        {t(`กราฟดีมานด์ MDB (kW) — ราย 15 นาที · ${monthName}`, `MDB DEMAND (kW) — 15-MIN INTERVALS · ${monthNameEn}`)}
                    </h3>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: C.sub }}>
                        {t(`${summary.points.toLocaleString()} จุด`, `${summary.points.toLocaleString()} points`)}
                    </div>
                </div>
                <div style={{ height: 450 }}>
                    <Line
                        data={{
                            labels: chartConfig.labels,
                            datasets: [
                                {
                                    label: t('ดีมานด์ (kW)', 'Demand (kW)'),
                                    data: chartConfig.dataPoints,
                                    borderColor: C.accent,
                                    backgroundColor: (ctx: any) => {
                                        const chart = ctx.chart;
                                        const { ctx: canvasCtx, chartArea } = chart;
                                        if (!chartArea) return C.gradStart;
                                        const gradient = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                                        gradient.addColorStop(0, C.gradStart);
                                        gradient.addColorStop(1, C.gradEnd);
                                        return gradient;
                                    },
                                    fill: true,
                                    tension: 0.2,
                                    pointRadius: 0,
                                    pointHoverRadius: 4,
                                    pointBackgroundColor: C.accent,
                                    pointBorderColor: C.panel,
                                    pointBorderWidth: 1,
                                    borderWidth: 1.5,
                                },
                                {
                                    label: t('ค่าพีคสูงสุด', 'Peak Max'),
                                    data: chartConfig.dataPoints.map(() => summary.peak),
                                    borderColor: C.peakLine,
                                    borderDash: [8, 4],
                                    pointRadius: 0,
                                    pointHoverRadius: 0,
                                    borderWidth: 1.5,
                                },
                                {
                                    label: t('ค่าเฉลี่ย', 'Average'),
                                    data: chartConfig.dataPoints.map(() => summary.avg),
                                    borderColor: C.avgLine,
                                    borderDash: [4, 4],
                                    pointRadius: 0,
                                    pointHoverRadius: 0,
                                    borderWidth: 1.5,
                                },
                            ],
                        }}
                        options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            interaction: { mode: 'index', intersect: false },
                            plugins: {
                                legend: {
                                    position: 'top',
                                    labels: {
                                        color: C.ink,
                                        font: { family: MONO, size: 11 },
                                        usePointStyle: true,
                                        pointStyle: 'rectRounded',
                                    },
                                },
                                tooltip: {
                                    backgroundColor: theme === 'dark' ? '#1C232E' : '#FBFAF4',
                                    titleColor: C.ink,
                                    bodyColor: C.ink,
                                    borderColor: C.line,
                                    borderWidth: 1,
                                    titleFont: { family: MONO, size: 12, weight: 'bold' as const },
                                    bodyFont: { family: MONO, size: 11 },
                                    padding: 12,
                                    callbacks: {
                                        title: (ctx: any) => {
                                            const idx = ctx[0].dataIndex;
                                            const point = chartConfig.sorted[idx];
                                            if (!point) return '';
                                            const { day, timeStr } = formatTime(point.time);
                                            return t(`วันที่ ${day} เวลา ${timeStr}`, `Day ${day}, ${timeStr}`);
                                        },
                                        label: (ctx: any) => ` ${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(2)} kW`,
                                    },
                                },
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    grid: { color: C.line },
                                    ticks: {
                                        color: C.sub,
                                        font: { family: MONO, size: 10 },
                                        callback: (value: any) => `${value} kW`,
                                    },
                                    title: {
                                        display: true,
                                        text: 'kW',
                                        color: C.sub,
                                        font: { family: MONO, size: 11, weight: 'bold' as const },
                                    },
                                },
                                x: {
                                    grid: {
                                        display: true,
                                        color: (ctx: any) => {
                                            // Show grid line only at day boundaries (non-empty labels)
                                            const label = chartConfig.labels[ctx.tick?.value];
                                            return label ? C.line : 'transparent';
                                        },
                                    },
                                    ticks: {
                                        color: C.sub,
                                        font: { family: MONO, size: 10 },
                                        maxRotation: 0,
                                        autoSkip: false,
                                        callback: function(_value: any, index: number) {
                                            // Only show label for day boundary ticks
                                            return chartConfig.labels[index] || null;
                                        },
                                    },
                                    title: {
                                        display: true,
                                        text: t('วันที่ในเดือน', 'Day of Month'),
                                        color: C.sub,
                                        font: { family: MONO, size: 11, weight: 'bold' as const },
                                    },
                                },
                            },
                        }}
                    />
                </div>
            </div>

            {/* Daily breakdown table */}
            <div style={{
                background: C.panel,
                border: `1px solid ${C.line}`,
                padding: '20px 24px',
            }}>
                <h3 style={{ margin: '0 0 16px 0', fontWeight: 700, fontFamily: MONO, fontSize: 13, color: C.ink, letterSpacing: 0.5 }}>
                    {t('สรุปดีมานด์รายวัน', 'DAILY DEMAND SUMMARY')}
                </h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 12 }}>
                        <thead>
                            <tr style={{ borderBottom: `2px solid ${C.accent}` }}>
                                <th style={{ padding: '8px 12px', textAlign: 'left', color: C.sub, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                                    {t('วันที่', 'DATE')}
                                </th>
                                <th style={{ padding: '8px 12px', textAlign: 'right', color: C.sub, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                                    {t('พีค (kW)', 'PEAK (kW)')}
                                </th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', color: C.sub, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, width: '50%' }}>
                                    {t('กราฟ', 'CHART')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                                const kw = dailyPeaks.get(day) || 0;
                                const pct = summary.peak > 0 ? (kw / summary.peak) * 100 : 0;
                                const isPeakDay = day === peakDay.day;
                                return (
                                    <tr key={day} style={{
                                        borderBottom: `1px solid ${C.line}`,
                                        background: isPeakDay ? (theme === 'dark' ? 'rgba(248,81,73,0.08)' : 'rgba(220,38,38,0.04)') : 'transparent',
                                    }}>
                                        <td style={{ padding: '6px 12px', color: isPeakDay ? C.red : C.ink, fontWeight: isPeakDay ? 700 : 400 }}>
                                            {day} {t(new Date(year, month - 1, day).toLocaleDateString('th-TH', { weekday: 'short' }), new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'short' }))}
                                            {isPeakDay && <span style={{ marginLeft: 6, fontSize: 9, color: C.red, fontWeight: 700 }}>▲ PEAK</span>}
                                        </td>
                                        <td style={{ padding: '6px 12px', textAlign: 'right', color: isPeakDay ? C.red : C.ink, fontWeight: isPeakDay ? 700 : 400 }}>
                                            {kw > 0 ? kw.toFixed(2) : '—'}
                                        </td>
                                        <td style={{ padding: '6px 12px' }}>
                                            <div style={{
                                                background: C.panel2,
                                                border: `1px solid ${C.line}`,
                                                height: 16,
                                                overflow: 'hidden',
                                                position: 'relative',
                                            }}>
                                                <div style={{
                                                    width: `${pct}%`,
                                                    height: '100%',
                                                    background: isPeakDay
                                                        ? `linear-gradient(90deg, ${C.red}, ${C.yellow})`
                                                        : `linear-gradient(90deg, ${C.accent}, ${theme === 'dark' ? '#5EEAD4' : '#60A5FA'})`,
                                                    transition: 'width 0.4s ease',
                                                }} />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {loading && (
                <LoadingScreen inline theme={theme} message={t('กำลังโหลดข้อมูลดีมานด์...', 'Loading demand data...')} />
            )}
        </div>
    );
};

export default DemandDashboard;
