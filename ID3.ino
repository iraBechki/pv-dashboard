//------------------------------------ID3--------------------------------------------
// Current Sensor Measurement using AD7705
// Current Sensor Specs:
//   0A   -> 2.5V
//   +50A -> 4.5V
//   -50A -> 0.5V
//   Linear relationship: 40mV/A or 0.04V/A

#include <SPI.h>
#include <LoRa.h>
#include <SdFat.h>
#include <Wire.h>

// AD7705 ADC for current measurement
#define AD7705_CS_PIN PA1    // Changed from PA4 to avoid conflict with LoRa
#define AD7705_DRDY_PIN PB0  // Data Ready pin - goes LOW when conversion complete

// AD7705 Register addresses
#define AD7705_REG_COMM        0x00
#define AD7705_REG_SETUP       0x10
#define AD7705_REG_CLOCK       0x20
#define AD7705_REG_DATA        0x30

// Communication Register bits
#define AD7705_COMM_WRITE      0x00
#define AD7705_COMM_READ       0x08
#define AD7705_COMM_CH1        0x00

// Setup Register bits
#define AD7705_SETUP_SELF_CAL  0x40
#define AD7705_SETUP_GAIN_1    0x00
#define AD7705_SETUP_UNIPOLAR  0x04
#define AD7705_SETUP_BUFFER    0x02

// Clock Register bits
#define AD7705_CLOCK_CLK_ON    0x04
#define AD7705_CLOCK_50HZ      0x01

// Constants for current sensor measurement
const float VREF = 5.0;                    // Reference voltage (measured: module uses 5V, not 3.3V!)
const uint16_t ADC_MAX = 65535;            // 16-bit ADC
const float VOLTAGE_CALIBRATION = 1.0;     // Adjust if needed after testing

// Voltage Divider Configuration
// Calibrated from measurements: At 0A (2.5V sensor), AD7705 reads 1.326V
// VOLTAGE_DIVIDER_RATIO = 2.5V / 1.326V = 1.886 ≈ 1.89
// This matches a voltage divider of approximately R1=12kΩ, R2=13.5kΩ (or similar ratio)
const float VOLTAGE_DIVIDER_RATIO = 1.89;  // Calibrated value - DO NOT CHANGE unless re-calibrating

const float CURRENT_ZERO_OFFSET = 2.5;     // Voltage at 0A (at the sensor, before divider)
const float CURRENT_SENSITIVITY = 0.04;    // 40mV/A or 0.04V/A
const float MAX_CURRENT = 50.0;            // Maximum measurable current (±50A)

// Fine-tuning calibration (based on actual measurements)
// Adjust these to match your current sensor's actual behavior
const float CURRENT_OFFSET_CORRECTION = -0.35;  // Subtract 0.35A from all readings
const float CURRENT_SCALE_CORRECTION = 0.97;     // Scale factor to match actual current

// Current sensor voltage range (at sensor output, before divider)
const float VOLTAGE_MIN = 0.5;  // -50A
const float VOLTAGE_MAX = 4.5;  // +50A

// LoRa pins
#define LORA_CS     PA4
#define LORA_RST    PA3
#define LORA_DIO0   PA2

// Slave ID
const String myID = "ID3";  // Unique ID for this slave

// SD card pins and SPI2 configuration
#define SD_CS PB12
SPIClass SPI_2(PB15, PB14, PB13);  // SPI2: MOSI, MISO, SCK
SdFat sd;
SdSpiConfig sdConfig(SD_CS, DEDICATED_SPI, SD_SCK_MHZ(10), &SPI_2);  // SPI2 config

String lastTimestamp = "0000-00-00 00:00:00";  // to store time received from master

// Averaging for noise reduction
#define NUM_SAMPLES 10

void setup() {
  Serial.begin(9600);
  
  // Initialize AD7705 on SPI1 (shared with LoRa)
  pinMode(AD7705_CS_PIN, OUTPUT);
  digitalWrite(AD7705_CS_PIN, HIGH);
  
  // Initialize DRDY pin as input
  pinMode(AD7705_DRDY_PIN, INPUT);
  
  SPI.begin();
  SPI.setBitOrder(MSBFIRST);
  SPI.setDataMode(SPI_MODE3);
  SPI.setClockDivider(SPI_CLOCK_DIV16);
  
  delay(100);
  resetAD7705();
  delay(100);
  initAD7705();
  Serial.println("AD7705 initialized for current measurement.");
  
  LoRa.setPins(LORA_CS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(433E6)) {
    Serial.println("LoRa init failed!");
    while (1);
  }
  
  LoRa.setFrequency(433E6);           // SX1278 sweet spot
  LoRa.setSpreadingFactor(8);         // SF8 → balanced speed and range
  LoRa.setSignalBandwidth(125E3);     // 125kHz → good reliability
  LoRa.setCodingRate4(5);             // CR4/5 → less overhead, faster
  LoRa.setPreambleLength(8);          // Standard preamble
  LoRa.enableCrc();                   // Avoid corrupted packets
  LoRa.setTxPower(17, PA_OUTPUT_PA_BOOST_PIN);  // 17dBm for moderate range
  
  // Init SD card on SPI2
  if (!sd.begin(sdConfig)) {
    Serial.println("SD Card init failed!");
    while (1);
  }
  Serial.println("SD Card initialized on SPI2.");
  
  // Write CSV header if file doesn't exist
  Serial.println("Checking ID3.CSV...");
  if (!sd.exists("ID3.CSV")) {
    Serial.println("Creating ID3.CSV...");
    File headerFile = sd.open("ID3.CSV", O_WRITE | O_CREAT | O_APPEND);
    if (headerFile) {
      headerFile.println("Timestamp,Current,BattS,RSSI");
      headerFile.close();
      Serial.println("ID3.CSV created.");
    } else {
      Serial.println("Error creating ID3.CSV");
    }
  } else {
    Serial.println("ID3.CSV exists.");
  }
  
  Serial.println("Setup complete. Entering loop.");
}

