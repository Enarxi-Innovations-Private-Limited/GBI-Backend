import { Module } from '@nestjs/common';
import { TelemetryGateway } from './telemetry.gateway';
import { RealtimeService } from './realtime.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { WsJwtGuard } from './guards/ws-jwt.guard';

@Module({
  imports: [PrismaModule, JwtModule, ConfigModule],
  providers: [TelemetryGateway, RealtimeService, WsJwtGuard],
  exports: [RealtimeService],
})
export class RealtimeModule {}
