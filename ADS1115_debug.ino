/*
 * ADS1115 Debugging and Diagnostic Tool
 * 
 * This code will help diagnose I2C communication issues with ADS1115
 * 
 * Common issues:
 * 1. Wrong I2C address (0x48, 0x49, 0x4A, or 0x4B)
 * 2. Missing pull-up resistors on SDA/SCL (need 4.7kΩ each)
 * 3. Wrong pins (STM32 Blue Pill I2C1: PB6=SCL, PB7=SDA)
 * 4. Power supply issues
 * 5. Library not installed properly
 */

#include <Wire.h>
#include <Adafruit_ADS1X15.h>

Adafruit_ADS1115 ads;

// Possible I2C addresses for ADS1115
const uint8_t ADS1115_ADDRESSES[] = {0x48, 0x49, 0x4A, 0x4B};
uint8_t detectedAddress = 0x00;

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("\n\n");
  Serial.println("╔═══════════════════════════════════════════════╗");
  Serial.println("║     ADS1115 DIAGNOSTIC & DEBUG TOOL           ║");
  Serial.println("╚═══════════════════════════════════════════════╝");
  Serial.println();
  
  // Step 1: Check I2C Pin Configuration
  Serial.println("═══ STEP 1: I2C Pin Configuration ═══");
  Serial.println("STM32 Blue Pill I2C1 Default Pins:");
  Serial.println("  SCL → PB6");
  Serial.println("  SDA → PB7");
  Serial.println();
  Serial.println("⚠️  Make sure your wiring matches:");
  Serial.println("  ADS1115 SCL → STM32 PB6");
  Serial.println("  ADS1115 SDA → STM32 PB7");
  Serial.println("  ADS1115 VDD → 3.3V or 5V");
  Serial.println("  ADS1115 GND → GND");
  Serial.println();
  
  // Initialize I2C
  Wire.begin();
  Wire.setClock(100000); // 100kHz - slow and reliable
  
  delay(500);
  
  // Step 2: I2C Bus Scan
  Serial.println("═══ STEP 2: Scanning I2C Bus ═══");
  scanI2C();
  Serial.println();
  
  // Step 3: Try to initialize ADS1115
  Serial.println("═══ STEP 3: ADS1115 Initialization ═══");
  
  bool initialized = false;
  
  // Try each possible address
  for (int i = 0; i < 4; i++) {
    Serial.print("Trying address 0x");
    Serial.print(ADS1115_ADDRESSES[i], HEX);
    Serial.print("... ");
    
    if (ads.begin(ADS1115_ADDRESSES[i])) {
      Serial.println("✓ SUCCESS!");
      detectedAddress = ADS1115_ADDRESSES[i];
      initialized = true;
      break;
    } else {
      Serial.println("✗ Failed");
    }
  }
  
  Serial.println();
  
  if (!initialized) {
    Serial.println("❌ ERROR: Could not initialize ADS1115!");
    Serial.println();
    Serial.println("╔═══════════════════════════════════════════════╗");
    Serial.println("║           TROUBLESHOOTING STEPS               ║");
    Serial.println("╚═══════════════════════════════════════════════╝");
    Serial.println();
    Serial.println("1. Check I2C device was detected in Step 2");
    Serial.println("   → If NO devices found:");
    Serial.println("     • Check wiring (SCL→PB6, SDA→PB7)");
    Serial.println("     • Add 4.7kΩ pull-up resistors on SDA & SCL to 3.3V");
    Serial.println("     • Check power supply (VDD and GND)");
    Serial.println();
    Serial.println("2. If device detected but init failed:");
    Serial.println("   → Reinstall Adafruit_ADS1X15 library");
    Serial.println("   → Try different I2C speed (currently 100kHz)");
    Serial.println();
    Serial.println("3. Check ADDR pin on ADS1115:");
    Serial.println("   → ADDR to GND   = 0x48 (default)");
    Serial.println("   → ADDR to VDD   = 0x49");
    Serial.println("   → ADDR to SDA   = 0x4A");
    Serial.println("   → ADDR to SCL   = 0x4B");
    Serial.println();
    
    while(1) {
      delay(1000);
    }
  }
  
  // Step 4: Configure ADS1115
  Serial.println("═══ STEP 4: Configuring ADS1115 ═══");
  Serial.print("Using address: 0x");
  Serial.println(detectedAddress, HEX);
  
  ads.setGain(GAIN_TWO);  // ±2.048V
  ads.setDataRate(RATE_ADS1115_128SPS);
  
  Serial.println("Configuration:");
  Serial.println("  Gain: GAIN_TWO (±2.048V)");
  Serial.println("  Data Rate: 128 SPS");
  Serial.println("  Resolution: 62.5 µV/bit");
  Serial.println();
  
  // Step 5: Test all channels
  Serial.println("═══ STEP 5: Testing All Channels ═══");
  testAllChannels();
  Serial.println();
  
  // Step 6: Differential measurement
  Serial.println("═══ STEP 6: Differential Measurement Test ═══");
  testDifferential();
  Serial.println();
  
  Serial.println("╔═══════════════════════════════════════════════╗");
  Serial.println("║         CONTINUOUS MONITORING MODE            ║");
  Serial.println("╚═══════════════════════════════════════════════╝");
  Serial.println();
  Serial.println("Reading A0-A1 differential every second...");
  Serial.println("This should show voltage across your shunt resistor");
  Serial.println();
  printMonitorHeader();
}

