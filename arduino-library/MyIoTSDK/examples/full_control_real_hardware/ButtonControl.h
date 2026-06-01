#pragma once
#include <Arduino.h>

class ButtonControl
{
  int pin;
  bool last;

public:

  ButtonControl(int p)
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
      delay(20);
      last = raw;

      bool state = (raw == HIGH);

      Serial.printf("[BTN] %s\n", state ? "PRESSED" : "RELEASED");

      send(state);
    }
  }
};