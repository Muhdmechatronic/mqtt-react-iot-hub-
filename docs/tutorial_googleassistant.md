# Google Assistant Setup Tutorial
### Complete Beginner Guide — IoT Platform Voice Control

---

> **Who is this for?**
> This guide is for someone who has never set up Google Assistant before.
> Every single step is explained with the exact button to click and what you will see.
> Just follow in order — do not skip any step.

---

## What You Will Be Able to Do After This Guide

After finishing, you will be able to say things like:

- *"Hey Google, turn on living room light"*
- *"Hey Google, turn off relay"*
- *"Hey Google, set fan speed to 50 percent"*

…and your ESP32 device will respond **immediately** — exactly the same as pressing a button on your dashboard.

---

## What You Need Before Starting

Make sure you have done all of these first:

| Requirement | Status |
|---|---|
| Docker running (`docker compose up -d`) | Must be running |
| Can open `http://localhost:5173` in browser | Must work |
| Google account signed in to IoT Platform | Must be logged in |
| At least 1 device registered on Devices page | Must have 1+ device |
| Phone with Google Home app installed | Need to install if not yet |

**Install Google Home app:**
- Android: Open Play Store → search **"Google Home"** → Install
- iPhone: Open App Store → search **"Google Home"** → Install

---

## Overview — 4 Big Steps

```
STEP A → Create project on Google Actions Console (website)
STEP B → Set up ngrok (so Google can reach your computer)
STEP C → Configure the action (fulfillment + account linking)
STEP D → Link to Google Home app on your phone
```

---

# STEP A — Create a Google Actions Project

## A1. Open Google Actions Console

1. Open your browser (Chrome recommended)
2. Go to this website:

```
https://console.actions.google.com
```

3. Sign in with the **same Google account** you use for your IoT Platform

4. You will see a page that says **"Actions Console"** at the top

---

## A2. Create a New Project

1. Click the big blue button that says **"New project"**

   > If you don't see this button, look for **"+ Create project"** instead

2. A dialog box will appear asking for a project name

3. In the **"Project name"** field, type:
   ```
   IoT Platform
   ```

4. In the **"Country/region"** dropdown, select your country (e.g. **Malaysia**)

5. Click **"Create project"**

   > ⏳ Wait about 10–20 seconds while it creates the project

---

## A3. Choose Smart Home Category

After the project is created, you will see a screen asking **"What kind of action do you want to build?"**

1. Look for the card that says **"Smart Home"**
   - It has a little house icon
   - Description says something like "Control smart home devices"

2. Click on **"Smart Home"**

3. Click **"Start building"**

   > You are now inside the Actions project dashboard

---

## A4. Note Your Project ID

1. At the top of the page, look at the URL in your browser
2. It will look like this:
   ```
   https://console.actions.google.com/project/YOUR-PROJECT-ID/overview
   ```
3. The part that says `YOUR-PROJECT-ID` is your project ID
4. **Write it down or copy it** — you need it later

   Example: `iot-platform-6b89a`

---

# STEP B — Set Up ngrok (Public URL for Your Computer)

> **Why do we need this?**
> Google needs to send commands to your IoT Platform.
> Your IoT Platform is running on your computer at `localhost:3000`.
> Google cannot reach `localhost` because it is only on your computer.
> ngrok creates a **public URL** (on the internet) that points to your computer.

## B1. Download ngrok

