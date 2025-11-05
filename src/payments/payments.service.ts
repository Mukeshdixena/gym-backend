// src/payments/payments.service.ts
import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentMethod, Prisma } from '@prisma/client';
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
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  // src/payments/payments.service.ts (UPDATED)
  async findAllPaginated(
    userId: number,
    query: PaginatedDto,
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

    // Build base where
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

    // Add search (only string-compatible fields)
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
      ];
    }

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
              plan: {
                select: {
                  name: true,
                  price: true,
                },
              },
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
              addon: {
                select: {
                  name: true,
                  price: true,
                },
              },
              trainer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: { [field]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    const formattedData = data.map((p) => {
      const membership = p.membership;
      const memberAddon = p.memberAddon;

      const member = membership?.member || memberAddon?.member;
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
          addonName: null,
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
          addonName: memberAddon.addon?.name ?? null,
          trainer: memberAddon.trainer
            ? {
                id: memberAddon.trainer.id,
                name: `${memberAddon.trainer.firstName} ${memberAddon.trainer.lastName}`,
              }
            : null,
        };
      }

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
