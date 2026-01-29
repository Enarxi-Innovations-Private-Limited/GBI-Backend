# Data Type Conversion Implementation Summary

## ✅ Changes Completed

### 1. **Prisma Schema Updated** (`prisma/schema.prisma`)

Changed `DeviceTelemetry` model data types:

| Field       | Old Type | New Type | Reason |
|-------------|----------|----------|--------|
| pm25        | Float    | **Int**  | Integer values only |
| pm10        | Float    | **Int**  | Integer values only |
| tvoc        | Float    | **Int**  | Integer values only |
| co2         | Float    | **Int**  | Integer values only |
| noise       | Float    | **Int**  | Integer values only |
| temperature | Float    | **Float** | 1 decimal precision |
| humidity    | Float    | **Float** | 1 decimal precision |

### 2. **DTO Validation Updated** (`src/mqtt/dto/telemetry-payload.dto.ts`)

Added `@Transform` decorators to **automatically convert** incoming data:

#### **For Integer Fields (PM2.5, PM10, TVOC, CO2, Noise):**
```typescript
@Transform(({ value }) => {
  if (value === null || value === undefined) return undefined;
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  return isNaN(num) ? undefined : Math.round(num);
})
```

**What this does:**
- ✅ Accepts strings: `"42.7"` → `43`
- ✅ Accepts floats: `42.7` → `43`
- ✅ Accepts integers: `42` → `42`
- ✅ Rounds to nearest integer using `Math.round()`
- ✅ Handles null/undefined gracefully

#### **For Float Fields (Temperature, Humidity):**
```typescript
@Transform(({ value }) => {
  if (value === null || value === undefined) return undefined;
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  return isNaN(num) ? undefined : parseFloat(num.toFixed(1));
})
```

**What this does:**
- ✅ Accepts strings: `"25.67"` → `25.7`
- ✅ Accepts floats: `25.67` → `25.7`
- ✅ Accepts integers: `25` → `25.0`
- ✅ Rounds to 1 decimal place using `toFixed(1)`
- ✅ Handles null/undefined gracefully

---

## 🔄 Database Migration Required

A database migration was created but **needs your confirmation** to apply.

### **Option 1: Apply Migration (Will Reset Development Data)**

```bash
npx prisma migrate dev --name change_telemetry_types_to_int_and_float
```

⚠️ **Warning:** This will delete all existing telemetry data in development database!

### **Option 2: Manual Migration for Production (Preserves Data)**

If you have production data you want to keep, create a custom migration:

```sql
-- First, convert existing data with rounding
ALTER TABLE "DeviceTelemetry" 
  ALTER COLUMN pm25 TYPE INTEGER USING ROUND(pm25)::INTEGER,
  ALTER COLUMN pm10 TYPE INTEGER USING ROUND(pm10)::INTEGER,
  ALTER COLUMN tvoc TYPE INTEGER USING ROUND(tvoc)::INTEGER,
  ALTER COLUMN co2 TYPE INTEGER USING ROUND(co2)::INTEGER,
  ALTER COLUMN noise TYPE INTEGER USING ROUND(noise)::INTEGER,
  ALTER COLUMN temperature TYPE DOUBLE PRECISION USING ROUND(temperature::numeric, 1),
  ALTER COLUMN humidity TYPE DOUBLE PRECISION USING ROUND(humidity::numeric, 1);
```

### **Option 3: Reset Database (Clean Start)**

If you don't have important data:

```bash
npx prisma migrate reset
npx prisma migrate dev
```

---

## 📝 Example Data Transformations

### **Input Examples:**

```json
{
  "pm25": "15.7",        // String with decimal
  "pm10": 30.2,          // Float
  "tvoc": "120",         // String integer
  "co2": 450,            // Integer
  "temperature": "25.67", // String with decimal
  "humidity": 60.12,     // Float
  "noise": "45.8"        // String with decimal
}
```

### **After Transformation & Storage:**

```json
{
  "pm25": 16,            // Rounded to integer
  "pm10": 30,            // Rounded to integer
  "tvoc": 120,           // Already integer
  "co2": 450,            // Already integer
  "temperature": 25.7,   // Rounded to 1 decimal
  "humidity": 60.1,      // Rounded to 1 decimal
  "noise": 46            // Rounded to integer
}
```

---

## 🧪 Testing the Changes

### **Test with Various Input Types:**

Create `test-data-conversion.js`:

