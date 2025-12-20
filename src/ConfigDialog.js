import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import "./ConfigDialog.css";
import { MBConfigTab } from "./MBConfigTab";

export function ConfigDialog({ isOpen, onClose }) {
  const [mainTab, setMainTab] = useState("station");
  const [centerTab, setCenterTab] = useState("overview");
  const [ws, setWs] = useState(null);
  const isMounted = useRef(true);
  const [expandedSections, setExpandedSections] = useState({
    stationInfo: true,
    location: false,
    operator: false,
    thresholds: false,
  });

  // WebSocket connection effect
  useEffect(() => {
    isMounted.current = true;
    let socket = null;

    if (isOpen) {
      // Fetch saved config
      fetch("/api/config")
        .then((res) => res.json())
        .then((savedConfig) => {
          if (savedConfig && Object.keys(savedConfig).length > 0) {
            console.log("Loaded config from server:", savedConfig);
            setConfig((prev) => ({ ...prev, ...savedConfig }));
          }
        })
        .catch((err) => console.error("Failed to load config:", err));

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

      socket.onopen = () => {
        console.log("ConfigDialog connected to WebSocket");
        if (isMounted.current) setWs(socket);
      };

      socket.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          console.log("Server response:", response);
        } catch (e) {
          console.error("Error parsing response:", e);
        }
      };

      socket.onerror = (error) => {
        console.error("WebSocket error in dialog:", error);
      };
    }

    return () => {
      isMounted.current = false;
      if (socket) {
        socket.close();
      }
    };
  }, [isOpen]);

  const [config, setConfig] = useState({
    stationId: "PV-001",
    stationName: "",
    description: "",
    installationDate: "",
    siteName: "",
    address: "",
    latitude: "",
    longitude: "",
    elevation: "",
    operatorName: "",
    organization: "",
    contactEmail: "",
    phone: "",
    systemType: "Grid-tied",
    totalCapacity: "",
    commissioningDate: "",
    numArrays: 1,
    arrays: [{ id: 1, tilt: "", azimuth: "", mounting: "Fixed" }],
    totalStrings: "",
    stringsPerArray: "",
    modulesPerString: "",
    stringVoltage: "",
    stringCurrent: "",
    combinerBox: "",
    moduleManufacturer: "",
    moduleModel: "",
    moduleType: "Monocrystalline",
    ratedPower: "",
    voc: "",
    isc: "",
    vmp: "",
    imp: "",
    tempCoeff: "",
    totalModules: "",
    inverterManufacturer: "",
    inverterModel: "",
    inverterPower: "",
    maxDcVoltage: "",
    maxDcCurrent: "",
    acOutput: "",
    mpptRange: "",
    numMppt: "",
    // Storage configuration
    storage: {
      numBatteries: 1,
      batteryType: "Lithium-ion",
      batteryManufacturer: "",
      batteryModel: "",
      nominalVoltage: 48,
      capacity: 100,
      capacityUnit: "Ah",
      maxChargeRate: 50,
      maxDischargeRate: 50,
      minSoc: 20,
      maxSoc: 100,
      temperatureMin: -10,
      temperatureMax: 45
    },
    // Diagnosis thresholds
    thresholds: {
      voltage: {
        pv_min: 150,
        pv_max: 450,
        battery_min: 42,
        battery_max: 58,
        ac_min: 198,
        ac_max: 264
      },
      current: {
        max_pv_current: 30,
        max_battery_current: 100,
        max_ac_current: 50
      },
      power_discrepancy: {
        max_percentage: 15
      },
      temperature: {
        panel_max: 85,
        ambient_max: 50,
        ambient_min: -10
      },
      communication: {
        min_rssi: -90
      }
    },
    // Tab 2 Data linked here
    assignments: {}, // Map of pointId -> mbId
    sensors: [], // Extra sensors added in Tab 2
    mbInventory: [] // Last scanned inventory
  });

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  // Helper to update nested config for Tab 2
  const handleTab2Change = (updates) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const addArray = () => {
    const newArray = {
      id: config.arrays.length + 1,
      tilt: "",
      azimuth: "",
      mounting: "Fixed",
    };
    setConfig((prev) => ({
      ...prev,
      numArrays: prev.numArrays + 1,
      arrays: [...prev.arrays, newArray],
    }));
  };

  const removeArray = (id) => {
    setConfig((prev) => ({
      ...prev,
      numArrays: prev.numArrays - 1,
      arrays: prev.arrays.filter((arr) => arr.id !== id),
    }));
  };

  const updateArray = (id, field, value) => {
    setConfig((prev) => ({
      ...prev,
      arrays: prev.arrays.map((arr) =>
        arr.id === id ? { ...arr, [field]: value } : arr
      ),
    }));
  };

  const handleSave = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const payload = JSON.stringify({
        command: "save_config",
        data: config
      });
      ws.send(payload);
      alert("Configuration saved to server successfully!");
      onClose();
    } else {
      alert("Not connected to server. Cannot save.");
    }
  };

  return (
    <div
      className="dialog-overlay"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="dialog-content large"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <h2>⚙️ System Configuration</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="config-actions">
          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="save-btn" onClick={handleSave}>
            💾 Save Configuration
          </button>
        </div>

        <div className="main-tabs">
          <button
            className={mainTab === "station" ? "main-tab active" : "main-tab"}
            onClick={() => setMainTab("station")}
          >
            📋 Tab 1: Station Profile & Site Details
          </button>
          <button
            className={mainTab === "mbconfig" ? "main-tab active" : "main-tab"}
            onClick={() => setMainTab("mbconfig")}
          >
            📦 Tab 2: MB Configuration & Monitoring
          </button>
        </div>

        {mainTab === "station" && (
          <div className="three-panel-layout">
            {/* LEFT PANEL - Station Identity */}
            <div className="left-panel">
              <h3 className="panel-title">🏢 Station Identity</h3>

              <AccordionSection
                title="Station Information"
                isExpanded={expandedSections.stationInfo}
                onToggle={() => toggleSection("stationInfo")}
              >
                <InputField
                  label="Station ID"
                  value={config.stationId}
                  onChange={(v) => handleChange("stationId", v)}
                  required
                />
                <InputField
                  label="Station Name"
                  value={config.stationName}
                  onChange={(v) => handleChange("stationName", v)}
                  required
                />
                <TextAreaField
                  label="Description"
                  value={config.description}
                  onChange={(v) => handleChange("description", v)}
                />
                <InputField
                  label="Installation Date"
                  type="date"
                  value={config.installationDate}
                  onChange={(v) => handleChange("installationDate", v)}
                />
              </AccordionSection>

              <AccordionSection
                title="Location Details"
                isExpanded={expandedSections.location}
                onToggle={() => toggleSection("location")}
              >
                <InputField
                  label="Site Name"
                  value={config.siteName}
                  onChange={(v) => handleChange("siteName", v)}
                />
                <TextAreaField
                  label="Address"
                  value={config.address}
                  onChange={(v) => handleChange("address", v)}
                />
                <div className="input-row">
                  <InputField
                    label="Latitude"
                    value={config.latitude}
                    onChange={(v) => handleChange("latitude", v)}
                    placeholder="e.g., 33.5731"
                  />
                  <InputField
                    label="Longitude"
                    value={config.longitude}
                    onChange={(v) => handleChange("longitude", v)}
                    placeholder="e.g., 10.0984"
                  />
                </div>
                <InputField
                  label="Elevation (m)"
                  type="number"
                  value={config.elevation}
                  onChange={(v) => handleChange("elevation", v)}
                />
              </AccordionSection>

              <AccordionSection
                title="Operator Information"
                isExpanded={expandedSections.operator}
                onToggle={() => toggleSection("operator")}
              >
                <InputField
                  label="Operator Name"
                  value={config.operatorName}
                  onChange={(v) => handleChange("operatorName", v)}
                />
                <InputField
                  label="Organization"
                  value={config.organization}
                  onChange={(v) => handleChange("organization", v)}
                />
                <InputField
                  label="Contact Email"
                  type="email"
                  value={config.contactEmail}
                  onChange={(v) => handleChange("contactEmail", v)}
                />
                <InputField
                  label="Phone Number"
                  type="tel"
                  value={config.phone}
                  onChange={(v) => handleChange("phone", v)}
                />
              </AccordionSection>

              <AccordionSection
                title="Diagnosis Thresholds"
                isExpanded={expandedSections.thresholds}
                onToggle={() => toggleSection("thresholds")}
              >
                <h5 style={{ marginTop: 0, marginBottom: '10px', fontSize: '13px', color: '#666' }}>Voltage Limits (V)</h5>
                <div className="input-row">
                  <InputField
                    label="PV Min"
                    type="number"
                    value={config.thresholds.voltage.pv_min}
                    onChange={(v) =>
                      handleChange("thresholds", { ...config.thresholds, voltage: { ...config.thresholds.voltage, pv_min: parseFloat(v) || 0 } })
                    }
                  />
                  <InputField
                    label="PV Max"
                    type="number"
                    value={config.thresholds.voltage.pv_max}
                    onChange={(v) =>
                      handleChange("thresholds", { ...config.thresholds, voltage: { ...config.thresholds.voltage, pv_max: parseFloat(v) || 0 } })
                    }
                  />
                </div>
                <div className="input-row">
                  <InputField
                    label="Battery Min"
                    type="number"
                    value={config.thresholds.voltage.battery_min}
                    onChange={(v) =>
                      handleChange("thresholds", { ...config.thresholds, voltage: { ...config.thresholds.voltage, battery_min: parseFloat(v) || 0 } })
                    }
                  />
                  <InputField
                    label="Battery Max"
                    type="number"
                    value={config.thresholds.voltage.battery_max}
                    onChange={(v) =>
                      handleChange("thresholds", { ...config.thresholds, voltage: { ...config.thresholds.voltage, battery_max: parseFloat(v) || 0 } })
                    }
                  />
                </div>
                <div className="input-row">
                  <InputField
                    label="AC Min"
                    type="number"
                    value={config.thresholds.voltage.ac_min}
                    onChange={(v) =>
                      handleChange("thresholds", { ...config.thresholds, voltage: { ...config.thresholds.voltage, ac_min: parseFloat(v) || 0 } })
                    }
                  />
                  <InputField
                    label="AC Max"
                    type="number"
                    value={config.thresholds.voltage.ac_max}
                    onChange={(v) =>
                      handleChange("thresholds", { ...config.thresholds, voltage: { ...config.thresholds.voltage, ac_max: parseFloat(v) || 0 } })
                    }
                  />
                </div>

                <h5 style={{ marginTop: '15px', marginBottom: '10px', fontSize: '13px', color: '#666' }}>Current Limits (A)</h5>
                <div className="input-row">
                  <InputField
                    label="Max PV Current"
                    type="number"
                    value={config.thresholds.current.max_pv_current}
                    onChange={(v) =>
                      handleChange("thresholds", { ...config.thresholds, current: { ...config.thresholds.current, max_pv_current: parseFloat(v) || 0 } })
                    }
                  />
                  <InputField
                    label="Max Battery Current"
                    type="number"
                    value={config.thresholds.current.max_battery_current}
                    onChange={(v) =>
                      handleChange("thresholds", { ...config.thresholds, current: { ...config.thresholds.current, max_battery_current: parseFloat(v) || 0 } })
                    }
                  />
                </div>
                <InputField
                  label="Max AC Current (A)"
                  type="number"
                  value={config.thresholds.current.max_ac_current}
                  onChange={(v) =>
                    handleChange("thresholds", { ...config.thresholds, current: { ...config.thresholds.current, max_ac_current: parseFloat(v) || 0 } })
                  }
                />

                <h5 style={{ marginTop: '15px', marginBottom: '10px', fontSize: '13px', color: '#666' }}>Temperature Limits (°C)</h5>
                <InputField
                  label="Panel Max Temperature"
                  type="number"
                  value={config.thresholds.temperature.panel_max}
                  onChange={(v) =>
                    handleChange("thresholds", { ...config.thresholds, temperature: { ...config.thresholds.temperature, panel_max: parseFloat(v) || 0 } })
                  }
                />
                <div className="input-row">
                  <InputField
                    label="Ambient Min"
                    type="number"
                    value={config.thresholds.temperature.ambient_min}
                    onChange={(v) =>
                      handleChange("thresholds", { ...config.thresholds, temperature: { ...config.thresholds.temperature, ambient_min: parseFloat(v) || 0 } })
                    }
                  />
                  <InputField
                    label="Ambient Max"
                    type="number"
                    value={config.thresholds.temperature.ambient_max}
                    onChange={(v) =>
                      handleChange("thresholds", { ...config.thresholds, temperature: { ...config.thresholds.temperature, ambient_max: parseFloat(v) || 0 } })
                    }
                  />
                </div>

                <h5 style={{ marginTop: '15px', marginBottom: '10px', fontSize: '13px', color: '#666' }}>Other Thresholds</h5>
                <InputField
                  label="Max Power Discrepancy (%)"
                  type="number"
                  value={config.thresholds.power_discrepancy.max_percentage}
                  onChange={(v) =>
                    handleChange("thresholds", { ...config.thresholds, power_discrepancy: { max_percentage: parseFloat(v) || 0 } })
                  }
                  tooltip="Max % difference between sensor and inverter readings"
                />
                <InputField
                  label="Min RSSI (dBm)"
                  type="number"
                  value={config.thresholds.communication.min_rssi}
                  onChange={(v) =>
                    handleChange("thresholds", { ...config.thresholds, communication: { min_rssi: parseFloat(v) || -90 } })
                  }
                  tooltip="Minimum acceptable signal strength"
                />
              </AccordionSection>
            </div>

            {/* CENTER PANEL - PV System Configuration */}
            <div className="center-panel">
              <h3 className="panel-title">⚡ PV System Configuration</h3>

              <div className="center-tabs">
                <button
                  className={centerTab === "overview" ? "tab active" : "tab"}
                  onClick={() => setCenterTab("overview")}
                >
                  Overview
                </button>
                <button
                  className={centerTab === "arrays" ? "tab active" : "tab"}
                  onClick={() => setCenterTab("arrays")}
                >
                  Arrays
                </button>
                <button
                  className={centerTab === "strings" ? "tab active" : "tab"}
                  onClick={() => setCenterTab("strings")}
                >
                  Strings
                </button>
                <button
                  className={centerTab === "modules" ? "tab active" : "tab"}
                  onClick={() => setCenterTab("modules")}
                >
                  Modules
                </button>
                <button
                  className={centerTab === "inverter" ? "tab active" : "tab"}
                  onClick={() => setCenterTab("inverter")}
                >
                  Inverter
                </button>
                <button
                  className={centerTab === "storage" ? "tab active" : "tab"}
                  onClick={() => setCenterTab("storage")}
                >
                  Storage
                </button>
              </div>

              <div className="tab-content-area">
                {centerTab === "overview" && (
                  <div className="tab-panel">
                    <SelectField
                      label="System Type"
                      value={config.systemType}
                      onChange={(v) => handleChange("systemType", v)}
                      options={["Grid-tied", "Off-grid", "Hybrid"]}
                    />
                    <InputField
                      label="Total Installed Capacity (kW)"
                      type="number"
                      value={config.totalCapacity}
                      onChange={(v) => handleChange("totalCapacity", v)}
                      required
                    />
                    <InputField
                      label="Installation Date"
                      type="date"
                      value={config.installationDate}
                      onChange={(v) => handleChange("installationDate", v)}
                    />
                    <InputField
                      label="Commissioning Date"
                      type="date"
                      value={config.commissioningDate}
                      onChange={(v) => handleChange("commissioningDate", v)}
                    />
                  </div>
                )}

                {centerTab === "arrays" && (
                  <div className="tab-panel">
                    <div className="section-header">
                      <h4>PV Array Configuration</h4>
                      <button className="add-btn" onClick={addArray}>
                        + Add Array
                      </button>
                    </div>
                    {config.arrays.map((array, idx) => (
                      <div key={array.id} className="array-item">
                        <div className="array-header">
                          <strong>Array #{idx + 1}</strong>
                          {config.arrays.length > 1 && (
                            <button
                              className="remove-btn"
                              onClick={() => removeArray(array.id)}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <div className="input-row">
                          <InputField
                            label="Tilt (°)"
                            type="number"
                            value={array.tilt}
                            onChange={(v) => updateArray(array.id, "tilt", v)}
                          />
                          <InputField
                            label="Azimuth (°)"
                            type="number"
                            value={array.azimuth}
                            onChange={(v) =>
                              updateArray(array.id, "azimuth", v)
                            }
                          />
                        </div>
                        <SelectField
                          label="Mounting Type"
                          value={array.mounting}
                          onChange={(v) => updateArray(array.id, "mounting", v)}
                          options={["Fixed", "Single-axis", "Dual-axis"]}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {centerTab === "strings" && (
                  <div className="tab-panel">
                    <h4>String Configuration</h4>
                    <div className="input-row">
                      <InputField
                        label="Total Strings"
                        type="number"
                        value={config.totalStrings}
                        onChange={(v) => handleChange("totalStrings", v)}
                      />
                      <InputField
                        label="Strings per Array"
                        type="number"
                        value={config.stringsPerArray}
                        onChange={(v) => handleChange("stringsPerArray", v)}
                      />
                    </div>
                    <InputField
                      label="Modules per String"
                      type="number"
                      value={config.modulesPerString}
                      onChange={(v) => handleChange("modulesPerString", v)}
                    />
                    <div className="input-row">
                      <InputField
                        label="String Voltage (V)"
                        type="number"
                        value={config.stringVoltage}
                        onChange={(v) => handleChange("stringVoltage", v)}
                      />
                      <InputField
                        label="String Current (A)"
                        type="number"
                        value={config.stringCurrent}
                        onChange={(v) => handleChange("stringCurrent", v)}
                      />
                    </div>
                    <InputField
                      label="Combiner Box Details"
                      value={config.combinerBox}
                      onChange={(v) => handleChange("combinerBox", v)}
                    />
                  </div>
                )}

                {centerTab === "modules" && (
                  <div className="tab-panel">
                    <h4>PV Module Specifications</h4>
                    <div className="input-row">
                      <InputField
                        label="Manufacturer"
                        value={config.moduleManufacturer}
                        onChange={(v) => handleChange("moduleManufacturer", v)}
                      />
                      <InputField
                        label="Model"
                        value={config.moduleModel}
                        onChange={(v) => handleChange("moduleModel", v)}
                      />
                    </div>
                    <SelectField
                      label="Module Type"
                      value={config.moduleType}
                      onChange={(v) => handleChange("moduleType", v)}
                      options={[
                        "Monocrystalline",
                        "Polycrystalline",
                        "Thin-film",
                      ]}
                    />
                    <InputField
                      label="Rated Power (Wp/module)"
                      type="number"
                      value={config.ratedPower}
                      onChange={(v) => handleChange("ratedPower", v)}
                    />
                    <div className="input-row">
                      <InputField
                        label="VOC (V)"
                        type="number"
                        value={config.voc}
                        onChange={(v) => handleChange("voc", v)}
                        tooltip="Open Circuit Voltage"
                      />
                      <InputField
                        label="ISC (A)"
                        type="number"
                        value={config.isc}
                        onChange={(v) => handleChange("isc", v)}
                        tooltip="Short Circuit Current"
                      />
                    </div>
                    <div className="input-row">
                      <InputField
                        label="VMP (V)"
                        type="number"
                        value={config.vmp}
                        onChange={(v) => handleChange("vmp", v)}
                        tooltip="Voltage at Max Power"
                      />
                      <InputField
                        label="IMP (A)"
                        type="number"
                        value={config.imp}
                        onChange={(v) => handleChange("imp", v)}
                        tooltip="Current at Max Power"
                      />
                    </div>
                    <InputField
                      label="Temperature Coefficient (%/°C)"
                      type="number"
                      value={config.tempCoeff}
                      onChange={(v) => handleChange("tempCoeff", v)}
                    />
                    <InputField
                      label="Total Modules Count"
                      type="number"
                      value={config.totalModules}
                      onChange={(v) => handleChange("totalModules", v)}
                    />
                  </div>
                )}

                {centerTab === "inverter" && (
                  <div className="tab-panel">
                    <h4>Inverter Configuration</h4>
                    <div className="input-row">
                      <InputField
                        label="Manufacturer"
                        value={config.inverterManufacturer}
                        onChange={(v) =>
                          handleChange("inverterManufacturer", v)
                        }
                      />
                      <InputField
                        label="Model"
                        value={config.inverterModel}
                        onChange={(v) => handleChange("inverterModel", v)}
                      />
                    </div>
                    <InputField
                      label="Rated Power (kW)"
                      type="number"
                      value={config.inverterPower}
                      onChange={(v) => handleChange("inverterPower", v)}
                    />
                    <div className="input-row">
                      <InputField
                        label="Max DC Voltage (V)"
                        type="number"
                        value={config.maxDcVoltage}
                        onChange={(v) => handleChange("maxDcVoltage", v)}
                      />
                      <InputField
                        label="Max DC Current (A)"
                        type="number"
                        value={config.maxDcCurrent}
                        onChange={(v) => handleChange("maxDcCurrent", v)}
                      />
                    </div>
                    <InputField
                      label="AC Output Specifications"
                      value={config.acOutput}
                      onChange={(v) => handleChange("acOutput", v)}
                      placeholder="e.g., 3-phase 400V"
                    />
                    <InputField
                      label="MPPT Range (V)"
                      value={config.mpptRange}
                      onChange={(v) => handleChange("mpptRange", v)}
                      placeholder="e.g., 200-800"
                    />
                    <InputField
                      label="Number of MPPT Trackers"
                      type="number"
                      value={config.numMppt}
                      onChange={(v) => handleChange("numMppt", v)}
                    />
                  </div>
                )}

                {centerTab === "storage" && (
                  <div className="tab-panel">
                    <h4>Battery/Storage Configuration</h4>
                    <InputField
                      label="Number of Batteries"
                      type="number"
                      value={config.storage.numBatteries}
                      onChange={(v) =>
                        handleChange("storage", { ...config.storage, numBatteries: parseInt(v) || 1 })
                      }
                    />
                    <div className="input-row">
                      <SelectField
                        label="Battery Type"
                        value={config.storage.batteryType}
                        onChange={(v) =>
                          handleChange("storage", { ...config.storage, batteryType: v })
                        }
                        options={["Lithium-ion", "Lead-acid", "LiFePO4", "Other"]}
                      />
                      <InputField
                        label="Nominal Voltage (V)"
                        type="number"
                        value={config.storage.nominalVoltage}
                        onChange={(v) =>
                          handleChange("storage", { ...config.storage, nominalVoltage: parseFloat(v) || 48 })
                        }
                      />
                    </div>
                    <div className="input-row">
                      <InputField
                        label="Manufacturer"
                        value={config.storage.batteryManufacturer}
                        onChange={(v) =>
                          handleChange("storage", { ...config.storage, batteryManufacturer: v })
                        }
                      />
                      <InputField
                        label="Model"
                        value={config.storage.batteryModel}
                        onChange={(v) =>
                          handleChange("storage", { ...config.storage, batteryModel: v })
                        }
                      />
                    </div>
                    <div className="input-row">
                      <InputField
                        label="Capacity"
                        type="number"
                        value={config.storage.capacity}
                        onChange={(v) =>
                          handleChange("storage", { ...config.storage, capacity: parseFloat(v) || 100 })
                        }
                      />
                      <SelectField
                        label="Capacity Unit"
                        value={config.storage.capacityUnit}
                        onChange={(v) =>
                          handleChange("storage", { ...config.storage, capacityUnit: v })
                        }
                        options={["Ah", "kWh"]}
                      />
                    </div>
                    <div className="input-row">
                      <InputField
                        label="Max Charge Rate (A)"
                        type="number"
                        value={config.storage.maxChargeRate}
                        onChange={(v) =>
                          handleChange("storage", { ...config.storage, maxChargeRate: parseFloat(v) || 50 })
                        }
                      />
                      <InputField
                        label="Max Discharge Rate (A)"
                        type="number"
                        value={config.storage.maxDischargeRate}
                        onChange={(v) =>
                          handleChange("storage", { ...config.storage, maxDischargeRate: parseFloat(v) || 50 })
                        }
                      />
                    </div>
                    <div className="input-row">
                      <InputField
                        label="Min SOC (%)"
                        type="number"
                        value={config.storage.minSoc}
                        onChange={(v) =>
                          handleChange("storage", { ...config.storage, minSoc: parseFloat(v) || 20 })
                        }
                      />
                      <InputField
                        label="Max SOC (%)"
                        type="number"
                        value={config.storage.maxSoc}
                        onChange={(v) =>
                          handleChange("storage", { ...config.storage, maxSoc: parseFloat(v) || 100 })
                        }
                      />
                    </div>
                    <div className="input-row">
                      <InputField
                        label="Min Temperature (°C)"
                        type="number"
                        value={config.storage.temperatureMin}
                        onChange={(v) =>
                          handleChange("storage", { ...config.storage, temperatureMin: parseFloat(v) || -10 })
                        }
                      />
                      <InputField
                        label="Max Temperature (°C)"
                        type="number"
                        value={config.storage.temperatureMax}
                        onChange={(v) =>
                          handleChange("storage", { ...config.storage, temperatureMax: parseFloat(v) || 45 })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT PANEL - Quick Status & Summary */}
            <div className="right-panel">
              <h3 className="panel-title">📊 Quick Status & Summary</h3>

              <SummaryCard title="System Overview">
                <InfoRow
                  label="Total Capacity"
                  value={config.totalCapacity || "—"}
                  unit="kW"
                />
                <InfoRow label="Arrays" value={config.numArrays} />
                <InfoRow
                  label="Total Strings"
                  value={config.totalStrings || "—"}
                />
                <InfoRow
                  label="Total Modules"
                  value={config.totalModules || "—"}
                />
              </SummaryCard>

              <SummaryCard title="Current Status">
                <StatusBadge status="online" label="Online" />
                <InfoRow label="Last Communication" value="2 min ago" />
                <InfoRow label="Uptime" value="15 days" />
                <InfoRow label="System State" value="Operating" />
                <InfoRow label="Current Power" value="5.2" unit="kW" />
                <InfoRow label="Daily Energy" value="45.3" unit="kWh" />
              </SummaryCard>

              <SummaryCard title="Hardware Summary">
                <InfoRow label="Total MBs" value="12" />
                <InfoRow label="Active MBs" value="12" />
                <InfoRow label="STM32 Firmware" value="v2.1.3" />
                <InfoRow label="Pi Software" value="v1.5.0" />
              </SummaryCard>

              <SummaryCard title="Configuration">
                <InfoRow label="Current Profile" value="Default" />
                <InfoRow label="Last Backup" value="Nov 20, 2025" />
                <InfoRow label="Modified" value="Today" />
                <div className="quick-links">
                  <button className="link-btn">MB Config</button>
                  <button className="link-btn">Measurement</button>
                  <button className="link-btn">Maintenance</button>
                </div>
              </SummaryCard>
            </div>
          </div>
        )}

        {mainTab === "mbconfig" && (
          <div className="mb-config-wrapper">
            <MBConfigTab config={config} onConfigChange={handleTab2Change} />
          </div>
        )}
      </div>
    </div>
  );
}

ConfigDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

function AccordionSection({ title, isExpanded, onToggle, children }) {
  return (
    <div className="accordion-section">
      <button className="accordion-header" onClick={onToggle}>
        <span>{title}</span>
        <span className="accordion-icon">{isExpanded ? "−" : "+"}</span>
      </button>
      {isExpanded && <div className="accordion-content">{children}</div>}
    </div>
  );
}

AccordionSection.propTypes = {
  title: PropTypes.string.isRequired,
  isExpanded: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};

function InputField({
  label,
  value,
  onChange,
  type,
  placeholder,
  required,
  tooltip,
}) {
  return (
    <div className="input-field">
      <label>
        {label} {required && <span className="required">*</span>}
        {tooltip && (
          <span className="tooltip-icon" title={tooltip}>
            ⓘ
          </span>
        )}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

InputField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onChange: PropTypes.func.isRequired,
  type: PropTypes.string,
  placeholder: PropTypes.string,
  required: PropTypes.bool,
  tooltip: PropTypes.string,
};

InputField.defaultProps = {
  type: "text",
  placeholder: "",
  required: false,
  tooltip: "",
};

function TextAreaField({ label, value, onChange }) {
  return (
    <div className="input-field">
      <label>{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
      />
    </div>
  );
}

TextAreaField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

function SelectField({ label, value, onChange, options }) {
  return (
    <div className="input-field">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
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

function SummaryCard({ title, children }) {
  return (
    <div className="summary-card">
      <h4>{title}</h4>
      <div className="summary-content">{children}</div>
    </div>
  );
}

SummaryCard.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

function InfoRow({ label, value, unit }) {
  return (
    <div className="info-row">
      <span className="info-label">{label}:</span>
      <span className="info-value">
        {value} {unit && <span className="unit">{unit}</span>}
      </span>
    </div>
  );
}

InfoRow.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  unit: PropTypes.string,
};

InfoRow.defaultProps = {
  unit: "",
};

function StatusBadge({ status, label }) {
  return <div className={`status-badge ${status}`}>{label}</div>;
}

StatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
};
