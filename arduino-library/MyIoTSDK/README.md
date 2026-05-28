# MyIoTSDK — Arduino Library v2.0.0

ESP32 / ESP8266 client library for the IoT Platform.

**Transport priority:** MQTT (primary) → HTTP POST (automatic fallback)  
**Read path:** HTTP GET `/api/device/state` (polled every 2 s)

---

## Compatibility

| Board family | Support |
|---|---|
| ESP32 (all variants) | ✅ |
| ESP8266 (NodeMCU, Wemos D1, …) | ✅ |
| AVR / ARM / RP2040 | ❌ — requires WiFi + HTTP stack |

---

## Dependencies

Install both via **Arduino Library Manager** or **PlatformIO**:

| Library | Author | Minimum version |
|---|---|---|
| PubSubClient | Nick O'Leary | 2.8 |
| ArduinoJson | Benoît Blanchon | 6.0 |

---

## Installation

### Arduino IDE
1. Download this folder as a `.zip`.
2. **Sketch → Include Library → Add .ZIP Library…** → select the zip.
3. Install **PubSubClient** and **ArduinoJson** from Library Manager.

### PlatformIO
Add to `platformio.ini`:
```ini
lib_deps =
    knolleary/PubSubClient @ ^2.8
    bblanchon/ArduinoJson @ ^6.21
    ; path to this library if local:
    symlink://../arduino-library/MyIoTSDK
```

---

## Quick Start

```cpp
#include <MyIoTSDK.h>

void setup() {
  MyIoT.begin("WiFi_SSID", "WiFi_Pass");
  MyIoT.connect("your-api-key", "192.168.1.100");

  // Fire when the dashboard Slider changes V2
  MyIoT.onPin(2, [](float pct) {
    ledcWrite(0, (uint8_t)(pct * 2.55f));
  });
}

void loop() {
  MyIoT.loop();                              // MUST be called every iteration

  MyIoT.writePin(0, readTempSensor(), "°C"); // send temperature on V0
}
```

---

## API Reference

### 1. Wi-Fi connection

```cpp
void MyIoT.begin(const char* ssid, const char* password);
```
Connects to Wi-Fi. Blocks up to 20 s. Call once at the top of `setup()`.

---

### 2. Platform authentication

```cpp
void MyIoT.connect(
    const char* apiKey,
    const char* httpHost = "localhost",
    uint16_t    httpPort = 3000,
    const char* mqttHost = nullptr,   // nullptr → reuse httpHost
    uint16_t    mqttPort = 1883
);
```
Call once in `setup()`, after `begin()`.

---

### 3. Write — Device → Server

| Method | Description |
|---|---|
| `bool writePin(int pin, float value, const char* unit = "")` | Send a float value on virtual pin `pin` |
| `bool writePin(int pin, int value, const char* unit = "")` | Send an integer value |
| `bool writePin(int pin, const char* value, const char* unit = "")` | Send a string value |
| `bool writePins(const int* pins, const float* values, int count, const char** units = nullptr)` | Batch write — single HTTP POST |

`writePin` uses MQTT when connected, falls back to HTTP automatically.  
Returns `true` on success (MQTT publish or HTTP 2xx).

**Batch write example:**
```cpp
const int   pins[]   = { 0, 1 };
const float values[] = { 24.5f, 65.0f };
const char* units[]  = { "°C", "%" };
MyIoT.writePins(pins, values, 2, units);
```

---

### 4. Read — Server → Device

```cpp
float MyIoT.readPin(int pin, float defaultValue = 0.0f);
```
Returns the locally cached server value for virtual pin `pin`.  
The cache is refreshed every `MYIOT_PIN_POLL_MS` ms (default 2 s) inside `loop()`.  
Returns `defaultValue` if the pin has never been polled successfully.

```cpp
void MyIoT.onPin(int pin, MyIoTPinCb callback);
// typedef void (*MyIoTPinCb)(float newValue);
```
Register a callback that fires inside `loop()` whenever the server value of `pin` changes.  
Also adds `pin` to the periodic HTTP GET poll.

**Example — relay controlled by dashboard Switch on V3:**
```cpp
MyIoT.onPin(3, [](float v) {
  digitalWrite(RELAY_PIN, v > 0.5f ? HIGH : LOW);
});
```

---

### 5. Command events — MQTT inbound

```cpp
void MyIoT.on(const char* event, MyIoTCmdCb callback);
// typedef void (*MyIoTCmdCb)(const char* jsonPayload);
```
Register a handler for a named command event. The platform publishes to  
`iot/{apiKey}/command` when a widget sends a command. `jsonPayload` is the  
command's `payload` object serialised as a JSON string.

```cpp
MyIoT.on("relay", [](const char* p) {
  StaticJsonDocument<64> doc;
  deserializeJson(doc, p);
  digitalWrite(LED, (int)doc["value"]);
});
```

---

### 6. Main-loop driver

```cpp
void MyIoT.loop();
```
**Must be called at the top of every `loop()` iteration.**  
Internally handles: Wi-Fi keepalive · MQTT reconnect · heartbeat · periodic HTTP pin poll · change callbacks.

---

### 7. Status

```cpp
bool MyIoT.isWifiConnected();
bool MyIoT.isMqttConnected();
```

---

## Virtual Pin Layout Convention

| Pin | Dashboard Datastream | Typical use |
|---|---|---|
| V0 | temperature | Gauge / Line Chart |
| V1 | humidity | Progress Bar |
| V2 | led_pwm / fan_speed | Slider → LED PWM |
| V3 | relay | Switch → GPIO |
| V4 | button | Push-button pulse |

Pins V0–V255 are available. Name and type are defined in the platform's Datastream editor.

---

## Compile-time Constants

Override any of these **before** `#include <MyIoTSDK.h>`:

```cpp
#define MYIOT_MAX_PINS        16      // max simultaneous onPin() subscriptions
#define MYIOT_MAX_CALLBACKS   10      // max on() command handlers
#define MYIOT_MQTT_RETRY_MS   5000    // ms between MQTT reconnect attempts
#define MYIOT_HEARTBEAT_MS   30000    // online heartbeat interval (ms)
#define MYIOT_PIN_POLL_MS     2000    // HTTP GET poll interval for pins (ms)
#define MYIOT_HTTP_TIMEOUT_MS 8000    // per-request HTTP timeout (ms)
#define MYIOT_JSON_DOC_SIZE    512    // ArduinoJson document capacity (bytes)
```

---

## Examples

| Sketch | What it shows |
|---|---|
| `BasicSensor` | Minimal — simulated temperature → V0 every 5 s |
| `VirtualPins` | Bidirectional — write V0/V1, read V2→LED PWM, V3→relay via callbacks |
| `FullSimulator` | All five channels simultaneously; hardware equivalent of `sensor_simulator.py --mode demo` |

Open examples via **File → Examples → MyIoTSDK** in Arduino IDE.

---

## Legacy API (v1 compatibility)

```cpp
MyIoT.send("temperature", 24.5f);   // sends key="temperature", no virtual pin
MyIoT.send("relay", 1);
```
`send()` still works but writes a raw string key instead of `V{pin}`. Prefer `writePin()` for new projects.

---

## Dashboard Setup (per example)

1. **Devices** page → create a device → copy the **API Key**.
2. **Datastreams** tab → add entries for each virtual pin used (type, unit, min/max).
3. **Sandbox** → drag widgets onto the canvas → link each widget to its datastream.
4. Save the dashboard, flash the sketch, open **Serial Monitor @ 115200**.

---

## License

MIT — see `LICENSE` file.
