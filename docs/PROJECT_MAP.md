# IoT Platform — Project File Map

Quick reference for locating every file in the project, what it does, and where to look when something needs to be upgraded or repaired.

---

## Directory Tree

```
iot-platform/
├── arduino-library/
│   └── MyIoTSDK/
│       ├── library.properties          ← Library metadata (name, version, author)
│       └── src/
│           ├── MyIoTSDK.h              ← C++ header — API surface for device developers
│           └── MyIoTSDK.cpp            ← C++ implementation — WiFi, MQTT, HTTP helpers
│
├── backend/                            ← Node.js 20 / Express API server
│   ├── server.js                       ← Entry point — Express app, Socket.IO, startup
│   ├── package.json                    ← Dependencies and npm scripts
│   ├── Dockerfile                      ← Container build for backend
│   ├── .env.example                    ← Template for environment variables (copy → .env)
│   ├── config/
│   │   └── db.js                       ← MySQL connection pool (mysql2/promise)
│   ├── middleware/
│   │   └── auth.js                     ← JWT verification middleware
│   ├── routes/
│   │   ├── auth.js                     ← POST /auth/register, POST /auth/login
│   │   ├── device.js                   ← Device CRUD, POST /device/data, POST /device/command
│   │   ├── sensor.js                   ← GET /sensor/latest, /history, /export (CSV stream)
│   │   └── dashboard.js                ← Dashboard + widget CRUD
│   ├── controllers/
│   │   ├── authController.js           ← Parses auth req/res, calls authService
│   │   ├── deviceController.js         ← Parses device req/res, calls deviceService
│   │   ├── sensorController.js         ← Parses sensor req/res, calls sensorService
│   │   └── dashboardController.js      ← Parses dashboard req/res, calls dashboardService
│   ├── services/
│   │   ├── authService.js              ← Register, login, bcrypt, JWT sign
│   │   ├── deviceService.js            ← Device registration, api_key generation, commands
│   │   ├── sensorService.js            ← Save sensor data, query history, stream CSV
│   │   └── dashboardService.js         ← Dashboard + widget persistence
│   ├── mqtt/
│   │   └── gateway.js                  ← MQTT broker connection, topic routing, data normalisation
│   └── websocket/
│       └── handler.js                  ← Socket.IO event handling (subscribe/unsubscribe device)
│
├── frontend/                           ← React 18 + Vite
│   ├── index.html                      ← HTML shell
│   ├── vite.config.js                  ← Vite build config, proxy /api → backend
│   ├── package.json
│   ├── Dockerfile                      ← Multi-stage build → Nginx image
│   ├── nginx.conf                      ← Nginx config for SPA routing
│   └── src/
│       ├── main.jsx                    ← React app root, router setup
│       ├── App.jsx                     ← Route definitions
│       ├── context/
│       │   └── AuthContext.jsx         ← JWT token + user state, login/logout helpers
│       ├── services/
│       │   ├── api.js                  ← Axios instance, all REST calls, auth header injection
│       │   └── socket.js               ← Socket.IO client singleton
│       ├── pages/
│       │   ├── LoginPage.jsx           ← Login form
│       │   ├── RegisterPage.jsx        ← Registration form
│       │   ├── DashboardPage.jsx       ← Main dashboard view with real-time widget grid
│       │   ├── DevicesPage.jsx         ← Device list, register device, copy API key
│       │   └── ExportPage.jsx          ← Sensor CSV export UI
│       ├── components/
│       │   ├── Layout.jsx              ← Sidebar, navbar, page wrapper
│       │   └── AddWidgetModal.jsx      ← Modal to add a new widget to a dashboard
│       └── widgets/
│           ├── WidgetRenderer.jsx      ← Switch on widget.type → renders correct widget
│           ├── GaugeWidget.jsx         ← Circular gauge (min/max/unit/color)
│           ├── LineChartWidget.jsx     ← Real-time line chart (recharts)
│           ├── ButtonWidget.jsx        ← One-shot command button
│           ├── SwitchWidget.jsx        ← Toggle command (on/off state)
│           ├── SliderWidget.jsx        ← Continuous value command
│           ├── LabelWidget.jsx         ← Read-only text display of latest sensor value
│           └── StatusWidget.jsx        ← Online/offline indicator
│
├── database/
│   └── schema.sql                      ← Full MySQL schema (all tables + seed admin user)
│
├── docker/
│   ├── docker-compose.yml              ← Orchestrates MySQL, Mosquitto, backend, frontend
│   └── mosquitto.conf                  ← MQTT broker config (listener, allow_anonymous)
│
├── esp32/
│   └── example/
│       └── esp32_sensor_example.ino    ← Arduino sketch — WiFi + MQTT + DHT22 demo
│
├── simulator/
│   └── sensor_simulator.py             ← Python simulator — sends fake sensor data via MQTT or HTTP (no hardware needed)
│
└── docs/
    ├── API.md                          ← REST + MQTT + WebSocket API reference
    ├── ARCHITECTURE.md                 ← Data flow diagram, module boundaries, security notes
    ├── DEPLOYMENT.md                   ← Local dev, Docker, VPS + Nginx + SSL setup
    ├── DOCKER_TUTORIAL.md              ← Step-by-step Docker walkthrough for beginners
    ├── PROJECT_MAP.md                  ← This file — file map + known issues + upgrade notes
    ├── RASPBERRY_PI.md                 ← Full Raspberry Pi 4 setup guide + simulator usage
    └── ROADMAP.md                      ← Planned phases (Redis, InfluxDB, mobile, AI, SaaS)
```

