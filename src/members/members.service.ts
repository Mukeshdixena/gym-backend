import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Member, Prisma } from '@prisma/client';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateMemberDto, userId: number): Promise<Member> {
    const cleanData: Prisma.MemberCreateInput = {
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: data.email.toLowerCase().trim(),
      phone: data.phone.trim(),
      address: data.address?.trim(),
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      user: { connect: { id: userId } }, // ✅ link record to user
    };

    return this.prisma.member.create({ data: cleanData });
  }

  async findAll(userId: number): Promise<Member[]> {
    return this.prisma.member.findMany({
      where: { userId }, // ✅ filter by user
      orderBy: { createdAt: 'desc' },
      include: {
        memberships: true,
        attendances: true,
        classes: true,
      },
    });
  }

  async findOne(id: number, userId: number): Promise<Member> {
    const member = await this.prisma.member.findFirst({
      where: { id, userId }, // ✅ ensure record belongs to user
      include: {
        memberships: true,
        attendances: true,
        classes: true,
      },
    });

    if (!member)
      throw new NotFoundException(`Member with ID ${id} not found for user`);
    return member;
  }

  async update(
    id: number,
    userId: number,
    data: UpdateMemberDto,
  ): Promise<Member> {
    const existing = await this.prisma.member.findFirst({
      where: { id, userId },
    });
    if (!existing)
      throw new NotFoundException(`Member with ID ${id} not found for user`);

    const cleanData: Prisma.MemberUpdateInput = {
      ...data,
      firstName: data.firstName?.trim(),
      lastName: data.lastName?.trim(),
      email: data.email?.toLowerCase().trim(),
      phone: data.phone?.trim(),
      address: data.address?.trim(),
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      updatedAt: new Date(),
    };

    return this.prisma.member.update({
      where: { id },
      data: cleanData,
    });
  }

  async remove(id: number, userId: number): Promise<Member> {
    const existing = await this.prisma.member.findFirst({
      where: { id, userId },
    });
    if (!existing)
      throw new NotFoundException(`Member with ID ${id} not found for user`);

    return this.prisma.member.delete({ where: { id } });
  }
}
