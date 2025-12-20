//------------------------------------INVD--------------------------------------------
#include <SPI.h>
#include <LoRa.h>
#include <SdFat.h>
#include <Wire.h>
#include <ModbusMaster.h>

// LoRa pins
#define LORA_CS     PA4
#define LORA_RST    PA3
#define LORA_DIO0   PA2

// RS485 communication for inverter
#define RS485_SERIAL Serial1
ModbusMaster node;

// Slave ID
const String myID = "INVD";  // Unique ID for this slave

// SD card pins and SPI2 configuration
#define SD_CS PB12
SPIClass SPI_2(PB15, PB14, PB13);  // SPI2: MOSI, MISO, SCK
SdFat sd;
SdSpiConfig sdConfig(SD_CS, DEDICATED_SPI, SD_SCK_MHZ(10), &SPI_2);

String lastTimestamp = "0000-00-00 00:00:00";

void setup() {
  Serial.begin(9600);
  RS485_SERIAL.begin(9600);
  node.begin(1, RS485_SERIAL);  // inverter slave ID = 1

  analogReadResolution(12);
  LoRa.setPins(LORA_CS, LORA_RST, LORA_DIO0);

  if (!LoRa.begin(433E6)) {
    Serial.println("LoRa init failed!");
    while (1);
  }

  // LoRa configuration (same as ID3)
  LoRa.setFrequency(433E6);           // SX1278 sweet spot
  LoRa.setSpreadingFactor(8);         // SF8 → balanced speed and range
  LoRa.setSignalBandwidth(125E3);     // 125kHz → good reliability
  LoRa.setCodingRate4(5);             // CR4/5 → less overhead, faster
  LoRa.setPreambleLength(8);          // Standard preamble
  LoRa.enableCrc();                   // Avoid corrupted packets
  LoRa.setTxPower(17, PA_OUTPUT_PA_BOOST_PIN);  // 17dBm for moderate range

  if (!sd.begin(sdConfig)) {
    Serial.println("SD Card init failed!");
    while (1);
  }
  Serial.println("SD Card initialized on SPI2.");

  if (!sd.exists("INVD.CSV")) {
    File headerFile = sd.open("INVD.CSV", O_WRITE | O_CREAT | O_APPEND);
    if (headerFile) {
      headerFile.println("Timestamp,PV1_V,PV1_I,PV2_V,PV2_I,Vbat,Ibat,Vout,Iout,Pout,BattS,RSSI");
      headerFile.close();
    }
  }
}

float readScaledRegister(uint16_t reg, float scale) {
  uint8_t result = node.readInputRegisters(reg, 1);
  if (result == node.ku8MBSuccess) {
    return node.getResponseBuffer(0) * scale;
  } else {
    Serial.print("❌ Error reading register ");
    Serial.print(reg);
    Serial.print(" Code: ");
    Serial.println(result, HEX);
    return -1.0;
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
      lastTimestamp = incoming.substring(5);
    } else if (incoming == myID) {
      float Vbat  = readScaledRegister(17, 0.01);     delay(1);
      float Vout  = readScaledRegister(22, 0.1);      delay(1);
      float Pout  = readScaledRegister(70, 0.1);      delay(1);
      float Iout  = readScaledRegister(1034, 0.1);    delay(1);
      float Ibat  = readScaledRegister(84, 0.1);      delay(1);
      float PV1_V = readScaledRegister(110, 0.1);     delay(1);
      float PV1_I = readScaledRegister(111, 0.1);     delay(1);
      float PV2_V = readScaledRegister(112, 0.1);     delay(1);
      float PV2_I = readScaledRegister(113, 0.1);     delay(1);

      // Fixed BattS parameter
      int battS = 100;

      String csvLine = lastTimestamp;
      csvLine += "," + String(PV1_V, 2);
      csvLine += "," + String(PV1_I, 2);
      csvLine += "," + String(PV2_V, 2);
      csvLine += "," + String(PV2_I, 2);
      csvLine += "," + String(Vbat, 2);
      csvLine += "," + String(Ibat, 2);
      csvLine += "," + String(Vout, 2);
      csvLine += "," + String(Iout, 2);
      csvLine += "," + String(Pout, 2);
      csvLine += "," + String(battS);
      csvLine += "," + String(rssiValue);

      bool written = false;
      for (int attempt = 1; attempt <= 3; attempt++) {
        File dataFile = sd.open("INVD.CSV", O_WRITE | O_CREAT | O_APPEND);
        if (dataFile) {
          dataFile.println(csvLine);
          dataFile.close();
          written = true;
          break;
        } else {
          Serial.print("Attempt ");
          Serial.print(attempt);
          Serial.println(": Failed to open INVD.CSV for writing.");
          delay(5);
        }
      }

      if (!written) {
        Serial.println("Error: All 3 attempts to write to SD card failed.");
      }

      // ✅ Send measurements via LoRa (including BattS and RSSI)
      String dataToSend = String(PV1_V, 4) + "," + String(PV1_I, 4) + "," +
                          String(PV2_V, 4) + "," + String(PV2_I, 4) + "," +
                          String(Vbat, 4)  + "," + String(Ibat, 4)  + "," +
                          String(Vout, 4)  + "," + String(Iout, 4)  + "," +
                          String(Pout, 4)  + "," + String(battS)    + "," +
                          String(rssiValue);

      LoRa.beginPacket();
      LoRa.print(dataToSend);
      LoRa.endPacket();

      Serial.println("📡 Sent over LoRa: " + dataToSend);
    }
  }
}
