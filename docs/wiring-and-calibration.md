# 🔧 Wiring Diagram & Calibration Guide

## Components Needed

| Component | Qty | Notes |
|-----------|-----|-------|
| ESP32 DevKit V1 | 1 | Any ESP32 board works |
| ZMPT101B | 1 | AC voltage sensor module |
| SCT-013-000 | 1 | 100A:50mA current transformer (CT clamp) |
| 33Ω resistor | 1 | Burden resistor for SCT-013 (1/4W is fine) |
| 10kΩ resistor | 2 | For voltage divider (SCT-013 bias) |
| 10µF capacitor | 1 | For signal filtering |
| Jumper wires | ~10 | Male-to-female |
| Breadboard | 1 | Optional, for prototyping |

## ⚠️ SAFETY WARNING

**AC MAINS VOLTAGE IS LETHAL.** 
- The ZMPT101B provides galvanic isolation — use it.
- The SCT-013 is a clamp-on CT — it does NOT contact mains directly.
- NEVER work on live circuits. Unplug before wiring.
- If you're not confident, start with a low-voltage AC source (e.g., a 12V transformer) for testing.

## Wiring Diagram

```
ESP32 DevKit V1
┌──────────────────────────────┐
│                              │
│  3.3V ──┬── ZMPT101B VCC    │
│  GND  ──┼── ZMPT101B GND    │
│  GPIO36 ─── ZMPT101B OUT     │  ← Voltage sensing
│                              │
│  3.3V ──┬── 10kΩ ──┬── GPIO39│  ← Current sensing
│  GND  ──┼── 10kΩ ──┘        │
│         │                    │
│         └── 10µF ── GND      │  ← Filter cap
│                              │
│  5V  ── SCT-013 burden net  │
│  GND ── SCT-013 burden net  │
│                              │
└──────────────────────────────┘

ZMPT101B Module
┌──────────────┐
│  VCC ← 3.3V  │
│  GND ← GND   │
│  OUT → GPIO36│
└──────────────┘
   │
   └── AC Input: Connect to AC mains via the module's
       screw terminals (LIVE and NEUTRAL)
       The module has built-in isolation transformer

SCT-013-000 (CT Clamp)
┌──────────────────────┐
│   ╭───────╮          │
│   │ CLAMP │ ← Clip around ONE wire (LIVE or NEUTRAL, not both)
│   ╰───┬───╯          │
│       │              │
│   Output pins        │
│   ┌───┴───┐          │
│   │ A  │  B │        │
│   └───┬───┘          │
└───────┼──────────────┘
        │
        ▼
   Bias Circuit (on breadboard):
   
   3.3V ──[10kΩ]──┬──[10kΩ]── GND
                   │
                   ├──[33Ω]── SCT-013 pin A
                   │
              SCT-013 pin B ── GND
                   │
              [10µF] ── GND  (filter cap across signal to GND)
                   │
                   └──→ GPIO 39 (ESP32 ADC)
```

## Detailed Wiring Steps

### 1. ZMPT101B (Voltage Sensor)
1. Connect ZMPT101B **VCC** → ESP32 **3.3V** (or 5V — check your module)
2. Connect ZMPT101B **GND** → ESP32 **GND**
3. Connect ZMPT101B **OUT** → ESP32 **GPIO 36**
4. Connect ZMPT101B **AC input terminals** to mains via a plug/socket
   - LIVE → one terminal, NEUTRAL → other terminal
   - The module is isolated — no direct contact with mains

### 2. SCT-013 (Current Sensor)
1. **Clip the CT** around ONE wire of your device's power cord
   - Either LIVE or NEUTRAL — NOT both (they cancel out)
   - If your cord has both wires together, you may need to separate them
   - Or use an extension cord and split one wire

2. **Build the bias circuit** on a breadboard:
   ```
   Create a voltage divider: 3.3V → 10kΩ → (midpoint) → 10kΩ → GND
   The midpoint (~1.65V) is your DC bias.
   
   Connect SCT-013 output through a 33Ω burden resistor to the midpoint.
   SCT-013 other pin → GND.
   
   Add a 10µF capacitor from midpoint to GND (filters noise).
   
   Connect midpoint → GPIO 39.
   ```

### 3. Power
- Power the ESP32 via USB from your computer or a USB adapter
- The ESP32's 3.3V/5V pins power the sensors

## Calibration Guide

### Voltage Calibration (ZMPT101B)

1. **Upload the firmware** to ESP32
2. **Open Serial Monitor** (115200 baud)
3. **Measure actual AC voltage** with a multimeter at the outlet
4. **Adjust `VOLTAGE_MULTIPLIER`** in the code:
   ```
   If ESP32 reads 200V but multimeter shows 230V:
   New multiplier = 0.352 * (230 / 200) = 0.352 * 1.15 = 0.405
   ```
5. Re-upload and verify

**Starting values for ZMPT101B:**
- For 230V mains: `VOLTAGE_MULTIPLIER = 0.352`
- For 110V mains: `VOLTAGE_MULTIPLIER = 0.170`

### Current Calibration (SCT-013)

1. **Know your SCT-013 variant:**
   - SCT-013-000: 100A:50mA ratio
   - SCT-013-030: 30A:1V (has built-in burden, outputs voltage directly)
   - SCT-013-050: 50A:1V (has built-in burden)

2. **For SCT-013-000 (current output type):**
   - With 33Ω burden: sensitivity = 0.066 V/A
   - `CURRENT_SENSITIVITY = 0.066`

3. **For SCT-013-030/050 (voltage output type):**
   - These have built-in burden resistors
   - You may not need the external 33Ω resistor
   - Adjust `CURRENT_SENSITIVITY` accordingly

4. **Calibrate with a known load:**
   - Plug in a device with known wattage (e.g., a 100W bulb)
   - At 230V, a 100W bulb draws ~0.43A
   - Adjust `CURRENT_SENSITIVITY` until reading matches

### Fine-Tuning Tips

- **Noise issues?** Increase `RMS_SAMPLES` to 1000
- **Readings too slow?** Decrease `RMS_SAMPLES` to 200
- **ESP32 ADC is non-linear** — the `esp_adc_cal` library helps but isn't perfect
- **For best accuracy**, calibrate at the voltage/current range you'll actually use
- **Temperature affects readings** — let sensors warm up for 5 minutes before calibrating

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Voltage reads 0 | ZMPT101B not connected / wrong pin | Check wiring, verify GPIO 36 |
| Current reads 0 | CT not clamped / wrong wire | Clip around ONE wire only |
| Readings are noisy | No filter cap / loose wiring | Add 10µF cap, check connections |
| WiFi won't connect | Wrong credentials / weak signal | Check SSID/password, move closer |
| Supabase insert fails | Wrong URL/key / no internet | Verify Supabase credentials |
| Readings are way off | Calibration needed | Follow calibration guide above |
| ESP32 keeps restarting | Power supply issue | Use a good USB cable / 2A adapter |
