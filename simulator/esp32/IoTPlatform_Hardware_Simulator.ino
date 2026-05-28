// ============================================================
// IoTPlatform_Hardware_Simulator.ino
// ============================================================
// Full bidirectional test sketch for the IoTPlatform library.
// Reproduces every simulation channel from the Python script
// using non-blocking millis() timers — loop() never blocks.
//
// ─── VIRTUAL PIN ASSIGNMENT ──────────────────────────────────
//
//   V0 → Temperature  WRITE  15→40°C  triangle wave, 60 s
//   V1 → Humidity     WRITE  30→90%   sine wave,     40 s
//   V2 → LED PWM      WRITE  0→100%   triangle wave,  8 s
//              also   READ   dashboard Slider → onboard LED brightness
//   V3 → Relay/Switch WRITE  0↔1      toggle every 4 s
//              also   READ   dashboard Switch  → relay GPIO
//   V4 → Push Button  WRITE  1 for 1 s every 7 s (momentary press)
//
// ─── WEBSITE SETUP (do this before flashing) ─────────────────
//
//   1. Create a Device → copy its API Key into DEVICE_API_KEY.
//   2. Go to Datastreams and create:
//        V0  name=temperature  type=double  unit=°C  min=0  max=50
//        V1  name=humidity     type=double  unit=%   min=0  max=100
//        V2  name=led_pwm      type=double  unit=%   min=0  max=100
//        V3  name=relay        type=integer          min=0  max=1
//        V4  name=button       type=integer          min=0  max=1
//   3. Open Dashboard Sandbox, add widgets linked to those datastreams:
//        V0 → Gauge or Line Chart    (watch temperature ramp)
//        V1 → Gauge or Progress Bar  (watch humidity sine)
//        V2 → LED widget (pwm mode, pwmMin=0, pwmMax=100)
//           + Slider widget  (move it → physical LED on GPIO 2 dims)
//        V3 → Switch widget + LED widget (binary mode)
//           (toggle Switch on dashboard → relay GPIO 26 follows)
//        V4 → LED widget (binary mode) — flashes on each button pulse
//   4. Save the dashboard.
//   5. Edit credentials below, flash, open Serial Monitor at 115200 baud.
//
// ─── HARDWARE WIRING ─────────────────────────────────────────
//
//   GPIO 2  → Built-in LED on most ESP32 devkits; driven by V2 (PWM)
//   GPIO 26 → External LED or relay module;       driven by V3 (digital)
//
// ─── DEPENDENCIES (Arduino Library Manager) ──────────────────
//
//   ArduinoJson  v6.x  (Benoit Blanchon)
//   ESP32 board package ≥ 2.0  (includes WiFi.h, HTTPClient.h)
//
// ============================================================

#include <Arduino.h>
#include <math.h>
#include "IoTPlatform.h"

// ── USER CONFIGURATION — edit these before flashing ──────────
const char*    WIFI_SSID      = "YourWiFiSSID";
const char*    WIFI_PASSWORD  = "YourWiFiPassword";
const char*    SERVER_HOST    = "192.168.1.100";  // LAN IP of Docker host
const uint16_t SERVER_PORT    = 3000;
const char*    DEVICE_API_KEY = "paste-your-32-char-api-key-here";
// ─────────────────────────────────────────────────────────────

// ── GPIO ASSIGNMENTS ─────────────────────────────────────────
const int GPIO_LED_PWM = 2;   // built-in LED; PWM brightness from V2
const int GPIO_RELAY   = 26;  // relay / external LED; state from V3

// ESP32 LEDC PWM channel (0–15 available)
const int  LEDC_CH   = 0;
const int  LEDC_FREQ = 5000;  // 5 kHz carrier
const int  LEDC_BITS = 8;     // 8-bit duty: 0–255

// ── LIBRARY INSTANCE ─────────────────────────────────────────
IoTPlatform iot;

// ── OUTBOUND WRITE TIMERS ─────────────────────────────────────
// Each channel tracks its own last-send timestamp independently.
// None of them block loop() — all use the millis() delta pattern.

