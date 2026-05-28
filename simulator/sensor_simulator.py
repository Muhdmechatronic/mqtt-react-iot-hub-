"""
IoT Platform — Sensor & Control Simulator
==========================================
Sends virtual-pin data to the platform via HTTP (POST /api/device/data).
Use this to test widgets on your dashboard without physical hardware.

Requirements:
    pip install requests

─── VIRTUAL PIN LAYOUT (default — matches the demo/all mode) ────────────────

    V0  → Temperature sensor  (sensor mode, ramps 15 → 40 °C)
    V1  → Humidity sensor     (sensor mode, sine wave 30 → 90 %)
    V2  → LED PWM control     (led mode,   sweeps 0 → 100 → 0)
    V3  → Switch / Relay      (switch mode, toggles 0 ↔ 1 every N seconds)
    V4  → Push Button         (button mode, sends 1 then 0 after --press-time)

    To match these in the website:
      1. Create a Device and copy its API Key.
      2. Go to Datastreams → create datastreams for the pins you need:
           V0: name=temperature, type=double, unit=°C, min=0, max=50
           V1: name=humidity,    type=double, unit=%,  min=0, max=100
           V2: name=led_pwm,     type=double, unit=%,  min=0, max=100
           V3: name=relay,       type=integer (0 or 1)
           V4: name=button,      type=integer (0 or 1)
      3. Open Dashboard Sandbox, add widgets and link each to its datastream.
      4. Save the dashboard.
      5. Run this simulator with the device API key.

─── USAGE EXAMPLES ──────────────────────────────────────────────────────────

  # Run all modes at once (temperature + humidity + LED + switch, default pins)
  python sensor_simulator.py --api-key d6e5028a95b04c47809189d854f97630 --mode demo --host 192.168.0.220 --interval 2

  # Sensor ramp: V0 from 15 to 40 over 60 seconds, repeating
  python sensor_simulator.py --api-key YOUR_KEY --mode sensor --pin 0 --min 15 --max 40 --ramp-time 60 --unit "°C"

  # LED PWM sweep: V2 from 0 to 100 and back, every 0.5 s
  python sensor_simulator.py --api-key YOUR_KEY --mode led --pin 2 --interval 0.5

  # Switch toggle: V3 flips every 3 seconds
  python sensor_simulator.py --api-key YOUR_KEY --mode switch --pin 3 --toggle-interval 3

  # Button press: V4 goes HIGH for 1 second then LOW, repeating every 5 s
  python sensor_simulator.py --api-key YOUR_KEY --mode button --pin 4 --press-time 1 --interval 5

  # Custom backend host (e.g. running in Docker on another machine)
  python sensor_simulator.py --api-key YOUR_KEY --mode demo --host 192.168.1.10 --port 3000

─────────────────────────────────────────────────────────────────────────────
"""

import argparse
import json
import math
import time
import threading
import sys

try:
    import requests
except ImportError:
    print("ERROR: 'requests' package not installed. Run:  pip install requests")
    sys.exit(1)


# ─── HTTP client ──────────────────────────────────────────────────────────────

class PlatformClient:
    """Sends a single-call or multi-pin payload to POST /api/device/data."""

    def __init__(self, host: str, port: int, api_key: str):
        self.url = f"http://{host}:{port}/api/device/data"
        self.headers = {
            "Content-Type": "application/json",
            "x-api-key":    api_key,
        }

    def send(self, pin_values: dict, units: dict = None):
        """
        pin_values  — dict like { "V0": 25.3, "V2": 80 }
        units       — dict like { "V0": "°C", "V2": "%" }  (optional)
        """
        body = {
            "data":      pin_values,
            "units":     units or {},
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
        }
        try:
            r = requests.post(self.url, json=body, headers=self.headers, timeout=5)
            tag = "OK " if r.status_code < 300 else "ERR"
            summary = "  ".join(f"{k}={v}" for k, v in pin_values.items())
            print(f"[{tag} {r.status_code}]  {summary}")
        except requests.exceptions.ConnectionError:
            print(f"[ERR] Cannot connect to {self.url} — is the backend running?")
        except Exception as exc:
            print(f"[ERR] {exc}")


