/*
 * FullSimulator — MyIoTSDK Example
 * ==================================
 * Hardware equivalent of the Python sensor_simulator.py --mode demo.
 * Runs all five simulation channels simultaneously using non-blocking
 * millis() timers.  loop() never blocks.
 *
 * ─── VIRTUAL PIN LAYOUT ───────────────────────────────────────────────────────
 *
 *   V0  temperature   WRITE   15→40°C  linear ramp, 60-second period
 *   V1  humidity      WRITE   30→90%   sine wave,   40-second period
 *   V2  led_pwm       WRITE   0→100%   triangle wave, 8-second period
 *              also   READ    dashboard Slider → onboard LED PWM
 *   V3  relay         WRITE   0↔1      toggle every 4 seconds
 *              also   READ    dashboard Switch → relay GPIO
 *   V4  button        WRITE   1 for 1 s every 7 s (momentary press)
 *
 * ─── DASHBOARD SETUP ──────────────────────────────────────────────────────────
 *
 *   1. Create a Device → copy API Key into API_KEY below.
 *   2. Create Datastreams:
 *        V0  temperature  double  °C    min=0   max=50
 *        V1  humidity     double  %     min=0   max=100
 *        V2  led_pwm      double  %     min=0   max=100
 *        V3  relay        integer       min=0   max=1
 *        V4  button       integer       min=0   max=1
 *   3. In Sandbox, add widgets and link to datastreams:
 *        V0 → Gauge or Line Chart   (watch temperature ramp)
 *        V1 → Progress Bar          (watch humidity sine wave)
 *        V2 → LED widget (pwm mode, pwmMin=0, pwmMax=100)
 *           + Slider widget  (move slider → physical LED dims/brightens)
 *        V3 → Switch widget + LED widget (binary mode, threshold=0.5)
 *           (toggle Switch on dashboard → GPIO 26 follows)
 *        V4 → LED widget (binary mode)  (flashes on each button pulse)
 *   4. Save the dashboard, flash this sketch, open Serial Monitor @ 115200.
 *
 * ─── HARDWARE WIRING ──────────────────────────────────────────────────────────
 *
 *   GPIO 2  → built-in LED (PWM, tracks V2 from server)
 *   GPIO 26 → relay or external LED (digital, tracks V3 from server)
 */

#include <Arduino.h>
#include <math.h>
#include <MyIoTSDK.h>

// ── Configuration — edit before flashing ──────────────────────────────────────
const char* WIFI_SSID   = "YourWiFiSSID";
const char* WIFI_PASS   = "YourWiFiPassword";
const char* SERVER_HOST = "192.168.1.100";   // LAN IP of Docker host
const char* API_KEY     = "paste-your-api-key-here";

// GPIO
const int GPIO_LED_PWM = 2;
const int GPIO_RELAY   = 26;

// ESP32 LEDC (hardware PWM)
const int LEDC_CH   = 0;
const int LEDC_FREQ = 5000;
const int LEDC_BITS = 8;

// ── Non-blocking timer state ───────────────────────────────────────────────────
unsigned long tSensorBatch = 0;   // V0+V1 batch   every 1000 ms
unsigned long tPwmWrite    = 0;   // V2 PWM sweep  every  200 ms
unsigned long tV3Toggle    = 0;   // V3 toggle     every 4000 ms
int           v3State      = 0;
bool          v4Pressed    = false;
unsigned long tV4          = 0;

// ─────────────────────────────────────────────────────────────────────────────
void onFanSpeed(float pct) {
  // Fires when dashboard Slider changes V2
  ledcWrite(LEDC_CH, (uint8_t)(pct * 2.55f));
  Serial.printf("[V2 IN] LED PWM = %.0f%%\n", pct);
}

void onRelay(float val) {
  // Fires when dashboard Switch changes V3
  bool on = (val > 0.5f);
  digitalWrite(GPIO_RELAY, on ? HIGH : LOW);
  Serial.printf("[V3 IN] Relay = %s\n", on ? "ON" : "OFF");
}

