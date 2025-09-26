import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Member } from '@prisma/client';

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.MemberCreateInput): Promise<Member> {
    return this.prisma.member.create({ data });
  }

  async findAll(): Promise<Member[]> {
    return this.prisma.member.findMany({
      include: { memberships: true },
    });
  }

  async findOne(id: number): Promise<Member | null> {
    return this.prisma.member.findUnique({
      where: { id },
      include: { memberships: true },
    });
  }
}
