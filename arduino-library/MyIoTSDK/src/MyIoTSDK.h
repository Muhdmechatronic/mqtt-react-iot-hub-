/*
 * MyIoTSDK.h  —  ESP32 / ESP8266 client library for IoT Platform
 * ================================================================
 * Version   : 2.0.0
 * Transports: MQTT (primary) → HTTP (automatic fallback)
 * Supports  : Virtual Pins (V0–V255), bidirectional sync, commands
 *
 * Quick start
 * -----------
 *   #include <MyIoTSDK.h>
 *
 *   void setup() {
 *     MyIoT.begin("WiFi_SSID", "WiFi_Pass");
 *     MyIoT.connect("your-api-key", "192.168.1.100");
 *     MyIoT.onPin(3, [](float v){ digitalWrite(RELAY, v > 0.5); });
 *   }
 *
 *   void loop() {
 *     MyIoT.writePin(0, readTempSensor(), "°C");
 *     float speed = MyIoT.readPin(2);      // value set from dashboard Slider
 *     MyIoT.loop();                         // MUST be called every iteration
 *   }
 *
 * Dependencies (install via Arduino Library Manager)
 * ---------------------------------------------------
 *   PubSubClient  (Nick O'Leary)   — MQTT transport
 *   ArduinoJson   v6.x (Blanchon)  — JSON encode / decode
 */

#pragma once

#if defined(ESP32)
  #include <WiFi.h>
  #include <HTTPClient.h>
#elif defined(ESP8266)
  #include <ESP8266WiFi.h>
  #include <ESP8266HTTPClient.h>
  #include <WiFiClient.h>
#else
  #error "MyIoTSDK requires an ESP32 or ESP8266 board."
#endif

#include <PubSubClient.h>
#include <ArduinoJson.h>

// ── Compile-time limits (override before #include if needed) ──────────────────
#ifndef MYIOT_MAX_PINS
  #define MYIOT_MAX_PINS        16    // max simultaneous pin subscriptions
#endif
#ifndef MYIOT_MAX_CALLBACKS
  #define MYIOT_MAX_CALLBACKS   10    // max on() command handlers
#endif

// ── Timing defaults ───────────────────────────────────────────────────────────
#define MYIOT_MQTT_RETRY_MS    5000   // seconds between MQTT reconnect attempts
#define MYIOT_HEARTBEAT_MS    30000   // online heartbeat interval
#define MYIOT_PIN_POLL_MS      2000   // HTTP poll interval for subscribed pins
#define MYIOT_HTTP_TIMEOUT_MS  8000   // per-request HTTP timeout
#define MYIOT_JSON_DOC_SIZE     512   // ArduinoJson document capacity (bytes)

// ── Callback types ────────────────────────────────────────────────────────────

// Fired by loop() when a subscribed pin's server value changes.
//   newValue — the updated float received from the server
typedef void (*MyIoTPinCb)(float newValue);

// Fired when MQTT delivers a command event registered with on().
//   payload  — JSON string of the command's payload object, e.g. {"value":1}
typedef void (*MyIoTCmdCb)(const char* payload);

// ─────────────────────────────────────────────────────────────────────────────
class MyIoTClass {
public:
  MyIoTClass();

  // ══ 1. Wi-Fi connection ════════════════════════════════════════════════════

  // Connect to Wi-Fi.  Blocks until connected or ~20 s timeout.
  // Call once at the top of setup().
  void begin(const char* ssid, const char* password);

  // ══ 2. Platform authentication ════════════════════════════════════════════

  // Connect to the IoT platform server.
  //
  //   apiKey    — 32-char device API key from the platform's Devices page.
  //   httpHost  — IP address or hostname of the backend server.
  //   httpPort  — HTTP backend port (default 3000).
  //   mqttHost  — MQTT broker host; pass nullptr to reuse httpHost.
  //   mqttPort  — MQTT broker port (default 1883).
  //
  // Call once in setup(), after begin().
  void connect(const char* apiKey,
               const char* httpHost = "localhost",
               uint16_t    httpPort = 3000,
               const char* mqttHost = nullptr,
               uint16_t    mqttPort = 1883);

  // ══ 3. Write  (Device → Server) ═══════════════════════════════════════════

  // Send a virtual pin value to the server.
  // Uses MQTT when connected; falls back to HTTP automatically.
  //
  //   pin   — virtual pin number (0–255).  Pin 5 → V5 on the dashboard.
  //   value — float / int / string reading.
  //   unit  — optional unit string stored in sensor history (e.g. "°C", "%").
  //
  // Returns true if the send was accepted (MQTT publish or HTTP 2xx).
  bool writePin(int pin, float       value, const char* unit = "");
  bool writePin(int pin, int         value, const char* unit = "");
  bool writePin(int pin, const char* value, const char* unit = "");

