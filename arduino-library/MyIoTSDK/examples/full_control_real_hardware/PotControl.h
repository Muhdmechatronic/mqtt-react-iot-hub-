#pragma once
#include <Arduino.h>

class PotControl
{
  int pin;

  static const int SAMPLES = 10;
  int samples[SAMPLES];
  int index = 0;
  bool filled = false;

  int lastSent = -1;

public:

  PotControl(int p)
  {
    pin = p;
    pinMode(pin, INPUT);
  }

  int average()
  {
    long sum = 0;
    int count = filled ? SAMPLES : index;

    for (int i = 0; i < count; i++)
      sum += samples[i];

    return (count == 0) ? 0 : sum / count;
  }

  void sync(void (*send)(int))
  {
    int raw = analogRead(pin);
    int value = map(raw, 0, 4095, 0, 100);

    samples[index++] = value;

    if (index >= SAMPLES)
    {
      index = 0;
      filled = true;
    }

    int avg = average();

    if (lastSent == -1 || abs(avg - lastSent) >= 3)
    {
      lastSent = avg;

      Serial.printf("[POT] %d%%\n", avg);

      send(avg);
    }
  }
};