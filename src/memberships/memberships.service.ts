import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { MembershipStatus, Prisma, PaymentMethod } from '@prisma/client';

@Injectable()
export class MembershipsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateMembershipDto, userId: number) {
    try {
      const member = await this.prisma.member.findFirst({
        where: { id: data.memberId, userId },
      });
      if (!member) throw new BadRequestException('Member not found');

      const plan = await this.prisma.plan.findFirst({
        where: { id: data.planId, userId },
      });
      if (!plan) throw new BadRequestException('Plan not found');

      // Normalize dates (ignore timezones)
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);

      // ✅ Check 1: End date must be after start date
      if (startDate >= endDate) {
        throw new BadRequestException('End date must be after start date');
      }

      // ✅ Check 2: End date must not be in the past
      if (endDate < today) {
        throw new BadRequestException('End date cannot be in the past');
      }

      // ✅ Check 3: Prevent overlapping memberships for same member
      const overlappingMembership = await this.prisma.membership.findFirst({
        where: {
          memberId: data.memberId,
          userId,
          AND: [
            { startDate: { lte: endDate } },
            { endDate: { gte: startDate } },
          ],
        },
      });

      if (overlappingMembership) {
        throw new BadRequestException(
          'Membership dates overlap with an existing membership for this member',
        );
      }

      const paid = data.paid ?? 0;
      const discount = data.discount ?? 0;
      const pending = plan.price - (paid + discount);

      const status: MembershipStatus =
        pending <= 0 ? MembershipStatus.ACTIVE : MembershipStatus.INACTIVE;

      const membership = await this.prisma.membership.create({
        data: {
          userId,
          memberId: data.memberId,
          planId: data.planId,
          startDate,
          endDate,
          status,
          paid,
          discount,
          pending,
        },
        include: { plan: true, member: true },
      });

      if (paid > 0) {
        await this.prisma.payment.create({
          data: {
            userId,
            membershipId: membership.id,
            amount: paid,
            paymentDate: new Date(),
            method:
              data.method && Object.values(PaymentMethod).includes(data.method)
                ? data.method
                : PaymentMethod.CASH,
          },
        });
      }

      return {
        success: true,
        message: 'Membership created successfully',
        data: membership,
      };
    } catch (error) {
      console.error('Membership creation error:', error);

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new BadRequestException('Database constraint error');
      }
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to create membership');
    }
  }

  async findAll(userId: number) {
    return this.prisma.membership.findMany({
      where: { userId },
      include: { plan: true, member: true, payments: true },
    });
  }

  async findOne(id: number, userId: number) {
    const membership = await this.prisma.membership.findFirst({
      where: { id, userId },
      include: { plan: true, member: true, payments: true },
    });
    if (!membership) throw new BadRequestException('Membership not found');
    return membership;
  }

  async updateMembership(id: number, data: any, userId: number) {
    const membership = await this.prisma.membership.findFirst({
      where: { id, userId },
    });
    if (!membership) throw new BadRequestException('Membership not found');

    return this.prisma.membership.update({
      where: { id },
      data,
      include: { plan: true, member: true, payments: true },
    });
  }

  async addPayment(
    id: number,
    userId: number,
    data: {
      amount?: number;
      discount?: number;
      method?: keyof typeof PaymentMethod;
      status?: keyof typeof MembershipStatus;
    },
  ) {
    const membership = await this.prisma.membership.findFirst({
      where: { id, userId },
      include: { plan: true },
    });

    if (!membership) throw new BadRequestException('Membership not found');

    let newPaid = membership.paid ?? 0;
    let newDiscount = membership.discount ?? 0;
    let newPending = membership.plan.price - newPaid - newDiscount;
    let newStatus = membership.status;

    if (data.amount !== undefined && data.method && data.amount > 0) {
      const additionalPaid = data.amount;
      const additionalDiscount = data.discount ?? 0;

      newPaid += additionalPaid;
      newDiscount += additionalDiscount;
      newPending = membership.plan.price - (newPaid + newDiscount);

      if (newPending <= 0) {
        newStatus = MembershipStatus.ACTIVE;
      } else if (newPending > 0 && newPaid > 0) {
        newStatus =
          data.status === 'PARTIAL_PAID'
            ? MembershipStatus.PARTIAL_PAID
            : MembershipStatus.INACTIVE;
      } else {
        newStatus = MembershipStatus.INACTIVE;
      }

      await this.prisma.payment.create({
        data: {
          userId,
          membershipId: membership.id,
          amount: additionalPaid,
          paymentDate: new Date(),
          method: data.method,
        },
      });
    }

    if (data.status) {
      newStatus = data.status;
    }

    const updatedMembership = await this.prisma.membership.update({
      where: { id },
      data: {
        paid: newPaid,
        discount: newDiscount,
        pending: newPending,
        status: newStatus,
      },
      include: { plan: true, member: true, payments: true },
    });

    return {
      success: true,
      message: 'Membership updated successfully',
      data: updatedMembership,
    };
  }
  async deleteMembership(id: number, userId: number) {
    const membership = await this.prisma.membership.findFirst({
      where: { id, userId },
    });

    if (!membership) throw new BadRequestException('Membership not found');

    await this.prisma.payment.deleteMany({
      where: { membershipId: id, userId },
    });

    await this.prisma.membership.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Membership deleted successfully',
    };
  }
}
