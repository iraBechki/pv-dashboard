//------------------------------------WS--------------------------------------------
#include <SPI.h>
#include <LoRa.h>
#include <SdFat.h>
#include <Wire.h>
#include <SimpleDHT.h>

// DHT Sensor settings
#define DHTPIN PB1     // Digital pin connected to the DHT sensor

SimpleDHT22 dht22(DHTPIN);

// AD7705 ADC for irradiance measurement
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

// Constants for irradiance calculation
const float VREF = 3.3;              // Reference voltage
const uint16_t ADC_MAX = 65535;      // 16-bit ADC
const float VOLTAGE_CALIBRATION = 1.551;  // Calibration factor: 0.72V actual / 0.46407V measured
const float SHUNT_RESISTOR = 3.3;    // Shunt resistor value in ohms
const float IRRADIANCE_CALIBRATION = 1000.0;  // W/m² per 1V

// LoRa pins
#define LORA_CS     PA4
#define LORA_RST    PA3
#define LORA_DIO0   PA2

// Slave ID
const String myID = "WS";  // Unique ID for this slave

// SD card pins and SPI2 configuration
#define SD_CS PB12
SPIClass SPI_2(PB15, PB14, PB13);  // SPI2: MOSI, MISO, SCK
SdFat sd;
SdSpiConfig sdConfig(SD_CS, DEDICATED_SPI, SD_SCK_MHZ(10), &SPI_2);  // SPI2 config

String lastTimestamp = "0000-00-00 00:00:00";  // to store time received from master

void setup() {
  Serial.begin(9600);
  
  // SimpleDHT22 doesn't require explicit begin()
  
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
  Serial.println("AD7705 initialized for irradiance measurement.");
  
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
  Serial.println("Checking WS.CSV...");
  if (!sd.exists("WS.CSV")) {
    Serial.println("Creating WS.CSV...");
    File headerFile = sd.open("WS.CSV", O_WRITE | O_CREAT | O_APPEND);
    if (headerFile) {
      headerFile.println("Timestamp,Irr,T_amb,Hum,BattS,RSSI");
      headerFile.close();
      Serial.println("WS.CSV created.");
    } else {
      Serial.println("Error creating WS.CSV");
    }
  } else {
    Serial.println("WS.CSV exists.");
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
      
      // 1. Read irradiance from AD7705
      float voltage = readVoltageAD7705();
      float current = voltage / SHUNT_RESISTOR;  // I = V / R
      float irradiance = (voltage / 1.0) * IRRADIANCE_CALIBRATION;  // Scale: 1V = 1000 W/m²
      
      Serial.print("Irradiance: "); Serial.print(irradiance, 1); Serial.println(" W/m2");
      
      // 2. Read temperature and humidity from DHT22 using SimpleDHT
      float temperature = 0;
      float humidity = 0;
      int err = SimpleDHTErrSuccess;
      
      if ((err = dht22.read2(&temperature, &humidity, NULL)) != SimpleDHTErrSuccess) {
        Serial.print("Read DHT22 failed, err=");
        Serial.println(SimpleDHTErrCode(err));
        return;
      }
      
      float t = temperature;
      float h = humidity;

      Serial.print("Temp: "); Serial.print(t);
      Serial.print(" Hum: "); Serial.println(h);
      
      // Fixed BattS parameter
      int battS = 100;

      // Construct CSV line using stored timestamp
      // CSV Format: Timestamp,Irr,T_amb,Hum,BattS,RSSI
      String csvLine = lastTimestamp;
      csvLine += "," + String(irradiance, 1);
      csvLine += "," + String(t, 1);
      csvLine += "," + String(h, 1);
      csvLine += "," + String(battS);
      csvLine += "," + String(rssiValue);
      
      // Save CSV line to SD card
      bool written = false;
      for (int attempt = 1; attempt <= 3; attempt++) {
        File dataFile = sd.open("WS.CSV", O_WRITE | O_CREAT | O_APPEND);
        if (dataFile) {
          dataFile.println(csvLine);
          dataFile.close();
          written = true;
          Serial.println("Logged to SD: " + csvLine);
          break;
        } else {
          Serial.print("Attempt ");
          Serial.print(attempt);
          Serial.println(": Failed to open WS.CSV for writing.");
          delay(5);
        }
      }
      
      if (!written) {
        Serial.println("Error: All 3 attempts to write to SD card failed.");
      }
      
      // Send data to master over LoRa
      // Packet Format: Irr,T_amb,Hum,BattS,RSSI
      Serial.println("Sending LoRa packet...");
      LoRa.beginPacket();
      LoRa.print(irradiance, 1);  // Irradiance
      LoRa.print(",");
      LoRa.print(t, 1);           // Temperature
      LoRa.print(",");
      LoRa.print(h, 1);           // Humidity
      LoRa.print(",");
      LoRa.print(battS);          // BattS (fixed = 100)
      LoRa.print(",");
      LoRa.print(rssiValue);      // RSSI
      LoRa.endPacket();
      
      Serial.print("Sent: ");
      Serial.print(irradiance); Serial.print(", ");
      Serial.print(t); Serial.print(", ");
      Serial.print(h); Serial.print(", ");
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
