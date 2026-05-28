/*
 * MyIoTSDK.cpp
 * Transport priority:  MQTT (publish) → HTTP POST (automatic fallback)
 * Server polling:      HTTP GET /api/device/state  (for dashboard→device sync)
 */

#include "MyIoTSDK.h"

MyIoTClass* MyIoTClass::_instance = nullptr;

// ─────────────────────────────────────────────────────────────────────────────
MyIoTClass::MyIoTClass()
  : _ssid(nullptr), _password(nullptr), _apiKey(nullptr),
    _mqttPort(1883), _wifiReady(false), _mqttOk(false),
    _lastMqttRetry(0), _lastHeartbeat(0), _lastPinPoll(0),
    _cmdCount(0), _pinCount(0),
    _mqtt(_wifiClient)
{
  _instance      = this;
  _httpBase[0]   = '\0';
  _mqttHost[0]   = '\0';

  for (uint8_t i = 0; i < MYIOT_MAX_PINS; i++) {
    _pins[i] = { -1, 0.0f, false, nullptr };
  }
}

// ══ Public API ════════════════════════════════════════════════════════════════

void MyIoTClass::begin(const char* ssid, const char* password)
{
  _ssid     = ssid;
  _password = password;
  _connectWifi();
}

// ─────────────────────────────────────────────────────────────────────────────
void MyIoTClass::connect(const char* apiKey,
                          const char* httpHost,
                          uint16_t    httpPort,
                          const char* mqttHost,
                          uint16_t    mqttPort)
{
  _apiKey   = apiKey;
  _mqttPort = mqttPort;

  snprintf(_httpBase, sizeof(_httpBase), "http://%s:%u", httpHost, httpPort);

  // If no explicit MQTT host, reuse the HTTP host
  strncpy(_mqttHost, mqttHost ? mqttHost : httpHost, sizeof(_mqttHost) - 1);

  _mqtt.setServer(_mqttHost, _mqttPort);
  _mqtt.setCallback(MyIoTClass::_mqttCallback);
  _mqtt.setKeepAlive(60);
  _mqtt.setBufferSize(512);

  _connectMqtt();
}

// ── writePin overloads ────────────────────────────────────────────────────────

bool MyIoTClass::writePin(int pin, float value, const char* unit)
{
  char buf[32];
  snprintf(buf, sizeof(buf), "%.4g", value);   // compact: no trailing zeros
  char key[8];
  snprintf(key, sizeof(key), "V%d", pin);
  return _mqttSend(key, buf, unit);
}

bool MyIoTClass::writePin(int pin, int value, const char* unit)
{
  char buf[16];
  snprintf(buf, sizeof(buf), "%d", value);
  char key[8];
  snprintf(key, sizeof(key), "V%d", pin);
  return _mqttSend(key, buf, unit);
}

bool MyIoTClass::writePin(int pin, const char* value, const char* unit)
{
  char key[8];
  snprintf(key, sizeof(key), "V%d", pin);
  return _mqttSend(key, value, unit);
}

// ── writePins (batch HTTP POST) ───────────────────────────────────────────────

bool MyIoTClass::writePins(const int*   pins,
                            const float* values,
                            int          count,
                            const char** units)
{
  if (!_wifiReady || count <= 0) return false;

  DynamicJsonDocument doc(MYIOT_JSON_DOC_SIZE);
  JsonObject data     = doc.createNestedObject("data");
  JsonObject unitsObj = doc.createNestedObject("units");

  for (int i = 0; i < count; i++) {
    char key[8];
    snprintf(key, sizeof(key), "V%d", pins[i]);
    data[key] = values[i];
    if (units && units[i] && units[i][0] != '\0') unitsObj[key] = units[i];
  }

  String body;
  serializeJson(doc, body);
  return _httpPost(body);
}

// ── Legacy send() ─────────────────────────────────────────────────────────────

void MyIoTClass::send(const char* sensorType, float value)
{
  char buf[32];
  snprintf(buf, sizeof(buf), "%.4g", value);
  _mqttSend(sensorType, buf, "");
}

void MyIoTClass::send(const char* sensorType, int value)
{
  char buf[16];
  snprintf(buf, sizeof(buf), "%d", value);
  _mqttSend(sensorType, buf, "");
}

void MyIoTClass::send(const char* sensorType, const char* value)
{
  _mqttSend(sensorType, value, "");
}

// ── readPin ───────────────────────────────────────────────────────────────────

float MyIoTClass::readPin(int pin, float defaultValue) const
{
  int idx = _pinIndex(pin);
  if (idx < 0 || !_pins[idx].hasValue) return defaultValue;
  return _pins[idx].value;
}

// ── onPin ─────────────────────────────────────────────────────────────────────

