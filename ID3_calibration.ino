//------------------------------------ID3 CALIBRATION TOOL--------------------------------------------
// This tool helps you calibrate the voltage divider ratio and verify VREF
// Connect your current sensor and use this to find the correct constants

#include <SPI.h>

#define AD7705_CS_PIN PA1
#define AD7705_DRDY_PIN PB0

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

// Test these values
float VREF = 5.0;  // Start with 5.0V
float VOLTAGE_DIVIDER_RATIO = 1.37;  // Start with 1.37

const uint16_t ADC_MAX = 65535;

void setup() {
  Serial.begin(9600);
  delay(3000);
  
  Serial.println("\n\n========================================");
  Serial.println("   ID3 CALIBRATION TOOL");
  Serial.println("========================================\n");
  
  pinMode(AD7705_CS_PIN, OUTPUT);
  digitalWrite(AD7705_CS_PIN, HIGH);
  pinMode(AD7705_DRDY_PIN, INPUT);
  
  SPI.begin();
  SPI.setBitOrder(MSBFIRST);
  SPI.setDataMode(SPI_MODE3);
  SPI.setClockDivider(SPI_CLOCK_DIV16);
  
  delay(100);
  resetAD7705();
  delay(100);
  initAD7705();
  
  Serial.println("AD7705 initialized.\n");
  Serial.println("========================================");
  Serial.println("CALIBRATION INSTRUCTIONS:");
  Serial.println("========================================");
  Serial.println("1. Set current sensor to 0A (no current)");
  Serial.println("2. Use multimeter to measure:");
  Serial.println("   - Voltage at sensor output (before divider)");
  Serial.println("   - Voltage at AD7705 AIN1 (after divider)");
  Serial.println("3. Compare with readings below");
  Serial.println("========================================\n");
  
  delay(2000);
}

void loop() {
  Serial.println("\n--- Taking 10 Readings ---");
  
  float totalADC = 0;
  float totalVoltage = 0;
  int validReadings = 0;
  
  for (int i = 0; i < 10; i++) {
    startConversionAD7705();
    
    unsigned long timeout = millis() + 1000;
    while (!isDataReadyAD7705() && millis() < timeout) {
      delay(1);
    }
    
    if (millis() >= timeout) {
      Serial.println("Timeout on reading!");
      continue;
    }
    
    uint16_t adcValue = readDataRegisterAD7705();
    float voltage = (adcValue * VREF) / ADC_MAX;
    
    totalADC += adcValue;
    totalVoltage += voltage;
    validReadings++;
    
    delay(100);
  }
  
  if (validReadings == 0) {
    Serial.println("ERROR: No valid readings!");
    delay(5000);
    return;
  }
  
  float avgADC = totalADC / validReadings;
  float avgVoltage = totalVoltage / validReadings;
  
  Serial.println("\n========================================");
  Serial.println("MEASUREMENT RESULTS:");
  Serial.println("========================================");
  Serial.print("Average ADC Value: ");
  Serial.print(avgADC, 0);
  Serial.print(" (0x");
  Serial.print((uint16_t)avgADC, HEX);
  Serial.println(")");
  
  Serial.print("Measured Voltage (at AD7705 AIN1): ");
  Serial.print(avgVoltage, 4);
  Serial.println(" V");
  
  Serial.println("\n========================================");
  Serial.println("CALIBRATION CALCULATIONS:");
  Serial.println("========================================");
  
  Serial.println("\nTo find VREF:");
  Serial.println("1. Measure voltage at AD7705 AIN1 with multimeter = V_measured");
  Serial.println("2. Note ADC value above");
  Serial.print("3. Calculate: VREF = (V_measured × 65535) / ");
  Serial.println(avgADC, 0);
  Serial.println("4. Update VREF constant in code");
  
  Serial.println("\nTo find VOLTAGE_DIVIDER_RATIO:");
  Serial.println("1. Measure voltage at sensor output with multimeter = V_sensor");
  Serial.println("2. Measure voltage at AD7705 AIN1 with multimeter = V_adc");
  Serial.println("3. Calculate: VOLTAGE_DIVIDER_RATIO = V_sensor / V_adc");
  Serial.println("4. Update VOLTAGE_DIVIDER_RATIO constant in code");
  
  Serial.println("\n========================================");
  Serial.println("QUICK CALCULATIONS (assuming 0A=2.5V):");
  Serial.println("========================================");
  
  // Assume sensor outputs 2.5V at 0A
  float assumedSensorVoltage = 2.5;
  
  Serial.print("If sensor outputs 2.5V at 0A,\n");
  Serial.print("and AD7705 reads ");
  Serial.print(avgVoltage, 4);
  Serial.println("V,");
  
  float calculatedRatio = assumedSensorVoltage / avgVoltage;
  Serial.print("then VOLTAGE_DIVIDER_RATIO = 2.5 / ");
  Serial.print(avgVoltage, 4);
  Serial.print(" = ");
  Serial.println(calculatedRatio, 4);
  
  Serial.println("\n========================================");
  Serial.println("CURRENT SETTINGS:");
  Serial.println("========================================");
  Serial.print("VREF = ");
  Serial.println(VREF, 2);
  Serial.print("VOLTAGE_DIVIDER_RATIO = ");
  Serial.println(VOLTAGE_DIVIDER_RATIO, 4);
  
  Serial.println("\n========================================");
  Serial.println("WHAT TO DO:");
  Serial.println("========================================");
  Serial.print("1. Update VREF to: ");
  Serial.print("(use multimeter to verify)\n");
  Serial.print("2. Update VOLTAGE_DIVIDER_RATIO to: ");
  Serial.println(calculatedRatio, 4);
  Serial.println("3. Upload ID3.ino with new values");
  Serial.println("4. Test with known currents");
  
  Serial.println("\n--- Waiting 10 seconds for next reading ---\n");
  delay(10000);
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
  
  delay(500);
  
  unsigned long timeout = millis() + 2000;
  while (millis() < timeout) {
    if (isDataReadyAD7705()) {
      return;
    }
    delay(10);
  }
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