# ─── Mode: SENSOR (ramp from min to max and back, slow linear sweep) ──────────

def mode_sensor(client: PlatformClient, args):
    """
    Slowly ramps a value on --pin from --min to --max over --ramp-time seconds,
    then sweeps back to --min, and repeats.

    Good for testing: Gauge, Line Chart, Progress Bar, LED PWM, Slider widgets.

    Default pin: V0 (temperature)
    """
    pin   = f"V{args.pin}"
    lo    = args.min
    hi    = args.max
    unit  = args.unit
    ivl   = args.interval      # seconds between updates
    ramp  = args.ramp_time     # seconds for one full sweep (low → high)

    # How many steps fit in one ramp?
    steps = max(1, int(ramp / ivl))
    step  = 0
    going_up = True

    print(f"\n[SENSOR] Pin={pin}  range={lo}→{hi} {unit}  "
          f"ramp={ramp}s  interval={ivl}s")
    print("Press Ctrl+C to stop.\n")

    while True:
        pct   = step / steps
        value = round(lo + (hi - lo) * pct, 2)

        client.send({pin: value}, {pin: unit} if unit else {})

        if going_up:
            step += 1
            if step > steps:
                step = steps
                going_up = False
        else:
            step -= 1
            if step < 0:
                step = 0
                going_up = True

        time.sleep(ivl)


# ─── Mode: LED (sweep PWM 0→100→0, simulates a dimmer or brightness control) ──

def mode_led(client: PlatformClient, args):
    """
    Sweeps the value on --pin from 0 to 100 and back (like a PWM dimmer).

    On the website:
      - Add a LED widget linked to this pin.
      - In LED settings → set ledMode = 'pwm', pwmMin=0, pwmMax=100.
      - The LED will gradually brighten and dim.
      OR:
      - Add a Gauge or Progress Bar to watch the numeric value.

    Default pin: V2
    """
    pin  = f"V{args.pin}"
    ivl  = args.interval    # seconds between each step
    lo   = args.min         # 0 by default
    hi   = args.max         # 100 by default
    # PWM step size — sweeps full range in ~4 seconds at default 0.1 s interval
    steps = max(1, int(args.ramp_time / ivl))

    step = 0
    going_up = True

    print(f"\n[LED PWM] Pin={pin}  range={lo}→{hi}%  interval={ivl}s")
    print("Press Ctrl+C to stop.\n")

    while True:
        pct   = step / steps
        value = round(lo + (hi - lo) * pct, 1)

        client.send({pin: value}, {pin: "%"})

        if going_up:
            step += 1
            if step > steps:
                step = steps
                going_up = False
        else:
            step -= 1
            if step < 0:
                step = 0
                going_up = True

        time.sleep(ivl)


# ─── Mode: SWITCH (toggle between 0 and 1) ────────────────────────────────────

def mode_switch(client: PlatformClient, args):
    """
    Alternates the value on --pin between 0 and 1 every --toggle-interval seconds.

    On the website:
      - Add a Switch widget linked to this pin.
        Set onValue='1', offValue='0'.
      - Add a LED widget on the same pin (binary mode, threshold=0.5).
      Both will update when this simulator runs.

    Default pin: V3
    """
    pin    = f"V{args.pin}"
    toggle = args.toggle_interval   # seconds between toggles

    state = 0
    print(f"\n[SWITCH] Pin={pin}  toggles every {toggle}s")
    print("Press Ctrl+C to stop.\n")

    while True:
        client.send({pin: state})
        state = 1 - state      # flip 0→1 or 1→0
        time.sleep(toggle)


