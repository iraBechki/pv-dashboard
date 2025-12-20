/*
 * Solar Panel Irradiance Measurement using ADS1115 and STM32 Blue Pill
 * 
 * Hardware:
 * - STM32F103C8T6 (Blue Pill)
 * - ADS1115 16-bit ADC Module (I2C)
 * - Small Solar Panel (Vmp=6V, Imp=0.25A, ISC=0.3A) - DEDICATED IRRADIANCE SENSOR
 * - Shunt Resistor: 3.3Ω, 1W (or higher for safety)
 * 
 * Configuration:
 * - Solar panel is PERMANENTLY SHORT-CIRCUITED through the shunt resistor
 * - Panel acts as irradiance sensor only (generates NO usable power)
 * - ISC current is directly proportional to solar irradiance
 * 
 * Physical Wiring:
 * Solar Panel (+) → One end of Shunt Resistor → ADS1115 A0
 * Shunt Resistor (other end) → ADS1115 A1 and GND
 * 
 * ADS1115 → STM32 Blue Pill:
 * VDD → 3.3V (or 5V)
 * GND → GND (CRITICAL: Must share common ground with solar panel!)
 * SCL → PB6 (I2C1_SCL)
 * SDA → PB7 (I2C1_SDA)
 * A0  → Solar + side (before shunt)
 * A1  → After shunt resistor (to GND)
 * 
 * IMPORTANT: All GND connections must be tied together:
 * - Solar panel circuit GND
 * - ADS1115 GND pin
 * - STM32 GND pin
 * 
 * Library Required:
 * - Install "Adafruit ADS1X15" library via Arduino IDE Library Manager
 */

#include <Wire.h>
#include <Adafruit_ADS1X15.h>

// Create ADS1115 object
Adafruit_ADS1115 ads;  // Use this for ADS1115 (16-bit)

// Calibration Constants
const float R_SHUNT = 3.3;           // Shunt resistor in Ohms
const float ISC_AT_STC = 0.3;        // Short-circuit current at 1000 W/m² (A)
const float STC_IRRADIANCE = 1000.0; // Standard Test Condition irradiance (W/m²)

// ADS1115 Configuration
// Gain settings: GAIN_TWOTHIRDS (±6.144V), GAIN_ONE (±4.096V), GAIN_TWO (±2.048V)
// For 3.3Ω shunt with 0.3A max = 990mV, use GAIN_TWO (±2.048V) for best resolution
const float VOLTAGE_RANGE = 2.048;   // Voltage range for GAIN_TWO
const float ADC_RESOLUTION = 32768.0; // 16-bit signed: -32768 to +32767

// Measurement variables
int16_t adcValue = 0;
float voltage = 0.0;
float currentISC = 0.0;
float irradiance = 0.0;

// Timing
unsigned long lastMeasurement = 0;
const unsigned long MEASURE_INTERVAL = 1000; // Measure every 1 second

// Statistics for averaging (reduces noise)
const int NUM_SAMPLES = 10;
float samples[NUM_SAMPLES];
int sampleIndex = 0;

void setup() {
  Serial.begin(115200);
  while (!Serial) {
    delay(10); // Wait for serial port to connect
  }
  
  Serial.println("╔════════════════════════════════════════════════╗");
  Serial.println("║  Solar Irradiance Measurement System          ║");
  Serial.println("║  Using ADS1115 16-bit ADC                      ║");
  Serial.println("╚════════════════════════════════════════════════╝");
  Serial.println();
  
  // Initialize I2C
  Wire.begin();
  
  // Initialize ADS1115
  if (!ads.begin()) {
    Serial.println("❌ ERROR: Failed to initialize ADS1115!");
    Serial.println("   Check wiring and I2C address (default: 0x48)");
    while (1) {
      delay(1000);
    }
  }
  
  Serial.println("✓ ADS1115 initialized successfully!");
  
  // Configure ADS1115
  // GAIN_TWO: ±2.048V range, resolution = 62.5µV per bit
  ads.setGain(GAIN_TWO);
  
  // Set data rate (samples per second)
  // ADS1115: 8, 16, 32, 64, 128, 250, 475, 860 SPS
  // Higher SPS = faster but noisier, Lower SPS = slower but cleaner
  ads.setDataRate(RATE_ADS1115_128SPS); // 128 samples/second is good balance
  
  Serial.println("\n📊 Configuration:");
  Serial.println("   ├─ Gain: ±2.048V (GAIN_TWO)");
  Serial.println("   ├─ Resolution: 62.5 µV/bit");
  Serial.println("   ├─ Data Rate: 128 SPS");
  Serial.print("   ├─ Shunt Resistor: ");
  Serial.print(R_SHUNT);
  Serial.println(" Ω");
  Serial.print("   ├─ ISC at STC: ");
  Serial.print(ISC_AT_STC, 3);
  Serial.println(" A");
  Serial.print("   └─ Max Voltage: ");
  Serial.print(ISC_AT_STC * R_SHUNT, 3);
  Serial.println(" V");
  
  Serial.println("\n🔌 I2C Address: 0x48 (default)");
  Serial.println("📍 Measuring on: A0 (single-ended) or A0-A1 (differential)");
  
  // Initialize sample array
  for (int i = 0; i < NUM_SAMPLES; i++) {
    samples[i] = 0.0;
  }
  
  Serial.println("\n⏱️  Starting measurements in 2 seconds...\n");
  delay(2000);
  
  // Print header
  printHeader();
}

