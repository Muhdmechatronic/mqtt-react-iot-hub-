# IoT Platform — PC as Server, Raspberry Pi 4 as Device

This guide covers the recommended home setup:
- **PC** runs the full IoT platform (Docker — backend, MySQL, MQTT, frontend)
- **Raspberry Pi 4** is a client device on the same local Wi-Fi/LAN — it runs the sensor simulator or real sensors and sends data to the PC

You access the dashboard from any browser (PC, phone, tablet) on the same network.

---

## Architecture

```
Local Network (Wi-Fi / LAN)
─────────────────────────────────────────────
  ┌──────────────────────────────────┐
  │         YOUR PC                  │
  │  Docker running:                 │
  │  ├── MySQL         :3306         │
  │  ├── Mosquitto     :1883         │
  │  ├── Backend API   :3000         │
  │  └── Frontend      :5173         │
  └──────────────────────────────────┘
            ▲              ▲
            │ MQTT         │ HTTP
            │              │
  ┌──────────────────────────────────┐
  │     RASPBERRY PI 4               │
  │  sensor_simulator.py             │
  │  (sends fake sensor data)        │
  └──────────────────────────────────┘
            
  📱 Phone / 💻 Laptop / 🖥️ PC
  Browser opens: http://<PC_LAN_IP>:5173
```

---

## Part 1 — Start the Platform on Your PC

### 1.1 Find your PC's local IP address

Open PowerShell (Windows):
```powershell
ipconfig
```
Look for **IPv4 Address** under your Wi-Fi or Ethernet adapter:
```
IPv4 Address. . . . . . . . . . . : 192.168.1.100   ← your PC's LAN IP
```
Write this down — your Pi and other devices will use it to connect.

---

### 1.2 Start Docker

```powershell
cd C:\Users\aisya\OneDrive\Documents\project123\iot-platform\docker
docker compose up -d --build
```

Wait about 1-2 minutes for everything to start. Verify:
```powershell
docker compose ps
```
All four services should show **Up** or **healthy**:
```
NAME            STATUS
iot_mysql       Up (healthy)
iot_mqtt        Up
iot_backend     Up
iot_frontend    Up
```

---

### 1.3 Allow ports through Windows Firewall

Docker Desktop usually opens the firewall automatically, but if your Pi can't connect, run these in PowerShell **as Administrator**:

```powershell
# MQTT broker (for Pi to send sensor data)
netsh advfirewall firewall add rule name="IoT MQTT" dir=in action=allow protocol=TCP localport=1883

# Backend API
netsh advfirewall firewall add rule name="IoT Backend" dir=in action=allow protocol=TCP localport=3000

# Frontend dashboard
netsh advfirewall firewall add rule name="IoT Frontend" dir=in action=allow protocol=TCP localport=5173
```

---

### 1.4 Open the dashboard

From any browser on your network:
```
http://192.168.1.100:5173     ← use YOUR PC's LAN IP
```

Login: `admin@iotplatform.local` / `admin123`

> If login fails, see the **Troubleshooting — Login** section at the bottom.

---

## Part 2 — Set Up Raspberry Pi 4 as Client Device

The Pi only needs Python and the simulator script. No Node.js, no MySQL, nothing else.

### 2.1 Prepare the Pi

Flash Raspberry Pi OS (64-bit) with Raspberry Pi Imager:
- Enable SSH
- Set Wi-Fi credentials (must be the **same network as the PC**)
- Set hostname: `iotpi`

SSH into the Pi from your PC:
```powershell
ssh pi@iotpi.local
```

---

### 2.2 Copy the simulator to the Pi

From PowerShell on your PC:
```powershell
scp C:\Users\aisya\OneDrive\Documents\project123\iot-platform\simulator\sensor_simulator.py pi@iotpi.local:~/sensor_simulator.py
```

---

### 2.3 Install Python dependencies on the Pi

```bash
sudo apt update && sudo apt install -y python3-pip
pip3 install paho-mqtt requests
```

---

### 2.4 Register a device in the platform

Open the dashboard (`http://192.168.1.100:5173`) in your browser:
1. Go to **Devices**
2. Click **+ Add Device**
3. Name: `Raspberry Pi`, Type: `raspberry_pi`
4. Click **Create**
5. **Copy the API Key** — you'll paste it into the simulator command

---

### 2.5 Run the simulator on the Pi

```bash
# Replace 192.168.1.100 with YOUR PC's LAN IP
# Replace YOUR_API_KEY with the key from the Devices page

python3 sensor_simulator.py --api-key YOUR_API_KEY --host 192.168.1.100
```

Expected output:
```
[MQTT] Connecting to 192.168.1.100:1883 ...
[MQTT] Connected. Publishing to topic: iot/abc123.../sensor
[Simulator] Running — interval=5s — press Ctrl+C to stop

[MQTT] Sent: {"data": {"temperature": 28.54, "humidity": 62.1, ...}, "timestamp": "..."}
```

