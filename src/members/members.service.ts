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
// import { PaginatedDto } from '../common/dto/paginated.dto';

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
    const email = data.email.toLowerCase().trim();
    const phone = data.phone.trim();

    const existingMember = await this.prisma.member.findFirst({
      where: { userId, OR: [{ email }, { phone }] },
      select: { id: true, email: true, phone: true },
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

    return this.prisma.member.create({
      data: {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email,
        phone,
        address: data.address?.trim(),
        gender: data.gender?.trim(),
        referralSource: data.referralSource?.trim(),
        notes: data.notes?.trim(),
        user: { connect: { id: userId } },
      },
    });
  }

  // PAGINATED LIST
  // import { Prisma, MembershipStatus } from '@prisma/client';

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

      // ✅ Use parsedStatus enum, not plain string
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

    const updateEmail = data.email?.toLowerCase().trim();
    const updatePhone = data.phone?.trim();

    if (updateEmail || updatePhone) {
      const orConditions: Prisma.MemberWhereInput['OR'] = [];
      if (updateEmail) orConditions.push({ email: updateEmail });
      if (updatePhone) orConditions.push({ phone: updatePhone });

      const conflicting = await this.prisma.member.findFirst({
        where: { userId, id: { not: id }, OR: orConditions },
      });

      if (conflicting) {
        if (updateEmail && conflicting.email === updateEmail) {
          throw new BadRequestException(
            'Another member already uses this email.',
          );
        }
        if (updatePhone && conflicting.phone === updatePhone) {
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
      ...(data.gender !== undefined && { gender: data.gender?.trim() }),
      ...(data.referralSource !== undefined && {
        referralSource: data.referralSource?.trim(),
      }),
      ...(data.notes !== undefined && { notes: data.notes?.trim() }),
      updatedAt: new Date(),
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
