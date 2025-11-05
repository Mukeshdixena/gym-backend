// src/trainers/trainers.service.ts
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Trainer, Prisma } from '@prisma/client';
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
export class TrainersService {
  constructor(private prisma: PrismaService) {}

  // CREATE
  async create(data: any, userId: number): Promise<Trainer> {
    return this.prisma.trainer.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        salary: data.salary,
        speciality: data.speciality,
        notes: data.notes,
        joiningDate: data.joiningDate ? new Date(data.joiningDate) : null,
        user: { connect: { id: userId } },
      },
    });
  }

  // PAGINATED LIST
  async findAllPaginated(
    userId: number,
    query: PaginatedDto & {
      speciality?: string;
      minSalary?: number;
      maxSalary?: number;
      joiningDateFrom?: string;
      joiningDateTo?: string;
    },
  ): Promise<PaginatedResult<any>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      speciality,
      minSalary,
      maxSalary,
      joiningDateFrom,
      joiningDateTo,
    } = query;

    // ✅ Allow sorting by new fields
    const validSortFields = [
      'firstName',
      'lastName',
      'email',
      'salary',
      'speciality',
      'joiningDate',
      'createdAt',
    ];
    const field = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder.toLowerCase() as Prisma.SortOrder;

    // ✅ Dynamic filters
    const where: Prisma.TrainerWhereInput = {
      userId,
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { speciality: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(speciality && {
        speciality: { contains: speciality, mode: 'insensitive' },
      }),
      ...(minSalary && { salary: { gte: minSalary } }),
      ...(maxSalary && { salary: { lte: maxSalary } }),
      ...(joiningDateFrom || joiningDateTo
        ? {
            joiningDate: {
              ...(joiningDateFrom && { gte: new Date(joiningDateFrom) }),
              ...(joiningDateTo && { lte: new Date(joiningDateTo) }),
            },
          }
        : {}),
    };

    // ✅ Fetch paginated data with memberAddons count
    const [data, total] = await this.prisma.$transaction([
      this.prisma.trainer.findMany({
        where,
        include: {
          _count: {
            select: { memberAddons: true },
          },
        },
        orderBy: { [field]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.trainer.count({ where }),
    ]);

    // ✅ Return structured paginated response
    return {
      data: data.map((trainer) => ({
        ...trainer,
        memberAddonsCount: trainer._count.memberAddons,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // FIND ONE
  async findOne(id: number, userId: number): Promise<Trainer> {
    const trainer = await this.prisma.trainer.findUnique({
      where: { id },
      // include: { classes: true },
    });
    if (!trainer)
      throw new NotFoundException(`Trainer with ID ${id} not found`);
    if (trainer.userId !== userId)
      throw new ForbiddenException('Access denied');
    return trainer;
  }

  // UPDATE
  async update(
    id: number,
    data: Prisma.TrainerUpdateInput,
    userId: number,
  ): Promise<Trainer> {
    const trainer = await this.prisma.trainer.findUnique({ where: { id } });
    if (!trainer)
      throw new NotFoundException(`Trainer with ID ${id} not found`);
    if (trainer.userId !== userId)
      throw new ForbiddenException('Access denied');

    return this.prisma.trainer.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
  }

  // DELETE
  async remove(id: number, userId: number): Promise<Trainer> {
    const trainer = await this.prisma.trainer.findUnique({ where: { id } });
    if (!trainer)
      throw new NotFoundException(`Trainer with ID ${id} not found`);
    if (trainer.userId !== userId)
      throw new ForbiddenException('Access denied');

    return this.prisma.trainer.delete({ where: { id } });
  }
}
