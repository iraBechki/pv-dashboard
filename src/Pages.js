import './Pages.css';

// Dashboard Page (existing content)
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
      <h2 className="page-title">   📈 Analytics</h2>
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
                <tr><td>Nov 02, 2025</td><td>45.3</td><td>6.8</td><td>18.5</td></tr>
                <tr><td>Nov 01, 2025</td><td>43.7</td><td>6.5</td><td>18.2</td></tr>
                <tr><td>Oct 31, 2025</td><td>41.2</td><td>6.2</td><td>17.8</td></tr>
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
              <td><span className="role-badge admin">Admin</span></td>
              <td><span className="status-badge active">Active</span></td>
              <td><button className="action-btn">Edit</button></td>
            </tr>
            <tr>
              <td>Regular User</td>
              <td>user@pv.com</td>
              <td><span className="role-badge user">User</span></td>
              <td><span className="status-badge active">Active</span></td>
              <td><button className="action-btn">Edit</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Helper Components (from original App.js)
function MetricsCards() {
  return (
    <div className="metrics-grid">
      <MetricCard title="Current Power" value="5.2" unit="kW" status="good" />
      <MetricCard title="Energy Today" value="45.3" unit="kWh" status="good" />
      <MetricCard title="System Status" value="Online" unit="" status="good" />
      <MetricCard title="Efficiency" value="18.5" unit="%" status="warning" />
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
      <div className={`status-indicator ${status}`}></div>
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
      <div className="station-diagram">
        <h3>Station Overview</h3>
        <div className="diagram-placeholder">
          <div className="component">
            <div className="icon">☀️</div>
            <div>Solar Panels</div>
            <div className="value">850 W/m²</div>
          </div>
          <div className="arrow">↓</div>
          <div className="component">
            <div className="icon">⚡</div>
            <div>Inverter</div>
            <div className="value">Online</div>
          </div>
          <div className="arrow">↓</div>
          <div className="component">
            <div className="icon">🔋</div>
            <div>Battery</div>
            <div className="value">85%</div>
          </div>
        </div>
      </div>
    </div>
  );
}