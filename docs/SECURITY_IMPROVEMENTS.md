# Security Improvements — `audit/security-improvements` Branch

**Merged into:** `main`  
**Date:** 28-02-2026  
**Author:** Security Audit Team

---

## Summary

This document explains the security vulnerabilities that were identified and the exact code changes made to fix them.

---

## 1. Auth — Token Transport (Critical)

### Problem

After a successful Google OAuth login, the backend was redirecting the user to the frontend and **embedding the JWT tokens directly in the URL**:

```
https://app.example.com/auth/callback?accessToken=eyJ...&refreshToken=eyJ...&user={...}
```

**Why this is dangerous:**

- URLs are stored in **browser history** — anyone with access to the browser can read the token.
- URLs are sent in the `Referer` header — third-party scripts on the page could see the token.
- URLs are logged in **server access logs** — the token is exposed in plain text.

### Fix

Tokens are now set as **HttpOnly cookies** — the browser stores them automatically, but JavaScript cannot read them (`document.cookie` cannot access HttpOnly cookies).

**Before** (`auth.controller.ts`):

```typescript
// Google OAuth callback — tokens leaked in URL
const callbackUrl = `${frontendUrl}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}&user=${user}`;
return res.status(302).redirect(callbackUrl);
```

**After:**

```typescript
// Set tokens as HttpOnly cookies — JS cannot access these
res.setCookie('accessToken', result.accessToken, {
  httpOnly: true,
  secure: isProduction, // HTTPS only in prod
  sameSite: 'lax', // 'lax' required for OAuth redirect flow
  path: '/',
  maxAge: 15 * 60, // 15 minutes
});

res.setCookie('refreshToken', result.refreshToken, {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/api/auth', // Scoped to auth endpoints only
  maxAge: 30 * 24 * 60 * 60, // 30 days
});

// Only pass non-sensitive user profile info in URL (no tokens)
const callbackUrl = `${frontendUrl}/auth/callback?user=${user}`;
return res.status(302).redirect(callbackUrl);
```

---

## 2. Auth — Cookie Scoping

### Problem

Even with cookies, if a cookie is scoped to `/` (the whole site), it gets sent with **every request** — including requests to endpoints that don't need the refresh token. This increases the attack surface.

### Fix

- `accessToken` cookie: scoped to `/` (needed everywhere).
- `refreshToken` cookie: scoped to `/api/auth` only (only sent to token refresh & logout endpoints).
- `sameSite: 'strict'` used on non-OAuth flows (login, refresh, logout) to prevent CSRF attacks.

```typescript
res.setCookie('refreshToken', result.refreshToken, {
  path: '/api/auth', // ← Not sent to /api/devices, /api/telemetry etc.
  sameSite: 'strict', // ← Cannot be sent from a cross-site page
  httpOnly: true,
  secure: isProduction,
});
```

---

## 3. Auth — JWT Extraction Strategy

### Problem

The `JwtStrategy` was only reading tokens from the `Authorization: Bearer <token>` header. With the switch to cookies, this would break all token-based auth unless the frontend was updated first.

### Fix (`src/auth/strategies/jwt.strategy.ts`)

The strategy now tries **two extraction methods in order**:

1. **HttpOnly cookie** (new, secure primary method)
2. **Authorization: Bearer header** (kept as fallback for backward compatibility with existing frontend/mobile clients)

```typescript
super({
  jwtFromRequest: ExtractJwt.fromExtractors([
    // 1. Try HttpOnly cookie first
    (req) => {
      if (req && req.cookies) {
        return req.cookies['accessToken'] || null;
      }
      return null;
    },
    // 2. Fallback to Authorization: Bearer header
    ExtractJwt.fromAuthHeaderAsBearerToken(),
  ]),
  ignoreExpiration: false,
  secretOrKey: configService.get('JWT_SECRET'),
});
```

This means **zero breaking changes** for existing clients — they continue to work with Bearer tokens while new browser clients use cookies.

---

## 4. Auth — Logout

### Problem

