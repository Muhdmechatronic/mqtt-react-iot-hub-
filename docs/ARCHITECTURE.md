# IoT Platform — System Architecture

## Data Flow

```
┌─────────────────────────────────────────────────────┐
│                   IoT Devices                        │
│  ESP32 / ESP8266 / Raspberry Pi                      │
│  using MyIoTSDK library                              │
└──────────┬─────────────┬──────────────┬─────────────┘
           │ MQTT        │ HTTP REST    │ WebSocket
           ▼             ▼              ▼
┌─────────────────────────────────────────────────────┐
│              Node.js IoT Gateway                     │
│                                                      │
│  mqtt/gateway.js ──┐                                │
│  POST /device/data ┼──► Unified Processor           │
│  ws device_data ───┘    { device_id, protocol,      │
│                            event_type, data, ts }    │
│                                ▼                     │
│                         sensorService.js             │
│                                ▼                     │
│                           MySQL DB                   │
│                                ▼                     │
│                    Socket.IO emit → React UI          │
└─────────────────────────────────────────────────────┘
```

## Unified Internal Format

All data from ALL protocols is normalised to:
```json
{
  "device_id": 1,
  "protocol": "mqtt | http | websocket",
  "event_type": "sensor | status",
  "data": { "temperature": 28.5, "humidity": 70 },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```
This means adding a 4th protocol = implement one adapter, plug into saveSensorData().

## Dynamic Widget Engine

Widgets are stored in MySQL and rendered dynamically:

```
Database widget row
  { type, title, device_id, data_key, settings_json }
          ↓
  WidgetRenderer.jsx
  switch(widget.type) { ... }
          ↓
  GaugeWidget / LineChartWidget / ButtonWidget / etc.
```

Adding a new widget type:
1. Add a row `type: 'heatmap'` to widgets table
2. Create `HeatmapWidget.jsx`
3. Add `case 'heatmap':` to WidgetRenderer.jsx

Zero backend changes needed.

## Module Boundaries

```
backend/
  config/     ← DB pool only
  services/   ← All business logic (NO HTTP concerns)
  controllers/ ← Parse req/res, call services, emit io
  routes/     ← Express routing only
  mqtt/       ← MQTT subscription and normalisation
  websocket/  ← Socket.IO event handling
  middleware/ ← JWT auth

frontend/
  services/   ← API calls, socket instance
  context/    ← AuthContext (token, user)
  widgets/    ← One file per widget type
  pages/      ← Route-level components
  components/ ← Shared UI (Layout, modals)
```

## Security Notes
- All user-facing routes require JWT except `POST /device/data` (uses api_key)
- api_key is a 32-char UUID hex, unique per device
- Passwords are bcrypt-hashed (cost factor 10)
- JWT expires in 7 days by default
- CORS is locked to FRONTEND_URL env var
- In production: use MQTT authentication, HTTPS everywhere, set a strong JWT_SECRET
