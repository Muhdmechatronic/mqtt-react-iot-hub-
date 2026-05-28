/*
 * SwitchControl — Bidirectional switch + LED control via Virtual Pin V3
 * ======================================================================
 * Hardware:
 *   GPIO 5 → push-button/toggle switch (INPUT_PULLUP, active-LOW)
 *   GPIO 4 → LED (OUTPUT)
 *
 * Virtual Pin:
 *   V3  bidirectional — 1.0 = ON, 0.0 = OFF
 *       Dashboard widget: Switch (configured on V3)
 */

#define MYIOT_PIN_POLL_MS 300   // poll server every 300 ms  (must be BEFORE #include)
#include <MyIoTSDK.h>

// ── Configuration ─────────────────────────────────────────────────────────────
const char* WIFI_SSID   = "YourWiFiSSID";
const char* WIFI_PASS   = "YourWiFiPassword";
const char* SERVER_HOST = "192.168.0.220";
const char* API_KEY     = "paste-your-api-key-here";

// ─────────────────────────────────────────────────────────────
// PINS
// ─────────────────────────────────────────────────────────────
const int PIN_SWITCH = 5;
const int PIN_LED    = 4;

// ─────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────
bool ledState = false;

// ─────────────────────────────────────────────────────────────
// SERVER → DEVICE
// Dashboard switch changed
// ─────────────────────────────────────────────────────────────
void onV3Changed(float val) {

  bool newState = (val > 0.5f);

  Serial.printf(
    "[SERVER] V3 = %.1f -> LED %s\n",
    val,
    newState ? "ON" : "OFF"
  );

  ledState = newState;

  digitalWrite(PIN_LED, ledState ? HIGH : LOW);
}

// ─────────────────────────────────────────────────────────────
// DEVICE → SERVER
// ─────────────────────────────────────────────────────────────
void sendState(float value) {

  Serial.printf(
    "[HW] Sending V3 = %.1f ... ",
    value
  );

  bool ok = MyIoT.writePin(3, value);

  if (ok) {
    Serial.println("OK");
  } else {
    Serial.println("FAILED");
  }
}

// ─────────────────────────────────────────────────────────────
// SETUP
// ─────────────────────────────────────────────────────────────
void setup() {

  Serial.begin(115200);
  delay(300);

  Serial.println();
  Serial.println("=================================");
  Serial.println(" Toggle Switch Control Starting ");
  Serial.println("=================================");

  // INPUT_PULLUP:
  // HIGH = open
  // LOW  = connected to GND

  pinMode(PIN_SWITCH, INPUT_PULLUP);

  pinMode(PIN_LED, OUTPUT);

  digitalWrite(PIN_LED, LOW);

  // WiFi + Server
  MyIoT.begin(WIFI_SSID, WIFI_PASS);

  MyIoT.connect(API_KEY, SERVER_HOST);

  // Subscribe V3
  MyIoT.onPin(3, onV3Changed);

  Serial.println("[SYSTEM] Ready");
}

// ─────────────────────────────────────────────────────────────
// LOOP
// ─────────────────────────────────────────────────────────────
void loop() {

  MyIoT.loop();

  // ─────────────────────────────────────────
  // REAL TOGGLE SWITCH LOGIC
  // ─────────────────────────────────────────

  static bool hwLast    = true;
  static bool hwStable  = true;
  static unsigned long hwChanged = 0;

  bool hwRaw = digitalRead(PIN_SWITCH);

  // Detect raw change
  if (hwRaw != hwLast) {

    hwLast = hwRaw;

    hwChanged = millis();
  }

  // Debounce
  if ((millis() - hwChanged) >= 50 &&
      hwRaw != hwStable) {

    hwStable = hwRaw;

    // INPUT_PULLUP:
    // LOW  = switch ON
    // HIGH = switch OFF

    ledState = !hwStable;

    digitalWrite(
      PIN_LED,
      ledState ? HIGH : LOW
    );

    Serial.printf(
      "[HW] SWITCH %s -> V3 %.1f\n",
      ledState ? "ON" : "OFF",
      ledState ? 1.0f : 0.0f
    );

    sendState(
      ledState ? 1.0f : 0.0f
    );
  }

  // ─────────────────────────────────────────
  // STATUS PRINT
  // ─────────────────────────────────────────

  static unsigned long lastStatus = 0;

  if (millis() - lastStatus >= 3000) {

    lastStatus = millis();

    Serial.printf(
      "[STATUS] LED=%s | MQTT=%s | WiFi=%s\n",
      ledState ? "ON" : "OFF",
      MyIoT.isMqttConnected() ? "OK" : "NO",
      MyIoT.isWifiConnected() ? "OK" : "NO"
    );
  }
}