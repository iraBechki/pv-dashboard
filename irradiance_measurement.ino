/*
 * Solar Panel Irradiance Measurement using AD7705 and STM32 Blue Pill
 * 
 * Hardware:
 * - STM32F103C8T6 (Blue Pill)
 * - AD7705 D042-2 ADC Module
 * - Small Solar Panel (Vmp=6V, Imp=0.25A, ISC=0.3A) - DEDICATED IRRADIANCE SENSOR
 * - Shunt Resistor: 3.3Ω, 1W (or higher for safety)
 * 
 * Configuration:
 * - Solar panel is PERMANENTLY SHORT-CIRCUITED through the shunt resistor
 * - Panel acts as irradiance sensor only (generates NO usable power)
 * - ISC current is directly proportional to solar irradiance
 * 
 * Wiring:
 * Solar Panel (+) → Shunt Resistor → AD7705 AIN1(+)
 * Shunt Resistor → AD7705 AIN1(-) and GND
 * 
 * AD7705 → STM32 Blue Pill:
 * VCC   → 3.3V
 * GND   → GND
 * SCLK  → PA5 (SPI1_SCK)
 * DIN   → PA7 (SPI1_MOSI)
 * DOUT  → PA6 (SPI1_MISO)
 * CS    → PA4
 * DRDY  → PA3
 */

#include <SPI.h>

// AD7705 Pin Definitions
#define AD7705_CS_PIN    PA4
#define AD7705_DRDY_PIN  PA3

// AD7705 Register Addresses
#define AD7705_REG_COMM      0x00
#define AD7705_REG_SETUP     0x10
#define AD7705_REG_CLOCK     0x20
#define AD7705_REG_DATA      0x30
#define AD7705_REG_TEST      0x40
#define AD7705_REG_ZERO_CAL  0x60
#define AD7705_REG_FULL_CAL  0x70

// AD7705 Channel Selection
#define AD7705_CH_AIN1  0x00  // Channel 1 (AIN1)
#define AD7705_CH_AIN2  0x01  // Channel 2 (AIN2)

// Calibration Constants
const float R_SHUNT = 3.3;           // Shunt resistor in Ohms
const float ISC_AT_STC = 0.3;        // Short-circuit current at 1000 W/m² (A)
const float STC_IRRADIANCE = 1000.0; // Standard Test Condition irradiance (W/m²)
const float VREF = 2.5;              // Reference voltage of AD7705 (V)
const uint16_t AD7705_MAX_VALUE = 65535; // 16-bit ADC

// Measurement variables
float currentISC = 0.0;
float irradiance = 0.0;
uint16_t rawADC = 0;
float voltage = 0.0;

// Timing
unsigned long lastMeasurement = 0;
const unsigned long MEASURE_INTERVAL = 1000; // Measure every 1 second

void setup() {
  Serial.begin(115200);
  while (!Serial) {
    ; // Wait for serial port to connect
  }
  
  Serial.println("=== Solar Panel Irradiance Measurement System ===");
  Serial.println("Initializing...");
  
  // Initialize SPI
  pinMode(AD7705_CS_PIN, OUTPUT);
  pinMode(AD7705_DRDY_PIN, INPUT);
  digitalWrite(AD7705_CS_PIN, HIGH);
  
  SPI.begin();
  SPI.setClockDivider(SPI_CLOCK_DIV64); // Slow clock for AD7705
  SPI.setDataMode(SPI_MODE3);           // CPOL=1, CPHA=1
  SPI.setBitOrder(MSBFIRST);
  
  delay(100);
  
  // Initialize AD7705
  if (initAD7705()) {
    Serial.println("AD7705 initialized successfully!");
  } else {
    Serial.println("ERROR: AD7705 initialization failed!");
  }
  
  Serial.println("\nCalibration Info:");
  Serial.print("- Shunt Resistor: ");
  Serial.print(R_SHUNT);
  Serial.println(" Ω");
  Serial.print("- ISC at STC (1000 W/m²): ");
  Serial.print(ISC_AT_STC);
  Serial.println(" A");
  Serial.print("- Reference Voltage: ");
  Serial.print(VREF);
  Serial.println(" V");
  Serial.println("\nStarting measurements...\n");
  
  delay(1000);
}

void loop() {
  if (millis() - lastMeasurement >= MEASURE_INTERVAL) {
    lastMeasurement = millis();
    
    // Read ADC value
    rawADC = readAD7705(AD7705_CH_AIN1);
    
    // Convert ADC to voltage across shunt
    voltage = (rawADC / (float)AD7705_MAX_VALUE) * VREF;
    
    // Calculate current (Ohm's law: V = I × R)
    currentISC = voltage / R_SHUNT;
    
    // Calculate irradiance (linear relationship with ISC)
    // Irradiance = (ISC_measured / ISC_at_STC) × 1000 W/m²
    if (ISC_AT_STC > 0) {
      irradiance = (currentISC / ISC_AT_STC) * STC_IRRADIANCE;
    } else {
      irradiance = 0;
    }
    
    // Ensure non-negative values
    if (irradiance < 0) irradiance = 0;
    if (currentISC < 0) currentISC = 0;
    
    // Display results
    Serial.println("┌────────────────────────────────────────┐");
    Serial.print("│ Raw ADC:      ");
    Serial.print(rawADC);
    Serial.print(" / ");
    Serial.println(AD7705_MAX_VALUE);
    
    Serial.print("│ Voltage:      ");
    Serial.print(voltage * 1000, 2);
    Serial.println(" mV");
    
    Serial.print("│ Current (ISC): ");
    Serial.print(currentISC * 1000, 2);
    Serial.println(" mA");
    
    Serial.print("│ Irradiance:   ");
    Serial.print(irradiance, 2);
    Serial.println(" W/m²");
    Serial.println("└────────────────────────────────────────┘");
    Serial.println();
  }
}