1. Go to: **https://ngrok.com**
2. Click **"Sign up"** (it's free)
3. Fill in: email, password → click **"Sign up"**
4. After signing up, you will be on a dashboard
5. Look for the **Download** section
6. Download ngrok for **Windows**
7. You will get a `.zip` file — extract it
8. Inside you will find `ngrok.exe`

---

## B2. Get Your ngrok Auth Token

1. On the ngrok website (after login), look at the left menu
2. Click **"Your Authtoken"**
3. You will see a long token like: `2abc123def456...`
4. **Copy this token**

---

## B3. Set Up ngrok on Your Computer

1. Open **PowerShell** (press Windows key → type `powershell` → press Enter)

2. Go to where you extracted ngrok.exe:
   ```powershell
   cd C:\Users\aisya\Downloads\ngrok
   ```
   > Change the path to wherever your ngrok.exe is

3. Add your auth token (paste the token you copied):
   ```powershell
   .\ngrok.exe config add-authtoken PASTE_YOUR_TOKEN_HERE
   ```
   > Example: `.\ngrok.exe config add-authtoken 2abc123def456xyz`

4. Press **Enter**. You should see:
   ```
   Authtoken saved to configuration file
   ```

---

## B4. Start ngrok (Keep This Running!)

1. In the same PowerShell window, type:
   ```powershell
   .\ngrok.exe http 3000
   ```

2. Press **Enter**

3. You will see a screen like this:
   ```
   ngrok                                              (Ctrl+C to quit)

   Session Status          online
   Account                 yourname@gmail.com
   Version                 3.x.x

   Forwarding    https://abc123xyz.ngrok-free.app -> http://localhost:3000
   ```

4. **Copy the `https://...` URL** — this is your public URL

   > Example: `https://abc123xyz.ngrok-free.app`

   > ⚠️ **VERY IMPORTANT:**
   > - Do NOT close this PowerShell window
   > - Do NOT press Ctrl+C
   > - Keep it running the entire time you are using Google Assistant
   > - Every time you restart ngrok, you get a **different URL** and must update it in Google Actions Console

---

# STEP C — Configure Your Google Action

## C1. Set the Fulfillment URL

Go back to the **Google Actions Console** (`https://console.actions.google.com`)

1. In the left menu, click **"Develop"**

2. Then click **"Actions"** (under Develop)

3. You will see a section called **"Fulfillment"**

4. In the **"Fulfillment URL"** box, paste your ngrok URL + `/api/google-assistant/fulfillment`

   ```
   https://abc123xyz.ngrok-free.app/api/google-assistant/fulfillment
   ```

   > Replace `abc123xyz.ngrok-free.app` with your actual ngrok URL

5. Click **"Save"**

   > ✅ You should see a green checkmark or "Saved" message

---

## C2. Set Up Account Linking

> **What is account linking?**
> When someone says "Hey Google" to control your devices, Google needs to know which IoT Platform account they are. Account linking connects your Google account to your IoT Platform account.

1. In the left menu, still under **"Develop"**, click **"Account linking"**

2. You will see a form with many fields. Fill them in exactly as shown:

---

**Linking type:**
- Click the dropdown
- Select **"OAuth"**

**Grant type:**
- Select **"Authorization code"**

Click **"Next"**

---

**Client information:**

| Field | What to type |
|---|---|
| Client ID | `iot-platform-client` |
| Client secret | `v5ymAY4GghtYSUxnyVYbladhoFPT6ele` |

> The Client secret is your JWT_SECRET from `docker/docker-compose.yml`

Click **"Next"**

---

**Your Account's OAuth endpoints:**

| Field | What to type |
|---|---|
| Authorization URL | `https://abc123xyz.ngrok-free.app/api/auth/google-assistant-oauth` |
| Token URL | `https://abc123xyz.ngrok-free.app/api/auth/google-assistant-token` |

> Replace `abc123xyz.ngrok-free.app` with your real ngrok URL

Click **"Next"**

---

**Optional info (skip these):**
- Leave all optional fields empty
- Click **"Next"** or **"Save"**

---

## C3. Test the Connection

1. In the Actions Console, look for the **"Test"** tab at the top

2. Click **"Test"**

3. It will say something like **"Your app is now ready for testing"**

4. This means Google can now reach your fulfillment URL ✅

---

# STEP D — Link to Google Home App on Your Phone

This is the most important step — this is where you **log in** to connect Google Assistant to your IoT Platform.

## D1. Open Google Home App

1. On your phone, open the **Google Home** app

2. Make sure you are signed in with the **same Google account** you use on your computer

---

## D2. Add Your IoT Platform as a Smart Home

1. In Google Home, tap the **"+"** button
   - On Android: it's usually at the top-left or bottom of the screen
   - On iPhone: look for a + icon at top-right

2. Tap **"Set up device"**

3. Tap **"Works with Google"**
   - This is for third-party smart home services (like our IoT Platform)

4. A search box appears at the top

5. Type the name of your action project (what you named it in Step A2):
   ```
   IoT Platform
   ```

6. Tap on **"IoT Platform"** when it appears in the results

   > If it doesn't appear: make sure you are logged into the same Google account in the app as in the Actions Console

---

## D3. Sign In to Your IoT Platform

1. After tapping your action, a **browser window** will open on your phone

2. It will show the **IoT Platform login page** (same as `http://localhost:5173/login`)

   > ⚠️ But it will use your ngrok URL, not localhost

3. You have two options to sign in:
   - Click **"Continue with Google"** button (easiest!)
   - OR type your email and password

4. After signing in successfully, you will see a page that says something like **"Authorization successful"** or it will redirect automatically

5. Go back to the **Google Home app**

---

## D4. Discover Your Devices

1. Google Home will say **"Checking your account..."** for a few seconds

2. Then it will show **"Devices found!"** with a list of your IoT devices

3. You can assign them to rooms (e.g. "Living Room", "Bedroom")
   - Tap each device → choose a room → tap **"Next"**
   - OR tap **"Skip"** to set up rooms later

4. Tap **"Done"**

5. Your devices now appear in Google Home ✅

---

## D5. Sync Devices (Important!)

After linking, tell Google to sync:

1. On your phone, say:
   ```
   Hey Google, sync my devices
   ```

2. Google will reply: **"Ok, syncing your devices now"**

3. All your IoT Platform devices will appear in Google Assistant

---

# STEP E — Test Voice Commands

Now try these commands! Say them to your phone or Google Home speaker:

## Basic Commands

```
Hey Google, turn on [device name]
Hey Google, turn off [device name]
```

> Replace `[device name]` with the exact name of your device as registered in the IoT Platform
> Example: if your device is named "Living Room LED", say: *"Hey Google, turn on Living Room LED"*

## Brightness Commands (for LED / Light devices)

```
Hey Google, set [device name] to 80 percent
Hey Google, dim [device name] to 50
Hey Google, set [device name] brightness to 30
```

## Fan Speed Commands (for Fan devices)

```
Hey Google, set [device name] to low
Hey Google, set [device name] to medium
Hey Google, set [device name] speed to high
```

## Group Commands

```
Hey Google, turn off all lights
Hey Google, turn on all devices in living room
```

---

# What Happens Behind the Scenes

When you say a voice command, here is exactly what happens in order:

```
1. You say: "Hey Google, turn on living room light"
         ↓
2. Google Assistant hears your voice
         ↓
3. Google sends a command to:
   https://your-ngrok-url/api/google-assistant/fulfillment
         ↓
4. IoT Platform receives the command
         ↓
5. Sets V0 = 1 in the database
         ↓
6. Dashboard widget updates instantly (Switch shows ON)
         ↓
7. MQTT message sent to your ESP32
         ↓
8. ESP32 BLYNK_WRITE(V0) fires → relay turns ON
         ↓
9. Google says: "OK, turning on living room light"
```

**Total time: less than 1 second**

---

# Troubleshooting

## Problem: Google Home can't find my action

**Cause:** You are using different Google accounts

**Fix:**
- Make sure the Google account on your phone = the account you used at `console.actions.google.com`
- In Google Home app → tap your profile picture (top-right) → check which account is shown

---

## Problem: "Something went wrong" when linking account

**Cause:** ngrok is not running, or the URL is wrong

**Fix:**
1. Check that ngrok PowerShell window is still open and showing `online`
2. Check that the ngrok URL in Actions Console exactly matches what ngrok shows
3. The URL must start with `https://` not `http://`

---

## Problem: Devices don't appear after linking

**Fix:**
1. Say: *"Hey Google, sync my devices"*
2. Wait 10 seconds and try again
3. Go to IoT Platform → Devices page → make sure devices are registered
4. Click **"Sync Devices"** button on the Google Assistant page

---

## Problem: Voice command doesn't control device

**Cause:** Device name mismatch, or MQTT not connected

**Fix:**
1. Check device name in Google Home matches exactly what you registered
2. Make sure your ESP32 is connected and online (green dot on Devices page)
3. Check that your ESP32 code has `BLYNK_WRITE(V0)` for the correct pin

---

## Problem: ngrok URL changed

This happens every time you restart ngrok (free plan generates new URLs each time)

**Fix — every time you restart ngrok:**
1. Copy the new ngrok URL
2. Go to `console.actions.google.com`
3. Develop → Actions → update Fulfillment URL
4. Develop → Account Linking → update Authorization URL and Token URL
5. Click Save each time

> **Tip:** To avoid this, upgrade ngrok to a paid plan which gives you a permanent URL, or deploy your IoT Platform to a real server with a domain name.

---

## Problem: "Unauthorized" error in backend logs

**Fix:**
- Make sure you are signed in to IoT Platform before linking in Google Home
- Try the account linking step again (Step D3)

---

# Quick Reference Card

Print or bookmark this section:

| What you want | What to say |
|---|---|
| Turn ON a device | "Hey Google, turn on [device name]" |
| Turn OFF a device | "Hey Google, turn off [device name]" |
| Set brightness | "Hey Google, set [device] to 80 percent" |
| Set fan speed | "Hey Google, set [device] to medium" |
| Sync all devices | "Hey Google, sync my devices" |
| Check device state | "Hey Google, is [device] on?" |
| Turn off everything | "Hey Google, turn off all lights" |

---

| Virtual Pin | Google Command | ESP32 Handler | Values |
|---|---|---|---|
| V0 | Turn on / Turn off | `BLYNK_WRITE(V0)` | 1 = ON, 0 = OFF |
| V1 | Set brightness to X | `BLYNK_WRITE(V1)` | 0–100 |
| V2 | Set fan speed | `BLYNK_WRITE(V2)` | 33=low, 66=med, 100=high |

---

# Summary — What You Did

```
✅ Created a project on Google Actions Console
✅ Set up ngrok to make your computer reachable by Google
✅ Set the Fulfillment URL (where Google sends commands)
✅ Set up Account Linking (how Google knows who you are)
✅ Linked your IoT Platform account in Google Home app
✅ Synced devices with "Hey Google, sync my devices"
✅ Now controlling IoT devices with voice!
```

---

*Tutorial created for IoT Platform v2 — Firebase + Google Assistant integration*
*If something is not working, check the Troubleshooting section above or open the Google Assistant page in the IoT Platform dashboard.*
