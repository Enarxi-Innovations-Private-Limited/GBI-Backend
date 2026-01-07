# GBI Backend Documentation

Welcome to the comprehensive documentation for the GBI Air Quality Monitor Dashboard Backend.

## 📚 Documentation Structure

```
docs/
├── README.md (this file)          # Overview and navigation
├── prisma/
│   └── README.md                  # Database & ORM documentation
├── auth/
│   └── README.md                  # Authentication implementation
└── test/
    └── auth/
        └── README.md              # Authentication testing guide
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 24.12.0
- PostgreSQL 16
- pnpm 10.27.0

### Setup
```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET

# 3. Run database migrations
pnpm prisma migrate dev

# 4. Start development server
pnpm run start:dev
```

Server runs on: `http://localhost:4000`

---

## 📖 Documentation Guide

### 1. **Prisma Documentation**
📁 [`docs/prisma/README.md`](prisma/README.md)

**Learn about:**
- What is Prisma and why we use it
- How Prisma works with PostgreSQL
- Database schema design
- Prisma Client API
- Our PrismaService implementation
- Challenges we faced (Prisma v7 → v6 migration)
- Best practices for queries
- Migration workflow

**Key Topics:**
- Schema models and relations
- Type-safe database access
- Query examples (create, read, update, delete)
- Transactions
- Indexing strategies
- Performance optimization

**Read this if you want to understand:**
- How data is stored
- How to query the database
- Why we use composition over inheritance
- How to create new models

---

### 2. **Authentication Documentation**
📁 [`docs/auth/README.md`](auth/README.md)

**Learn about:**
- Authentication architecture
- Email/Password login implementation
- Google OAuth 2.0 integration
- JWT Access Tokens
- Refresh Token rotation
- Mock OTP system
- Security features

**Key Topics:**
- Complete authentication flows (signup, login, refresh, logout)
- Folder structure (`dto/`, `guards/`, `strategies/`, `decorators/`)
- DTOs for input validation
- Passport.js strategies (JWT, Google)
- Guards for route protection
- Token management
- Password hashing with bcrypt

**Read this if you want to understand:**
- How users authenticate
- How tokens work
- How protected routes function
- How to add new authentication methods
- Security measures in place

---

### 3. **Authentication Testing Guide**
📁 [`docs/test/auth/README.md`](test/auth/README.md)

**Learn about:**
- Testing authentication endpoints
- Using cURL, Postman, REST Client
- Automated testing with Jest
- Common test scenarios
- Troubleshooting tips

**Key Topics:**
- Step-by-step API testing
- Expected requests and responses
- Error handling examples
- Token expiration testing
- Unit and E2E test examples
- Testing checklist

**Read this if you want to:**
- Test the authentication system
- Understand API request/response formats
- Write automated tests
- Debug authentication issues
- Verify your implementation

---

## 🏗️ Project Architecture

### Tech Stack

**Framework:**
- NestJS 11.0.1
- Fastify (HTTP server)
- TypeScript 5.7.3

**Database:**
- PostgreSQL (via Prisma v6.19.1)
- Prisma ORM for type-safe queries

**Authentication:**
- JWT tokens (@nestjs/jwt)
- Passport.js (passport-jwt, passport-google-oauth20)
- bcrypt for password hashing

**Real-time:**
- WebSockets (@nestjs/websockets)
- MQTT (for device data)

**Background Jobs:**
- BullMQ with Redis

**Validation:**
- class-validator
- class-transformer

**Notifications:**
- Mock providers (dev)
- AWS SES/SNS ready (production)

### Application Structure

```
src/
├── main.ts                    # Application entry point
├── app.module.ts              # Root module
│
├── prisma/                    # Database service
│   ├── prisma.service.ts     # Prisma Client wrapper
│   └── prisma.module.ts      # Global database module
│
├── auth/                      # Authentication
│   ├── dto/                  # Input validation
│   ├── guards/               # Route protection
│   ├── strategies/           # Passport strategies
│   ├── decorators/           # Custom decorators
│   ├── auth.controller.ts   # HTTP endpoints
│   ├── auth.service.ts      # Business logic
│   └── auth.module.ts       # Module configuration
│
├── notifications/             # Email & SMS
│   ├── interfaces/           # Provider contracts
│   ├── providers/            # Mock & AWS implementations
│   ├── notification.service.ts  # Facade service
│   └── notifications.module.ts  # Module configuration
│
└── (future modules)
    ├── admin/                # Admin functionality
    ├── devices/              # Device management
    ├── telemetry/            # Sensor data
    ├── alerts/               # Alert system
    └── reports/              # Report generation
```