  // Batch write — sends multiple pins in a single HTTP POST.
  // More efficient than calling writePin() in a loop.
  //
  //   pins[]   — array of pin numbers, length = count.
  //   values[] — corresponding float values.
  //   count    — number of entries in each array.
  //   units[]  — corresponding unit strings; pass nullptr to omit all units.
  bool writePins(const int*   pins,
                 const float* values,
                 int          count,
                 const char** units = nullptr);

  // ── Legacy API (v1 compatibility) ─────────────────────────────────────────
  // send() sends data using the raw sensorType string as the key.
  // Prefer writePin() for new projects that use virtual pins.
  void send(const char* sensorType, float       value);
  void send(const char* sensorType, int         value);
  void send(const char* sensorType, const char* value);

  // ══ 4. Read  (Server → Device) ════════════════════════════════════════════

  // Return the locally cached server value for a virtual pin.
  // The cache is refreshed every MYIOT_PIN_POLL_MS ms inside loop().
  // Returns defaultValue if the pin has never been polled successfully.
  float readPin(int pin, float defaultValue = 0.0f) const;

  // Register a callback that fires inside loop() whenever the server value
  // of 'pin' changes.  Calling onPin() also causes loop() to include this
  // pin in the periodic HTTP GET poll.
  //
  // Example — turn relay on/off when the dashboard Switch changes V3:
  //   MyIoT.onPin(3, [](float v){ digitalWrite(RELAY_PIN, v > 0.5); });
  void onPin(int pin, MyIoTPinCb callback);

  // ══ 5. Command events  (MQTT inbound) ═════════════════════════════════════

  // Register a handler for a named command event from the server.
  // The platform publishes to  iot/{apiKey}/command  when a widget sends
  // a command.  Payload is the command's JSON payload as a string.
  //
  // Example:
  //   MyIoT.on("relay", [](const char* p){
  //     StaticJsonDocument<64> d; deserializeJson(d, p);
  //     digitalWrite(LED, (int)d["value"]);
  //   });
  void on(const char* event, MyIoTCmdCb callback);

  // ══ 6. Main-loop driver ═══════════════════════════════════════════════════

  // Call this at the top of every loop() iteration.
  // Internally handles: Wi-Fi keepalive · MQTT reconnect · heartbeat ·
  //                     periodic HTTP pin poll · change callbacks.
  void loop();

  // ══ 7. Status ═════════════════════════════════════════════════════════════
  bool isWifiConnected()  const;
  bool isMqttConnected()  const;

private:
  // ── Credentials / endpoints ───────────────────────────────────────────────
  const char*  _ssid;
  const char*  _password;
  const char*  _apiKey;
  char         _httpBase[80];   // "http://host:port"
  char         _mqttHost[64];
  uint16_t     _mqttPort;

  // ── State ─────────────────────────────────────────────────────────────────
  bool          _wifiReady;
  bool          _mqttOk;
  unsigned long _lastMqttRetry;
  unsigned long _lastHeartbeat;
  unsigned long _lastPinPoll;

  // ── MQTT ──────────────────────────────────────────────────────────────────
  WiFiClient   _wifiClient;
  PubSubClient _mqtt;

  // ── Command handlers ──────────────────────────────────────────────────────
  struct CmdEntry { char event[32]; MyIoTCmdCb cb; };
  CmdEntry _cmdHandlers[MYIOT_MAX_CALLBACKS];
  uint8_t  _cmdCount;

  // ── Virtual pin cache & callbacks ─────────────────────────────────────────
  struct PinEntry {
    int16_t    pin;       // virtual pin number; -1 = slot free
    float      value;     // last value from server
    bool       hasValue;  // false until first successful poll
    MyIoTPinCb cb;        // nullptr = no callback
  };
  PinEntry _pins[MYIOT_MAX_PINS];
  uint8_t  _pinCount;

  // ── Internal helpers ──────────────────────────────────────────────────────
  void  _connectWifi();
  void  _connectMqtt();
  void  _sendHeartbeat();
  bool  _mqttSend(const char* pinKey, const char* valueStr, const char* unit);
  bool  _httpPost(const String& body);
  bool  _httpPollPins();
  int   _pinIndex(int pin) const;

  static MyIoTClass* _instance;
  static void _mqttCallback(char* topic, byte* payload, unsigned int length);
  void        _onMqttMessage(char* topic, byte* payload, unsigned int length);
};

extern MyIoTClass MyIoT;
