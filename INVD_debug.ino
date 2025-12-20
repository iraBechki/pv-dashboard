//------------------------------------INVD Debug--------------------------------------------
// Simple test sketch to verify Modbus communication with inverter
// Upload this to test if STM32 can read from the inverter

#include <ModbusMaster.h>

// RS485 communication for inverter
#define RS485_SERIAL Serial1
ModbusMaster node;

// Optional: RS485 DE/RE control pins (uncomment if your RS485 module has these)
// #define RS485_DE_PIN PA8
// #define RS485_RE_PIN PA8  // Often tied together

void setup() {
  Serial.begin(9600);
  delay(2000);  // Wait for serial monitor to open
  
  Serial.println("=================================");
  Serial.println("INVD Modbus Debug Test");
  Serial.println("=================================");
  
  // Optional: Initialize DE/RE pins if needed
  // pinMode(RS485_DE_PIN, OUTPUT);
  // pinMode(RS485_RE_PIN, OUTPUT);
  // digitalWrite(RS485_DE_PIN, LOW);  // Receive mode
  // digitalWrite(RS485_RE_PIN, LOW);  // Receive mode
  
  RS485_SERIAL.begin(9600);
  node.begin(1, RS485_SERIAL);  // inverter slave ID = 1
  
  Serial.println("Modbus initialized.");
  Serial.println("Inverter Slave ID: 1");
  Serial.println("Baud Rate: 9600");
  Serial.println("=================================");
  Serial.println("");
  delay(1000);
}

float readScaledRegister(uint16_t reg, float scale, const char* name) {
  Serial.print("Reading ");
  Serial.print(name);
  Serial.print(" (Reg ");
  Serial.print(reg);
  Serial.print(")... ");
  
  uint8_t result = node.readInputRegisters(reg, 1);
  
  if (result == node.ku8MBSuccess) {
    uint16_t rawValue = node.getResponseBuffer(0);
    float scaledValue = rawValue * scale;
    
    Serial.print("✅ Raw: ");
    Serial.print(rawValue);
    Serial.print(" → Scaled: ");
    Serial.print(scaledValue, 2);
    Serial.println("");
    
    return scaledValue;
  } else {
    Serial.print("❌ ERROR Code: 0x");
    Serial.print(result, HEX);
    
    // Error code meanings
    switch(result) {
      case 0xE0: Serial.println(" (Invalid Response)"); break;
      case 0xE1: Serial.println(" (Invalid ID)"); break;
      case 0xE2: Serial.println(" (Invalid Function)"); break;
      case 0xE3: Serial.println(" (Response Timeout)"); break;
      case 0xE4: Serial.println(" (Invalid CRC)"); break;
      default: Serial.println(" (Unknown Error)"); break;
    }
    
    return -999.0;  // Error indicator
  }
}

void loop() {
  Serial.println("\n========== Reading Inverter Data ==========");
  Serial.println("Timestamp: " + String(millis() / 1000) + "s");
  Serial.println("");
  
  // Read all inverter parameters with delays between reads
  float PV1_V = readScaledRegister(110, 0.1, "PV1 Voltage");
  delay(100);
  
  float PV1_I = readScaledRegister(111, 0.1, "PV1 Current");
  delay(100);
  
  float PV2_V = readScaledRegister(112, 0.1, "PV2 Voltage");
  delay(100);
  
  float PV2_I = readScaledRegister(113, 0.1, "PV2 Current");
  delay(100);
  
  float Vbat = readScaledRegister(17, 0.01, "Battery Voltage");
  delay(100);
  
  float Ibat = readScaledRegister(84, 0.1, "Battery Current");
  delay(100);
  
  float Vout = readScaledRegister(22, 0.1, "Output Voltage");
  delay(100);
  
  float Iout = readScaledRegister(1034, 0.1, "Output Current");
  delay(100);
  
  float Pout = readScaledRegister(70, 0.1, "Output Power");
  delay(100);
  
  Serial.println("");
  Serial.println("========== Summary ==========");
  Serial.println("PV1: " + String(PV1_V, 1) + "V, " + String(PV1_I, 1) + "A");
  Serial.println("PV2: " + String(PV2_V, 1) + "V, " + String(PV2_I, 1) + "A");
  Serial.println("Battery: " + String(Vbat, 2) + "V, " + String(Ibat, 1) + "A");
  Serial.println("Output: " + String(Vout, 1) + "V, " + String(Iout, 1) + "A, " + String(Pout, 0) + "W");
  Serial.println("============================");
  
  Serial.println("\nWaiting 5 seconds before next read...\n");
  delay(5000);  // Wait 5 seconds between readings
}
