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

  // ──────────────────────────────────────────────────────────────
  // FIND ALL (FILTERS + SORT)
  // ──────────────────────────────────────────────────────────────
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

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive === 'true';
    }

    if (filters.minPrice || filters.maxPrice) {
      where.price = {};
      if (filters.minPrice) where.price.gte = parseFloat(filters.minPrice);
      if (filters.maxPrice) where.price.lte = parseFloat(filters.maxPrice);
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const validSortFields = ['price', 'durationDays', 'createdAt', 'name'];
    const sortField: string = validSortFields.includes(filters.sortBy || '')
      ? (filters.sortBy as string)
      : 'createdAt';
    const sortOrder = filters.order === 'asc' ? 'asc' : 'desc';

    return this.prisma.addon.findMany({
      where,
      include: { memberAddons: true },
      orderBy: { [sortField]: sortOrder },
    });
  }

  // ──────────────────────────────────────────────────────────────
  // PAGINATED LIST
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
          memberAddons: { include: { member: true, trainer: true } },
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
        memberAddons: { include: { member: true, trainer: true } },
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
  // DELETE ADDON
  // ──────────────────────────────────────────────────────────────
  async delete(id: number, userId: number) {
    const existing = await this.prisma.addon.findFirst({
      where: { id, userId },
    });

    if (!existing) throw new NotFoundException('Addon not found');

    await this.prisma.$transaction([
      this.prisma.payment.deleteMany({
        where: { memberAddon: { addonId: id } },
      }),
      this.prisma.memberAddon.deleteMany({ where: { addonId: id } }),
      this.prisma.addon.delete({ where: { id } }),
    ]);

    return { message: 'Addon deleted successfully', id };
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
    const duration = addon.durationDays ?? 0;
    const endDate =
      dto.endDate ||
      (duration > 0
        ? new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000)
        : (() => {
            throw new BadRequestException(
              'Addon must have durationDays or endDate defined',
            );
          })());

    const data: Prisma.MemberAddonCreateInput = {
      member: { connect: { id: dto.memberId } },
      addon: { connect: { id: dto.addonId } },
      startDate,
      endDate,
      price: dto.price ?? addon.price,
      status: MembershipStatus.ACTIVE,
      ...(dto.trainerId ? { trainer: { connect: { id: dto.trainerId } } } : {}),
    };

    return this.prisma.memberAddon.create({
      data,
      include: { addon: true, member: true, trainer: true },
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
        memberAddon: { connect: { id } },
        amount: -refundAmount,
        method,
        notes: dto.reason || 'Addon refund issued',
      } as any,
    });

    await this.prisma.memberAddon.update({
      where: { id },
      data: { status: MembershipStatus.CANCELLED },
    });

    return { message: 'Refund processed', refund, memberAddonId: id };
  }
}