### Database Schema

**Core Models:**
- `User` - User accounts
- `Admin` - Admin accounts
- `RefreshToken` - Session tokens
- `Device` - IoT devices
- `DeviceAssignment` - User-device mapping
- `UserDevice` - Custom device metadata
- `DeviceTelemetry` - Time-series sensor data
- `AlertThreshold` - User alert preferences
- `EventLog` - System events
- `Notification` - User notifications

**Relations:**
- User ↔ RefreshToken (1:many)
- User ↔ DeviceAssignment (1:many)
- Device ↔ DeviceAssignment (1:many)
- Device ↔ DeviceTelemetry (1:many)
- User ↔ AlertThreshold (1:many)
- User ↔ Notification (1:many)

---

## 🔐 Security

### Implemented Security Features

1. **Password Security**
   - bcrypt hashing (12 salt rounds)
   - Minimum 8 characters
   - Constant-time comparison

2. **Token Security**
   - Short-lived access tokens (15 min)
   - Long-lived refresh tokens (30 days)
   - Token rotation on refresh
   - Database-backed refresh tokens (can be revoked)

3. **Input Validation**
   - DTOs with class-validator
   - Email format validation
   - Type checking
   - Sanitization

4. **SQL Injection Protection**
   - Prisma ORM with parameterized queries
   - No raw SQL with user input

5. **Account Management**
   - Account restriction support
   - Email verification (mock/AWS SES)
   - Phone verification (mock/AWS SNS)

6. **HTTP Security**
   - CORS configuration
   - Helmet.js (TODO)
   - Rate limiting (TODO)

---

## 🔄 Authentication Flow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       │ 1. POST /auth/signup or /auth/login
       ▼
┌─────────────────────────┐
│  AuthController         │
│  - Validates DTO        │
└──────┬──────────────────┘
       │
       │ 2. Service call
       ▼
┌─────────────────────────┐
│  AuthService            │
│  - Hash password        │
│  - Check database       │
│  - Generate tokens      │
└──────┬──────────────────┘
       │
       │ 3. Database query
       ▼
┌─────────────────────────┐
│  PrismaService          │
│  - Type-safe queries    │
└──────┬──────────────────┘
       │
       │ 4. SQL executed
       ▼
┌─────────────────────────┐
│  PostgreSQL             │
│  - Store data           │
└──────┬──────────────────┘
       │
       │ 5. Return tokens
       ▼
┌─────────────┐
│   Client    │
│  - Store    │
│  - Use      │
└─────────────┘
```

---

## 🧪 Testing

### Manual Testing

**cURL Example:**
```bash
curl -X POST http://localhost:4000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123456"}'
```

**See:** [`docs/test/auth/README.md`](test/auth/README.md) for complete guide

### Automated Testing

**Unit Tests:**
```bash
pnpm test
```

**E2E Tests:**
```bash
pnpm test:e2e
```

**Test Coverage:**
```bash
pnpm test:cov
```

---

## 🛠️ Development

### Available Scripts

```bash
# Development
pnpm run start:dev          # Start with hot reload
pnpm run start:debug        # Start with debugger

# Build
pnpm run build              # Compile TypeScript

# Production
pnpm run start:prod         # Run production build

# Database
pnpm prisma generate        # Generate Prisma Client
pnpm prisma migrate dev     # Create & apply migration
pnpm prisma studio          # Open database GUI

# Code Quality
pnpm run lint               # Run ESLint
pnpm run format             # Format with Prettier

# Testing
pnpm test                   # Run unit tests
pnpm test:watch             # Watch mode
pnpm test:cov               # With coverage
pnpm test:e2e               # E2E tests
```

### Environment Variables

Required in `.env`:

```bash
# Application
PORT=4000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/gbi_dashboard"

# JWT
JWT_SECRET="your-secret-minimum-32-characters"
JWT_EXPIRES_IN="15m"

# Refresh Token
REFRESH_TOKEN_EXPIRES_IN=30

# Google OAuth (optional)
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:4000/auth/google/callback"

