import serial
import time
import json
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
STM_CONFIG_FILE = os.path.join(script_dir, "stm_config.json")

def test_send():
    if not os.path.exists(STM_CONFIG_FILE):
        print(f"File {STM_CONFIG_FILE} not found.")
        return

    print(f"Reading {STM_CONFIG_FILE}...")
    with open(STM_CONFIG_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    
    lines = content.splitlines()
    print(f"Found {len(lines)} lines to send.")

    print("Opening Serial Port COM7 at 9600...")
    try:
        ser = serial.Serial('COM7', 9600, timeout=1)
        time.sleep(2) # Wait for reset
        
        print("Sending lines...")
        for line in lines:
            msg = line + "\n"
            ser.write(msg.encode('utf-8'))
            print(f"Sent: {line}")
            time.sleep(0.5)
            
            # Wait for echo
            start_time = time.time()
            received = False
            while time.time() - start_time < 1.0: # 1 second timeout
                if ser.in_waiting:
                    resp = ser.readline().decode(errors='ignore').strip()
                    if resp:
                        print(f"Received: {resp}")
                        received = True
                        # If we received exactly what we sent (or close to it), it's a good sign
                        if resp in line or line in resp:
                             print("✅ STM32 Acknowledged")
                time.sleep(0.05)
            
            if not received:
                print("❌ No response from STM32 (Timeout)")
            
            time.sleep(0.2)
                
        ser.close()
        print("Done.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_send()
