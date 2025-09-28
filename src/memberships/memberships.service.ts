import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Membership, Prisma } from '@prisma/client';

@Injectable()
export class MembershipsService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.MembershipCreateInput): Promise<Membership> {
    return this.prisma.membership.create({ data });
  }

  async findAll(): Promise<Membership[]> {
    return this.prisma.membership.findMany({
      include: { member: true, plan: true, payments: true },
    });
  }

  async findOne(id: number): Promise<Membership | null> {
    return this.prisma.membership.findUnique({
      where: { id },
      include: { member: true, plan: true, payments: true },
    });
  }

  async update(
    id: number,
    data: Prisma.MembershipUpdateInput,
  ): Promise<Membership> {
    return this.prisma.membership.update({
      where: { id },
      data,
    });
  }

  async remove(id: number): Promise<Membership> {
    return this.prisma.membership.delete({
      where: { id },
    });
  }
}
