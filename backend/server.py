import json
import os
import asyncio
import serial
import serial.tools.list_ports
import threading
import time
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS (Allow frontend to connect)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CONFIG_FILE = "config.json"
HISTORY_FILE = "config_history.json"

# Global Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting: {e}")

manager = ConnectionManager()

# Serial Manager
class SerialManager:
    def __init__(self):
        self.ser: Optional[serial.Serial] = None
        self.running = False
        self.thread: Optional[threading.Thread] = None
        self.port = None
        self.baudrate = 9600
        self.loop = None # Reference to main event loop

    def find_stm32_port(self):
        """Auto-detect STM32 port based on VID/PID or description"""
        ports = list(serial.tools.list_ports.comports())
        for p in ports:
            # Adjust these checks based on actual STM32 VID/PID or description
            if "STM32" in p.description or "COM7" in p.description:
                return p.device
        return None

    def connect(self):
        if self.ser and self.ser.is_open:
            return True

        port = self.find_stm32_port()
        # Fallback for development/testing if no STM32 found
        if not port:
            logger.warning("No STM32 found. Using Mock Mode.")
            self.start_mock_mode()
            return False

        try:
            self.ser = serial.Serial(port, self.baudrate, timeout=1)
            self.port = port
            logger.info(f"Connected to STM32 on {port}")
            self.start_reading()
            
            # Broadcast Status
            if self.loop:
                msg = {"type": "stm32_status", "status": "connected", "port": port}
                asyncio.run_coroutine_threadsafe(manager.broadcast(msg), self.loop)
                
            return True
        except Exception as e:
            logger.error(f"Failed to connect to serial: {e}")
            # Broadcast Failure
            if self.loop:
                msg = {"type": "stm32_status", "status": "disconnected"}
                asyncio.run_coroutine_threadsafe(manager.broadcast(msg), self.loop)
            return False

    def start_reading(self):
        if self.running:
            return
        self.running = True
        self.loop = asyncio.get_running_loop()
        self.thread = threading.Thread(target=self._read_loop, daemon=True)
        self.thread.start()

    def _read_loop(self):
        logger.info("Starting Serial Read Loop")
        while self.running and self.ser and self.ser.is_open:
            try:
                if self.ser.in_waiting:
                    line = self.ser.readline().decode('utf-8').strip()
                    if line:
                        # Ignore echo or status lines
                        if line.startswith("CONFIG:") or line.startswith("CMD:") or line.startswith("WAITING"):
                            logger.info(f"STM32 Status: {line}")
                            continue
                            
                        # Check for measurement line (simple heuristic: contains comma and numbers)
                        # Format: YYYY-MM-DD HH:MM:SS,<v1>,<v2>,...
                        # Or just: <v1>,<v2>,...
                        if "," in line:
                            try:
                                parts = line.split(",")
                                # We assume the first part might be a timestamp or just values
                                # If the first part looks like a date, keep it, else add one
                                
                                # Simple check if first part is a number
                                is_first_number = False
                                try:
                                    float(parts[0])
                                    is_first_number = True
                                except ValueError:
                                    pass
                                    
                                values = []
                                timestamp = datetime.now().isoformat()
                                
                                start_idx = 0
                                if not is_first_number:
                                    # Assume first part is timestamp from device, but we might prefer server time
                                    # or just skip it if it's not a number
                                    start_idx = 1
                                    
                                for x in parts[start_idx:]:
                                    try:
                                        values.append(float(x))
                                    except ValueError:
                                        pass
                                        
                                if values:
                                    msg = {
                                        "type": "measurement",
                                        "timestamp": timestamp,
                                        "values": values
                                    }
                                    
                                    if self.loop:
                                        asyncio.run_coroutine_threadsafe(
                                            manager.broadcast(msg), self.loop
                                        )
                            except Exception as e:
                                logger.warning(f"Failed to parse CSV line: {line} -> {e}")
            except Exception as e:
                logger.error(f"Serial read error: {e}")
                time.sleep(1)
        logger.info("Serial Read Loop Stopped")

    def send_raw(self, text: str):
        """Send raw string to STM32"""
        if self.ser and self.ser.is_open:
            try:
                if not text.endswith("\n"):
                    text += "\n"
                self.ser.write(text.encode('utf-8'))
                logger.info(f"Sent to STM32: {text.strip()}")
                return True
            except Exception as e:
                logger.error(f"Failed to send serial data: {e}")
                return False
        else:
            logger.warning("Serial not connected. Cannot send data.")
            return False

    def send_config_lines(self, config_data: dict):
        """Convert config dict to CONFIG: lines and send"""
        if not self.ser or not self.ser.is_open:
            return False
            
        try:
            # Example mapping based on request
            # CONFIG:DELAY=8
            # CONFIG:IA1,IArry,T_amb
            # ...
            
            # 1. Send Delay (example default or from config)
            delay = config_data.get("delay", 8)
            self.send_raw(f"CONFIG:DELAY={delay}")
            time.sleep(0.1) # Small delay to ensure STM32 buffer doesn't overflow
            
            # 2. Send MBs/Sensors
            # We need to iterate and send IDs or specific fields
            # Assuming 'mbInventory' or 'sensors' contains the items
            
            # Example: Send all MB IDs
            mbs = config_data.get("mbInventory", [])
            for mb in mbs:
                # Format: CONFIG:<ID>,<Type>
                self.send_raw(f"CONFIG:{mb.get('id')},{mb.get('type')}")
                time.sleep(0.05)
                
            # Example: Send Sensors
            sensors = config_data.get("sensors", [])
            for s in sensors:
                self.send_raw(f"CONFIG:{s.get('id')},{s.get('type')}")
                time.sleep(0.05)
                
            # 3. End Config
            self.send_raw("CONFIG:END")
            return True
        except Exception as e:
            logger.error(f"Error sending config lines: {e}")
            return False
            
    def start_mock_mode(self):
        logger.warning("Mock Mode has been disabled. No data will be generated.")