---

## Database Tables (`database/schema.sql`)

| Table | Primary Key | Purpose |
|---|---|---|
| `users` | `id` | Platform accounts, role = admin \| user |
| `devices` | `id` | IoT devices, each has a unique `api_key` |
| `sensor_data` | `id` (BIGINT) | High-volume time-series readings |
| `dashboards` | `id` | Named dashboard per user |
| `widgets` | `id` | Database-driven widgets linked to dashboards |
| `commands` | `id` (BIGINT) | Commands sent to devices (relay, PWM, etc.) |
| `alerts` | `id` | Threshold-based alert rules per device+sensor |
| `device_logs` | `id` (BIGINT) | Per-device log entries (info / warn / error) |

### Known Issues Fixed

| Column | Table | Problem | Fix Applied |
|---|---|---|---|
| `alert_condition` | `alerts` | `condition` is a reserved keyword in MySQL and many SQL engines — causes parser errors without backtick quoting | Renamed to `alert_condition` in schema (2026-05-27) |

> **When adding alert features:** All backend code (service, controller, route) referencing this column must use `alert_condition`, not `condition`.

---

## Where to Look for Common Tasks

### Add a new widget type
1. `frontend/src/widgets/` — create `YourWidget.jsx`
2. `frontend/src/components/AddWidgetModal.jsx` — add the type to the picker
3. `frontend/src/widgets/WidgetRenderer.jsx` — add `case 'yourtype':`
4. No backend changes needed (widget type is stored as a string in MySQL)

### Add a new API route
1. `backend/routes/` — add route handler
2. `backend/controllers/` — add controller
3. `backend/services/` — add business logic
4. `backend/server.js` — mount the router

### Add a new sensor protocol
- All three protocols (MQTT, HTTP, WebSocket) normalise to the same internal format in `sensorService.js`
- Add a new adapter and call `saveSensorData()` — no other changes needed
- See `docs/ARCHITECTURE.md` for the unified internal format

### Change database schema
1. Edit `database/schema.sql`
2. If Docker is running: `docker exec -i iot_mysql mysql -u iotuser -piotpassword iot_platform < ../database/schema.sql`
3. Update any service files that query the changed table
4. Update this file's table list above

### Add environment variables
1. `backend/.env.example` — add the key with a placeholder value
2. `backend/config/db.js` or `backend/server.js` — read via `process.env`
3. `docker/docker-compose.yml` — add under `environment:` for the backend service
4. `docs/DEPLOYMENT.md` — add to the Environment Variables Reference table

### Update Arduino library
1. `arduino-library/MyIoTSDK/src/MyIoTSDK.h` — update the API
2. `arduino-library/MyIoTSDK/src/MyIoTSDK.cpp` — implement changes
3. `arduino-library/MyIoTSDK/library.properties` — bump `version:`
4. `esp32/example/esp32_sensor_example.ino` — update example usage if needed

---

## Environment Variables Quick Reference

Defined in `backend/.env` (local) or `docker/docker-compose.yml` (Docker).

| Variable | Where used | Notes |
|---|---|---|
| `PORT` | `server.js` | Default 3000 |
| `DB_HOST` | `config/db.js` | Default localhost |
| `DB_PORT` | `config/db.js` | Default 3306 |
| `DB_NAME` | `config/db.js` | Default iot_platform |
| `DB_USER` | `config/db.js` | |
| `DB_PASSWORD` | `config/db.js` | |
| `JWT_SECRET` | `middleware/auth.js`, `services/authService.js` | Must be set in production |
| `JWT_EXPIRES_IN` | `services/authService.js` | Default 7d |
| `MQTT_HOST` | `mqtt/gateway.js` | Default localhost |
| `MQTT_PORT` | `mqtt/gateway.js` | Default 1883 |
| `FRONTEND_URL` | `server.js` | CORS allowed origin |

---

## Ports

| Service | Default Port | Configurable in |
|---|---|---|
| Backend API | 3000 | `.env` → `PORT` |
| Frontend (dev) | 5173 | `vite.config.js` |
| Frontend (Docker/Nginx) | 5173 (mapped to 80) | `docker-compose.yml` |
| MySQL | 3306 | `docker-compose.yml` |
| MQTT | 1883 | `docker-compose.yml`, `mosquitto.conf` |
| MQTT over WebSocket | 9001 | `mosquitto.conf` |
