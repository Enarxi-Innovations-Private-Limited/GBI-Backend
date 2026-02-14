import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SseService } from './sse.service';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class SseController {
  constructor(private readonly sseService: SseService) {}

  @Get('stream')
  streamEvents(@Req() req, @Res() res: Response) {
    const userId = req.user.id; // Assumes JwtAuthGuard populates req.user

    // SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Add client to service
    this.sseService.addClient(userId, res);

    // Keep connection open (NestJS/Express default behavior with res object)
  }
}
