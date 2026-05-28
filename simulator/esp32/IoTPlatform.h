// IoTPlatform.h — Bidirectional ESP32 Virtual Pin Library
// =========================================================
// Wraps all Wi-Fi, HTTP, and JSON complexity into a clean four-function API:
//
//   begin()              — connect to Wi-Fi + store server credentials
//   writeVirtualPin()    — POST a sensor/control value to the server (Device → Server)
//   writeVirtualPins()   — batch POST (multiple pins in one request)
//   readVirtualPin()     — read the locally-cached server value  (Server → Device)
//   subscribePin()       — register a pin to be polled automatically by sync()
//   sync()               — call every loop(); manages Wi-Fi keepalive + polling
//
// Dependencies (install via Arduino Library Manager):
//   • ArduinoJson  v6.x  (Benoit Blanchon)
//   Built-in:  WiFi.h · HTTPClient.h
//
// Platform: ESP32 (Arduino framework, tested with esp32 board package ≥ 2.0)

#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// Maximum number of virtual pins that can be subscribed for automatic polling.
#define IOT_MAX_SUBSCRIPTIONS  16

// HTTP request timeout (ms).  Increase on slow networks.
#define IOT_HTTP_TIMEOUT_MS   8000

// Default interval between automatic server polls for subscribed pins (ms).
#define IOT_DEFAULT_SYNC_MS   2000

// ArduinoJson document capacity for outbound and inbound payloads (bytes).
// Increase if you batch-write more than ~8 pins in one call.
#define IOT_JSON_DOC_SIZE     1024

// ─── Callback type ────────────────────────────────────────────────────────────
// Fired by sync() whenever a subscribed pin's server value changes.
//   pin      — virtual pin number (0–255), e.g. 3 for V3
//   newValue — updated float value received from the server
typedef void (*PinChangeCallback)(int pin, float newValue);

// ─── Status codes ─────────────────────────────────────────────────────────────
enum IoTStatus : uint8_t {
  IOT_OK              = 0,  // operation succeeded
  IOT_ERR_WIFI        = 1,  // Wi-Fi not connected or reconnect timed out
  IOT_ERR_HTTP        = 2,  // non-2xx HTTP response or connection refused
  IOT_ERR_JSON        = 3,  // JSON serialise / deserialise error
  IOT_ERR_INVALID_PIN = 4,  // pin number outside 0–255
  IOT_ERR_NO_DATA     = 5,  // server returned no value for the requested pin
};

// ─── Internal cache record ────────────────────────────────────────────────────
struct IoTPinCache {
  int16_t pin;       // virtual pin number; -1 = slot unused
  float   value;     // last value received from the server
  bool    hasValue;  // false until at least one successful sync
};

// ─────────────────────────────────────────────────────────────────────────────
class IoTPlatform {
public:
  IoTPlatform();

  // ── Initialization ──────────────────────────────────────────────────────────

  // Connect to Wi-Fi and store server connection parameters.
  // Blocks until connected or wifiTimeoutMs elapses.  Call once in setup().
  //
  // ssid / password  — Wi-Fi credentials
  // serverHost       — IP or hostname of the machine running the IoT backend
  // serverPort       — HTTP port (default 3000)
  // apiKey           — device API key from the platform's Devices page
  // wifiTimeoutMs    — how long to wait for Wi-Fi before continuing offline
  void begin(const char* ssid,
             const char* password,
             const char* serverHost,
             uint16_t    serverPort,
             const char* apiKey,
             uint32_t    wifiTimeoutMs = 15000);

  // ── Write: Device → Server ──────────────────────────────────────────────────

  // Send a single virtual-pin value to the platform.
  //   pin   — virtual pin number (0–255), e.g. 0 for V0
  //   value — float reading (temperature, PWM %, relay state, etc.)
  //   unit  — optional unit string stored in sensor_data.unit, e.g. "°C" or "%"
  // Returns true on HTTP 2xx response.
  bool writeVirtualPin(int pin, float value, const char* unit = "");

  // Send multiple virtual-pin values in a SINGLE HTTP POST (more efficient
  // than calling writeVirtualPin in a loop when you have several sensors).
  //   pins[]   — array of pin numbers, length = count
  //   values[] — corresponding float values
  //   count    — number of entries
  //   units[]  — optional unit strings; pass nullptr to omit all units
  bool writeVirtualPins(const int*   pins,
                        const float* values,
                        int          count,
                        const char** units = nullptr);

  // ── Read: Server → Device ───────────────────────────────────────────────────

  // Returns the locally cached value of a virtual pin.
  // The cache is populated by sync() / pollSubscribedPins().
  // Returns defaultValue if the pin has never been synced yet.
  float readVirtualPin(int pin, float defaultValue = 0.0f) const;

  // Register a virtual pin for automatic HTTP polling on every sync() call.
  //   callback — optional; invoked whenever the server value differs from the
  //              previously cached value (useful for relay control, etc.)
  void subscribePin(int pin, PinChangeCallback callback = nullptr);

  // Override the automatic poll interval.  Default: IOT_DEFAULT_SYNC_MS (2 s).
  void setSyncInterval(uint32_t intervalMs);

  // Manually trigger one HTTP GET for ALL subscribed pins right now,
  // updating the local cache.  Returns true if the request succeeded.
  bool pollSubscribedPins();

  // ── Main-loop driver ────────────────────────────────────────────────────────

  // Call this at the top of every loop() iteration.
  // Internally: verifies Wi-Fi (reconnects if dropped), polls subscribed pins
  // on schedule, fires change callbacks when values differ from cached values.
  void sync();

  // ── Diagnostics ─────────────────────────────────────────────────────────────

  bool      isConnected() const;  // true when Wi-Fi is associated
  IoTStatus lastStatus()  const;  // result code of the most recent operation

private:
  char     _ssid[64];
  char     _password[64];
  char     _host[64];
  uint16_t _port;
  char     _apiKey[128];

  // Subscription list (parallel arrays for simplicity — no dynamic allocation)
  int               _subPins[IOT_MAX_SUBSCRIPTIONS];
  PinChangeCallback _subCbs[IOT_MAX_SUBSCRIPTIONS];
  int               _subCount;

  // Local value cache (one entry per subscribed pin, same index)
  IoTPinCache _cache[IOT_MAX_SUBSCRIPTIONS];

  // Timing
  uint32_t  _syncIntervalMs;
  uint32_t  _lastSyncMs;

  // Last operation result
  IoTStatus _lastStatus;

  // Internal helpers
  bool   _post(const String& path, const String& body, String& response);
  bool   _get(const String& path, String& response);
  void   _reconnectWiFi();
  int    _cacheIndexOf(int pin) const;
  String _url(const String& path) const;
};
