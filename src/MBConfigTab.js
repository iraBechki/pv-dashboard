import { useState } from "react";
import PropTypes from "prop-types";
import "./MBConfigTab.css";

export function MBConfigTab({ config, onConfigChange }) {
  const [subTab, setSubTab] = useState("layout");
  const [selectedMB, setSelectedMB] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [draggedMB, setDraggedMB] = useState(null);

  const [mbList, setMbList] = useState([
    { id: "MB-01", status: "online", assignment: null, signal: 100 },
    { id: "MB-02", status: "online", assignment: "String 1 Current", signal: 95 },
    { id: "MB-03", status: "weak", assignment: "Irradiance", signal: 45 },
    { id: "MB-04", status: "offline", assignment: "Temperature", signal: 0 },
    { id: "MB-05", status: "online", assignment: null, signal: 88 },
  ]);

  const [monitoringPoints, setMonitoringPoints] = useState([
    {
      id: "point-1",
      name: "String 1 Current",
      mbId: "MB-02",
      type: "DC Current",
      location: "Array 1 - String 1",
      expectedRange: { min: 0, max: 10 },
      units: "A",
      decimals: 2,
      alarms: { criticalHigh: 12, warningHigh: 10, warningLow: 0.5, criticalLow: 0 },
      samplingRate: 1000,
    },
    {
      id: "point-2",
      name: "String 2 Current",
      mbId: null,
      type: "DC Current",
      location: "Array 1 - String 2",
      expectedRange: { min: 0, max: 10 },
      units: "A",
      decimals: 2,
      alarms: { criticalHigh: 12, warningHigh: 10, warningLow: 0.5, criticalLow: 0 },
      samplingRate: 1000,
    },
    {
      id: "point-3",
      name: "Irradiance Sensor",
      mbId: "MB-03",
      type: "Irradiance",
      location: "Array 1 Center",
      expectedRange: { min: 0, max: 1200 },
      units: "W/m²",
      decimals: 1,
      alarms: { criticalHigh: 1500, warningHigh: 1200, warningLow: 50, criticalLow: 0 },
      samplingRate: 5000,
    },
  ]);

  const [measurementTypes, setMeasurementTypes] = useState({
    electrical: [
      "DC Voltage",
      "DC Current",
      "AC Voltage",
      "AC Current",
      "AC Power",
      "Energy",
      "Power Factor",
    ],
    environmental: [
      "Irradiance",
      "Module Temperature",
      "Ambient Temperature",
      "Humidity",
      "Wind Speed",
      "Rainfall",
    ],
    performance: ["Performance Ratio", "Efficiency", "Soiling Loss"],
    custom: [],
  });

  const handleDragStart = (mb) => {
    setDraggedMB(mb);
  };

  const handleDrop = (point) => {
    if (!draggedMB) return;

    const updatedPoints = monitoringPoints.map((p) =>
      p.id === point.id ? { ...p, mbId: draggedMB.id } : p
    );
    setMonitoringPoints(updatedPoints);

    const updatedMBs = mbList.map((mb) =>
      mb.id === draggedMB.id ? { ...mb, assignment: point.name } : mb
    );
    setMbList(updatedMBs);

    setDraggedMB(null);
  };

  const handlePointUpdate = (field, value) => {
    if (!selectedPoint) return;
    const updated = monitoringPoints.map((p) =>
      p.id === selectedPoint.id ? { ...p, [field]: value } : p
    );
    setMonitoringPoints(updated);
    setSelectedPoint({ ...selectedPoint, [field]: value });
  };

  const scanForMBs = () => {
    alert("Scanning for MBs... (simulated)");
  };

  const addNewMB = () => {
    const newId = `MB-${String(mbList.length + 1).padStart(2, "0")}`;
    setMbList([
      ...mbList,
      { id: newId, status: "online", assignment: null, signal: 100 },
    ]);
  };

  return (
    <div className="mb-config-container">
      <div className="mb-sub-tabs">
        <button
          className={subTab === "layout" ? "sub-tab active" : "sub-tab"}
          onClick={() => setSubTab("layout")}
        >
          Layout & Assignment
        </button>
        <button
          className={subTab === "measurements" ? "sub-tab active" : "sub-tab"}
          onClick={() => setSubTab("measurements")}
        >
          Measurement Types
        </button>
        <button
          className={subTab === "alarms" ? "sub-tab active" : "sub-tab"}
          onClick={() => setSubTab("alarms")}
        >
          Alarm Configuration
        </button>
        <button
          className={subTab === "processing" ? "sub-tab active" : "sub-tab"}
          onClick={() => setSubTab("processing")}
        >
          Data Processing
        </button>
        <button
          className={subTab === "communication" ? "sub-tab active" : "sub-tab"}
          onClick={() => setSubTab("communication")}
        >
          Communication Settings
        </button>
      </div>

      {subTab === "layout" && (
        <div className="mb-three-panel">
          {/* LEFT PANEL - MB Inventory */}
          <div className="mb-left-panel">
            <h3>📦 MB Inventory</h3>
            <div className="mb-actions">
              <button className="btn-primary" onClick={addNewMB}>
                + Add MB
              </button>
              <button className="btn-secondary" onClick={scanForMBs}>
                🔍 Scan
              </button>
            </div>

            <div className="mb-list">
              {mbList.map((mb) => (
                <div
                  key={mb.id}
                  className={`mb-item ${mb.status} ${selectedMB?.id === mb.id ? "selected" : ""}`}
                  draggable
                  onDragStart={() => handleDragStart(mb)}
                  onClick={() => setSelectedMB(mb)}
                >
                  <div className="mb-header">
                    <strong>{mb.id}</strong>
                    <StatusIcon status={mb.status} />
                  </div>
                  <div className="mb-details">
                    <div className="signal-bar">
                      <div
                        className="signal-fill"
                        style={{ width: `${mb.signal}%` }}
                      />
                    </div>
                    <div className="mb-assignment">
                      {mb.assignment || "Unassigned"}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-quick-actions">
              <h4>Quick Actions</h4>
              <button
                className="action-btn"
                disabled={!selectedMB}
                onClick={() => alert(`Testing ${selectedMB?.id}`)}
              >
                🔧 Test Selected
              </button>
              <button
                className="action-btn"
                disabled={!selectedMB}
                onClick={() => alert(`Calibrating ${selectedMB?.id}`)}
              >
                📐 Calibrate
              </button>
              <button
                className="action-btn"
                disabled={!selectedMB}
                onClick={() => alert(`Viewing logs for ${selectedMB?.id}`)}
              >
                📄 View Logs
              </button>
              <button
                className="action-btn"
                disabled={!selectedMB}
                onClick={() => alert(`Configuring LoRa for ${selectedMB?.id}`)}
              >
                📡 Configure LoRa
              </button>
            </div>
          </div>

          {/* CENTER PANEL - Visual PV Layout */}
          <div className="mb-center-panel">
            <h3>⚡ PV System Monitoring Map</h3>
            <div className="pv-layout">
              <div className="array-container">
                <div className="array-title">ARRAY 1</div>
                <div className="strings-row">
                  {monitoringPoints
                    .filter((p) => p.type === "DC Current")
                    .map((point) => (
                      <div
                        key={point.id}
                        className={`monitoring-point ${point.mbId ? "assigned" : "empty"} ${
                          selectedPoint?.id === point.id ? "selected" : ""
                        }`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleDrop(point)}
                        onClick={() => setSelectedPoint(point)}
                      >
                        <div className="point-title">{point.name}</div>
                        {point.mbId ? (
                          <div className="assigned-mb">
                            <span className="mb-badge">{point.mbId}</span>
                            <span className="mb-icon">⚡</span>
                          </div>
                        ) : (
                          <div className="drop-zone">Drop MB here</div>
                        )}
                        <div className="point-type">{point.type}</div>
                      </div>
                    ))}
                </div>

                <div className="environmental-sensors">
                  {monitoringPoints
                    .filter((p) => p.type === "Irradiance")
                    .map((point) => (
                      <div
                        key={point.id}
                        className={`monitoring-point environmental ${
                          point.mbId ? "assigned" : "empty"
                        } ${selectedPoint?.id === point.id ? "selected" : ""}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleDrop(point)}
                        onClick={() => setSelectedPoint(point)}
                      >
                        <div className="point-title">{point.name}</div>
                        {point.mbId ? (
                          <div className="assigned-mb">
                            <span className="mb-badge">{point.mbId}</span>
                            <span className="mb-icon">☀️</span>
                          </div>
                        ) : (
                          <div className="drop-zone">Drop MB here</div>
                        )}
                        <div className="point-type">{point.type}</div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="drag-hint">
                💡 <strong>Drag MBs</strong> from the left panel to monitoring
                points to assign
              </div>
            </div>
          </div>

          {/* RIGHT PANEL - Monitoring Point Configuration */}
          <div className="mb-right-panel">
            <h3>⚙️ Monitoring Point Config</h3>
            {selectedPoint ? (
              <div className="point-config">
                <h4>Selected: {selectedPoint.name}</h4>

                <div className="config-section">
                  <h5>Basic Configuration</h5>
                  <InputField
                    label="Point Name"
                    value={selectedPoint.name}
                    onChange={(v) => handlePointUpdate("name", v)}
                  />
                  <SelectField
                    label="MB Assignment"
                    value={selectedPoint.mbId || ""}
                    onChange={(v) => handlePointUpdate("mbId", v)}
                    options={["", ...mbList.map((mb) => mb.id)]}
                  />
                  <SelectField
                    label="Measurement Type"
                    value={selectedPoint.type}
                    onChange={(v) => handlePointUpdate("type", v)}
                    options={[
                      ...measurementTypes.electrical,
                      ...measurementTypes.environmental,
                    ]}
                  />
                  <InputField
                    label="Physical Location"
                    value={selectedPoint.location}
                    onChange={(v) => handlePointUpdate("location", v)}
                  />
                </div>

                <div className="config-section">
                  <h5>Measurement Parameters</h5>
                  <div className="input-row">
                    <InputField
                      label="Min Range"
                      type="number"
                      value={selectedPoint.expectedRange.min}
                      onChange={(v) =>
                        handlePointUpdate("expectedRange", {
                          ...selectedPoint.expectedRange,
                          min: v,
                        })
                      }
                    />
                    <InputField
                      label="Max Range"
                      type="number"
                      value={selectedPoint.expectedRange.max}
                      onChange={(v) =>
                        handlePointUpdate("expectedRange", {
                          ...selectedPoint.expectedRange,
                          max: v,
                        })
                      }
                    />
                  </div>
                  <div className="input-row">
                    <InputField
                      label="Units"
                      value={selectedPoint.units}
                      onChange={(v) => handlePointUpdate("units", v)}
                    />
                    <InputField
                      label="Decimal Places"
                      type="number"
                      value={selectedPoint.decimals}
                      onChange={(v) => handlePointUpdate("decimals", v)}
                    />
                  </div>
                </div>

                <div className="config-section">
                  <h5>Alarm Thresholds</h5>
                  <InputField
                    label="Critical High"
                    type="number"
                    value={selectedPoint.alarms.criticalHigh}
                    onChange={(v) =>
                      handlePointUpdate("alarms", {
                        ...selectedPoint.alarms,
                        criticalHigh: v,
                      })
                    }
                  />
                  <InputField
                    label="Warning High"
                    type="number"
                    value={selectedPoint.alarms.warningHigh}
                    onChange={(v) =>
                      handlePointUpdate("alarms", {
                        ...selectedPoint.alarms,
                        warningHigh: v,
                      })
                    }
                  />
                  <InputField
                    label="Warning Low"
                    type="number"
                    value={selectedPoint.alarms.warningLow}
                    onChange={(v) =>
                      handlePointUpdate("alarms", {
                        ...selectedPoint.alarms,
                        warningLow: v,
                      })
                    }
                  />
                  <InputField
                    label="Critical Low"
                    type="number"
                    value={selectedPoint.alarms.criticalLow}
                    onChange={(v) =>
                      handlePointUpdate("alarms", {
                        ...selectedPoint.alarms,
                        criticalLow: v,
                      })
                    }
                  />
                </div>

                <div className="config-section">
                  <h5>Data Processing</h5>
                  <InputField
                    label="Sampling Rate (ms)"
                    type="number"
                    value={selectedPoint.samplingRate}
                    onChange={(v) => handlePointUpdate("samplingRate", v)}
                  />
                </div>
              </div>
            ) : (
              <div className="no-selection">
                <p>👈 Select a monitoring point from the diagram</p>
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === "measurements" && <MeasurementTypesPanel types={measurementTypes} />}
      {subTab === "alarms" && <AlarmConfigPanel />}
      {subTab === "processing" && <DataProcessingPanel />}
      {subTab === "communication" && <CommunicationPanel />}
    </div>
  );
}

MBConfigTab.propTypes = {
  config: PropTypes.object.isRequired,
  onConfigChange: PropTypes.func.isRequired,
};

function StatusIcon({ status }) {
  const icons = {
    online: "✓",
    weak: "⚠",
    offline: "✖",
  };
  return <span className={`status-icon ${status}`}>{icons[status]}</span>;
}

StatusIcon.propTypes = {
  status: PropTypes.string.isRequired,
};

function InputField({ label, value, onChange, type = "text" }) {
  return (
    <div className="config-input">
      <label>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

InputField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onChange: PropTypes.func.isRequired,
  type: PropTypes.string,
};

InputField.defaultProps = {
  type: "text",
};

function SelectField({ label, value, onChange, options }) {
  return (
    <div className="config-input">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt || "-- None --"}
          </option>
        ))}
      </select>
    </div>
  );
}

SelectField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
};

function MeasurementTypesPanel({ types }) {
  return (
    <div className="sub-panel">
      <h3>📊 Measurement Types</h3>
      <div className="measurement-categories">
        <div className="category-card">
          <h4>⚡ Electrical Parameters</h4>
          <ul>
            {types.electrical.map((type) => (
              <li key={type}>{type}</li>
            ))}
          </ul>
        </div>
        <div className="category-card">
          <h4>🌤️ Environmental Sensors</h4>
          <ul>
            {types.environmental.map((type) => (
              <li key={type}>{type}</li>
            ))}
          </ul>
        </div>
        <div className="category-card">
          <h4>📈 System Performance</h4>
          <ul>
            {types.performance.map((type) => (
              <li key={type}>{type}</li>
            ))}
          </ul>
        </div>
        <div className="category-card">
          <h4>🔧 Custom Types</h4>
          <button className="btn-primary">+ Add Custom Type</button>
        </div>
      </div>
    </div>
  );
}

MeasurementTypesPanel.propTypes = {
  types: PropTypes.object.isRequired,
};

function AlarmConfigPanel() {
  return (
    <div className="sub-panel">
      <h3>🚨 Alarm Configuration</h3>
      <div className="alarm-sections">
        <div className="alarm-card">
          <h4>Alarm Rules</h4>
          <ul>
            <li>✓ Threshold alarms</li>
            <li>✓ Rate-of-change detection</li>
            <li>✓ Communication loss</li>
            <li>✓ Data quality alerts</li>
          </ul>
        </div>
        <div className="alarm-card">
          <h4>Notification Settings</h4>
          <label>
            <input type="checkbox" /> Email alerts
          </label>
          <label>
            <input type="checkbox" /> SMS notifications
          </label>
          <label>
            <input type="checkbox" /> Dashboard warnings
          </label>
        </div>
        <div className="alarm-card">
          <h4>Alarm History</h4>
          <p>Active alarms: 2</p>
          <p>Last 24h: 15 alarms</p>
          <button className="btn-secondary">View Full History</button>
        </div>
      </div>
    </div>
  );
}

function DataProcessingPanel() {
  return (
    <div className="sub-panel">
      <h3>⚙️ Data Processing</h3>
      <div className="processing-grid">
        <div className="processing-card">
          <h4>Sampling Strategy</h4>
          <select>
            <option>Fixed interval</option>
            <option>Event-based</option>
            <option>Adaptive</option>
            <option>Burst</option>
          </select>
        </div>
        <div className="processing-card">
          <h4>Data Quality</h4>
          <label>
            <input type="checkbox" defaultChecked /> Range checking
          </label>
          <label>
            <input type="checkbox" defaultChecked /> Spike detection
          </label>
          <label>
            <input type="checkbox" /> Gap handling
          </label>
        </div>
        <div className="processing-card">
          <h4>Aggregation</h4>
          <label>
            <input type="checkbox" defaultChecked /> Calculate averages
          </label>
          <label>
            <input type="checkbox" /> Track min/max
          </label>
          <label>
            <input type="checkbox" /> Statistical analysis
          </label>
        </div>
        <div className="processing-card">
          <h4>Storage Optimization</h4>
          <label>
            <input type="checkbox" /> Data compression
          </label>
          <label>
            <input type="checkbox" /> Auto-archiving
          </label>
          <InputField label="Retention (days)" value="365" onChange={() => {}} />
        </div>
      </div>
    </div>
  );
}

function CommunicationPanel() {
  return (
    <div className="sub-panel">
      <h3>📡 Communication Settings</h3>
      <div className="comm-settings">
        <div className="comm-card">
          <h4>LoRa Configuration</h4>
          <InputField label="Frequency (MHz)" value="915" onChange={() => {}} />
          <InputField label="Bandwidth (kHz)" value="125" onChange={() => {}} />
          <InputField label="Spreading Factor" value="7" onChange={() => {}} />
          <InputField label="Tx Power (dBm)" value="14" onChange={() => {}} />
        </div>
        <div className="comm-card">
          <h4>Network Settings</h4>
          <InputField label="Network ID" value="0x01" onChange={() => {}} />
          <InputField label="Encryption Key" type="password" value="****" onChange={() => {}} />
          <label>
            <input type="checkbox" defaultChecked /> Auto-retry on failure
          </label>
        </div>
        <div className="comm-card">
          <h4>Traffic Statistics</h4>
          <p>Estimated daily messages: ~1440</p>
          <p>LoRa airtime: 12.5%</p>
          <p>Battery impact: Low</p>
        </div>
      </div>
    </div>
  );
}
