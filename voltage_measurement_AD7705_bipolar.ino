/*
 * STM32 Blue Pill + AD7705 Voltage Measurement
 * BIPOLAR DIFFERENTIAL MODE
 * 
 * This version uses bipolar mode to measure ±3.3V differential voltages
 * 
 * Wiring:
 * AD7705 VDD  -> STM32 3.3V
 * AD7705 GND  -> STM32 GND
 * AD7705 SCLK -> STM32 PA5 (SPI1 SCK)
 * AD7705 MOSI -> STM32 PA7 (SPI1 MOSI)
 * AD7705 MISO -> STM32 PA6 (SPI1 MISO)
 * AD7705 CS   -> STM32 PA4
 * 
 * Differential Input:
 * AIN1+ -> Positive signal
 * AIN1- -> Negative signal (reference)
 * 
 * Voltage measured = V(AIN1+) - V(AIN1-)
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
#define AD7705_SETUP_NORMAL    0x40
#define AD7705_SETUP_SELF_CAL  0x40
#define AD7705_SETUP_GAIN_1    0x00
#define AD7705_SETUP_UNIPOLAR  0x04
#define AD7705_SETUP_BIPOLAR   0x00  // Bipolar mode
#define AD7705_SETUP_BUFFER    0x02

// Clock Register bits
#define AD7705_CLOCK_CLK_ON    0x04
#define AD7705_CLOCK_50HZ      0x01

// Constants
const float VREF = 3.3;              // Reference voltage (VDD)
const uint16_t ADC_MAX = 65535;      // 16-bit ADC
const int16_t ADC_BIPOLAR_OFFSET = 32768;  // Offset for bipolar mode

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(10);
  
  Serial.println("STM32 + AD7705 Bipolar Differential Measurement");
  Serial.println("================================================");
  Serial.println("Range: -3.3V to +3.3V differential\n");
  
  pinMode(AD7705_CS_PIN, OUTPUT);
  digitalWrite(AD7705_CS_PIN, HIGH);
  
  SPI.begin();
  SPI.setBitOrder(MSBFIRST);
  SPI.setDataMode(SPI_MODE3);
  SPI.setClockDivider(SPI_CLOCK_DIV16);
  
  delay(100);
  resetAD7705();
  delay(100);
  initAD7705();
  
  Serial.println("AD7705 initialized in BIPOLAR mode!");
  Serial.println("Reading differential voltage...\n");
}

void loop() {
  float voltage = readVoltageBipolar(AD7705_COMM_CH1);
  
  Serial.print("Differential Voltage (AIN+ - AIN-): ");
  Serial.print(voltage, 4);
  Serial.println(" V");
  
  delay(1000);
}

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
  writeRegister(AD7705_REG_CLOCK, AD7705_CLOCK_CLK_ON | AD7705_CLOCK_50HZ);
  delay(10);
  
  // BIPOLAR mode - this is the key difference!
  writeRegister(AD7705_REG_SETUP, 
                AD7705_SETUP_SELF_CAL | 
                AD7705_SETUP_GAIN_1 | 
                AD7705_SETUP_BIPOLAR |  // Changed to bipolar
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

// Read voltage in bipolar mode
float readVoltageBipolar(uint8_t channel) {
  unsigned long timeout = millis() + 1000;
  while (!isDataReady() && millis() < timeout) {
    delay(1);
  }
  
  uint16_t adcValue = readDataRegister();
  
  // Convert to signed value (bipolar mode)
  int16_t signedValue = adcValue - ADC_BIPOLAR_OFFSET;
  
  // Convert to voltage: -VREF to +VREF
  float voltage = (signedValue * VREF) / ADC_BIPOLAR_OFFSET;
  
  return voltage;
}
