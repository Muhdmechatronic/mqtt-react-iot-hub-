# IoT Sandbox Dashboard Platform

**A self-hosted, multi-protocol IoT dashboard with a drag-and-drop widget sandbox, omnidirectional real-time sync, an ESP32/ESP8266 Arduino C++ client library, and localized Excel data export.**

[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)](https://mysql.com)
[![MQTT](https://img.shields.io/badge/MQTT-Mosquitto-660066?logo=eclipsemosquitto&logoColor=white)](https://mosquitto.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose)
[![License](https://img.shields.io/badge/License-MIT-0ea5e9)](LICENSE)

---

![IoT Sandbox Dashboard — live dashboard view showing Gauge, LED, Slider, Switch, Push Button, and Line Chart widgets](./images/Screenshot_main_dasboard.png)

*Live dashboard with real-time sensor readings — Gauge (89.7 % humidity, 18.8 °C temperature), LED indicators, Slider, Switch, Push Button, and a Line Chart streaming historical data.*

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture & Features](#architecture--features)
3. [Virtual Pin Mapping Protocol](#virtual-pin-mapping-protocol)
4. [Getting Started](#getting-started)
   - [Option A — Docker (Recommended)](#option-a--docker-recommended)
   - [Option B — Manual Setup](#option-b--manual-setup)
5. [ESP32 / ESP8266 Library](#esp32--esp8266-library)
6. [Python Simulator](#python-simulator)
7. [Data Export & Timezone Handling](#data-export--timezone-handling)
8. [Project Structure](#project-structure)
9. [Configuration Reference](#configuration-reference)
10. [License](#license)

---

## Overview

IoT Sandbox Dashboard is a lightweight alternative to Blynk and ThingsBoard that you fully own and host. It connects physical hardware (ESP32, ESP8266, Raspberry Pi) to a live browser dashboard through a unified tri-protocol gateway (MQTT, HTTP REST, WebSocket). Any value written by a sensor is immediately visible on every connected dashboard — and any widget change on the dashboard is pushed back to the hardware in real time.

The project is designed to be approachable for intermediate students and makers while remaining production-capable for small-scale deployments.

---

## Architecture & Features

### Dashboard Sandbox Editor

- A **live layout editor** built with `react-grid-layout` that lets users freely add, move, resize, and delete widgets.
- Editing happens in an isolated **Sandbox mode** — changes are previewed before being committed to the live dashboard, preventing accidental disruption.
- Per-widget configuration includes color pickers, threshold editors, PWM range controls, and label formatting.
- Supported widget types: **Gauge**, **Line Chart**, **Progress Bar**, **LED** (binary and PWM modes), **Slider**, **Switch**, and **Push Button**.

### Omnidirectional State Sync Engine

- A virtual-pin-based message bus that routes values bidirectionally between hardware and all open browser sessions.
- **Transport stack** with automatic fallback:
  1. **MQTT** (primary) — lowest latency; published to `iot/{api_key}/sensor` and `iot/{api_key}/pin/{n}`
  2. **WebSocket** — persistent browser connections via Socket.IO
  3. **HTTP REST** — stateless fallback for constrained devices
- All three transports write to the same `sensor_data` table with a unified JSON schema: `{ "data": { "V0": 24.5 }, "units": { "V0": "°C" } }`
- **Origin-echo suppression** prevents a widget from receiving its own write back as an update.
- **Sequence guard** discards stale payloads when two sources race to update the same pin.

### ESP32 / ESP8266 Arduino Library (`MyIoTSDK`)

- Professional-grade Arduino library with MQTT primary transport and HTTP automatic fallback.
- `writePin()` / `writePins()` — send sensor readings to the dashboard.
- `readPin()` / `onPin()` — poll or callback-receive dashboard-set values (Slider, Switch).
- `loop()` — single call handles Wi-Fi keepalive, MQTT reconnect, heartbeat, and HTTP pin polling.
- Fully compatible with ESP32 and ESP8266 boards.
- Three bundled examples: `BasicSensor`, `VirtualPins`, `FullSimulator`.

### Session Security

- JWT authentication with configurable expiry (default **8 hours**).
- Frontend enforces a **30-minute inactivity timeout** — any mouse, keyboard, scroll, or touch event resets the countdown.
- All 401 responses from the API automatically clear the session and redirect to the login page.
- Token expiry is also checked on page load and every 60 seconds while the app is open.

### Malaysia-Time-Localized Excel Export

- Multi-select virtual pin checkboxes — all pins selected by default.
- Optional date-time range filter (inputs interpreted as MYT, UTC+8).
- Data fetched as JSON from the backend (raw UTC); timezone conversion performed entirely on the client.
- Output: a styled `.xlsx` file with frozen header row and column-width formatting.
- Filename pattern: `device_data_export_{device_id}_{YYYY-MM-DD}.xlsx`

### Device Heartbeat & Offline Detection

- Every data push (HTTP POST, MQTT sensor, WebSocket) stamps `last_ping_at` so the sweeper has a consistent activity timestamp regardless of transport.
- Background worker runs every 10 seconds; any device silent for more than 30 seconds is marked **Offline**.
- Status change emitted via WebSocket to both the Devices page badge and any open dashboard widgets.
- Immediate offline detection for WebSocket-connected devices on TCP close (no need to wait for the sweeper).

---

## Virtual Pin Mapping Protocol

Virtual pins (`V0`–`V255`) are the shared address space between hardware and dashboard widgets. A datastream definition binds a pin number to a name, data type, unit, and display range.

| Pin | Name              | Type    | Direction      | Unit | Range / Behaviour                          |
|-----|-------------------|---------|----------------|------|--------------------------------------------|
| V0  | `temperature`     | double  | Device → Server | °C  | Linear ramp 15 °C → 40 °C (60-second period) |
| V1  | `humidity`        | double  | Device → Server | %   | Sine wave 30 % → 90 % (40-second period)  |
| V2  | `led_pwm`         | double  | Bidirectional  | %    | Triangle sweep 0 → 100 %; also accepts Slider input from dashboard |
| V3  | `relay`           | integer | Bidirectional  | —    | Binary toggle 0 ↔ 1 every 4 seconds; also mirrors dashboard Switch |
| V4  | `button`          | integer | Device → Server | —   | Transient pulse: HIGH (1) for 1 second, LOW (0) for 6 seconds      |

> **Naming convention:** the data key in every JSON payload is `V{pin}` — e.g. `"V0"`, `"V3"`. Widget datastreams on the dashboard are bound to this key via their `virtual_pin` field.

---

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) (recommended path)
- **or** Node.js 20+, MySQL 8, and a Mosquitto MQTT broker for the manual path

### Option A — Docker (Recommended)

The Docker Compose file starts the backend, frontend, MySQL database, and Mosquitto broker together.

```bash
# 1. Clone the repository
git clone https://github.com/your-username/iot-sandbox-dashboard.git
cd iot-sandbox-dashboard

# 2. Copy the environment template and fill in secrets
cp docker/.env.example docker/.env
#    At minimum set: JWT_SECRET, DB_PASSWORD

# 3. Start all services
cd docker
docker compose up -d

# 4. Open the dashboard
#    http://localhost:5173
#    Default credentials: admin@iotplatform.local / admin123
```

> On first boot the backend automatically creates the admin user and runs any pending column migrations. No manual `schema.sql` import is required when using Docker.

### Option B — Manual Setup

#### Database

```bash
# Create the database and apply the base schema
mysql -u root -p -e "CREATE DATABASE iot_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p iot_platform < database/schema.sql
```

#### Backend

```bash
cd backend
npm install

# Create a .env file (see Configuration Reference below)
cp .env.example .env

npm run dev          # development (nodemon)
# npm start          # production
```

#### Frontend

```bash
cd frontend
npm install
npm run dev          # Vite dev server → http://localhost:5173
# npm run build      # production build → dist/
```

#### MQTT Broker

Any Mosquitto-compatible broker works. A ready-made `mosquitto.conf` is provided in `docker/`.

```bash
mosquitto -c docker/mosquitto.conf
```

---

## ESP32 / ESP8266 Library

The `MyIoTSDK` library lives in `arduino-library/MyIoTSDK/`. Install it via the Arduino IDE
(**Sketch → Include Library → Add .ZIP Library**) or add it to `platformio.ini` as a local dependency.

**Required library dependencies** (install via Library Manager):

| Library       | Author            | Version |
|---------------|-------------------|---------|
| PubSubClient  | Nick O'Leary      | ≥ 2.8   |
| ArduinoJson   | Benoît Blanchon   | ≥ 6.0   |

### Basic Sketch

```cpp
#include <MyIoTSDK.h>

const char* WIFI_SSID   = "YourWiFiSSID";
const char* WIFI_PASS   = "YourWiFiPassword";
const char* SERVER_HOST = "192.168.1.100"; // IP of the host running Docker
const char* API_KEY     = "paste-your-device-api-key-here";

void setup() {
  Serial.begin(115200);

  // Connect to Wi-Fi and authenticate with the platform
  MyIoT.begin(WIFI_SSID, WIFI_PASS);
  MyIoT.connect(API_KEY, SERVER_HOST);

  // React when the dashboard Slider changes V2 (LED brightness)
  MyIoT.onPin(2, [](float percent) {
    ledcWrite(0, (uint8_t)(percent * 2.55f)); // 0–100 % → 0–255 PWM duty
  });

  // React when the dashboard Switch changes V3 (relay)
  MyIoT.onPin(3, [](float val) {
    digitalWrite(26, val > 0.5f ? HIGH : LOW);
  });
}

void loop() {
  // Must be called every iteration — handles MQTT, Wi-Fi, polling, callbacks
  MyIoT.loop();

  // Send a temperature reading on V0 every 3 seconds
  static unsigned long last = 0;
  if (millis() - last >= 3000) {
    last = millis();
    float temp = 22.0f + 3.0f * sinf(millis() / 10000.0f);
    MyIoT.writePin(0, temp, "\xC2\xB0""C"); // "°C" in UTF-8
  }
}
```

### Batch Write (efficient multi-sensor update)

```cpp
const int   pins[]   = { 0, 1 };
const float values[] = { 24.5f, 68.0f };
const char* units[]  = { "\xC2\xB0""C", "%" };
MyIoT.writePins(pins, values, 2, units); // single HTTP POST for both sensors
```

### Full Simulation Sketch

`arduino-library/MyIoTSDK/examples/FullSimulator/FullSimulator.ino` runs all five virtual-pin channels simultaneously using non-blocking `millis()` timers — the hardware equivalent of `python sensor_simulator.py --mode demo`.

---

## Python Simulator

`simulator/sensor_simulator.py` lets you test the full platform without any physical hardware.

```bash
pip install requests

# Run all five channels at once (matches FullSimulator.ino)
python simulator/sensor_simulator.py \
  --api-key YOUR_API_KEY \
  --host 192.168.1.100 \
  --mode demo

# Single-channel options
python simulator/sensor_simulator.py --mode sensor   # V0 temperature ramp
python simulator/sensor_simulator.py --mode led      # V2 PWM sweep
python simulator/sensor_simulator.py --mode switch   # V3 binary toggle
python simulator/sensor_simulator.py --mode button   # V4 pulse train
```

| Flag                | Default | Description                                      |
|---------------------|---------|--------------------------------------------------|
| `--api-key`         | —       | Device API key from the Devices page (required)  |
| `--host`            | `localhost` | Backend host                                 |
| `--port`            | `3000`  | Backend HTTP port                                |
| `--mode`            | `demo`  | `demo` \| `sensor` \| `led` \| `switch` \| `button` |
| `--pin`             | auto    | Override virtual pin number                      |
| `--interval`        | `1.0`   | Seconds between updates                          |
| `--ramp-time`       | `60`    | Seconds for one full temperature ramp cycle      |
| `--toggle-interval` | `4.0`   | Seconds between switch toggles                   |
| `--press-time`      | `1.0`   | Duration in seconds of each button press pulse   |

---

## Data Export & Timezone Handling

> **Important:** All sensor timestamps are stored in the database as **UTC**. Neither the schema nor any API endpoint converts or shifts timezone values. This is an intentional design decision that keeps the historical record portable and unambiguous.

Timezone localization is handled entirely on the **client side** at export time:

1. The frontend calls `GET /api/sensor/export-json` which returns raw UTC timestamps as ISO 8601 strings.
2. A pure JavaScript conversion adds the **Malaysia Time (MYT) fixed offset of UTC+8** to each timestamp:
   ```js
   const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;
   const myt = new Date(new Date(utcString).getTime() + MYT_OFFSET_MS);
   ```
3. The converted timestamps (formatted `YYYY-MM-DD HH:MM:SS`) are written into column A of the Excel file, which is explicitly labelled **Timestamp (Malaysia Time)**.

The server-side UTC data is never modified. Users in other timezones can adapt the offset constant in `ExportPage.jsx` without any backend changes.

---

## Project Structure

```
iot-sandbox-dashboard/
├── arduino-library/
│   └── MyIoTSDK/               # ESP32/ESP8266 Arduino library (v2.0.0)
│       ├── src/
│       │   ├── MyIoTSDK.h
│       │   └── MyIoTSDK.cpp
│       ├── examples/
│       │   ├── BasicSensor/
│       │   ├── VirtualPins/
│       │   └── FullSimulator/
│       ├── library.json
│       ├── library.properties
│       └── README.md
├── backend/
│   ├── config/                 # Database pool
│   ├── controllers/            # Route handlers
│   ├── middleware/             # JWT authentication
│   ├── mqtt/                   # MQTT gateway (Mosquitto bridge)
│   ├── routes/                 # Express router definitions
│   ├── services/               # Business logic & DB queries
│   ├── utils/                  # Shared helpers (parseMYT, coerce)
│   ├── websocket/              # Socket.IO handler & pin sync engine
│   ├── heartbeatWorker.js      # Background offline-detection sweeper
│   └── server.js               # Entry point
├── database/
│   ├── schema.sql              # Full database schema + seed data
│   └── migration_*.sql         # Incremental column migrations
├── docker/
│   ├── docker-compose.yml
│   └── mosquitto.conf
├── frontend/
│   └── src/
│       ├── components/         # Layout, modals, widget settings panels
│       ├── context/            # AuthContext (JWT + inactivity timeout)
│       ├── hooks/              # useVirtualPinSync
│       ├── pages/              # DevicesPage, DashboardPage, SandboxPage, ExportPage …
│       ├── services/           # Axios instance + Socket.IO client
│       └── widgets/            # Gauge, LED, Slider, Switch, Button, Chart, ProgressBar
└── simulator/
    └── sensor_simulator.py     # Python CLI hardware simulator
```

---

## Configuration Reference

Create a `.env` file in the `backend/` directory (or pass via Docker Compose environment):

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=iot_platform
DB_USER=root
DB_PASSWORD=your_secure_password

# Authentication
JWT_SECRET=a-long-random-string-minimum-32-characters
JWT_EXPIRES_IN=8h          # e.g. 8h, 24h, 7d

# MQTT Broker
MQTT_HOST=localhost
MQTT_PORT=1883

# Server
PORT=3000
FRONTEND_URL=http://localhost:5173   # CORS origin; use * for LAN access
```

| Variable         | Default               | Description                                      |
|------------------|-----------------------|--------------------------------------------------|
| `JWT_SECRET`     | —                     | **Required.** Sign secret for JSON Web Tokens    |
| `JWT_EXPIRES_IN` | `8h`                  | Token lifetime — balance security vs convenience |
| `MQTT_HOST`      | `localhost`           | Mosquitto broker host                            |
| `FRONTEND_URL`   | `*`                   | CORS origin; restrict to your domain in production |
| `DB_PASSWORD`    | —                     | **Required.** MySQL password                     |

---

## License

This project is released under the [MIT License](LICENSE).

---

*Built for students, makers, and small-scale IoT deployments. Inspired by Blynk and ThingsBoard.*
#   m q t t - r e a c t - i o t - h u b -  
 