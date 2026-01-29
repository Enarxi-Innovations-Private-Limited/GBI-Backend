# Migration Drift Resolution Guide

## Problem

You have a **migration drift** because:
1. A migration `20260123094952_add_soft_delete_device` was applied to the database
2. But this migration file is missing from your local `prisma/migrations` folder
3. This prevents new migrations from being applied

## Solution Options

### **Option 1: Manual SQL Migration (Recommended - No Data Loss)**

This approach directly updates the database without resetting.

#### Step 1: Run the SQL Script in Your Database

Use your database client (DataGrip, pgAdmin, etc.) and run:

```sql
-- Convert integer columns (PM2.5, PM10, TVOC, CO2, Noise)
ALTER TABLE "DeviceTelemetry" 
  ALTER COLUMN pm25 TYPE INTEGER USING ROUND(pm25)::INTEGER,
  ALTER COLUMN pm10 TYPE INTEGER USING ROUND(pm10)::INTEGER,
  ALTER COLUMN tvoc TYPE INTEGER USING ROUND(tvoc)::INTEGER,
  ALTER COLUMN co2 TYPE INTEGER USING ROUND(co2)::INTEGER,
  ALTER COLUMN noise TYPE INTEGER USING ROUND(noise)::INTEGER;
```

#### Step 2: Mark Migration as Applied

After running the SQL, mark the migration as resolved:

```bash
npx prisma migrate resolve --applied 20260123094952_add_soft_delete_device
```

#### Step 3: Generate Prisma Client

```bash
npx prisma generate
```

#### Step 4: Verify

```sql
-- Check data types
SELECT 
  column_name, 
  data_type
FROM information_schema.columns
WHERE table_name = 'DeviceTelemetry'
  AND column_name IN ('pm25', 'pm10', 'tvoc', 'co2', 'noise', 'temperature', 'humidity');
```

Expected:
- pm25, pm10, tvoc, co2, noise → `integer`
- temperature, humidity → `double precision`

---

### **Option 2: Reset and Migrate (Clean Start - Data Will Be Lost)**

⚠️ **WARNING: This will delete ALL data in your development database!**

```bash
# Reset database and apply all migrations
npx prisma migrate reset

# Generate Prisma client
npx prisma generate
```

This will:
1. Drop all tables
2. Run all migrations from scratch
3. Apply your new schema changes

---

### **Option 3: Use Prisma DB Push (Quick Fix for Development)**

This bypasses migrations entirely:

```bash
npx prisma db push
```

⚠️ **Note:** This is fine for development but not recommended for production.

---

## After Migration is Fixed

### Test the Changes

Run the test script:
```bash
node test-data-conversion.js
```

### Verify Data in Database

```sql
-- Check recent telemetry data
SELECT 
  pm25::text || ' (type: ' || pg_typeof(pm25)::text || ')' as pm25_info,
  pm10::text || ' (type: ' || pg_typeof(pm10)::text || ')' as pm10_info,
  temperature::text || ' (type: ' || pg_typeof(temperature)::text || ')' as temp_info,
  timestamp
FROM "DeviceTelemetry" 
ORDER BY timestamp DESC 
LIMIT 5;
```

You should see:
- pm25, pm10 showing type `integer`
- temperature showing type `double precision`

---

## Quick Commands Reference

| Task | Command |
|------|---------|
| Manual SQL | Run `manual-migration.sql` in database client |
| Mark migration as applied | `npx prisma migrate resolve --applied <migration_name>` |
| Reset database | `npx prisma migrate reset` |
| Push schema changes | `npx prisma db push` |
| Generate client | `npx prisma generate` |
| Check migrations status | `npx prisma migrate status` |

---

## Recommended Approach

For your situation, I recommend **Option 1** (Manual SQL):

1. ✅ **No data loss** - existing telemetry preserved
2. ✅ **Clean resolution** - properly handles migration drift
3. ✅ **Fast** - takes seconds to run

### Steps:

```bash
# 1. Run the SQL in your database client (see manual-migration.sql)

# 2. Mark the missing migration as applied
npx prisma migrate resolve --applied 20260123094952_add_soft_delete_device

# 3. Generate Prisma client
npx prisma generate

# 4. Restart your backend
# The running dev server will auto-reload
```

---

## Why This Happened

This drift occurs when:
- Someone applied a migration directly to the database
- Or you're working in a team and don't have the latest migration files
- Or migrations were applied from a different branch

To prevent in future:
1. Always commit migration files to git
2. Always pull latest migrations before creating new ones
3. Use `npx prisma migrate status` to check for drift

---

## Current Status

### ✅ Schema Updated
- Device model has `isDeleted` and `deletedAt` fields
- DeviceTelemetry has Int types for pm25, pm10, tvoc, co2, noise

### ⏳ Database Pending
- Still has `double precision` for all numeric fields
- Needs manual SQL migration or reset

### ✅ DTO Ready
- Transform decorators are in place
- Will automatically convert data types once DB is updated

---

## Next Steps

1. **Choose your approach** (I recommend Option 1 - Manual SQL)
2. **Apply the changes** using the commands above
3. **Test with** `node test-data-conversion.js`
4. **Verify** data types in database

Your code is ready - we just need to update the database schema! 🚀
