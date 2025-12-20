/*
 * AD7705 Irradiance Measurement Test
 * 
 * Wiring for WS node (different from your original code):
 * AD7705 VDD  -> STM32 3.3V
 * AD7705 GND  -> STM32 GND
 * AD7705 CS   -> STM32 PA1 (CHANGED from PA4 to avoid LoRa conflict)
 * AD7705 SCLK -> STM32 PA5 (SPI1 SCK)
 * AD7705 MISO -> STM32 PA6 (SPI1 MISO)
 * AD7705 MOSI -> STM32 PA7 (SPI1 MOSI)
 * 
 * Shunt Resistor (3.3Ω):
 * AIN1+ -> Shunt resistor positive side (PV panel +)
 * AIN1- -> Shunt resistor negative side (GND)
 */

#include <SPI.h>

// Pin definition - IMPORTANT: Using PA1 for WS node
#define AD7705_CS_PIN PA1  // Changed from PA4

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
#define AD7705_CLOCK_50HZ      0x01  // Slower = more filtering, less noise

// Constants
const float VREF = 3.3;              // Reference voltage (VDD)
const uint16_t ADC_MAX = 65535;      // 16-bit ADC
const float SHUNT_RESISTOR = 3.3;    // Shunt resistor in ohms
const float IRRADIANCE_CALIBRATION = 1000.0;  // W/m² per 1V

// Noise reduction parameters
const int NUM_SAMPLES = 10;          // Number of samples to average
const int WARM_UP_READS = 3;         // Initial readings to discard

void setup() {
  Serial.begin(9600);
  while (!Serial) delay(10);
  
  Serial.println("========================================");
  Serial.println("AD7705 Irradiance Measurement Test");
  Serial.println("CS Pin: PA1 (for WS node compatibility)");
  Serial.println("========================================");
  
  // Initialize SPI
  pinMode(AD7705_CS_PIN, OUTPUT);
  digitalWrite(AD7705_CS_PIN, HIGH);
  
  SPI.begin();
  SPI.setBitOrder(MSBFIRST);
  SPI.setDataMode(SPI_MODE3);
  SPI.setClockDivider(SPI_CLOCK_DIV16);
  
  delay(100);
  
  // Reset AD7705
  Serial.println("Resetting AD7705...");
  resetAD7705();
  delay(100);
  
  // Initialize AD7705
  Serial.println("Initializing AD7705...");
  initAD7705();
  
  Serial.println("AD7705 initialized successfully!");
  
  // Warm-up: discard first few readings for stability
  Serial.print("Warming up ADC (discarding first ");
  Serial.print(WARM_UP_READS);
  Serial.println(" readings)...");
  for (int i = 0; i < WARM_UP_READS; i++) {
    readVoltage();
    delay(100);
  }
  Serial.println("Warm-up complete!");
  
  Serial.println("Reading irradiance every 2 seconds...");
  Serial.println("========================================\n");
}

void loop() {
  // Take multiple samples and filter for stability
  float voltage = readVoltageFiltered();
  
  // Calculate current through shunt resistor
  float current = voltage / SHUNT_RESISTOR;  // I = V / R
  
  // Calculate irradiance (assuming 1V = 1000 W/m²)
  float irradiance = voltage * IRRADIANCE_CALIBRATION;
  
  // Display results
  Serial.println("--- Measurement ---");
  Serial.print("Voltage: ");
  Serial.print(voltage, 4);
  Serial.println(" V");
  
  Serial.print("Current: ");
  Serial.print(current, 4);
  Serial.println(" A");
  
  Serial.print("Irradiance: ");
  Serial.print(irradiance, 1);
  Serial.println(" W/m²");
  Serial.println();
  
  delay(2000);
}

// ========== AD7705 Helper Functions ==========

void resetAD7705() {
  digitalWrite(AD7705_CS_PIN, LOW);
  delay(1);
  
  for (int i = 0; i < 4; i++) {
    SPI.transfer(0xFF);
  }
  
  digitalWrite(AD7705_CS_PIN, HIGH);
  delay(10);
}

