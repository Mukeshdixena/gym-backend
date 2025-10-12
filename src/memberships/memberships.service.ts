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

  async create(data: CreateMembershipDto) {
    try {
      const member = await this.prisma.member.findUnique({
        where: { id: data.memberId },
      });
      if (!member) throw new BadRequestException('Member not found');

      const plan = await this.prisma.plan.findUnique({
        where: { id: data.planId },
      });
      if (!plan) throw new BadRequestException('Plan not found');

      const paid = data.paid ?? 0;
      const discount = data.discount ?? 0;
      const pending = plan.price - (paid + discount);

      const status: MembershipStatus =
        pending <= 0 ? MembershipStatus.ACTIVE : MembershipStatus.INACTIVE;

      const membership = await this.prisma.membership.create({
        data: {
          member: { connect: { id: data.memberId } },
          plan: { connect: { id: data.planId } },
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          status,
          paid,
          discount,
          pending,
        },
        include: { plan: true, member: true },
      });

      // Record initial payment if any
      if (paid > 0) {
        await this.prisma.payment.create({
          data: {
            membershipId: membership.id,
            amount: paid,
            paymentDate: new Date(),
            method: PaymentMethod.CASH, // default or could come from DTO
          },
        });
      }

      return {
        success: true,
        message: 'Membership created successfully',
        data: membership,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new BadRequestException('Database constraint error');
      }
      throw new InternalServerErrorException('Failed to create membership');
    }
  }

  async findAll() {
    return this.prisma.membership.findMany({
      include: { plan: true, member: true, payments: true },
    });
  }

  async findOne(id: number) {
    const membership = await this.prisma.membership.findUnique({
      where: { id },
      include: { plan: true, member: true, payments: true },
    });
    if (!membership) throw new BadRequestException('Membership not found');
    return membership;
  }

  async updateMembership(id: number, data: any) {
    // Optional: update startDate, endDate, status, planId, etc.
    const membership = await this.prisma.membership.findUnique({
      where: { id },
    });
    if (!membership) throw new BadRequestException('Membership not found');

    return this.prisma.membership.update({
      where: { id },
      data,
      include: { plan: true, member: true, payments: true },
    });
  }

  // ✅ Add payment and update membership
  async addPayment(
    id: number,
    data: {
      amount: number;
      discount?: number;
      method: keyof typeof PaymentMethod;
    },
  ) {
    const membership = await this.prisma.membership.findUnique({
      where: { id },
      include: { plan: true },
    });

    if (!membership) throw new BadRequestException('Membership not found');

    const additionalPaid = data.amount;
    const additionalDiscount = data.discount ?? 0;

    const newPaid = (membership.paid ?? 0) + additionalPaid;
    const newDiscount = (membership.discount ?? 0) + additionalDiscount;
    const newPending = membership.plan.price - (newPaid + newDiscount);

    let newStatus: MembershipStatus = MembershipStatus.INACTIVE;

    if (newPending <= 0) {
      newStatus = MembershipStatus.ACTIVE;
    } else if (newPending > 0 && newPaid > 0) {
      newStatus = MembershipStatus.INACTIVE;
    }

    // Update membership
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

    // Record new payment
    await this.prisma.payment.create({
      data: {
        membershipId: membership.id,
        amount: additionalPaid,
        paymentDate: new Date(),
        method: data.method,
      },
    });

    return {
      success: true,
      message: 'Payment added and membership updated successfully',
      data: updatedMembership,
    };
  }
}
