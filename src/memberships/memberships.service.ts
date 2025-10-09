import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { MembershipStatus, Prisma } from '@prisma/client';

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

      const pending = plan.price - (data.paid + data.discount);

      const membership = await this.prisma.membership.create({
        data: {
          member: { connect: { id: data.memberId } },
          plan: { connect: { id: data.planId } },
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          status:
            pending <= 0 ? MembershipStatus.ACTIVE : MembershipStatus.INACTIVE,
          paid: data.paid,
          discount: data.discount,
          pending,
        },
        include: {
          plan: true,
          member: true,
        },
      });

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
      include: { plan: true, member: true },
    });
  }

  async findOne(id: number) {
    const membership = await this.prisma.membership.findUnique({
      where: { id },
      include: { plan: true, member: true },
    });
    if (!membership) throw new BadRequestException('Membership not found');
    return membership;
  }
}
