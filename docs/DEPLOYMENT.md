# IoT Platform — Deployment Guide

## Prerequisites
- Node.js 20+
- MySQL 8.0+
- Mosquitto MQTT Broker
- Git

---

## Option A: Local Development Setup

### 1. Install Mosquitto

**Windows:**
Download from https://mosquitto.org/download/
After install, edit `C:\Program Files\mosquitto\mosquitto.conf`:
```
listener 1883
allow_anonymous true
```
Start: `net start mosquitto`

**Ubuntu/Debian:**
```bash
sudo apt install mosquitto mosquitto-clients -y
sudo systemctl enable mosquitto
sudo systemctl start mosquitto
```

**macOS:**
```bash
brew install mosquitto
brew services start mosquitto
```

---

### 2. MySQL Setup

```sql
-- Run in MySQL client
CREATE DATABASE iot_platform CHARACTER SET utf8mb4;
CREATE USER 'iotuser'@'localhost' IDENTIFIED BY 'iotpassword';
GRANT ALL PRIVILEGES ON iot_platform.* TO 'iotuser'@'localhost';
FLUSH PRIVILEGES;
```

Then import the schema:
```bash
mysql -u iotuser -p iot_platform < database/schema.sql
```

---

### 3. Backend Setup

```bash
cd iot-platform/backend
cp .env.example .env
# Edit .env with your MySQL credentials and secrets
npm install
npm run dev
```

The API server starts on **http://localhost:3000**

---

### 4. Frontend Setup

```bash
cd iot-platform/frontend
npm install
npm run dev
```

Open **http://localhost:5173**

Default login: `admin@iotplatform.local` / `admin123`  
**Change this immediately in production!**

---

### 5. Test with ESP32

1. Open `esp32/example/esp32_sensor_example.ino` in Arduino IDE
2. Install libraries via Library Manager:
   - `PubSubClient` by Nick O'Leary
   - `ArduinoJson` by Benoit Blanchon
   - `DHT sensor library` by Adafruit
3. Copy `arduino-library/MyIoTSDK/` into your Arduino libraries folder:
   - Windows: `Documents/Arduino/libraries/MyIoTSDK/`
   - Linux: `~/Arduino/libraries/MyIoTSDK/`
4. Update `WIFI_SSID`, `WIFI_PASSWORD`, `DEVICE_ID`, `API_KEY`, `MQTT_HOST` in the .ino file
5. Flash and open Serial Monitor at 115200 baud

---

## Option B: Docker Compose (Recommended for Production)

```bash
cd iot-platform/docker
docker compose up -d
```

This starts:
- MySQL on port 3306
- Mosquitto on ports 1883, 9001
- Backend on port 3000
- Frontend (Nginx) on port 5173

View logs:
```bash
docker compose logs -f backend
```

---

## Option C: VPS Deployment with Nginx Reverse Proxy

### Server setup (Ubuntu 22.04)

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install nginx mysql-server mosquitto nodejs npm -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs -y
```

### Nginx config for your domain

Create `/etc/nginx/sites-available/iot-platform`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /var/www/iot-platform/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /socket.io {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/iot-platform /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### SSL with Let's Encrypt
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

### Run backend with PM2
```bash
sudo npm install -g pm2
cd /var/www/iot-platform/backend
pm2 start server.js --name iot-backend
pm2 save
pm2 startup
```

---

## Environment Variables Reference

| Variable       | Description                         | Default           |
|----------------|-------------------------------------|-------------------|
| PORT           | Backend HTTP port                   | 3000              |
| DB_HOST        | MySQL host                          | localhost         |
| DB_PORT        | MySQL port                          | 3306              |
| DB_NAME        | Database name                       | iot_platform      |
| DB_USER        | MySQL user                          | root              |
| DB_PASSWORD    | MySQL password                      | (empty)           |
| JWT_SECRET     | Secret for JWT signing              | (must set!)       |
| JWT_EXPIRES_IN | Token expiry                        | 7d                |
| MQTT_HOST      | Mosquitto broker host               | localhost         |
| MQTT_PORT      | Mosquitto broker port               | 1883              |
| FRONTEND_URL   | Allowed CORS origin                 | http://localhost:5173 |
