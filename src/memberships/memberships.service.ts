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
            method: data.method ?? PaymentMethod.CASH,
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

  async addPayment(
    id: number,
    data: {
      amount?: number;
      discount?: number;
      method?: keyof typeof PaymentMethod;
      status?: keyof typeof MembershipStatus;
    },
  ) {
    const membership = await this.prisma.membership.findUnique({
      where: { id },
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
}
