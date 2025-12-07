import { useState, useEffect, useRef } from "react";
import { LiveChart } from "./LiveChart";
import { HistoricalChart } from "./HistoricalChart";
import "./Pages.css";
import { ConfigDialog } from "./ConfigDialog";

// Dashboard Page
export function DashboardPage() {
  const [measurementData, setMeasurementData] = useState(null);
  const [config, setConfig] = useState(null);
  const wsRef = useRef(null);

  // Load config
  useEffect(() => {
    fetch("http://localhost:8000/api/config")
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(err => console.error("Failed to load config:", err));
  }, []);

  // WebSocket connection
  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8000/ws");

    socket.onopen = () => console.log("Dashboard connected to WebSocket");

    socket.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        if (response.type === "measurement" && response.data) {
          setMeasurementData(response);
        }
      } catch (e) {
        console.error("Dashboard WS error:", e);
      }
    };

    socket.onclose = () => console.log("Dashboard WebSocket closed");

    wsRef.current = socket;

    return () => {
      if (socket) socket.close();
    };
  }, []);

  return (
    <>
      <MetricsCards data={measurementData} config={config} />
      <MainContent data={measurementData} config={config} />
      <EnvironmentalCards data={measurementData} />
    </>
  );
}

function EnvironmentalCards({ data }) {
  // Calculate environmental impact based on total energy (kWh)
  // Factors:
  // CO2: ~0.4 kg per kWh (global average)
  // Coal: ~0.16 kg per kWh
  // Trees: ~0.02 trees per kWh (or 1 tree per ~50 kWh)

  const [impact, setImpact] = useState({
    co2: 0,
    coal: 0,
    trees: 0
  });

  useEffect(() => {
    if (data && data.calculations && data.calculations.total_energy !== undefined) {
      const totalKwh = data.calculations.total_energy;
      setImpact({
        co2: (totalKwh * 0.4).toFixed(1),
        coal: (totalKwh * 0.16).toFixed(1),
        trees: Math.floor(totalKwh * 0.02)
      });
    }
  }, [data]);

  return (
    <div className="environmental-grid">
      <div className="env-card">
        <div className="env-icon">🌱</div>
        <div className="env-info">
          <div className="env-value">{impact.co2}kg</div>
          <div className="env-label">CO₂ reduced</div>
        </div>
      </div>
      <div className="env-card">
        <div className="env-icon">🪨</div>
        <div className="env-info">
          <div className="env-value">{impact.coal}kg</div>
          <div className="env-label">Coal saved</div>
        </div>
      </div>
      <div className="env-card">
        <div className="env-icon">🌲</div>
        <div className="env-info">
          <div className="env-value">{impact.trees}</div>
          <div className="env-label">Deforestation reduced</div>
        </div>
      </div>
    </div>
  );
}

// Analytics Page
export function AnalyticsPage() {
  return (
    <div className="page-content">
      <h2 className="page-title">📈 Analytics</h2>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        textAlign: 'center',
        color: '#666'
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📊</div>
        <h3 style={{ fontSize: '1.5rem', color: '#333', marginBottom: '0.5rem' }}>Coming Soon</h3>
        <p style={{ fontSize: '1rem', maxWidth: '500px' }}>
          Advanced analytics and performance insights will be available here soon.
        </p>
      </div>
    </div>
  );
}

// History Page
export function HistoryPage() {
  const [config, setConfig] = useState(null);

  // Load config
  useEffect(() => {
    fetch("http://localhost:8000/api/config")
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(err => console.error("Failed to load config:", err));
  }, []);

  return (
    <div className="page-content">
      <HistoricalChart config={config} />
    </div>
  );
}

