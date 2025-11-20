import { useState, useEffect } from "react";
import "./Pages.css";

// Dashboard Page
export function DashboardPage() {
  return (
    <>
      <MetricsCards />
      <MainContent />
    </>
  );
}

// Analytics Page
export function AnalyticsPage() {
  return (
    <div className="page-content">
      <h2 className="page-title">📈 Analytics</h2>
      <div className="placeholder-content">
        <div className="placeholder-card">
          <h3>Performance Analysis</h3>
          <p>Detailed performance metrics and trends will be displayed here.</p>
        </div>
        <div className="placeholder-card">
          <h3>Efficiency Reports</h3>
          <p>System efficiency analysis over time.</p>
        </div>
        <div className="placeholder-card">
          <h3>Comparative Data</h3>
          <p>Compare current performance with historical data.</p>
        </div>
      </div>
    </div>
  );
}

// History Page
export function HistoryPage() {
  return (
    <div className="page-content">
      <h2 className="page-title">📅 History</h2>
      <div className="placeholder-content">
        <div className="placeholder-card full-width">
          <h3>Historical Data</h3>
          <p>View and export historical power generation data.</p>
          <div className="data-table-placeholder">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Energy (kWh)</th>
                  <th>Peak Power (kW)</th>
                  <th>Efficiency (%)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Nov 02, 2025</td>
                  <td>45.3</td>
                  <td>6.8</td>
                  <td>18.5</td>
                </tr>
                <tr>
                  <td>Nov 01, 2025</td>
                  <td>43.7</td>
                  <td>6.5</td>
                  <td>18.2</td>
                </tr>
                <tr>
                  <td>Oct 31, 2025</td>
                  <td>41.2</td>
                  <td>6.2</td>
                  <td>17.8</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// Alerts Page
export function AlertsPage() {
  return (
    <div className="page-content">
      <h2 className="page-title">🔔 Alerts & Notifications</h2>
      <div className="alerts-list">
        <div className="alert-item warning">
          <span className="alert-icon">⚠️</span>
          <div className="alert-content">
            <h4>High Panel Temperature</h4>
            <p>Panel temperature reached 48°C at 2:30 PM</p>
            <small>2 hours ago</small>
          </div>
        </div>
        <div className="alert-item info">
          <span className="alert-icon">ℹ️</span>
          <div className="alert-content">
            <h4>System Maintenance Reminder</h4>
            <p>Scheduled maintenance due in 7 days</p>
            <small>1 day ago</small>
          </div>
        </div>
        <div className="alert-item success">
          <span className="alert-icon">✅</span>
          <div className="alert-content">
            <h4>Peak Production Day</h4>
            <p>Today's production exceeded monthly average by 15%</p>
            <small>5 hours ago</small>
          </div>
        </div>
      </div>
    </div>
  );
}

// Settings Page (Admin only)
export function SettingsPage() {
  return (
    <div className="page-content">
      <h2 className="page-title">⚙️ Settings</h2>
      <div className="settings-grid">
        <div className="settings-card">
          <h3>System Configuration</h3>
          <p>Configure system parameters and thresholds</p>
          <button className="settings-btn">Configure</button>
        </div>
        <div className="settings-card">
          <h3>Alert Preferences</h3>
          <p>Set up notification preferences and thresholds</p>
          <button className="settings-btn">Manage Alerts</button>
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

function MetricsCards() {
  return (
    <div className="metrics-grid">
      <MetricCard title="Current Power" value="5.2" unit="kW" status="good" />
      <MetricCard title="Energy Today" value="45.3" unit="kWh" status="good" />
      <MetricCard title="System Status" value="Online" unit="" status="good" />
      <MetricCard title="Efficiency 1" value="18.5" unit="%" status="warning" />
      <MetricCard title="Efficiency 2" value="18.5" unit="%" status="warning" />
    </div>
  );
}

function MetricCard({ title, value, unit, status }) {
  return (
    <div className={`metric-card ${status}`}>
      <h3>{title}</h3>
      <div className="metric-value">
        <span className="value">{value}</span>
        <span className="unit">{unit}</span>
      </div>
      <div className={`status-indicator ${status}`} />
    </div>
  );
}

function MainContent() {
  return (
    <div className="main-content">
      <div className="chart-container">
        <h3>Power Output (Last 24 Hours)</h3>
        <div className="chart-placeholder">📊 Chart will go here</div>
      </div>
      <StationOverview />
    </div>
  );
}

/* StationOverview - modern, dynamic flow diagram */
function StationOverview() {
  const [pvPower, setPvPower] = useState(850); // W
  const [inverterStatus, setInverterStatus] = useState("online"); // online|warning|error
  const [gridFlow, setGridFlow] = useState(0); // kW (positive export, negative import)
  const [storageLevel, setStorageLevel] = useState(85); // %
  const [powerConsumption, setPowerConsumption] = useState(1.2); // kW

  // new: selected component for details modal
  const [selectedComponent, setSelectedComponent] = useState(null);

  useEffect(() => {
    const id = setInterval(() => {
      setPvPower((p) =>
        Math.max(0, Math.round(p + (Math.random() * 120 - 60))),
      );
      setStorageLevel((s) =>
        Math.min(100, Math.max(0, Math.round(s + (Math.random() * 8 - 4)))),
      );
      setGridFlow(() => {
        const base = Math.random() * 4 - 2; // -2..+2
        const pvFactor = pvPower > 700 ? 2 : -1;
        return Math.round((base + pvFactor) * 1);
      });
      setPowerConsumption(() =>
        Number(Math.max(0.2, Math.random() * 3.8 + 0.2).toFixed(1)),
      );
      const r = Math.random();
      if (r < 0.02) setInverterStatus("error");
      else if (r < 0.12) setInverterStatus("warning");
      else setInverterStatus("online");
    }, 1500);
    return () => clearInterval(id);
  }, [pvPower]);

  const statusClass =
    inverterStatus === "online"
      ? "status-green"
      : inverterStatus === "warning"
        ? "status-yellow"
        : "status-red";

  const flowClass =
    gridFlow > 0 ? "flow-out" : gridFlow < 0 ? "flow-in" : "flow-neutral";
  const arrowGlyph = gridFlow >= 0 ? "→" : "←";

  // helper to open/close details
  const openDetail = (component) => setSelectedComponent(component);
  const closeDetail = () => setSelectedComponent(null);

  // keyboard handler for accessibility
  const handleKey = (e, name) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDetail(name);
    }
  };

  // Details content mapping
  const detailContent = {
    grid: {
      title: "Grid Details",
      body: `Current grid flow: ${gridFlow > 0 ? `Exporting ${gridFlow} kW` : gridFlow < 0 ? `Importing ${Math.abs(gridFlow)} kW` : "Idle"}.`,
    },
    solar: {
      title: "Solar Panels",
      body: `PV production approx ${pvPower} W. Panels healthy and producing.`,
    },
    inverter: {
      title: "Inverter",
      body: `Status: ${inverterStatus}. Output conditioned by inverter.`,
    },
    storage: {
      title: "Storage",
      body: `State of charge: ${storageLevel}%. Estimated autonomy depends on consumption.`,
    },
    consumption: {
      title: "Power Consumption",
      body: `Current consumption: ${powerConsumption} kW. Review loads to optimize usage.`,
    },
  };

  return (
    <section className="station-overview">
      <h3>Station Overview</h3>

      <div className="station-grid" role="group" aria-label="Station flow">
        {/* Left: Grid (clickable) */}
        <div
          className="component-card grid-card clickable"
          role="button"
          tabIndex={0}
          onClick={() => openDetail("grid")}
          onKeyDown={(e) => handleKey(e, "grid")}
          aria-pressed={selectedComponent === "grid"}
        >
          <div className="component-title">🔌 Grid</div>
          <div className="component-value">
            {gridFlow > 0
              ? `Export ${gridFlow} kW`
              : gridFlow < 0
                ? `Import ${Math.abs(gridFlow)} kW`
                : "Idle"}
          </div>
          <div className="component-sub">Grid Flow</div>
        </div>

        {/* Arrow between Grid and center stack */}
        <div className="flow-col">
          <div className={`arrow-icon ${flowClass}`}>{arrowGlyph}</div>
        </div>

        {/* Center stack: Solar on top, arrow, Inverter, arrow, Storage - all clickable */}
        <div className="center-stack">
          <div
            className="component-card solar-card clickable"
            role="button"
            tabIndex={0}
            onClick={() => openDetail("solar")}
            onKeyDown={(e) => handleKey(e, "solar")}
            aria-pressed={selectedComponent === "solar"}
          >
            <div className="component-title">☀️ Solar Panels</div>
            <div className="component-value">{pvPower} W</div>
            <div className="component-sub">PV Power</div>
          </div>

          {/* vertical arrow: solar -> inverter */}
          <div
            className={`vertical-arrow ${pvPower > 300 ? "arrow-glow" : ""}`}
            aria-hidden
          >
            <div
              className={`arrow-vert-icon ${pvPower > 300 ? "flow-out" : "flow-neutral"}`}
            >
              ↓
            </div>
          </div>

          <div
            className={`component-card inverter-card clickable ${statusClass}`}
            role="button"
            tabIndex={0}
            onClick={() => openDetail("inverter")}
            onKeyDown={(e) => handleKey(e, "inverter")}
            aria-pressed={selectedComponent === "inverter"}
          >
            <div className="component-title">⚡ Inverter</div>
            <div className="component-value">{inverterStatus}</div>
            <div className="component-sub">Status</div>
          </div>

          {/* vertical arrow: inverter -> storage */}
          <div
            className={`vertical-arrow ${pvPower > 700 ? "arrow-glow" : ""}`}
            aria-hidden
          >
            <div
              className={`arrow-vert-icon ${pvPower > 700 ? "flow-out" : "flow-neutral"}`}
            >
              ↓
            </div>
          </div>

          <div
            className="component-card storage-card clickable"
            role="button"
            tabIndex={0}
            onClick={() => openDetail("storage")}
            onKeyDown={(e) => handleKey(e, "storage")}
            aria-pressed={selectedComponent === "storage"}
          >
            <div className="component-title">🔋 Storage</div>
            <div className="component-value">{storageLevel}%</div>
            <div className="component-sub">State of Charge</div>
            <div className="storage-bar" aria-hidden>
              <div
                className="storage-fill"
                style={{ width: `${storageLevel}%` }}
              />
            </div>
          </div>
        </div>

        {/* Arrow between center stack and power card */}
        <div className="flow-col">
          <div className={`arrow-icon ${flowClass}`}>{arrowGlyph}</div>
        </div>

        {/* Right: Power consumption (clickable) */}
        <div
          className="component-card power-card clickable"
          role="button"
          tabIndex={0}
          onClick={() => openDetail("consumption")}
          onKeyDown={(e) => handleKey(e, "consumption")}
          aria-pressed={selectedComponent === "consumption"}
          aria-live="polite"
        >
          <div className="component-title">🔍 Consumption</div>
          <div className="component-value">{powerConsumption} kW</div>
          <div className="component-sub">Current Use</div>
        </div>
      </div>

      {/* Detail modal / panel */}
      {selectedComponent && (
        <div
          className="detail-overlay"
          onClick={closeDetail}
          role="dialog"
          aria-modal="true"
        >
          <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="detail-header">
              <h4>{detailContent[selectedComponent].title}</h4>
              <button
                className="detail-close"
                onClick={closeDetail}
                aria-label="Close details"
              >
                ✕
              </button>
            </div>
            <div className="detail-body">
              <p>{detailContent[selectedComponent].body}</p>
              {/* You can extend with more fields, charts, or actions here */}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
