import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
} from '@nestjs/common';
import type { ServerResponse } from 'http';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

const REDIS_CHANNEL = 'device-events';
const HEARTBEAT_INTERVAL_MS = 15_000;
const MAX_SSE_CONNECTIONS = 500;

interface SseMessage {
  userId: string;
  data: any;
}

@Injectable()
export class SseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SseService.name);

  /** Map of userId → array of raw Node ServerResponse streams */
  private clients = new Map<string, ServerResponse[]>();

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    @Inject('REDIS_SUBSCRIBER') private readonly subscriber: Redis,
  ) {}

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  onModuleInit() {
    this.startHeartbeat();
    this.subscribeToRedis();
  }

  onModuleDestroy() {
    this.stopHeartbeat();
    this.subscriber.unsubscribe(REDIS_CHANNEL);
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Register a new SSE client (raw Node ServerResponse — use res.raw in Fastify).
   */
  addClient(userId: string, res: ServerResponse) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, []);
    }
    const list = this.clients.get(userId)!;
    list.push(res);

    const total = this.totalConnections();
    this.logger.log(
      `SSE client connected: user=${userId} (connections for user: ${list.length}, total: ${total})`,
    );

    if (total > MAX_SSE_CONNECTIONS) {
      this.logger.warn(
        `⚠️  SSE connection count (${total}) exceeds MAX_SSE_CONNECTIONS (${MAX_SSE_CONNECTIONS})`,
      );
    }
  }

  /**
   * Remove a client connection — called by controller on 'close'.
   */
  removeClient(userId: string, res: ServerResponse) {
    const list = this.clients.get(userId);
    if (!list) return;

    const idx = list.indexOf(res);
    if (idx !== -1) list.splice(idx, 1);

    if (list.length === 0) {
      this.clients.delete(userId);
      this.logger.log(`SSE client fully disconnected: user=${userId}`);
    } else {
      this.logger.log(
        `SSE client tab closed: user=${userId} (remaining: ${list.length})`,
      );
    }

    // Stop heartbeat if no clients at all
    if (this.totalConnections() === 0) {
      this.stopHeartbeat();
    }
  }

  /**
   * Publish an event via Redis so ALL container instances fan it out to their clients.
   * Do NOT write to streams directly here.
   */
  sendEvent(userId: string, data: any) {
    const message: SseMessage = { userId, data };
    this.redis
      .publish(REDIS_CHANNEL, JSON.stringify(message))
      .catch((err) =>
        this.logger.error('SSE Redis publish failed', err?.message),
      );
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Format a Server-Sent Event string.
   * Includes an event name, a unique id, and a JSON data payload.
   */
  private formatSseEvent(eventName: string, payload: any, id?: string): string {
    const lines: string[] = [];
    lines.push(`id: ${id ?? randomUUID()}`);
    lines.push(`event: ${eventName}`);
    lines.push(`data: ${JSON.stringify(payload)}`);
    lines.push(''); // blank line = end of event
    return lines.join('\n') + '\n';
  }

  /**
   * Write to all SSE clients connected to THIS container for a given userId.
   * Applies writability guard before every write.
   */
  private sendToLocalClients(userId: string, data: any) {
    const list = this.clients.get(userId);
    if (!list || list.length === 0) return;

    const payload = this.formatSseEvent('notification', data);

    for (const res of list) {
      if (!res.writableEnded) {
        res.write(payload);
      }
    }
  }

  /**
   * Subscribe this instance to the Redis Pub/Sub channel.
   * When a message arrives, fan it out to local SSE clients.
   * Attaches to the 'ready' event to guarantee re-subscription on reconnect.
   */
  private subscribeToRedis() {
    this.subscriber.on('ready', () => {
      this.subscriber.subscribe(REDIS_CHANNEL, (err) => {
        if (err) {
          this.logger.error('Redis SSE subscribe failed', err.message);
          return;
        }
        this.logger.log(`Subscribed to Redis channel: ${REDIS_CHANNEL}`);
      });
    });

    this.subscriber.on('message', (channel, message) => {
      if (channel !== REDIS_CHANNEL) return;
      try {
        const { userId, data } = JSON.parse(message) as SseMessage;
        this.sendToLocalClients(userId, data);
      } catch (e) {
        this.logger.error('Failed to parse SSE Redis message', e?.message);
      }
    });
  }

  /**
   * Send a comment heartbeat (`: heartbeat`) to all connected clients
   * to prevent proxy/load-balancer idle timeouts.
   */
  private startHeartbeat() {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      if (this.totalConnections() === 0) return;
      for (const list of this.clients.values()) {
        for (const res of list) {
          if (!res.writableEnded) {
            res.write(': heartbeat\n\n');
          }
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private totalConnections(): number {
    let count = 0;
    for (const list of this.clients.values()) count += list.length;
    return count;
  }
}