void loop() {
  static unsigned long lastRead = 0;
  
  if (millis() - lastRead >= 1000) {
    lastRead = millis();
    
    // Read differential (A0 - A1)
    int16_t adcDiff = ads.readADC_Differential_0_1();
    float voltsDiff = ads.computeVolts(adcDiff);
    
    // Read single-ended A0
    int16_t adcA0 = ads.readADC_SingleEnded(0);
    float voltsA0 = ads.computeVolts(adcA0);
    
    // Read single-ended A1
    int16_t adcA1 = ads.readADC_SingleEnded(1);
    float voltsA1 = ads.computeVolts(adcA1);
    
    // Calculate current assuming 3.3Ω shunt
    float current_mA = (voltsDiff / 3.3) * 1000.0;
    
    // Print results
    Serial.print("│ ");
    printPadded(String(adcDiff), 8);
    Serial.print(" │ ");
    printPadded(String(voltsDiff * 1000, 2), 10);
    Serial.print(" │ ");
    printPadded(String(adcA0), 8);
    Serial.print(" │ ");
    printPadded(String(voltsA0, 3), 8);
    Serial.print(" │ ");
    printPadded(String(adcA1), 8);
    Serial.print(" │ ");
    printPadded(String(voltsA1, 3), 8);
    Serial.print(" │ ");
    printPadded(String(current_mA, 1), 10);
    Serial.println(" │");
  }
}

// ═══════════════════════════════════════════════════════
// DIAGNOSTIC FUNCTIONS
// ═══════════════════════════════════════════════════════

void scanI2C() {
  byte error, address;
  int deviceCount = 0;
  
  Serial.println("Scanning I2C bus (addresses 0x01 to 0x7F)...");
  Serial.println();
  
  for (address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    error = Wire.endTransmission();
    
    if (error == 0) {
      Serial.print("✓ I2C device found at 0x");
      if (address < 16) Serial.print("0");
      Serial.print(address, HEX);
      Serial.print(" (");
      Serial.print(address);
      Serial.print(")");
      
      // Identify known devices
      if (address >= 0x48 && address <= 0x4B) {
        Serial.print(" → ADS1115 possible address!");
      }
      Serial.println();
      deviceCount++;
    }
    else if (error == 4) {
      Serial.print("✗ Unknown error at 0x");
      if (address < 16) Serial.print("0");
      Serial.println(address, HEX);
    }
  }
  
  Serial.println();
  if (deviceCount == 0) {
    Serial.println("❌ NO I2C devices found!");
    Serial.println();
    Serial.println("⚠️  This means I2C communication is not working!");
    Serial.println("   Possible causes:");
    Serial.println("   1. Wrong pins (check PB6=SCL, PB7=SDA)");
    Serial.println("   2. Missing pull-up resistors (need 4.7kΩ on SDA & SCL)");
    Serial.println("   3. Loose connections");
    Serial.println("   4. ADS1115 not powered");
  } else {
    Serial.print("✓ Found ");
    Serial.print(deviceCount);
    Serial.println(" device(s) on I2C bus");
  }
}

void testAllChannels() {
  Serial.println("Single-ended readings for all 4 channels:");
  Serial.println("(Relative to GND)");
  Serial.println();
  
  for (int ch = 0; ch < 4; ch++) {
    int16_t adc = ads.readADC_SingleEnded(ch);
    float volts = ads.computeVolts(adc);
    
    Serial.print("  A");
    Serial.print(ch);
    Serial.print(": ");
    Serial.print("ADC=");
    printPadded(String(adc), 6);
    Serial.print("  Voltage=");
    Serial.print(volts, 4);
    Serial.print(" V (");
    Serial.print(volts * 1000, 1);
    Serial.println(" mV)");
  }
  
  Serial.println();
  Serial.println("💡 Expected for your setup:");
  Serial.println("   A0: Should show positive voltage (solar + side)");
  Serial.println("   A1: Should be ~0V (connected to GND)");
  Serial.println("   A0-A1 differential = voltage across shunt");
}

void testDifferential() {
  Serial.println("Testing differential measurements:");
  Serial.println();
  
  // Test A0 - A1 (your shunt resistor)
  int16_t diff01 = ads.readADC_Differential_0_1();
  float volts01 = ads.computeVolts(diff01);
  
  Serial.print("  A0-A1: ");
  Serial.print("ADC=");
  printPadded(String(diff01), 6);
  Serial.print("  Voltage=");
  Serial.print(volts01, 4);
  Serial.print(" V (");
  Serial.print(volts01 * 1000, 1);
  Serial.println(" mV)");
  
  // Test A2 - A3 (unused, should be ~0)
  int16_t diff23 = ads.readADC_Differential_2_3();
  float volts23 = ads.computeVolts(diff23);
  
  Serial.print("  A2-A3: ");
  Serial.print("ADC=");
  printPadded(String(diff23), 6);
  Serial.print("  Voltage=");
  Serial.print(volts23, 4);
  Serial.println(" V (should be ~0V if unconnected)");
  
  Serial.println();
  Serial.println("💡 Your shunt voltage should appear in A0-A1");
  Serial.println("   If it shows 0V but multimeter shows voltage:");
  Serial.println("   → Check A0 connected to solar panel (+) before shunt");
  Serial.println("   → Check A1 connected after shunt (to GND)");
  Serial.println("   → Verify shunt resistor connections");
}

void printMonitorHeader() {
  Serial.println("┌──────────┬────────────┬──────────┬──────────┬──────────┬──────────┬────────────┐");
  Serial.println("│ A0-A1    │  Diff Volt │   A0     │   A0V    │   A1     │   A1V    │  Current   │");
  Serial.println("│ (ADC)    │    (mV)    │  (ADC)   │   (V)    │  (ADC)   │   (V)    │    (mA)    │");
  Serial.println("├──────────┼────────────┼──────────┼──────────┼──────────┼──────────┼────────────┤");
}

void printPadded(String str, int width) {
  int padding = width - str.length();
  for (int i = 0; i < padding; i++) {
    Serial.print(" ");
  }
  Serial.print(str);
}
