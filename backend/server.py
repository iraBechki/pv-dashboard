import json
import os
import asyncio
import serial
import serial.tools.list_ports
import threading
import time
import logging
import sqlite3
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import queue

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

import random
from pydantic import BaseModel
from diagnosis import DiagnosisEngine, Alert
from fastapi.responses import FileResponse

import sys
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

# ... (imports)

app = FastAPI()

# ... (CORS setup)

import random
from pydantic import BaseModel
from diagnosis import DiagnosisEngine, Alert

# Determine if running as a script or frozen exe
if getattr(sys, 'frozen', False):
    # If frozen, use the directory of the executable for persistent files
    BASE_DIR = os.path.dirname(sys.executable)
    # For bundled resources (like static files), use sys._MEIPASS
    BUNDLE_DIR = sys._MEIPASS
else:
    # If script, use the current directory
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    BUNDLE_DIR = BASE_DIR

CONFIG_FILE = os.path.join(BASE_DIR, "config.json")
HISTORY_FILE = os.path.join(BASE_DIR, "config_history.json")
MB_LIST_FILE = os.path.join(BASE_DIR, "mb_list.json")
STM_CONFIG_FILE = os.path.join(BASE_DIR, "stm_config.json")
DB_FILE = os.path.join(BASE_DIR, "pv_history.db")

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

