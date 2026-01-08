import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AdminController } from './admin.controller';
import { AdminRepository } from './admin.repository';
import { AdminService } from './admin.service';
import { JwtModule } from '@nestjs/jwt';
import { AdminJwtStrategy } from 'src/auth/strategies/admin-jwt.strategy';

@Module({
  imports: [PrismaModule, AuthModule, JwtModule],
  controllers: [AdminController],
  providers: [AdminService, AdminRepository, AdminJwtStrategy],
})
export class AdminModule {}
