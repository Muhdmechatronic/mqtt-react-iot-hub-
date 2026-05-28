/*
 * VirtualPins — MyIoTSDK Example
 * ================================
 * Demonstrates full BIDIRECTIONAL virtual pin communication:
 *
 *   WRITE (device → server)
 *     V0 → temperature  (Gauge / Line Chart)
 *     V1 → humidity     (Progress Bar)
 *
 *   READ + CALLBACK (server → device)
 *     V2 → fan speed set from a dashboard Slider → adjusts LED PWM brightness
 *     V3 → relay state set from a dashboard Switch → toggles GPIO 26
 *
 * Dashboard setup:
 *   1. Create a Device → copy API Key below.
 *   2. Create Datastreams:
 *        V0  temperature  double  °C    min=0   max=50
 *        V1  humidity     double  %     min=0   max=100
 *        V2  fan_speed    double  %     min=0   max=100
 *        V3  relay        integer       min=0   max=1
 *   3. In Sandbox, add:
 *        V0 → Gauge or Line Chart
 *        V1 → Progress Bar
 *        V2 → Slider widget (move it to control the onboard LED brightness)
 *        V3 → Switch widget (toggle it to control GPIO 26)
 *   4. Save and flash this sketch.
 *
 * Hardware:
 *   GPIO 2  → Built-in LED (PWM, brightness = fan speed from dashboard)
 *   GPIO 26 → Relay or external LED (on/off from dashboard Switch)
 */

#include <Arduino.h>
#include <math.h>
#include <MyIoTSDK.h>

// ── Configuration ─────────────────────────────────────────────────────────────
const char* WIFI_SSID   = "YourWiFiSSID";
const char* WIFI_PASS   = "YourWiFiPassword";
const char* SERVER_HOST = "192.168.1.100";
const char* API_KEY     = "paste-your-api-key-here";

// GPIO
const int GPIO_LED_PWM = 2;    // built-in LED on most ESP32 devkits
const int GPIO_RELAY   = 26;

// ESP32 PWM channel for the LED
const int LEDC_CH   = 0;
const int LEDC_FREQ = 5000;
const int LEDC_BITS = 8;       // duty range 0–255

// ─────────────────────────────────────────────────────────────────────────────
unsigned long lastWrite = 0;

// Called by MyIoT.loop() whenever the dashboard Slider changes V2.
// Applies the new fan-speed value directly to the onboard LED brightness.
void onFanSpeed(float percent) {
  uint8_t duty = (uint8_t)(percent * 2.55f);   // 0-100 % → 0-255
  ledcWrite(LEDC_CH, duty);
  Serial.printf("[V2 IN] Fan speed = %.0f%%  →  LED duty %u\n", percent, duty);
}

// Called by MyIoT.loop() whenever the dashboard Switch changes V3.
void onRelay(float value) {
  bool on = (value > 0.5f);
  digitalWrite(GPIO_RELAY, on ? HIGH : LOW);
  Serial.printf("[V3 IN] Relay = %s\n", on ? "ON" : "OFF");
}

// ─────────────────────────────────────────────────────────────────────────────
void setup()
{
  Serial.begin(115200);
  delay(300);
  Serial.println("=== VirtualPins Example ===");

  // GPIO setup
  pinMode(GPIO_RELAY, OUTPUT);
  digitalWrite(GPIO_RELAY, LOW);

  ledcSetup(LEDC_CH, LEDC_FREQ, LEDC_BITS);
  ledcAttachPin(GPIO_LED_PWM, LEDC_CH);
  ledcWrite(LEDC_CH, 0);

  // Connect
  MyIoT.begin(WIFI_SSID, WIFI_PASS);
  MyIoT.connect(API_KEY, SERVER_HOST);

  // Register inbound pin callbacks — MyIoT.loop() fires these when the
  // server value changes (polled every 2 seconds via HTTP GET).
  MyIoT.onPin(2, onFanSpeed);   // V2: fan speed from dashboard Slider
  MyIoT.onPin(3, onRelay);      // V3: relay from dashboard Switch
}

// ─────────────────────────────────────────────────────────────────────────────
void loop()
{
  // Drives MQTT keepalive, Wi-Fi reconnect, pin polling, and callbacks.
  MyIoT.loop();

  // Write V0 + V1 every 3 seconds
  if (millis() - lastWrite >= 3000) {
    lastWrite = millis();
    float nowSec = millis() / 1000.0f;

    // Simulate sensors
    float temp = 25.0f + 5.0f * sinf(nowSec / 20.0f);
    float humi = 60.0f + 20.0f * cosf(nowSec / 15.0f);

    // Batch write — single HTTP POST for both sensors
    const int   pins[]   = { 0, 1 };
    const float values[] = { temp, humi };
    const char* units[]  = { "\xC2\xB0""C", "%" };
    bool ok = MyIoT.writePins(pins, values, 2, units);

    Serial.printf("[OUT] V0=%.1f°C  V1=%.1f%%  %s\n", temp, humi, ok ? "OK" : "FAIL");
  }
}