# AWS (for production)
# AWS_REGION="us-east-1"
# AWS_ACCESS_KEY_ID="your-key"
# AWS_SECRET_ACCESS_KEY="your-secret"
# AWS_SES_FROM_EMAIL="noreply@yourdomain.com"
```

---

## 📋 API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/signup` | Create new user | No |
| POST | `/auth/login` | Login user | No |
| GET | `/auth/google` | Start Google OAuth | No |
| GET | `/auth/google/callback` | OAuth callback | No |
| POST | `/auth/refresh` | Refresh access token | No |
| POST | `/auth/logout` | Revoke refresh token | No |
| GET | `/auth/me` | Get current user | Yes (JWT) |

**Full API Documentation:** [`docs/test/auth/README.md`](test/auth/README.md)

---

## 🐛 Troubleshooting

### Common Issues

**1. Prisma Client Not Found**
```bash
pnpm prisma generate
```

**2. Database Connection Error**
- Check `DATABASE_URL` in `.env`
- Verify PostgreSQL is running
- Test connection with `pnpm prisma studio`

**3. JWT Errors**
- Verify `JWT_SECRET` is set
- Check token format: `Bearer <token>`
- Decode token at https://jwt.io

**4. Module Not Found**
```bash
rm -rf node_modules dist
pnpm install
pnpm run build
```

**5. Migration Issues**
```bash
# Development only!
pnpm prisma migrate reset
pnpm prisma migrate dev
```

---

## 📚 Additional Resources

### Official Documentation
- [NestJS Docs](https://docs.nestjs.com/)
- [Prisma Docs](https://www.prisma.io/docs/)
- [Passport.js Docs](http://www.passportjs.org/)
- [Fastify Docs](https://www.fastify.io/)

### Related Files
- `README.md` - Project overview
- `SETUP_GUIDE.md` - Initial setup
- `docs/AUTH_API.md` - Authentication API reference
- `docs/MOCK_NOTIFICATIONS.md` - Notification system

---

## 🗺️ Roadmap

### ✅ Phase 1: Authentication (Complete)
- [x] Email/Password auth
- [x] Google OAuth
- [x] JWT tokens
- [x] Refresh token rotation
- [x] Mock OTP system

### 🔄 Phase 2: Admin Portal (TODO)
- [ ] Admin login (hardcoded credentials)
- [ ] Device registration
- [ ] User management
- [ ] Device assignment

### 📅 Phase 3: User Portal (TODO)
- [ ] Device claiming
- [ ] Device management
- [ ] Profile management
- [ ] Alert thresholds

### 📊 Phase 4: Telemetry (TODO)
- [ ] MQTT integration
- [ ] Real-time data ingestion
- [ ] WebSocket broadcasting
- [ ] Data storage

### 🔔 Phase 5: Alerts & Notifications (TODO)
- [ ] Alert processing (BullMQ)
- [ ] Email notifications
- [ ] SMS notifications
- [ ] Event logging

### 📈 Phase 6: Analytics (TODO)
- [ ] Graph data APIs
- [ ] Device comparison
- [ ] Report generation
- [ ] CSV/Excel export

---

## 🤝 Contributing

### Code Style
- Follow NestJS conventions
- Use TypeScript strict mode
- Add JSDoc comments for public APIs
- Write tests for new features

### Git Workflow
```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes and commit
git add .
git commit -m "feat: add your feature"

# Push and create PR
git push origin feature/your-feature
```

### Commit Message Format
```
<type>: <description>

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- refactor: Code refactoring
- test: Tests
- chore: Maintenance
```

---

## 📞 Support

### Documentation
1. Check this documentation
2. Review code comments
3. See official framework docs

### Debugging
1. Check server logs
2. Use Prisma Studio for database
3. Decode JWTs at https://jwt.io
4. Test with Postman/cURL

---

## 📝 Summary

### What's Implemented
- ✅ Complete authentication system
- ✅ Email/Password + Google OAuth
- ✅ JWT + Refresh tokens with rotation
- ✅ Prisma v6 with PostgreSQL
- ✅ Mock notification system (AWS-ready)
- ✅ Type-safe with TypeScript
- ✅ Input validation with DTOs
- ✅ Comprehensive documentation

### Key Features
- Type-safe database access
- Secure authentication
- Token rotation
- Account restriction
- Mock → AWS migration path
- Production-ready architecture

### Next Steps
1. Read the documentation sections
2. Test the authentication API
3. Understand the architecture
4. Start building new features

---

**Happy coding!** 🚀

For specific topics:
- **Database:** See [`docs/prisma/README.md`](prisma/README.md)
- **Authentication:** See [`docs/auth/README.md`](auth/README.md)
- **Testing:** See [`docs/test/auth/README.md`](test/auth/README.md)