**Options:**
```bash
# Via HTTP instead of MQTT
python3 sensor_simulator.py --api-key YOUR_API_KEY --host 192.168.1.100 --mode http

# Send data every 2 seconds
python3 sensor_simulator.py --api-key YOUR_API_KEY --host 192.168.1.100 --interval 2
```

---

### 2.6 Keep the simulator running after SSH disconnect

```bash
# Install screen (session manager)
sudo apt install -y screen

# Start a detached session
screen -dmS simulator python3 ~/sensor_simulator.py --api-key YOUR_API_KEY --host 192.168.1.100

# Re-attach to check on it later
screen -r simulator

# Detach again: Ctrl+A then D
```

Or use nohup:
```bash
nohup python3 ~/sensor_simulator.py --api-key YOUR_API_KEY --host 192.168.1.100 > simulator.log 2>&1 &
```

---

## Part 3 — Create a Dashboard and View Real-Time Data

1. Open `http://192.168.1.100:5173` in your browser
2. In the sidebar, click **+ New Dashboard** → type a name → press Enter
3. On the dashboard page, click **+ Add Widget**
4. Create widgets linked to your Raspberry Pi device:

| Widget type | data_key | What it shows |
|---|---|---|
| `gauge` | `temperature` | Temperature in °C |
| `gauge` | `humidity` | Humidity % |
| `gauge` | `co2` | CO2 in ppm |
| `gauge` | `light` | Light in lux |
| `label` | `pressure` | Atmospheric pressure hPa |
| `status` | `motion` | Motion detected 0/1 |

5. Data updates in real time — no page refresh needed

---

## Part 4 — Access from Any Device on the Network

| Device | URL |
|---|---|
| PC browser | `http://192.168.1.100:5173` |
| Phone / tablet | `http://192.168.1.100:5173` |
| Raspberry Pi browser | `http://192.168.1.100:5173` |

Replace `192.168.1.100` with your actual PC LAN IP.

---

## Troubleshooting — Login Issue

**Symptom:** You see the admin user in MySQL but cannot login with `admin@iotplatform.local` / `admin123`.

**Cause:** The `schema.sql` seed user contained a placeholder bcrypt hash that never matched "admin123". The backend now auto-fixes this on startup — but if the backend was already running before this fix, you need to restart it or run the reset script manually.

**Fix A — Restart the backend (auto-fix runs on startup):**
```powershell
docker compose restart backend
```
Then try logging in again.

**Fix B — Run the reset script manually:**
```powershell
docker exec iot_backend node scripts/reset-admin.js
```

**Fix C — Update the hash directly in MySQL:**
```powershell
# Open MySQL shell inside Docker
docker exec -it iot_mysql mysql -u iotuser -piotpassword iot_platform

# Run this SQL (generates a known-good bcrypt hash of "admin123"):
UPDATE users SET password = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.qmWnMC' WHERE email = 'admin@iotplatform.local';
EXIT;
```

---

## Troubleshooting — Pi Can't Reach the PC

**Test from the Pi:**
```bash
# Check basic connectivity
ping 192.168.1.100

# Test MQTT port
nc -zv 192.168.1.100 1883

# Test API
curl http://192.168.1.100:3000/health
```

If `ping` works but `nc` fails → Windows Firewall is blocking port 1883. Run the firewall commands from Part 1.3.

If `ping` fails → Pi and PC are on different networks or Wi-Fi isolation is enabled on your router (common on guest networks). Use the main Wi-Fi network for both.

---

## Troubleshooting — Docker

```powershell
# Check all service logs
docker compose logs -f

# Check a specific service
docker compose logs backend
docker compose logs mysql

# Full restart (keeps data)
docker compose down
docker compose up -d

# Fresh restart (deletes ALL data including users and sensor history)
docker compose down -v
docker compose up -d --build
```

---

## Simulator Sensor Channels

These are the `data_key` values available for widgets:

| data_key | Unit | Description |
|---|---|---|
| `temperature` | °C | Ambient temperature with daily cycle drift |
| `humidity` | % | Relative humidity (0–100) |
| `pressure` | hPa | Atmospheric pressure |
| `light` | lux | Ambient light level |
| `co2` | ppm | CO2 concentration |
| `motion` | 0 or 1 | Motion trigger (5% chance per reading) |

---

## Quick Reference

```powershell
# PC — Start platform
docker compose -f docker/docker-compose.yml up -d

# PC — Check status
docker compose -f docker/docker-compose.yml ps

# PC — Fix admin login
docker exec iot_backend node scripts/reset-admin.js

# PC — View backend logs live
docker compose -f docker/docker-compose.yml logs -f backend

# PC — Open MySQL shell
docker exec -it iot_mysql mysql -u iotuser -piotpassword iot_platform
```

```bash
# Pi — Run simulator (replace values)
python3 sensor_simulator.py --api-key YOUR_API_KEY --host 192.168.1.100

# Pi — Check MQTT connection to PC
mosquitto_sub -h 192.168.1.100 -p 1883 -t "#" -v

# Pi — Check Pi's CPU temperature (keep below 80°C)
vcgencmd measure_temp
```