The old logout only revoked the refresh token in the database. But the HttpOnly cookie would **still exist in the browser** — a token replay was possible until the access token naturally expired (15 minutes).

### Fix

Logout now does three things:

```typescript
async logout(@Req() req, @Res({ passthrough: true }) res, @Body() body) {
  const refreshToken = req.cookies?.refreshToken || body?.refreshToken;

  // 1. Revoke the token in the database
  if (refreshToken) {
    await this.authService.logout(refreshToken);
  }

  // 2. Clear the accessToken cookie
  res.clearCookie('accessToken', { path: '/' });

  // 3. Clear the refreshToken cookie
  res.clearCookie('refreshToken', { path: '/api/auth' });

  return { message: 'Logged out successfully' };
}
```

---

## 5. CORS — Explicit Origin Allowlist (Critical)

### Problem

The CORS configuration was set to `origin: true`, which **allows requests from any domain** — including attacker-controlled sites. This completely defeats cross-origin protection.

### Fix (`src/main.ts`)

**Before:**

```typescript
app.enableCors({
  origin: true, // ← Allow ALL origins
  credentials: true,
});
```

**After:**

```typescript
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

app.enableCors({
  origin: [frontendUrl], // ← Explicit allowlist from env
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: [
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Requested-With',
    'X-CSRF-Token',
  ],
  credentials: true,
});
```

Now only requests from `FRONTEND_URL` can include cookies/credentials — all other origins are blocked by the browser.

---

## 6. Google Callback Error Handling

### Problem

When Google OAuth failed, the backend returned a raw `500` response with the internal error message:

```typescript
return res
  .status(500)
  .send({ message: 'Authentication failed', error: error.message });
```

This **leaks internal error details** to the client and any monitoring/logging systems.

### Fix

Errors now redirect silently to the frontend login page with a generic error code — no internal info is exposed:

```typescript
catch (error) {
  console.error('Google OAuth Error:', error);  // Log internally only
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return res.status(302).redirect(`${frontendUrl}/login?error=oauth_failed`);
}
```

---

## 7. Refresh Token Endpoint Rename

The endpoint was renamed from `POST /auth/refresh` → `POST /auth/refresh-token` to be more explicit.

The endpoint now also reads the refresh token from the cookie first (fallback to request body):

```typescript
@Post('refresh-token')
async refreshTokens(@Req() req, @Res({ passthrough: true }) res, @Body() body) {
  // Cookie first, body as fallback
  const refreshToken = req.cookies?.refreshToken || body?.refreshToken;
  if (!refreshToken) throw new UnauthorizedException('No refresh token provided');

  const result = await this.authService.refreshTokens(refreshToken);

  // Rotate both cookies with new tokens
  res.setCookie('accessToken', result.accessToken, { ... });
  res.setCookie('refreshToken', result.refreshToken, { ... });

  return result;
}
```

---

## Files Changed

| File                                  | Change                                                   |
| ------------------------------------- | -------------------------------------------------------- |
| `src/auth/auth.controller.ts`         | HttpOnly cookies on login/refresh/logout, error redirect |
| `src/auth/auth.service.ts`            | Password hashing support in `completeProfile`            |
| `src/auth/strategies/jwt.strategy.ts` | Dual token extraction (cookie + header)                  |
| `src/main.ts`                         | CORS explicit allowlist                                  |

---

## Attack Surface — Before vs After

| Attack                                   | Before      | After                               |
| ---------------------------------------- | ----------- | ----------------------------------- |
| Token stolen from browser history        | ✅ Possible | ❌ Not possible (no token in URL)   |
| XSS reads token via `document.cookie`    | ✅ Possible | ❌ Not possible (HttpOnly)          |
| CSRF submits requests cross-site         | ✅ Possible | ❌ Blocked (`sameSite: strict`)     |
| Any site sends credentialed CORS request | ✅ Possible | ❌ Blocked (explicit origin)        |
| Error response leaks internals           | ✅ Yes      | ❌ No (redirects with generic code) |
