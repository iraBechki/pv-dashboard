import serial
import time
import sys

# Configure serial port - ADJUST COM PORT IF NEEDED
SERIAL_PORT = "COM7" # User's port from previous logs
BAUDRATE = 9600

def test_commands():
    try:
        print(f"Opening {SERIAL_PORT} at {BAUDRATE}...")
        ser = serial.Serial(SERIAL_PORT, BAUDRATE, timeout=2)
        time.sleep(2) # Wait for connection
        
        # 1. Send START
        print("\n--- Testing START ---")
        cmd = "CMD:START\n"
        ser.write(cmd.encode())
        print(f"Sent: {cmd.strip()}")
        time.sleep(0.5)
        
        # Read response
        start_time = time.time()
        while time.time() - start_time < 3:
            if ser.in_waiting:
                line = ser.readline().decode(errors='ignore').strip()
                print(f"Received: {line}")
                if "STATUS:RUNNING" in line:
                    print("✅ START Confirmed!")
            time.sleep(0.1)
            
        # 2. Send STOP
        print("\n--- Testing STOP ---")
        cmd = "CMD:STOP\n"
        ser.write(cmd.encode())
        print(f"Sent: {cmd.strip()}")
        time.sleep(0.5)
        
        # Read response
        start_time = time.time()
        while time.time() - start_time < 3:
            if ser.in_waiting:
                line = ser.readline().decode(errors='ignore').strip()
                print(f"Received: {line}")
                if "STATUS:STOPPED" in line:
                    print("✅ STOP Confirmed!")
            time.sleep(0.1)
            
        ser.close()
        print("\nDone.")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_commands()
