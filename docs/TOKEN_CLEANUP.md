# Refresh Token Cleanup — Implementation Notes

**File:** `src/auth/auth.service.ts`  
**Date:** 28-02-2026

---

## Why This Was Needed

Every time a user logs in, one `RefreshToken` row is created in the database. These rows are never automatically deleted — they just pile up forever as "stale garbage":

- Tokens that naturally expired after 30 days (but never deleted)
- Tokens that were revoked on logout (but the row remained in the DB)

Over months of real usage this causes **table bloat** — thousands of useless rows slowing down queries.

---

## What Was Added — Two Mechanisms (Not Two Cron Jobs)

### Mechanism 1 — Daily Cron Job (Scheduled, Automatic)

**What it is:** A scheduled background job that runs once a day at **2:00 AM** automatically.

**What it does:** Deletes **all** expired refresh tokens across the entire database — for every user.

```typescript
@Cron('0 2 * * *')  // Runs at 2:00 AM every day
async cleanupExpiredTokens(): Promise<number> {
  const result = await this.prisma.refreshToken.deleteMany({
    where: {
      expiresAt: { lt: new Date() },  // Any token whose expiry date has passed
    },
  });
  console.log(`🧹 [TokenPurge] Deleted ${result.count} expired refresh tokens`);
  return result.count;
}
```

**Covers:** Inactive users who haven't logged in for months — their expired tokens get cleaned overnight.

---

### Mechanism 2 — Login-Time Cleanup (Event-Driven, Not a Cron)

**What it is:** NOT a cron job. It runs inside the existing `generateTokens()` function — which is called every time **any user logs in** (email/password login, Google OAuth, OTP verify, complete profile).

**What it does:** Before creating the new refresh token for this user, deletes all their old **expired or revoked** tokens.

```typescript
// Inside generateTokens() — runs on every login
await this.prisma.refreshToken.deleteMany({
  where: {
    userId, // Only this specific user's tokens
    OR: [
      { expiresAt: { lt: new Date() } }, // Expired tokens
      { revokedAt: { not: null } }, // Revoked tokens (old logouts)
    ],
  },
});
// ... then creates the new token
```

**Covers:** Active users who log in regularly — their own stale tokens are cleaned up at each login, so the table stays lean even before the nightly cron runs.

---

## Summary

| Mechanism     | Type                                   | When it runs                | Scope                            |
| ------------- | -------------------------------------- | --------------------------- | -------------------------------- |
| Daily Cron    | Scheduled job (`@Cron`)                | Every day at 2:00 AM        | All users, entire table          |
| Login Cleanup | Event-driven (inside `generateTokens`) | Every time any user logs in | Only that specific user's tokens |

Together they ensure the `RefreshToken` table never grows unboundedly — active users are cleaned at login time, and inactive users are cleaned by the nightly cron.
