import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new enrollment (member + membership + optional payment)
   */
  async createEnrollment(dto: CreateEnrollmentDto, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      let memberId: number;

      // ✅ Create a new member if not selected
      if (!dto.selectedMember) {
        const member = await tx.member.create({
          data: {
            userId,
            firstName: dto.firstName?.trim() ?? '',
            lastName: dto.lastName?.trim() ?? '',
            email: dto.email?.trim() ?? '',
            phone: dto.phone?.trim() ?? '',
            address: dto.address?.trim() ?? '',
            gender: dto.gender ?? null,
            referralSource: dto.referralSource?.trim() ?? null,
            notes: dto.notes?.trim() ?? null,
          },
        });
        memberId = member.id;
      } else {
        memberId = dto.selectedMember;
      }

      // ✅ Create membership
      const membership = await tx.membership.create({
        data: {
          userId,
          memberId,
          planId: dto.planId,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // ✅ Create initial payment if provided
      if (dto.paid && dto.paid > 0) {
        await tx.payment.create({
          data: {
            userId,
            membershipId: membership.id,
            amount: dto.paid,
            method: 'CASH',
            createdAt: new Date(),
          },
        });
      }

      return {
        success: true,
        message: 'Enrollment created successfully',
        membershipId: membership.id,
        memberId,
      };
    });
  }

  /**
   * Get all memberships with pending payments
   */
  async getPendingBills(userId: number) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: {
        member: true,
        plan: true,
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
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
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      };
    });
  }

  /**
   * Get all approved (fully paid) memberships
   */
  async getApprovedBills(userId: number) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { member: true, plan: true, payments: true },
      orderBy: { updatedAt: 'desc' },
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
          approvedOn: m.updatedAt,
        };
      });
  }

  /**
   * Approve a fully paid bill
   */
  async approveBill(membershipId: number, userId: number) {
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
      include: { plan: true, payments: true },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    if (membership.userId !== userId) {
      throw new ForbiddenException(
        'You are not authorized to approve this membership',
      );
    }

    const totalPaid = membership.payments.reduce((sum, p) => sum + p.amount, 0);
    if (totalPaid < membership.plan.price) {
      throw new BadRequestException('Cannot approve: pending amount exists');
    }

    await this.prisma.membership.update({
      where: { id: membershipId },
      data: {
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
    });

    return { success: true, message: 'Bill approved successfully' };
  }

  /**
   * Reject a membership bill
   */
  async rejectBill(membershipId: number, userId: number) {
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    if (membership.userId !== userId) {
      throw new ForbiddenException(
        'You are not authorized to reject this membership',
      );
    }

    await this.prisma.membership.update({
      where: { id: membershipId },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date(),
      },
    });

    return { success: true, message: 'Bill rejected successfully' };
  }
}
