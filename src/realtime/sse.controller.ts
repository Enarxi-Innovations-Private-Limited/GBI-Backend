import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SseService } from './sse.service';

/**
 * SSE Controller — streams real-time notifications to authenticated users.
 *
 * IMPORTANT (Fastify): We use req.raw / reply.raw (the underlying Node.js
 * IncomingMessage / ServerResponse). Fastify will finalize the reply
 * automatically if we use the Fastify reply object directly.
 */
@Controller('events')
@UseGuards(JwtAuthGuard)
@SkipThrottle()
export class SseController {
  constructor(private readonly sseService: SseService) {}

  @Get('stream')
  streamEvents(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const userId = (req as any).user?.id as string;
    const raw = reply.raw; // Node.js ServerResponse

    // ── Copy Fastify CORS headers to raw response ─────────────────────────
    const corsHeaders = [
      'access-control-allow-origin',
      'access-control-allow-credentials',
      'access-control-allow-headers',
      'access-control-expose-headers',
      'vary',
    ];
    for (const header of corsHeaders) {
      const val = reply.getHeader(header);
      if (val) {
        raw.setHeader(header, val);
      }
    }

    // Fallback if Fastify CORS plugin hasn't attached headers yet
    if (!raw.getHeader('access-control-allow-origin') && req.headers.origin) {
      raw.setHeader('Access-Control-Allow-Origin', req.headers.origin);
      raw.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // ── SSE Headers ───────────────────────────────────────────────────────
    raw.setHeader('Content-Type', 'text/event-stream');
    raw.setHeader('Cache-Control', 'no-cache, no-transform');
    raw.setHeader('Connection', 'keep-alive');
    raw.setHeader('X-Accel-Buffering', 'no'); // disable NGINX / Next.js buffering

    // Flush headers immediately so the browser opens the stream
    raw.flushHeaders();

    // Enable TCP keepalive to prevent OS-level connection drops
    (req.raw.socket as any)?.setKeepAlive?.(true);

    // Tell the browser how long to wait before reconnecting (ms)
    raw.write('retry: 5000\n\n');

    // ── Register client ───────────────────────────────────────────────────
    this.sseService.addClient(userId, raw);

    // ── Cleanup on disconnect ─────────────────────────────────────────────
    req.raw.on('close', () => {
      this.sseService.removeClient(userId, raw);
    });

    // Keep the connection open — do not call reply.send() or res.end()
  }
}
