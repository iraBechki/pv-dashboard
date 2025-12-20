/*
 * AD7705 Simple Communication Test
 * 
 * This code tests if the AD7705 is responding to SPI commands.
 * Upload this FIRST before trying the full WS code.
 * 
 * Wiring:
 * AD7705 VDD  -> STM32 3.3V
 * AD7705 GND  -> STM32 GND
 * AD7705 CS   -> STM32 PA1
 * AD7705 SCLK -> STM32 PA5
 * AD7705 MISO -> STM32 PA6
 * AD7705 MOSI -> STM32 PA7
 * AD7705 DRDY -> STM32 PB0  (IMPORTANT!)
 */

#include <SPI.h>

#define AD7705_CS_PIN PA1
#define AD7705_DRDY_PIN PB0

// AD7705 Register addresses
#define AD7705_REG_COMM        0x00
#define AD7705_REG_SETUP       0x10
#define AD7705_REG_CLOCK       0x20
#define AD7705_REG_DATA        0x30
#define AD7705_REG_TEST        0x40
#define AD7705_REG_ZERO_CAL    0x60

// Communication Register bits
#define AD7705_COMM_WRITE      0x00
#define AD7705_COMM_READ       0x08
#define AD7705_COMM_CH1        0x00

void setup() {
  Serial.begin(9600);
  while (!Serial) delay(10);
  
  Serial.println("========================================");
  Serial.println("AD7705 Communication Test");
  Serial.println("========================================\n");
  
  pinMode(AD7705_CS_PIN, OUTPUT);
  digitalWrite(AD7705_CS_PIN, HIGH);
  
  // Initialize DRDY pin
  pinMode(AD7705_DRDY_PIN, INPUT);
  
  // Check DRDY pin state
  Serial.print("DRDY Pin initial state: ");
  Serial.println(digitalRead(AD7705_DRDY_PIN) == HIGH ? "HIGH" : "LOW");
  Serial.println("(Should toggle during calibration)\n");
  
  // Test different SPI configurations
  Serial.println("Testing SPI MODE 3:");
  testSPIConfig(SPI_MODE3, SPI_CLOCK_DIV16);
  delay(500);
  
  Serial.println("\nTesting SPI MODE 2:");
  testSPIConfig(SPI_MODE2, SPI_CLOCK_DIV16);
  delay(500);
  
  Serial.println("\nTesting SPI MODE 3 (slower clock):");
  testSPIConfig(SPI_MODE3, SPI_CLOCK_DIV32);
  delay(500);
  
  Serial.println("\n========================================");
  Serial.println("Test complete. Check results above.");
  Serial.println("========================================");
}

void loop() {
  // Nothing - this is a one-time test
  delay(10000);
}

void testSPIConfig(uint8_t spiMode, uint8_t clockDiv) {
  SPI.begin();
  SPI.setBitOrder(MSBFIRST);
  SPI.setDataMode(spiMode);
  SPI.setClockDivider(clockDiv);
  
  delay(100);
  
  // Reset AD7705
  Serial.println("  Sending reset sequence...");
  digitalWrite(AD7705_CS_PIN, LOW);
  delay(1);
  for (int i = 0; i < 4; i++) {
    SPI.transfer(0xFF);
  }
  digitalWrite(AD7705_CS_PIN, HIGH);
  delay(100);
  
  // Try to read communication register
  Serial.println("  Reading Communication Register...");
  digitalWrite(AD7705_CS_PIN, LOW);
  delayMicroseconds(1);
  SPI.transfer(AD7705_REG_COMM | AD7705_COMM_READ | AD7705_COMM_CH1);
  uint8_t commValue = SPI.transfer(0x00);
  delayMicroseconds(1);
  digitalWrite(AD7705_CS_PIN, HIGH);
  
  Serial.print("  Communication Register: 0x");
  Serial.print(commValue, HEX);
  
  if (commValue == 0xFF || commValue == 0x00) {
    Serial.println(" (FAILED - likely not connected)");
  } else {
    Serial.println(" (OK - chip responding!)");
  }
  
  // Try to read Clock register
  Serial.println("  Writing Clock Register...");
  writeRegister(AD7705_REG_CLOCK, 0x05);  // CLK_ON | 50Hz
  delay(10);
  
  Serial.println("  Reading Clock Register back...");
  uint8_t clockValue = readRegister(AD7705_REG_CLOCK);
  Serial.print("  Clock Register: 0x");
  Serial.print(clockValue, HEX);
  
  if (clockValue == 0x05) {
    Serial.println(" (OK - read/write working!)");
  } else if (clockValue == 0xFF || clockValue == 0x00) {
    Serial.println(" (FAILED - not communicating)");
  } else {
    Serial.print(" (Unexpected value - might be OK, expected 0x05)");
  }
  
  SPI.end();
}

void writeRegister(uint8_t reg, uint8_t value) {
  digitalWrite(AD7705_CS_PIN, LOW);
  delayMicroseconds(1);
  SPI.transfer(reg | AD7705_COMM_WRITE | AD7705_COMM_CH1);
  SPI.transfer(value);
  delayMicroseconds(1);
  digitalWrite(AD7705_CS_PIN, HIGH);
}

uint8_t readRegister(uint8_t reg) {
  digitalWrite(AD7705_CS_PIN, LOW);
  delayMicroseconds(1);
  SPI.transfer(reg | AD7705_COMM_READ | AD7705_COMM_CH1);
  uint8_t value = SPI.transfer(0x00);
  delayMicroseconds(1);
  digitalWrite(AD7705_CS_PIN, HIGH);
  return value;
}
