import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Trainer, Prisma } from '@prisma/client';
import { PaginatedDto } from '../common/dto/paginated.dto';
import { CreateTrainerDto } from './dto/create-trainer.dto';
import { UpdateTrainerDto } from './dto/update-trainer.dto';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface TrainerQueryParams {
  speciality?: string;
  minSalary?: number;
  maxSalary?: number;
  joiningDateFrom?: string;
  joiningDateTo?: string;
}

@Injectable()
export class TrainersService {
  constructor(private prisma: PrismaService) {}

  // CREATE
  async create(data: CreateTrainerDto, userId: number): Promise<Trainer> {
    const trainerData: Prisma.TrainerCreateInput = {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      user: { connect: { id: userId } },
      ...(data.email !== undefined && { email: data.email }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.salary !== undefined && { salary: data.salary }),
      ...(data.speciality !== undefined && { speciality: data.speciality }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.joiningDate !== undefined && {
        joiningDate: new Date(data.joiningDate),
      }),
    };

    return this.prisma.trainer.create({ data: trainerData });
  }

  // PAGINATED LIST
  async findAllPaginated(
    userId: number,
    query: PaginatedDto & TrainerQueryParams,
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

    // FIX: Use lowercase 'asc' | 'desc' for Prisma
    const order = sortOrder.toLowerCase() as Prisma.SortOrder;

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
      ...(minSalary !== undefined && { salary: { gte: minSalary } }),
      ...(maxSalary !== undefined && { salary: { lte: maxSalary } }),
      ...((joiningDateFrom || joiningDateTo) && {
        joiningDate: {
          ...(joiningDateFrom && { gte: new Date(joiningDateFrom) }),
          ...(joiningDateTo && { lte: new Date(joiningDateTo) }),
        },
      }),
    };

    const [records, total] = await this.prisma.$transaction([
      this.prisma.trainer.findMany({
        where,
        include: {
          _count: { select: { memberAddons: true } },
        },
        orderBy: { [field]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.trainer.count({ where }),
    ]);

    return {
      data: records.map((t) => ({
        ...t,
        memberAddonsCount: t._count.memberAddons,
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
    const trainer = await this.prisma.trainer.findUnique({ where: { id } });
    if (!trainer)
      throw new NotFoundException(`Trainer with ID ${id} not found`);
    if (trainer.userId !== userId)
      throw new ForbiddenException('Access denied');
    return trainer;
  }

  // UPDATE
  async update(
    id: number,
    data: UpdateTrainerDto,
    userId: number,
  ): Promise<Trainer> {
    const trainer = await this.prisma.trainer.findUnique({ where: { id } });
    if (!trainer)
      throw new NotFoundException(`Trainer with ID ${id} not found`);
    if (trainer.userId !== userId)
      throw new ForbiddenException('Access denied');

    const updateData: Prisma.TrainerUpdateInput = {
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.salary !== undefined && { salary: data.salary }),
      ...(data.speciality !== undefined && { speciality: data.speciality }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.joiningDate !== undefined && {
        joiningDate: new Date(data.joiningDate),
      }),
      updatedAt: new Date(),
    };

    return this.prisma.trainer.update({ where: { id }, data: updateData });
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