# Database Helper Functions
def init_database():
    """Initialize SQLite database with required tables"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Create measurements table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS measurements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME NOT NULL,
            mb_id TEXT NOT NULL,
            field_name TEXT NOT NULL,
            value REAL
        )
    ''')
    
    # Create indexes for measurements table
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_timestamp ON measurements(timestamp)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_mb_field ON measurements(mb_id, field_name)')
    
    # Create calculations table for aggregated data
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS calculations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME NOT NULL,
            total_pv_power REAL,
            battery_soc REAL,
            battery_voltage REAL,
            battery_power REAL,
            consumption_power REAL,
            daily_energy REAL,
            monthly_energy REAL,
            total_energy REAL
        )
    ''')
    
    # Create index for calculations table
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_calc_timestamp ON calculations(timestamp)')
    
    # Create alerts table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME NOT NULL,
            severity TEXT NOT NULL,
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            component TEXT,
            value REAL,
            threshold REAL,
            acknowledged BOOLEAN DEFAULT 0,
            acknowledged_at DATETIME,
            resolved BOOLEAN DEFAULT 0,
            resolved_at DATETIME,
            deleted BOOLEAN DEFAULT 0
        )
    ''')
    
    # Migration: Add deleted column if it doesn't exist
    try:
        cursor.execute('ALTER TABLE alerts ADD COLUMN deleted BOOLEAN DEFAULT 0')
    except sqlite3.OperationalError:
        # Column likely already exists
        pass
    
    # Create index for alerts table
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved)')
    
    # Create diagnosis_settings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS diagnosis_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            enabled BOOLEAN DEFAULT 0,
            notifications_enabled BOOLEAN DEFAULT 1,
            thresholds TEXT
        )
    ''')
    
    # Insert default diagnosis settings if not exists
    cursor.execute('INSERT OR IGNORE INTO diagnosis_settings (id, enabled) VALUES (1, 0)')
    
    conn.commit()
    conn.close()
    logger.info("Database initialized successfully")

def save_measurement_to_db(timestamp, mb_data, calculations):
    """Save a measurement to the database"""
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        # Save raw MB data
        for mb_id, fields in mb_data.items():
            for field_name, value in fields.items():
                if isinstance(value, (int, float)):
                    cursor.execute(
                        'INSERT INTO measurements (timestamp, mb_id, field_name, value) VALUES (?, ?, ?, ?)',
                        (timestamp, mb_id, field_name, value)
                    )
        
        # Save calculations
        cursor.execute('''
            INSERT INTO calculations 
            (timestamp, total_pv_power, battery_soc, battery_voltage, battery_power, 
             consumption_power, daily_energy, monthly_energy, total_energy)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            timestamp,
            calculations.get('total_pv_power'),
            calculations.get('battery_soc'),
            calculations.get('battery_voltage'),
            calculations.get('battery_power'),
            calculations.get('consumption_power'),
            calculations.get('daily_energy'),
            calculations.get('monthly_energy'),
            calculations.get('total_energy')
        ))
        
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error saving to database: {e}")

def get_historical_data(start_date, end_date, granularity='hour'):
    """Retrieve historical data from database with aggregation"""
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        # Determine aggregation based on granularity
        if granularity == 'hour':
            time_format = '%Y-%m-%d %H:00:00'
        elif granularity == 'day':
            time_format = '%Y-%m-%d'
        else:  # month
            time_format = '%Y-%m'
        
        # 1. Get Calculations
        query_calc = f'''
            SELECT 
                strftime('{time_format}', timestamp) as time_bucket,
                AVG(total_pv_power) as total_pv_power,
                AVG(battery_soc) as battery_soc,
                AVG(battery_voltage) as battery_voltage,
                AVG(battery_power) as battery_power,
                AVG(consumption_power) as consumption_power,
                MAX(daily_energy) as daily_energy
            FROM calculations
            WHERE timestamp BETWEEN ? AND ?
            GROUP BY time_bucket
            ORDER BY time_bucket
        '''
        
        cursor.execute(query_calc, (start_date, end_date))
        rows_calc = cursor.fetchall()
        
        # Map results by timestamp for merging
        results_map = {}
        for row in rows_calc:
            results_map[row[0]] = {
                'timestamp': row[0],
                'total_pv_power': round(row[1], 2) if row[1] else 0,
                'battery_soc': round(row[2], 2) if row[2] else 0,
                'battery_voltage': round(row[3], 2) if row[3] else 0,
                'battery_power': round(row[4], 2) if row[4] else 0,
                'consumption_power': round(row[5], 2) if row[5] else 0,
                'daily_energy': round(row[6], 2) if row[6] else 0
            }
            
        # 2. Get INVD Data
        invd_fields = ['PV1_V', 'PV1_I', 'PV2_V', 'PV2_I', 'Vbat', 'Ibat', 'Vout', 'Iout', 'Pout']
        
        query_invd = f'''
            SELECT 
                strftime('{time_format}', timestamp) as time_bucket,
                field_name,
                AVG(value)
            FROM measurements
            WHERE mb_id = 'INVD' 
            AND timestamp BETWEEN ? AND ?
            AND field_name IN ({','.join(['?']*len(invd_fields))})
            GROUP BY time_bucket, field_name
        '''
        
        cursor.execute(query_invd, (start_date, end_date, *invd_fields))
        rows_invd = cursor.fetchall()
        
        # Merge INVD data
        for row in rows_invd:
            time_bucket = row[0]
            field = row[1]
            val = row[2]
            
            if time_bucket not in results_map:
                results_map[time_bucket] = {'timestamp': time_bucket}
            
            results_map[time_bucket][f'INVD_{field}'] = round(val, 2) if val else 0

        conn.close()
        
        # Convert map to list and sort
        final_result = list(results_map.values())
        final_result.sort(key=lambda x: x['timestamp'])
        
        return final_result
    except Exception as e:
        logger.error(f"Error retrieving historical data: {e}")
        return []

# Initialize database on startup
init_database()

# Alert Management Functions
def save_alert_to_db(alert: Alert):
    """Save an alert to the database"""
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO alerts 
            (timestamp, severity, category, title, message, component, value, threshold)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            alert.timestamp,
            alert.severity,
            alert.category,
            alert.title,
            alert.message,
            alert.component,
            alert.value,
            alert.threshold
        ))
        
        alert_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return alert_id
    except Exception as e:
        logger.error(f"Error saving alert: {e}")
        return None

def get_alerts_from_db(limit=50, severity=None, unread_only=False):
    """Retrieve alerts from database"""
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        query = 'SELECT * FROM alerts WHERE 1=1'
        params = []
        
        if severity:
            query += ' AND severity = ?'
            params.append(severity)
        
        if unread_only:
            query += ' AND acknowledged = 0 AND resolved = 0'
        
        query += ' ORDER BY timestamp DESC LIMIT ?'
        params.append(limit)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        alerts = []
        for row in rows:
            alerts.append({
                'id': row[0],
                'timestamp': row[1],
                'severity': row[2],
                'category': row[3],
                'title': row[4],
                'message': row[5],
                'component': row[6],
                'value': row[7],
                'threshold': row[8],
                'acknowledged': bool(row[9]),
                'acknowledged_at': row[10],
                'resolved': bool(row[11]),
                'resolved_at': row[12],
                'deleted': bool(row[13]) if len(row) > 13 else False
            })
        
        conn.close()
        return alerts
    except Exception as e:
        logger.error(f"Error retrieving alerts: {e}")
        return []

def auto_resolve_alerts(alert_signature):
    """Auto-resolve alerts when the issue is fixed"""
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        # Mark as resolved if not already
        cursor.execute('''
            UPDATE alerts 
            SET resolved = 1, resolved_at = ? 
            WHERE resolved = 0 
            AND (title || '_' || COALESCE(component, '')) = ?
        ''', (datetime.now().isoformat(), alert_signature))
        
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error auto-resolving alerts: {e}")

def acknowledge_alert_in_db(alert_id):
    """Acknowledge an alert"""
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE alerts 
            SET acknowledged = 1, acknowledged_at = ? 
            WHERE id = ?
        ''', (datetime.now().isoformat(), alert_id))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Error acknowledging alert: {e}")
        return False

def get_unread_alert_count():
    """Get count of unread alerts"""
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        cursor.execute('SELECT COUNT(*) FROM alerts WHERE acknowledged = 0 AND resolved = 0')
        count = cursor.fetchone()[0]
        
        conn.close()
        return count
    except Exception as e:
        logger.error(f"Error getting unread count: {e}")
        return 0

def get_diagnosis_settings():
    """Get diagnosis settings from database"""
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        cursor.execute('SELECT enabled, thresholds, notifications_enabled FROM diagnosis_settings WHERE id = 1')
        row = cursor.fetchone()
        
        conn.close()
        
        if row:
            return {
                'enabled': bool(row[0]),
                'thresholds': json.loads(row[1]) if row[1] else None,
                'notifications_enabled': bool(row[2]) if len(row) > 2 else True
            }
        return {'enabled': False, 'thresholds': None, 'notifications_enabled': True}
    except Exception as e:
        logger.error(f"Error getting diagnosis settings: {e}")
        return {'enabled': False, 'thresholds': None}

def save_diagnosis_settings(enabled, thresholds=None, notifications_enabled=True):
    """Save diagnosis settings to database"""
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        thresholds_json = json.dumps(thresholds) if thresholds else None
        
        cursor.execute('''
            UPDATE diagnosis_settings 
            SET enabled = ?, thresholds = ?, notifications_enabled = ?
            WHERE id = 1
        ''', (enabled, thresholds_json, notifications_enabled))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Error saving diagnosis settings: {e}")
        return False

# Initialize Diagnosis Engine
diagnosis_engine = DiagnosisEngine()
settings = get_diagnosis_settings()
diagnosis_engine.enabled = settings['enabled']
if settings['thresholds']:
    diagnosis_engine.thresholds = settings['thresholds']

# Serial Manager
class SerialManager:
    def __init__(self):
        self.ser: Optional[serial.Serial] = None
        self.running = False
        self.thread: Optional[threading.Thread] = None
        self.port = None
        self.baudrate = 9600
        self.loop = None # Reference to main event loop
        self.serial_lock = threading.Lock() # Lock for thread safety
        self.status_queue = queue.Queue() # Queue for STATUS messages
        self.measurement_schema = [] # Schema for parsing CSV data
        self.assignments = {}
        self.sensor_categories = {}
        self.energy_totals = {}
        self.last_calculation_time = None
        
        # Energy tracking for today, month, and total
        self.daily_energy = 0.0  # kWh generated today
        self.monthly_energy = 0.0  # kWh generated this month
        self.total_energy = 0.0  # kWh generated all time
        self.current_day = datetime.now().day
        self.current_month = datetime.now().month
        self.daily_history = [] # In-memory buffer for current day measurements

    def find_stm32_port(self):
        """Auto-detect STM32 port, prioritizing COM7"""
        ports = list(serial.tools.list_ports.comports())
        
        # Priority 1: Check for COM7 explicitly
        for p in ports:
            if p.device.upper() == "COM7":
                logger.info("Found COM7, using it.")
                return "COM7"
                
        # Priority 2: Check for description
        for p in ports:
            if "STM32" in p.description:
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
    def load_measurement_schema(self):
        """Load measurement schema from stm_config.json"""
        config_path = STM_CONFIG_FILE
        if not os.path.exists(config_path):
            logger.warning("stm_config.json not found")
            self.measurement_schema = []
            return
        
        try:
            with open(config_path, 'r') as f:
                lines = f.readlines()
            
            schema = []
            for line in lines:
                line = line.strip()
                # Skip config control lines
                if line.startswith("CONFIG:") or len(line) == 0:
                    continue
                
                # Parse MB line: "MB_ID,field1,field2,field3"
                parts = [p.strip() for p in line.split(',')]
                if len(parts) >= 2:
                    mb_id = parts[0]
                    fields = parts[1:]
                    schema.append({"mb_id": mb_id, "fields": fields})
            
            self.measurement_schema = schema
            logger.info(f"Loaded measurement schema: {schema}")
        except Exception as e:
            logger.error(f"Failed to load measurement schema: {e}")
            self.measurement_schema = []

    def load_assignments(self):
        """Load assignments from config.json"""
        config_path = CONFIG_FILE
        if os.path.exists(config_path):
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    config = json.load(f)
                    self.assignments = config.get("assignments", {})
                    
                    # Load sensor categories
                    self.sensor_categories = {}
                    for sensor in config.get("sensors", []):
                        if "id" in sensor and "category" in sensor:
                            self.sensor_categories[sensor["id"]] = sensor["category"]
                            
                    logger.info(f"Loaded assignments: {self.assignments}")
                    logger.info(f"Loaded categories: {self.sensor_categories}")
            except Exception as e:
                logger.error(f"Failed to load assignments: {e}")
                self.assignments = {}
                self.sensor_categories = {}

    def estimate_soc(self, voltage):
        """Estimate SoC based on voltage (assuming 48V system for now, can be adjusted)"""
        # Simple linear interpolation for 48V Lead-Acid/Li-ion
        # 0% = 42V, 100% = 54V
        if voltage < 10: # Probably 12V system or off
             if voltage < 10.5: return 0
             if voltage > 13.5: return 100
             return (voltage - 10.5) / (13.5 - 10.5) * 100
        
        # 24V System
        if voltage < 22: 
             if voltage < 21: return 0
             if voltage > 27: return 100
             return (voltage - 21) / (27 - 21) * 100

        # 48V System (Default)
        if voltage < 42: return 0
        if voltage > 54: return 100
        return (voltage - 42) / (54 - 42) * 100

    def calculate_power_energy(self, data):
        """Calculate Power and Energy based on assignments"""
        calculations = {}
        
        # Current time for energy calculation
        now = datetime.now()
        time_diff_hours = 0
        if self.last_calculation_time:
            time_diff_hours = (now - self.last_calculation_time).total_seconds() / 3600.0
        self.last_calculation_time = now
        
        # Check if day or month has changed (reset counters)
        if now.day != self.current_day:
            logger.info(f"Day changed. Daily energy was: {self.daily_energy:.3f} kWh")
            self.daily_energy = 0.0
            self.current_day = now.day
            self.daily_history = [] # Clear history for new day
        
        if now.month != self.current_month:
            logger.info(f"Month changed. Monthly energy was: {self.monthly_energy:.3f} kWh")
            self.monthly_energy = 0.0
            self.current_month = now.month

        if not self.assignments:
            return {}

        total_pv_power = 0
        consumption_power = 0
        battery_power = 0
        battery_soc = 0
        battery_voltage = 0
        
        # Track energy increment for this calculation cycle
        pv_energy_increment = 0.0
        
        for point_id, mb_ids in self.assignments.items():
            # e.g. point_id="arr-1-str-1", mb_ids=["VD1", "ID1"]
            
            voltage = 0
            current = 0
            has_valid_data = False
            
            for mb_id in mb_ids:
                if mb_id in data:
                    mb_data = data[mb_id]
                    # Find voltage field (starts with V, not Batt)
                    for k, v in mb_data.items():
                        # Skip NaN values
                        if v == "NaN" or v == "nan" or (isinstance(v, str) and v.upper() == "NAN"):
                            continue
                            
                        if isinstance(v, (int, float)):
                            has_valid_data = True
                            if k.startswith("V") and "Batt" not in k:
                                voltage = v
                            elif k.startswith("I") or k.startswith("A"):
                                current = v
            
            # Only calculate power if we have valid data (not NaN)
            if has_valid_data:
                # Calculate Power (W)
                power = voltage * current
                calculations[point_id] = {
                    "voltage": voltage,
                    "current": current,
                    "power": power
                }
                
                category = self.sensor_categories.get(point_id, "other")
                
                # Accumulate Energy (kWh) if it's a PV string
                if "str" in point_id or category == "solar":
                    total_pv_power += power
                    # Initialize energy if not exists
                    if point_id not in self.energy_totals:
                        self.energy_totals[point_id] = 0.0
                    
                    # Add energy (kW * h)
                    energy_increment = (power / 1000.0) * time_diff_hours
                    if energy_increment > 0:
                        self.energy_totals[point_id] += energy_increment
                        pv_energy_increment += energy_increment
                    calculations[point_id]["energy"] = self.energy_totals[point_id]
                
                elif category == "inverter":
                    # Assuming Inverter category represents Consumption/Grid for now based on user request
                    # "Consumption power represent the AC voltage and current"
                    consumption_power += power
                
                elif category == "battery":
                    battery_power += power
                    battery_voltage = voltage
                    # Estimate SoC
                    battery_soc = self.estimate_soc(voltage)
                    calculations[point_id]["soc"] = battery_soc
            else:
                # Mark as no data available
                calculations[point_id] = {
                    "voltage": None,
                    "current": None,
                    "power": None,
                    "status": "disconnected"
                }
        
        # Update daily, monthly, and total energy
        if pv_energy_increment > 0:
            self.daily_energy += pv_energy_increment
            self.monthly_energy += pv_energy_increment
            self.total_energy += pv_energy_increment

        calculations["total_pv_power"] = total_pv_power
        calculations["consumption_power"] = consumption_power
        calculations["battery_power"] = battery_power
        calculations["battery_soc"] = battery_soc
        calculations["battery_voltage"] = battery_voltage
        
        # Add energy generation totals
        calculations["daily_energy"] = self.daily_energy
        calculations["monthly_energy"] = self.monthly_energy
        calculations["total_energy"] = self.total_energy
        
        return calculations

    def process_measurement_line(self, line: str):
        """Process a raw CSV line and return the structured message."""
        if "," not in line:
            return None
            
        try:
            parts = [p.strip() for p in line.split(",")]
            
            # Check if first part is timestamp
            timestamp = None
            value_start_idx = 0
            
            try:
                float(parts[0])
                # First part is a number, use server time
                timestamp = datetime.now().isoformat()
                value_start_idx = 0
            except ValueError:
                # First part is not a number, assume it's timestamp
                timestamp = parts[0]
                value_start_idx = 1
            
            # Parse values according to schema
            values = parts[value_start_idx:]
            
            if self.measurement_schema:
                # Use schema to structure data
                data = {}
                value_idx = 0
                
                for mb_config in self.measurement_schema:
                    mb_id = mb_config["mb_id"]
                    fields = mb_config["fields"]
                    
                    mb_data = {}
                    for field_name in fields:
                        if value_idx < len(values):
                            try:
                                # Try to convert to float, but keep NaN as string
                                val = values[value_idx].strip()
                                if val.upper() == "NAN":
                                    mb_data[field_name] = "NaN"
                                else:
                                    mb_data[field_name] = float(val)
                            except ValueError:
                                mb_data[field_name] = values[value_idx]
                            value_idx += 1
                    
                    data[mb_id] = mb_data
                
                # Calculate Power & Energy
                calcs = self.calculate_power_energy(data)
                
                msg = {
                    "type": "measurement",
                    "timestamp": timestamp,
                    "data": data,
                    "calculations": calcs
                }
                self.daily_history.append(msg)
                
                # Save to database
                save_measurement_to_db(timestamp, data, calcs)
                
                # Run diagnosis if enabled
                if diagnosis_engine.enabled:
                    # Load config for diagnosis engine
                    if not diagnosis_engine.config:
                        config_path = os.path.join(os.path.dirname(__file__), "config.json")
                        if os.path.exists(config_path):
                            with open(config_path, 'r') as f:
                                config_data = json.load(f)
                                diagnosis_engine.set_config(config_data)
                                # Also set sensor categories
                                diagnosis_engine.set_sensor_categories(config_data)
                    
                    # Extract INVD data
                    invd_data = data.get('INVD', {})
                    
                    # Analyze and generate alerts
                    new_alerts = diagnosis_engine.analyze_measurement(data, calcs, invd_data)
                    
                    # Save new alerts and check for auto-resolve
                    for alert in new_alerts:
                        alert_sig = diagnosis_engine.get_alert_signature(alert)
                        
                        # Check if this type of alert already exists and is unresolved
                        if alert_sig not in diagnosis_engine.active_alerts:
                            # New alert - save it
                            alert_id = save_alert_to_db(alert)
                            if alert_id:
                                diagnosis_engine.active_alerts[alert_sig] = alert_id
                                logger.info(f"New alert generated: {alert.title}")
                    
                    # Auto-resolve: Check if previously active alerts should be resolved
                    # (i.e., the condition that triggered them no longer exists)
                    current_alert_sigs = {diagnosis_engine.get_alert_signature(a) for a in new_alerts}
                    for sig in list(diagnosis_engine.active_alerts.keys()):
                        if sig not in current_alert_sigs:
                            # This alert type is no longer being triggered - auto-resolve it
                            auto_resolve_alerts(sig)
                            del diagnosis_engine.active_alerts[sig]
                            logger.info(f"Auto-resolved alert: {sig}")
                
                return msg
            else:
                # Fallback: send raw values if no schema
                float_values = []
                for v in values:
                    try:
                        float_values.append(float(v))
                    except ValueError:
                        pass
                
                return {
                    "type": "measurement",
                    "timestamp": timestamp,
                    "values": float_values
                }
        except Exception as e:
            logger.error(f"Error processing measurement line: {e}")
            return None

    def _read_loop(self):
        logger.info("Starting Serial Read Loop")
        while self.running and self.ser and self.ser.is_open:
            try:
                with self.serial_lock:
                    if self.ser.in_waiting:
                        line = self.ser.readline().decode('utf-8').strip()
                    else:
                        line = None
                
                if line:
                    # Ignore echo lines but NOT status lines (needed for command confirmation)
                    if line.startswith("CONFIG:") or line.startswith("CMD:") or line.startswith("WAITING"):
                        logger.info(f"STM32 Echo: {line}")
                        continue
                    
                    # Queue STATUS: lines for command confirmation
                    if line.startswith("STATUS:"):
                        logger.info(f"Queueing status: {line}")
                        self.status_queue.put(line)
                        continue
                        
                    # Process measurement line
                    msg = self.process_measurement_line(line)
                    if msg:
                        logger.info(f"Broadcasting structured data: {msg}")
                        # Note: asyncio.run() can only be called from a non-async function if there's no running event loop.
                        # If this method is called from a thread, and the main thread has an event loop,
                        # asyncio.run_coroutine_threadsafe is usually preferred.
                        # For simplicity and following the instruction, using asyncio.run here.
                        # If this causes issues, consider re-introducing asyncio.run_coroutine_threadsafe.
                        asyncio.run(manager.broadcast(msg))
            except Exception as e:
                logger.error(f"Serial read error: {e}")
                time.sleep(1)
            
            # Yield lock to allow sending threads to run
            time.sleep(0.01)
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

    def send_with_echo(self, text: str, timeout=2.0):
        """Send data and wait for echo verification (Synchronous)"""
        # Re-using the logic or just calling the new method if appropriate?
        # send_with_echo expects the text itself as response.
        return self.send_command_wait_response(text, text.strip(), timeout)

    def send_command_wait_response(self, command: str, expected_response: str, timeout=3.0):
        """Send command and wait for specific response (Synchronous)"""
        if not self.ser or not self.ser.is_open:
            return False, "Not connected"
            
        try:
            logger.info(f"Attempting to send command: {command.strip()} (waiting for {expected_response})")
            with self.serial_lock:
                logger.info("Serial lock acquired")
                if not command.endswith("\n"):
                    command += "\n"
                    
                self.ser.reset_input_buffer()
                logger.info("Input buffer reset")
                
                self.ser.write(command.encode('utf-8'))
                logger.info(f"Sent Command (Sync): {command.strip()}")
                
                # Give STM32 time to process (increased to 0.5s to match send_with_echo)
                time.sleep(0.5)
                
                start_time = time.time()
                while time.time() - start_time < timeout:
                    # Check queue first (messages from read loop)
                    try:
                        resp = self.status_queue.get(timeout=0.05)
                        logger.info(f"Response from queue: {resp}")
                        if expected_response in resp:
                            logger.info("Expected response matched!")
                            return True, "Confirmed"
                    except queue.Empty:
                        pass
                    
                    # Also check serial buffer directly (in case read loop is slow)
                    if self.ser.in_waiting:
                        resp = self.ser.readline().decode(errors='ignore').strip()
                        if resp:
                            logger.info(f"Response from serial: {resp}")
                            if expected_response in resp:
                                logger.info("Expected response matched!")
                                return True, "Confirmed"
            
            logger.warning("Timeout waiting for confirmation")
            return False, "Timeout waiting for confirmation"
        except Exception as e:
            logger.error(f"Command failed: {e}")
            return False, str(e)

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

    return {}

class MBSelection(BaseModel):
    selected_ids: List[str]
    delay: int = 10

class SimulationRequest(BaseModel):
    line: str

@app.post("/api/simulate")
async def simulate_measurement(request: SimulationRequest):
    """Inject a simulated measurement line."""
    try:
        logger.info(f"Simulating data: {request.line}")
        msg = serial_manager.process_measurement_line(request.line)
        if msg:
            await manager.broadcast(msg)
            return {"status": "success", "message": "Data injected"}
        else:
            return {"status": "error", "message": "Failed to process line"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/mb_list")
def get_mb_list():
    if os.path.exists(MB_LIST_FILE):
        try:
            with open(MB_LIST_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                mb_list = data.get("mb_list", [])
                # Simulate online status check
                for mb in mb_list:
                    # Randomly assign True/False for simulation
                    mb["online"] = random.choice([True, False])
                return mb_list
        except Exception as e:
            logger.error(f"Failed to read mb_list: {e}")
            return []
    return []

@app.post("/api/mb_selection")
def save_mb_selection(selection: MBSelection):
    if not os.path.exists(MB_LIST_FILE):
        return {"status": "error", "message": "MB List file not found"}
        
    try:
        # Read Master List
        with open(MB_LIST_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            master_list = data.get("mb_list", [])
            
        # Filter selected MBs and generate CSV lines
        csv_lines = []
        csv_lines.append("CONFIG:START")
        
        # Add Delay
        csv_lines.append(f"CONFIG:DELAY={selection.delay}")
        
        count = 0
        selected_mbs_full = []
        
        for mb in master_list:
            if mb["id"] in selection.selected_ids:
                # Add to full list for config.json
                selected_mbs_full.append(mb)
                
                # Format: ID,config1,config2...
                config_items = mb.get("config", [])
                line = f"{mb['id']},{','.join(config_items)}"
                csv_lines.append(line)
                count += 1
        
        csv_lines.append("CONFIG:END")
        
        # Update config.json with selected MBs and Delay
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    config_data = json.load(f)
                
                config_data["mbInventory"] = selected_mbs_full
                config_data["measurementDelay"] = selection.delay
                
                with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                    json.dump(config_data, f, indent=2)
                logger.info("Updated config.json with new MB selection and delay")
            except Exception as e:
                logger.error(f"Failed to update config.json: {e}")
                
        # Save to stm_config.json (as text/csv content)
        with open(STM_CONFIG_FILE, "w", encoding="utf-8") as f:
            f.write("\n".join(csv_lines))
            
        # Ensure connected
        if not serial_manager.ser or not serial_manager.ser.is_open:
            logger.info("Serial not open, trying to connect...")
            serial_manager.connect()
            
        if serial_manager.ser and serial_manager.ser.is_open:
            logger.info(f"Sending {len(csv_lines)} lines to STM32 (Synchronous)...")
            
            success_count = 0
            # Send to STM32 line by line
            for line in csv_lines:
                ok, msg = serial_manager.send_with_echo(line)
                if not ok:
                    logger.error(f"Failed to send line '{line}': {msg}")
                else:
                    success_count += 1
                time.sleep(0.1) # Delay between lines (reduced for faster config)
            
            # Load the measurement schema after successful config save
            serial_manager.load_measurement_schema()
            
            return {"status": "success", "message": f"Saved and verified {success_count}/{len(csv_lines)} lines"}
        else:
            logger.error("Could not connect to STM32 to send config")
            return {"status": "error", "message": "Could not connect to STM32"}
            
        return {"status": "success", "message": f"Saved {count} MBs and sent to STM32"}
    except Exception as e:
        logger.error(f"Error saving selection: {e}")
        return {"status": "error", "message": str(e)}

@app.get("/api/stm_config")
def get_stm_config():
    if os.path.exists(STM_CONFIG_FILE):
        try:
            with open(STM_CONFIG_FILE, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            logger.error(f"Failed to read stm_config: {e}")
            return ""
    return ""

@app.get("/api/config")
def get_config():
    config_path = CONFIG_FILE
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to read config: {e}")
            return {}
    return {}

@app.get("/api/measurement_state")
def get_measurement_state():
    """Get the current measurement state from config.json"""
    config_path = os.path.join(os.path.dirname(__file__), "config.json")
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config_data = json.load(f)
                return {"isMeasuring": config_data.get("isMeasuring", False)}
        except Exception as e:
            logger.error(f"Failed to read measurement state: {e}")
    return {"isMeasuring": False}

@app.post("/api/measurement_state")
def set_measurement_state(state: dict):
    """Save measurement state to config.json"""
    config_path = os.path.join(os.path.dirname(__file__), "config.json")
    try:
        # Read existing config
        config_data = {}
        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                config_data = json.load(f)
        
        # Update state
        config_data["isMeasuring"] = state.get("isMeasuring", False)
        
        # Write back
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config_data, f, indent=2)
        
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Failed to save measurement state: {e}")
        return {"status": "error", "message": str(e)}

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
    # Load schemas on startup
    serial_manager.load_measurement_schema()
    serial_manager.load_assignments()

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
            except json.JSONDecodeError:
                continue
                
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
                print("Starting measurement...")
                success, msg = serial_manager.send_command_wait_response("CMD:START", "STATUS:RUNNING")
                
                if success:
                    await websocket.send_json({
                        "type": "command_ack", 
                        "command": "start", 
                        "status": "success",
                        "message": "Measurement started successfully"
                    })
                else:
                    await websocket.send_json({
                        "type": "command_ack", 
                        "command": "start", 
                        "status": "error", 
                        "message": f"Failed to start: {msg}"
                    })
                
            elif cmd == "stop_measurement":
                print("Stopping measurement...")
                success, msg = serial_manager.send_command_wait_response("CMD:STOP", "STATUS:STOPPED")
                
                if success:
                    await websocket.send_json({
                        "type": "command_ack", 
                        "command": "stop", 
                        "status": "success",
                        "message": "Measurement stopped successfully"
                    })
                else:
                    await websocket.send_json({
                        "type": "command_ack", 
                        "command": "stop", 
                        "status": "error", 
                        "message": f"Failed to stop: {msg}"
                    })
                
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
                pass

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("Client disconnected")

# History Endpoints
@app.get("/api/history/today")
def get_history_today():
    """Get all measurements for the current day"""
    return serial_manager.daily_history

@app.get("/api/history/range")
def get_history_range(start: str, end: str, granularity: str = 'hour'):
    """
    Get historical data for a date range with aggregation
    
    Parameters:
    - start: Start date in YYYY-MM-DD format
    - end: End date in YYYY-MM-DD format  
    - granularity: 'hour', 'day', or 'month'
    """
    try:
        # Validate dates
        start_date = datetime.strptime(start, '%Y-%m-%d')
        end_date = datetime.strptime(end, '%Y-%m-%d')
        
        # Add time to make it inclusive
        start_str = start_date.strftime('%Y-%m-%d 00:00:00')
        end_str = (end_date + timedelta(days=1)).strftime('%Y-%m-%d 00:00:00')
        
        data = get_historical_data(start_str, end_str, granularity)
        return data
    except ValueError as e:
        return {"error": f"Invalid date format: {e}"}
    except Exception as e:
        logger.error(f"Error retrieving historical data: {e}")
        return {"error": str(e)}


# Alert Endpoints
@app.get("/api/alerts")
def get_alerts(limit: int = 50, severity: str = None):
    """Get alerts from database"""
    if severity == "all":
        severity = None
    return get_alerts_from_db(limit=limit, severity=severity)

@app.get("/api/alerts/unread")
def get_unread_alerts():
    """Get count of unread alerts"""
    count = get_unread_alert_count()
    return {"count": count}

@app.post("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int):
    """Acknowledge an alert"""
    success = acknowledge_alert_in_db(alert_id)
    if success:
        return {"status": "success", "message": "Alert acknowledged"}
    return {"status": "error", "message": "Failed to acknowledge alert"}

@app.delete("/api/alerts/{alert_id}")
def delete_alert(alert_id: int):
    """Delete an alert (Soft Delete)"""
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        # Soft delete: mark as deleted AND resolved (so it leaves the active view)
        cursor.execute('UPDATE alerts SET deleted = 1, resolved = 1, resolved_at = ? WHERE id = ?', 
                      (datetime.now().isoformat(), alert_id))
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Alert deleted"}
    except Exception as e:
        logger.error(f"Error deleting alert: {e}")
        return {"status": "error", "message": str(e)}

# Diagnosis Settings Endpoints
@app.get("/api/diagnosis/settings")
def get_diagnosis_settings_api():
    """Get diagnosis settings"""
    settings = get_diagnosis_settings()
    settings['thresholds'] = diagnosis_engine.thresholds  # Include current thresholds
    return settings

class DiagnosisSettingsUpdate(BaseModel):
    enabled: bool
    notifications_enabled: bool = True
    thresholds: dict = None

@app.post("/api/diagnosis/settings")
def update_diagnosis_settings_api(settings: DiagnosisSettingsUpdate):
    """Update diagnosis settings"""
    try:
        # Update database
        success = save_diagnosis_settings(settings.enabled, settings.thresholds, settings.notifications_enabled)
        
        if success:
            # Update diagnosis engine
            diagnosis_engine.enabled = settings.enabled
            if settings.thresholds:
                diagnosis_engine.thresholds = settings.thresholds
            
            return {"status": "success", "message": "Diagnosis settings updated"}
        return {"status": "error", "message": "Failed to save settings"}
    except Exception as e:
        logger.error(f"Error updating diagnosis settings: {e}")
        return {"status": "error", "message": str(e)}

# Serve React Static Files
# Mount the 'static' folder from the build directory
# We assume the build folder is renamed to 'static' and placed in BUNDLE_DIR
static_folder = os.path.join(BUNDLE_DIR, "static")

if os.path.exists(static_folder):
    # Mount /static path for JS/CSS chunks
    # React build puts assets in static/static/js... so we mount the inner static
    if os.path.exists(os.path.join(static_folder, "static")):
        app.mount("/static", StaticFiles(directory=os.path.join(static_folder, "static")), name="static")

    # Catch-all route to serve index.html or other files in root of build
    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        file_path = os.path.join(static_folder, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        
        # Fallback to index.html for SPA routing
        index_path = os.path.join(static_folder, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return {"error": "Frontend not found"}

if __name__ == "__main__":
    import uvicorn
    import socket
    
    def find_free_port():
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('', 0))
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            return s.getsockname()[1]

    # Try 8000 first, then random free port
    port = 8000
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("0.0.0.0", port))
    except OSError:
        port = find_free_port()

    print(f"Starting server on port {port}...")

    # Open browser automatically if frozen
    if getattr(sys, 'frozen', False):
        import webbrowser
        threading.Timer(1.5, lambda: webbrowser.open(f"http://localhost:{port}")).start()
        
    uvicorn.run(app, host="0.0.0.0", port=port)
