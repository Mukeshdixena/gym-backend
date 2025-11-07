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
import { PaginatedDto } from '../common/dto/paginated.dto';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  // ──────────────────────────────────────────────────────────────
  // CREATE PLAN
  // ──────────────────────────────────────────────────────────────
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
  // ──────────────────────────────────────────────────────────────
  // PAGINATED LIST (with filters, search, sort)
  // ──────────────────────────────────────────────────────────────

  async findAllPaginated(
    userId: number,
    filters: {
      id?: string;
      name?: string;
      price?: string;
      duration?: string;
      status?: string;
      page: number;
      limit: number;
    },
  ): Promise<{
    data: Plan[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const { id, name, price, duration, status, page = 1, limit = 10 } = filters;

    const skip = (page - 1) * limit;

    const where: any = { userId };

    // Filter by ID
    if (id) {
      where.id = parseInt(id, 10);
    }

    // Filter by name (contains)
    if (name) {
      where.name = { contains: name, mode: 'insensitive' };
    }

    // Filter by price (min price)
    if (price) {
      const minPrice = parseFloat(price);
      if (!isNaN(minPrice)) {
        where.price = { gte: minPrice };
      }
    }

    // Filter by duration (min days)
    if (duration) {
      const minDays = parseFloat(duration);
      if (!isNaN(minDays)) {
        where.durationDays = { gte: minDays };
      }
    }

    // Filter by status
    if (status !== undefined && status !== '') {
      where.isActive = status === 'true';
    }

    // Count total
    const total = await this.prisma.plan.count({ where });

    // Fetch plans
    const plans = await this.prisma.plan.findMany({
      where,
      include: { memberships: true },
      orderBy: { createdAt: 'desc' }, // default sort
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: plans,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  // ──────────────────────────────────────────────────────────────
  // GET SINGLE PLAN
  // ──────────────────────────────────────────────────────────────
  async findOne(id: number, userId: number): Promise<Plan> {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: { memberships: true },
    });

    if (!plan) throw new NotFoundException('Plan not found');
    if (plan.userId !== userId) throw new ForbiddenException('Access denied');

    return plan;
  }

  // ──────────────────────────────────────────────────────────────
  // UPDATE PLAN
  // ──────────────────────────────────────────────────────────────
  async update(id: number, data: UpdatePlanDto, userId: number): Promise<Plan> {
    const existing = await this.prisma.plan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Plan not found');
    if (existing.userId !== userId)
      throw new ForbiddenException('Access denied');

    return this.prisma.plan.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
  }

  // ──────────────────────────────────────────────────────────────
  // TOGGLE ACTIVE STATUS
  // ──────────────────────────────────────────────────────────────
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

  // ──────────────────────────────────────────────────────────────
  // DELETE PLAN (with membership check)
  // ──────────────────────────────────────────────────────────────
  async remove(id: number, userId: number): Promise<Plan> {
    const existing = await this.prisma.plan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Plan not found');
    if (existing.userId !== userId)
      throw new ForbiddenException('Access denied');

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
