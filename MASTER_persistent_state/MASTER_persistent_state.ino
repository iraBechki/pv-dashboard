// --------------------------- MASTER (START/STOP WITH PERSISTENT STATE) ---------------------------
#include <LoRa.h>
#include <Wire.h>
#include <RTClib.h>
#include <SPI.h>
#include <SdFat.h>

// RTC object
RTC_DS3231 rtc;

// LoRa module pins (SPI1) - adjust if needed
#define LORA_CS     PA4
#define LORA_RST    PA3
#define LORA_DIO0   PA2

// SD card setup on SPI2 - adjust pins to your wiring
#define SD_CS PB12
SPIClass SPI_2(PB15, PB14, PB13);
SdFat sd;
SdSpiConfig sdConfig(SD_CS, DEDICATED_SPI, SD_SCK_MHZ(10), &SPI_2);

// ---------------------- Dynamic Measurement Box Structure -----------------------
struct MB {
  String id;                    // LoRa ID
  int fieldsCount;              // Number of expected values
  String fieldNames[20];        // CSV column names
};

MB MBs[20];                     // max 20 measurement boxes
int MB_count = 0;
int loopDelaySec = 10;          // default

// ---------------------- SD file names -----------------------
const char* DATA_FILENAME = "DATA.CSV";
const char* CONFIG_FILENAME = "CONFIG.TXT";
const char* CONFIG_HISTORY = "CONFHIST.TXT";
const char* STATE_FILENAME = "STATE.TXT";  // NEW: For persistent state

// ---------------------- Config state -----------------------
bool inConfigMode = false;
bool isRunning = false; // Controls measurement state
String configBuffer = "";
unsigned long lastMeasureTime = 0; // For non-blocking delay

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

bool processConfigLine(const String &line) {
  String payload = line;
  if (line.startsWith("CONFIG:")) {
    payload = line.substring(7);
  }
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
    if (MB_count >= 20) return false;
    MB &m = MBs[MB_count++];
    m.id = payload;
    m.fieldsCount = 0;
    return true;
  }

  if (MB_count >= 20) return false;
  MB &m = MBs[MB_count++];
  m.id = payload.substring(0, firstComma);
  String remaining = payload.substring(firstComma + 1);
  remaining.trim();

  int fIndex = 0;
  while (remaining.length() > 0 && fIndex < 20) {
    int comma = remaining.indexOf(',');
    if (comma == -1) {
      m.fieldNames[fIndex++] = remaining;
      break;
    }
    m.fieldNames[fIndex++] = remaining.substring(0, comma);
    remaining = remaining.substring(comma + 1);
    remaining.trim();
  }
  m.fieldsCount = fIndex;
  return true;
}

void saveConfigToHistory() {
  if (MB_count == 0) return;
  
  DateTime now = rtc.now();
  char timeBuf[25];
  snprintf(timeBuf, sizeof(timeBuf), "%04d-%02d-%02d %02d:%02d:%02d",
           now.year(), now.month(), now.day(),
           now.hour(), now.minute(), now.second());
  
  File hist = sd.open(CONFIG_HISTORY, O_WRITE | O_APPEND | O_CREAT);
  if (hist) {
    hist.println("# CONFIG SAVED AT: " + String(timeBuf));
    hist.println("CONFIG:DELAY=" + String(loopDelaySec));
    for (int i = 0; i < MB_count; i++) {
      hist.print(MBs[i].id);
      for (int j = 0; j < MBs[i].fieldsCount; j++) {
        hist.print(",");
        hist.print(MBs[i].fieldNames[j]);
      }
      hist.println();
    }
    hist.println("# END CONFIG");
    hist.println();
    hist.close();
    Serial.println("Config saved to history");
  }
}

void saveConfigToSD() {
  File f = sd.open(CONFIG_FILENAME, O_WRITE | O_CREAT | O_TRUNC);
  if (!f) {
    Serial.println("ERR: cannot save config to SD");
    return;
  }
  
  f.println("CONFIG:DELAY=" + String(loopDelaySec));
  for (int i = 0; i < MB_count; i++) {
    f.print(MBs[i].id);
    for (int j = 0; j < MBs[i].fieldsCount; j++) {
      f.print(",");
      f.print(MBs[i].fieldNames[j]);
    }
    f.println();
  }
  f.close();
  Serial.println("Config saved to SD");
}

bool loadConfigFromSD() {
  if (!sd.exists(CONFIG_FILENAME)) {
    Serial.println("No config file on SD");
    return false;
  }
  
  File f = sd.open(CONFIG_FILENAME, O_READ);
  if (!f) {
    Serial.println("ERR: cannot read config from SD");
    return false;
  }
  
  clearMBs();
  Serial.println("Loading config from SD...");
  
  while (f.available()) {
    String line = f.readStringUntil('\n');
    line.trim();
    if (line.length() == 0 || line.startsWith("#")) continue;
    
    if (line.startsWith("CONFIG:DELAY=") || line.startsWith("DELAY=")) {
      processConfigLine(line);
    } else {
      processConfigLine(line);
    }
  }
  f.close();
  
  Serial.print("Loaded ");
  Serial.print(MB_count);
  Serial.println(" MBs from SD");
  return true;
}

// ---------------------- NEW: State Persistence Functions -----------------------
void saveStateToSD() {
  File f = sd.open(STATE_FILENAME, O_WRITE | O_CREAT | O_TRUNC);
  if (!f) {
    Serial.println("ERR: cannot save state to SD");
    return;
  }
  f.println(isRunning ? "RUNNING" : "STOPPED");
  f.close();
  Serial.print("State saved: ");
  Serial.println(isRunning ? "RUNNING" : "STOPPED");
}

