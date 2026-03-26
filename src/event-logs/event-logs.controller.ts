import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PremiumGuard } from 'src/auth/guards/premium.guard';
import { RequiresPremium } from 'src/auth/decorators/premium.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { EventLogsService } from './event-logs.service';

@UseGuards(JwtAuthGuard)
@Controller('event-logs')
export class EventLogsController {
  constructor(private readonly service: EventLogsService) {}

  /**
   * GET /event-logs/devices
   * Returns paginated device online/offline history for the authenticated user.
   */
  @Get('devices')
  getDeviceEvents(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.service.getDeviceEvents(
      user.id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 6,
      search || undefined,
    );
  }

  /**
   * GET /event-logs/sensors
   * Returns paginated sensor threshold breach history for the authenticated user.
   */
  @Get('sensors')
  @UseGuards(PremiumGuard)
  @RequiresPremium()
  getSensorEvents(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.service.getSensorEvents(
      user.id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 6,
      search || undefined,
    );
  }
}