uint32_t tSensorBatch = 0;  // V0 + V1 written together every 1000 ms
uint32_t tPwmWrite    = 0;  // V2 PWM written every 200 ms
uint32_t tV3Toggle    = 0;  // V3 toggle timer
int      v3State      = 0;  // current relay state (0 = OFF, 1 = ON)
bool     v4Pressed    = false;
uint32_t tV4          = 0;  // V4 button pulse timer

// ─────────────────────────────────────────────────────────────
// Change callback for V3 (registered with subscribePin).
// Fires inside iot.sync() whenever the server value of V3 changes —
// immediately applies the new state to the relay GPIO with zero polling lag.
// ─────────────────────────────────────────────────────────────
void onV3Changed(int pin, float newValue) {
  bool on = (newValue > 0.5f);
  digitalWrite(GPIO_RELAY, on ? HIGH : LOW);
  Serial.printf("[INBOUND V3] Server relay = %s → GPIO %d %s\n",
    on ? "ON" : "OFF", GPIO_RELAY, on ? "HIGH" : "LOW");
}

// ─────────────────────────────────────────────────────────────
void setup()
{
  Serial.begin(115200);
  delay(300);
  Serial.println();
  Serial.println("=== IoTPlatform Hardware Simulator ===");

  // GPIO setup
  pinMode(GPIO_RELAY, OUTPUT);
  digitalWrite(GPIO_RELAY, LOW);

  // ESP32 LEDC — PWM output for built-in LED (controlled by V2)
  ledcSetup(LEDC_CH, LEDC_FREQ, LEDC_BITS);
  ledcAttachPin(GPIO_LED_PWM, LEDC_CH);
  ledcWrite(LEDC_CH, 0);

  // Connect to Wi-Fi and configure server endpoint
  iot.begin(WIFI_SSID, WIFI_PASSWORD, SERVER_HOST, SERVER_PORT, DEVICE_API_KEY);

  // ── Inbound subscriptions ─────────────────────────────────────────────────

  // V3: relay/switch — callback fires immediately when the dashboard Switch
  //     changes the pin, so the GPIO reacts without waiting for the next poll.
  iot.subscribePin(3, onV3Changed);

  // V2: LED PWM — no callback; loop() reads the cached value and applies it.
  //     This demonstrates the "poll then act" pattern vs the callback pattern.
  iot.subscribePin(2);

  // Poll the server every 2 seconds for all subscribed pins (V2, V3).
  iot.setSyncInterval(2000);

  // ── Stagger initial timers ────────────────────────────────────────────────
  // Offset channels so they don't all fire at t=0 and cause an HTTP burst.
  tSensorBatch = millis();
  tPwmWrite    = millis() + 100;
  tV3Toggle    = millis() + 200;
  tV4          = millis() + 3000;  // first button press after 3 s

  Serial.println("[Setup] Simulation active:");
  Serial.println("  V0 → temperature ramp  15→40°C  (batch with V1, every 1 s)");
  Serial.println("  V1 → humidity sine     30→90%   (batch with V0, every 1 s)");
  Serial.println("  V2 → LED PWM sweep     0→100%   (every 200 ms)");
  Serial.println("  V3 → relay toggle      0↔1      (every 4 s)");
  Serial.println("  V4 → button pulse      1 for 1 s every 7 s");
  Serial.println("  Inbound: V2 → GPIO 2 LED brightness | V3 → GPIO 26 relay");
  Serial.println();
}