# ─── Mode: BUTTON (momentary press — HIGH for press_time, then LOW) ───────────

def mode_button(client: PlatformClient, args):
    """
    Simulates a push button: sends HIGH (1) on --pin for --press-time seconds,
    then sends LOW (0), then waits --interval seconds before the next press.

    On the website:
      - Add a LED widget on this pin (binary mode, threshold=0.5).
        The LED lights up while the button is "pressed" and goes off on release.
      - Add a Button widget on the same pin to also send from the dashboard.

    Default pin: V4
    """
    pin       = f"V{args.pin}"
    press_dur = args.press_time   # seconds to hold HIGH
    wait      = args.interval     # seconds between presses

    on_val  = args.on_value
    off_val = args.off_value

    print(f"\n[BUTTON] Pin={pin}  press={press_dur}s  period={wait}s  "
          f"HIGH={on_val}  LOW={off_val}")
    print("Press Ctrl+C to stop.\n")

    while True:
        print(f"         >>> PRESS (HIGH={on_val})")
        client.send({pin: on_val})
        time.sleep(press_dur)

        print(f"         <<< RELEASE (LOW={off_val})")
        client.send({pin: off_val})
        time.sleep(max(0, wait - press_dur))


# ─── Mode: DEMO (all pins at once, each in its own thread) ────────────────────

def mode_demo(client: PlatformClient, args):
    """
    Runs all four test scenarios simultaneously, each on its own virtual pin.

    Pin assignment:
      V0 → temperature sensor  ramp  15–40 °C
      V1 → humidity sensor     sine  30–90 %
      V2 → LED PWM dimmer      sweep 0–100 %
      V3 → switch / relay      toggle every 4 s
      V4 → push button         press 1 s, wait 6 s

    Leave this mode running, then interact with dashboard widgets to see
    real-time updates on Gauge, LED, Switch, Button, and Progress Bar.
    """
    print("\n[DEMO] Starting all simulation channels in background threads.")
    print("       Open your dashboard to watch the widgets update live.\n")
    print("  V0 → temperature   (Gauge / Line Chart / Progress Bar)")
    print("  V1 → humidity      (Gauge / Line Chart / Progress Bar)")
    print("  V2 → LED PWM       (LED widget in pwm mode)")
    print("  V3 → switch/relay  (Switch widget / LED in binary mode)")
    print("  V4 → push button   (LED in binary mode — lights for 1 s)")
    print("\nPress Ctrl+C to stop all channels.\n")

    interval = args.interval  # shared update frequency

    def run_temperature():
        # V0: temperature — slow linear ramp 15→40→15 °C over ~60 s
        lo, hi, unit = 15.0, 40.0, "°C"
        steps = max(1, int(60 / interval))
        step, going_up = 0, True
        while True:
            pct   = step / steps
            value = round(lo + (hi - lo) * pct, 2)
            client.send({"V0": value}, {"V0": unit})
            if going_up:
                step += 1
                if step > steps: step, going_up = steps, False
            else:
                step -= 1
                if step < 0: step, going_up = 0, True
            time.sleep(interval)

    def run_humidity():
        # V1: humidity — sine wave 30→90 % with a 40 s period
        t = 0
        while True:
            value = round(60 + 30 * math.sin(2 * math.pi * t / 40), 1)
            client.send({"V1": value}, {"V1": "%"})
            t += interval
            time.sleep(interval)

    def run_led_pwm():
        # V2: LED PWM — sweeps 0→100→0 in ~8 s
        steps = max(1, int(8 / interval))
        step, going_up = 0, True
        while True:
            pct   = step / steps
            value = round(pct * 100, 1)
            client.send({"V2": value}, {"V2": "%"})
            if going_up:
                step += 1
                if step > steps: step, going_up = steps, False
            else:
                step -= 1
                if step < 0: step, going_up = 0, True
            time.sleep(interval)

    def run_switch():
        # V3: switch — toggles every 4 seconds
        state = 0
        while True:
            client.send({"V3": state})
            state = 1 - state
            time.sleep(4)

    def run_button():
        # V4: push button — 1 s press every 7 s
        while True:
            client.send({"V4": 1})
            time.sleep(1)
            client.send({"V4": 0})
            time.sleep(6)

    threads = [
        threading.Thread(target=run_temperature, daemon=True, name="temp"),
        threading.Thread(target=run_humidity,    daemon=True, name="humi"),
        threading.Thread(target=run_led_pwm,     daemon=True, name="led"),
        threading.Thread(target=run_switch,      daemon=True, name="switch"),
        threading.Thread(target=run_button,      daemon=True, name="button"),
    ]
    for t in threads:
        t.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[DEMO] Stopped.")


