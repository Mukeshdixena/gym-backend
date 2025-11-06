import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { GetPaymentHistoryDto } from './dto/get-payment-history.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllPaginated(
    userId: number,
    query: GetPaymentHistoryDto,
  ): Promise<{
    data: any[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'paymentDate',
      sortOrder = 'DESC',
      minPrice,
      maxPrice,
      type,
    } = query;

    // Validation
    if (page < 1 || limit < 1) {
      throw new BadRequestException('page and limit must be positive');
    }

    const validSortFields = ['paymentDate', 'amount', 'method', 'createdAt'];
    const field = validSortFields.includes(sortBy) ? sortBy : 'paymentDate';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'asc' : 'desc';

    // Base WHERE
    const where: Prisma.PaymentWhereInput = {
      userId,
      ...(minPrice !== undefined || maxPrice !== undefined
        ? {
            amount: {
              ...(minPrice !== undefined ? { gte: minPrice } : {}),
              ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
            },
          }
        : {}),
    };

    // Type filter
    if (type) {
      if (type === 'membership') where.membershipId = { not: null };
      else if (type === 'addon') where.memberAddonId = { not: null };
      else if (type === 'expense') where.expenseId = { not: null };
      else throw new BadRequestException(`Invalid type: ${type}`);
    }

    // Search filter
    if (search) {
      where.OR = [
        {
          membership: {
            member: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
        {
          memberAddon: {
            member: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
        {
          expense: {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { category: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    // Fetch raw data with includes
    const [data, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: {
          membership: {
            include: {
              member: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              plan: { select: { name: true, price: true } },
            },
          },
          memberAddon: {
            include: {
              member: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              addon: { select: { name: true, price: true } },
              trainer: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
          expense: {
            select: {
              id: true,
              title: true,
              category: true,
              amount: true,
              paid: true,
              pending: true,
            },
          },
        },
        orderBy: { [field]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data, // ← Raw Prisma objects, no transformation
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
