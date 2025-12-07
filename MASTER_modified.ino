// --------------------------- MASTER (SD-CONFIG VERSION) ---------------------------
#include <LoRa.h>
#include <Wire.h>
#include <RTClib.h>
#include <SPI.h>
#include <SdFat.h>

// RTC object
RTC_DS3231 rtc;

// LoRa module pins (SPI1)
#define LORA_CS     PA4
#define LORA_RST    PA3
#define LORA_DIO0   PA2

// SD card on SPI2
#define SD_CS PB12
SPIClass SPI_2(PB15, PB14, PB13);
SdFat sd;
SdSpiConfig sdConfig(SD_CS, DEDICATED_SPI, SD_SCK_MHZ(10), &SPI_2);

// ---------------------- Dynamic Measurement Box Structure -----------------------
struct MB {
  String id;
  int fieldsCount;
  String fieldNames[20];
};

MB MBs[20];
int MB_count = 0;
int loopDelaySec = 10;

// ---------------------- CSV File -----------------------
const char* DATA_FILENAME = "DATA.CSV";

// ---------------------- Helpers -----------------------
void clearMBs() {
  MB_count = 0;
  loopDelaySec = 10;
}

void writeHeaderIfNeeded() {
  if (!sd.exists(DATA_FILENAME)) {
    File f = sd.open(DATA_FILENAME, O_WRITE | O_CREAT);
    if (!f) {
      Serial.println("ERR: cannot open DATA.CSV for header");
      return;
    }

    f.print("Timestamp");
    for (int i = 0; i < MB_count; i++) {
      for (int j = 0; j < MBs[i].fieldsCount; j++) {
        f.print(",");
        f.print(MBs[i].fieldNames[j]);
      }
    }
    f.println();
    f.close();
    Serial.println("CSV header written.");
  }
}

// -------------- Process a CONFIG line -----------------
bool processConfigLine(const String &line) {
  if (!line.startsWith("CONFIG:")) return false;

  String payload = line.substring(7);
  payload.trim();
  if (payload.length() == 0) return false;

  if (payload.startsWith("DELAY=")) {
    String v = payload.substring(6);
    v.trim();
    int val = v.toInt();
    if (val > 0) loopDelaySec = val;
    return true;
  }

  int firstComma = payload.indexOf(',');
  if (firstComma == -1) {
    MB &m = MBs[MB_count++];
    m.id = payload;
    m.fieldsCount = 0;
    return true;
  }

  MB &m = MBs[MB_count++];
  m.id = payload.substring(0, firstComma);
  String rest = payload.substring(firstComma + 1);
  rest.trim();

  int fIndex = 0;
  while (rest.length() > 0 && fIndex < 20) {
    int comma = rest.indexOf(',');
    if (comma == -1) {
      m.fieldNames[fIndex++] = rest;
      break;
    }
    m.fieldNames[fIndex++] = rest.substring(0, comma);
    rest = rest.substring(comma + 1);
    rest.trim();
  }
  m.fieldsCount = fIndex;
  return true;
}

// ------------------- Load CONFIG from SD -------------------
bool loadConfigFromSD() {
  if (!sd.exists("CONFIG.TXT")) {
    Serial.println("CONFIG.TXT not found on SD!");
    return false;
  }

  File f = sd.open("CONFIG.TXT");
  if (!f) {
    Serial.println("Failed to open CONFIG.TXT");
    return false;
  }

  Serial.println("Loading configuration from SD...");
  clearMBs();

  while (f.available()) {
    String line = f.readStringUntil('\n');
    line.trim();
    if (line.length() == 0) continue;

    if (line.equalsIgnoreCase("CONFIG:END")) {
      Serial.println("CONFIG load finished.");
      f.close();
      return true;
    }

    bool ok = processConfigLine(line);
    if (!ok) {
      Serial.print("Bad config line: ");
      Serial.println(line);
    } else {
      Serial.print("CONFIG OK: ");
      Serial.println(line);
    }
  }

  f.close();
  Serial.println("CONFIG:END missing.");
  return false;
}

// ----------------------- Setup --------------------------------------------------
void setup() {
  Serial.begin(9600);
  while (!Serial) { delay(10); }

  // LoRa
  LoRa.setPins(LORA_CS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(433E6)) {
    Serial.println("LoRa init failed!");
    while (1);
  }
  LoRa.setFrequency(433E6);              // SX1278 sweet spot
  LoRa.setSpreadingFactor(12);           // SF12 → longest range
  LoRa.setSignalBandwidth(125E3);        // Narrow BW → higher sensitivity
  LoRa.setCodingRate4(8);                // Maximum error correction
  LoRa.setPreambleLength(12);            // Good reliable lock
  LoRa.enableCrc();                      // Avoid corrupted packets
  LoRa.setTxPower(18, PA_OUTPUT_PA_BOOST_PIN);  // Correct limit for RA-02

  // RTC
  Wire.begin();
  if (!rtc.begin()) {
    Serial.println("Couldn't find RTC");
    while (1);
  }
  if (rtc.lostPower())
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));

  // SD
  if (!sd.begin(sdConfig)) {
    Serial.println("SD card failed!");
    while (1);
  }

  // Load configuration from SD card
  bool ok = loadConfigFromSD();
  if (!ok) {
    Serial.println("Using default config!");
  }

  // Create CSV header if needed
  writeHeaderIfNeeded();

  Serial.print("Loaded MB count: ");
  Serial.println(MB_count);

  Serial.print("Loop delay (s): ");
  Serial.println(loopDelaySec);
}

// ----------------------- Main Loop ----------------------------------------------
void loop() {
  DateTime now = rtc.now();

  char timeBuf[25];
  snprintf(timeBuf, sizeof(timeBuf), "%04d-%02d-%02d %02d:%02d:%02d",
           now.year(), now.month(), now.day(),
           now.hour(), now.minute(), now.second());

  String csvLine = timeBuf;

  // Broadcast timestamp
  LoRa.beginPacket();
  LoRa.print("TIME:");
  LoRa.print(timeBuf);
  LoRa.endPacket();
  delay(100);

  // Query each measurement box
  for (int i = 0; i < MB_count; i++) {
    String values = "";
    bool got = false;

    for (int attempt = 0; attempt < 3 && !got; attempt++) {
      LoRa.beginPacket();
      LoRa.print(MBs[i].id);
      LoRa.endPacket();

      long t0 = millis();
      while (millis() - t0 < 2500) {  // Increased timeout for SF12 (slower transmission)
        int p = LoRa.parsePacket();
        if (p) {
          while (LoRa.available()) values += (char)LoRa.read();
          got = true;
          break;
        }
      }
    }

    if (!got) {
      values = "";
      for (int x = 0; x < MBs[i].fieldsCount; x++) {
        if (x > 0) values += ",";
        values += "NaN";
      }
    }

    csvLine += ",";
    csvLine += values;
  }

  // Write to SD
  File f = sd.open(DATA_FILENAME, O_WRITE | O_APPEND);
  if (f) {
    f.println(csvLine);
    f.close();
  } else {
    Serial.println("ERR: unable to append to DATA.CSV");
  }

  Serial.println(csvLine);

  delay(loopDelaySec * 1000);
}
