import React, { useState, useCallback, useEffect } from 'react';
import FilterBar from '../../components/ui/FilterBar';
import type { FilterValues } from '../../components/ui/FilterBar';
import { dashboardApi } from '../../api/client';
import { Line } from 'react-chartjs-2';
import { LayoutGrid } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import {
    Chart as ChartJS,
    CategoryScale, LinearScale, PointElement, LineElement,
    Title, Tooltip, Legend, Filler,
} from 'chart.js';

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, "Cascadia Mono", monospace';
const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const THEMES = {
    light: {
        bg: '#EAE7DA', panel: '#FBFAF4', panel2: '#F1EFE3', ink: '#23261E', sub: '#6E705F',
        line: '#D4D1C0', bar: '#23261E', barSub: '#A6A892', accent: '#2B4C7E',
        green: '#16a34a', yellow: '#C08A1E', red: '#dc2626',
    },
    dark: {
        bg: '#F0F2F5', panel: '#FFFFFF', panel2: '#F5F6F8', ink: '#1A1D23', sub: '#5F6B7A',
        line: '#D8DCE3', bar: '#E8EBF0', barSub: '#8892A0', accent: '#2B6CB0',
        green: '#34d399', yellow: '#D29922', red: '#f85149',
    },
};

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const DemandDashboard: React.FC = () => {
    const { theme } = useTheme();
    const { t, language } = useLanguage();
    const C = THEMES[theme];
    const [loading, setLoading] = useState(false);
    const [chartData, setChartData] = useState<any>(null);
    const [summary, setSummary] = useState<any>(null);
    const [filters, setFilters] = useState<FilterValues>({ startDate: today, endDate: today });
    const [meterOptions, setMeterOptions] = useState<any[]>([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await dashboardApi.getDemand(filters);
            const d = res.data.data || res.data;

            const summaryObj = {
                currentDemand: d.currentDemand || d.current_demand || 0,
                peakDemand: d.peakDemand || d.peak_demand || 0,
                setpoint: d.setpoint || d.demand_setpoint || 0,
                warningLevel: d.warningLevel || d.warning_level || 0,
                averageDemand: d.averageDemand || d.average_demand || 0,
                meterCount: d.meterCount || d.meter_count || 0,
                lastReceivedAt: d.lastReceivedAt || d.last_received_at,
            };
            setSummary(summaryObj);

            const history = d.history || d.timeseries || [];
            setChartData(null);
            if (history.length > 0) {
                const activeC = THEMES[localStorage.getItem('ec-theme') as 'light' | 'dark' || 'light'];
                setChartData({
                    labels: history.map((h: any) => new Date(h.time || h.timestamp).toLocaleString(language === 'th' ? 'th-TH' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' })),
                    datasets: [
                        {
                            label: t('ดีมานด์จริง (kW)', 'Actual Demand (kW)'),
                            data: history.map((h: any) => h.demand || h.kw || 0),
                            borderColor: activeC.accent,
                            backgroundColor: localStorage.getItem('ec-theme') === 'light' ? 'rgba(43,76,126,0.08)' : 'rgba(54,194,206,0.08)',
                            fill: true,
                            tension: 0.2,
                        },
                        {
                            label: t('ค่าเป้าหมาย (Setpoint) (kW)', 'Setpoint (kW)'),
                            data: history.map(() => d.setpoint || d.demand_setpoint || 0),
                            borderColor: activeC.green,
                            borderDash: [8, 4],
                            pointRadius: 0,
                        },
                        {
                            label: t('ระดับเตือนภัย (kW)', 'Warning Level (kW)'),
                            data: history.map(() => d.warningLevel || d.warning_level || 0),
                            borderColor: activeC.yellow,
                            borderDash: [4, 4],
                            pointRadius: 0,
                        },
                    ],
                });
            }
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    }, [filters, language]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        dashboardApi.getConsumptionMeters(filters)
            .then(res => setMeterOptions(res.data.data || []))
            .catch(console.error);
    }, [filters.siteId, filters.buildingId, filters.zoneId, filters.startDate, filters.endDate]);

    const gaugePercent = summary ? Math.min((summary.currentDemand / (summary.setpoint || 1)) * 100, 100) : 0;
    const gaugeColor = gaugePercent > 90 ? C.red : gaugePercent > 75 ? C.yellow : C.green;

    return (
        <div>
            {/* Command bar */}
            <div style={{ background: C.bar, color: '#fff', display: 'flex', alignItems: 'stretch', borderBottom: `2px solid ${C.accent}`, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                    <div style={{ width: 28, height: 28, border: `1px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent }}><LayoutGrid size={16} /></div>
                    <div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>{t('แดชบอร์ด // ดีมานด์', 'DASHBOARD // DEMAND')}</div>
                        <div style={{ fontSize: 10, color: C.barSub, letterSpacing: 0.5 }}>{t('ควบคุมเฝ้าระวังความต้องการกำลังไฟพีคของระบบ (Demand Peak Control)', 'Monitoring and control of system demand peak (Demand Peak Control)')}</div>
                    </div>
                </div>
            </div>

            <FilterBar
                onSubmit={setFilters}
                loading={loading}
                showMeterType={false}
                showZone
                showSearchMeter
                meterOptions={meterOptions}
            />

            {/* Summary Cards */}
            {summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
                    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 0, padding: '20px', textAlign: 'center' }}>
                        <div style={{ fontSize: 11, fontFamily: MONO, color: C.sub, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.8px', marginBottom: 8 }}>{t('ดีมานด์ปัจจุบัน', 'Current Demand')}</div>
                        <div style={{ fontSize: 32, fontWeight: 700, fontFamily: MONO, color: gaugeColor }}>{Number(summary.currentDemand).toLocaleString()}</div>
                        <div style={{ fontSize: 12, fontFamily: MONO, color: C.sub }}>kW</div>
                        <div style={{ marginTop: 12, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 0, height: 10, overflow: 'hidden' }}>
                            <div style={{ width: `${gaugePercent}%`, height: '100%', background: gaugeColor, transition: 'width 0.5s ease' }} />
                        </div>
                        <div style={{ fontSize: 10, fontFamily: MONO, color: C.sub, marginTop: 4 }}>{t(`${gaugePercent.toFixed(1)}% ของค่าเป้าหมาย`, `${gaugePercent.toFixed(1)}% of setpoint`)}</div>
                    </div>
                    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 0, padding: '20px', textAlign: 'center' }}>
                        <div style={{ fontSize: 11, fontFamily: MONO, color: C.sub, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.8px', marginBottom: 8 }}>{t('ดีมานด์พีคสูงสุด', 'Peak Demand')}</div>
                        <div style={{ fontSize: 32, fontWeight: 700, fontFamily: MONO, color: C.red }}>{Number(summary.peakDemand).toLocaleString()}</div>
                        <div style={{ fontSize: 12, fontFamily: MONO, color: C.sub }}>kW</div>
                    </div>
                    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 0, padding: '20px', textAlign: 'center' }}>
                        <div style={{ fontSize: 11, fontFamily: MONO, color: C.sub, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.8px', marginBottom: 8 }}>{t('ดีมานด์เฉลี่ย', 'Average Demand')}</div>
                        <div style={{ fontSize: 32, fontWeight: 700, fontFamily: MONO, color: C.accent }}>{Number(summary.averageDemand).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        <div style={{ fontSize: 12, fontFamily: MONO, color: C.sub }}>kW · {summary.meterCount} {t('มิเตอร์', 'meters')}</div>
                    </div>
                    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 0, padding: '20px', textAlign: 'center' }}>
                        <div style={{ fontSize: 11, fontFamily: MONO, color: C.sub, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.8px', marginBottom: 8 }}>{t('ค่าเป้าหมาย (Setpoint)', 'Setpoint')}</div>
                        <div style={{ fontSize: 32, fontWeight: 700, fontFamily: MONO, color: C.green }}>{Number(summary.setpoint).toLocaleString()}</div>
                        <div style={{ fontSize: 12, fontFamily: MONO, color: C.sub }}>kW</div>
                    </div>
                    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 0, padding: '20px', textAlign: 'center' }}>
                        <div style={{ fontSize: 11, fontFamily: MONO, color: C.sub, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.8px', marginBottom: 8 }}>{t('ระดับเตือนภัย', 'Warning Level')}</div>
                        <div style={{ fontSize: 32, fontWeight: 700, fontFamily: MONO, color: C.yellow }}>{Number(summary.warningLevel).toLocaleString()}</div>
                        <div style={{ fontSize: 12, fontFamily: MONO, color: C.sub }}>kW</div>
                    </div>
                </div>
            )}

            {/* Chart */}
            {chartData && (
                <div style={{
                    background: C.panel,
                    borderRadius: 0,
                    border: `1px solid ${C.line}`,
                    padding: '20px 24px',
                }}>
                    <h3 style={{ marginBottom: 16, fontWeight: 700, fontFamily: MONO, fontSize: 14, color: C.ink, letterSpacing: '0.5px' }}>{t('กราฟดีมานด์จริงและค่าเป้าหมาย', 'DEMAND PEAK VS SETPOINT')}</h3>
                    <div style={{ height: 400 }}>
                        <Line
                            data={chartData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                interaction: { mode: 'index', intersect: false },
                                plugins: {
                                    legend: { 
                                        position: 'top',
                                        labels: {
                                            color: C.ink,
                                            font: { family: MONO, size: 11 }
                                        }
                                    },
                                },
                                scales: {
                                    y: { 
                                        beginAtZero: true, 
                                        grid: { color: C.line },
                                        ticks: { color: C.sub, font: { family: MONO, size: 10 } }
                                    },
                                    x: { 
                                        grid: { display: false },
                                        ticks: { color: C.sub, font: { family: MONO, size: 10 } }
                                    },
                                },
                            }}
                        />
                    </div>
                </div>
            )}

            {loading && (
                <LoadingScreen inline theme={theme} message={t('กำลังโหลดข้อมูลดีมานด์...', 'Loading demand data...')} />
            )}
        </div>
    );
};

export default DemandDashboard;
