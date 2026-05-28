# Running IoT Platform with Docker — Step by Step

## What Docker Will Start

```
┌─────────────────────────────────────────┐
│  docker compose up -d                   │
│                                         │
│  ┌──────────┐  ┌──────────┐            │
│  │  MySQL   │  │Mosquitto │            │
│  │  :3306   │  │  :1883   │            │
│  └──────────┘  └──────────┘            │
│  ┌──────────┐  ┌──────────┐            │
│  │ Backend  │  │Frontend  │            │
│  │  :3000   │  │  :5173   │            │
│  └──────────┘  └──────────┘            │
└─────────────────────────────────────────┘
```

---

## Step 1 — Install Docker Desktop

### Windows / Mac
Download and install from: https://www.docker.com/products/docker-desktop/

After install, open Docker Desktop and wait until you see **"Docker is running"** in the bottom-left corner.

Verify in terminal:
```bash
docker --version
docker compose version
```

Expected output:
```
Docker version 24.x.x
Docker Compose version v2.x.x
```

### Ubuntu/Debian Linux
```bash
sudo apt update
sudo apt install docker.io docker-compose-plugin -y
sudo systemctl enable docker
sudo systemctl start docker

# Allow your user to run docker without sudo
sudo usermod -aG docker $USER
newgrp docker
```

---

## Step 2 — Clone / Go to the Project Folder

```bash
cd iot-platform
```

Your folder structure should look like:
```
iot-platform/
├── backend/
├── frontend/
├── database/
│   └── schema.sql      ← imported automatically on first run
├── docker/
│   ├── docker-compose.yml
│   └── mosquitto.conf
└── docs/
```

---

## Step 3 — Set Your JWT Secret (Important!)

Open `docker/docker-compose.yml` and find this line:

```yaml
JWT_SECRET: CHANGE_THIS_LONG_RANDOM_SECRET
```

Replace it with a long random string. Generate one with:

```bash
# Linux/Mac
openssl rand -hex 32

# Windows PowerShell
[System.Web.Security.Membership]::GeneratePassword(32,0)
# or just type any long random string like:
# JWT_SECRET: x7Kp2mQw9nLrT4vAjY8sBcDfGhNeUiOz
```

---

## Step 4 — Build and Start All Services

```bash
cd iot-platform/docker
docker compose up -d --build
```

The `--build` flag builds the backend and frontend images from source.  
The `-d` flag runs everything in the background.

First run takes **3–5 minutes** (downloading base images, installing npm packages, building React app).

Watch the progress:
```bash
docker compose logs -f
```

Press `Ctrl+C` to stop watching logs (services keep running).

---

## Step 5 — Verify Everything Is Running

```bash
docker compose ps
```

Expected output — all services should show **"Up"** or **"healthy"**:

```
NAME            STATUS          PORTS
iot_mysql       Up (healthy)    0.0.0.0:3306->3306/tcp
iot_mqtt        Up              0.0.0.0:1883->1883/tcp
iot_backend     Up              0.0.0.0:3000->3000/tcp
iot_frontend    Up              0.0.0.0:5173->80/tcp
```

If a service is **"Restarting"**, check its logs:
```bash
docker compose logs backend
docker compose logs mysql
```

---

## Step 6 — Test the Backend API

```bash
curl http://localhost:3000/health
```

Expected:
```json
{"status":"ok","ts":"2024-01-15T10:30:00.000Z"}
```

---

## Step 7 — Open the Dashboard

Open your browser and go to:

```
http://localhost:5173
```

Login with the default admin account:
- **Email:** `admin@iotplatform.local`
- **Password:** `admin123`

> **Security:** Change this password immediately after first login. You can do this by directly updating the users table or adding a change-password API endpoint.

---

## Step 8 — Create Your First Device

1. Click **"+ Add Device"**
2. Fill in:
   - Name: `Living Room Sensor`
   - Type: `ESP32`
3. Click **Create Device**
4. **Copy the API Key** shown — you'll need it for your ESP32

---

## Step 9 — Create Your First Dashboard

The sidebar shows "Dashboards" — but it's empty until you create one via API or add it manually.

Quick way using curl:
```bash
# First login to get token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@iotplatform.local","password":"admin123"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Create dashboard
curl -X POST http://localhost:3000/api/dashboard \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Home Dashboard"}'
```

Then refresh the browser — the dashboard appears in the sidebar.

---

## Step 10 — Test MQTT (Optional)

Send a test sensor reading using the mosquitto client:

```bash
# Install mosquitto client tools
# Ubuntu: sudo apt install mosquitto-clients
# Mac: brew install mosquitto

# Publish a fake temperature reading
# Replace YOUR_API_KEY with the api_key from Step 8
mosquitto_pub -h localhost -p 1883 \
  -t "iot/YOUR_API_KEY/sensor" \
  -m '{"data":{"temperature":28.5,"humidity":70}}'
```

The dashboard should update in realtime within 1 second.

---

## Step 11 — Test HTTP Push (Fallback Protocol)

```bash
curl -X POST http://localhost:3000/api/device/data \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"data":{"temperature":29.1,"humidity":65}}'
```

Expected:
```json
{"message":"Data received","device_id":1}
```

---

## Common Commands

### Stop everything
```bash
docker compose down
```

### Stop and delete all data (fresh start)
```bash
docker compose down -v
```

### Restart a single service
```bash
docker compose restart backend
```

### View logs of a service
```bash
docker compose logs -f backend
docker compose logs -f mysql
docker compose logs -f mosquitto
```

### Rebuild after code changes
```bash
docker compose up -d --build backend
docker compose up -d --build frontend
```

### Open MySQL shell
```bash
docker exec -it iot_mysql mysql -u iotuser -p iot_platform
# Password: iotpassword
```

### Open backend shell
```bash
docker exec -it iot_backend sh
```

---

## Troubleshooting

### Backend keeps restarting
Most common cause: MySQL not ready yet. The backend depends on MySQL health check.  
Wait 30 seconds and check:
```bash
docker compose ps
docker compose logs backend
```

### Port already in use
```bash
# Find what is using port 3306 (MySQL)
# Linux/Mac:
lsof -i :3306
# Windows:
netstat -ano | findstr :3306
```

Change the host port in `docker-compose.yml`:
```yaml
ports:
  - "3307:3306"   # use 3307 on your machine instead
```

### Schema not imported
If the MySQL container started before schema.sql was ready:
```bash
docker exec -i iot_mysql mysql -u iotuser -piotpassword iot_platform < ../database/schema.sql
```

### Frontend shows blank page
```bash
docker compose logs frontend
```
Usually a build error. Check that all npm packages are in `package.json`.

### ESP32 can't connect to MQTT
Your ESP32 needs to connect to your **machine's local IP**, not `localhost`.

Find your IP:
```bash
# Windows
ipconfig | findstr "IPv4"
# Linux/Mac
ip addr show | grep "inet "
# or
hostname -I
```

Use that IP in your Arduino sketch:
```cpp
#define MQTT_HOST "192.168.1.xxx"   // your machine's IP
```

---

## Production Checklist

Before exposing to the internet:

- [ ] Change `JWT_SECRET` to a strong random value
- [ ] Change MySQL passwords in `docker-compose.yml`
- [ ] Set `allow_anonymous false` in `mosquitto.conf` and add user/password
- [ ] Put Nginx in front with HTTPS (see `docs/DEPLOYMENT.md`)
- [ ] Remove the default admin user or change its password
- [ ] Set `NODE_ENV=production` (already set in docker-compose.yml)
