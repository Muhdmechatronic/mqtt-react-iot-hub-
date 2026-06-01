# Google Sign-In & Google Assistant Setup Guide

This guide walks you through enabling Google Sign-In (via Firebase) and Google Assistant voice control for the IoT Platform. No advanced cloud knowledge required — follow each step in order.

---

## Part 1 — Firebase Google Sign-In

### Why Firebase?
Firebase Authentication handles all the OAuth complexity for you. You don't need a Google Cloud service account, API keys rotation, or manual JWT verification setup. Firebase provides a free tier that covers unlimited sign-ins.

---

### Step 1 — Create a Firebase Project

1. Open [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"** (or **"Create a project"**)
3. Enter a project name, e.g. `iot-platform`
4. **Disable** Google Analytics (you don't need it) → click **"Create project"**
5. Wait ~30 seconds for setup to complete → click **"Continue"**

---

### Step 2 — Enable Google Sign-In

1. In the left sidebar click **"Authentication"**
2. Click the **"Get started"** button
3. Under the **"Sign-in method"** tab, click **"Google"**
4. Toggle **"Enable"** to ON
5. Fill in **"Project support email"** (use your own Gmail address)
6. Click **"Save"**

```
Authentication → Sign-in method → Google → Enable ✓
```

---

### Step 3 — Add a Web App and Copy Config

1. In the left sidebar click the gear icon ⚙️ → **"Project settings"**
2. Scroll down to **"Your apps"** section
3. Click the **"</>"** (Web) icon to add a web app
4. Enter an app nickname, e.g. `iot-platform-web`
5. **Do NOT** tick "Also set up Firebase Hosting"
6. Click **"Register app"**
7. You will see a config block like this — **copy all values**:

```javascript
const firebaseConfig = {
  apiKey:            "AIzaSyXXXXXXXXXXXXXXXXXXX",       ← VITE_FIREBASE_API_KEY
  authDomain:        "iot-platform-abc.firebaseapp.com", ← VITE_FIREBASE_AUTH_DOMAIN
  projectId:         "iot-platform-abc",                 ← VITE_FIREBASE_PROJECT_ID / FIREBASE_PROJECT_ID
  storageBucket:     "iot-platform-abc.appspot.com",
  messagingSenderId: "123456789012",
  appId:             "1:123456789012:web:abcdef123456"   ← VITE_FIREBASE_APP_ID
};
```

8. Click **"Continue to console"**

---

### Step 4 — Add Authorized Domains

Firebase blocks sign-in from unknown domains. You must whitelist your app URL.

1. In Firebase Console → **Authentication** → **Settings** tab → **"Authorized domains"**
2. `localhost` is already there (for local dev)
3. If you deploy to a real domain (e.g. `myapp.example.com`), click **"Add domain"** and add it

---

### Step 5 — Set Up Environment Variables

#### For local development (`npm run dev`)

Create `frontend/.env` (copy from `frontend/.env.example`):

```env
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=iot-platform-abc.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=iot-platform-abc
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

Create `backend/.env` (copy from `backend/.env.example`) and add:

```env
FIREBASE_PROJECT_ID=iot-platform-abc
```

#### For Docker (`docker compose up --build`)

Create `docker/.env` (copy from `docker/.env.example`):

```env
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=iot-platform-abc.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=iot-platform-abc
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
FIREBASE_PROJECT_ID=iot-platform-abc
```

> **Important:** These values are baked into the frontend bundle at build time.
> Every time you change them, you must rebuild: `docker compose up -d --build`

---

### Step 6 — Rebuild and Test

```powershell
# Navigate to docker folder
cd C:\Users\aisya\OneDrive\Documents\project123\iot-platform\docker

# Rebuild with new env vars
docker compose up -d --build
```

Open [http://localhost:5173](http://localhost:5173). You should now see the **"Continue with Google"** button. Click it — a Google account picker popup will open. Select your account. You will be logged in automatically and redirected to the Devices page.

---

### How Sign-In Works (Technical Flow)

```
User clicks "Continue with Google"
         ↓
Firebase SDK opens Google popup
         ↓
User picks Google account → Google authorises
         ↓
Firebase returns a signed ID token (JWT, valid 1 hour)
         ↓
Frontend sends idToken to POST /api/auth/google
         ↓
Backend verifies token signature against Google's public keys
         ↓
Backend creates/links user account in MySQL
         ↓
Backend returns our own JWT (valid 7 days)
         ↓
Frontend stores JWT → redirects to /devices
```

No passwords needed. If the Google email matches an existing account, they are linked automatically.

---

## Part 2 — Google Assistant Voice Control

### Overview

Google Assistant sends voice commands to your platform via the **Smart Home API**. When a user says *"Hey Google, turn on the living room light"*, Google calls your fulfillment URL, which maps the command to a virtual pin and sends it to your ESP32 device via MQTT.

The flow:
```
Voice command → Google Assistant → Your fulfillment endpoint
                                          ↓
                               Updates sensor_data table
                                          ↓
                          Socket.IO push → Dashboard widget updates
                                          ↓
                             MQTT publish → ESP32 receives it
```

---

### Step 1 — Create a Google Actions Project

1. Open [https://console.actions.google.com](https://console.actions.google.com)
2. Click **"New project"**
3. Select your **Firebase project** from the list (or create a new one)
4. Choose **"Smart Home"** as the project type
5. Click **"Start building"**

---

### Step 2 — Set the Fulfillment URL

1. In the Actions project, go to **"Develop"** → **"Actions"**
2. Under **"Fulfillment"**, set the URL to:

```
https://YOUR_DOMAIN/api/google-assistant/fulfillment
```

For local testing with [ngrok](https://ngrok.com):
```powershell
# In a separate terminal
ngrok http 3000

# Use the https URL shown, e.g.:
# https://abc123.ngrok.io/api/google-assistant/fulfillment
```

> During development, use ngrok to expose your local backend. For production, use your real domain with HTTPS.

---

### Step 3 — Account Linking (OAuth)

Google Assistant needs to know who is asking. You link your Google account to the IoT platform:

1. In Actions Console → **"Develop"** → **"Account linking"**
2. Set **Linking type**: `OAuth` + `Authorization code`
3. Set **Client ID**: any string (e.g. `iot-platform-client`)
4. Set **Client secret**: your `JWT_SECRET` from `.env`
5. Set **Authorization URL**: `https://YOUR_DOMAIN/api/auth/google-assistant-auth`
6. Set **Token URL**: `https://YOUR_DOMAIN/api/auth/google-assistant-token`

> For a simpler setup, use the **JWT bearer token** approach where your IoT JWT is passed directly as the Bearer token in the Authorization header. The fulfillment endpoint already reads it this way.

---

### Step 4 — Test with Google Home App

1. Install **Google Home** app on your phone
2. Open it → tap **"+"** → **"Set up device"** → **"Works with Google"**
3. Search for your Actions project name
4. Sign in with your Google account (triggers account linking)
5. Your IoT devices will appear
6. Say: **"Hey Google, sync my devices"**

---

### Voice Command Reference

| What you say | What happens | Virtual pin |
|---|---|---|
| "Turn on [device name]" | Sets V0 = 1 | V0 |
| "Turn off [device name]" | Sets V0 = 0 | V0 |
| "Set [device] brightness to 80" | Sets V1 = 80 | V1 |
| "Set [device] to 50 percent" | Sets V1 = 50 | V1 |
| "Set fan speed to medium" | Sets V2 = 66 | V2 |
| "Open garage door" | Sets V0 = 1 (switch ON) | V0 |
| "Activate pump" | Sets V0 = 1 | V0 |

---

### ESP32 Code (Virtual Pin Handlers)

Your ESP32 sketch must handle these virtual pins. Values sent by Google Assistant are **identical** to values sent by dashboard widgets.

```cpp
#include <BlynkSimpleEsp32.h>

// Called when Google Assistant says "Turn on" or dashboard switch is pressed
BLYNK_WRITE(V0) {
  int value = param.asInt();  // 1 = ON, 0 = OFF
  digitalWrite(RELAY_PIN, value);
  Serial.println("Relay: " + String(value));
}

// Called when Google Assistant says "Set brightness to X" or slider moves
BLYNK_WRITE(V1) {
  int brightness = param.asInt();  // 0–100
  analogWrite(LED_PIN, map(brightness, 0, 100, 0, 255));
  Serial.println("Brightness: " + String(brightness));
}

// Fan speed (set by "Set fan speed to low/medium/high")
BLYNK_WRITE(V2) {
  int speed = param.asInt();  // 33 = low, 66 = medium, 100 = high
  analogWrite(FAN_PIN, map(speed, 0, 100, 0, 255));
}
```

---

### Device Name → Google Type Mapping

The platform automatically decides the Google Home device type from your device name:

| Words in device name | Google type | Supported traits |
|---|---|---|
| light, led, lamp, bulb | Light | On/Off, Brightness (0–100) |
| fan, blower | Fan | On/Off, Fan Speed (low/medium/high) |
| switch, relay, pump, garage, door, valve | Switch | On/Off |
| anything else | Switch | On/Off |

To get a specific type, include the keyword in your device name when you register it on the Devices page. Example: name your device **"Living Room LED"** and it will be a dimmable Light in Google Home.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| "Continue with Google" button not visible | Check `docker/.env` has `VITE_FIREBASE_*` vars, then rebuild with `--build` |
| "Google sign-in failed" after popup | Check `FIREBASE_PROJECT_ID` in backend matches your Firebase project |
| Backend error 401 | Firebase token expired (1h limit) — try signing in again |
| Google Home can't find devices | Run "Hey Google, sync my devices" or tap Sync in the Google Assistant page |
| Device shows offline in Google Home | Your ESP32 must be connected and the `status` column in DB must be `'online'` |
| Popup blocked | Browser blocked the popup — allow popups for localhost:5173 in browser settings |

---

## Files Changed (Reference)

| File | Purpose |
|---|---|
| `frontend/src/services/firebase.js` | Firebase SDK initialisation |
| `frontend/src/pages/LoginPage.jsx` | Google Sign-In button |
| `frontend/src/pages/RegisterPage.jsx` | Google Sign-Up button |
| `frontend/src/pages/GoogleAssistantPage.jsx` | GA setup guide & device list |
| `backend/services/googleAuthService.js` | Firebase token verification (no service account) |
| `backend/controllers/googleAssistantController.js` | SYNC / QUERY / EXECUTE handlers |
| `backend/routes/googleAssistant.js` | Fulfillment endpoint |
| `frontend/Dockerfile` | Build args for Vite env vars |
| `docker/docker-compose.yml` | Passes Firebase config as build args |
| `docker/.env.example` | Template — copy to `docker/.env` |
| `frontend/.env.example` | Template — copy to `frontend/.env` |
