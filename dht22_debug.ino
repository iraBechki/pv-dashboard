// DHT22 Debug Sketch using SimpleDHT library
// Based on user's old WS code

#include <SimpleDHT.h>

// NOTE: Your old code used PB1, but your request for the new WS node said PB0.
// Please verify which pin you are actually connected to!
#define DHTPIN PB0     

SimpleDHT22 dht22(DHTPIN);

void setup() {
  Serial.begin(9600);
  while (!Serial) delay(10);
  
  Serial.println("DHT22 Debug Test (SimpleDHT Library)");
  Serial.println("------------------------------------");
  Serial.print("Initializing on pin: ");
  Serial.println(DHTPIN);
}

void loop() {
  Serial.println("=================================");
  Serial.println("Sample DHT22...");
  
  float temperature = 0;
  float humidity = 0;
  int err = SimpleDHTErrSuccess;
  
  // This library returns 0 on success
  if ((err = dht22.read2(&temperature, &humidity, NULL)) != SimpleDHTErrSuccess) {
    Serial.print("Read DHT22 failed, err="); 
    Serial.print(SimpleDHTErrCode(err));
    Serial.print(","); 
    Serial.println(SimpleDHTErrDuration(err));
    delay(2000);
    return;
  }
  
  Serial.print("Sample OK: ");
  Serial.print((float)temperature); Serial.print(" *C, ");
  Serial.print((float)humidity); Serial.println(" RH%");
  
  // DHT22 sampling rate is 0.5Hz (every 2 seconds)
  delay(2500);
}
