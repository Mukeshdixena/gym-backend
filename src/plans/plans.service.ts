import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Plan, Prisma } from '@prisma/client';

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.PlanCreateInput, userId: number): Promise<Plan> {
    return this.prisma.plan.create({
      data: {
        ...data,
        user: { connect: { id: userId } }, // assumes Plan has userId foreign key
      },
    });
  }

  async findAll(userId: number): Promise<Plan[]> {
    return this.prisma.plan.findMany({
      where: { userId },
      include: { memberships: true },
    });
  }

  async findOne(id: number, userId: number): Promise<Plan | null> {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: { memberships: true },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    if (plan.userId !== userId) throw new ForbiddenException('Access denied');
    return plan;
  }

  async update(
    id: number,
    data: Prisma.PlanUpdateInput,
    userId: number,
  ): Promise<Plan> {
    const existing = await this.prisma.plan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Plan not found');
    if (existing.userId !== userId)
      throw new ForbiddenException('Access denied');

    return this.prisma.plan.update({
      where: { id },
      data,
    });
  }

  async remove(id: number, userId: number): Promise<Plan> {
    const existing = await this.prisma.plan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Plan not found');
    if (existing.userId !== userId)
      throw new ForbiddenException('Access denied');

    return this.prisma.plan.delete({
      where: { id },
    });
  }
}
