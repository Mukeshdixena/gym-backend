// src/memberships/memberships.service.ts
import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { MembershipStatus, Prisma, PaymentMethod } from '@prisma/client';

@Injectable()
export class MembershipsService {
  constructor(private prisma: PrismaService) {}

  /* ──────────────────────────────────────────────────────────────
     CREATE
  ────────────────────────────────────────────────────────────── */
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

      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);

      if (startDate >= endDate) {
        throw new BadRequestException('End date must be after start date');
      }
      if (endDate < today) {
        throw new BadRequestException('End date cannot be in the past');
      }

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
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to create membership');
    }
  }

  /* ──────────────────────────────────────────────────────────────
     READ
  ────────────────────────────────────────────────────────────── */
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

  /* ──────────────────────────────────────────────────────────────
     UPDATE (now type-safe)
  ────────────────────────────────────────────────────────────── */
  async updateMembership(
    id: number,
    data: UpdateMembershipDto,
    userId: number,
  ) {
    const membership = await this.prisma.membership.findFirst({
      where: { id, userId },
      include: { plan: true },
    });

    if (!membership) throw new BadRequestException('Membership not found');

    const updates: Prisma.MembershipUpdateInput = { ...data };

    // ---- DATE / PLAN CHANGE -------------------------------------------------
    if (data.startDate || data.endDate || data.planId) {
      const startDate = data.startDate
        ? new Date(data.startDate)
        : membership.startDate;
      const endDate = data.endDate
        ? new Date(data.endDate)
        : membership.endDate;

      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);

      if (startDate >= endDate) {
        throw new BadRequestException('End date must be after start date');
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (endDate < today) {
        throw new BadRequestException('End date cannot be in the past');
      }

      // overlap check (exclude current membership)
      const overlapping = await this.prisma.membership.findFirst({
        where: {
          memberId: membership.memberId,
          userId,
          id: { not: id },
          AND: [
            { startDate: { lte: endDate } },
            { endDate: { gte: startDate } },
          ],
        },
      });

      if (overlapping) {
        throw new BadRequestException(
          'Updated dates overlap with another membership',
        );
      }

      // ---- PLAN CHANGE --------------------------------------------------------
      if (data.planId && data.planId !== membership.planId) {
        const newPlan = await this.prisma.plan.findFirst({
          where: { id: data.planId, userId },
        });
        if (!newPlan) throw new BadRequestException('Plan not found');

        const totalPaidAndDiscount =
          (membership.paid ?? 0) + (membership.discount ?? 0);
        const newPending = newPlan.price - totalPaidAndDiscount;

        updates.pending = newPending > 0 ? newPending : 0;
        updates.status =
          newPending <= 0 ? MembershipStatus.ACTIVE : MembershipStatus.INACTIVE;
      }
    }

    return this.prisma.membership.update({
      where: { id },
      data: updates,
      include: { plan: true, member: true, payments: true },
    });
  }

  /* ──────────────────────────────────────────────────────────────
     REFUND
  ────────────────────────────────────────────────────────────── */
  async refundPayment(
    membershipId: number,
    userId: number,
    dto: RefundPaymentDto,
  ) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, userId },
      include: { plan: true, payments: true },
    });

    if (!membership) throw new BadRequestException('Membership not found');

    const currentPaid = membership.paid ?? 0;
    if (dto.amount > currentPaid) {
      throw new BadRequestException(
        'Refund amount cannot exceed total paid amount',
      );
    }

    const newPaid = currentPaid - dto.amount;
    const newPending =
      membership.plan.price - newPaid - (membership.discount ?? 0);

    const newStatus =
      newPending <= 0
        ? MembershipStatus.ACTIVE
        : newPaid > 0
          ? MembershipStatus.PARTIAL_PAID
          : MembershipStatus.INACTIVE;

    const refund = await this.prisma.payment.create({
      data: {
        userId,
        membershipId,
        amount: -dto.amount,
        paymentDate: new Date(),
        method: dto.method ? (dto.method as PaymentMethod) : PaymentMethod.CASH,
        notes: dto.reason ? `Refund: ${dto.reason}` : 'Refund issued',
      },
    });

    const updatedMembership = await this.prisma.membership.update({
      where: { id: membershipId },
      data: {
        paid: newPaid,
        pending: newPending > 0 ? newPending : 0,
        status: newStatus,
      },
      include: {
        plan: true,
        member: true,
        payments: { orderBy: { paymentDate: 'desc' } },
      },
    });

    return {
      success: true,
      message: 'Refund processed successfully',
      data: { refund, membership: updatedMembership },
    };
  }

  /* ──────────────────────────────────────────────────────────────
     ADD PAYMENT
  ────────────────────────────────────────────────────────────── */
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

  /* ──────────────────────────────────────────────────────────────
     DELETE
  ────────────────────────────────────────────────────────────── */
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
