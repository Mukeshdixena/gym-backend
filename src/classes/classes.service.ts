import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Class, Prisma } from '@prisma/client';

@Injectable()
export class ClassesService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.ClassCreateInput, userId: number): Promise<Class> {
    return this.prisma.class.create({
      data: {
        ...data,
        user: { connect: { id: userId } },
      },
    });
  }

  async findAll(userId: number): Promise<Class[]> {
    return this.prisma.class.findMany({
      where: { userId },
      include: { trainer: true, members: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, userId: number): Promise<Class> {
    const classItem = await this.prisma.class.findUnique({
      where: { id },
      include: { trainer: true, members: true },
    });

    if (!classItem)
      throw new NotFoundException(`Class with ID ${id} not found`);
    if (classItem.userId !== userId)
      throw new ForbiddenException('Access denied');

    return classItem;
  }

  async update(
    id: number,
    data: Prisma.ClassUpdateInput,
    userId: number,
  ): Promise<Class> {
    const classItem = await this.prisma.class.findUnique({ where: { id } });
    if (!classItem)
      throw new NotFoundException(`Class with ID ${id} not found`);
    if (classItem.userId !== userId)
      throw new ForbiddenException('Access denied');

    return this.prisma.class.update({
      where: { id },
      data,
    });
  }

  async remove(id: number, userId: number): Promise<Class> {
    const classItem = await this.prisma.class.findUnique({ where: { id } });
    if (!classItem)
      throw new NotFoundException(`Class with ID ${id} not found`);
    if (classItem.userId !== userId)
      throw new ForbiddenException('Access denied');

    return this.prisma.class.delete({
      where: { id },
    });
  }
}