void MyIoTClass::onPin(int pin, MyIoTPinCb callback)
{
  // If already subscribed, just update the callback
  int idx = _pinIndex(pin);
  if (idx >= 0) { _pins[idx].cb = callback; return; }

  if (_pinCount >= MYIOT_MAX_PINS) {
    Serial.printf("[MyIoT] onPin(%d): max %d pins reached\n", pin, MYIOT_MAX_PINS);
    return;
  }

  uint8_t i    = _pinCount++;
  _pins[i].pin      = (int16_t)pin;
  _pins[i].value    = 0.0f;
  _pins[i].hasValue = false;
  _pins[i].cb       = callback;
}

// ── on (command event) ────────────────────────────────────────────────────────

void MyIoTClass::on(const char* event, MyIoTCmdCb callback)
{
  if (_cmdCount >= MYIOT_MAX_CALLBACKS) return;
  strncpy(_cmdHandlers[_cmdCount].event, event, sizeof(_cmdHandlers[0].event) - 1);
  _cmdHandlers[_cmdCount].cb = callback;
  _cmdCount++;
}

// ── loop ──────────────────────────────────────────────────────────────────────

void MyIoTClass::loop()
{
  unsigned long now = millis();

  // ── Wi-Fi keepalive ───────────────────────────────────────────────────────
  if (WiFi.status() != WL_CONNECTED) {
    if (_wifiReady) {
      _wifiReady = false;
      _mqttOk    = false;
      Serial.println("[MyIoT] Wi-Fi lost — reconnecting...");
    }
    _connectWifi();
    return;
  }

  // ── MQTT keepalive ────────────────────────────────────────────────────────
  if (!_mqtt.connected()) {
    if (_mqttOk) { _mqttOk = false; Serial.println("[MyIoT] MQTT disconnected"); }
    if (now - _lastMqttRetry >= MYIOT_MQTT_RETRY_MS) {
      _lastMqttRetry = now;
      _connectMqtt();
    }
  } else {
    _mqtt.loop();
  }

  // ── Heartbeat (MQTT status ping) ──────────────────────────────────────────
  if (now - _lastHeartbeat >= MYIOT_HEARTBEAT_MS) {
    _lastHeartbeat = now;
    _sendHeartbeat();
  }

  // ── HTTP poll: read server-set pin values ─────────────────────────────────
  // Runs even when MQTT is up — the read path always uses HTTP GET.
  if (_pinCount > 0 && (now - _lastPinPoll) >= MYIOT_PIN_POLL_MS) {
    _lastPinPoll = now;
    _httpPollPins();
  }
}

// ── Status ────────────────────────────────────────────────────────────────────

bool MyIoTClass::isWifiConnected() const { return _wifiReady; }
bool MyIoTClass::isMqttConnected() const { return _mqttOk;    }

// ══ Private implementation ════════════════════════════════════════════════════

