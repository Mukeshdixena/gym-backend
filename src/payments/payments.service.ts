import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentMethod, Prisma } from '@prisma/client';
// import { PaginatedDto } from '../common/dto/paginated.dto';
import { GetPaymentHistoryDto } from './dto/get-payment-history.dto';

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
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async findAllPaginated(
    userId: number,
    query: GetPaymentHistoryDto,
  ): Promise<PaginatedResult<any>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      minPrice,
      maxPrice,
    } = query;

    const validSortFields = ['paymentDate', 'amount', 'method', 'createdAt'];
    const field = validSortFields.includes(sortBy) ? sortBy : 'paymentDate';
    const order = sortOrder.toLowerCase() as Prisma.SortOrder;

    // ───────────────────────────────
    // Base WHERE filter
    // ───────────────────────────────
    const where: Prisma.PaymentWhereInput = {
      userId,
      ...(minPrice !== undefined || maxPrice !== undefined
        ? {
            amount: {
              ...(minPrice ? { gte: minPrice } : {}),
              ...(maxPrice ? { lte: maxPrice } : {}),
            },
          }
        : {}),
    };

    // Filter by type
    if (query.type) {
      if (query.type === 'membership') where.membershipId = { not: null };
      else if (query.type === 'addon') where.memberAddonId = { not: null };
      else if (query.type === 'expense') where.expenseId = { not: null };
    }

    // ───────────────────────────────
    // Search filter
    // ───────────────────────────────
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

    // ───────────────────────────────
    // Query + Count
    // ───────────────────────────────
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

    // ───────────────────────────────
    // Format results
    // ───────────────────────────────
    const formattedData = data.map((p) => {
      const membership = p.membership;
      const memberAddon = p.memberAddon;
      const expense = p.expense;

      // Shared info
      const member = membership?.member || memberAddon?.member || null;

      const memberInfo = member
        ? {
            id: member.id,
            name: `${member.firstName} ${member.lastName}`,
            email: member.email,
          }
        : null;

      if (membership) {
        return {
          id: p.id,
          amount: p.amount,
          paymentDate: p.paymentDate,
          method: p.method,
          type: 'membership' as const,
          member: memberInfo,
          plan: membership.plan?.name ?? null,
          membershipId: p.membershipId,
          addonId: null,
          expenseId: null,
          addonName: null,
          expenseTitle: null,
          trainer: null,
        };
      }

      if (memberAddon) {
        return {
          id: p.id,
          amount: p.amount,
          paymentDate: p.paymentDate,
          method: p.method,
          type: 'addon' as const,
          member: memberInfo,
          plan: null,
          membershipId: null,
          addonId: p.memberAddonId,
          expenseId: null,
          addonName: memberAddon.addon?.name ?? null,
          expenseTitle: null,
          trainer: memberAddon.trainer
            ? {
                id: memberAddon.trainer.id,
                name: `${memberAddon.trainer.firstName} ${memberAddon.trainer.lastName}`,
              }
            : null,
        };
      }

      if (expense) {
        return {
          id: p.id,
          amount: p.amount,
          paymentDate: p.paymentDate,
          method: p.method,
          type: 'expense' as const,
          expenseId: p.expenseId,
          expenseTitle: expense.title,
          category: expense.category,
          expenseAmount: expense.amount,
          paid: expense.paid,
          pending: expense.pending,
          member: null,
          plan: null,
          addonId: null,
          addonName: null,
          trainer: null,
        };
      }

      // fallback
      return {
        id: p.id,
        amount: p.amount,
        paymentDate: p.paymentDate,
        method: p.method,
        type: 'unknown' as const,
        member: null,
        plan: null,
        membershipId: null,
        addonId: null,
        expenseId: null,
        expenseTitle: null,
        addonName: null,
        trainer: null,
      };
    });

    return {
      data: formattedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