// ─────────────────────────────────────────────────────────────
void loop()
{
  uint32_t now    = millis();
  float    nowSec = now / 1000.0f;   // elapsed seconds since boot

  // ─── Inbound: sync() checks Wi-Fi + polls subscribed pins on schedule ──────
  // V3 fires onV3Changed() callback; V2 update is read below via readVirtualPin.
  iot.sync();

  // ─── Inbound: apply server-set V2 (dashboard Slider) to PWM LED ───────────
  // readVirtualPin() is fast — reads the local cache populated by sync().
  // The onboard LED brightness tracks whatever the dashboard Slider is set to.
  //
  // NOTE: This sketch ALSO writes V2 outbound (PWM sweep below).
  //       In a production device, only one side owns a pin:
  //         • Remove the V2 write section if the server controls the LED.
  //         • Remove this subscribePin(2) if the device always drives the LED.
  {
    float serverPwm = iot.readVirtualPin(2, 0.0f);  // 0–100 %
    uint8_t duty    = (uint8_t)(serverPwm * 2.55f); // map 0-100 → 0-255
    ledcWrite(LEDC_CH, duty);
  }

  // ─── V0 + V1: Temperature ramp + Humidity sine — batch write every 1 s ────
  if (now - tSensorBatch >= 1000) {
    tSensorBatch = now;

    // V0: triangle wave  15°C → 40°C → 15°C  over 60 seconds
    float cycle = fmod(nowSec / 60.0f, 2.0f);   // 0.0 → 2.0 repeating
    if (cycle > 1.0f) cycle = 2.0f - cycle;      // fold: 0→1→0
    float temp = 15.0f + 25.0f * cycle;          // 15.0 … 40.0 °C

    // V1: sine wave  30% → 90%  period = 40 seconds
    float humi = 60.0f + 30.0f * sinf(2.0f * PI * nowSec / 40.0f);

    // Single HTTP POST for both pins — saves one round-trip vs two calls
    const int   bPins[2]   = { 0, 1 };
    const float bValues[2] = { temp, humi };
    // °C as UTF-8 (0xC2 0xB0 'C') — ArduinoJson serialises raw bytes as-is
    const char* bUnits[2]  = { "\xC2\xB0""C", "%" };

    if (iot.writeVirtualPins(bPins, bValues, 2, bUnits)) {
      Serial.printf("[V0+V1] temp=%.1f°C  humi=%.1f%%\n", temp, humi);
    }
  }

  // ─── V2: LED PWM outbound sweep — every 200 ms ────────────────────────────
  // Sweeps 0→100→0 in an 8-second triangle wave.
  if (now - tPwmWrite >= 200) {
    tPwmWrite = now;

    float pwmCycle = fmod(nowSec / 8.0f, 2.0f);
    if (pwmCycle > 1.0f) pwmCycle = 2.0f - pwmCycle;
    float pwm = 100.0f * pwmCycle;

    iot.writeVirtualPin(2, pwm, "%");
    // Serial output omitted here to avoid flooding the monitor at 5 Hz
  }

  // ─── V3: Switch / relay toggle — every 4 seconds ──────────────────────────
  if (now - tV3Toggle >= 4000) {
    tV3Toggle = now;
    v3State   = 1 - v3State;  // flip 0→1 or 1→0

    if (iot.writeVirtualPin(3, (float)v3State)) {
      Serial.printf("[V3-OUT] Device wrote relay = %s\n",
                    v3State ? "ON (1)" : "OFF (0)");
    }
  }

  // ─── V4: Push-button pulse — HIGH for 1 s every 7 s ──────────────────────
  // Two-state machine: IDLE → PRESSED → IDLE.
  // Mirrors the Python --mode button behaviour exactly.
  if (!v4Pressed && (now - tV4) >= 7000) {
    // Transition: IDLE → PRESSED
    if (iot.writeVirtualPin(4, 1.0f)) {
      Serial.println("[V4-OUT] Button PRESS  (HIGH = 1)");
    }
    tV4      = now;
    v4Pressed = true;

  } else if (v4Pressed && (now - tV4) >= 1000) {
    // Transition: PRESSED → IDLE  (release after holding 1 second)
    if (iot.writeVirtualPin(4, 0.0f)) {
      Serial.println("[V4-OUT] Button RELEASE (LOW  = 0)");
    }
    tV4      = now;
    v4Pressed = false;
  }

  // ── Optional: print Wi-Fi + status diagnostics every 30 s ─────────────────
  static uint32_t tDiag = 0;
  if (now - tDiag >= 30000) {
    tDiag = now;
    Serial.printf("[DIAG] Wi-Fi: %s  RSSI: %d dBm  uptime: %lu s\n",
      iot.isConnected() ? "OK" : "LOST",
      WiFi.RSSI(),
      now / 1000);
    if (iot.lastStatus() != IOT_OK) {
      Serial.printf("[DIAG] Last status code: %d\n", (int)iot.lastStatus());
    }
  }
}
