import { useState } from "react";
import "./ConfigDialog.css";
import { sendSerialData } from "./serialService";

export function ConfigDialog({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("general");
  const [config, setConfig] = useState({
    button1: false,
    button2: false,
    button3: false,
    voltage: "",
    current: "",
    frequency: "",
    threshold: "",
  });

  if (!isOpen) return null;

  const handleInputChange = (field, value) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleToggle = (field) => {
    setConfig((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSave = async () => {
    try {
      await sendSerialData(config);
      alert("Configuration sent to serial port successfully!");
      onClose();
    } catch (error) {
      alert(`Error sending data: ${error.message}`);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>System Configuration</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="dialog-tabs">
          <button
            className={activeTab === "general" ? "tab active" : "tab"}
            onClick={() => setActiveTab("general")}
          >
            General
          </button>
          <button
            className={activeTab === "advanced" ? "tab active" : "tab"}
            onClick={() => setActiveTab("advanced")}
          >
            Advanced
          </button>
        </div>

        <div className="dialog-body">
          {activeTab === "general" && (
            <div className="tab-content">
              <h3>Control Buttons</h3>
              <div className="control-group">
                <label>
                  <span>Enable System 1</span>
                  <button
                    className={`toggle-btn ${config.button1 ? "on" : "off"}`}
                    onClick={() => handleToggle("button1")}
                  >
                    {config.button1 ? "ON" : "OFF"}
                  </button>
                </label>
              </div>
              <div className="control-group">
                <label>
                  <span>Enable System 2</span>
                  <button
                    className={`toggle-btn ${config.button2 ? "on" : "off"}`}
                    onClick={() => handleToggle("button2")}
                  >
                    {config.button2 ? "ON" : "OFF"}
                  </button>
                </label>
              </div>

              <h3>Input Parameters</h3>
              <div className="input-group">
                <label>
                  Voltage (V):
                  <input
                    type="number"
                    value={config.voltage}
                    onChange={(e) => handleInputChange("voltage", e.target.value)}
                    placeholder="Enter voltage"
                  />
                </label>
              </div>
              <div className="input-group">
                <label>
                  Current (A):
                  <input
                    type="number"
                    value={config.current}
                    onChange={(e) => handleInputChange("current", e.target.value)}
                    placeholder="Enter current"
                  />
                </label>
              </div>
            </div>
          )}

          {activeTab === "advanced" && (
            <div className="tab-content">
              <h3>Advanced Settings</h3>
              <div className="control-group">
                <label>
                  <span>Enable Debug Mode</span>
                  <button
                    className={`toggle-btn ${config.button3 ? "on" : "off"}`}
                    onClick={() => handleToggle("button3")}
                  >
                    {config.button3 ? "ON" : "OFF"}
                  </button>
                </label>
              </div>
              <div className="input-group">
                <label>
                  Frequency (Hz):
                  <input
                    type="number"
                    value={config.frequency}
                    onChange={(e) => handleInputChange("frequency", e.target.value)}
                    placeholder="Enter frequency"
                  />
                </label>
              </div>
              <div className="input-group">
                <label>
                  Threshold:
                  <input
                    type="number"
                    value={config.threshold}
                    onChange={(e) => handleInputChange("threshold", e.target.value)}
                    placeholder="Enter threshold"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="save-btn" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
