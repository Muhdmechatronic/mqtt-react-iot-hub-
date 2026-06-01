#pragma once
#include <Arduino.h>

class LEDControl
{
  int pin;

public:

  LEDControl(int p)
  {
    pin = p;
    pinMode(pin, OUTPUT);
    digitalWrite(pin, LOW);
  }

  void set(bool state)
  {
    digitalWrite(pin, state ? HIGH : LOW);

    Serial.printf("[LED %d] %s\n",
                  pin,
                  state ? "ON" : "OFF");
  }
};