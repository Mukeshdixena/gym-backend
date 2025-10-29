import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createEnrollment(dto: CreateEnrollmentDto, userId: number) {
    let memberId: number;

    if (!dto.selectedMember) {
      const member = await this.prisma.member.create({
        data: {
          userId,
          firstName: dto.firstName ?? '',
          lastName: dto.lastName ?? '',
          email: dto.email ?? '',
          phone: dto.phone ?? '',
          address: dto.address ?? '',
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        },
      });
      memberId = member.id;
    } else {
      memberId = dto.selectedMember;
    }

    const membership = await this.prisma.membership.create({
      data: {
        userId,
        memberId,
        planId: dto.planId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: 'ACTIVE',
      },
    });

    if (dto.paid && dto.paid > 0) {
      await this.prisma.payment.create({
        data: {
          userId,
          membershipId: membership.id,
          amount: dto.paid,
          method: 'CASH',
        },
      });
    }

    return {
      message: 'Enrollment created successfully',
      membershipId: membership.id,
      memberId,
    };
  }

  async getPendingBills(userId: number) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { member: true, plan: true, payments: true },
    });

    return memberships.map((m) => {
      const totalPaid = m.payments.reduce((sum, p) => sum + p.amount, 0);
      const pendingAmount = Math.max(m.plan.price - totalPaid, 0);

      return {
        id: m.id,
        name: `${m.member.firstName} ${m.member.lastName}`,
        plan: m.plan.name,
        amount: m.plan.price,
        paid: totalPaid,
        pending: pendingAmount,
        startDate: m.startDate,
        endDate: m.endDate,
      };
    });
  }

  async getApprovedBills(userId: number) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: { member: true, plan: true, payments: true },
    });

    return memberships
      .filter((m) => {
        const totalPaid = m.payments.reduce((sum, p) => sum + p.amount, 0);
        return totalPaid >= m.plan.price;
      })
      .map((m) => {
        const totalPaid = m.payments.reduce((sum, p) => sum + p.amount, 0);
        return {
          id: m.id,
          name: `${m.member.firstName} ${m.member.lastName}`,
          plan: m.plan.name,
          amount: m.plan.price,
          paid: totalPaid,
          pending: 0,
          date: m.updatedAt.toLocaleDateString(),
        };
      });
  }

  async approveBill(membershipId: number, userId: number) {
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
      include: { plan: true, payments: true },
    });

    if (!membership || membership.userId !== userId) {
      throw new Error('Membership not found or unauthorized');
    }

    const totalPaid = membership.payments.reduce((sum, p) => sum + p.amount, 0);
    if (totalPaid < membership.plan.price) {
      throw new Error('Cannot approve: pending amount exists');
    }

    await this.prisma.membership.update({
      where: { id: membershipId },
      data: { status: 'ACTIVE' },
    });

    return { message: 'Bill approved successfully' };
  }

  async rejectBill(membershipId: number, userId: number) {
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
    });

    if (!membership || membership.userId !== userId) {
      throw new Error('Membership not found or unauthorized');
    }

    await this.prisma.membership.update({
      where: { id: membershipId },
      data: { status: 'CANCELLED' },
    });

    return { message: 'Bill rejected successfully' };
  }
}
