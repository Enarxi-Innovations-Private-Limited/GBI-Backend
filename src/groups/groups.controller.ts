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
import { SetGroupThresholdDto } from './dto/set-group-threshold.dto';

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

  @Post(':groupId/threshold')
  setGroupThreshold(
    @Req() req,
    @Param('groupId') groupId: string,
    @Body() dto: SetGroupThresholdDto,
  ) {
    return this.service.setGroupThreshold(req.user.id, groupId, dto.thresholds);
  }

  @Delete(':groupId/threshold')
  removeGroupThreshold(@Req() req, @Param('groupId') groupId: string) {
    return this.service.removeGroupThreshold(req.user.id, groupId);
  }

  @Delete(':groupId')
  deleteGroup(@Req() req, @Param('groupId') groupId: string) {
    return this.service.deleteGroup(req.user.id, groupId);
  }
}
