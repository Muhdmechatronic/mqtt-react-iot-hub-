// IoTPlatform.cpp — Implementation of the bidirectional virtual pin library.
// See IoTPlatform.h for API documentation.

#include "IoTPlatform.h"

// ─────────────────────────────────────────────────────────────────────────────
IoTPlatform::IoTPlatform()
  : _port(3000),
    _subCount(0),
    _syncIntervalMs(IOT_DEFAULT_SYNC_MS),
    _lastSyncMs(0),
    _lastStatus(IOT_OK)
{
  _ssid[0] = _password[0] = _host[0] = _apiKey[0] = '\0';

  for (int i = 0; i < IOT_MAX_SUBSCRIPTIONS; i++) {
    _subPins[i]      = -1;
    _subCbs[i]       = nullptr;
    _cache[i].pin      = -1;
    _cache[i].value    = 0.0f;
    _cache[i].hasValue = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
void IoTPlatform::begin(const char* ssid,
                        const char* password,
                        const char* serverHost,
                        uint16_t    serverPort,
                        const char* apiKey,
                        uint32_t    wifiTimeoutMs)
{
  strncpy(_ssid,     ssid,       sizeof(_ssid)     - 1);
  strncpy(_password, password,   sizeof(_password) - 1);
  strncpy(_host,     serverHost, sizeof(_host)     - 1);
  strncpy(_apiKey,   apiKey,     sizeof(_apiKey)   - 1);
  _port = serverPort;

  WiFi.mode(WIFI_STA);
  WiFi.begin(_ssid, _password);

  Serial.printf("[IoT] Connecting to Wi-Fi: %s", _ssid);
  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < wifiTimeoutMs) {
    delay(500);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[IoT] Connected  IP=%s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[IoT] Server     http://%s:%u\n", _host, _port);
    _lastStatus = IOT_OK;
  } else {
    Serial.println("[IoT] Wi-Fi timed out — continuing offline");
    _lastStatus = IOT_ERR_WIFI;
  }
}

// ─── Write: single pin ────────────────────────────────────────────────────────
bool IoTPlatform::writeVirtualPin(int pin, float value, const char* unit)
{
  if (pin < 0 || pin > 255) { _lastStatus = IOT_ERR_INVALID_PIN; return false; }
  if (!isConnected())        { _lastStatus = IOT_ERR_WIFI;        return false; }

  // Build JSON body:  { "data": {"V0": 25.3}, "units": {"V0": "°C"} }
  DynamicJsonDocument doc(IOT_JSON_DOC_SIZE);
  char key[8];
  snprintf(key, sizeof(key), "V%d", pin);

  doc["data"][key] = value;
  if (unit && unit[0] != '\0') doc["units"][key] = unit;

  String body;
  serializeJson(doc, body);

  String response;
  bool ok = _post("/api/device/data", body, response);
  _lastStatus = ok ? IOT_OK : IOT_ERR_HTTP;
  return ok;
}

// ─── Write: multiple pins in one request ──────────────────────────────────────
bool IoTPlatform::writeVirtualPins(const int*   pins,
                                    const float* values,
                                    int          count,
                                    const char** units)
{
  if (count <= 0)     return true;
  if (!isConnected()) { _lastStatus = IOT_ERR_WIFI; return false; }

  DynamicJsonDocument doc(IOT_JSON_DOC_SIZE);
  JsonObject data     = doc.createNestedObject("data");
  JsonObject unitsObj = doc.createNestedObject("units");

  for (int i = 0; i < count; i++) {
    if (pins[i] < 0 || pins[i] > 255) continue;
    char key[8];
    snprintf(key, sizeof(key), "V%d", pins[i]);
    data[key] = values[i];
    if (units && units[i] && units[i][0] != '\0') unitsObj[key] = units[i];
  }

  String body;
  serializeJson(doc, body);

  String response;
  bool ok = _post("/api/device/data", body, response);
  _lastStatus = ok ? IOT_OK : IOT_ERR_HTTP;
  return ok;
}

// ─── Read: return locally cached value ────────────────────────────────────────
float IoTPlatform::readVirtualPin(int pin, float defaultValue) const
{
  int idx = _cacheIndexOf(pin);
  if (idx < 0 || !_cache[idx].hasValue) return defaultValue;
  return _cache[idx].value;
}

// ─── Subscribe a pin for automatic polling ────────────────────────────────────
void IoTPlatform::subscribePin(int pin, PinChangeCallback callback)
{
  if (_subCount >= IOT_MAX_SUBSCRIPTIONS) {
    Serial.printf("[IoT] subscribePin(%d): max %d subscriptions reached\n",
                  pin, IOT_MAX_SUBSCRIPTIONS);
    return;
  }
  if (_cacheIndexOf(pin) >= 0) return;  // already subscribed

  int i          = _subCount++;
  _subPins[i]    = pin;
  _subCbs[i]     = callback;
  _cache[i].pin      = (int16_t)pin;
  _cache[i].value    = 0.0f;
  _cache[i].hasValue = false;
}

// ─── Override poll interval ───────────────────────────────────────────────────
void IoTPlatform::setSyncInterval(uint32_t intervalMs)
{
  _syncIntervalMs = intervalMs;
}

// ─── Manual poll: GET /api/device/state?pins=V2,V3 ───────────────────────────
bool IoTPlatform::pollSubscribedPins()
{
  if (_subCount == 0) return true;
  if (!isConnected()) { _lastStatus = IOT_ERR_WIFI; return false; }

  // Build query string
  String path = "/api/device/state?pins=";
  for (int i = 0; i < _subCount; i++) {
    if (i > 0) path += ',';
    path += 'V';
    path += String(_subPins[i]);
  }

  String response;
  if (!_get(path, response)) {
    _lastStatus = IOT_ERR_HTTP;
    return false;
  }

  // Parse JSON response: { "V2": 75.0, "V3": 1.0, ... }
  DynamicJsonDocument doc(IOT_JSON_DOC_SIZE);
  if (deserializeJson(doc, response) != DeserializationError::Ok) {
    Serial.println("[IoT] pollSubscribedPins: JSON parse error");
    _lastStatus = IOT_ERR_JSON;
    return false;
  }

  for (int i = 0; i < _subCount; i++) {
    char key[8];
    snprintf(key, sizeof(key), "V%d", _subPins[i]);
    if (!doc.containsKey(key)) continue;

    float newVal  = doc[key].as<float>();
    bool  changed = !_cache[i].hasValue ||
                    (fabsf(newVal - _cache[i].value) > 0.0001f);

    _cache[i].value    = newVal;
    _cache[i].hasValue = true;

    if (changed && _subCbs[i] != nullptr) {
      _subCbs[i](_subPins[i], newVal);
    }
  }

  _lastStatus = IOT_OK;
  return true;
}

// ─── Main loop driver ─────────────────────────────────────────────────────────
void IoTPlatform::sync()
{
  // Guard: check Wi-Fi first; reconnect if lost (may briefly block)
  if (!isConnected()) {
    _reconnectWiFi();
    return;
  }

  uint32_t now = millis();
  if (_subCount > 0 && (now - _lastSyncMs) >= _syncIntervalMs) {
    _lastSyncMs = now;
    pollSubscribedPins();
  }
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────
bool IoTPlatform::isConnected() const
{
  return WiFi.status() == WL_CONNECTED;
}

IoTStatus IoTPlatform::lastStatus() const
{
  return _lastStatus;
}

// ─── Private: HTTP POST ───────────────────────────────────────────────────────
bool IoTPlatform::_post(const String& path, const String& body, String& response)
{
  HTTPClient http;
  http.begin(_url(path));
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key",    _apiKey);
  http.setTimeout(IOT_HTTP_TIMEOUT_MS);

  int  code = http.POST(body);
  bool ok   = (code >= 200 && code < 300);

  if (ok) {
    response = http.getString();
  } else {
    Serial.printf("[IoT] POST %s → HTTP %d\n", path.c_str(), code);
  }

  http.end();
  return ok;
}

// ─── Private: HTTP GET ────────────────────────────────────────────────────────
bool IoTPlatform::_get(const String& path, String& response)
{
  HTTPClient http;
  http.begin(_url(path));
  http.addHeader("x-api-key", _apiKey);
  http.setTimeout(IOT_HTTP_TIMEOUT_MS);

  int  code = http.GET();
  bool ok   = (code >= 200 && code < 300);

  if (ok) {
    response = http.getString();
  } else {
    Serial.printf("[IoT] GET %s → HTTP %d\n", path.c_str(), code);
  }

  http.end();
  return ok;
}

// ─── Private: Wi-Fi reconnect (blocking, max 10 s) ───────────────────────────
void IoTPlatform::_reconnectWiFi()
{
  Serial.print("[IoT] Wi-Fi lost — reconnecting");
  WiFi.disconnect(true);
  WiFi.begin(_ssid, _password);

  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
    delay(500);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[IoT] Reconnected  IP=%s\n", WiFi.localIP().toString().c_str());
    _lastStatus = IOT_OK;
  } else {
    Serial.println("[IoT] Reconnect failed");
    _lastStatus = IOT_ERR_WIFI;
  }
}

// ─── Private: look up cache slot index for a given pin ───────────────────────
int IoTPlatform::_cacheIndexOf(int pin) const
{
  for (int i = 0; i < _subCount; i++) {
    if (_subPins[i] == pin) return i;
  }
  return -1;
}

// ─── Private: build full URL ──────────────────────────────────────────────────
String IoTPlatform::_url(const String& path) const
{
  return String("http://") + _host + ':' + _port + path;
}
