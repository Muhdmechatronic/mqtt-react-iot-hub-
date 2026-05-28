# IoT Platform — API Documentation

Base URL: `http://localhost:3000/api`

All authenticated routes require:
```
Authorization: Bearer <jwt_token>
```

---

## Authentication

### POST /auth/register
Register a new user.

**Body:**
```json
{ "name": "Alice", "email": "alice@example.com", "password": "secret123" }
```
**Response 201:**
```json
{ "message": "Registered successfully", "user": { "id": 1, "name": "Alice", "email": "alice@example.com" } }
```

---

### POST /auth/login
Login and get JWT token.

**Body:**
```json
{ "email": "alice@example.com", "password": "secret123" }
```
**Response 200:**
```json
{
  "token": "eyJhbGci...",
  "user": { "id": 1, "name": "Alice", "email": "alice@example.com", "role": "user" }
}
```

---

## Devices

### POST /device/register  `[auth]`
Register a new IoT device.

**Body:**
```json
{ "name": "Living Room Sensor", "device_type": "esp32", "description": "Optional" }
```
**Response 201:**
```json
{ "id": 1, "name": "Living Room Sensor", "device_type": "esp32", "api_key": "abc123..." }
```

---

### GET /device/list  `[auth]`
List all devices for the current user.

**Response 200:** Array of device objects.

---

### POST /device/data  `[api_key]`
Push sensor data via HTTP (MQTT fallback).

**Headers:** `x-api-key: your_device_api_key`

**Body:**
```json
{
  "data": { "temperature": 28.5, "humidity": 70 },
  "timestamp": "2024-01-15T10:30:00Z"
}
```
**Response 200:**
```json
{ "message": "Data received", "device_id": 1 }
```

---

### POST /device/command  `[auth]`
Send a command to a device (relay, PWM, etc.).

**Body:**
```json
{ "device_id": 1, "command": "relay", "payload": { "state": 1 } }
```
**Response 200:**
```json
{ "message": "Command sent", "command_id": 42 }
```

---

## Sensor Data

### GET /sensor/latest  `[auth]`
Get latest sensor readings for a device.

**Query:** `?device_id=1`

**Response 200:** Array of `{ sensor_type, value, unit, protocol, timestamp }`

---

### GET /sensor/history  `[auth]`
Get historical sensor data.

**Query:** `?device_id=1&sensor_type=temperature&start_date=2024-01-01&end_date=2024-01-31&limit=1000`

---

### GET /sensor/export  `[auth]`
**Streaming CSV download** — does NOT load all data into memory.

**Query:** `?device_id=1&sensor_type=temperature&start_date=2024-01-01&end_date=2024-01-31`

**Response:** `Content-Type: text/csv`
```
timestamp,device_id,sensor_type,value
2024-01-01T10:00:00.000Z,1,temperature,28.5
2024-01-01T10:05:00.000Z,1,temperature,29.1
```

---

## Dashboards & Widgets

### GET /dashboard  `[auth]`
List all dashboards.

### POST /dashboard  `[auth]`
```json
{ "name": "Home Dashboard", "description": "Optional" }
```

### GET /dashboard/:dashboard_id/widgets  `[auth]`
Get all widgets for a dashboard (database-driven).

### POST /dashboard/:dashboard_id/widgets  `[auth]`
Add a widget dynamically.

```json
{
  "type": "gauge",
  "title": "Temperature",
  "device_id": 1,
  "data_key": "temperature",
  "x": 0, "y": 0, "w": 3, "h": 3,
  "settings": { "min": 0, "max": 50, "unit": "°C", "color": "#f97316" }
}
```

Widget types: `button` | `switch` | `gauge` | `linechart` | `slider` | `label` | `status`

### PUT /dashboard/widgets/:widget_id/layout  `[auth]`
Update widget position/size after drag.
```json
{ "x": 3, "y": 0, "w": 4, "h": 3 }
```

### DELETE /dashboard/widgets/:widget_id  `[auth]`
Remove a widget.

---

## MQTT Protocol

Topic structure:
```
iot/{api_key}/sensor    ← device → server (sensor data)
iot/{api_key}/status    ← device → server (online/offline)
iot/{api_key}/command   ← server → device (commands)
```

Sensor payload:
```json
{ "data": { "temperature": 28.5, "humidity": 70 }, "timestamp": "2024-01-15T10:30:00Z" }
```

Command payload:
```json
{ "command": "relay", "payload": { "state": 1 } }
```

---

## WebSocket Events

Connect with `{ auth: { token: "Bearer ..." } }`

| Event (emit)          | Direction      | Payload                                 |
|-----------------------|----------------|-----------------------------------------|
| `subscribe_device`    | client→server  | `{ device_id: 1 }`                      |
| `unsubscribe_device`  | client→server  | `{ device_id: 1 }`                      |
| `device_data`         | device→server  | `{ api_key, data, timestamp }`          |
| `sensor_update`       | server→client  | `{ device_id, protocol, data, timestamp }` |
| `device_status`       | server→client  | `{ device_id, online }`                 |
| `command`             | server→client  | `{ command, payload }`                  |
