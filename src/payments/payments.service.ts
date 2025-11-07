import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentMethod, Prisma } from '@prisma/client';
import { GetPaymentHistoryDto } from './dto/get-payment-history.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllPaginated(
    userId: number,
    query: {
      page?: string;
      limit?: string;
      memberSearch?: string;
      expenseSearch?: string;
      startDate?: string;
      endDate?: string;
      method?: string;
      type?: string;
      amount?: string;
      date?: string;
    },
  ): Promise<{
    data: any[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    // Parse pagination
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '10', 10)));

    if (isNaN(page) || isNaN(limit)) {
      throw new BadRequestException('Invalid page or limit');
    }

    // Parse amount
    const amountFilter = query.amount ? parseFloat(query.amount) : undefined;
    if (query.amount && isNaN(amountFilter!)) {
      throw new BadRequestException('Amount must be a valid number');
    }

    // Build WHERE
    const where: Prisma.PaymentWhereInput = { userId };

    // Date range filter
    if (query.startDate || query.endDate) {
      where.paymentDate = {
        ...(query.startDate && { gte: new Date(query.startDate) }),
        ...(query.endDate && { lte: new Date(query.endDate) }),
      };
    }

    // Exact date filter
    if (query.date) {
      const date = new Date(query.date);
      if (isNaN(date.getTime())) throw new BadRequestException('Invalid date');
      const start = new Date(date.setHours(0, 0, 0, 0));
      const end = new Date(date.setHours(23, 59, 59, 999));
      where.paymentDate = { gte: start, lte: end };
    }

    // Method filter
    if (query.method) {
      const methodUpper = query.method.toUpperCase();

      // Validate against actual enum values
      if (
        !Object.values(PaymentMethod).includes(methodUpper as PaymentMethod)
      ) {
        throw new BadRequestException(
          `Invalid payment method: '${query.method}'. ` +
            `Must be one of: ${Object.values(PaymentMethod).join(', ')}`,
        );
      }

      // Safe: TypeScript now knows it's a valid enum value
      where.method = { equals: methodUpper as PaymentMethod };
    }
    // Amount filter
    if (amountFilter !== undefined) {
      where.amount = amountFilter;
    }

    // Type filter
    if (query.type) {
      if (query.type === 'membership') where.membershipId = { not: null };
      else if (query.type === 'addon') where.memberAddonId = { not: null };
      else if (query.type === 'expense') where.expenseId = { not: null };
      else throw new BadRequestException(`Invalid type: ${query.type}`);
    }

    // === SEARCH FILTERS ===
    const andConditions: Prisma.PaymentWhereInput[] = [];

    // Member search (applies to membership & addon)
    if (query.memberSearch?.trim()) {
      const term = query.memberSearch.trim();
      andConditions.push({
        OR: [
          {
            membership: {
              member: {
                OR: [
                  { firstName: { contains: term, mode: 'insensitive' } },
                  { lastName: { contains: term, mode: 'insensitive' } },
                  { email: { contains: term, mode: 'insensitive' } },
                ],
              },
            },
          },
          {
            memberAddon: {
              member: {
                OR: [
                  { firstName: { contains: term, mode: 'insensitive' } },
                  { lastName: { contains: term, mode: 'insensitive' } },
                  { email: { contains: term, mode: 'insensitive' } },
                ],
              },
            },
          },
        ],
      });
    }

    // Expense search
    if (query.expenseSearch?.trim()) {
      const term = query.expenseSearch.trim();
      andConditions.push({
        expense: {
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { category: { contains: term, mode: 'insensitive' } },
          ],
        },
      });
    }

    // Apply AND conditions only if any exist
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // === QUERY EXECUTION ===
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
        orderBy: { paymentDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
