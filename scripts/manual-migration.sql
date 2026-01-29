-- Manual Database Migration Script
-- This will change the data types from DOUBLE PRECISION to INTEGER and proper FLOAT types
-- Run this in your PostgreSQL database directly

-- Step 1: Convert integer columns (PM2.5, PM10, TVOC, CO2, Noise)
-- These will be rounded to nearest integer
ALTER TABLE "DeviceTelemetry" 
  ALTER COLUMN pm25 TYPE INTEGER USING ROUND(pm25)::INTEGER,
  ALTER COLUMN pm10 TYPE INTEGER USING ROUND(pm10)::INTEGER,
  ALTER COLUMN tvoc TYPE INTEGER USING ROUND(tvoc)::INTEGER,
  ALTER COLUMN co2 TYPE INTEGER USING ROUND(co2)::INTEGER,
  ALTER COLUMN noise TYPE INTEGER USING ROUND(noise)::INTEGER;

-- Step 2: Convert float columns (Temperature, Humidity)
-- These will keep 1 decimal place precision
ALTER TABLE "DeviceTelemetry" 
  ALTER COLUMN temperature TYPE DOUBLE PRECISION USING ROUND(temperature::numeric, 1),
  ALTER COLUMN humidity TYPE DOUBLE PRECISION USING ROUND(humidity::numeric, 1);

-- Step 3: Verify the changes
SELECT 
  column_name, 
  data_type, 
  numeric_precision, 
  numeric_scale
FROM information_schema.columns
WHERE table_name = 'DeviceTelemetry'
  AND column_name IN ('pm25', 'pm10', 'tvoc', 'co2', 'noise', 'temperature', 'humidity')
ORDER BY ordinal_position;

-- Expected results:
-- pm25        | integer | 32 | 0
-- pm10        | integer | 32 | 0
-- tvoc        | integer | 32 | 0
-- co2         | integer | 32 | 0
-- noise       | integer | 32 | 0
-- temperature | double precision | 53 | null
-- humidity    | double precision | 53 | null