serial_manager = SerialManager()

# Helper Functions
def save_config_to_file(config_data: dict):
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config_data, f, indent=2)
        return True, "Config saved successfully"
    except Exception as e:
        return False, str(e)

@app.get("/api/config")
def get_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to read config file: {e}")
            return {}
    return {}

def append_to_history(config_data: dict):
    entry = {
        "timestamp": datetime.now().isoformat(),
        "config": config_data
    }
    history = []
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                content = f.read()
                if content:
                    history = json.loads(content)
                    if not isinstance(history, list): history = []
        except Exception:
            pass
    history.append(entry)
    try:
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2)
        return True
    except Exception:
        return False

@app.on_event("startup")
async def startup_event():
    # Try to connect to serial on startup
    # We need to wait a bit for the loop to be ready if we use it
    await asyncio.sleep(1)
    serial_manager.connect()

@app.on_event("shutdown")
def shutdown_event():
    serial_manager.running = False

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    print("Client connected")
    
    # Send current STM32 status
    status = "connected" if serial_manager.ser and serial_manager.ser.is_open else "disconnected"
    await websocket.send_json({
        "type": "stm32_status", 
        "status": status,
        "port": serial_manager.port if status == "connected" else None
    })
    
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                
                # Handle Commands
                cmd = message.get("command")
                
                if cmd == "scan":
                    print("Received scan request")
                    # Send Scan command to STM32
                    serial_manager.send_raw("CMD:SCAN")
                    
                    # Return empty result if not connected, or wait for serial response in real implementation
                    # For now, we return empty list to indicate no data found immediately
                    await websocket.send_json({
                        "type": "scan_result",
                        "data": [],
                        "timestamp": datetime.now().isoformat()
                    })
                    
                elif cmd == "start_measurement":
                    print("Starting measurement")
                    serial_manager.send_raw("CMD:START")
                    await websocket.send_json({"type": "status", "msg": "Measurement started"})
                    
                elif cmd == "stop_measurement":
                    print("Stopping measurement")
                    serial_manager.send_raw("CMD:STOP")
                    await websocket.send_json({"type": "status", "msg": "Measurement stopped"})
                    
                elif cmd == "save_config":
                    # Explicit Config Save
                    print("Received config update")
                    config_data = message.get("data", {})
                    
                    # 1. Save to file
                    success, msg = save_config_to_file(config_data)
                    
                    # 2. Save to history
                    if success:
                        append_to_history(config_data)
                        
                        # 3. Send to STM32
                        serial_manager.send_config_lines(config_data)
                        
                        response = {
                            "type": "save_confirm",
                            "status": "success", 
                            "message": "Configuration saved and sent to device."
                        }
                    else:
                        response = {
                            "type": "save_confirm",
                            "status": "error", 
                            "message": f"Failed to save: {msg}"
                        }
                    await websocket.send_json(response)
                    
                else:
                    # Ignore unknown commands or messages without command
                    # This prevents accidental overwrites on reconnection
                    pass
                    
            except json.JSONDecodeError:
                pass
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("Client disconnected")
