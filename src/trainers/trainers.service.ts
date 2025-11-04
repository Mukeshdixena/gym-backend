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
  async create(
    data: Prisma.TrainerCreateInput,
    userId: number,
  ): Promise<Trainer> {
    return this.prisma.trainer.create({
      data: {
        ...data,
        user: { connect: { id: userId } },
      },
    });
  }

  // PAGINATED LIST
  async findAllPaginated(
    userId: number,
    query: PaginatedDto,
  ): Promise<PaginatedResult<Trainer>> {
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

    const where: Prisma.TrainerWhereInput = {
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
      this.prisma.trainer.findMany({
        where,
        include: { classes: true },
        orderBy: { [field]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.trainer.count({ where }),
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
  async findOne(id: number, userId: number): Promise<Trainer> {
    const trainer = await this.prisma.trainer.findUnique({
      where: { id },
      include: { classes: true },
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
