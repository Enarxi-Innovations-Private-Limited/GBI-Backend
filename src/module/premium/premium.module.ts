import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PremiumController } from './premium.controller';
import { PremiumService } from './premium.service';
import { PremiumRepository } from './premium.repository';

@Module({
  imports: [PrismaModule],
  controllers: [PremiumController],
  providers: [PremiumService, PremiumRepository],
  exports: [PremiumService, PremiumRepository],
})
export class PremiumModule {}
