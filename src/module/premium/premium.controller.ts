import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { PremiumService } from './premium.service';
import { ActivatePremiumDto } from './dto/activate-premium.dto';
import { RenewPremiumDto } from './dto/renew-premium.dto';
import { RevokePremiumDto } from './dto/revoke-premium.dto';
import { AdminGuard } from 'src/auth/guards/admin.guard';

@Controller('admin/premium')
@UseGuards(AdminGuard)
export class PremiumController {
  constructor(private readonly premiumService: PremiumService) {}

  @Get('users')
  getDashboard() {
    return this.premiumService.getDashboard();
  }

  @Post('activate')
  activatePremium(
    @Body() dto: ActivatePremiumDto,
    @Req() req: FastifyRequest & { user: any },
  ) {
    return this.premiumService.activatePremium(dto, req.user.sub);
  }

  @Post('renew')
  renewPremium(
    @Body() dto: RenewPremiumDto,
    @Req() req: FastifyRequest & { user: any },
  ) {
    return this.premiumService.renewPremium(dto, req.user.sub);
  }

  @Post('revoke')
  revokePremium(
    @Body() dto: RevokePremiumDto,
    @Req() req: FastifyRequest & { user: any },
  ) {
    return this.premiumService.revokePremium(dto, req.user.sub);
  }

  @Get('history/:userId')
  getPremiumHistory(@Param('userId') userId: string) {
    return this.premiumService.getPremiumHistory(userId);
  }
}
