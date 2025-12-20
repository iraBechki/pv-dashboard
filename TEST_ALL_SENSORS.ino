//==============================================================================
// TEST_ALL_SENSORS.ino
// STM32 Simulation matching simulate_data.py logic
//==============================================================================
// Configuration provided:
// ID1,I1D,T_m,BattS,Rssi
// ID3,I3D,BattS,Rssi
// VD1,V1D,BattS,Rssi
// VD3,V3D,BattS,Rssi
// IA1,I1A,BattS,Rssi
// VA1,V1A,BattS,Rssi
// INVD,PV1_V,PV1_I,PV2_V,PV2_I,Vbat,Ibat,Vout,Iout,Pout,BattS,Rssi
// WS,G,T_amb,V,Hum,BattS,Rssi
//==============================================================================

void setup() {
  Serial.begin(9600);
  while (!Serial); // Wait for Serial to attach
}

void loop() {
  // Use a dummy timestamp to match the format of simulate_data.py 
  // (Timestamp + all values in single CSV line)
  // Format: YYYY-MM-DD HH:MM:SS
  String timestamp = "2025-01-01 12:00:00";
  
  Serial.print(timestamp);
  Serial.print(",");
  
  // --- ID1: I1D, T_m, BattS, Rssi ---
  // Logic from simulate_data.py:
  // I1D -> 8.5
  // T_m -> 35.0
  // BattS -> 95.0
  // Rssi -> -65.0
  Serial.print("8.5,35.0,95.0,-65.0");
  Serial.print(",");

  // --- ID3: I3D, BattS, Rssi ---
  // I3D -> 15.0
  // BattS -> 95.0
  // Rssi -> -65.0
  Serial.print("15.0,95.0,-65.0");
  Serial.print(",");

  // --- VD1: V1D, BattS, Rssi ---
  // V1D -> 230.0
  // BattS -> 95.0
  // Rssi -> -65.0
  Serial.print("230.0,95.0,-65.0");
  Serial.print(",");

  // --- VD3: V3D, BattS, Rssi ---
  // V3D -> 82.0
  // BattS -> 95.0
  // Rssi -> -65.0
  Serial.print("82.0,95.0,-65.0");
  Serial.print(",");

  // --- IA1: I1A, BattS, Rssi ---
  // I1A -> Matches "I" + "A" -> 10.0
  // BattS -> 95.0
  // Rssi -> -65.0
  Serial.print("10.0,95.0,-65.0");
  Serial.print(",");

  // --- VA1: V1A, BattS, Rssi ---
  // V1A -> Matches "V" + "A" -> 220.0
  // BattS -> 95.0
  // Rssi -> -65.0
  Serial.print("220.0,95.0,-65.0");
  Serial.print(",");

  // --- INVD: PV1_V,PV1_I,PV2_V,PV2_I,Vbat,Ibat,Vout,Iout,Pout,BattS,Rssi ---
  // PV1_V -> 230.0
  // PV1_I -> 8.5
  // PV2_V -> 235.0
  // PV2_I -> 8.8
  // Vbat -> 52.0
  // Ibat -> 15.0
  // Vout -> 220.0
  // Iout -> 20.0
  // Pout -> 4400.0
  // BattS -> 95.0
  // Rssi -> -65.0
  Serial.print("230.0,8.5,235.0,8.8,52.0,15.0,220.0,20.0,4400.0,95.0,-65.0");
  Serial.print(",");

  // --- WS: G, T_amb, V, Hum, BattS, Rssi ---
  // G -> 800.0
  // T_amb -> 28.0
  // V -> Matches no specific rule -> Default 50.0
  // Hum -> 45.0
  // BattS -> 95.0
  // Rssi -> -65.0
  Serial.print("800.0,28.0,50.0,45.0,95.0,-65.0");
  
  // End of line
  Serial.println();
  
  // Wait 2 seconds (matches simulate_data.py loop delay)
  delay(2000);
}
