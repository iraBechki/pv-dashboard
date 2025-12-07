import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";

const ConfigSaveButton = ({ configData }) => {
  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState("disconnected"); // disconnected, connecting, connected
  const [lastMessage, setLastMessage] = useState(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    let ws = null;
    let reconnectTimeout = null;

    const connect = () => {
      if (!isMounted.current) return;

      setStatus("connecting");
      ws = new WebSocket("ws://localhost:8000/ws");

      ws.onopen = () => {
        if (isMounted.current) {
          console.log("Connected to WebSocket server");
          setStatus("connected");
          setSocket(ws);
        }
      };

      ws.onmessage = (event) => {
        if (isMounted.current) {
          try {
            const response = JSON.parse(event.data);
            console.log("Received from server:", response);
            setLastMessage(response);

            // Clear message after 3 seconds
            setTimeout(() => {
              if (isMounted.current) setLastMessage(null);
            }, 3000);
          } catch (e) {
            console.error("Error parsing server message:", e);
          }
        }
      };

      ws.onclose = () => {
        if (isMounted.current) {
          console.log("WebSocket disconnected");
          setStatus("disconnected");
          setSocket(null);

          // Attempt reconnect after 3 seconds
          reconnectTimeout = setTimeout(() => {
            console.log("Attempting to reconnect...");
            connect();
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        if (isMounted.current) {
          ws.close();
        }
      };
    };

    connect();

    return () => {
      isMounted.current = false;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws) {
        ws.close();
      }
    };
  }, []);

  const handleSave = () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      const payload = JSON.stringify({
        command: "save_config",
        data: configData
      });
      socket.send(payload);
      console.log("Configuration sent to server");
    } else {
      console.warn("WebSocket is not connected. Cannot save.");
      alert("Not connected to server. Please wait for connection...");
    }
  };

  // Styles
  const containerStyle = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginTop: "10px",
    padding: "10px",
    borderTop: "1px solid #eee",
  };

  const buttonStyle = {
    padding: "8px 16px",
    backgroundColor: status === "connected" ? "#4CAF50" : "#ccc",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: status === "connected" ? "pointer" : "not-allowed",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  };

  const statusIndicatorStyle = {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    backgroundColor:
      status === "connected"
        ? "#4CAF50"
        : status === "connecting"
          ? "#FFC107"
          : "#F44336",
    display: "inline-block",
  };

  return (
    <div className="config-save-controls" style={containerStyle}>
      <button
        onClick={handleSave}
        disabled={status !== "connected"}
        style={buttonStyle}
        title={
          status === "connected"
            ? "Save Configuration"
            : "Connecting to server..."
        }
      >
        <span>💾 Save Config</span>
      </button>

      <div
        style={{
          fontSize: "0.85em",
          color: "#666",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <span style={statusIndicatorStyle}></span>
        <span>
          {status === "connected" ? "Server Online" : "Server Offline"}
        </span>
      </div>

      {lastMessage && (
        <div
          style={{
            marginLeft: "auto",
            color: lastMessage.status === "success" ? "#2E7D32" : "#C62828",
            fontSize: "0.9em",
            fontWeight: "500",
          }}
        >
          {lastMessage.message}
        </div>
      )}
    </div>
  );
};

ConfigSaveButton.propTypes = {
  configData: PropTypes.object.isRequired,
};

export default ConfigSaveButton;
