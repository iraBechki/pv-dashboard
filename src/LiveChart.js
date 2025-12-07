import React, { useState, useEffect, useMemo } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

export function LiveChart({ latestMeasurement, config }) {
    const [chartData, setChartData] = useState([]);
    const [selectedMetrics, setSelectedMetrics] = useState(['total_pv_power']);
    const [availableMetrics, setAvailableMetrics] = useState([]);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);

    // Fetch history on mount
    useEffect(() => {
        fetch("http://localhost:8000/api/history/today")
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    const processed = data.map(processMeasurement);
                    setChartData(processed);
                    if (data.length > 0) {
                        discoverMetrics(data[data.length - 1]);
                    }
                }
            })
            .catch(err => console.error("Failed to load history:", err));
    }, []);

    // Handle new measurement
    useEffect(() => {
        if (latestMeasurement) {
            const newData = processMeasurement(latestMeasurement);
            setChartData(prev => {
                if (prev.length > 0 && prev[prev.length - 1].timestamp === newData.timestamp) {
                    return prev;
                }
                return [...prev, newData];
            });
            discoverMetrics(latestMeasurement);
        }
    }, [latestMeasurement]);

    const discoverMetrics = (msg) => {
        const metrics = [];

        // 1. Calculations
        if (msg.calculations) {
            Object.keys(msg.calculations).forEach(key => {
                metrics.push({ id: key, name: formatMetricName(key), group: 'Calculated' });
            });
        }

        // 2. Raw Data
        if (msg.data) {
            Object.entries(msg.data).forEach(([mbId, fields]) => {
                Object.keys(fields).forEach(field => {
                    // Filter out unwanted fields
                    if (field === 'BattS' || field === 'Rssi' || field === 'RSSI') return;

                    const id = `${mbId}_${field}`;
                    const name = getReadableName(mbId, field);
                    metrics.push({ id, name, group: mbId });
                });
            });
        }

        setAvailableMetrics(prev => {
            const prevIds = new Set(prev.map(m => m.id));
            const newMetrics = metrics.filter(m => !prevIds.has(m.id));
            if (newMetrics.length > 0) {
                return [...prev, ...newMetrics];
            }
            return prev;
        });
    };

    const getReadableName = (mbId, field) => {
        // Special handling for INVD (Inverter RS-485 data)
        if (mbId === 'INVD') {
            const invdLabels = {
                'PV1_V': 'Inverter PV1 Voltage (V)',
                'PV1_I': 'Inverter PV1 Current (A)',
                'PV2_V': 'Inverter PV2 Voltage (V)',
                'PV2_I': 'Inverter PV2 Current (A)',
                'Vbat': 'Inverter Battery Voltage (V)',
                'Ibat': 'Inverter Battery Current (A)',
                'Vout': 'Inverter Output Voltage (V)',
                'Iout': 'Inverter Output Current (A)',
                'Pout': 'Inverter Output Power (W)',
                'BattS': 'Battery Status',
                'Rssi': 'Signal Strength'
            };
            return invdLabels[field] || `Inverter ${field}`;
        }

        // Try to find a better name from config
        if (config && config.assignments) {
            // Check if this MB is assigned to a specific point
            for (const [pointId, mbIds] of Object.entries(config.assignments)) {
                if (mbIds.includes(mbId)) {
                    // Found assignment, e.g. "arr-1-str-1"
                    // Map field type
                    let type = field;
                    if (field.startsWith('V')) type = "Voltage";
                    if (field.startsWith('I') || field.startsWith('A')) type = "Current";
                    if (field.startsWith('T')) type = "Temp";
                    if (field === 'G') type = "Irradiance";

                    return `${pointId} ${type} (${field})`;
                }
            }
        }

        // Fallback: clean up the ID
        return `${mbId} ${field}`;
    };

    const formatMetricName = (key) => {
        return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const processMeasurement = (msg) => {
        const timestamp = new Date(msg.timestamp).toLocaleTimeString();
        const values = { timestamp };

        if (msg.calculations) {
            Object.assign(values, msg.calculations);
        }

        if (msg.data) {
            for (const [mbId, fields] of Object.entries(msg.data)) {
                for (const [field, val] of Object.entries(fields)) {
                    values[`${mbId}_${field}`] = val;
                }
            }
        }

        return values;
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

    return (
        <div className="live-chart-container" style={{ background: 'white', padding: '20px', borderRadius: '12px', marginTop: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', position: 'relative' }}>
                <h3 style={{ margin: 0 }}>Live System Performance</h3>
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => setIsSelectorOpen(!isSelectorOpen)}
                        style={{
                            background: '#f3f4f6',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: 500,
                            color: '#374151',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        Select Metrics ({selectedMetrics.length}/5)
                        <span style={{ fontSize: '0.7rem' }}>▼</span>
                    </button>

                    {/* Dropdown Selector */}
                    {isSelectorOpen && (
                        <div
                            style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: '8px',
                                background: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                padding: '12px',
                                minWidth: '400px',
                                maxWidth: '500px',
                                maxHeight: '400px',
                                overflowY: 'auto',
                                zIndex: 1000
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div style={{ marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #e5e7eb' }}>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>
                                    Choose up to 5 metrics to display on the chart
                                </p>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
                                {availableMetrics.map(m => (
                                    <label key={m.id} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        padding: '8px',
                                        background: selectedMetrics.includes(m.id) ? '#e0e7ff' : '#f9fafb',
                                        borderRadius: '6px',
                                        border: selectedMetrics.includes(m.id) ? '1px solid #6366f1' : '1px solid #e5e7eb',
                                        transition: 'all 0.2s'
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedMetrics.includes(m.id)}
                                            onChange={() => handleMetricToggle(m.id)}
                                            style={{ accentColor: '#6366f1' }}
                                        />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.name}>
                                            {m.name}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ width: '100%', height: 400 }}>
                <ResponsiveContainer>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="timestamp" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        {selectedMetrics.map((metric, index) => (
                            <Line
                                key={metric}
                                type="monotone"
                                dataKey={metric}
                                stroke={colors[index % colors.length]}
                                dot={false}
                                strokeWidth={2}
                                isAnimationActive={false}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div className="latest-values" style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginTop: '15px', justifyContent: 'center' }}>
                {selectedMetrics.map((metric, index) => {
                    const lastVal = chartData.length > 0 ? chartData[chartData.length - 1][metric] : '--';
                    const meta = availableMetrics.find(m => m.id === metric);
                    return (
                        <div key={metric} style={{ color: colors[index % colors.length], fontWeight: 'bold', fontSize: '0.9rem' }}>
                            {meta ? meta.name : metric}: {typeof lastVal === 'number' ? lastVal.toFixed(2) : lastVal}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