void initAD7705() {
  // Configure Clock Register
  writeRegister(AD7705_REG_CLOCK, AD7705_CLOCK_CLK_ON | AD7705_CLOCK_50HZ);
  delay(10);
  
  // Configure Setup Register - Unipolar mode for 0-3.3V range
  writeRegister(AD7705_REG_SETUP, 
                AD7705_SETUP_SELF_CAL | 
                AD7705_SETUP_GAIN_1 | 
                AD7705_SETUP_UNIPOLAR | 
                AD7705_SETUP_BUFFER);
  
  Serial.print("Calibrating AD7705...");
  delay(500);
  
  unsigned long timeout = millis() + 2000;
  while (millis() < timeout) {
    if (isDataReady()) {
      Serial.println(" Done!");
      return;
    }
    delay(10);
  }
  Serial.println(" Timeout (continuing anyway)");
}

void writeRegister(uint8_t reg, uint8_t value) {
  digitalWrite(AD7705_CS_PIN, LOW);
  delayMicroseconds(1);
  
  SPI.transfer(reg | AD7705_COMM_WRITE | AD7705_COMM_CH1);
  SPI.transfer(value);
  
  delayMicroseconds(1);
  digitalWrite(AD7705_CS_PIN, HIGH);
}

uint8_t readRegister8(uint8_t reg) {
  digitalWrite(AD7705_CS_PIN, LOW);
  delayMicroseconds(1);
  
  SPI.transfer(reg | AD7705_COMM_READ | AD7705_COMM_CH1);
  uint8_t value = SPI.transfer(0x00);
  
  delayMicroseconds(1);
  digitalWrite(AD7705_CS_PIN, HIGH);
  
  return value;
}

uint16_t readDataRegister() {
  digitalWrite(AD7705_CS_PIN, LOW);
  delayMicroseconds(1);
  
  SPI.transfer(AD7705_REG_DATA | AD7705_COMM_READ | AD7705_COMM_CH1);
  uint16_t highByte = SPI.transfer(0x00);
  uint16_t lowByte = SPI.transfer(0x00);
  
  delayMicroseconds(1);
  digitalWrite(AD7705_CS_PIN, HIGH);
  
  return (highByte << 8) | lowByte;
}

bool isDataReady() {
  uint8_t commReg = readRegister8(AD7705_REG_COMM);
  return (commReg & 0x80) == 0;
}

float readVoltage() {
  unsigned long timeout = millis() + 1000;
  while (!isDataReady() && millis() < timeout) {
    delay(1);
  }
  
  if (millis() >= timeout) {
    Serial.println("Warning: Data ready timeout!");
  }
  
  uint16_t adcValue = readDataRegister();
  
  // DEBUG: Show raw ADC value
  Serial.print("[DEBUG] Raw ADC: ");
  Serial.print(adcValue);
  Serial.print(" (0x");
  Serial.print(adcValue, HEX);
  Serial.print(")");
  
  // Convert to voltage (unipolar mode: 0 to VREF)
  float voltage = (adcValue * VREF) / ADC_MAX;
  
  Serial.print(" -> ");
  Serial.print(voltage, 4);
  Serial.println(" V");
  
  return voltage;
}

// Read voltage with filtering for noise reduction
float readVoltageFiltered() {
  float samples[NUM_SAMPLES];
  
  // Collect multiple samples
  for (int i = 0; i < NUM_SAMPLES; i++) {
    samples[i] = readVoltage();
    delay(20);  // Small delay between readings
  }
  
  // Sort samples for median filtering
  for (int i = 0; i < NUM_SAMPLES - 1; i++) {
    for (int j = i + 1; j < NUM_SAMPLES; j++) {
      if (samples[i] > samples[j]) {
        float temp = samples[i];
        samples[i] = samples[j];
        samples[j] = temp;
      }
    }
  }
  
  // Remove outliers: discard lowest and highest 20% of samples
  int discardCount = NUM_SAMPLES / 5;
  if (discardCount < 1) discardCount = 1;
  
  // Average the middle samples
  float sum = 0;
  int count = 0;
  for (int i = discardCount; i < NUM_SAMPLES - discardCount; i++) {
    sum += samples[i];
    count++;
  }
  
  return sum / count;
}

