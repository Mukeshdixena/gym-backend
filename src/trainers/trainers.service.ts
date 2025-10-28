import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Trainer, Prisma } from '@prisma/client';

@Injectable()
export class TrainersService {
  constructor(private prisma: PrismaService) {}

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

  async findAll(userId: number): Promise<Trainer[]> {
    return this.prisma.trainer.findMany({
      where: { userId },
      include: { classes: true },
      orderBy: { createdAt: 'desc' },
    });
  }

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
      data,
    });
  }

  async remove(id: number, userId: number): Promise<Trainer> {
    const trainer = await this.prisma.trainer.findUnique({ where: { id } });
    if (!trainer)
      throw new NotFoundException(`Trainer with ID ${id} not found`);
    if (trainer.userId !== userId)
      throw new ForbiddenException('Access denied');

    return this.prisma.trainer.delete({
      where: { id },
    });
  }
}
