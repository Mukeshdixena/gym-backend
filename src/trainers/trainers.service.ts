import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Trainer, Prisma } from '@prisma/client';

@Injectable()
export class TrainersService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.TrainerCreateInput): Promise<Trainer> {
    return this.prisma.trainer.create({ data });
  }

  async findAll(): Promise<Trainer[]> {
    return this.prisma.trainer.findMany({
      include: { classes: true },
    });
  }

  async findOne(id: number): Promise<Trainer | null> {
    return this.prisma.trainer.findUnique({
      where: { id },
      include: { classes: true },
    });
  }

  async update(id: number, data: Prisma.TrainerUpdateInput): Promise<Trainer> {
    return this.prisma.trainer.update({
      where: { id },
      data,
    });
  }

  async remove(id: number): Promise<Trainer> {
    return this.prisma.trainer.delete({
      where: { id },
    });
  }
}
