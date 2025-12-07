import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import "./MBConfigTab.css";

export function MBConfigTab({ config, onConfigChange }) {
  const [subTab, setSubTab] = useState("layout");
  const [selectedItem, setSelectedItem] = useState(null); // { type: 'mb' | 'point', id: string }
  const [editSensorId, setEditSensorId] = useState(null);
  const [tempSensorName, setTempSensorName] = useState("");
  const [tempSensorCategory, setTempSensorCategory] = useState("other");

  // WebSocket Connection State
  const [ws, setWs] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [stm32Status, setStm32Status] = useState("unknown"); // connected, disconnected
  const [measurementData, setMeasurementData] = useState(null);
  const isMounted = useRef(true);

  const mbInventory = config.mbInventory || [];
  // assignments: { pointId: ["MB-01", "MB-02"] }
  const assignments = config.assignments || {};
  const sensors = config.sensors || [];
  const arrays = config.arrays || [];

  const [masterMBList, setMasterMBList] = useState([]);
  const [selectedMBIds, setSelectedMBIds] = useState([]);

  const [measurementDelay, setMeasurementDelay] = useState(10);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [isCommandPending, setIsCommandPending] = useState(false);

  // Fetch measurement state from backend on mount
  useEffect(() => {
    fetch("http://localhost:8000/api/measurement_state")
      .then(res => res.json())
      .then(data => {
        setIsMeasuring(data.isMeasuring || false);
      })
      .catch(err => console.error("Failed to fetch measurement state:", err));
  }, []);

  // Fetch Master List on Mount
  useEffect(() => {
    fetch("http://localhost:8000/api/mb_list")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setMasterMBList(data);
        } else {
          console.error("Expected array for MB list but got:", data);
          setMasterMBList([]);
        }
        // Initialize selected IDs and Delay based on current config
        const currentIds = config.mbInventory ? config.mbInventory.map(mb => mb.id) : [];
        setSelectedMBIds(currentIds);
        if (config.measurementDelay) {
          setMeasurementDelay(config.measurementDelay);
        }
      })
      .catch(err => console.error("Failed to fetch MB list:", err));
  }, [config]); // Re-run if config changes (to load delay)

  // WebSocket Connection
  useEffect(() => {
    isMounted.current = true;
    let socket = new WebSocket("ws://localhost:8000/ws");

    socket.onopen = () => {
      if (isMounted.current) {
        console.log("MBConfigTab connected to WebSocket");
        setConnectionStatus("connected");
        setWs(socket);
      }
    };

    socket.onmessage = (event) => {
      if (!isMounted.current) return;
      try {
        const response = JSON.parse(event.data);
        if (response.type === "scan_result") {
          onConfigChange({ mbInventory: response.data });
          alert(`Scan complete! Found ${response.data.length} devices.`);
        } else if (response.type === "stm32_status") {
          setStm32Status(response.status);
        } else if (response.type === "command_ack") {
          // Handle Command Confirmation
          setIsCommandPending(false);
          if (response.status === "success") {
            if (response.command === "start") {
              setIsMeasuring(true);
              // Save to backend
              fetch("http://localhost:8000/api/measurement_state", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isMeasuring: true })
              });
              alert("✅ Measurement started successfully!");
            }
            if (response.command === "stop") {
              setIsMeasuring(false);
              // Save to backend
              fetch("http://localhost:8000/api/measurement_state", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isMeasuring: false })
              });
              alert("✅ Measurement stopped successfully!");
            }
          } else {
            alert(`❌ Command failed: ${response.message}`);
          }
        } else if (response.type === "measurement") {
          console.log("Received measurement:", response);
          // New structured format: { type: "measurement", timestamp: "...", data: {MB_ID: {field: value}} }
          if (response.data) {
            // Structured data with MB IDs
            const structuredData = [];
            for (const [mbId, fields] of Object.entries(response.data)) {
              structuredData.push({
                id: mbId,
                fields: fields,
                timestamp: response.timestamp
              });
            }
            setMeasurementData(structuredData);
          } else if (response.values) {
            // Fallback: Old format with raw values
            const values = response.values || [];
            const mappedData = [];

            // Map to MBs first
            let valIndex = 0;
            if (config.mbInventory) {
              config.mbInventory.forEach(mb => {
                if (valIndex < values.length) {
                  mappedData.push({
                    id: mb.id,
                    type: mb.type,
                    val: values[valIndex]
                  });
                  valIndex++;
                }
              });
            }

            // Then map to Sensors
            if (config.sensors) {
              config.sensors.forEach(s => {
                if (valIndex < values.length) {
                  mappedData.push({
                    id: s.id,
                    type: s.type,
                    val: values[valIndex]
                  });
                  valIndex++;
                }
              });
            }

            setMeasurementData(mappedData);
          }
        }
      } catch (e) {
        console.error("Error parsing WS message:", e);
      }
    };

    socket.onclose = () => {
      if (isMounted.current) {
        setConnectionStatus("disconnected");
        setWs(null);
      }
    };

    return () => {
      isMounted.current = false;
      if (socket) socket.close();
    };
  }, [onConfigChange, config.mbInventory, config.sensors]); // Added config.mbInventory, config.sensors to dependencies

  const toggleMBSelection = (id) => {
    setSelectedMBIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSaveSelection = () => {
    fetch("http://localhost:8000/api/mb_selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selected_ids: selectedMBIds,
        delay: parseInt(measurementDelay) || 10
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === "success") {
          alert(data.message);
          // Update local inventory state to reflect selection
          const newInventory = masterMBList.filter(mb => selectedMBIds.includes(mb.id));
          onConfigChange({
            mbInventory: newInventory,
            measurementDelay: parseInt(measurementDelay) || 10
          });
        } else {
          alert("Error: " + data.message);
        }
      })
      .catch(err => alert("Failed to save selection: " + err));
  };

  const handleScan = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ command: "scan" }));
    } else {
      alert("WebSocket not connected. Ensure backend is running.");
    }
  };

  const handleStartMeasurement = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ command: "start_measurement" }));
    }
  };

  const handleStopMeasurement = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ command: "stop_measurement" }));
    }
  };

  // Updated to handle multiple MBs per point
  const handleAddMBToPoint = (pointId, mbId) => {
    if (!mbId) return;
    const currentAssigned = assignments[pointId] || [];

    // Avoid duplicates
    if (!currentAssigned.includes(mbId)) {
      const newAssignments = { ...assignments, [pointId]: [...currentAssigned, mbId] };
      onConfigChange({ assignments: newAssignments });
    }
    setSelectedItem({ type: 'mb', id: mbId });
  };

  const handleRemoveMBFromPoint = (pointId, mbId) => {
    const currentAssigned = assignments[pointId] || [];
    const newAssigned = currentAssigned.filter(id => id !== mbId);

    const newAssignments = { ...assignments };
    if (newAssigned.length === 0) {
      delete newAssignments[pointId];
    } else {
      newAssignments[pointId] = newAssigned;
    }
    onConfigChange({ assignments: newAssignments });
  };

  const handleAddSensor = (arrayId) => {
    const newSensorId = `sens-${Date.now()}`;
    const newSensor = {
      id: newSensorId,
      name: "New Sensor",
      arrayId: arrayId,
      category: "other" // New field: inverter/battery/environmental/other
    };
    onConfigChange({ sensors: [...sensors, newSensor] });
    // Start editing immediately
    setEditSensorId(newSensorId);
    setTempSensorName("New Sensor");
    setTempSensorCategory("other");
  };

  const handleRenameSensor = (id) => {
    const updatedSensors = sensors.map(s => s.id === id ? { ...s, name: tempSensorName, category: tempSensorCategory } : s);
    onConfigChange({ sensors: updatedSensors });
    setEditSensorId(null);
  };

  const handleRemoveSensor = (sensorId) => {
    onConfigChange({ sensors: sensors.filter(s => s.id !== sensorId) });
    if (assignments[sensorId]) {
      const newAssignments = { ...assignments };
      delete newAssignments[sensorId];
      onConfigChange({ assignments: newAssignments });
    }
  };

  // Check if MB is assigned anywhere (to filter dropdowns)
  const getAvailableMBs = () => {
    // Flatten all assigned MBs
    const allAssigned = Object.values(assignments).flat();
    return mbInventory.filter(mb => !allAssigned.includes(mb.id));
  };

  const getDetailData = () => {
    if (!selectedItem) return null;

    if (selectedItem.type === 'mb') {
      const mb = mbInventory.find(m => m.id === selectedItem.id);
      if (!mb) return null;

      // Find assignment
      let locationName = "Unassigned";
      const foundEntry = Object.entries(assignments).find(([_, mbIds]) => mbIds.includes(mb.id));

      if (foundEntry) {
        const [pointId] = foundEntry;
        // Search arrays/strings
        for (const arr of arrays) {
          const numStrings = parseInt(config.stringsPerArray || 1);
          for (let i = 1; i <= numStrings; i++) {
            if (`arr-${arr.id}-str-${i}` === pointId) {
              locationName = `Array ${arr.id} - String ${i}`;
              break;
            }
          }
        }
        // Search sensors
        const sens = sensors.find(s => s.id === pointId);
        if (sens) locationName = `Array ${sens.arrayId} - ${sens.name}`;
      }

      return {
        title: `MB Details: ${mb.id}`,
        rows: [
          { label: "Status", value: mb.status, type: "status" },
          { label: "Type", value: mb.type },
          { label: "Signal", value: `${mb.signal}%` },
          { label: "Assignment", value: locationName }
        ]
      };
    }
    return null;
  };

  const details = getDetailData();
  const availableMBs = getAvailableMBs();

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
      </div>

      {subTab === "layout" && (
        <div className="mb-three-panel">
          {/* LEFT PANEL - MB Inventory */}
          <div className="mb-left-panel">
            <div className="panel-header">
              <h3>📦 MB Inventory</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span
                  title={`STM32 Status: ${stm32Status}`}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    backgroundColor: stm32Status === 'connected' ? '#e8f5e9' : '#ffebee',
                    color: stm32Status === 'connected' ? '#2e7d32' : '#c62828',
                    border: `1px solid ${stm32Status === 'connected' ? '#a5d6a7' : '#ef9a9a'}`
                  }}
                >
                  STM32: {stm32Status}
                </span>
                <div className={`connection-dot ${connectionStatus}`} title={`Server: ${connectionStatus}`}></div>
              </div>
            </div>

            <div className="mb-actions">
              <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px', background: '#f8f9fa', padding: '8px', borderRadius: '4px', border: '1px solid #eee' }}>
                <label style={{ fontSize: '12px', color: '#555' }}>Sampling Interval (s):</label>
                <input
                  type="number"
                  value={measurementDelay}
                  onChange={(e) => setMeasurementDelay(e.target.value)}
                  style={{ width: '50px', padding: '4px', border: '1px solid #ccc', borderRadius: '3px' }}
                  min="1"
                />
              </div>
              <button className="btn-primary full-width" onClick={handleSaveSelection}>
                💾 Save Selection & Gen Config
              </button>
            </div>

            <div className="mb-inventory-list">
              {masterMBList.length === 0 && <p className="empty-text">Loading MB List...</p>}
              {masterMBList.map((mb) => (
                <div
                  key={mb.id}
                  className={`mb-inventory-item small ${selectedItem?.id === mb.id ? "selected" : ""}`}
                  onClick={() => setSelectedItem({ type: 'mb', id: mb.id })}
                >
                  <div className="mb-row-main">
                    <input
                      type="checkbox"
                      checked={selectedMBIds.includes(mb.id)}
                      onChange={(e) => { e.stopPropagation(); toggleMBSelection(mb.id); }}
                      style={{ marginRight: '8px' }}
                    />
                    <span className="mb-id">{mb.id}</span>
                    <span
                      className="status-dot"
                      style={{ backgroundColor: mb.online ? '#4CAF50' : '#ccc' }}
                      title={mb.online ? "Online" : "Offline"}
                    ></span>
                  </div>
                  <div className="mb-type-mini" style={{ fontSize: '0.75em', color: '#666', marginLeft: '24px' }}>
                    {mb.type}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CENTER PANEL - PV System Assignment */}
          <div className="mb-center-panel">
            <div className="panel-header">
              <h3>⚡ System Assignment</h3>
            </div>

            <div className="system-tree">
              {arrays.length === 0 && <p className="empty-text">No arrays defined in Tab 1.</p>}
              {arrays.map((array, idx) => {
                const numStrings = parseInt(config.stringsPerArray || 1);
                const stringIndices = Array.from({ length: numStrings }, (_, i) => i + 1);

                return (
                  <div key={array.id} className="array-group">
                    <div className="array-header">
                      <span>Array {idx + 1} (ID: {array.id})</span>
                      <button className="add-sensor-btn" onClick={() => handleAddSensor(array.id)}>+ Sensor</button>
                    </div>

                    <div className="string-list">
                      {stringIndices.map(strIndex => {
                        const pointId = `arr-${array.id}-str-${strIndex}`;
                        const assignedMBs = assignments[pointId] || [];

                        return (
                          <div key={pointId} className="string-block">
                            <div className="string-row-header">
                              <div className="string-label">
                                <span className="icon">⚡</span> String {strIndex}
                              </div>
                              <select
                                className="mb-select-add"
                                value=""
                                onChange={(e) => handleAddMBToPoint(pointId, e.target.value)}
                              >
                                <option value="">+ Add MB</option>
                                {availableMBs.map(mb => (
                                  <option key={mb.id} value={mb.id}>{mb.id}</option>
                                ))}
                              </select>
                            </div>
                            {assignedMBs.length > 0 && (
                              <div className="assigned-mbs-list">
                                {assignedMBs.map(mbId => (
                                  <div key={mbId} className="assigned-mb-tag">
                                    {mbId}
                                    <span className="remove-x" onClick={() => handleRemoveMBFromPoint(pointId, mbId)}>×</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {sensors.filter(s => s.arrayId === array.id).map(sens => (
                        <div key={sens.id} className="string-block sensor">
                          <div className="string-row-header">
                            <div className="string-label">
                              <span className="icon">📡</span>
                              {editSensorId === sens.id ? (
                                <div>
                                  <input
                                    type="text"
                                    className="rename-input"
                                    value={tempSensorName}
                                    onChange={(e) => setTempSensorName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleRenameSensor(sens.id)}
                                    autoFocus
                                    style={{ marginBottom: '5px' }}
                                  />
                                  <div style={{ marginTop: '5px', display: 'flex', gap: '8px' }}>
                                    <select
                                      value={tempSensorCategory}
                                      onChange={(e) => setTempSensorCategory(e.target.value)}
                                      style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc', flex: 1 }}
                                    >
                                      <option value="inverter">Inverter</option>
                                      <option value="battery">Battery</option>
                                      <option value="environmental">Environmental</option>
                                      <option value="other">Other</option>
                                    </select>
                                    <button onClick={() => handleRenameSensor(sens.id)} style={{ padding: '4px 12px', cursor: 'pointer' }}>✓ Save</button>
                                    <button onClick={() => setEditSensorId(null)} style={{ padding: '4px 12px', cursor: 'pointer' }}>✕ Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <span onDoubleClick={() => { setEditSensorId(sens.id); setTempSensorName(sens.name); setTempSensorCategory(sens.category || 'other'); }} title="Double click to rename">
                                  {sens.name} ({sens.category || 'other'}) <span className="edit-pencil" onClick={() => { setEditSensorId(sens.id); setTempSensorName(sens.name); setTempSensorCategory(sens.category || 'other'); }}>✎</span>
                                </span>
                              )}
                              <button className="remove-mini-btn" onClick={() => handleRemoveSensor(sens.id)}>✕</button>
                            </div>
                            <select
                              className="mb-select-add"
                              value=""
                              onChange={(e) => handleAddMBToPoint(sens.id, e.target.value)}
                            >
                              <option value="">+ Add MB</option>
                              {availableMBs.map(mb => (
                                <option key={mb.id} value={mb.id}>{mb.id}</option>
                              ))}
                            </select>
                          </div>
                          {(assignments[sens.id] || []).length > 0 && (
                            <div className="assigned-mbs-list">
                              {(assignments[sens.id] || []).map(mbId => (
                                <div key={mbId} className="assigned-mb-tag">
                                  {mbId}
                                  <span className="remove-x" onClick={() => handleRemoveMBFromPoint(sens.id, mbId)}>×</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* RIGHT PANEL - Details */}
          <div className="mb-right-panel">
            <h3>📝 Details</h3>
            {details ? (
              <div className="details-card">
                <h4>{details.title}</h4>
                <div className="details-grid">
                  {details.rows.map((row, i) => (
                    <div key={i} className="detail-row">
                      <label>{row.label}</label>
                      {row.type === "status" ? (
                        <span className={`status-badge ${row.value}`}>{row.value}</span>
                      ) : row.type === "status-bool" ? (
                        <span className={`status-badge ${row.raw ? "online" : "offline"}`} style={{ backgroundColor: row.raw ? '#4CAF50' : '#ccc' }}>
                          {row.value}
                        </span>
                      ) : (
                        <span>{row.value}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="no-selection">
                <p>Select an MB from the inventory to view details.</p>
              </div>
            )}
          </div>
        </div>
      )}



      {subTab === "measurements" && (
        <MeasurementTypesPanel
          onStart={handleStartMeasurement}
          onStop={handleStopMeasurement}
          data={measurementData}
          isMeasuring={isMeasuring}
        />
      )}
      {subTab === "alarms" && <AlarmConfigPanel />}
      {subTab === "processing" && <DataProcessingPanel />}
    </div>
  );
}

MBConfigTab.propTypes = {
  config: PropTypes.object.isRequired,
  onConfigChange: PropTypes.func.isRequired,
};

// --- Subcomponents ---

function MeasurementTypesPanel({ onStart, onStop, data, isMeasuring, isPending }) {
  return (
    <div className="sub-panel">
      <div className="panel-header">
        <h3>📊 Measurement & Live Data</h3>
        <div className="controls-row">
          <button
            className={isMeasuring ? "btn-success" : "btn-disabled"}
            onClick={!isMeasuring && !isPending ? onStart : null}
            disabled={isMeasuring || isPending}
            style={{ opacity: isPending ? 0.7 : 1 }}
          >
            {isPending && !isMeasuring ? "⏳ Starting..." : isMeasuring ? "✓ Running" : "▶ Start Measurement"}
          </button>

          <button
            className={isMeasuring ? "btn-danger" : "btn-disabled"}
            onClick={isMeasuring && !isPending ? onStop : null}
            disabled={!isMeasuring || isPending}
            style={{ opacity: isPending ? 0.7 : 1 }}
          >
            {isPending && isMeasuring ? "⏳ Stopping..." : isMeasuring ? "⏹ Stop Measurement" : "⏹ Stopped"}
          </button>
        </div>
      </div>

      {data && data.length > 0 ? (
        <div className="live-data-grid">
          {data.map((d, i) => (
            <div key={i} className="live-data-card">
              <div className="card-header">
                <strong>{d.id}</strong>
                {d.timestamp && <span className="data-timestamp" style={{ fontSize: '0.7em', color: '#666' }}>{d.timestamp}</span>}
              </div>
              {d.fields ? (
                // Structured data with field names
                <div className="card-fields">
                  {Object.entries(d.fields).map(([fieldName, value]) => (
                    <div key={fieldName} className="field-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #eee' }}>
                      <span style={{ color: '#666', fontSize: '0.85em' }}>{fieldName}:</span>
                      <span style={{ fontWeight: 'bold', color: value === 'NaN' || value === 'nan' ? '#e57373' : 'inherit' }}>
                        {value === 'NaN' || value === 'nan' ? '--' : (typeof value === 'number' ? value.toFixed(2) : value)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                // Fallback: single value display
                <div className="card-value">
                  {d.val !== undefined ? Number(d.val).toFixed(2) : "--"}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>No Data</p>
        </div>
      )}
    </div>
  );
}

MeasurementTypesPanel.propTypes = {
  onStart: PropTypes.func.isRequired,
  onStop: PropTypes.func.isRequired,
  data: PropTypes.array,
  delay: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onDelayChange: PropTypes.func
};

function AlarmConfigPanel() {
  return (
    <div className="sub-panel">
      <h3>🚨 Alarm Configuration</h3>
      <p>Alarm settings go here...</p>
    </div>
  );
}

function DataProcessingPanel() {
  return (
    <div className="sub-panel">
      <h3>⚙️ Data Processing</h3>
      <p>Data processing settings go here...</p>
    </div>
  );
}