// Alerts Page
export function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [viewMode, setViewMode] = useState('active'); // 'active' or 'history'
  const [severityFilter, setSeverityFilter] = useState('all'); // all, critical, error, warning, info

  const fetchAlerts = async () => {
    try {
      // If viewMode is 'active', we could filter by unread/unresolved, 
      // but for now we fetch all and filter client-side or use API params if available.
      // The current API supports severity. We'll fetch a larger limit for history.
      const limit = viewMode === 'history' ? 100 : 50;
      const response = await fetch(`http://localhost:8000/api/alerts?limit=${limit}`);
      if (response.ok) {
        const data = await response.json();
        setAlerts(data);
      }
    } catch (err) {
      console.error("Failed to fetch alerts", err);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [viewMode]); // Refetch when switching views

  const acknowledgeAlert = async (alertId) => {
    try {
      await fetch(`http://localhost:8000/api/alerts/${alertId}/acknowledge`, {
        method: 'POST'
      });
      fetchAlerts();
    } catch (err) {
      console.error("Failed to acknowledge alert", err);
    }
  };

  const deleteAlert = async (alertId) => {
    if (!window.confirm("Are you sure you want to delete this alert?")) return;
    try {
      await fetch(`http://localhost:8000/api/alerts/${alertId}`, {
        method: 'DELETE'
      });
      fetchAlerts();
    } catch (err) {
      console.error("Failed to delete alert", err);
    }
  };

  // Filter alerts based on View Mode and Severity Filter
  const filteredAlerts = alerts.filter(alert => {
    // 1. View Mode Filter
    if (viewMode === 'active') {
      // Active = Not Resolved
      if (alert.resolved) return false;
    }
    // History shows everything, so no filter needed for 'history'

    // 2. Severity Filter
    if (severityFilter !== 'all') {
      if (alert.severity.toLowerCase() !== severityFilter) return false;
    }

    return true;
  });

  return (
    <div className="page-content">
      <div className="alerts-header-row">
        <h2 className="page-title">🔔 Alerts & Notifications</h2>
        <div className="view-mode-tabs">
          <button
            className={`tab-btn ${viewMode === 'active' ? 'active' : ''}`}
            onClick={() => setViewMode('active')}
          >
            Active Alerts
          </button>
          <button
            className={`tab-btn ${viewMode === 'history' ? 'active' : ''}`}
            onClick={() => setViewMode('history')}
          >
            History
          </button>
        </div>
      </div>

      <div className="alert-controls">
        <div className="severity-filters">
          <button className={`filter-pill ${severityFilter === 'all' ? 'active' : ''}`} onClick={() => setSeverityFilter('all')}>All</button>
          <button className={`filter-pill critical ${severityFilter === 'critical' ? 'active' : ''}`} onClick={() => setSeverityFilter('critical')}>🚨 Critical</button>
          <button className={`filter-pill error ${severityFilter === 'error' ? 'active' : ''}`} onClick={() => setSeverityFilter('error')}>❌ Error</button>
          <button className={`filter-pill warning ${severityFilter === 'warning' ? 'active' : ''}`} onClick={() => setSeverityFilter('warning')}>⚠️ Warning</button>
          <button className={`filter-pill info ${severityFilter === 'info' ? 'active' : ''}`} onClick={() => setSeverityFilter('info')}>ℹ️ Info</button>
        </div>
        <button className="refresh-btn" onClick={fetchAlerts}>🔄 Refresh</button>
      </div>

      <div className="alerts-grid">
        {filteredAlerts.length === 0 ? (
          <div className="no-alerts">
            {viewMode === 'active' ? 'No active alerts' : 'No alert history found'}
          </div>
        ) : (
          filteredAlerts.map(alert => (
            <AlertItem
              key={alert.id}
              alert={alert}
              onAcknowledge={acknowledgeAlert}
              onDelete={deleteAlert}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Settings Page (Admin only)
export function SettingsPage() {
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [diagnosisEnabled, setDiagnosisEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    fetch('http://localhost:8000/api/diagnosis/settings')
      .then(res => res.json())
      .then(data => {
        if (data) {
          setDiagnosisEnabled(data.enabled);
          // Ensure we use the correct field from API
          if (data.notifications_enabled !== undefined) {
            setNotificationsEnabled(data.notifications_enabled);
          }
        }
      })
      .catch(err => console.error("Failed to fetch diagnosis settings", err));
  }, []);

  const updateSettings = async (enabled, notifications) => {
    try {
      await fetch('http://localhost:8000/api/diagnosis/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: enabled,
          notifications_enabled: notifications
        })
      });
    } catch (err) {
      console.error("Failed to update settings", err);
    }
  };

  const handleDiagnosisChange = (e) => {
    const newVal = e.target.checked;
    setDiagnosisEnabled(newVal);
    updateSettings(newVal, notificationsEnabled);
  };

  const handleNotificationsChange = (e) => {
    const newVal = e.target.checked;
    setNotificationsEnabled(newVal);
    updateSettings(diagnosisEnabled, newVal);
  };

  return (
    <div className="page-content">
      <h2 className="page-title">⚙️ Settings</h2>
      <div className="settings-grid">
        <div className="settings-card">
          <h3>System Configuration</h3>
          <p>Configure system parameters and thresholds</p>
          <button className="settings-btn" onClick={() => setIsConfigDialogOpen(true)}>Configure</button>
        </div>

        <div className="settings-card">
          <h3>Diagnosis & Alerts</h3>
          <div className="setting-row" style={{ marginBottom: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={diagnosisEnabled}
                onChange={handleDiagnosisChange}
              />
              Enable System Diagnosis
            </label>
          </div>
          <div className="setting-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={handleNotificationsChange}
              />
              Enable Alert Notifications
            </label>
          </div>
        </div>

        <div className="settings-card">
          <h3>Data Export</h3>
          <p>Export historical data in various formats</p>
          <button className="settings-btn">Export Data</button>
        </div>
        <div className="settings-card">
          <h3>System Info</h3>
          <p>View system information and logs</p>
          <button className="settings-btn">View Info</button>
        </div>
      </div>

      <ConfigDialog
        isOpen={isConfigDialogOpen}
        onClose={() => setIsConfigDialogOpen(false)}
      />
    </div>
  );
}

// Users Page (Admin only)
export function UsersPage() {
  return (
    <div className="page-content">
      <h2 className="page-title">👥 User Management</h2>
      <div className="users-actions">
        <button className="add-user-btn">+ Add New User</button>
      </div>
      <div className="users-table">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Admin User</td>
              <td>admin@pv.com</td>
              <td>
                <span className="role-badge admin">Admin</span>
              </td>
              <td>
                <span className="status-badge active">Active</span>
              </td>
              <td>
                <button className="action-btn">Edit</button>
              </td>
            </tr>
            <tr>
              <td>Regular User</td>
              <td>user@pv.com</td>
              <td>
                <span className="role-badge user">User</span>
              </td>
              <td>
                <span className="status-badge active">Active</span>
              </td>
              <td>
                <button className="action-btn">Edit</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Helper components used by Dashboard ---------- */

function AlertItem({ alert, onAcknowledge, onDelete }) {
  const severityClass = alert.severity ? alert.severity.toLowerCase() : 'info';
  const icon = {
    info: "ℹ️",
    warning: "⚠️",
    error: "❌",
    critical: "🚨"
  }[severityClass] || "ℹ️";

  return (
    <div className={`alert-item ${severityClass} ${alert.acknowledged ? 'acknowledged' : ''} ${alert.resolved ? 'resolved' : ''}`}>
      <div className="alert-header-compact">
        <span className="alert-icon-small">{icon}</span>
        <h4 className="alert-title-compact">{alert.title}</h4>
        <span className="alert-time-compact">{new Date(alert.timestamp).toLocaleTimeString()}</span>
      </div>
      <div className="alert-body-compact">
        <p>{alert.message}</p>
        {alert.component && <div className="alert-meta">
          <span className="meta-tag">{alert.component}</span>
          {alert.value && <span className="meta-tag value">{alert.value}</span>}
        </div>}
      </div>
      <div className="alert-footer-compact">
        <div className="status-badges">
          {alert.resolved && <span className="badge resolved">✓ Resolved</span>}
          {alert.acknowledged && <span className="badge ack">👁️ Ack</span>}
        </div>
        <div className="action-buttons">
          {!alert.acknowledged && (
            <button className="ack-btn-tiny" onClick={() => onAcknowledge(alert.id)}>Ack</button>
          )}
          <button className="delete-btn-tiny" onClick={() => onDelete(alert.id)} title="Delete Alert">🗑️</button>
        </div>
      </div>
    </div>
  );
}

function MetricsCards({ data, config }) {
  // Use state to persist last known values
  const [avgVoltage, setAvgVoltage] = useState("--");
  const [batteryPercent, setBatteryPercent] = useState("--");
  const [mbCount, setMbCount] = useState(0);
  const [dailyEnergy, setDailyEnergy] = useState(0);
  const [monthlyEnergy, setMonthlyEnergy] = useState(0);
  const [totalEnergy, setTotalEnergy] = useState(0);

  // Weather state
  const [weather, setWeather] = useState({
    temperature: null,
    condition: "Loading...",
    windSpeed: null,
    windDirection: null,
    sunrise: null,
    sunset: null,
    loading: true,
    error: null
  });

  // Fetch weather data from Open-Meteo API
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // Using coordinates for Bab Ezzouar, Algeria
        const latitude = 36.72;
        const longitude = 3.19;

        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weathercode,windspeed_10m,winddirection_10m&daily=sunrise,sunset&timezone=auto`
        );

        if (!response.ok) {
          throw new Error('Weather API request failed');
        }

        const weatherData = await response.json();

        // Map weather codes to conditions
        const getWeatherCondition = (code) => {
          if (code === 0) return "Clear";
          if (code <= 3) return "Partly Cloudy";
          if (code <= 48) return "Foggy";
          if (code <= 67) return "Rainy";
          if (code <= 77) return "Snowy";
          if (code <= 82) return "Showers";
          if (code <= 99) return "Thunderstorm";
          return "Unknown";
        };

        setWeather({
          temperature: weatherData.current.temperature_2m,
          humidity: weatherData.current.relative_humidity_2m,
          condition: getWeatherCondition(weatherData.current.weathercode),
          windSpeed: weatherData.current.windspeed_10m,
          windDirection: weatherData.current.winddirection_10m,
          sunrise: weatherData.daily.sunrise[0],
          sunset: weatherData.daily.sunset[0],
          loading: false,
          error: null
        });
      } catch (error) {
        console.error("Failed to fetch weather data:", error);
        setWeather(prev => ({
          ...prev,
          loading: false,
          error: "Unable to load weather data"
        }));
      }
    };

    fetchWeather();

    // Refresh weather data every 10 minutes
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (data && data.data) {
      let totalVoltage = 0;
      let voltageCount = 0;
      let avgBattery = 0;
      let battCount = 0;
      let activeMBs = 0;

      for (const [mbId, fields] of Object.entries(data.data)) {
        activeMBs++;
        for (const [fieldName, value] of Object.entries(fields)) {
          if (fieldName.includes("V") && !fieldName.includes("Batt") && typeof value === 'number') {
            totalVoltage += value;
            voltageCount++;
          }
          if (fieldName.includes("Batt") && typeof value === 'number') {
            avgBattery += value;
            battCount++;
          }
        }
      }

      if (voltageCount > 0) {
        setAvgVoltage((totalVoltage / voltageCount).toFixed(1));
      }
      if (battCount > 0) {
        setBatteryPercent((avgBattery / battCount).toFixed(0));
      }
      setMbCount(activeMBs);
    }

    // Extract energy data from calculations
    if (data && data.calculations) {
      if (data.calculations.daily_energy !== undefined) {
        setDailyEnergy(data.calculations.daily_energy);
      }
      if (data.calculations.monthly_energy !== undefined) {
        setMonthlyEnergy(data.calculations.monthly_energy);
      }
      if (data.calculations.total_energy !== undefined) {
        setTotalEnergy(data.calculations.total_energy);
      }
    }
  }, [data]);

  const systemStatus = data ? "Online" : "Waiting";

  return (
    <div className="metrics-grid">
      <GenerationCard
        dailyEnergy={dailyEnergy}
        monthlyEnergy={monthlyEnergy}
        totalEnergy={totalEnergy}
        status={data ? "good" : "neutral"}
      />
      <MetricCard title="MB Battery" value={batteryPercent} unit="%" status={batteryPercent > 50 ? "good" : "warning"} />
      <MetricCard title="System Status" value={systemStatus} unit="" status={data ? "good" : "neutral"} />
      <WeatherCard weather={weather} />
    </div>
  );
}

// New card component for power generation display
function GenerationCard({ dailyEnergy, monthlyEnergy, totalEnergy, status }) {
  return (
    <div className={`metric-card ${status}`}>
      <h3>Power Generation</h3>
      <div className="generation-details">
        <div className="generation-row today">
          <span className="label">Today:</span>
          <span className="value-bold">{dailyEnergy.toFixed(3)} kWh</span>
        </div>
        <div className="generation-row">
          <span className="label">This Month:</span>
          <span className="value-normal">{monthlyEnergy.toFixed(3)} kWh</span>
        </div>
        <div className="generation-row">
          <span className="label">Total:</span>
          <span className="value-normal">{totalEnergy.toFixed(3)} kWh</span>
        </div>
      </div>
      <div className={`status-indicator ${status}`} />
    </div>
  );
}

function MetricCard({ title, value, unit, status, wide = false }) {
  return (
    <div className={`metric-card ${status} ${wide ? 'metric-card-wide' : ''}`}>
      <h3>{title}</h3>
      <div className="metric-value">
        <span className="value">{value}</span>
        <span className="unit">{unit}</span>
      </div>
      <div className={`status-indicator ${status}`} />
    </div>
  );
}

function WeatherCard({ weather }) {
  const formatTime = (isoString) => {
    if (!isoString) return '--';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const getCardinalDirection = (degrees) => {
    if (degrees === null || degrees === undefined) return '--';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
  };

  const getWeatherIcon = (condition) => {
    switch (condition) {
      case 'Clear': return '☀️';
      case 'Partly Cloudy': return '⛅';
      case 'Foggy': return '🌫️';
      case 'Rainy': return '🌧️';
      case 'Snowy': return '❄️';
      case 'Showers': return '🌦️';
      case 'Thunderstorm': return '⛈️';
      default: return '🌤️';
    }
  };

  if (weather.loading) {
    return (
      <div className="metric-card neutral weather-card-tall">
        <h3>Weather</h3>
        <div className="metric-value">
          <span className="value">Loading...</span>
        </div>
      </div>
    );
  }

  if (weather.error) {
    return (
      <div className="metric-card error weather-card-tall">
        <h3>Weather</h3>
        <div className="metric-value">
          <span className="value" style={{ fontSize: '1rem' }}>{weather.error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="metric-card good weather-card-tall">
      <div className="weather-details">
        <div className="weather-location">📍 Bab Ezzouar, Algeria</div>

        <div className="weather-main-row">
          <div className="weather-temp-group">
            <span className="weather-temp-large">{weather.temperature?.toFixed(1) || '--'}°</span>
            <span className="weather-unit">C</span>
          </div>
          <div className="weather-icon-large">{getWeatherIcon(weather.condition)}</div>
        </div>

        <div className="weather-info-grid">
          <div className="weather-vertical-item">
            <span className="weather-label-small">Sunrise</span>
            <span className="weather-value-small">{formatTime(weather.sunrise)}</span>
          </div>
          <div className="weather-vertical-item">
            <span className="weather-label-small">Sunset</span>
            <span className="weather-value-small">{formatTime(weather.sunset)}</span>
          </div>
          <div className="weather-vertical-item">
            <span className="weather-label-small">Wind</span>
            <span className="weather-value-small">
              {weather.windSpeed?.toFixed(1) || '--'} <span className="wind-unit">km/h</span>
            </span>
          </div>
          <div className="weather-vertical-item">
            <span className="weather-label-small">Humidity</span>
            <span className="weather-value-small">{weather.humidity || '--'}%</span>
          </div>
        </div>
      </div>
      <div className="status-indicator good" />
    </div>
  );
}

function MainContent({ data, config }) {
  return (
    <div className="main-content">
      <LiveChart latestMeasurement={data} config={config} />
      <StationOverview data={data} config={config} />
    </div>
  );
}

/* StationOverview - modern icon-based flow diagram */
function StationOverview({ data, config }) {
  const [pvPower, setPvPower] = useState(0); // W
  const [inverterStatus, setInverterStatus] = useState("offline");
  const [gridFlow, setGridFlow] = useState(0); // kW
  const [storageLevel, setStorageLevel] = useState(null); // %
  const [chargingPower, setChargingPower] = useState(0); // kW
  const [powerConsumption, setPowerConsumption] = useState(0); // kW
  const [irradiance, setIrradiance] = useState(0); // W/m²
  const [selectedComponent, setSelectedComponent] = useState(null);

  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread alerts count
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/alerts/unread');
        if (response.ok) {
          const data = await response.json();
          setUnreadCount(data.count);
        }
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  // INVD Data state
  const [invdData, setInvdData] = useState({
    PV1_V: 0, PV1_I: 0,
    PV2_V: 0, PV2_I: 0,
    Vbat: 0, Ibat: 0,
    Vout: 0, Iout: 0, Pout: 0
  });

  // Alert states for visual indicators
  const [componentAlerts, setComponentAlerts] = useState({});
  const [stationAlertCount, setStationAlertCount] = useState(0);

  // Fetch alerts for station components
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/alerts?limit=100');
        const alerts = await response.json();

        // Filter unresolved alerts
        const activeAlerts = alerts.filter(alert => !alert.resolved);

        // Group alerts by component
        const alertsByComponent = {};
        let stationCount = 0;

        activeAlerts.forEach(alert => {
          if (alert.component) {
            // Map component names to station components
            let componentKey = null;

            if (alert.component.includes('VD') || alert.component.includes('ID') ||
              alert.component === 'solar' || alert.component.includes('INVD_PV')) {
              componentKey = 'solar';
            } else if (alert.component === 'battery' || alert.component.includes('bat')) {
              componentKey = 'storage';
            } else if (alert.component === 'inverter') {
              componentKey = 'inverter';
            } else if (alert.component === 'consumption' || alert.component.includes('load')) {
              componentKey = 'consumption';
            }

            if (componentKey) {
              if (!alertsByComponent[componentKey]) {
                alertsByComponent[componentKey] = [];
              }
              alertsByComponent[componentKey].push(alert);
              stationCount++;
            }
          }
        });

        setComponentAlerts(alertsByComponent);
        setStationAlertCount(stationCount);
      } catch (error) {
        console.error('Error fetching alerts:', error);
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  // Helper function to get component status based on alerts
  const getComponentStatus = (componentKey) => {
    const alerts = componentAlerts[componentKey] || [];
    if (alerts.length === 0) return 'normal';

    // Check for critical or error alerts
    const hasCritical = alerts.some(a => a.severity === 'CRITICAL');
    const hasError = alerts.some(a => a.severity === 'ERROR');
    const hasWarning = alerts.some(a => a.severity === 'WARNING');

    if (hasCritical) return 'critical';
    if (hasError) return 'error';
    if (hasWarning) return 'warning';
    return 'normal';
  };

  useEffect(() => {
    if (data) {
      setInverterStatus("online");

      if (data.calculations) {
        // Update PV Power
        if (data.calculations.total_pv_power !== undefined) {
          setPvPower(data.calculations.total_pv_power);
        }

        // Update Consumption Power
        if (data.calculations.consumption_power !== undefined) {
          setPowerConsumption((data.calculations.consumption_power / 1000).toFixed(2));
        }

        // Update Battery Storage and Charging
        if (data.calculations.battery_soc !== undefined) {
          setStorageLevel(Math.round(data.calculations.battery_soc));
        }
        if (data.calculations.battery_power !== undefined) {
          setChargingPower((data.calculations.battery_power / 1000).toFixed(2));
        }
      }

      // Extract irradiance from environmental sensors
      if (data.data) {
        for (const [mbId, fields] of Object.entries(data.data)) {
          if (fields.G !== undefined && typeof fields.G === 'number') {
            setIrradiance(fields.G);
            break;
          }
        }

        // Extract INVD data
        if (data.data.INVD) {
          setInvdData(prev => ({ ...prev, ...data.data.INVD }));
        }
      }
    }
  }, [data]);

  const openDetail = (component) => setSelectedComponent(component);
  const closeDetail = () => setSelectedComponent(null);

  // Helper function to format power values (auto W/kW)
  const formatPower = (watts) => {
    if (watts >= 1000) {
      return `${(watts / 1000).toFixed(2)} kW`;
    }
    return `${watts.toFixed(1)} W`;
  };

  const handleKey = (e, name) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDetail(name);
    }
  };

  // Import icon images
  const solarIcon = require('./assets/icons/solar-panel.png');
  const batteryIcon = require('./assets/icons/battery.png');
  const inverterIcon = require('./assets/icons/inverter.png');
  const gridIcon = require('./assets/icons/grid.png');
  const houseIcon = require('./assets/icons/house.png');

  // Sun Icon SVG
  const SunIcon = () => (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="6" fill="#fbbf24" />
      <line x1="16" y1="4" x2="16" y2="8" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
      <line x1="16" y1="24" x2="16" y2="28" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="16" x2="8" y2="16" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
      <line x1="24" y1="16" x2="28" y2="16" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
      <line x1="7.75" y1="7.75" x2="10.6" y2="10.6" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
      <line x1="21.4" y1="21.4" x2="24.25" y2="24.25" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
      <line x1="7.75" y1="24.25" x2="10.6" y2="21.4" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
      <line x1="21.4" y1="10.6" x2="24.25" y2="7.75" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

  return (
    <section className="station-overview-new">
      <div className="overview-header">
        <h3>Station Overview</h3>
        <div className="header-controls">
          <div className="alert-badge-small">
            <span className="alert-count">{stationAlertCount}</span> Alert{stationAlertCount !== 1 ? 's' : ''}
          </div>
          <div className="info-icon-small">ⓘ</div>
        </div>
      </div>

      <div className="station-grid-layout">

        {/* Row 1: Solar & Irradiance */}
        <div className="grid-cell top-center">
          <div className="solar-group" style={{ position: 'relative' }}>
            {/* Irradiance - Positioned Absolute Left */}
            <div className="irradiance-container-side">
              <div className="pill-and-title-group">
                <div className="component-title" style={{ marginBottom: '0.25rem' }}>Irradiance</div>
                <div className="irradiance-pill">
                  <SunIcon />
                  <span>{irradiance.toFixed(0)} W/m²</span>
                </div>
              </div>
              <div className="irradiance-arrows">
                <div className="irradiance-arrow-line">→</div>
                <div className="irradiance-arrow-line">→</div>
                <div className="irradiance-arrow-line">→</div>
              </div>
            </div>

            {/* Title Above */}
            <div className="component-title" style={{ marginBottom: '0.25rem' }}>PV POWER</div>

            {/* Value Label */}
            <div className="value-label" style={{ marginBottom: '0.5rem' }}>
              {(pvPower / 1000).toFixed(2)} kW
            </div>

            <div
              className={`icon-wrapper solar-wrapper clickable ${getComponentStatus('solar') !== 'normal' ? 'has-alert' : ''}`}
              onClick={() => openDetail("solar")}
              onKeyDown={(e) => handleKey(e, "solar")}
              tabIndex={0}
              style={{
                boxShadow: getComponentStatus('solar') === 'critical' ? '0 0 20px rgba(220, 38, 38, 0.6)' :
                  getComponentStatus('solar') === 'error' ? '0 0 20px rgba(234, 88, 12, 0.6)' :
                    getComponentStatus('solar') === 'warning' ? '0 0 20px rgba(245, 158, 11, 0.6)' : 'none',
                animation: getComponentStatus('solar') !== 'normal' ? 'pulse 2s infinite' : 'none'
              }}
            >
              <img src={solarIcon} alt="Solar Panel" className="icon-img solar-img" />
            </div>
          </div>
        </div>

        {/* Connection: Solar to Inverter */}
        <div className="connection-dots vertical-dots top-dots">
          <span>•</span><span>•</span><span>•</span>
        </div>

        {/* Row 2: Battery - Inverter - House */}
        <div className="grid-row-middle">

          {/* Battery (Left) */}
          <div className="grid-cell left-center">
            <div className="component-group">
              <div
                className={`icon-wrapper battery-wrapper clickable ${getComponentStatus('storage') !== 'normal' ? 'has-alert' : ''}`}
                onClick={() => openDetail("storage")}
                onKeyDown={(e) => handleKey(e, "storage")}
                tabIndex={0}
                style={{
                  boxShadow: getComponentStatus('storage') === 'critical' ? '0 0 20px rgba(220, 38, 38, 0.6)' :
                    getComponentStatus('storage') === 'error' ? '0 0 20px rgba(234, 88, 12, 0.6)' :
                      getComponentStatus('storage') === 'warning' ? '0 0 20px rgba(245, 158, 11, 0.6)' : 'none',
                  animation: getComponentStatus('storage') !== 'normal' ? 'pulse 2s infinite' : 'none'
                }}
              >
                <img src={batteryIcon} alt="Battery" className="icon-img battery-img" />
                {storageLevel !== null && (
                  <div className="battery-badge">{storageLevel}%</div>
                )}
              </div>
              <div className="value-label">
                <div>{storageLevel !== null ? `${storageLevel}%` : '--'}</div>
                <div className="sub-value">{chargingPower} kW</div>
                <div className="component-title">Battery</div>
              </div>
            </div>
          </div>

          {/* Connection: Battery to Inverter */}
          <div className="connection-dots horizontal-dots left-dots">
            <span>•</span><span>•</span><span>•</span>
          </div>

          {/* Inverter (Center) */}
          <div className="grid-cell center-center">
            <div
              className={`icon-wrapper inverter-wrapper clickable ${getComponentStatus('inverter') !== 'normal' ? 'has-alert' : ''}`}
              onClick={() => openDetail("inverter")}
              onKeyDown={(e) => handleKey(e, "inverter")}
              tabIndex={0}
              style={{
                boxShadow: getComponentStatus('inverter') === 'critical' ? '0 0 20px rgba(220, 38, 38, 0.6)' :
                  getComponentStatus('inverter') === 'error' ? '0 0 20px rgba(234, 88, 12, 0.6)' :
                    getComponentStatus('inverter') === 'warning' ? '0 0 20px rgba(245, 158, 11, 0.6)' : 'none',
                animation: getComponentStatus('inverter') !== 'normal' ? 'pulse 2s infinite' : 'none'
              }}
            >
              <img src={inverterIcon} alt="Inverter" className="icon-img inverter-img" />
            </div>
          </div>

          {/* Connection: Inverter to House */}
          <div className="connection-dots horizontal-dots right-dots">
            <span>•</span><span>•</span><span>•</span>
          </div>

          {/* House (Right) */}
          <div className="grid-cell right-center">
            <div className="component-group">
              <div
                className={`icon-wrapper house-wrapper clickable ${getComponentStatus('consumption') !== 'normal' ? 'has-alert' : ''}`}
                onClick={() => openDetail("consumption")}
                onKeyDown={(e) => handleKey(e, "consumption")}
                tabIndex={0}
                style={{
                  boxShadow: getComponentStatus('consumption') === 'critical' ? '0 0 20px rgba(220, 38, 38, 0.6)' :
                    getComponentStatus('consumption') === 'error' ? '0 0 20px rgba(234, 88, 12, 0.6)' :
                      getComponentStatus('consumption') === 'warning' ? '0 0 20px rgba(245, 158, 11, 0.6)' : 'none',
                  animation: getComponentStatus('consumption') !== 'normal' ? 'pulse 2s infinite' : 'none'
                }}
              >
                <img src={houseIcon} alt="House" className="icon-img house-img" />
              </div>
              <div className="value-label">
                {powerConsumption} kW
                <div className="component-title">Load POWER</div>
              </div>
            </div>
          </div>
        </div>

        {/* Connection: Inverter to Grid */}
        <div className="connection-dots vertical-dots bottom-dots">
          <span>•</span><span>•</span><span>•</span>
        </div>

        {/* Row 3: Grid */}
        <div className="grid-cell bottom-center">
          <div className="component-group">
            <div
              className="icon-wrapper grid-wrapper clickable"
              onClick={() => openDetail("grid")}
              onKeyDown={(e) => handleKey(e, "grid")}
              tabIndex={0}
            >
              <img src={gridIcon} alt="Grid" className="icon-img grid-img" />
            </div>
            <div className="value-label">
              {gridFlow.toFixed(2)} kW
              <div className="component-title">Grid</div>
            </div>
          </div>
        </div>

      </div>

      {/* Detail modal */}
      {selectedComponent && (
        <div className="detail-overlay" onClick={closeDetail}>
          <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="detail-header">
              <h4>{selectedComponent === "solar" ? "Solar Panels" :
                selectedComponent === "storage" ? "Battery Storage" :
                  selectedComponent === "inverter" ? "Inverter" :
                    selectedComponent === "consumption" ? "Load/Consumption" : "Grid"}</h4>
              <button className="detail-close" onClick={closeDetail}>✕</button>
            </div>
            <div className="detail-body">
              {selectedComponent === "solar" && (
                <div>
                  <div style={{ marginBottom: '15px' }}>
                    <h5 style={{ margin: '0 0 8px 0', color: '#666', fontSize: '0.9rem' }}>Measured (Sensors)</h5>
                    <p style={{ margin: '2px 0', fontSize: '0.85rem' }}>Total PV Power: <strong>{(pvPower / 1000).toFixed(2)} kW</strong></p>

                    {/* Display individual string/array data based on configuration */}
                    {config && config.assignments && data && data.calculations && (
                      <div style={{ marginTop: '12px' }}>
                        {Object.entries(config.assignments).map(([pointId, mbIds]) => {
                          // Only show points that are strings (contain 'arr' and 'str')
                          if (pointId.includes('arr') && pointId.includes('str')) {
                            const calcData = data.calculations[pointId] || {};
                            const voltage = calcData.voltage || 0;
                            const current = calcData.current || 0;
                            const power = calcData.power || 0;

                            return (
                              <div key={pointId} style={{ marginBottom: '8px', paddingLeft: '10px', borderLeft: '2px solid #3b82f6' }}>
                                <p style={{ margin: '2px 0', fontSize: '0.9rem', fontWeight: '600' }}>{pointId}:</p>
                                <p style={{ margin: '2px 0', fontSize: '0.85rem' }}>
                                  V: <strong>{voltage.toFixed(1)}V</strong> |
                                  I: <strong>{current.toFixed(1)}A</strong> |
                                  P: <strong>{formatPower(power)}</strong>
                                </p>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    )}
                  </div>
                  <div style={{ borderTop: '1px solid #eee', paddingTop: '10px' }}>
                    <h5 style={{ margin: '0 0 8px 0', color: '#666', fontSize: '0.9rem' }}>Inverter Reported (RS485)</h5>
                    <p style={{ margin: '2px 0', fontSize: '0.85rem' }}>PV1: <strong>{Number(invdData.PV1_V).toFixed(1)}V / {Number(invdData.PV1_I).toFixed(1)}A</strong></p>
                    <p style={{ margin: '2px 0', fontSize: '0.85rem' }}>PV2: <strong>{Number(invdData.PV2_V).toFixed(1)}V / {Number(invdData.PV2_I).toFixed(1)}A</strong></p>
                    <p style={{ margin: '2px 0', fontSize: '0.85rem' }}>Power: <strong>{formatPower(Number(invdData.PV1_V) * Number(invdData.PV1_I) + Number(invdData.PV2_V) * Number(invdData.PV2_I))}</strong></p>
                  </div>
                </div>
              )}
              {selectedComponent === "storage" && (
                <div>
                  <div style={{ marginBottom: '15px' }}>
                    <h5 style={{ margin: '0 0 8px 0', color: '#666', fontSize: '0.9rem' }}>Measured (Sensors)</h5>
                    <p style={{ margin: '2px 0', fontSize: '0.85rem' }}>State of Charge: <strong>{storageLevel}%</strong></p>
                    <p style={{ margin: '2px 0', fontSize: '0.85rem' }}>Power: <strong>{chargingPower} kW</strong></p>
                    {/* Get voltage and current from battery sensor data */}
                    {config && config.assignments && data && data.calculations && (
                      <>
                        {Object.entries(config.assignments).map(([pointId, mbIds]) => {
                          const sensor = config.sensors?.find(s => s.id === pointId && s.category === 'battery');
                          if (sensor) {
                            const calcData = data.calculations[pointId] || {};
                            const voltage = calcData.voltage || 0;
                            const current = calcData.current || 0;
                            return (
                              <div key={pointId}>
                                <p style={{ marginBottom: '5px' }}>Voltage: <strong>{voltage.toFixed(1)} V</strong></p>
                                <p style={{ marginBottom: '5px' }}>Current: <strong>{current.toFixed(1)} A</strong></p>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </>
                    )}
                  </div>
                  <div style={{ borderTop: '1px solid #eee', paddingTop: '10px' }}>
                    <h5 style={{ margin: '0 0 8px 0', color: '#666', fontSize: '0.9rem' }}>Inverter Reported (RS485)</h5>
                    <p style={{ margin: '2px 0', fontSize: '0.85rem' }}>Voltage: <strong>{Number(invdData.Vbat).toFixed(1)} V</strong></p>
                    <p style={{ margin: '2px 0', fontSize: '0.85rem' }}>Current: <strong>{Number(invdData.Ibat).toFixed(1)} A</strong></p>
                  </div>
                </div>
              )}
              {selectedComponent === "inverter" && (
                <div>
                  {/* Status moved to header area */}
                  <div style={{ marginBottom: '10px', padding: '8px', background: '#f0f9ff', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>Status: <strong style={{ color: inverterStatus === 'online' ? '#16a34a' : '#dc2626' }}>{inverterStatus}</strong></p>
                  </div>

                  <div style={{ marginBottom: '15px' }}>
                    <h5 style={{ margin: '0 0 8px 0', color: '#666', fontSize: '0.9rem' }}>Measured (Sensors)</h5>
                    <p style={{ margin: '2px 0', fontSize: '0.85rem' }}>Input Power: <strong>{(pvPower / 1000).toFixed(2)} kW</strong></p>
                  </div>
                  <div style={{ borderTop: '1px solid #eee', paddingTop: '10px' }}>
                    <h5 style={{ margin: '0 0 8px 0', color: '#666', fontSize: '0.9rem' }}>Inverter Reported (RS485)</h5>
                    <p style={{ margin: '2px 0', fontSize: '0.85rem' }}>Input Power: <strong>{formatPower(Number(invdData.PV1_V) * Number(invdData.PV1_I) + Number(invdData.PV2_V) * Number(invdData.PV2_I))}</strong></p>
                  </div>
                </div>
              )}
              {selectedComponent === "consumption" && (
                <div>
                  <div style={{ marginBottom: '15px' }}>
                    <h5 style={{ margin: '0 0 8px 0', color: '#666', fontSize: '0.9rem' }}>Measured (Sensors)</h5>
                    {/* Get voltage and current from inverter/consumption sensor data */}
                    {config && config.assignments && data && data.calculations && (
                      <>
                        {Object.entries(config.assignments).map(([pointId, mbIds]) => {
                          const sensor = config.sensors?.find(s => s.id === pointId && s.category === 'inverter');
                          if (sensor) {
                            const calcData = data.calculations[pointId] || {};
                            const voltage = calcData.voltage || 0;
                            const current = calcData.current || 0;
                            return (
                              <div key={pointId}>
                                <p style={{ margin: '2px 0', fontSize: '0.85rem' }}>Voltage: <strong>{voltage.toFixed(1)} V</strong></p>
                                <p style={{ margin: '2px 0', fontSize: '0.85rem' }}>Current: <strong>{current.toFixed(1)} A</strong></p>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </>
                    )}
                    <p style={{ margin: '2px 0', fontSize: '0.85rem' }}>Load Power: <strong>{powerConsumption} kW</strong></p>
                  </div>
                  <div style={{ borderTop: '1px solid #eee', paddingTop: '10px' }}>
                    <h5 style={{ margin: '0 0 8px 0', color: '#666', fontSize: '0.9rem' }}>Inverter Reported (RS485)</h5>
                    <p style={{ margin: '2px 0', fontSize: '0.85rem' }}>Voltage: <strong>{Number(invdData.Vout).toFixed(1)} V</strong></p>
                    <p style={{ margin: '2px 0', fontSize: '0.85rem' }}>Current: <strong>{Number(invdData.Iout).toFixed(1)} A</strong></p>
                    <p style={{ margin: '2px 0', fontSize: '0.85rem' }}>Load Power: <strong>{formatPower(Number(invdData.Pout))}</strong></p>
                  </div>
                </div>
              )}
              {selectedComponent === "grid" && (
                <div>
                  <p>Export to Grid: <strong>{gridFlow.toFixed(2)} kW</strong></p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
