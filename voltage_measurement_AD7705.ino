/*
 * STM32 Blue Pill + AD7705 Voltage Measurement
 * 
 * Wiring:
 * AD7705 VDD  -> STM32 3.3V
 * AD7705 GND  -> STM32 GND
 * AD7705 SCLK -> STM32 PA5 (SPI1 SCK)
 * AD7705 MOSI -> STM32 PA7 (SPI1 MOSI)
 * AD7705 MISO -> STM32 PA6 (SPI1 MISO)
 * AD7705 CS   -> STM32 PA4
 * 
 * Voltage Divider (10K + 10K):
 * Vin -> 10K -> AIN1+ -> 10K -> GND
 * AIN1- -> GND
 */

#include <SPI.h>

// Pin definitions
#define AD7705_CS_PIN PA4

// AD7705 Register addresses
#define AD7705_REG_COMM        0x00
#define AD7705_REG_SETUP       0x10
#define AD7705_REG_CLOCK       0x20
#define AD7705_REG_DATA        0x30
#define AD7705_REG_TEST        0x40
#define AD7705_REG_OFFSET      0x60
#define AD7705_REG_GAIN        0x70

// Communication Register bits
#define AD7705_COMM_WRITE      0x00
#define AD7705_COMM_READ       0x08
#define AD7705_COMM_CH1        0x00
#define AD7705_COMM_CH2        0x01

// Setup Register bits
#define AD7705_SETUP_NORMAL    0x40  // Normal mode
#define AD7705_SETUP_SELF_CAL  0x40  // Self calibration
#define AD7705_SETUP_GAIN_1    0x00  // Gain = 1
#define AD7705_SETUP_GAIN_2    0x08  // Gain = 2
#define AD7705_SETUP_UNIPOLAR  0x04  // Unipolar mode
#define AD7705_SETUP_BIPOLAR   0x00  // Bipolar mode
#define AD7705_SETUP_BUFFER    0x02  // Buffer on

// Clock Register bits
#define AD7705_CLOCK_CLK_DIV_1 0x00
#define AD7705_CLOCK_CLK_ON    0x04
#define AD7705_CLOCK_50HZ      0x01  // 50 Hz update rate
#define AD7705_CLOCK_60HZ      0x02  // 60 Hz update rate
#define AD7705_CLOCK_250HZ     0x03  // 250 Hz update rate

// Constants
const float VREF = 3.3;              // Reference voltage (VDD)
const float VOLTAGE_DIVIDER = 2.0;   // Voltage divider ratio (1:1 with 10K+10K)
const uint16_t ADC_MAX = 65535;      // 16-bit ADC (0xFFFF)

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(10);
  
  Serial.println("STM32 + AD7705 Voltage Measurement");
  Serial.println("===================================");
  
  // Initialize SPI
  pinMode(AD7705_CS_PIN, OUTPUT);
  digitalWrite(AD7705_CS_PIN, HIGH);
  
  SPI.begin();
  SPI.setBitOrder(MSBFIRST);
  SPI.setDataMode(SPI_MODE3);  // CPOL=1, CPHA=1
  SPI.setClockDivider(SPI_CLOCK_DIV16); // ~4.5 MHz on 72MHz STM32
  
  delay(100);
  
  // Reset AD7705
  resetAD7705();
  delay(100);
  
  // Initialize AD7705
  initAD7705();
  
  Serial.println("AD7705 initialized successfully!");
  Serial.println("Reading voltage every second...\n");
}

void loop() {
  // Read voltage from Channel 1
  float voltage = readVoltage(AD7705_COMM_CH1);
  
  // Apply voltage divider correction
  float actualVoltage = voltage * VOLTAGE_DIVIDER;
  
  // Display results
  Serial.print("ADC Voltage: ");
  Serial.print(voltage, 4);
  Serial.print(" V  |  Actual Voltage: ");
  Serial.print(actualVoltage, 4);
  Serial.println(" V");
  
  delay(1000);  // Read every second
}

// Reset AD7705
void resetAD7705() {
  digitalWrite(AD7705_CS_PIN, LOW);
  delay(1);
  
  // Send 32 consecutive 1s to reset
  for (int i = 0; i < 4; i++) {
    SPI.transfer(0xFF);
  }
  
  digitalWrite(AD7705_CS_PIN, HIGH);
  delay(10);
}

// Initialize AD7705
void initAD7705() {
  // Configure Clock Register
  // CLKDIS=0 (clock enabled), CLK=0 (4.9152 MHz), FS=01 (50 Hz)
  writeRegister(AD7705_REG_CLOCK, AD7705_CLOCK_CLK_ON | AD7705_CLOCK_50HZ);
  delay(10);
  
  // Configure Setup Register for Channel 1
  // MODE=01 (self-calibration), Gain=1, Unipolar, Buffer On
  writeRegister(AD7705_REG_SETUP, 
                AD7705_SETUP_SELF_CAL | 
                AD7705_SETUP_GAIN_1 | 
                AD7705_SETUP_UNIPOLAR | 
                AD7705_SETUP_BUFFER);
  
  // Wait for calibration to complete
  Serial.print("Calibrating AD7705...");
  delay(500);  // Calibration takes some time
  
  // Wait for DRDY (Data Ready) by checking the communication register
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

// Write to AD7705 register
void writeRegister(uint8_t reg, uint8_t value) {
  digitalWrite(AD7705_CS_PIN, LOW);
  delayMicroseconds(1);
  
  SPI.transfer(reg | AD7705_COMM_WRITE | AD7705_COMM_CH1);
  SPI.transfer(value);
  
  delayMicroseconds(1);
  digitalWrite(AD7705_CS_PIN, HIGH);
}

// Read from AD7705 register (8-bit)
uint8_t readRegister8(uint8_t reg) {
  digitalWrite(AD7705_CS_PIN, LOW);
  delayMicroseconds(1);
  
  SPI.transfer(reg | AD7705_COMM_READ | AD7705_COMM_CH1);
  uint8_t value = SPI.transfer(0x00);
  
  delayMicroseconds(1);
  digitalWrite(AD7705_CS_PIN, HIGH);
  
  return value;
}

// Read from AD7705 data register (16-bit)
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

// Check if data is ready
bool isDataReady() {
  uint8_t commReg = readRegister8(AD7705_REG_COMM);
  return (commReg & 0x80) == 0;  // DRDY bit is active low
}

// Read voltage from specified channel
float readVoltage(uint8_t channel) {
  // Wait for data ready
  unsigned long timeout = millis() + 1000;
  while (!isDataReady() && millis() < timeout) {
    delay(1);
  }
  
  if (millis() >= timeout) {
    Serial.println("Warning: Data ready timeout!");
  }
  
  // Read ADC value
  uint16_t adcValue = readDataRegister();
  
  // Convert to voltage (unipolar mode: 0 to VREF)
  float voltage = (adcValue * VREF) / ADC_MAX;
  
  return voltage;
}
