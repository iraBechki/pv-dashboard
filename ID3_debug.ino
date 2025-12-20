//------------------------------------ID3 DEBUG--------------------------------------------
// Debug version to diagnose AD7705 voltage readings
// This will help identify why 2.5V sensor output is read incorrectly

#include <SPI.h>

// AD7705 ADC for current measurement
#define AD7705_CS_PIN PA1
#define AD7705_DRDY_PIN PB0

// AD7705 Register addresses
#define AD7705_REG_COMM        0x00
#define AD7705_REG_SETUP       0x10
#define AD7705_REG_CLOCK       0x20
#define AD7705_REG_DATA        0x30
#define AD7705_REG_TEST        0x40

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

// Constants
const float VREF = 3.3;
const uint16_t ADC_MAX = 65535;
const float CURRENT_ZERO_OFFSET = 2.5;
const float CURRENT_SENSITIVITY = 0.04;

void setup() {
  Serial.begin(9600);
  delay(2000);
  
  Serial.println("\n\n=== ID3 AD7705 DEBUG MODE ===");
  Serial.println("This will help diagnose voltage reading issues\n");
  
  pinMode(AD7705_CS_PIN, OUTPUT);
  digitalWrite(AD7705_CS_PIN, HIGH);
  pinMode(AD7705_DRDY_PIN, INPUT);
  
  SPI.begin();
  SPI.setBitOrder(MSBFIRST);
  SPI.setDataMode(SPI_MODE3);
  SPI.setClockDivider(SPI_CLOCK_DIV16);
  
  delay(100);
  Serial.println("Resetting AD7705...");
  resetAD7705();
  delay(100);
  
  Serial.println("Initializing AD7705...");
  initAD7705();
  
  Serial.println("\n=== AD7705 Configuration Check ===");
  uint8_t setupReg = readRegister8AD7705(AD7705_REG_SETUP);
  uint8_t clockReg = readRegister8AD7705(AD7705_REG_CLOCK);
  
  Serial.print("Setup Register: 0x");
  Serial.println(setupReg, HEX);
  Serial.print("Clock Register: 0x");
  Serial.println(clockReg, HEX);
  
  Serial.println("\n=== Starting Continuous Readings ===");
  Serial.println("Expected: Sensor outputs 2.5V for 0A");
  Serial.println("AD7705 should read ~2.5V\n");
}

void loop() {
  Serial.println("--- New Reading ---");
  
  // Take multiple readings
  for (int i = 0; i < 5; i++) {
    Serial.print("Reading #"); Serial.print(i + 1); Serial.print(": ");
    
    // Trigger conversion
    startConversionAD7705();
    
    // Wait for data ready
    unsigned long timeout = millis() + 1000;
    while (!isDataReadyAD7705() && millis() < timeout) {
      delay(1);
    }
    
    if (millis() >= timeout) {
      Serial.println("TIMEOUT!");
      continue;
    }
    
    // Read raw ADC value
    uint16_t adcValue = readDataRegisterAD7705();
    
    // Convert to voltage
    float voltage = (adcValue * VREF) / ADC_MAX;
    
    // Convert to current
    float current = (voltage - CURRENT_ZERO_OFFSET) / CURRENT_SENSITIVITY;
    
    // Display results
    Serial.print("ADC=");
    Serial.print(adcValue);
    Serial.print(" (0x");
    Serial.print(adcValue, HEX);
    Serial.print(") -> ");
    Serial.print(voltage, 4);
    Serial.print("V -> ");
    Serial.print(current, 2);
    Serial.println("A");
    
    delay(100);
  }
  
  // Calculate expected values
  Serial.println("\n--- Expected Values ---");
  Serial.println("If sensor outputs 2.5V:");
  uint16_t expectedADC = (2.5 / VREF) * ADC_MAX;
  Serial.print("Expected ADC value: ");
  Serial.print(expectedADC);
  Serial.print(" (0x");
  Serial.print(expectedADC, HEX);
  Serial.println(")");
  Serial.println("Expected Current: 0.00A");
  
  Serial.println("\n--- Voltage Reference Info ---");
  Serial.print("VREF setting: ");
  Serial.print(VREF);
  Serial.println("V");
  Serial.println("If this doesn't match your AD7705 module's actual VREF,");
  Serial.println("then all voltage readings will be wrong!");
  
  Serial.println("\n=== Waiting 5 seconds ===\n");
  delay(5000);
}

// ============ AD7705 Functions ============

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

void startConversionAD7705() {
  restoreSPIForAD7705();
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
  return digitalRead(AD7705_DRDY_PIN) == LOW;
}
