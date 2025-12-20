import urllib.request
import json
import time
import random
import datetime
import os

SERVER_PORT = 8000
SERVER_URL = f"http://localhost:{SERVER_PORT}/api/simulate"
# Try to find stm_config.json in likely locations
POSSIBLE_CONFIG_PATHS = [
    "stm_config.json",
    "backend/dist/stm_config.json",
    "dist/stm_config.json",
    "../stm_config.json"
]

NAN_INJECTION_PROBABILITY = 0.0
disconnected_mbs = set()

def find_config_file():
    for path in POSSIBLE_CONFIG_PATHS:
        if os.path.exists(path):
            return path
    return None

def check_server_connection(port):
    url = f"http://localhost:{port}/api/config"
    try:
        with urllib.request.urlopen(url, timeout=1) as response:
            return response.status == 200
    except:
        return False

def find_active_port():
    # Try ports 8000 to 8010
    for port in range(8000, 8011):
        if check_server_connection(port):
            return port
    return None

def load_schema():
    schema = []
    config_path = find_config_file()
    if config_path:
        print(f"Loading schema from {config_path}")
        with open(config_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("CONFIG:"):
                    parts = line.split(',')
                    if len(parts) >= 2:
                        mb_id = parts[0]
                        fields = parts[1:]
                        schema.append({"id": mb_id, "fields": fields})
    else:
        print("Warning: stm_config.json not found in common locations.")
    return schema

def generate_value(field_name, mb_id=None):
    """
    Generate a value for a field. Returns 'NaN' if the MB is marked as disconnected.
    
    Args:
        field_name: Name of the field to generate value for
        mb_id: Measurement board ID (used to check if disconnected)
    
    Returns:
        Value (float or 'NaN' string)
    """
    # If this MB is disconnected, return NaN for all fields
    if mb_id and mb_id in disconnected_mbs:
        return "NaN"
    
    # Constant values based on field name (no randomization)
    # String 1 - DC Voltage and Current
    if field_name == "V1D":
        return 230.0  # String 1 DC Voltage (constant)
    elif field_name == "I1D":
        return 8.5  # String 1 DC Current (constant)
    # String 2 - DC Voltage and Current
    elif field_name == "V2D":
        return 235.0  # String 2 DC Voltage (constant, slightly different)
    elif field_name == "I2D":
        return 8.8  # String 2 DC Current (constant, slightly different)
    # String 3 - Battery DC
    elif field_name == "V3D":
        return 82.0  # Battery DC Voltage (constant)
    elif field_name == "I3D":
        return 15.0  # Battery DC Current (constant)
    # AC Voltage and Current
    elif "V" in field_name and "A" in field_name:
        return 220.0  # AC Voltage (constant)
    elif "I" in field_name and "A" in field_name:
        return 10.0  # AC Current (constant)
    # Temperature
    elif "T_m" in field_name:
        return 35.0  # Module Temperature (constant)
    elif "T_amb" in field_name:
        return 28.0  # Ambient Temperature (constant)
    # Battery State and RSSI
    elif "Batt" in field_name:
        return 95.0  # Battery % (constant)
    elif "Rssi" in field_name:
        return -65.0  # RSSI (constant)
    # Environmental
    elif "G" in field_name:  # Irradiance
        return 800.0  # Constant irradiance
    elif "Hum" in field_name:
        return 45.0  # Constant humidity
    # Inverter Data
    elif "PV1_V" in field_name:
        return 230.0  # PV1 voltage from inverter (matches String 1)
    elif "PV2_V" in field_name:
        return 235.0  # PV2 voltage from inverter (matches String 2)
    elif "PV1_I" in field_name:
        return 8.5  # PV1 current from inverter (matches String 1)
    elif "PV2_I" in field_name:
        return 8.8  # PV2 current from inverter (matches String 2)
    elif "Vbat" in field_name:
        return 52.0  # Battery voltage from inverter
    elif "Ibat" in field_name:
        return 15.0  # Battery current from inverter
    elif "Vout" in field_name:
        return 220.0  # Inverter output voltage
    elif "Iout" in field_name:
        return 20.0  # Inverter output current
    elif "Pout" in field_name:
        return 4400.0  # Inverter output power (220V * 20A)
    else:
        return 50.0  # Default constant value


def main():
    global disconnected_mbs, SERVER_URL
    
    print("Searching for active PV Dashboard server...")
    port = find_active_port()
    if port:
        print(f"✅ Found server on port {port}")
        SERVER_URL = f"http://localhost:{port}/api/simulate"
    else:
        print("⚠️ Could not find active server on ports 8000-8010.")
        print("Using default port 8000.")
        SERVER_URL = "http://localhost:8000/api/simulate"

    print("Loading schema from stm_config.json...")
    schema = load_schema()
    if not schema:
        print("❌ No MBs found in configuration. Please configure the system in the app first.")
        return

    print(f"Found {len(schema)} MBs in configuration.")
    print(f"NaN injection probability: {NAN_INJECTION_PROBABILITY * 100}%")
    
    # Initially mark some MBs as disconnected
    all_mb_ids = [mb["id"] for mb in schema]
    for mb_id in all_mb_ids:
        if random.random() < NAN_INJECTION_PROBABILITY:
            disconnected_mbs.add(mb_id)
    
    if disconnected_mbs:
        print(f"Initially disconnected MBs: {', '.join(disconnected_mbs)}")
    
    print(f"Sending simulated data to {SERVER_URL}...")
    print("Press Ctrl+C to stop.")
    
    iteration = 0
    try:
        while True:
            iteration += 1
            
            # Every 10 iterations, randomly reconnect/disconnect MBs
            if iteration % 10 == 0:
                for mb_id in all_mb_ids:
                    # Random chance to change connection status
                    if random.random() < 0.1:  # 10% chance to change status
                        if mb_id in disconnected_mbs:
                            disconnected_mbs.remove(mb_id)
                            print(f"🔄 MB {mb_id} reconnected")
                        else:
                            if random.random() < NAN_INJECTION_PROBABILITY:
                                disconnected_mbs.add(mb_id)
                                print(f"❌ MB {mb_id} disconnected")
            
            values = []
            # Timestamp first
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            # Generate values for each MB in order
            for mb in schema:
                mb_id = mb["id"]
                for field in mb["fields"]:
                    values.append(str(generate_value(field, mb_id)))
            
            # Construct CSV line
            csv_line = f"{timestamp},{','.join(values)}"
            
            # Send to server
            try:
                data = json.dumps({"line": csv_line}).encode('utf-8')
                req = urllib.request.Request(SERVER_URL, data=data, headers={'Content-Type': 'application/json'})
                with urllib.request.urlopen(req) as response:
                    if response.status == 200:
                        # Only print full line every 5 iterations to reduce console spam
                        if iteration % 5 == 0:
                            print(f"Sent: {csv_line}")
                        elif disconnected_mbs:
                            print(f"Sent data (Disconnected: {', '.join(disconnected_mbs)})")
                    else:
                        print(f"Error: {response.status}")
            except Exception as e:
                print(f"Connection failed: {e}")
                
            time.sleep(2) # Send every 2 seconds
            
    except KeyboardInterrupt:
        print("\nSimulation stopped.")

if __name__ == "__main__":
    main()
