import { Injectable } from '@nestjs/common';
import { EventLogsRepository } from './event-logs.repository';

@Injectable()
export class EventLogsService {
  constructor(private readonly repo: EventLogsRepository) {}

  async getDeviceEvents(
    userId: string,
    page = 1,
    limit = 6,
    search?: string,
  ) {
    const take = Math.min(limit, 50);
    const skip = (page - 1) * take;
    return this.repo.getDeviceEvents(userId, skip, take, search);
  }

  async getSensorEvents(
    userId: string,
    page = 1,
    limit = 6,
    search?: string,
  ) {
    const take = Math.min(limit, 50);
    const skip = (page - 1) * take;
    return this.repo.getSensorEvents(userId, skip, take, search);
  }
}
