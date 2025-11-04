// src/payments/payments.service.ts
import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GetPaymentHistoryDto } from './dto/get-payment-history.dto';
import { PaymentMethod, Prisma } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  // src/payments/payments.service.ts (UPDATED)
  async getPaymentHistory(userId: number, filters: GetPaymentHistoryDto) {
    const {
      memberId,
      startDate,
      endDate,
      method,
      page = 1,
      limit = 10,
    } = filters;

    const skip = (page - 1) * limit;

    // Build dynamic where clause
    const where: Prisma.PaymentWhereInput = {
      userId,
      ...(method && { method }),
      ...(startDate || endDate
        ? {
            paymentDate: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
    };

    // Apply memberId filter via OR condition on membership OR memberAddon
    if (memberId) {
      where.OR = [{ membership: { memberId } }, { memberAddon: { memberId } }];
    }

    try {
      const [payments, total] = await Promise.all([
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
          orderBy: { paymentDate: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.payment.count({ where }),
      ]);

      const data = payments.map((p) => {
        const membership = p.membership;
        const memberAddon = p.memberAddon;

        // Common member info
        const member = membership?.member || memberAddon?.member;
        const memberInfo = member
          ? {
              id: member.id,
              name: `${member.firstName} ${member.lastName}`,
              email: member.email,
            }
          : null;

        // Determine type and details
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

        // Fallback (shouldn't happen)
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
        success: true,
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Payment history error:', error);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new BadRequestException('Invalid filter parameters');
      }
      throw new InternalServerErrorException('Failed to fetch payment history');
    }
  }
}
