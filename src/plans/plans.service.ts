// src/plans/plans.service.ts
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Plan, Prisma } from '@prisma/client';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreatePlanDto, userId: number): Promise<Plan> {
    return this.prisma.plan.create({
      data: {
        ...data,
        user: { connect: { id: userId } },
        isActive: data.isActive ?? true,
      },
    });
  }

  async findAll(
    userId: number,
    filters: {
      isActive?: string;
      minPrice?: string;
      maxPrice?: string;
      search?: string;
      sortBy?: string;
      order?: 'asc' | 'desc';
    },
  ): Promise<Plan[]> {
    const where: any = { userId };

    // 🔍 Filter by active status
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive === 'true';
    }

    // 💰 Filter by price range
    if (filters.minPrice || filters.maxPrice) {
      where.price = {};
      if (filters.minPrice) where.price.gte = parseFloat(filters.minPrice);
      if (filters.maxPrice) where.price.lte = parseFloat(filters.maxPrice);
    }

    // 🔎 Search by name or description
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // 🧭 Sorting
    const validSortFields = ['price', 'durationDays', 'createdAt', 'name'];
    const sortField: string = validSortFields.includes(filters.sortBy || '')
      ? (filters.sortBy as string)
      : 'createdAt';
    const sortOrder = filters.order === 'asc' ? 'asc' : 'desc';

    return this.prisma.plan.findMany({
      where,
      include: { memberships: true },
      orderBy: { [sortField]: sortOrder },
    });
  }

  async findOne(id: number, userId: number): Promise<Plan> {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: { memberships: true },
    });

    if (!plan) throw new NotFoundException('Plan not found');
    if (plan.userId !== userId) throw new ForbiddenException('Access denied');

    return plan;
  }

  async update(id: number, data: UpdatePlanDto, userId: number): Promise<Plan> {
    const existing = await this.prisma.plan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Plan not found');
    if (existing.userId !== userId)
      throw new ForbiddenException('Access denied');

    return this.prisma.plan.update({
      where: { id },
      data,
    });
  }

  // NEW: Toggle active status
  async toggleStatus(
    id: number,
    isActive: boolean,
    userId: number,
  ): Promise<Plan> {
    const existing = await this.prisma.plan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Plan not found');
    if (existing.userId !== userId)
      throw new ForbiddenException('Access denied');

    return this.prisma.plan.update({
      where: { id },
      data: { isActive },
    });
  }

  async remove(id: number, userId: number): Promise<Plan> {
    const existing = await this.prisma.plan.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Plan not found');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // Check if any Membership references this plan
    const membershipCount = await this.prisma.membership.count({
      where: { planId: id },
    });

    if (membershipCount > 0) {
      throw new BadRequestException(
        "Plan can't be deleted — it's linked to existing memberships.",
      );
    }

    return this.prisma.plan.delete({ where: { id } });
  }
}
