#pragma once
#include <Arduino.h>

class SwitchControl
{
  int pin;
  bool last;

public:

  SwitchControl(int p)
  {
    pin = p;
    pinMode(pin, INPUT_PULLUP);
    last = true;
  }

  void sync(void (*send)(bool))
  {
    bool raw = digitalRead(pin);

    if (raw != last)
    {
      delay(30);
      last = raw;

      bool state = !raw;

      Serial.printf("[SW] %s\n", state ? "ON" : "OFF");

      send(state);
    }
  }
};