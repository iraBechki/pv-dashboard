# AD7705 Wiring Guide for WS Node

## Critical Fix: DRDY Pin Must Be Connected!

The **DRDY (Data Ready)** pin is essential for the AD7705 to work properly. Without it, the STM32 cannot tell when a new measurement is ready.

---

## Complete Wiring Diagram

```
AD7705 Module          STM32 Blue Pill
┌─────────────┐        ┌──────────────┐
│             │        │              │
│  VDD  ──────┼────────┼──→ 3.3V      │
│  GND  ──────┼────────┼──→ GND       │
│             │        │              │
│  CS   ──────┼────────┼──→ PA1       │
│  SCLK ──────┼────────┼──→ PA5 (SCK) │
│  MISO ──────┼────────┼──→ PA6       │
│  MOSI ──────┼────────┼──→ PA7       │
│  DRDY ──────┼────────┼──→ PB0  ⚠️   │ ← MUST CONNECT THIS!
│             │        │              │
│  AIN1+ ─────┼──→ Shunt Resistor (+) side
│  AIN1- ─────┼──→ Shunt Resistor (−) side / GND
│             │        │              │
└─────────────┘        └──────────────┘
```

---

## Shunt Resistor Setup (For Irradiance Measurement)

```
Solar Panel (+) ──┬──→ AIN1+
                  │
              [3.3Ω Shunt]
                  │
Solar Panel (−) ──┴──→ AIN1− and GND
```

For testing with a voltage source (0.7V):
```
Power Supply (+) ─→ AIN1+
Power Supply (−) ─→ AIN1− and GND
```

---

## Pin Functions Explained

| Pin   | Function | Description |
|-------|----------|-------------|
| VDD   | Power    | 3.3V power supply |
| GND   | Ground   | Common ground |
| CS    | Chip Select | Active LOW, tells AD7705 it's being addressed |
| SCLK  | SPI Clock | Clock signal from STM32 |
| MISO  | SPI Data | Data from AD7705 to STM32 |
| MOSI  | SPI Data | Data from STM32 to AD7705 |
| **DRDY** | **Data Ready** | **Goes LOW when conversion is complete** ⚠️ |
| AIN1+ | Analog In | Positive differential input |
| AIN1− | Analog In | Negative differential input |

---

## Why DRDY is Critical

❌ **Without DRDY connected:** Code tries to poll status via SPI → unreliable → constant timeouts!

✅ **With DRDY connected:** STM32 can reliably detect when data is ready → no timeouts!

---

## Testing Steps

1. **Connect the DRDY pin to PB0**
2. Upload `ad7705_simple_test.ino` - should show "OK - chip responding!"
3. Upload `ws.ino` - timeouts should be gone
4. Apply 0.7V and verify correct reading

---

## Troubleshooting

### Still getting timeouts after connecting DRDY?
- Double-check DRDY wire is connected to **PB0** (not PB1 or other pin)
- Verify DRDY pin on AD7705 module (check module documentation)
- Ensure 3.3V power is stable (measure with multimeter)

### Getting wrong voltage readings?
- Check AIN1+ and AIN1− connections
- Verify voltage divider calculations in code
- Ensure proper ground connection

---

## Code Files Updated

✅ `ws.ino` - Now uses DRDY pin for reliable operation
✅ `ad7705_simple_test.ino` - Tests communication including DRDY

Upload these files after connecting the DRDY wire!
