/*
 * BasicSensor — MyIoTSDK Example
 * ================================
 * Sends a simulated temperature reading to the platform every 5 seconds.
 * Uses writePin() on V0 so it appears on a Gauge or Line Chart widget.
 *
 * Dashboard setup:
 *   1. Create a Device → copy API Key below.
 *   2. Datastream V0: name=temperature, type=double, unit=°C, min=0, max=50.
 *   3. Add a Gauge widget linked to V0 and save the dashboard.
 *   4. Flash this sketch and watch the gauge move.
 *
 * Hardware: any ESP32 devkit (no wiring required for this example).
 */

#include <MyIoTSDK.h>

// ── Configuration ─────────────────────────────────────────────────────────────
const char* WIFI_SSID     = "YourWiFiSSID";
const char* WIFI_PASS     = "YourWiFiPassword";
const char* SERVER_HOST   = "192.168.1.100";   // IP of your IoT Platform server
const char* API_KEY       = "paste-your-api-key-here";

// V0: temperature (°C).  Create this datastream in the platform first.
const int   TEMP_PIN      = 0;

// ─────────────────────────────────────────────────────────────────────────────
unsigned long lastSend = 0;

void setup()
{
  Serial.begin(115200);
  delay(300);
  Serial.println("=== BasicSensor Example ===");

  MyIoT.begin(WIFI_SSID, WIFI_PASS);
  MyIoT.connect(API_KEY, SERVER_HOST);
}

void loop()
{
  // Always call MyIoT.loop() first — it manages MQTT, Wi-Fi, and pin polling.
  MyIoT.loop();

  // Send temperature every 5 seconds
  if (millis() - lastSend >= 5000) {
    lastSend = millis();

    // Simulate a temperature reading (replace with your actual sensor)
    float temperature = 22.0f + 3.0f * sinf(millis() / 10000.0f);

    bool ok = MyIoT.writePin(TEMP_PIN, temperature, "\xC2\xB0""C");  // °C in UTF-8
    Serial.printf("[Sensor] V%d = %.1f°C  %s\n",
                  TEMP_PIN, temperature, ok ? "OK" : "FAILED");
  }
}
