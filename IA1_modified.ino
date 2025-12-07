//------------------------------------IA1--------------------------------------------
#include <SPI.h>
#include <LoRa.h>
#include <SdFat.h>
#include <Wire.h>

// PA0 is used to measure current (ADC)

// LoRa pins
#define LORA_CS     PA4
#define LORA_RST    PA3
#define LORA_DIO0   PA2

// Slave ID
const String myID = "IA1";  // Unique ID for this slave

// SD card pins and SPI2 configuration
#define SD_CS PB12
SPIClass SPI_2(PB15, PB14, PB13);  // SPI2: MOSI, MISO, SCK
SdFat sd;
SdSpiConfig sdConfig(SD_CS, DEDICATED_SPI, SD_SCK_MHZ(10), &SPI_2);  // SPI2 config

String lastTimestamp = "0000-00-00 00:00:00";  // to store time received from master

// Calibration variable
bool calibrated = false;

void setup() {
  Serial.begin(9600);
  analogReadResolution(12);
  LoRa.setPins(LORA_CS, LORA_RST, LORA_DIO0);

  if (!LoRa.begin(433E6)) {  // Changed from 525E6 to 433E6 for maximum range
    Serial.println("LoRa init failed!");
    while (1);
  }

  // LoRa configuration for maximum range
  LoRa.setSpreadingFactor(12);      // SF12 → longest range
  LoRa.setSignalBandwidth(125E3);   // Narrow BW → higher sensitivity
  LoRa.setCodingRate4(8);           // Maximum error correction
  LoRa.setPreambleLength(12);       // Good reliable lock
  LoRa.enableCrc();                 // Avoid corrupted packets
  LoRa.setTxPower(18, PA_OUTPUT_PA_BOOST_PIN); // Correct limit for RA-02

  // Init SD card on SPI2
  if (!sd.begin(sdConfig)) {
    Serial.println("SD Card init failed!");
    while (1);
  }
  Serial.println("SD Card initialized on SPI2.");

  // Write CSV header if file doesn't exist
  if (!sd.exists("IA1.CSV")) {
    File headerFile = sd.open("IA1.CSV", O_WRITE | O_CREAT | O_APPEND);
    if (headerFile) {
      headerFile.println("Timestamp,IA1");
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

    // Capture RSSI from the received packet
    int rssiValue = LoRa.packetRssi();

    if (incoming.startsWith("TIME:")) {
      lastTimestamp = incoming.substring(5);
      if (!calibrated) {
        calibrated = true;  // Calibrate once at the first TIME message, no delay
      }

    } else if (incoming == myID && calibrated) {
      // Perform the measurement only after calibration is done

      // ----------- RMS Current Measurement (SCT-013-030) -----------
      float voltage, centered, sumSq = 0;
      const float Vref = 3.33;
      const float sensitivity = 0.033;  // V/A for SCT-013-030

      // Calculate actual ADC offset voltage dynamically
      long rawSum = 0;
      const int offsetSamples = 1500;
      for (int i = 0; i < offsetSamples; i++) {
        rawSum += analogRead(PA0);
        delayMicroseconds(100);
      }
      float avgRaw = rawSum / (float)offsetSamples;
      float offsetVoltage = (avgRaw * Vref) / 4095.0;  // measured ADC offset voltage

      // Calculate RMS current using offsetVoltage as center
      const int rmsSamples =1500;
      sumSq = 0;
      for (int i = 0; i < rmsSamples; i++) {
        int raw = analogRead(PA0);
        voltage = (raw * Vref) / 4095.0;
        centered = voltage - offsetVoltage;
        sumSq += centered * centered;
        delayMicroseconds(100);
      }
      float Vrms = sqrt(sumSq / rmsSamples);
      float IA1value = 1.77*Vrms / sensitivity  ;

      // -------------------------------------------------------------

      // Construct CSV line using stored timestamp
      String csvLine = lastTimestamp;
      csvLine += "," + String(IA1value, 4);

      // Save CSV line to SD card
      bool written = false;
      for (int attempt = 1; attempt <= 3; attempt++) {
        File dataFile = sd.open("IA1.CSV", O_WRITE | O_CREAT | O_APPEND);
        if (dataFile) {
          dataFile.println(csvLine);
          dataFile.close();
          written = true;
          break;
        } else {
          Serial.print("Attempt ");
          Serial.print(attempt);
          Serial.println(": Failed to open IA1.CSV for writing.");
          delay(5);
        }
      }

      if (!written) {
        Serial.println("Error: All 3 attempts to write to SD card failed.");
      }

      // Send data to master over LoRa: IA1value, BattS (fixed=100), and RSSI
      LoRa.beginPacket();
      LoRa.print(IA1value, 4);  // send IA1value with 4 decimal places
      LoRa.print(",");
      LoRa.print(100);          // send BattS (fixed value = 100)
      LoRa.print(",");
      LoRa.print(rssiValue);    // send RSSI value
      LoRa.endPacket();

      // reset calibration flag to prevent repeat measurement until next timestamp
      calibrated = false;
    }
  }
}