// ─────────────────────────────────────────────────────────────────────────────
void setup()
{
  Serial.begin(115200);
  delay(300);
  Serial.println("\n=== FullSimulator — MyIoTSDK ===");

  // GPIO
  pinMode(GPIO_RELAY, OUTPUT);
  digitalWrite(GPIO_RELAY, LOW);
  ledcAttach(GPIO_LED_PWM, LEDC_FREQ, LEDC_BITS);
  ledcWrite(GPIO_LED_PWM, 0);

  // Platform connection
  MyIoT.begin(WIFI_SSID, WIFI_PASS);
  MyIoT.connect(API_KEY, SERVER_HOST);

  // Inbound subscriptions with callbacks
  MyIoT.onPin(2, onFanSpeed);   // V2: LED PWM from dashboard Slider
  MyIoT.onPin(3, onRelay);      // V3: relay from dashboard Switch

  // Stagger initial timers to avoid HTTP burst at t=0
  tSensorBatch = millis();
  tPwmWrite    = millis() + 100;
  tV3Toggle    = millis() + 200;
  tV4          = millis() + 3000;  // first button press after 3 s

  Serial.println("Channels active:");
  Serial.println("  V0  temperature  ramp  15–40°C");
  Serial.println("  V1  humidity     sine  30–90%");
  Serial.println("  V2  LED PWM      sweep 0–100%  +  GPIO 2 from server");
  Serial.println("  V3  relay toggle 0↔1  every 4 s  +  GPIO 26 from server");
  Serial.println("  V4  button pulse HIGH 1 s / LOW 6 s");
  Serial.println();
}

// ─────────────────────────────────────────────────────────────────────────────
void loop()
{
  unsigned long now    = millis();
  float         nowSec = now / 1000.0f;

  // ── Inbound: poll + callbacks for V2, V3 ──────────────────────────────────
  MyIoT.loop();

  // ── V0 + V1: batch write every 1 s ────────────────────────────────────────
  if (now - tSensorBatch >= 1000) {
    tSensorBatch = now;

    // Temperature: triangle wave 15→40°C over 60 s
    float cycle = fmod(nowSec / 60.0f, 2.0f);
    if (cycle > 1.0f) cycle = 2.0f - cycle;
    float temp = 15.0f + 25.0f * cycle;

    // Humidity: sine wave 30–90% over 40 s
    float humi = 60.0f + 30.0f * sinf(2.0f * PI * nowSec / 40.0f);

    const int   bPins[]   = { 0, 1 };
    const float bValues[] = { temp, humi };
    const char* bUnits[]  = { "\xC2\xB0""C", "%" };   // °C UTF-8, %
    bool ok = MyIoT.writePins(bPins, bValues, 2, bUnits);

    Serial.printf("[V0+V1] temp=%.1f°C  humi=%.1f%%  %s\n",
                  temp, humi, ok ? "OK" : "FAIL");
  }

  // ── V2: LED PWM outbound sweep every 200 ms ───────────────────────────────
  // Triangle wave 0→100→0 over 8 seconds.
  // NOTE: sketch also reads V2 from server (dashboard Slider).
  //       In production, pick one direction — remove this block if the
  //       dashboard Slider should be the sole owner of V2.
  if (now - tPwmWrite >= 200) {
    tPwmWrite = now;
    float pc = fmod(nowSec / 8.0f, 2.0f);
    if (pc > 1.0f) pc = 2.0f - pc;
    MyIoT.writePin(2, pc * 100.0f, "%");
  }

  // ── V3: relay toggle every 4 s ────────────────────────────────────────────
  if (now - tV3Toggle >= 4000) {
    tV3Toggle = now;
    v3State   = 1 - v3State;
    MyIoT.writePin(3, v3State);
    Serial.printf("[V3 OUT] relay → %s\n", v3State ? "ON" : "OFF");
  }

  // ── V4: push-button pulse — HIGH 1 s every 7 s ───────────────────────────
  if (!v4Pressed && (now - tV4) >= 7000) {
    MyIoT.writePin(4, 1);
    Serial.println("[V4 OUT] Button PRESS (1)");
    tV4      = now;
    v4Pressed = true;
  } else if (v4Pressed && (now - tV4) >= 1000) {
    MyIoT.writePin(4, 0);
    Serial.println("[V4 OUT] Button RELEASE (0)");
    tV4      = now;
    v4Pressed = false;
  }

  // ── Diagnostics every 30 s ────────────────────────────────────────────────
  static unsigned long tDiag = 0;
  if (now - tDiag >= 30000) {
    tDiag = now;
    Serial.printf("[DIAG] uptime=%lus  WiFi=%s  MQTT=%s  RSSI=%ddBm\n",
      now / 1000,
      MyIoT.isWifiConnected() ? "OK" : "LOST",
      MyIoT.isMqttConnected() ? "OK" : "HTTP",
      WiFi.RSSI());
  }
}
