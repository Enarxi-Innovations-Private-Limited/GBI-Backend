import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';

import { DevicesRepository } from './devices.repository';
import { ClaimDeviceDto } from './dto/claim-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { TelemetryQueryService } from '../../telemetry/telemetry-query.service';

@Injectable()
export class DevicesService {
  constructor(
    private readonly repo: DevicesRepository,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly telemetryQuery: TelemetryQueryService,
  ) {}

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

    // Ownership check: Verify the user has an active assignment for this device
    const assignments = await this.repo.getUserDevices(userId);
    if (!assignments.find((a) => a.device.deviceId === deviceStringId)) {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException('You do not have access to this device');
    }

    return this.repo.updateDeviceMeta(
      userId,
      deviceStringId,
      dto.name,
      dto.location,
      dto.city,
      dto.pincode,
    );
  }

  /**
   * @deprecated Unassign is disabled at the API layer.
   * Schema and DB logic preserved for future re-enablement.
   */
  async unclaimDevice(userId: string, deviceStringId: string) {
    const device = await this.repo.getDeviceByStringId(deviceStringId);
    if (!device) throw new NotFoundException('Device not found');

    // Ownership check
    const assignments = await this.repo.getUserDevices(userId);
    if (!assignments.find((a) => a.device.deviceId === deviceStringId)) {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException('You do not have access to this device');
    }

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

  async getLatestTelemetry(userId: string, deviceStringId: string, lastTimestamp?: string) {
    const device = await this.repo.getDeviceByStringId(deviceStringId);
    if (!device) throw new NotFoundException('Device not found');

    // Ownership check (similar to setDeviceThreshold logic if we had one there, but getMyDevices uses it)
    // For simplicity and consistency with other endpoints, we check if the user is assigned to this device.
    const assignments = await this.repo.getUserDevices(userId);
    if (!assignments.find((a) => a.device.deviceId === deviceStringId)) {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException('You do not have access to this device');
    }

    const latestDbRecord = await this.repo.getLatestTelemetrySince(deviceStringId, lastTimestamp);
    
    if (!latestDbRecord) {
      return null;
    }

    return {
      isNew: true,
      timestamp: latestDbRecord.timestamp.toISOString(),
      data: {
        pm25: latestDbRecord.pm25 !== null ? Number(latestDbRecord.pm25) : null,
        pm10: latestDbRecord.pm10 !== null ? Number(latestDbRecord.pm10) : null,
        tvoc: latestDbRecord.tvoc !== null ? Number(latestDbRecord.tvoc) : null,
        co2: latestDbRecord.co2 !== null ? Number(latestDbRecord.co2) : null,
        temperature: latestDbRecord.temperature !== null ? Number(latestDbRecord.temperature) : null,
        humidity: latestDbRecord.humidity !== null ? Number(latestDbRecord.humidity) : null,
        noise: latestDbRecord.noise !== null ? Number(latestDbRecord.noise) : null,
        aqi: latestDbRecord.aqi !== null ? Number(latestDbRecord.aqi) : null,
      }
    };
  }

  async getDeviceTelemetry(
    userId: string,
    deviceStringId: string,
    metric?: string,
    startDate?: string,
    endDate?: string,
    minutes?: string,
  ) {
    // Validate ownership
    const assignments = await this.repo.getUserDevices(userId);
    const assigned = assignments.find(
      (a) => a.device.deviceId === deviceStringId,
    );
    if (!assigned) {
      throw new NotFoundException('Device not found or not assigned to user');
    }

    return this.repo.getDeviceTelemetry(
      deviceStringId,
      metric,
      startDate,
      endDate,
      minutes,
    );
  }

  /**
   * Get time-bucketed chart data for one or more devices.
   * Used by the Analytics page (single-device and device-comparison modes)
   * and the Historical Comparison section (period A vs period B).
   */
  async getChartData(
    userId: string,
    deviceIds: string[],
    parameter: string,
    start: Date,
    end: Date,
    intervalMinutes?: number,
  ) {
    if (!deviceIds.length) {
      throw new NotFoundException('At least one deviceId is required');
    }

    // Validate ownership for every requested device
    const assignments = await this.repo.getUserDevices(userId);
    const assignedIds = new Set(assignments.map((a) => a.device.deviceId));

    const devices: { id: string; deviceId: string }[] = [];
    for (const displayId of deviceIds) {
      if (!assignedIds.has(displayId)) {
        const { ForbiddenException } = await import('@nestjs/common');
        throw new ForbiddenException(
          `You do not have access to device ${displayId}`,
        );
      }
      const assignment = assignments.find(
        (a) => a.device.deviceId === displayId,
      )!;
      devices.push({
        id: assignment.device.id,
        deviceId: assignment.device.deviceId,
      });
    }

    // Get user-friendly names for each device
    const metaList = await this.repo.getUserDeviceMeta(userId);
    const nameMap = new Map(
      metaList.map((m) => [m.deviceId, m.name || m.deviceId]),
    );

    // Auto-compute interval if not provided
    const interval =
      intervalMinutes ?? TelemetryQueryService.autoInterval(start, end);

    // Query bucketed data for all devices at once
    const rows = await this.telemetryQuery.queryBucketedTelemetry(
      devices,
      [parameter],
      start,
      end,
      interval,
    );

    // Group by deviceId
    const grouped = new Map<string, { timestamp: string; value: number | null }[]>();
    for (const id of deviceIds) {
      grouped.set(id, []);
    }
    for (const row of rows) {
      const ts = new Date(row.timestamp);
      const bucket = grouped.get(row.deviceId);
      if (bucket) {
        const rawValue = row[parameter];
        bucket.push({
          timestamp: ts.toISOString(),
          value: rawValue !== null && rawValue !== undefined
            ? parameter === 'temperature'
              ? Math.round(Number(rawValue) * 10) / 10
              : Math.round(Number(rawValue))
            : null,
        });
      }
    }

    // Build response array
    return deviceIds.map((displayId) => ({
      deviceId: displayId,
      deviceName: nameMap.get(displayId) || displayId,
      data: grouped.get(displayId) || [],
    }));
  }
}
