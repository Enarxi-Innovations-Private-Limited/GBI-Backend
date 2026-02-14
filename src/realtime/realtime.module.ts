import { Module, Global } from '@nestjs/common';
import { TelemetryGateway } from './telemetry.gateway';
import { RealtimeService } from './realtime.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { SseService } from './sse.service';
import { SseController } from './sse.controller';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [PrismaModule, JwtModule, ConfigModule, AuthModule],
  providers: [TelemetryGateway, RealtimeService, SseService],
  controllers: [SseController],
  exports: [RealtimeService, SseService],
})
export class RealtimeModule {}