# ─── CLI ─────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(
        description="IoT Platform Sensor & Control Simulator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    # ── connection ──────────────────────────────────────────────────────────
    p.add_argument("--api-key", required=True,
                   help="Device API key (copy from Devices page on the website)")
    p.add_argument("--host",    default="localhost",
                   help="Backend host (default: localhost)")
    p.add_argument("--port",    type=int, default=3000,
                   help="Backend HTTP port (default: 3000)")

    # ── mode ────────────────────────────────────────────────────────────────
    p.add_argument("--mode", default="demo",
                   choices=["demo", "sensor", "led", "switch", "button"],
                   help=(
                       "demo   — run all channels at once (V0-V4, recommended for first test)\n"
                       "sensor — ramp a single pin from --min to --max\n"
                       "led    — PWM sweep on a single pin (0→100→0)\n"
                       "switch — toggle a pin between 0 and 1\n"
                       "button — momentary press (HIGH then LOW) on a pin"
                   ))

    # ── virtual pin & range (used by sensor / led / switch / button) ────────
    p.add_argument("--pin",    type=int, default=0,
                   help="Virtual pin number, e.g. 0 for V0 (default: 0)")
    p.add_argument("--min",    type=float, default=0.0,
                   help="Minimum value for sensor/led ramp (default: 0)")
    p.add_argument("--max",    type=float, default=100.0,
                   help="Maximum value for sensor/led ramp (default: 100)")
    p.add_argument("--unit",   default="",
                   help="Unit label sent with each reading, e.g. '°C' (default: empty)")

    # ── timing ──────────────────────────────────────────────────────────────
    p.add_argument("--interval",        type=float, default=1.0,
                   help="Seconds between each HTTP send (default: 1.0)")
    p.add_argument("--ramp-time",       type=float, default=30.0,
                   help="Seconds to sweep from min to max in sensor/led mode (default: 30)")
    p.add_argument("--toggle-interval", type=float, default=4.0,
                   help="Seconds between on/off toggles in switch mode (default: 4)")
    p.add_argument("--press-time",      type=float, default=1.0,
                   help="Seconds to hold the button HIGH in button mode (default: 1)")

    # ── button values ────────────────────────────────────────────────────────
    p.add_argument("--on-value",  type=float, default=1,
                   help="Value to send on button press / switch ON (default: 1)")
    p.add_argument("--off-value", type=float, default=0,
                   help="Value to send on button release / switch OFF (default: 0)")

    args = p.parse_args()

    client = PlatformClient(args.host, args.port, args.api_key)

    print(f"IoT Platform Simulator")
    print(f"  Backend : http://{args.host}:{args.port}")
    print(f"  API Key : {args.api_key[:8]}{'*' * max(0, len(args.api_key) - 8)}")
    print(f"  Mode    : {args.mode}")

    try:
        if   args.mode == "demo":   mode_demo(client, args)
        elif args.mode == "sensor": mode_sensor(client, args)
        elif args.mode == "led":    mode_led(client, args)
        elif args.mode == "switch": mode_switch(client, args)
        elif args.mode == "button": mode_button(client, args)
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
