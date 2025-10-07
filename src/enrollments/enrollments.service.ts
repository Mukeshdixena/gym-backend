import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createEnrollment(dto: CreateEnrollmentDto) {
    let memberId: number;

    if (!dto.selectedMember) {
      const member = await this.prisma.member.create({
        data: {
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
}
