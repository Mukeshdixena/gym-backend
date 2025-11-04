// src/members/members.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Member, Prisma } from '@prisma/client';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { PaginatedDto } from '../common/dto/paginated.dto';

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
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        user: { connect: { id: userId } },
      },
    });
  }

  // PAGINATED LIST
  async findAllPaginated(
    userId: number,
    query: PaginatedDto,
  ): Promise<PaginatedResult<Member>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const validSortFields = ['firstName', 'lastName', 'email', 'createdAt'];
    const field = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder.toLowerCase() as Prisma.SortOrder;

    const where: Prisma.MemberWhereInput = {
      userId,
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.member.findMany({
        where,
        include: {
          memberships: { include: { plan: true } },
          attendances: true,
          classes: true,
        },
        orderBy: { [field]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.member.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // FIND ONE
  async findOne(id: number, userId: number): Promise<Member> {
    const member = await this.prisma.member.findFirst({
      where: { id, userId },
      include: {
        memberships: { include: { plan: true } },
        attendances: true,
        classes: true,
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
      ...(data.dateOfBirth && { dateOfBirth: new Date(data.dateOfBirth) }),
      updatedAt: new Date(),
    };

    return this.prisma.member.update({
      where: { id },
      data: cleanData,
      include: {
        memberships: { include: { plan: true } },
        attendances: true,
        classes: true,
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
