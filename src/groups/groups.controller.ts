import {
  Body,
  Controller,
  Post,
  Req,
  Param,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupsService } from './groups.service';

@UseGuards(AuthGuard('jwt'))
@Controller('groups')
export class GroupsController {
  constructor(private readonly service: GroupsService) {}

  @Post()
  create(@Req() req, @Body() dto: CreateGroupDto) {
    return this.service.createGroup(req.user.id, dto.name);
  }

  @Post(':groupId/devices')
  addDevice(
    @Req() req,
    @Param('groupId') groupId: string,
    @Body() body: { deviceId: string },
  ) {
    return this.service.addDeviceToGroup(req.user.id, groupId, body.deviceId);
  }

  @Delete(':groupId/devices/:deviceId')
  removeDevice(
    @Req() req,
    @Param('groupId') groupId: string,
    @Param('deviceId') deviceId: string,
  ) {
    return this.service.removeDeviceFromGroup(req.user.id, groupId, deviceId);
  }
}
