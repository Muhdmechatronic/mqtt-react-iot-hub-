#pragma once
#include <Arduino.h>

class HumiditySimulator
{
private:
    float currentHumidity;
    unsigned long lastUpdate;

public:
    HumiditySimulator()
    {
        // Malaysia realistic humidity
        currentHumidity = 78.0;
        lastUpdate = 0;
    }

    float update()
    {
        // update every 5 seconds
        if (millis() - lastUpdate >= 5000)
        {
            lastUpdate = millis();

            // random fluctuation
            float change = random(-30, 31) / 100.0;

            currentHumidity += change;

            // realistic Malaysia humidity range
            currentHumidity = constrain(currentHumidity, 60.0, 95.0);
        }

        return currentHumidity;
    }

    float get()
    {
        return currentHumidity;
    }
};