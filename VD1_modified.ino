//------------------------------------VD1--------------------------------------------
#include <SPI.h>
#include <LoRa.h>
#include <SdFat.h>
#include <Wire.h>
 //    PA0 is used to measure voltage
// LoRa pins
#define LORA_CS     PA4
#define LORA_RST    PA3
#define LORA_DIO0   PA2
// Slave ID
const String myID = "VD1";  // Unique ID for this slave
// SD card pins and SPI2 configuration
#define SD_CS PB12
SPIClass SPI_2(PB15, PB14, PB13);  // SPI2: MOSI, MISO, SCK
SdFat sd;
SdSpiConfig sdConfig(SD_CS, DEDICATED_SPI, SD_SCK_MHZ(10), &SPI_2);  // SPI2 config
String lastTimestamp = "0000-00-00 00:00:00";  // to store time received from master
void setup() {
  Serial.begin(9600);
    analogReadResolution(12);
  LoRa.setPins(LORA_CS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(433E6)) {
    Serial.println("LoRa init failed!");
    while (1);
  }
  LoRa.setFrequency(433E6);              // SX1278 sweet spot
  LoRa.setSpreadingFactor(8);            // SF8 → balanced speed and range
  LoRa.setSignalBandwidth(125E3);        // 125kHz → good reliability
  LoRa.setCodingRate4(5);                // CR4/5 → less overhead, faster
  LoRa.setPreambleLength(8);             // Standard preamble
  LoRa.enableCrc();                      // Avoid corrupted packets
  LoRa.setTxPower(17, PA_OUTPUT_PA_BOOST_PIN);  // 17dBm for moderate range
  // Init SD card on SPI2
  if (!sd.begin(sdConfig)) {
    Serial.println("SD Card init failed!");
    while (1);
  }
  Serial.println("SD Card initialized on SPI2.");
  // Write CSV header if file doesn't exist
  if (!sd.exists("VD1.CSV")) {
    File headerFile = sd.open("VD1.CSV", O_WRITE | O_CREAT | O_APPEND);
    if (headerFile) {
      headerFile.println("Timestamp,VD1");
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
    // Capture RSSI immediately after receiving packet
    int rssiValue = LoRa.packetRssi();
    
    if (incoming.startsWith("TIME:")) {
      lastTimestamp = incoming.substring(5);  // Store time (without "TIME:")
    } else if (incoming == myID) {
      // Simulate sensor value (replace with real sensor read)
          const int NUM_SAMPLES = 50;  // You can adjust this for speed vs. accuracy
          long totalRaw = 0;
          for (int i = 0; i < NUM_SAMPLES; i++) {
            totalRaw += analogRead(A0);
            delay(2);  // short delay to allow stable reading
          }
          float avgRaw = totalRaw / (float)NUM_SAMPLES;
          float v_adc = (avgRaw * 3.3) / 4095.0;
           float VD1value = v_adc * 78.8;  // voltage divider gain
      // Construct CSV line using stored timestamp
      String csvLine = lastTimestamp;
      csvLine += "," + String(VD1value) ;
      // Save CSV line to SD card
      bool written = false;
      for (int attempt = 1; attempt <= 3; attempt++) {
        File dataFile = sd.open("VD1.CSV", O_WRITE | O_CREAT | O_APPEND);
        if (dataFile) {
          dataFile.println(csvLine);
          dataFile.close();
          written = true;
          break;
        } else {
          Serial.print("Attempt ");
          Serial.print(attempt);
          Serial.println(": Failed to open VD1.CSV for writing.");
          delay(5);
        }
      }
      if (!written) {
        Serial.println("Error: All 3 attempts to write to SD card failed.");
      }
      // Fixed BattS parameter
      int battS = 100;
      // Send data to master over LoRa
      LoRa.beginPacket();
      LoRa.print(VD1value, 4);  // send VD1value with 4 decimal places
      LoRa.print(",");
      LoRa.print(battS);        // send BattS parameter (fixed = 100)
      LoRa.print(",");
      LoRa.print(rssiValue);    // send RSSI value
      LoRa.endPacket();
    }
  }
}
