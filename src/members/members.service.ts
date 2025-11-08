// src/members/members.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Member, MembershipStatus, Prisma } from '@prisma/client';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  // CREATE
  async create(data: CreateMemberDto, userId: number): Promise<Member> {
    const email = data.email ? data.email.toLowerCase().trim() : null;
    const phone = data.phone.trim();

    // Build OR conditions only for provided fields
    const orConditions: Prisma.MemberWhereInput['OR'] = [{ phone }];
    if (email) orConditions.push({ email });

    const existingMember = await this.prisma.member.findFirst({
      where: { userId, OR: orConditions },
      select: { id: true, email: true, phone: true },
    });

    if (existingMember) {
      if (email && existingMember.email === email) {
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

    return this.prisma.member.create({
      data: {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        phone,
        ...(email && { email }), // Only include if truthy
        address: data.address?.trim(),
        gender: data.gender?.trim(),
        referralSource: data.referralSource?.trim(),
        notes: data.notes?.trim(),
        user: { connect: { id: userId } },
      },
    });
  }

  // PAGINATED LIST
  async findAllPaginated(
    userId: number,
    query: {
      page?: number;
      limit?: number;
      id?: string;
      name?: string;
      email?: string;
      phone?: string;
      plan?: string;
      status?: string;
      sortBy?: string;
      sortOrder?: 'ASC' | 'DESC';
    },
  ): Promise<PaginatedResult<Member>> {
    const {
      page = 1,
      limit = 10,
      id,
      name,
      email,
      phone,
      plan,
      status,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const validSortFields = ['firstName', 'lastName', 'email', 'createdAt'];
    const field = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder.toLowerCase() as Prisma.SortOrder;

    const parsedStatus =
      status &&
      Object.values(MembershipStatus).includes(status as MembershipStatus)
        ? (status as MembershipStatus)
        : undefined;

    const where: Prisma.MemberWhereInput = {
      userId,
      ...(id && { id: Number(id) }),
      ...(name && {
        OR: [
          { firstName: { contains: name, mode: 'insensitive' } },
          { lastName: { contains: name, mode: 'insensitive' } },
        ],
      }),
      ...(email && { email: { contains: email, mode: 'insensitive' } }),
      ...(phone && { phone: { contains: phone, mode: 'insensitive' } }),
      ...(plan && {
        memberships: {
          some: { plan: { name: { contains: plan, mode: 'insensitive' } } },
        },
      }),
      ...(parsedStatus && {
        memberships: {
          some: { status: { equals: parsedStatus } },
        },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.member.findMany({
        where,
        include: {
          memberships: { include: { plan: true } },
          memberAddons: { include: { addon: true } },
        },
        orderBy: { [field]: order },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      this.prisma.member.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  // FIND ONE
  async findOne(id: number, userId: number): Promise<Member> {
    const member = await this.prisma.member.findFirst({
      where: { id, userId },
      include: {
        memberships: { include: { plan: true } },
        memberAddons: { include: { addon: true } },
      },
    });

    if (!member) throw new NotFoundException(`Member with ID ${id} not found.`);
    return member;
  }

  // UPDATE
  async update(
    id: number,
    userId: number,
    data: UpdateMemberDto,
  ): Promise<Member> {
    const existing = await this.prisma.member.findFirst({
      where: { id, userId },
    });
    if (!existing)
      throw new NotFoundException(`Member with ID ${id} not found.`);

    // Normalize values only if provided
    const updateEmail =
      data.email !== undefined ? data.email.toLowerCase().trim() : null;
    const updatePhone = data.phone?.trim();

    const isUpdatingEmail = data.email !== undefined;
    const isUpdatingPhone = data.phone !== undefined;

    // Only run conflict check if at least one field is being updated
    if (isUpdatingEmail || isUpdatingPhone) {
      const orConditions: Prisma.MemberWhereInput['OR'] = [];

      if (isUpdatingEmail && updateEmail !== null && updateEmail !== '') {
        orConditions.push({ email: updateEmail });
      }
      if (isUpdatingPhone && updatePhone) {
        orConditions.push({ phone: updatePhone });
      }

      if (orConditions.length > 0) {
        const conflicting = await this.prisma.member.findFirst({
          where: { userId, id: { not: id }, OR: orConditions },
        });

        if (conflicting) {
          if (
            isUpdatingEmail &&
            updateEmail !== null &&
            conflicting.email === updateEmail
          ) {
            throw new BadRequestException(
              'Another member already uses this email.',
            );
          }
          if (isUpdatingPhone && conflicting.phone === updatePhone) {
            throw new BadRequestException(
              'Another member already uses this phone number.',
            );
          }
        }
      }
    }

    const cleanData: Prisma.MemberUpdateInput = {
      ...(data.firstName && { firstName: data.firstName.trim() }),
      ...(data.lastName && { lastName: data.lastName.trim() }),
      ...(isUpdatingEmail &&
        updateEmail !== null &&
        updateEmail !== '' && { email: updateEmail }),
      ...(isUpdatingPhone && updatePhone && { phone: updatePhone }),
      ...(data.address !== undefined && { address: data.address?.trim() }),
      ...(data.gender !== undefined && { gender: data.gender?.trim() }),
      ...(data.referralSource !== undefined && {
        referralSource: data.referralSource?.trim(),
      }),
      ...(data.notes !== undefined && { notes: data.notes?.trim() }),
      // @updatedAt in schema → no need to set manually
    };

    return this.prisma.member.update({
      where: { id },
      data: cleanData,
      include: {
        memberships: { include: { plan: true } },
        memberAddons: { include: { addon: true } },
      },
    });
  }

  // DELETE
  async remove(id: number, userId: number): Promise<Member> {
    const existing = await this.prisma.member.findFirst({
      where: { id, userId },
    });
    if (!existing)
      throw new NotFoundException(`Member with ID ${id} not found.`);

    return this.prisma.member.delete({ where: { id } });
  }

  // RECENT MEMBERS
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