void MyIoTClass::_connectWifi()
{
  if (WiFi.status() == WL_CONNECTED) { _wifiReady = true; return; }

  WiFi.mode(WIFI_STA);
  WiFi.begin(_ssid, _password);
  Serial.printf("[MyIoT] Connecting to Wi-Fi: %s", _ssid);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(500);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    _wifiReady = true;
    Serial.printf("[MyIoT] Wi-Fi OK  IP=%s\n", WiFi.localIP().toString().c_str());
  } else {
    _wifiReady = false;
    Serial.println("[MyIoT] Wi-Fi connection timed out");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
void MyIoTClass::_connectMqtt()
{
  if (!_wifiReady || !_apiKey) return;

  Serial.printf("[MyIoT] MQTT connecting to %s:%u...", _mqttHost, _mqttPort);
  String clientId = String("myiot_") + String(_apiKey).substring(0, 8);

  if (_mqtt.connect(clientId.c_str())) {
    _mqttOk = true;
    Serial.println(" OK");

    // Subscribe to inbound commands from the platform
    char cmdTopic[128];
    snprintf(cmdTopic, sizeof(cmdTopic), "iot/%s/command", _apiKey);
    _mqtt.subscribe(cmdTopic, 1);

    // Announce online status
    char stTopic[128];
    snprintf(stTopic, sizeof(stTopic), "iot/%s/status", _apiKey);
    _mqtt.publish(stTopic, "{\"status\":\"online\"}", true);

  } else {
    _mqttOk = false;
    Serial.printf(" FAILED rc=%d\n", _mqtt.state());
  }
}

// ─────────────────────────────────────────────────────────────────────────────
void MyIoTClass::_sendHeartbeat()
{
  if (!_mqttOk || !_apiKey) return;
  char topic[128];
  snprintf(topic, sizeof(topic), "iot/%s/status", _apiKey);
  _mqtt.publish(topic, "{\"status\":\"online\"}", false);
}

// ─── Core send: MQTT primary, HTTP fallback ───────────────────────────────────
// sensorKey can be a raw key ("temperature") or a virtual pin key ("V0").
bool MyIoTClass::_mqttSend(const char* sensorKey,
                             const char* valueStr,
                             const char* unit)
{
  if (!_wifiReady) return false;

  // Build the unified JSON payload that the backend expects:
  //   { "data": { "V0": "25.3" }, "units": { "V0": "°C" } }
  DynamicJsonDocument doc(MYIOT_JSON_DOC_SIZE);
  doc["data"][sensorKey] = valueStr;
  if (unit && unit[0] != '\0') doc["units"][sensorKey] = unit;

  String body;
  serializeJson(doc, body);

  // ── Try MQTT first ────────────────────────────────────────────────────────
  if (_mqttOk && _mqtt.connected()) {
    char topic[128];
    snprintf(topic, sizeof(topic), "iot/%s/sensor", _apiKey);
    if (_mqtt.publish(topic, body.c_str(), false)) return true;
    Serial.println("[MyIoT] MQTT publish failed — falling back to HTTP");
  }

  // ── HTTP fallback ─────────────────────────────────────────────────────────
  return _httpPost(body);
}

// ─────────────────────────────────────────────────────────────────────────────
bool MyIoTClass::_httpPost(const String& body)
{
  if (!_wifiReady) return false;

  HTTPClient http;
  String url = String(_httpBase) + "/api/device/data";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key",    _apiKey);
  http.setTimeout(MYIOT_HTTP_TIMEOUT_MS);

  int  code = http.POST(body);
  bool ok   = (code >= 200 && code < 300);
  if (!ok) Serial.printf("[MyIoT] HTTP POST → %d\n", code);
  http.end();
  return ok;
}

// ─── HTTP GET poll: read server-set values for subscribed pins ────────────────
bool MyIoTClass::_httpPollPins()
{
  if (!_wifiReady || _pinCount == 0) return false;

  // Build ?pins=V0,V2,V3
  String url = String(_httpBase) + "/api/device/state?pins=";
  for (uint8_t i = 0; i < _pinCount; i++) {
    if (i > 0) url += ',';
    url += 'V';
    url += String(_pins[i].pin);
  }

  HTTPClient http;
  http.begin(url);
  http.addHeader("x-api-key", _apiKey);
  http.setTimeout(MYIOT_HTTP_TIMEOUT_MS);

  int code = http.GET();
  if (code < 200 || code >= 300) {
    http.end();
    return false;
  }

  String response = http.getString();
  http.end();

  // Parse { "V0": 25.3, "V3": 1.0 }
  DynamicJsonDocument doc(MYIOT_JSON_DOC_SIZE);
  if (deserializeJson(doc, response) != DeserializationError::Ok) return false;

  for (uint8_t i = 0; i < _pinCount; i++) {
    char key[8];
    snprintf(key, sizeof(key), "V%d", _pins[i].pin);
    if (!doc.containsKey(key)) continue;

    float newVal  = doc[key].as<float>();
    bool  changed = !_pins[i].hasValue ||
                    (fabsf(newVal - _pins[i].value) > 0.0001f);

    _pins[i].value    = newVal;
    _pins[i].hasValue = true;

    if (changed && _pins[i].cb != nullptr) {
      _pins[i].cb(newVal);
    }
  }
  return true;
}

// ─── Find pin cache index ─────────────────────────────────────────────────────
int MyIoTClass::_pinIndex(int pin) const
{
  for (uint8_t i = 0; i < _pinCount; i++) {
    if (_pins[i].pin == (int16_t)pin) return i;
  }
  return -1;
}

// ─── MQTT inbound message handler ────────────────────────────────────────────
void MyIoTClass::_onMqttMessage(char* topic,
                                  byte* payload,
                                  unsigned int length)
{
  DynamicJsonDocument doc(MYIOT_JSON_DOC_SIZE);
  if (deserializeJson(doc, payload, length) != DeserializationError::Ok) return;

  const char* command = doc["command"] | "";
  for (uint8_t i = 0; i < _cmdCount; i++) {
    if (strcmp(_cmdHandlers[i].event, command) == 0) {
      char payloadBuf[256] = "{}";
      if (doc.containsKey("payload")) {
        serializeJson(doc["payload"], payloadBuf, sizeof(payloadBuf));
      }
      _cmdHandlers[i].cb(payloadBuf);
    }
  }
}

void MyIoTClass::_mqttCallback(char* topic, byte* payload, unsigned int length)
{
  if (_instance) _instance->_onMqttMessage(topic, payload, length);
}

// ─── Global singleton ─────────────────────────────────────────────────────────
MyIoTClass MyIoT;
