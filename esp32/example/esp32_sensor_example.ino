/*
 * ESP32 Sensor Example — using MyIoTSDK
 *
 * Reads temperature (DHT22) and humidity, sends to IoT Platform.
 * Listens for relay commands.
 *
 * Required libraries (install via Arduino Library Manager):
 *   - MyIoTSDK  (this library)
 *   - PubSubClient by Nick O'Leary
 *   - ArduinoJson by Benoit Blanchon
 *   - DHT sensor library by Adafruit
 */

#include <MyIoTSDK.h>
#include <DHT.h>

// ── Configuration ─────────────────────────────────────────────
#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"
#define DEVICE_ID       "your-device-id-from-dashboard"
#define API_KEY         "your-api-key-from-dashboard"
#define MQTT_HOST       "192.168.1.100"   // Your server IP
#define HTTP_BASE       "http://192.168.1.100:3000"

#define DHT_PIN         4
#define DHT_TYPE        DHT22
#define RELAY_PIN       26

// ── Globals ───────────────────────────────────────────────────
DHT dht(DHT_PIN, DHT_TYPE);
unsigned long lastSend = 0;
const unsigned long SEND_INTERVAL = 5000;  // send every 5 seconds

// ── Callbacks ────────────────────────────────────────────────
void onRelay(const char* payload) {
  // payload = {"state":1} or {"state":0}
  StaticJsonDocument<64> doc;
  deserializeJson(doc, payload);
  int state = doc["state"] | 0;
  digitalWrite(RELAY_PIN, state ? HIGH : LOW);
  Serial.print("[Relay] State: "); Serial.println(state);
}

// ── Setup ─────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  dht.begin();

  // Step 1: Connect WiFi
  MyIoT.begin(WIFI_SSID, WIFI_PASSWORD);

  // Step 2: Connect to platform (MQTT primary, HTTP fallback)
  MyIoT.connect(DEVICE_ID, API_KEY, MQTT_HOST, 1883, HTTP_BASE);

  // Step 3: Register command handlers
  MyIoT.on("relay", onRelay);
  MyIoT.on("toggle", onRelay);

  Serial.println("[Setup] Ready!");
}

// ── Loop ──────────────────────────────────────────────────────
void loop() {
  // MUST call this every loop — handles MQTT, reconnects, heartbeat
  MyIoT.loop();

  unsigned long now = millis();
  if (now - lastSend >= SEND_INTERVAL) {
    lastSend = now;

    float temp = dht.readTemperature();
    float hum  = dht.readHumidity();

    if (!isnan(temp)) {
      MyIoT.send("temperature", temp);
      Serial.print("[Sensor] Temp: "); Serial.println(temp);
    }

    if (!isnan(hum)) {
      MyIoT.send("humidity", hum);
      Serial.print("[Sensor] Humidity: "); Serial.println(hum);
    }
  }
}
