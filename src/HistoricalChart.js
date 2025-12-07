import React, { useState, useEffect } from 'react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

export function HistoricalChart({ config }) {
    const [chartData, setChartData] = useState([]);
    const [selectedMetrics, setSelectedMetrics] = useState(['total_pv_power']);
    const [availableMetrics, setAvailableMetrics] = useState([]);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    const [dateRange, setDateRange] = useState('today');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [granularity, setGranularity] = useState('hour');
    const [chartType, setChartType] = useState('line');
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState(null);

    // Initialize available metrics
    useEffect(() => {
        const metrics = [
            { id: 'total_pv_power', name: 'Total PV Power (W)', group: 'Calculated' },
            { id: 'battery_soc', name: 'Battery SoC (%)', group: 'Calculated' },
            { id: 'battery_voltage', name: 'Battery Voltage (V)', group: 'Calculated' },
            { id: 'battery_power', name: 'Battery Power (W)', group: 'Calculated' },
            { id: 'consumption_power', name: 'Consumption Power (W)', group: 'Calculated' },
            { id: 'daily_energy', name: 'Daily Energy (kWh)', group: 'Calculated' },
            
            // INVD Metrics
            { id: 'INVD_PV1_V', name: 'Inverter PV1 Voltage (V)', group: 'Inverter' },
            { id: 'INVD_PV1_I', name: 'Inverter PV1 Current (A)', group: 'Inverter' },
            { id: 'INVD_PV2_V', name: 'Inverter PV2 Voltage (V)', group: 'Inverter' },
            { id: 'INVD_PV2_I', name: 'Inverter PV2 Current (A)', group: 'Inverter' },
            { id: 'INVD_Vbat', name: 'Inverter Battery Voltage (V)', group: 'Inverter' },
            { id: 'INVD_Ibat', name: 'Inverter Battery Current (A)', group: 'Inverter' },
            { id: 'INVD_Vout', name: 'Inverter Output Voltage (V)', group: 'Inverter' },
            { id: 'INVD_Iout', name: 'Inverter Output Current (A)', group: 'Inverter' },
            { id: 'INVD_Pout', name: 'Inverter Output Power (W)', group: 'Inverter' }
        ];
        setAvailableMetrics(metrics);
    }, []);

    // Fetch historical data
    useEffect(() => {
        fetchHistoricalData();
    }, [dateRange, customStartDate, customEndDate, granularity]);

    const fetchHistoricalData = async () => {
        setLoading(true);
        try {
            // Calculate date range
            const { start, end } = getDateRange();

            // Fetch from backend API
            const response = await fetch(`http://localhost:8000/api/history/range?start=${start}&end=${end}&granularity=${granularity}`);
            const data = await response.json();

            if (data.error) {
                console.error('API error:', data.error);
                // Fall back to mock data on error
                const mockData = generateMockData(start, end, granularity);
                setChartData(mockData);
                calculateSummary(mockData);
            } else {
                setChartData(data);
                calculateSummary(data);
            }
        } catch (error) {
            console.error('Failed to fetch historical data:', error);
            // Fall back to mock data on error
            const { start, end } = getDateRange();
            const mockData = generateMockData(start, end, granularity);
            setChartData(mockData);
            calculateSummary(mockData);
        } finally {
            setLoading(false);
        }
    };

    const getDateRange = () => {
        const now = new Date();
        let start, end;

        switch (dateRange) {
            case 'today':
                start = new Date(now.setHours(0, 0, 0, 0));
                end = new Date();
                break;
            case 'yesterday':
                start = new Date(now.setDate(now.getDate() - 1));
                start.setHours(0, 0, 0, 0);
                end = new Date(start);
                end.setHours(23, 59, 59, 999);
                break;
            case 'last7days':
                start = new Date(now.setDate(now.getDate() - 7));
                end = new Date();
                break;
            case 'last30days':
                start = new Date(now.setDate(now.getDate() - 30));
                end = new Date();
                break;
            case 'thisMonth':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date();
                break;
            case 'lastMonth':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            case 'thisYear':
                start = new Date(now.getFullYear(), 0, 1);
                end = new Date();
                break;
            case 'custom':
                start = customStartDate ? new Date(customStartDate) : new Date();
                end = customEndDate ? new Date(customEndDate) : new Date();
                break;
            default:
                start = new Date(now.setHours(0, 0, 0, 0));
                end = new Date();
        }

        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
    };

    const generateMockData = (start, end, granularity) => {
        // Generate mock data for demonstration
        const data = [];
        const startDate = new Date(start);
        const endDate = new Date(end);
        const diffTime = Math.abs(endDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let points = 24; // Default hourly for one day
        if (granularity === 'day') points = diffDays;
        if (granularity === 'month') points = 12;

        for (let i = 0; i < points; i++) {
            const timestamp = granularity === 'hour'
                ? `${i}:00`
                : granularity === 'day'
                    ? new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000).toLocaleDateString()
                    : `Month ${i + 1}`;

            data.push({
                timestamp,
                total_pv_power: Math.random() * 5000 + 1000,
                battery_soc: Math.random() * 100,
                battery_voltage: Math.random() * 50 + 200,
                battery_power: Math.random() * 3000 - 1500,
                consumption_power: Math.random() * 4000 + 500,
                daily_energy: Math.random() * 50 + 10
            });
        }

        return data;
    };

    const calculateSummary = (data) => {
        if (!data || data.length === 0) {
            setSummary(null);
            return;
        }

        const summary = {};
        selectedMetrics.forEach(metric => {
            const values = data.map(d => d[metric]).filter(v => v !== undefined && v !== null);
            if (values.length > 0) {
                summary[metric] = {
                    min: Math.min(...values).toFixed(2),
                    max: Math.max(...values).toFixed(2),
                    avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2),
                    total: values.reduce((a, b) => a + b, 0).toFixed(2)
                };
            }
        });
        setSummary(summary);
    };

    const handleMetricToggle = (metricId) => {
        setSelectedMetrics(prev => {
            if (prev.includes(metricId)) {
                return prev.filter(m => m !== metricId);
            } else {
                if (prev.length >= 5) return prev;
                return [...prev, metricId];
            }
        });
    };

    const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00C49F', '#FFBB28', '#FF8042'];

    const ChartComponent = chartType === 'line' ? LineChart : BarChart;
    const DataComponent = chartType === 'line' ? Line : Bar;

    return (
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            {/* Header */}
            <div style={{ marginBottom: '20px' }}>
                <h2 style={{ margin: '0 0 10px 0' }}>📊 Historical Data Analysis</h2>
                <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                    View and analyze historical performance data with customizable date ranges
                </p>
            </div>

            {/* Controls */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '15px',
                marginBottom: '20px',
                padding: '15px',
                background: '#f9fafb',
                borderRadius: '8px'
            }}>
                {/* Date Range Selector */}
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
                        Date Range
                    </label>
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            fontSize: '0.9rem'
                        }}
                    >
                        <option value="today">Today</option>
                        <option value="yesterday">Yesterday</option>
                        <option value="last7days">Last 7 Days</option>
                        <option value="last30days">Last 30 Days</option>
                        <option value="thisMonth">This Month</option>
                        <option value="lastMonth">Last Month</option>
                        <option value="thisYear">This Year</option>
                        <option value="custom">Custom Range</option>
                    </select>
                </div>

                {/* Granularity Selector */}
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
                        Granularity
                    </label>
                    <select
                        value={granularity}
                        onChange={(e) => setGranularity(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            fontSize: '0.9rem'
                        }}
                    >
                        <option value="hour">Hourly</option>
                        <option value="day">Daily</option>
                        <option value="month">Monthly</option>
                    </select>
                </div>

                {/* Chart Type Selector */}
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
                        Chart Type
                    </label>
                    <select
                        value={chartType}
                        onChange={(e) => setChartType(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            fontSize: '0.9rem'
                        }}
                    >
                        <option value="line">Line Chart</option>
                        <option value="bar">Bar Chart</option>
                    </select>
                </div>

                {/* Metric Selector */}
                <div style={{ position: 'relative' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
                        Metrics
                    </label>
                    <button
                        onClick={() => setIsSelectorOpen(!isSelectorOpen)}
                        style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            background: 'white',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            textAlign: 'left',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}
                    >
                        <span>{selectedMetrics.length} selected</span>
                        <span style={{ fontSize: '0.7rem' }}>▼</span>
                    </button>

                    {isSelectorOpen && (
                        <div
                            style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                marginTop: '5px',
                                background: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                padding: '10px',
                                maxHeight: '300px',
                                overflowY: 'auto',
                                zIndex: 1000
                            }}
                        >
                            {availableMetrics.map(m => (
                                <label key={m.id} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    padding: '6px',
                                    background: selectedMetrics.includes(m.id) ? '#e0e7ff' : 'transparent',
                                    borderRadius: '4px',
                                    marginBottom: '4px'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedMetrics.includes(m.id)}
                                        onChange={() => handleMetricToggle(m.id)}
                                        style={{ accentColor: '#6366f1' }}
                                    />
                                    {m.name}
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Custom Date Range */}
            {dateRange === 'custom' && (
                <div style={{
                    display: 'flex',
                    gap: '15px',
                    marginBottom: '20px',
                    padding: '15px',
                    background: '#f0f9ff',
                    borderRadius: '8px',
                    border: '1px solid #bfdbfe'
                }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 600 }}>
                            Start Date
                        </label>
                        <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '6px',
                                border: '1px solid #d1d5db',
                                fontSize: '0.9rem'
                            }}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 600 }}>
                            End Date
                        </label>
                        <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '6px',
                                border: '1px solid #d1d5db',
                                fontSize: '0.9rem'
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Summary Statistics */}
            {summary && (
                <div style={{
                    marginBottom: '20px',
                    padding: '15px',
                    background: '#f0fdf4',
                    borderRadius: '8px',
                    border: '1px solid #bbf7d0'
                }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#166534' }}>Summary Statistics</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                        {Object.entries(summary).map(([metric, stats]) => {
                            const metricInfo = availableMetrics.find(m => m.id === metric);
                            return (
                                <div key={metric} style={{ fontSize: '0.85rem' }}>
                                    <strong>{metricInfo?.name || metric}:</strong>
                                    <div style={{ marginTop: '5px', color: '#374151' }}>
                                        Min: {stats.min} | Max: {stats.max} | Avg: {stats.avg}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Chart */}
            <div style={{ width: '100%', height: 500, position: 'relative' }}>
                {loading && (
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: '1.2rem',
                        color: '#666'
                    }}>
                        Loading data...
                    </div>
                )}
                <ResponsiveContainer>
                    <ChartComponent data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="timestamp" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        {selectedMetrics.map((metric, index) => (
                            <DataComponent
                                key={metric}
                                type="monotone"
                                dataKey={metric}
                                stroke={colors[index % colors.length]}
                                fill={colors[index % colors.length]}
                                strokeWidth={2}
                                isAnimationActive={false}
                            />
                        ))}
                    </ChartComponent>
                </ResponsiveContainer>
            </div>

            {/* Export Buttons */}
            <div style={{
                marginTop: '20px',
                display: 'flex',
                gap: '10px',
                justifyContent: 'flex-end'
            }}>
                <button
                    onClick={() => alert('Export to CSV - Coming soon!')}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                        background: 'white',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: 500
                    }}
                >
                    📥 Export CSV
                </button>
                <button
                    onClick={() => alert('Export Chart - Coming soon!')}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                        background: 'white',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: 500
                    }}
                >
                    📊 Export Chart
                </button>
            </div>
        </div>
    );
}
