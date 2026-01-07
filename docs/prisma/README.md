# Prisma Implementation Guide

## 📚 Table of Contents
1. [What is Prisma?](#what-is-prisma)
2. [How Prisma Works](#how-prisma-works)
3. [Schema Design](#schema-design)
4. [Prisma Client](#prisma-client)
5. [Database Interaction](#database-interaction)
6. [Our Implementation](#our-implementation)
7. [Challenges & Solutions](#challenges--solutions)
8. [Best Practices](#best-practices)

---

## What is Prisma?

Prisma is a **Next-generation ORM** (Object-Relational Mapping) for Node.js and TypeScript that provides:

- **Type Safety**: Auto-generated TypeScript types from your database schema
- **Auto-completion**: IntelliSense for database queries
- **Database Migrations**: Version-controlled schema changes
- **Multiple Databases**: PostgreSQL, MySQL, SQLite, MongoDB, etc.
- **Prisma Studio**: Visual database browser

### Why We Choose Prisma?

1. **Type-Safe Queries**: Catch errors at compile time, not runtime
2. **Developer Experience**: Excellent autocomplete and error messages
3. **Migration System**: Easy database schema versioning
4. **Performance**: Optimized query engine
5. **Ecosystem**: Works seamlessly with NestJS

---

## How Prisma Works

### Architecture Overview

```
┌─────────────────────────────────────────────────┐
│           Your NestJS Application               │
│                                                 │
│  ┌─────────────────────────────────────────┐  │
│  │       Prisma Client (Generated)         │  │
│  │  - Type-safe database queries           │  │
│  │  - Auto-completion                      │  │
│  └─────────────────┬───────────────────────┘  │
│                    │                            │
└────────────────────┼────────────────────────────┘
                     │
           ┌─────────▼─────────┐
           │  Prisma Engine    │
           │  (Query Engine)   │
           └─────────┬─────────┘
                     │
           ┌─────────▼─────────┐
           │   PostgreSQL      │
           │   Database        │
           └───────────────────┘
```

### The Flow

1. **Schema Definition** (`schema.prisma`)
   - Define your data models
   - Specify relations
   - Configure database connection

2. **Client Generation** (`prisma generate`)
   - Reads your schema
   - Generates TypeScript client
   - Creates type definitions

3. **Migrations** (`prisma migrate dev`)
   - Translates schema changes to SQL
   - Applies changes to database
   - Tracks migration history

4. **Database Queries** (Runtime)
   - Your app uses Prisma Client
   - Type-safe queries execute
   - Results are automatically typed

---

## Schema Design

### File: `prisma/schema.prisma`

Our schema defines the entire database structure in a human-readable format.

### Schema Components

#### 1. **Generator**
```prisma
generator client {
  provider = "prisma-client-js"
}
```
- Defines what code to generate
- `prisma-client-js` = TypeScript/JavaScript client
- Generated to `node_modules/@prisma/client` (default)

#### 2. **Datasource**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```
- Database type: PostgreSQL
- Connection string from `.env` file
- `env()` reads environment variables

#### 3. **Models**

Each model represents a database table:

```prisma
model User {
  id            String   @id @default(uuid())
  email         String   @unique
  passwordHash  String?
  name          String?
  emailVerified Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  // Relations
  refreshTokens RefreshToken[]
  devices       DeviceAssignment[]
}
```

**Field Types:**
- `String` → VARCHAR/TEXT
- `Int` → INTEGER
- `Float` → DECIMAL/FLOAT
- `Boolean` → BOOLEAN
- `DateTime` → TIMESTAMP
- `BigInt` → BIGINT

**Attributes:**
- `@id` → Primary key
- `@unique` → Unique constraint
- `@default()` → Default value
- `@updatedAt` → Auto-update timestamp
- `?` → Optional/nullable field

### Relations Explained

#### One-to-Many
```prisma
model User {
  id            String          @id @default(uuid())
  refreshTokens RefreshToken[]  // User has many tokens
}

model RefreshToken {
  id     String @id @default(uuid())
  userId String
  user   User   @relation(fields: [userId], references: [id])
}
```

#### Many-to-Many
```prisma
model DeviceAssignment {
  id       String @id @default(uuid())
  userId   String
  deviceId String
  
  user   User   @relation(fields: [userId], references: [id])
  device Device @relation(fields: [deviceId], references: [id])
  
  @@index([userId])
  @@index([deviceId])
}
```

### Full Schema Structure

Our database has these models:

1. **User** - User accounts (auth)
2. **Admin** - Admin accounts
3. **RefreshToken** - Session management
4. **Device** - IoT devices
5. **DeviceAssignment** - User-device mapping
6. **UserDevice** - Custom device metadata
7. **DeviceTelemetry** - Sensor data (time-series)
8. **AlertThreshold** - User alert preferences
9. **EventLog** - System events
10. **Notification** - User notifications

---

## Prisma Client

### What is Prisma Client?

Prisma Client is an **auto-generated**, **type-safe** database client that's tailored to your schema.

### Generation Process

```bash
pnpm prisma generate
```

This command:
1. Reads `prisma/schema.prisma`
2. Analyzes all models and relations
3. Generates TypeScript types
4. Creates client methods
5. Outputs to `node_modules/@prisma/client`

### Generated API

For each model, Prisma generates:

```typescript
prisma.user.findMany()      // Get all users
prisma.user.findUnique()    // Get one user
prisma.user.create()        // Create user
prisma.user.update()        // Update user
prisma.user.delete()        // Delete user
prisma.user.count()         // Count users
```

### Type Safety

```typescript
// ✅ Type-safe
const user = await prisma.user.create({
  data: {
    email: 'test@example.com',
    name: 'Test User',
  },
});
// user is typed as:
// { id: string, email: string, name: string | null, ... }

// ❌ TypeScript error - 'emaill' doesn't exist
const user = await prisma.user.create({
  data: {
    emaill: 'test@example.com',  // Typo caught at compile time!
  },
});
```

---

## Database Interaction

### How Our App Interacts with Database

```
1. Application Starts
   ↓
2. PrismaService Initializes
   ↓
3. Prisma Client Connects to PostgreSQL
   ↓
4. Controllers/Services Use Prisma Client
   ↓
5. Queries Execute → Results Return
   ↓
6. Application Shuts Down → Client Disconnects
```

### Query Examples

#### Create
```typescript
const user = await this.prisma.user.create({
  data: {
    email: 'john@example.com',
    passwordHash: hashedPassword,
    name: 'John Doe',
    emailVerified: true,
  },
});
```

**Generated SQL:**
```sql
INSERT INTO "User" ("id", "email", "passwordHash", "name", "emailVerified", "createdAt", "updatedAt")
VALUES (uuid_generate_v4(), 'john@example.com', '$2b$12...', 'John Doe', true, NOW(), NOW())
RETURNING *;
```

#### Read with Relations
```typescript
const user = await this.prisma.user.findUnique({
  where: { email: 'john@example.com' },
  include: {
    refreshTokens: true,
    devices: {
      include: {
        device: true,
      },
    },
  },
});
```

**Generated SQL:**
```sql
SELECT * FROM "User" WHERE "email" = 'john@example.com';
SELECT * FROM "RefreshToken" WHERE "userId" = <user.id>;
SELECT * FROM "DeviceAssignment" WHERE "userId" = <user.id>;
SELECT * FROM "Device" WHERE "id" IN (...);
```

#### Update
```typescript
const updated = await this.prisma.user.update({
  where: { id: userId },
  data: {
    emailVerified: true,
    phoneVerified: true,
  },
});
```

**Generated SQL:**
```sql
UPDATE "User"
SET "emailVerified" = true, "phoneVerified" = true, "updatedAt" = NOW()
WHERE "id" = <userId>
RETURNING *;
```

#### Delete
```typescript
await this.prisma.refreshToken.deleteMany({
  where: {
    expiresAt: {
      lt: new Date(),
    },
  },
});
```

**Generated SQL:**
```sql
DELETE FROM "RefreshToken"
WHERE "expiresAt" < NOW();
```

### Advanced Queries

#### Filtering
```typescript
const users = await this.prisma.user.findMany({
  where: {
    emailVerified: true,
    createdAt: {
      gte: new Date('2024-01-01'),
    },
    NOT: {
      isRestricted: true,
    },
  },
});
```

#### Pagination
```typescript
const devices = await this.prisma.device.findMany({
  skip: 20,      // Offset
  take: 10,      // Limit
  orderBy: {
    addedAt: 'desc',
  },
});
```

#### Aggregation
```typescript
const stats = await this.prisma.deviceTelemetry.aggregate({
  where: { deviceId: 'device-123' },
  _avg: {
    temperature: true,
    humidity: true,
  },
  _max: {
    pm25: true,
  },
});
```

#### Transactions
```typescript
const result = await this.prisma.$transaction([
  this.prisma.user.create({ data: userData }),
  this.prisma.refreshToken.create({ data: tokenData }),
]);
```

---

## Our Implementation

### PrismaService (`src/prisma/prisma.service.ts`)

We created a NestJS service that wraps Prisma Client:

```typescript
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async onModuleInit() {
    await this.prisma.$connect();
    // Connection established
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
    // Connection closed
  }

  // Expose models
  get user() {
    return this.prisma.user;
  }

  get refreshToken() {
    return this.prisma.refreshToken;
  }
  // ... other models
}
```

### Why This Approach?

1. **Lifecycle Management**: Connect on startup, disconnect on shutdown
2. **Dependency Injection**: Available throughout the app
3. **Centralized**: Single source of database access
4. **Type-Safe**: Maintains Prisma's type safety

### Using PrismaService

```typescript
@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async createUser(email: string) {
    return this.prisma.user.create({
      data: { email },
    });
  }
}
```

### PrismaModule (`src/prisma/prisma.module.ts`)

```typescript
@Global()  // Available everywhere
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

**Benefits of `@Global()`:**
- No need to import PrismaModule in every feature module
- Prisma accessible across the entire application

---

## Challenges & Solutions

### Challenge 1: Prisma v7 Initialization Error

**Problem:**
```
PrismaClientInitializationError: `PrismaClient` needs to be constructed with a non-empty, valid `PrismaClientOptions`
```

**Root Cause:**
- Prisma v7 introduced breaking changes
- New configuration system with `prisma.config.ts`
- Runtime initialization issues with NestJS

**Solution:**
Downgraded to Prisma v6:
```bash
pnpm add @prisma/client@^6.0.0
pnpm add -D prisma@^6.0.0
```

**Why v6?**
- Stable and battle-tested
- Better NestJS compatibility
- No breaking configuration changes
- Standard `schema.prisma` with `url = env("DATABASE_URL")`

### Challenge 2: PrismaClient Not Extending

**Problem:**
Initially tried:
```typescript
export class PrismaService extends PrismaClient {
  // Errors with v7
}
```

**Solution:**
Composition over inheritance:
```typescript
export class PrismaService {
  private prisma: PrismaClient;
  
  constructor() {
    this.prisma = new PrismaClient();
  }
  
  get user() {
    return this.prisma.user;
  }
}
```

**Benefits:**
- Works with both v6 and v7
- More flexible
- Better separation of concerns
- Easier to test

### Challenge 3: Module Resolution

**Problem:**
TypeScript couldn't find `@prisma/client` types

**Solution:**
1. Ensure `prisma generate` runs after installing
2. Delete `node_modules` and reinstall
3. Restart TypeScript server

### Challenge 4: Environment Variables

**Problem:**
`DATABASE_URL` not being read properly

**Solution:**
1. Install dotenv: `pnpm add dotenv`
2. Load in `main.ts` BEFORE importing modules:
```typescript
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
```

---

## Best Practices

### 1. Always Use Transactions for Related Operations

```typescript
// ✅ Good - Atomic operation
await this.prisma.$transaction([
  this.prisma.user.create({ data: userData }),
  this.prisma.refreshToken.create({ data: tokenData }),
]);

// ❌ Bad - Can fail partially
await this.prisma.user.create({ data: userData });
await this.prisma.refreshToken.create({ data: tokenData });
```

### 2. Use Proper Indexing

```prisma
model RefreshToken {
  token String @unique  // Fast lookups
  
  @@index([userId])     // Fast user token queries
  @@index([expiresAt])  // Fast cleanup queries
}
```

### 3. Select Only Needed Fields

```typescript
// ✅ Good - Only fetches email
const user = await this.prisma.user.findUnique({
  where: { id },
  select: { email: true },
});

// ❌ Bad - Fetches everything
const user = await this.prisma.user.findUnique({
  where: { id },
});
```

### 4. Handle Unique Constraint Violations

```typescript
try {
  await this.prisma.user.create({ data: { email } });
} catch (error) {
  if (error.code === 'P2002') {
    throw new ConflictException('Email already exists');
  }
  throw error;
}
```

**Common Prisma Error Codes:**
- `P2002` - Unique constraint violation
- `P2025` - Record not found
- `P2003` - Foreign key constraint failed

### 5. Use  Soft Deletes for Important Data

```prisma
model User {
  id        String    @id @default(uuid())
  deletedAt DateTime?  // Null = active
}
```

```typescript
// Soft delete
await this.prisma.user.update({
  where: { id },
  data: { deletedAt: new Date() },
});

// Query active users
const activeUsers = await this.prisma.user.findMany({
  where: { deletedAt: null },
});
```

### 6. Batch Operations

```typescript
// ✅ Efficient - Single query
await this.prisma.user.createMany({
  data: [
    { email: 'user1@example.com' },
    { email: 'user2@example.com' },
  ],
});

// ❌ Inefficient - Multiple queries
for (const email of emails) {
  await this.prisma.user.create({ data: { email } });
}
```

---

## Migration Workflow

### Development

```bash
# 1. Update schema.prisma
# 2. Create migration
pnpm prisma migrate dev --name add_user_city

# 3. Migration applied automatically
```

### Production

```bash
# Deploy pending migrations
pnpm prisma migrate deploy
```

### Reset Database (Development Only!)

```bash
pnpm prisma migrate reset
# ⚠️ Deletes all data!
```

---

## Prisma Studio

Visual database browser:

```bash
pnpm prisma studio
```

Opens at `http://localhost:5555`

**Features:**
- View all tables
- Edit records directly
- Filter and search
- Great for debugging

---

## Summary

### What We Built

1. ✅ Type-safe database access with Prisma
2. ✅ Global PrismaService for DI
3. ✅ Comprehensive schema with 10 models
4. ✅ Migration system for version control
5. ✅ Proper indexing and relations

### Why It Works

- **Type Safety**: Errors caught at compile time
- **Performance**: Optimized queries
- **Maintainability**: Clear schema definition
- **Scalability**: Easy to add new models
- **Developer Experience**: Autocomplete and IntelliSense

### Key Takeaways

1. Prisma v6 is more stable for NestJS
2. Composition pattern works better than inheritance
3. Always load environment variables early
4. Use transactions for related operations
5. Index frequently queried fields

---

**Next Steps:**
- Review `docs/auth/` to see how we use Prisma in authentication
- Check `docs/test/auth/` for testing with Prisma
