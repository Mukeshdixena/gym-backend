import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Member, Prisma } from '@prisma/client';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateMemberDto, userId: number): Promise<Member> {
    const email = data.email.toLowerCase().trim();
    const phone = data.phone.trim();

    // Check for existing email OR phone under the same user
    const existingMember = await this.prisma.member.findFirst({
      where: {
        userId,
        OR: [{ email }, { phone }],
      },
      select: { id: true, email: true, phone: true }, // Minimal data
    });

    if (existingMember) {
      if (existingMember.email === email) {
        throw new BadRequestException(
          'A member with this email already exists.',
        );
      }
      if (existingMember.phone === phone) {
        throw new BadRequestException(
          'A member with this phone number already exists.',
        );
      }
    }

    const cleanData: Prisma.MemberCreateInput = {
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email,
      phone,
      address: data.address?.trim(),
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      user: { connect: { id: userId } },
    };

    return this.prisma.member.create({ data: cleanData });
  }

  async findAll(userId: number): Promise<Member[]> {
    return this.prisma.member.findMany({
      where: { userId },
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
      where: { id, userId },
      include: {
        memberships: true,
        attendances: true,
        classes: true,
      },
    });

    if (!member) {
      throw new NotFoundException(`Member with ID ${id} not found.`);
    }
    return member;
  }

  async update(
    id: number,
    userId: number,
    data: UpdateMemberDto,
  ): Promise<Member> {
    const existing = await this.prisma.member.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(`Member with ID ${id} not found.`);
    }

    const updateEmail = data.email
      ? data.email.toLowerCase().trim()
      : undefined;
    const updatePhone = data.phone ? data.phone.trim() : undefined;

    if (updateEmail || updatePhone) {
      const orConditions: Prisma.MemberWhereInput['OR'] = [];

      if (updateEmail) orConditions.push({ email: updateEmail });
      if (updatePhone) orConditions.push({ phone: updatePhone });

      const conflictingMember = await this.prisma.member.findFirst({
        where: {
          userId,
          id: { not: id },
          OR: orConditions,
        },
        select: { email: true, phone: true },
      });

      if (conflictingMember) {
        if (updateEmail && conflictingMember.email === updateEmail) {
          throw new BadRequestException(
            'Another member already uses this email.',
          );
        }
        if (updatePhone && conflictingMember.phone === updatePhone) {
          throw new BadRequestException(
            'Another member already uses this phone number.',
          );
        }
      }
    }

    const cleanData: Prisma.MemberUpdateInput = {
      ...(data.firstName && { firstName: data.firstName.trim() }),
      ...(data.lastName && { lastName: data.lastName.trim() }),
      ...(updateEmail && { email: updateEmail }),
      ...(updatePhone && { phone: updatePhone }),
      ...(data.address !== undefined && { address: data.address?.trim() }),
      ...(data.dateOfBirth && { dateOfBirth: new Date(data.dateOfBirth) }),
      updatedAt: new Date(),
    };

    return this.prisma.member.update({
      where: { id },
      data: cleanData,
      include: {
        memberships: true,
        attendances: true,
        classes: true,
      },
    });
  }

  async remove(id: number, userId: number): Promise<Member> {
    const existing = await this.prisma.member.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(`Member with ID ${id} not found.`);
    }

    return this.prisma.member.delete({
      where: { id },
    });
  }

  async getRecentMembers(
    userId: number,
  ): Promise<Array<Member & { planName: string | null }>> {
    const members = await this.prisma.member.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        memberships: {
          include: { plan: { select: { name: true } } },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return members.map((m) => ({
      ...m,
      planName: m.memberships[0]?.plan?.name ?? null,
    }));
  }
}
