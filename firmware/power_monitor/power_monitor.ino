/*
 * ESP32 Power Monitor - ZMPT101B + SCT-013 -> Supabase
 * 
 * Measures AC voltage, current, power and sends to Supabase
 * every 2 seconds via REST API.
 *
 * Hardware:
 *   ESP32 DevKit V1
 *   ZMPT101B  -> GPIO 36 (ADC1_CH0)  [voltage]
 *   SCT-013   -> GPIO 39 (ADC1_CH3)  [current]
 *
 * Libraries (install via Arduino Library Manager):
 *   - ESPSupabase  (by jhagas)
 *   - ArduinoJson   (by Benoit Blanchon)
 */

#include <WiFi.h>
#include <ESPSupabase.h>
#include <ArduinoJson.h>
#include <esp_adc_cal.h>

// ── CONFIGURATION - EDIT THESE ──

const char* WIFI_SSID      = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD  = "YOUR_WIFI_PASSWORD";
const char* SUPABASE_URL   = "https://YOUR_PROJECT_ID.supabase.co";
const char* SUPABASE_KEY   = "YOUR_SUPABASE_ANON_KEY";

// Sensor pins (ESP32 ADC1 channels)
#define VOLTAGE_PIN   36   // ZMPT101B output
#define CURRENT_PIN   39   // SCT-013 output (via voltage divider)

// ── CALIBRATION CONSTANTS ──
// You MUST calibrate these for your specific sensors!

// ZMPT101B: measure actual AC voltage with a multimeter,
// then adjust VOLTAGE_MULTIPLIER until reading matches.
float VOLTAGE_MULTIPLIER  = 0.352;

// SCT-013-000 (100A:50mA) with 33 ohm burden resistor:
// Sensitivity = 0.066 V/A
float CURRENT_SENSITIVITY = 0.066;

// RMS sampling
#define RMS_SAMPLES       500
#define SAMPLE_INTERVAL   100   // microseconds between samples

// ── GLOBALS ──

ESPSupabase supabase(SUPABASE_URL, SUPABASE_KEY);
esp_adc_cal_characteristics_t adcChars;
unsigned long lastSendTime = 0;
const unsigned long SEND_INTERVAL = 2000;

// ── SETUP ──

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== ESP32 Power Monitor (ZMPT101B + SCT-013) ===");

  // ADC configuration
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  adc1_config_channel_atten(ADC1_CHANNEL_0, ADC_ATTEN_DB_11);
  adc1_config_channel_atten(ADC1_CHANNEL_3, ADC_ATTEN_DB_11);
  esp_adc_cal_characterize(ADC_UNIT_1, ADC_ATTEN_DB_11, ADC_WIDTH_BIT_12, 1100, &adcChars);

  // Connect Wi-Fi
  Serial.printf("Connecting to %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.printf("  IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\nWiFi FAILED! Restarting...");
    delay(10000);
    ESP.restart();
  }

  Serial.println("Setup complete.\n");
}

// ── MAIN LOOP ──

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    delay(5000);
    return;
  }

  if (millis() - lastSendTime >= SEND_INTERVAL) {
    lastSendTime = millis();

    float voltage = readVoltageRMS();
    float current = readCurrentRMS();
    float power   = voltage * current;

    Serial.printf("[%.1fs] V=%.1fV  I=%.3fA  P=%.1fW\n",
                  millis() / 1000.0, voltage, current, power);

    sendToSupabase(voltage, current, power);
  }
}

// ── SENSOR READING ──

float readVoltageRMS() {
  float sumSq = 0;
  float sum = 0;

  for (int i = 0; i < RMS_SAMPLES; i++) {
    float v = readADC_V(VOLTAGE_PIN);
    sum   += v;
    sumSq += v * v;
    delayMicroseconds(SAMPLE_INTERVAL);
  }

  float mean   = sum / RMS_SAMPLES;
  float rmsSum = sumSq / RMS_SAMPLES;
  float acRMS  = sqrt(max(rmsSum - mean * mean, 0.0f));

  float voltage = acRMS * VOLTAGE_MULTIPLIER * 230.0;
  if (voltage < 10.0) voltage = 0;
  return voltage;
}

float readCurrentRMS() {
  float sumSq = 0;
  float sum = 0;

  for (int i = 0; i < RMS_SAMPLES; i++) {
    float v = readADC_V(CURRENT_PIN);
    sum   += v;
    sumSq += v * v;
    delayMicroseconds(SAMPLE_INTERVAL);
  }

  float mean   = sum / RMS_SAMPLES;
  float rmsSum = sumSq / RMS_SAMPLES;
  float acRMS  = sqrt(max(rmsSum - mean * mean, 0.0f));

  float current = acRMS / CURRENT_SENSITIVITY;
  if (current < 0.1) current = 0;
  return current;
}

// ── ADC HELPER ──

float readADC_V(int gpioPin) {
  uint32_t raw = 0;
  for (int i = 0; i < 4; i++) {
    raw += analogRead(gpioPin);
  }
  raw /= 4;
  uint32_t mv = esp_adc_cal_raw_to_voltage(raw, &adcChars);
  return mv / 1000.0;
}

// ── SUPABASE UPLOAD ──

void sendToSupabase(float voltage, float current, float power) {
  StaticJsonDocument<256> doc;
  doc["voltage"]   = round(voltage * 10.0) / 10.0;
  doc["current"]   = round(current * 1000.0) / 1000.0;
  doc["power"]     = round(power * 10.0) / 10.0;
  doc["device_id"] = "esp32_power_01";

  String payload;
  serializeJson(doc, payload);

  int httpCode = supabase.from("power_readings").insert(payload);

  if (httpCode == 200 || httpCode == 201) {
    Serial.println("  OK Sent to Supabase");
  } else {
    Serial.printf("  FAIL Supabase HTTP %d\n", httpCode);
  }
}