void loop() {
  if (millis() - lastMeasurement >= MEASURE_INTERVAL) {
    lastMeasurement = millis();
    
    // Read differential voltage between A0 and A1
    // This measures voltage across the shunt resistor
    adcValue = ads.readADC_Differential_0_1();
    
    // Alternative: Use single-ended if A1 is connected to GND
    // adcValue = ads.readADC_SingleEnded(0);
    
    // Convert ADC value to voltage
    voltage = ads.computeVolts(adcValue);
    
    // Ensure positive voltage (short-circuit current flows one direction)
    if (voltage < 0) voltage = 0;
    
    // Calculate current using Ohm's law: I = V / R
    currentISC = voltage / R_SHUNT;
    
    // Store sample for averaging
    samples[sampleIndex] = currentISC;
    sampleIndex = (sampleIndex + 1) % NUM_SAMPLES;
    
    // Calculate average current (reduces noise)
    float avgCurrent = 0;
    for (int i = 0; i < NUM_SAMPLES; i++) {
      avgCurrent += samples[i];
    }
    avgCurrent /= NUM_SAMPLES;
    
    // Calculate irradiance from average current
    // Irradiance = (ISC_measured / ISC_at_STC) × 1000 W/m²
    if (ISC_AT_STC > 0) {
      irradiance = (avgCurrent / ISC_AT_STC) * STC_IRRADIANCE;
    } else {
      irradiance = 0;
    }
    
    // Clamp to valid range
    if (irradiance < 0) irradiance = 0;
    if (irradiance > 1500) irradiance = 1500; // Max reasonable value
    
    // Display results
    printMeasurement(adcValue, voltage, currentISC, avgCurrent, irradiance);
  }
}

void printHeader() {
  Serial.println("┌──────────┬───────────┬───────────┬───────────┬─────────────┐");
  Serial.println("│ ADC Raw  │  Voltage  │ Inst.Curr │ Avg.Curr  │ Irradiance  │");
  Serial.println("│          │   (mV)    │   (mA)    │   (mA)    │   (W/m²)    │");
  Serial.println("├──────────┼───────────┼───────────┼───────────┼─────────────┤");
}

void printMeasurement(int16_t adc, float v, float iInst, float iAvg, float irr) {
  // Print in tabular format
  Serial.print("│ ");
  printPadded(String(adc), 8);
  Serial.print(" │ ");
  printPadded(String(v * 1000, 1), 9);
  Serial.print(" │ ");
  printPadded(String(iInst * 1000, 1), 9);
  Serial.print(" │ ");
  printPadded(String(iAvg * 1000, 1), 9);
  Serial.print(" │ ");
  printPadded(String(irr, 1), 11);
  Serial.println(" │");
}

void printPadded(String str, int width) {
  int padding = width - str.length();
  for (int i = 0; i < padding; i++) {
    Serial.print(" ");
  }
  Serial.print(str);
}

// Optional: Function to test all 4 channels
void testAllChannels() {
  Serial.println("\n=== Testing All ADS1115 Channels ===");
  for (int i = 0; i < 4; i++) {
    int16_t adc = ads.readADC_SingleEnded(i);
    float volts = ads.computeVolts(adc);
    Serial.print("Channel A");
    Serial.print(i);
    Serial.print(": ");
    Serial.print(adc);
    Serial.print(" (");
    Serial.print(volts, 4);
    Serial.println(" V)");
  }
  Serial.println();
}

// Optional: Calibration function
void calibrateZero() {
  Serial.println("\n=== ZERO CALIBRATION ===");
  Serial.println("Cover the solar panel completely (dark condition)");
  Serial.println("Press any key when ready...");
  
  while (!Serial.available()) {
    delay(100);
  }
  while (Serial.available()) Serial.read();
  
  Serial.println("Measuring offset...");
  
  long sum = 0;
  int numReadings = 50;
  for (int i = 0; i < numReadings; i++) {
    sum += ads.readADC_Differential_0_1();
    delay(20);
  }
  
  float offset = sum / (float)numReadings;
  Serial.print("Average ADC offset: ");
  Serial.println(offset);
  Serial.println("Note: You may need to subtract this offset in your code");
  Serial.println("=== CALIBRATION COMPLETE ===\n");
}
