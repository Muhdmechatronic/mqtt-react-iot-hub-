#include <Arduino.h>
#include <MyIoTSDK.h>

#include "SwitchControl.h"
#include "ButtonControl.h"
#include "PotControl.h"

#include "temperature.h"
#include "humidity.h"

// ─────────────────────────────
// CONFIG
// ─────────────────────────────
const char* WIFI_SSID  = "rumah_2.4GHz";
const char* WIFI_PASS  = "cikgu_smile";

const char* SERVER_HOST = "192.168.0.220";
const char* API_KEY     = "2959b178f9444457882ea1f38e81770f";

// ─────────────────────────────
// PINS
// ─────────────────────────────
SwitchControl mySwitch(5);
ButtonControl myButton(21);
PotControl    myPot(33);

// ─────────────────────────────
// SENSOR SIMULATORS
// ─────────────────────────────
TemperatureSimulator tempSensor;
HumiditySimulator    humiditySensor;

// ─────────────────────────────
// LED PINS
// ─────────────────────────────
const int LED_GREEN  = 4;
const int LED_YELLOW = 18;
const int LED_RED    = 0;

// PWM
const int PWM_CH = 0;
const int PWM_FREQ = 5000;
const int PWM_BITS = 8;

// ─────────────────────────────
// SEND FUNCTIONS
// ─────────────────────────────
void sendSwitch(bool v)
{
  MyIoT.writePin(3, v ? 1.0f : 0.0f);
  digitalWrite(LED_GREEN, v);
}

void sendButton(bool v)
{
  MyIoT.writePin(4, v ? 1.0f : 0.0f);
  digitalWrite(LED_YELLOW, v);
}

void sendPot(int v)
{
  MyIoT.writePin(2, v);

  // reverse PWM
  int duty = map(v, 0, 100, 255, 0);

  ledcWrite(PWM_CH, duty);
}

// ─────────────────────────────
// SERVER CALLBACKS
// ─────────────────────────────
void onV2Changed(float val)
{
  int pwm = constrain((int)val, 0, 100);
  sendPot(pwm);
}

void onV3Changed(float val)
{
  digitalWrite(LED_GREEN, val > 0.5);
}

void onV4Changed(float val)
{
  digitalWrite(LED_YELLOW, val > 0.5);
}

// ─────────────────────────────
// SENSOR SEND TIMER
// ─────────────────────────────
unsigned long lastSensorSend = 0;

// ─────────────────────────────
// SETUP
// ─────────────────────────────
void setup()
{
  Serial.begin(115200);

  randomSeed(analogRead(34));

  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);

  ledcAttach(LED_RED, PWM_FREQ, PWM_BITS);
  ledcWrite(PWM_CH, 0);

  MyIoT.begin(WIFI_SSID, WIFI_PASS);
  MyIoT.connect(API_KEY, SERVER_HOST);

  MyIoT.onPin(2, onV2Changed);
  MyIoT.onPin(3, onV3Changed);
  MyIoT.onPin(4, onV4Changed);

  Serial.println("[SYSTEM READY]");
}

// ─────────────────────────────
// LOOP
// ─────────────────────────────
void loop()
{
  MyIoT.loop();

  mySwitch.sync(sendSwitch);
  myButton.sync(sendButton);
  myPot.sync(sendPot);

  // ─────────────────────────
  // SEND SENSOR DATA
  // ─────────────────────────
  if (millis() - lastSensorSend >= 5000)
  {
    lastSensorSend = millis();

    float temp = tempSensor.update();
    float hum  = humiditySensor.update();

    // V0 = temperature
    // V1 = humidity
    MyIoT.writePin(0, temp);
    MyIoT.writePin(1, hum);

    Serial.println("========== SENSOR ==========");
    Serial.print("Temperature: ");
    Serial.print(temp);
    Serial.println(" °C");

    Serial.print("Humidity: ");
    Serial.print(hum);
    Serial.println(" %");
  }
}