bool loadStateFromSD() {
  if (!sd.exists(STATE_FILENAME)) {
    Serial.println("No state file on SD - defaulting to STOPPED");
    isRunning = false;
    return false;
  }
  
  File f = sd.open(STATE_FILENAME, O_READ);
  if (!f) {
    Serial.println("ERR: cannot read state from SD");
    isRunning = false;
    return false;
  }
  
  String state = f.readStringUntil('\n');
  state.trim();
  f.close();
  
  isRunning = state.equalsIgnoreCase("RUNNING");
  Serial.print("Loaded state from SD: ");
  Serial.println(isRunning ? "RUNNING" : "STOPPED");
  return true;
}
// -------------------------------------------------------------------------------

void checkSerialConfig() {
  while (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    
    if (line.length() == 0) continue;
    
    Serial.println(line); // Echo back
    Serial.flush();

    // --- Handle Start/Stop Commands with State Persistence ---
    if (line.equalsIgnoreCase("CMD:START")) {
      isRunning = true;
      saveStateToSD();  // Save state to SD
      Serial.println("STATUS:RUNNING");
      return;
    }
    if (line.equalsIgnoreCase("CMD:STOP")) {
      isRunning = false;
      saveStateToSD();  // Save state to SD
      Serial.println("STATUS:STOPPED");
      return;
    }
    // ---------------------------------------------------------
    
    if (line.equalsIgnoreCase("CONFIG:START")) {
      inConfigMode = true;
      configBuffer = "";
      Serial.println("READY FOR CONFIG");  // Send response immediately
      Serial.flush();
      if (MB_count > 0) saveConfigToHistory();  // Do SD operations after response
      clearMBs();
      continue;
    }
    
    if (line.equalsIgnoreCase("CONFIG:END")) {
      if (inConfigMode) {
        inConfigMode = false;
        saveConfigToSD();
        if (sd.exists(DATA_FILENAME)) sd.remove(DATA_FILENAME);
        writeHeaderIfNeeded();
        Serial.println("CONFIG APPLIED");
        Serial.print("MB count: ");
        Serial.println(MB_count);
        Serial.print("Loop delay: ");
        Serial.println(loopDelaySec);
        
        // Reset timer so we measure immediately after config
        lastMeasureTime = millis() - (loopDelaySec * 1000); 
      } else {
        Serial.println("WARN: CONFIG:END without START");
      }
      continue;
    }
    
    if (inConfigMode) {
      bool ok = processConfigLine(line);
      if (!ok) {
        Serial.print("WARN: bad config line: ");
        Serial.println(line);
      }
      // Note: Echo already sent at line 245, so no need to echo again here
    }
  }
}

// ----------------------- Setup --------------------------------------------------
void setup() {
  Serial.begin(9600);
  while (!Serial) { delay(10); }
  
  Serial.println("STM32 Master Ready");

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
  Serial.println("LoRa OK");

  Wire.begin();
  if (!rtc.begin()) {
    Serial.println("Couldn't find RTC");
    while (1);
  }
  if (rtc.lostPower()) rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  Serial.println("RTC OK");

  if (!sd.begin(sdConfig)) {
    Serial.println("SD card failed!");
    while (1);
  }
  Serial.println("SD OK");

  bool loadedFromSD = loadConfigFromSD();
  if (!loadedFromSD) {
    Serial.println("No config on SD - waiting for serial config");
  } else {
    writeHeaderIfNeeded();
  }
  
  // NEW: Load persistent state from SD
  loadStateFromSD();
  
  Serial.print("Current MB count: ");
  Serial.println(MB_count);
  Serial.print("Loop delay (s): ");
  Serial.println(loopDelaySec);
  Serial.print("Current state: ");
  Serial.println(isRunning ? "RUNNING" : "STOPPED");
  Serial.println("Ready - send CONFIG:START to update");
  
  lastMeasureTime = millis();
}

// ----------------------- Main Loop ----------------------------------------------
void loop() {
  // 1. Always check for serial config (FAST)
  checkSerialConfig();

  // 2. Check if Running
  if (!isRunning) return;
  
  // 3. Non-blocking delay check
  if (millis() - lastMeasureTime < (loopDelaySec * 1000UL)) {
    return; // Not time yet, go back to checking serial
  }
  
  // It's time to measure!
  lastMeasureTime = millis();

  if (MB_count == 0) return;
  
  DateTime now = rtc.now();
  char timeBuf[25];
  snprintf(timeBuf, sizeof(timeBuf), "%04d-%02d-%02d %02d:%02d:%02d",
           now.year(), now.month(), now.day(),
           now.hour(), now.minute(), now.second());

  String csvLine = timeBuf;

  LoRa.beginPacket();
  LoRa.print("TIME:");
  LoRa.print(timeBuf);
  LoRa.endPacket();
  delay(100); // Short delay for LoRa is fine

  for (int i = 0; i < MB_count; i++) {
    // Check serial again between measurements to be responsive
    checkSerialConfig();
    if (inConfigMode) return; // Abort measurement if config started

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

  File f = sd.open(DATA_FILENAME, O_WRITE | O_APPEND);
  if (f) {
    f.println(csvLine);
    f.close();
  } else {
    Serial.println("ERR: unable to append to DATA.CSV");
  }

  Serial.println(csvLine);
}
