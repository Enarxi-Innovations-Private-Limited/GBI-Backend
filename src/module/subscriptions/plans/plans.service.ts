import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { amount: 'asc' },
    });
  }

  async findOne(id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async create(dto: CreatePlanDto) {
    // Check if the plan already exists (maybe soft-deleted)
    const existing = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.id },
    });

    if (existing) {
      if (existing.isActive) {
        throw new ConflictException('A plan with this name or ID already exists and is active.');
      }
      // If it exists but was soft-deleted, we simply update and reactivate it.
      return this.prisma.subscriptionPlan.update({
        where: { id: dto.id },
        data: {
          ...dto,
          features: dto.features ?? [],
          isActive: true,
          updatedAt: new Date(),
        },
      });
    }

    // Normal path if it doesn't exist at all
    try {
      return await this.prisma.subscriptionPlan.create({
        data: {
          ...dto,
          features: dto.features ?? [],
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('A plan with this name or ID already exists and is active.');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdatePlanDto) {
    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        ...dto,
        updatedAt: new Date(),
      },
    });
  }

  async remove(id: string) {
    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