void loop() {
  static bool firstRun = true;
  if (firstRun) {
    Serial.println("Loop running... Waiting for LoRa packets.");
    firstRun = false;
  }
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    Serial.print("Received packet size: ");
    Serial.println(packetSize);

    String incoming = "";
    while (LoRa.available()) {
      incoming += (char)LoRa.read();
    }
    incoming.trim();
    Serial.print("Content: [");
    Serial.print(incoming);
    Serial.println("]");
    
    // Capture RSSI immediately after receiving packet
    int rssiValue = LoRa.packetRssi();
    Serial.print("RSSI: ");
    Serial.println(rssiValue);
    
    if (incoming.startsWith("TIME:")) {
      lastTimestamp = incoming.substring(5);  // Store time (without "TIME:")
      Serial.println("Time updated: " + lastTimestamp);
    } else if (incoming == myID) {
      Serial.println("ID Match! Reading sensors...");
      
      // Wait after LoRa reception to let SPI bus settle
      delay(50);
      
      // Read current from AD7705 with averaging
      float totalCurrent = 0;
      int validSamples = 0;
      
      for (int i = 0; i < NUM_SAMPLES; i++) {
        float voltage = readVoltageAD7705();
        
        // Check if voltage is within valid range
        if (voltage >= 0 && voltage <= VREF) {
          float current = voltageToCurrent(voltage);
          totalCurrent += current;
          validSamples++;
        }
        delay(10);  // Small delay between samples
      }
      
      float current = (validSamples > 0) ? (totalCurrent / validSamples) : 0;
      
      Serial.print("Current: "); Serial.print(current, 2); Serial.println(" A");
      
      // Fixed BattS parameter
      int battS = 100;

      // Construct CSV line using stored timestamp
      // CSV Format: Timestamp,Current,BattS,RSSI
      String csvLine = lastTimestamp;
      csvLine += "," + String(current, 2);
      csvLine += "," + String(battS);
      csvLine += "," + String(rssiValue);
      
      // Save CSV line to SD card
      bool written = false;
      for (int attempt = 1; attempt <= 3; attempt++) {
        File dataFile = sd.open("ID3.CSV", O_WRITE | O_CREAT | O_APPEND);
        if (dataFile) {
          dataFile.println(csvLine);
          dataFile.close();
          written = true;
          Serial.println("Logged to SD: " + csvLine);
          break;
        } else {
          Serial.print("Attempt ");
          Serial.print(attempt);
          Serial.println(": Failed to open ID3.CSV for writing.");
          delay(5);
        }
      }
      
      if (!written) {
        Serial.println("Error: All 3 attempts to write to SD card failed.");
      }
      
      // Send data to master over LoRa
      // Packet Format: Current,BattS,RSSI
      Serial.println("Sending LoRa packet...");
      LoRa.beginPacket();
      LoRa.print(current, 2);     // Current
      LoRa.print(",");
      LoRa.print(battS);          // BattS (fixed = 100)
      LoRa.print(",");
      LoRa.print(rssiValue);      // RSSI
      LoRa.endPacket();
      
      Serial.print("Sent: ");
      Serial.print(current, 2); Serial.print(", ");
      Serial.print(battS); Serial.print(", ");
      Serial.println(rssiValue);
    } else {
      Serial.println("Ignored: ID mismatch or unknown command.");
    }
  }
}

// ============ AD7705 Helper Functions ============

// Restore SPI settings for AD7705 (LoRa may have changed them)
void restoreSPIForAD7705() {
  SPI.setBitOrder(MSBFIRST);
  SPI.setDataMode(SPI_MODE3);
  SPI.setClockDivider(SPI_CLOCK_DIV16);
}

void resetAD7705() {
  restoreSPIForAD7705();
  digitalWrite(AD7705_CS_PIN, LOW);
  delay(1);
  for (int i = 0; i < 4; i++) {
    SPI.transfer(0xFF);
  }
  digitalWrite(AD7705_CS_PIN, HIGH);
  delay(10);
}

