import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Class, Prisma } from '@prisma/client';

@Injectable()
export class ClassesService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.ClassCreateInput): Promise<Class> {
    return this.prisma.class.create({ data });
  }

  async findAll(): Promise<Class[]> {
    return this.prisma.class.findMany({
      include: { trainer: true, members: true },
    });
  }

  async findOne(id: number): Promise<Class | null> {
    return this.prisma.class.findUnique({
      where: { id },
      include: { trainer: true, members: true },
    });
  }

  async update(id: number, data: Prisma.ClassUpdateInput): Promise<Class> {
    return this.prisma.class.update({
      where: { id },
      data,
    });
  }

  async remove(id: number): Promise<Class> {
    return this.prisma.class.delete({
      where: { id },
    });
  }
}
