import { Injectable, NotFoundException } from '@nestjs/common';
import { DevicesRepository } from './devices.repository';
import { ClaimDeviceDto } from './dto/claim-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

@Injectable()
export class DevicesService {
  constructor(private readonly repo: DevicesRepository) {}

  /**
   * Claim a device for the authenticated user.
   * All validation and writes are fully atomic inside the repository transaction.
   * No pre-checks here to avoid race condition windows.
   */
  async claimDevice(userId: string, dto: ClaimDeviceDto) {
    return this.repo.claimDevice(userId, dto);
  }

  async getMyDevices(userId: string) {
    const assignments = await this.repo.getUserDevices(userId);
    const metaList = await this.repo.getUserDeviceMeta(userId);

    return assignments.map((a) => {
      const meta = metaList.find((m) => m.deviceId === a.device.deviceId);
      return {
        id: a.device.id,
        deviceId: a.device.deviceId,
        type: a.device.type,
        status: a.device.status,
        name: meta?.name || a.device.deviceId,
        location: meta?.location || null,
        city: meta?.city || null,
        pincode: meta?.pincode || null,
        claimedAt: a.assignedAt,
      };
    });
  }

  async updateDevice(
    userId: string,
    deviceStringId: string,
    dto: UpdateDeviceDto,
  ) {
    const device = await this.repo.getDeviceByStringId(deviceStringId);
    if (!device) throw new NotFoundException('Device not found');

    return this.repo.updateDeviceMeta(
      userId,
      deviceStringId,
      dto.name,
      dto.location,
    );
  }

  /**
   * @deprecated Unassign is disabled at the API layer.
   * Schema and DB logic preserved for future re-enablement.
   */
  async unclaimDevice(userId: string, deviceStringId: string) {
    const device = await this.repo.getDeviceByStringId(deviceStringId);
    if (!device) throw new NotFoundException('Device not found');
    await this.repo.unclaimDevice(userId, device.id);
    return { success: true };
  }

  async setDeviceThreshold(
    userId: string,
    deviceStringId: string,
    thresholds: Record<string, number>,
  ) {
    const device = await this.repo.getDeviceByStringId(deviceStringId);
    if (!device) throw new NotFoundException('Device not found');

    if (device.groupId) {
      const { ConflictException } = await import('@nestjs/common');
      throw new ConflictException(
        'Remove device from group before setting individual threshold',
      );
    }

    return this.repo.setDeviceThreshold(device.id, thresholds);
  }

  async removeDeviceThreshold(userId: string, deviceStringId: string) {
    const device = await this.repo.getDeviceByStringId(deviceStringId);
    if (!device) throw new NotFoundException('Device not found');

    await this.repo.removeDeviceThreshold(device.id);
    return { message: 'Device threshold removed' };
  }
}
