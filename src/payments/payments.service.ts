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

    const where: Prisma.PaymentWhereInput = {
      userId,
      ...(memberId && {
        membership: { memberId },
      }),
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
          },
          orderBy: { paymentDate: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.payment.count({ where }),
      ]);

      const data = payments.map((p) => {
        const membership = p.membership;
        const member = membership?.member;
        const plan = membership?.plan;

        return {
          id: p.id,
          amount: p.amount,
          paymentDate: p.paymentDate,
          method: p.method,
          member: member
            ? {
                id: member.id,
                name: `${member.firstName} ${member.lastName}`,
                email: member.email,
              }
            : null,
          plan: plan?.name ?? null,
          membershipId: p.membershipId,
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
