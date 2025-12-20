//------------------------------------VA1--------------------------------------------
#include <SPI.h>
#include <LoRa.h>
#include <SdFat.h>
#include <Wire.h>
#include <math.h>

 //    PA0 is used to measure voltage
const float vRef = 3.3;
const int sampleCount = 1500;
const float calibrationFactor = 368.8;  // Adjusted for accurate 239V reading

int minValue = 4095;
int maxValue = 0;

// LoRa pins
#define LORA_CS     PA4
#define LORA_RST    PA3
#define LORA_DIO0   PA2


// Slave ID
const String myID = "VA1";  // Unique ID for this slave
// SD card pins and SPI2 configuration
#define SD_CS PB12
SPIClass SPI_2(PB15, PB14, PB13);  // SPI2: MOSI, MISO, SCK
SdFat sd;
SdSpiConfig sdConfig(SD_CS, DEDICATED_SPI, SD_SCK_MHZ(10), &SPI_2);  // SPI2 config
String lastTimestamp = "0000-00-00 00:00:00";  // to store time received from master
int rssiValue = 0;  // to store RSSI value

void setup() {
  Serial.begin(9600);
    analogReadResolution(12);
  LoRa.setPins(LORA_CS, LORA_RST, LORA_DIO0);


  if (!LoRa.begin(433E6)) {  // SX1278 sweet spot
    Serial.println("LoRa init failed!");
    while (1);
  }

  // LoRa configuration for balanced range and speed (Option 1)
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
  if (!sd.exists("VA1.CSV")) {
    File headerFile = sd.open("VA1.CSV", O_WRITE | O_CREAT | O_APPEND);
    if (headerFile) {
      headerFile.println("Timestamp,VA1");
      headerFile.close();
    }
  }
 
}

void loop() {
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String incoming = "";
    while (LoRa.available()) {
      incoming += (char)LoRa.read();
    }
    incoming.trim();
    
    // Capture RSSI after receiving packet
    rssiValue = LoRa.packetRssi();

    if (incoming.startsWith("TIME:")) {
      lastTimestamp = incoming.substring(5);  // Store time (without "TIME:")
    } else if (incoming == myID) {

// Reset min/max values before each measurement
minValue = 4095;
maxValue = 0;

// Improved measurement: Average multiple measurements for stability
const int numMeasurements = 5;  // Take 5 independent measurements
float measurements[numMeasurements];

for (int m = 0; m < numMeasurements; m++) {
  minValue = 4095;
  maxValue = 0;
  
  // Sample for ~200ms to capture 10 full cycles at 50Hz (or 12 cycles at 60Hz)
  // This ensures we capture multiple complete AC cycles
  const int samplesPerMeasurement = 2000;  // 2000 samples * 100us = 200ms
  
  for (int i = 0; i < samplesPerMeasurement; i++) {
    int val = analogRead(A0);
    
    // Discard first 200 samples (20ms) to allow sensor to stabilize
    if (i >= 200) {
      if (val < minValue) minValue = val;
      if (val > maxValue) maxValue = val;
    }
    delayMicroseconds(100);
  }
  
  float vpp = (maxValue - minValue) * (vRef / 4095.0);
  measurements[m] = vpp;
  
  delay(10);  // Small delay between measurements
}

// Sort and take median of 5 measurements to reject outliers
for (int i = 0; i < numMeasurements - 1; i++) {
  for (int j = i + 1; j < numMeasurements; j++) {
    if (measurements[i] > measurements[j]) {
      float temp = measurements[i];
      measurements[i] = measurements[j];
      measurements[j] = temp;
    }
  }
}

// Use median value (middle of 5 sorted values) for best noise rejection
float vpp = measurements[2];  // Median of 5 values
float vrms = vpp / 2.0 / sqrt(2.0);

// If Vpp is very small, consider it as zero voltage (no AC signal or just noise)
float VA1value;
if (vpp < 0.05) {  // Threshold: less than 50mV peak-to-peak = no signal
  VA1value = 0.0;
} else {
  VA1value = vrms * calibrationFactor - 13.29;
}







      // Construct CSV line using stored timestamp
      String csvLine = lastTimestamp;
      csvLine += "," + String(VA1value) ;

      // Save CSV line to SD card
      bool written = false;
      for (int attempt = 1; attempt <= 3; attempt++) {
        File dataFile = sd.open("VA1.CSV", O_WRITE | O_CREAT | O_APPEND);
        if (dataFile) {
          dataFile.println(csvLine);
          dataFile.close();
          written = true;
          break;
        } else {
          Serial.print("Attempt ");
          Serial.print(attempt);
          Serial.println(": Failed to open VA1.CSV for writing.");
          delay(5);
        }
      }

      if (!written) {
        Serial.println("Error: All 3 attempts to write to SD card failed.");
      }


      // Send data to master over LoRa
      // Format: VA1value,BattS,RSSI
      LoRa.beginPacket();
      LoRa.print(VA1value, 4);  // send VA1value with 4 decimal places
      LoRa.print(",");
      LoRa.print(100);          // BattS fixed value
      LoRa.print(",");
      LoRa.print(rssiValue);    // RSSI value
      LoRa.endPacket();
    }
  }
}
