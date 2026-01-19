# Google OAuth Implementation & Technical Guide

## 1. Overview
This module enables Users to sign in using their Google Accounts. It is built using **PassportJS** (`passport-google-oauth20`) on top of the **Fastify** framework used by NestJS.

---

## 2. Usage Guide

### A. Setup Credentials
1.  Go to **Google Cloud Console** > **APIs & Services** > **Credentials**.
2.  Create an **OAuth 2.0 Client ID** (Web Application).
3.  **Authorized Redirect URI**: Must match exactly: `http://localhost:4000/auth/google/callback`
4.  **Copy Credentials** to `.env`:
    ```env
    GOOGLE_CLIENT_ID=your_client_id
    GOOGLE_CLIENT_SECRET=your_client_secret
    GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback
    ```

### B. Testing (Development)
Since the app is not verified by Google yet:
1.  Set the OAuth Consent Screen to **"External"**.
2.  Add your email to the **"Test Users"** list in Google Console.
3.  Visit `http://localhost:4000/auth/google` to trigger the login flow.


---

## 3. Data Mapping & Business Logic

### Organization Extraction
When a user signs in via Google, we attempt to intelligently determine their organization.
*   **Business Rules:**
    1.  **Corporate Accounts (GSuite/Workspace):** If the Google Profile contains an `hd` (Hosted Domain) field (e.g., `enarxi.com`), we map this to the User's `organization` field.
    2.  **Public Accounts (Gmail/Outlook):** We **ignore** the domain for public providers (e.g., `gmail.com`). The `organization` field is left `null`.
*   **Result:** A B2B user (`user@company.com`) is auto-onboarded, while a B2C user (`user@gmail.com`) is prompted to enter their details later.

---

## 4. Architecture & Challenges

Implementing Google OAuth on **Fastify** presented unique challenges compared to the standard Express implementations.

### The Conflict: Fastify vs. Express
*   **The Problem**: The library `passport-google-oauth20` relies on standard Node.js/Express methods like `res.setHeader()`, `res.end()`, and `res.redirect()`.
*   **The Reality**: Fastify uses a different Response object (`reply`) and does not natively support `setHeader` (it uses `.header()`).
*   **Result**: The application was crashing with `TypeError: res.setHeader is not a function`.

### Attempted Solutions & Failures
1.  **Using `@fastify/express`**:
    *   *Idea*: Use a compatibility layer to add Express methods to Fastify.
    *   *Failure*: NestJS's internal adapter (`fastify-middie`) conflicts with `@fastify/express` because both try to decorate the app with a `.use()` method. This caused a boot crash: `FastifyError: The decorator 'use' has already been added!`.

2.  **Global Middleware**:
    *   *Idea*: Create a global middleware to polyfill the missing methods.
    *   *Failure*: While possible, it added complexity and overhead to *every* request, not just auth requests.

### The Final Solution: scoped Guard Polyfill
We implemented a robust, scoped fix directly in the **`GoogleAuthGuard`**.

**How it works (`src/auth/guards/google-auth.guard.ts`):**
Before `passport` is even allowed to run, the `canActivate` method intercepts the request:
1.  It grabs the underlying Fastify response object.
2.  It manually attaches "fake" Express methods that forward calls to Fastify methods:
    ```typescript
    // Polyfill Example
    if (!response.setHeader) {
      response.setHeader = (key, val) => response.header(key, val);
    }
    ```
3.  It then calls `super.canActivate()`, allowing Passport to execute safely.

**Benefits:**
*   **Zero Dependencies**: No need for `@fastify/express`.
*   **Isolated**: The patch only runs for Google Auth routes, keeping the rest of the application pure Fastify.
*   **Maintained**: We control the compatibility logic directly.