// Initialize AD7705
bool initAD7705() {
  // Reset AD7705 (write 32 consecutive 1s)
  digitalWrite(AD7705_CS_PIN, LOW);
  for (int i = 0; i < 4; i++) {
    SPI.transfer(0xFF);
  }
  digitalWrite(AD7705_CS_PIN, HIGH);
  delay(100);
  
  // Write to Clock Register
  // CLKDIS=0, CLKDIV=0, CLK=1 (4.9152 MHz), FS=0x0A (50 Hz update rate)
  digitalWrite(AD7705_CS_PIN, LOW);
  SPI.transfer(AD7705_REG_CLOCK | 0x00); // Write to Clock register, CH1
  SPI.transfer(0x0A);  // 50 Hz update rate
  digitalWrite(AD7705_CS_PIN, HIGH);
  delay(10);
  
  // Write to Setup Register
  // MD=01 (normal mode), G=000 (gain=1), B/U=0 (UNIPOLAR), BUF=0, FSYNC=0
  // Using UNIPOLAR mode gives better resolution: full 16-bit range for 0-2.5V
  digitalWrite(AD7705_CS_PIN, LOW);
  SPI.transfer(AD7705_REG_SETUP | 0x00); // Write to Setup register, CH1
  SPI.transfer(0x40); // 0100 0000 = Normal mode, Gain=1, Unipolar, No buffer
  digitalWrite(AD7705_CS_PIN, HIGH);
  delay(10);
  
  // Perform self-calibration
  digitalWrite(AD7705_CS_PIN, LOW);
  SPI.transfer(AD7705_REG_SETUP | 0x00); // Write to Setup register, CH1
  SPI.transfer(0x40); // Self-calibration mode
  digitalWrite(AD7705_CS_PIN, HIGH);
  
  // Wait for calibration to complete (DRDY goes low then high)
  delay(1000);
  
  return true;
}

// Read 16-bit value from AD7705
uint16_t readAD7705(uint8_t channel) {
  uint16_t data = 0;
  
  // Write to Communication Register to select channel and next operation
  digitalWrite(AD7705_CS_PIN, LOW);
  SPI.transfer(AD7705_REG_COMM | (channel & 0x0F));
  digitalWrite(AD7705_CS_PIN, HIGH);
  delayMicroseconds(10);
  
  // Wait for DRDY to go LOW (data ready)
  unsigned long timeout = millis();
  while (digitalRead(AD7705_DRDY_PIN) == HIGH) {
    if (millis() - timeout > 500) {
      Serial.println("WARNING: DRDY timeout!");
      return 0;
    }
  }
  
  // Read data register (16 bits)
  digitalWrite(AD7705_CS_PIN, LOW);
  SPI.transfer(AD7705_REG_DATA | (channel & 0x0F));
  data = SPI.transfer(0x00) << 8;  // MSB
  data |= SPI.transfer(0x00);      // LSB
  digitalWrite(AD7705_CS_PIN, HIGH);
  
  return data;
}

// Optional: Function to calibrate the sensor
void calibrateSensor() {
  Serial.println("=== CALIBRATION MODE ===");
  Serial.println("1. Cover the solar panel completely (dark)");
  Serial.println("2. Press any key when ready...");
  
  while (!Serial.available()) {
    delay(100);
  }
  while (Serial.available()) Serial.read(); // Clear buffer
  
  Serial.println("Calibrating zero offset...");
  delay(1000);
  
  // Perform zero-scale calibration
  digitalWrite(AD7705_CS_PIN, LOW);
  SPI.transfer(AD7705_REG_ZERO_CAL | 0x00);
  digitalWrite(AD7705_CS_PIN, HIGH);
  delay(1000);
  
  Serial.println("Zero calibration complete!");
  Serial.println("\n3. Expose panel to known irradiance (e.g., full sun)");
  Serial.println("4. Press any key when ready...");
  
  while (!Serial.available()) {
    delay(100);
  }
  while (Serial.available()) Serial.read();
  
  Serial.println("Calibrating full scale...");
  delay(1000);
  
  // Perform full-scale calibration
  digitalWrite(AD7705_CS_PIN, LOW);
  SPI.transfer(AD7705_REG_FULL_CAL | 0x00);
  digitalWrite(AD7705_CS_PIN, HIGH);
  delay(1000);
  
  Serial.println("Full-scale calibration complete!");
  Serial.println("=== CALIBRATION FINISHED ===\n");
}
