#pragma once
#include <Arduino.h>

class TemperatureSimulator
{
private:
    float currentTemp;
    unsigned long lastUpdate;

public:
    TemperatureSimulator()
    {
        // Malaysia realistic start temperature
        currentTemp = 29.5;
        lastUpdate = 0;
    }

    float update()
    {
        // update every 5 seconds
        if (millis() - lastUpdate >= 5000)
        {
            lastUpdate = millis();

            // small random fluctuation
            float change = random(-20, 21) / 100.0;

            currentTemp += change;

            // realistic Malaysia indoor/outdoor range
            currentTemp = constrain(currentTemp, 24.0, 36.0);
        }

        return currentTemp;
    }

    float get()
    {
        return currentTemp;
    }
};