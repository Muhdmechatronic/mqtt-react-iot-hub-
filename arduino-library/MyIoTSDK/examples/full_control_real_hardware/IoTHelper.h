#pragma once
#include <MyIoTSDK.h>

// CONFIG (centralized)
const char* WIFI_SSID  = "rumah_2.4GHz";
const char* WIFI_PASS  = "cikgu_smile";
const char* SERVER_HOST = "192.168.0.220";
const char* API_KEY     = "d6e5028a95b04c47809189d854f97630";

inline void IoTSetup()
{
  MyIoT.begin(WIFI_SSID, WIFI_PASS);
  MyIoT.connect(API_KEY, SERVER_HOST);
}

inline void IoTLoop()
{
  MyIoT.loop();
}