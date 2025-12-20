#include <SPI.h>
#include <LoRa.h>
#include <SdFat.h>
#include <Wire.h>
#include <Adafruit_ADS1X15.h>

#include <OneWire.h>
#include <DallasTemperature.h>

// DS18B20 setup
#define ONE_WIRE_BUS PA0  // ds18b20
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature ds18b20(&oneWire);

Adafruit_ADS1115 ads;

// LoRa pins
#define LORA_CS     PA4
#define LORA_RST    PA3
#define LORA_DIO0   PA2

// Slave ID
const String myID = "ID1";  // Unique ID for this slave

// SD card pins and SPI2 configuration
#define SD_CS PB12
SPIClass SPI_2(PB15, PB14, PB13);  // SPI2: MOSI, MISO, SCK
SdFat sd;
SdSpiConfig sdConfig(SD_CS, DEDICATED_SPI, SD_SCK_MHZ(10), &SPI_2);  // SPI2 config

String lastTimestamp = "0000-00-00 00:00:00";  // to store time received from master
int rssiValue = 0;  // to store RSSI value

void setup() {
  Serial.begin(9600);
  LoRa.setPins(LORA_CS, LORA_RST, LORA_DIO0);

  if (!LoRa.begin(433E6)) {  // SX1278 sweet spot
    Serial.println("LoRa init failed!");
    while (1);
  }

  // LoRa configuration for balanced range and speed (Option 1)
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
  if (!sd.exists("ID1.CSV")) {
    File headerFile = sd.open("ID1.CSV", O_WRITE | O_CREAT | O_APPEND);
    if (headerFile) {
      headerFile.println("Timestamp,ID1,T_m");
      headerFile.close();
    }
  }
  Wire.begin();  // STM32 I2C: SCL = B6, SDA = B7
  if (!ads.begin()) {
    Serial.println("Failed to initialize ADS1115.");
    while (1);  // Stop execution if ADS fails
  }
  ads.setGain(GAIN_ONE);  // ±4.096V range, 125 µV/bit

  ds18b20.begin();
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
      // Read temperature from DS18B20 (with reduced delay to prevent timeout)
      ds18b20.requestTemperatures();
      delay(100);  // Reduced delay - enough if sensor is working, won't timeout if not
      float T_mvalue = ds18b20.getTempCByIndex(0);
      if (T_mvalue == DEVICE_DISCONNECTED_C || T_mvalue < -55 || T_mvalue > 125) {
        T_mvalue = -127.0;  // Sensor not connected or reading invalid
      }

      // Read current from ADS1115 with multiple samples for stability
      const int numSamples = 20;  // Increased from 10 for better accuracy
      float currentSamples[numSamples];
      
      for (int i = 0; i < numSamples; i++) {
        int16_t rawResult = ads.readADC_Differential_0_1();  // AIN0 - AIN1
        float voltage = rawResult * 0.125 / 1000.0;  // Convert to volts
        currentSamples[i] = voltage * 6.0/0.66*1.06;/ Convert to current in Amperes
        delay(5);  // Reduced delay for faster sampling
      }
      
      // Sort samples and take median for noise rejection
      for (int i = 0; i < numSamples - 1; i++) {
        for (int j = i + 1; j < numSamples; j++) {
          if (currentSamples[i] > currentSamples[j]) {
            float temp = currentSamples[i];
            currentSamples[i] = currentSamples[j];
            currentSamples[j] = temp;
          }
        }
      }
      
      // Average the middle 10 values (discard top 5 and bottom 5) for best stability
      float sum = 0;
      for (int i = 5; i < 15; i++) {  // Middle 10 of 20 samples
        sum += currentSamples[i];
      }
      float ID1value = sum / 10.0;

      // Construct CSV line using stored timestamp
      String csvLine = lastTimestamp;
      csvLine += "," + String(ID1value) + "," + String(T_mvalue);

      // Save CSV line to SD card
      bool written = false;
      for (int attempt = 1; attempt <= 3; attempt++) {
        File dataFile = sd.open("ID1.CSV", O_WRITE | O_CREAT | O_APPEND);
        if (dataFile) {
          dataFile.println(csvLine);
          dataFile.close();
          written = true;
          break;
        } else {
          Serial.print("Attempt ");
          Serial.print(attempt);
          Serial.println(": Failed to open ID1.CSV for writing.");
          delay(5);
        }
      }

      if (!written) {
        Serial.println("Error: All 3 attempts to write to SD card failed.");
      }

      // Send data to master over LoRa
      // Format: ID1value,T_mvalue,BattS,RSSI
      LoRa.beginPacket();
      LoRa.print(ID1value, 4);  // send ID1value with 4 decimal places
      LoRa.print(",");          // separator
      LoRa.print(T_mvalue, 4);  // send T_mvalue with 4 decimal places
      LoRa.print(",");          // separator
      LoRa.print(100);          // BattS fixed value
      LoRa.print(",");          // separator
      LoRa.print(rssiValue);    // RSSI value
      LoRa.endPacket();
    }
  }
}
