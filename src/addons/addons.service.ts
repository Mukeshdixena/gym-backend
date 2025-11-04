import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddonDto } from './dto/create-addon.dto';
import { UpdateAddonDto } from './dto/update-addon.dto';
import { AssignMemberAddonDto } from './dto/assign-member-addon.dto';
import { RefundAddonDto } from './dto/refund-addon.dto';
import { PaginatedDto } from '../common/dto/paginated.dto';
import { MembershipStatus, PaymentMethod, Prisma, Addon } from '@prisma/client';

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
export class AddonsService {
  constructor(private prisma: PrismaService) {}

  // ──────────────────────────────────────────────────────────────
  // CREATE ADDON
  // ──────────────────────────────────────────────────────────────
  async create(dto: CreateAddonDto, userId: number) {
    return this.prisma.addon.create({
      data: {
        ...dto,
        userId,
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
  ): Promise<Addon[]> {
    const where: any = { userId };

    // Filter by active status
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive === 'true';
    }

    // Filter by price range
    if (filters.minPrice || filters.maxPrice) {
      where.price = {};
      if (filters.minPrice) where.price.gte = parseFloat(filters.minPrice);
      if (filters.maxPrice) where.price.lte = parseFloat(filters.maxPrice);
    }

    // Search by name or description
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Sorting
    const validSortFields = ['price', 'durationDays', 'createdAt', 'name'];
    const sortField: string = validSortFields.includes(filters.sortBy || '')
      ? (filters.sortBy as string)
      : 'createdAt';
    const sortOrder = filters.order === 'asc' ? 'asc' : 'desc';

    return this.prisma.addon.findMany({
      where,
      include: { memberAddons: true }, // equivalent to memberships
      orderBy: { [sortField]: sortOrder },
    });
  }
  // ──────────────────────────────────────────────────────────────
  // PAGINATED LIST (with filters, search, sort)
  // ──────────────────────────────────────────────────────────────
  async findAllPaginated(
    userId: number,
    query: PaginatedDto,
  ): Promise<PaginatedResult<any>> {
    const {
      page = 1,
      limit = 10,
      search,
      isActive,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const where: Prisma.AddonWhereInput = {
      userId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(isActive !== '' && { isActive: isActive === 'true' }),
      ...(minPrice !== undefined || maxPrice !== undefined
        ? {
            price: {
              gte: minPrice,
              lte: maxPrice,
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.addon.findMany({
        where,
        include: {
          memberAddons: {
            include: { member: true },
          },
        },
        orderBy: {
          [sortBy]: sortOrder.toLowerCase() as Prisma.SortOrder,
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.addon.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ──────────────────────────────────────────────────────────────
  // GET SINGLE ADDON
  // ──────────────────────────────────────────────────────────────
  async findOne(id: number, userId: number) {
    const addon = await this.prisma.addon.findFirst({
      where: { id, userId },
      include: {
        memberAddons: {
          include: { member: true },
        },
      },
    });

    if (!addon) throw new NotFoundException('Addon not found');
    return addon;
  }

  // ──────────────────────────────────────────────────────────────
  // UPDATE ADDON
  // ──────────────────────────────────────────────────────────────
  async update(id: number, dto: UpdateAddonDto, userId: number) {
    const existing = await this.prisma.addon.findFirst({
      where: { id, userId },
    });

    if (!existing) throw new NotFoundException('Addon not found');

    return this.prisma.addon.update({
      where: { id },
      data: {
        ...dto,
        updatedAt: new Date(),
      },
    });
  }

  // ──────────────────────────────────────────────────────────────
  // DELETE ADDON (with cascade cleanup)
  // ──────────────────────────────────────────────────────────────
  async delete(id: number, userId: number) {
    const existing = await this.prisma.addon.findFirst({
      where: { id, userId },
    });

    if (!existing) throw new NotFoundException('Addon not found');

    await this.prisma.$transaction([
      this.prisma.memberAddon.deleteMany({ where: { addonId: id } }),
      this.prisma.addon.delete({ where: { id } }),
    ]);

    return { id };
  }

  // ──────────────────────────────────────────────────────────────
  // ASSIGN ADDON TO MEMBER
  // ──────────────────────────────────────────────────────────────
  async assignMemberAddon(dto: AssignMemberAddonDto, userId: number) {
    const addon = await this.prisma.addon.findFirst({
      where: { id: dto.addonId, userId },
    });
    if (!addon) throw new NotFoundException('Addon not found');

    const member = await this.prisma.member.findFirst({
      where: { id: dto.memberId, userId },
    });
    if (!member) throw new NotFoundException('Member not found');

    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const endDate = dto.endDate
      ? new Date(dto.endDate)
      : addon.durationDays
      ? new Date(startDate.getTime() + addon.durationDays * 24 * 60 * 60 * 1000)
      : undefined;

    const memberAddonData: any = {
      member: { connect: { id: dto.memberId } },
      addon: { connect: { id: dto.addonId } },
      ...(dto.trainerId ? { trainer: { connect: { id: dto.trainerId } } } : {}),
      startDate,
      price: dto.price ?? addon.price,
      status: MembershipStatus.ACTIVE,
    };

    if (endDate) {
      // only assign endDate when defined to avoid `Date | undefined` type
      memberAddonData.endDate = endDate;
    }

    return this.prisma.memberAddon.create({
      data: memberAddonData as Prisma.MemberAddonCreateInput,
      include: {
        addon: true,
        member: true,
      },
    });
  }

  // ──────────────────────────────────────────────────────────────
  // REFUND ADDON
  // ──────────────────────────────────────────────────────────────
  async refundAddon(id: number, dto: RefundAddonDto, userId: number) {
    const memberAddon = await this.prisma.memberAddon.findFirst({
      where: { id },
      include: { addon: true },
    });
    if (!memberAddon) throw new NotFoundException('Member Addon not found');

    const refundAmount = dto.amount;
    if (refundAmount > memberAddon.price) {
      throw new BadRequestException('Refund exceeds original price');
    }

    const method =
      dto.method && Object.values(PaymentMethod).includes(dto.method as any)
        ? (dto.method as PaymentMethod)
        : PaymentMethod.CASH;

    const refund = await this.prisma.payment.create({
      data: {
        userId,
        amount: -refundAmount,
        method,
        notes: dto.reason || 'Addon refund issued',
      } as any, // Prisma doesn't expose membershipId in PaymentCreateInput
    });

    await this.prisma.memberAddon.update({
      where: { id },
      data: { status: MembershipStatus.CANCELLED },
    });

    return { refund, memberAddonId: id };
  }
}