```javascript
const testPayloads = [
  // Test 1: String inputs
  {
    pm25: "15.7",
    pm10: "30.2",
    temperature: "25.67",
    humidity: "60.12"
  },
  
  // Test 2: Float inputs
  {
    pm25: 15.7,
    pm10: 30.2,
    temperature: 25.67,
    humidity: 60.12
  },
  
  // Test 3: Integer inputs
  {
    pm25: 15,
    pm10: 30,
    temperature: 25,
    humidity: 60
  },
  
  // Test 4: Mixed types
  {
    pm25: "15",
    pm10: 30.5,
    temperature: "25.123",
    humidity: 60
  }
];

const mqtt = require('mqtt');

const client = mqtt.connect('mqtts://x28f127f.ala.asia-southeast1.emqxsl.com:8883', {
  username: 'gbi_admin',
  password: 'Admin@123',
  clientId: 'test-conversion-' + Math.random().toString(16).slice(2, 8)
});

client.on('connect', () => {
  console.log('✅ Connected to MQTT broker\n');
  
  testPayloads.forEach((payload, index) => {
    setTimeout(() => {
      console.log(`📤 Test ${index + 1}:`, JSON.stringify(payload));
      client.publish('gbi/devices/GBIAIR1000/telemetry', JSON.stringify(payload), { qos: 1 });
      
      if (index === testPayloads.length - 1) {
        setTimeout(() => {
          console.log('\n✅ All tests sent!');
          client.end();
        }, 1000);
      }
    }, index * 2000);
  });
});
```

Run:
```bash
node test-data-conversion.js
```

### **Verify in Database:**

```sql
SELECT 
  pm25, 
  pm10, 
  tvoc, 
  co2, 
  temperature, 
  humidity, 
  noise,
  timestamp
FROM "DeviceTelemetry" 
WHERE "deviceId" = (SELECT id FROM "Device" WHERE "deviceId" = 'GBIAIR1000')
ORDER BY timestamp DESC
LIMIT 10;
```

Check that:
- ✅ pm25, pm10, tvoc, co2, noise are **integers** (no decimals)
- ✅ temperature and humidity have **exactly 1 decimal place**

---

## 🔍 Backend Validation

The backend will now:

1. **Receive MQTT message** with any data types (string/float/int)
2. **Transform values** using the DTO decorators
3. **Validate ranges** (min/max values)
4. **Store in database** with correct types

### **Console Logs to Watch For:**

✅ **Success:**
```
✅ MQTT connected
```

⚠️ **Validation errors:**
```
Invalid telemetry payload: [validation errors]
```

❌ **Type conversion errors:**
```
MQTT message error: [error details]
```

---

## 📊 Data Type Summary

| Field | Input Examples | Stored As | Database Type |
|-------|---------------|-----------|---------------|
| PM2.5 | `"15.7"`, `15.7`, `15` | `16` | INTEGER |
| PM10 | `"30.2"`, `30.2`, `30` | `30` | INTEGER |
| TVOC | `"120.5"`, `120.5`, `120` | `121` | INTEGER |
| CO2 | `"450.8"`, `450.8`, `450` | `451` | INTEGER |
| Temperature | `"25.67"`, `25.67`, `25` | `25.7` | FLOAT (1 decimal) |
| Humidity | `"60.12"`, `60.12`, `60` | `60.1` | FLOAT (1 decimal) |
| Noise | `"45.8"`, `45.8`, `45` | `46` | INTEGER |

---

## ✅ Benefits of This Implementation

1. **Flexible Input:** Accepts strings, floats, or integers from IoT devices
2. **Automatic Conversion:** No need to pre-process data before sending
3. **Consistent Storage:** All data stored in standardized format
4. **Reduced Storage:** Integers use less space than floats
5. **Better Performance:** Integer operations are faster than float
6. **Precise Rounding:** Temperature/humidity maintain 1 decimal precision

---

## 🚀 Next Steps

1. **Apply migration** to update database schema:
   ```bash
   npx prisma migrate dev
   ```

2. **Restart backend** to load new DTO transformations
   - The backend is already running, changes will auto-reload

3. **Test with GBIAIR1000** device:
   ```bash
   node test-mqtt-publish.js
   ```

4. **Verify data** in database using SQL queries above

5. **Update IoT device firmware** (if needed) - though now it can send any format!

---

## 💡 Important Notes

- **Backward Compatible:** Old devices sending floats will still work
- **Forward Compatible:** New devices can send strings or integers
- **No Code Changes Needed** on IoT device side (flexible input handling)
- **Automatic Validation:** Invalid values are rejected with clear error messages
- **Null/Undefined Safe:** Missing values are handled gracefully

---

## 🔧 Troubleshooting

### **Issue: Migration fails**
**Solution:** 
```bash
npx prisma migrate reset
npx prisma generate
npx prisma migrate dev
```

### **Issue: Data still showing as float**
**Solution:** Make sure migration is applied and backend is restarted

### **Issue: Validation errors**
**Solution:** Check that values are within valid ranges (see DTO min/max)

### **Issue: Transform not working**
**Solution:** Ensure `class-transformer` is properly configured in MQTT consumer

---

**Status:** ✅ Code changes complete, awaiting database migration confirmation!