void initAD7705() {
  restoreSPIForAD7705();
  writeRegisterAD7705(AD7705_REG_CLOCK, AD7705_CLOCK_CLK_ON | AD7705_CLOCK_50HZ);
  delay(10);
  
  writeRegisterAD7705(AD7705_REG_SETUP, 
                AD7705_SETUP_SELF_CAL | 
                AD7705_SETUP_GAIN_1 | 
                AD7705_SETUP_UNIPOLAR | 
                AD7705_SETUP_BUFFER);
  
  Serial.print("Calibrating AD7705...");
  delay(500);
  
  unsigned long timeout = millis() + 2000;
  while (millis() < timeout) {
    if (isDataReadyAD7705()) {
      Serial.println(" Done!");
      return;
    }
    delay(10);
  }
  Serial.println(" Timeout (continuing anyway)");
}

// Trigger a new conversion
void startConversionAD7705() {
  restoreSPIForAD7705();
  // Writing to SETUP register starts a new conversion
  writeRegisterAD7705(AD7705_REG_SETUP, 
                AD7705_SETUP_GAIN_1 | 
                AD7705_SETUP_UNIPOLAR | 
                AD7705_SETUP_BUFFER);
}

void writeRegisterAD7705(uint8_t reg, uint8_t value) {
  restoreSPIForAD7705();
  digitalWrite(AD7705_CS_PIN, LOW);
  delayMicroseconds(1);
  SPI.transfer(reg | AD7705_COMM_WRITE | AD7705_COMM_CH1);
  SPI.transfer(value);
  delayMicroseconds(1);
  digitalWrite(AD7705_CS_PIN, HIGH);
}

uint8_t readRegister8AD7705(uint8_t reg) {
  restoreSPIForAD7705();
  digitalWrite(AD7705_CS_PIN, LOW);
  delayMicroseconds(1);
  SPI.transfer(reg | AD7705_COMM_READ | AD7705_COMM_CH1);
  uint8_t value = SPI.transfer(0x00);
  delayMicroseconds(1);
  digitalWrite(AD7705_CS_PIN, HIGH);
  return value;
}

uint16_t readDataRegisterAD7705() {
  restoreSPIForAD7705();
  digitalWrite(AD7705_CS_PIN, LOW);
  delayMicroseconds(1);
  SPI.transfer(AD7705_REG_DATA | AD7705_COMM_READ | AD7705_COMM_CH1);
  uint16_t highByte = SPI.transfer(0x00);
  uint16_t lowByte = SPI.transfer(0x00);
  delayMicroseconds(1);
  digitalWrite(AD7705_CS_PIN, HIGH);
  return (highByte << 8) | lowByte;
}

bool isDataReadyAD7705() {
  // DRDY pin goes LOW when data is ready
  return digitalRead(AD7705_DRDY_PIN) == LOW;
}

float readVoltageAD7705() {
  // Trigger a fresh conversion to avoid stale/corrupted data
  startConversionAD7705();
  
  // Wait for conversion to complete (DRDY goes LOW)
  unsigned long timeout = millis() + 1000;
  bool dataReady = false;
  
  while (!isDataReadyAD7705() && millis() < timeout) {
    delay(1);
  }
  
  if (millis() >= timeout) {
    Serial.println("Warning: Data ready timeout!");
    Serial.println("[DEBUG] AD7705 not responding - check wiring!");
  } else {
    dataReady = true;
  }
  
  // Read the fresh data
  uint16_t adcValue = readDataRegisterAD7705();
  
  // DEBUG: Show raw ADC value
  Serial.print("[DEBUG] Raw ADC: ");
  Serial.print(adcValue);
  Serial.print(" (0x");
  Serial.print(adcValue, HEX);
  Serial.print(") ");
  
  // Convert to voltage (uncalibrated)
  float voltageRaw = (adcValue * VREF) / ADC_MAX;
  
  // Apply calibration factor
  float voltage = voltageRaw * VOLTAGE_CALIBRATION;
  
  Serial.print("-> ");
  Serial.print(voltageRaw, 4);
  Serial.print(" V (raw) -> ");
  Serial.print(voltage, 4);
  Serial.println(" V (calibrated)");
  
  return voltage;
}

// ============ Current Sensor Conversion ============

float voltageToCurrent(float measuredVoltage) {
  // measuredVoltage is the voltage read by AD7705 (AFTER voltage divider)
  // We need to multiply back to get the actual sensor voltage (BEFORE divider)
  
  float sensorVoltage = measuredVoltage * VOLTAGE_DIVIDER_RATIO;
  
  // Current sensor characteristics (at sensor output):
  // 0.5V = -50A
  // 2.5V = 0A
  // 4.5V = +50A
  // Linear relationship: Current (A) = (Voltage - 2.5V) / 0.04V/A
  
  float current = (sensorVoltage - CURRENT_ZERO_OFFSET) / CURRENT_SENSITIVITY;
  
  // Apply fine-tuning calibration
  current = (current + CURRENT_OFFSET_CORRECTION) * CURRENT_SCALE_CORRECTION;
  
  // Clamp to valid range
  if (current > MAX_CURRENT) {
    current = MAX_CURRENT;
  } else if (current < -MAX_CURRENT) {
    current = -MAX_CURRENT;
  }
  
  return current;
}
