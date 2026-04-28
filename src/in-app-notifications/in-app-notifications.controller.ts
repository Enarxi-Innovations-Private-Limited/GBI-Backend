import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards';
import { InAppNotificationsService } from './in-app-notifications.service';
import { CurrentUser } from 'src/auth/decorators';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class InAppNotificationsController {
  constructor(private readonly service: InAppNotificationsService) {}

  @Get()
  getMyNotifications(
    @CurrentUser() user: any,
    @Query('isRead') isRead?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedIsRead = isRead === undefined ? undefined : isRead === 'true';

    return this.service.getMyNotifications(
      user.id,
      parsedIsRead,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Patch(':id/read')
  markAsRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.markAsRead(user.id, id);
  }

  @Patch('read-all')
  markAllAsRead(@CurrentUser() user: any) {
    return this.service.markAllAsRead(user.id);
  }
}
