import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SseService } from './sse.service';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class SseController {
  constructor(private readonly sseService: SseService) {}

  @Get('stream')
  streamEvents(@Req() req: any, @Res() reply: any) {
    const userId = req.user?.id;

    // Get the underlying Node.js raw response for SSE streaming
    // Fastify wraps the raw Node.js ServerResponse inside reply.raw
    const raw = reply.raw;

    // SSE Headers — use raw Node.js response API (not Express)
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    // Send an initial comment to confirm the connection is open
    raw.write(':ok\n\n');

    // Add client to service
    this.sseService.addClient(userId, raw);

    // Prevent Fastify from ending the response automatically
    // The connection stays open until the client disconnects
  }
}
