# GBI Backend - Setup Guide

##  🚀 **Authentication System Implementation Complete!**

I've successfully implemented a complete authentication system with:
- ✅ Email/Password signup and login
- ✅ Google OAuth 2.0
- ✅ JWT access tokens (short-lived)
- ✅ Refresh tokens with rotation (long-lived)
- ✅ Secure session management
- ✅ Account restriction support

---

## 📋 **Next Steps to Run the Application**

### 1. **Configure Environment Variables**

The application needs a `.env` file with the database connection and other configuration.

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Then edit `.env` and update the `DATABASE_URL`:

```bash
DATABASE_URL="postgresql://username:password@localhost:5432/gbi_dashboard?schema=public"
```

**Replace**:
- `username` - Your PostgreSQL username
- `password` - Your PostgreSQL password
- `localhost` - Your database host (localhost if running locally)
- `5432` - PostgreSQL port
- `gbi_dashboard` - Database name

### 2. **Set JWT Secret**

In `.env`, update the JWT secret (use a strong random string in production):

```bash
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
```

### 3. **Configure Google OAuth (Optional)**

If you want to use Google OAuth, set these in `.env`:

```bash
GOOGLE_CLIENT_ID=your-google-client-id-from-console.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

To get Google OAuth credentials:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/auth/google/callback`

### 4. **Run Database Migrations**

Ensure your PostgreSQL database is running, then:

```bash
pnpm prisma migrate dev
```

This will create all necessary tables.

### 5. **Start the Development Server**

```bash
pnpm run start:dev
```

The server will start on `http://localhost:3000`

---

## 🧪 **Testing the Authentication API**

### Test Signup
```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

### Test Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Test Protected Route
```bash
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization Bearer <your-access-token-from-login>"
```

---

## 📚 **API Documentation**

Detailed API documentation is available in:
- `/docs/AUTH_API.md` - Complete authentication API reference

---

## 🏗️ **Project Structure**

```
src/
├── auth/                   # Authentication module
│   ├── dto/               # Data transfer objects
│   ├── guards/            # JWT and Google auth guards
│   ├── strategies/        # Passport strategies
│   ├── decorators/        # Custom decorators (@CurrentUser)
│   ├── auth.controller.ts # Auth endpoints
│   ├── auth.service.ts    # Auth business logic
│   └── auth.module.ts     # Module configuration
├── prisma/                 # Prisma service
│   ├── prisma.service.ts
│   └── prisma.module.ts
└── main.ts                 # Application entry point

prisma/
├── schema.prisma          # Database schema
└── migrations/            # Database migrations
```

---

## 🔒 **Security Features**

1. **Password Hashing**: bcrypt with 12 salt rounds
2. **Token Rotation**: Refresh tokens are rotated on each use
3. **Session Management**: Refresh tokens stored in database, can be revoked
4. **Account Restriction**: Admin can restrict user accounts
5. **Input Validation**: All inputs validated using class-validator
6. **SQL Injection Protection**: Prisma ORM with parameterized queries

---

## ⚠️ **Current Error**

The application is currently failing to start because:
- **DATABASE_URL is not set** or **PostgreSQL is not running**

Please ensure:
1. PostgreSQL is installed and running
2. You've created a database named `gbi_dashboard` (or your chosen name)
3. `.env` file has the correct `DATABASE_URL`

---

## 📊 **Database Schema**

The following tables are created:
- `User` - User accounts
- `RefreshToken` - Session tokens
- `Admin` - Admin accounts  
- `Device` - Air quality monitoring devices
- `DeviceAssignment` - User-device assignments
- `DeviceTelemetry` - Sensor data
- `AlertThreshold` - User-defined alert limits
- `EventLog` - System event logs
- `Notification` - User notifications

---

## 🎯 **What's Next?**

After fixing the DATABASE_URL and starting the server successfully:

1. **Email OTP Verification** - Implement SendGrid integration
2. **Mobile OTP Verification** - Implement SMS service
3. **Admin Module** - Separate admin authentication
4. **Device Management APIs** - Device claiming, management
5. **Telemetry Module** - MQTT integration for device data
6. **WebSocket Gateway** - Real-time data streaming
7. **Alerts & Notifications** - Background jobs with BullMQ
8. **Analytics & Reports** - Graph data and CSV generation

---

## 💡 **Troubleshooting**

### Error: Cannot connect to database
- Check if PostgreSQL is running
- Verify DATABASE_URL in .env
- Ensure database exists

### Error: Prisma Client validation error
- Run `pnpm prisma generate`
- Run `pnpm prisma migrate dev`

### Error: JWT error
- Ensure JWT_SECRET is set in .env
- JWT_SECRET should be at least 32 characters

---

## 📖 **Additional Resources**

- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Passport.js Documentation](http://www.passportjs.org/)

---

**Need help?** Check the detailed API documentation in `/docs/AUTH_API.md`
