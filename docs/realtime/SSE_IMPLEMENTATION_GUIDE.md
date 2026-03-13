# Server-Sent Events (SSE) Implementation Guide

## Overview

The GBI Air Quality Monitor uses Server-Sent Events (SSE) to push low-latency, real-time notifications to connected clients. This guide covers the architectural decisions, the specific challenges encountered with NestJS/Fastify, and the resilient frontend integration strategy.

---

## 1. Backend Implementation & Challenges

The real-time notification system is built on **NestJS** using the **Fastify** adapter and **Redis Pub/Sub** for multi-instance scalability.

### The Problem: Fastify CORS and Raw Streams

To maintain an open, chunked HTTP connection in Fastify, we must bypass the standard response lifecycle and write directly to the underlying Node.js `ServerResponse` stream (accessible via `reply.raw`).

However, this created a significant issue with **Cross-Origin Resource Sharing (CORS)**:

- Fastify applies CORS headers using a pre-handler hook that sets headers on the abstracted `reply` object.
- Because we hooked into the raw `ServerResponse` stream via `reply.raw.writeHead(...)`, the headers queued on the Fastify `reply` object were never automatically flushed to the client.
- This resulted in CORS policy blocking errors in the browser when attempting to establish the SSE connection: `No 'Access-Control-Allow-Origin' header is present on the requested resource.`

### The Solution: Explicit Header Synchronization

We solved this by explicitly syncing the CORS headers from Fastify to the raw Node response before flushing the stream:

1. **Header Copying:** We iterate through `reply.getHeaders()` and manually apply them to `reply.raw`.
2. **Dynamic Fallbacks:** If the Fastify CORS plugin hasn't populated the headers in time, we inject a fallback mechanism that reads the `Origin` from the incoming request and explicitly sets `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials`.

```typescript
// Explicitly copy Fastify headers to the raw response
const headers = reply.getHeaders();
for (const [key, value] of Object.entries(headers)) {
  if (value !== undefined) reply.raw.setHeader(key, value);
}

// Fallback for CORS if the Fastify plugin didn't attach them yet
if (!reply.raw.hasHeader('access-control-allow-origin')) {
  const origin = req.headers.origin;
  if (origin) {
    reply.raw.setHeader('Access-Control-Allow-Origin', origin);
    reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
  }
}

// Flush establishing SSE headers
reply.raw.writeHead(200, {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no', // Disable proxy buffering (e.g., Nginx)
});
```

---

## 2. Frontend Integration Strategy

The frontend connects to the SSE stream using a custom React hook (`useSSE`) built on the native `fetch` API rather than `EventSource`.

### Why `fetch` instead of `EventSource`?

Standard `EventSource` does not support custom headers (like `Authorization: Bearer <token>`). While `withCredentials: true` works for cookies, `fetch` provides granular control over the data stream, abort controllers, and custom reconnect handling logic.

### Key Frontend Architectural Decisions:

#### A. Bypassing Next.js Proxy Buffering

The Next.js `/api` rewrite mechanisms inherently buffer response bodies. This breaks SSE streams, which rely on receiving real-time chunks over a single prolonged request.
**Solution:** The frontend hook connects directly to the absolute backend URL (`process.env.NEXT_PUBLIC_API_URL` or `http://localhost:4000/events/stream`), entirely bypassing the Next.js API route proxy.

#### B. Stream Parsing Strategy

The hook reads from `response.body.getReader()` utilizing a `TextDecoder` to parse the incoming byte stream into text. It buffers incomplete chunks and splits complete events by the standard double-newline (`\n\n`) delimiter.

#### C. Heartbeats

To prevent reverse proxies or load balancers from closing the active connection due to inactivity, the backend emits periodic ping/heartbeat lines starting with a colon (`:`). The frontend explicitly ignores these empty comment lines while passively benefiting from the connection timeout reset logic.

#### D. Connection Resilience & Backoff

If the connection drops, gets aborted, or the server restarts, the frontend employs an **Exponential Backoff Reconnect Strategy** to prevent overwhelming the server during outages:

- Reconnection delay interval progression: `1s → 2s → 5s → 10s → 30s` (cap)
- The retry counter accurately resets down to 0 upon the very first successful delivery of a `data:` payload from the stream.

### Example: Consuming the `useSSE` Hook

```javascript
import { useSSE } from '@/hooks/useSSE';

export default function NotificationListener() {
  const { isAuthenticated } = useAuth();

  useSSE((event) => {
    if (event.type === 'NOTIFICATION') {
      console.log('New notification received:', event.data.message);
      // Example: Update global context, trigger toast, unread badge etc.
    }
  }, isAuthenticated); // Only connect when the user is fully logged in

  return null;
}
```

---

## Summary

By carefully bridging Fastify's CORS abstraction with the raw Node.js Response stream, and bypassing Next.js buffering in favor of a robust React `fetch`-based resilient consumer, the real-time notification infrastructure guarantees high availability, security, and low latency updates across the entire application ecosystem.
