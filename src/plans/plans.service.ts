import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Plan, Prisma } from '@prisma/client';

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.PlanCreateInput): Promise<Plan> {
    return this.prisma.plan.create({ data });
  }

  async findAll(): Promise<Plan[]> {
    return this.prisma.plan.findMany({
      include: { memberships: true },
    });
  }

  async findOne(id: number): Promise<Plan | null> {
    return this.prisma.plan.findUnique({
      where: { id },
      include: { memberships: true },
    });
  }

  async update(id: number, data: Prisma.PlanUpdateInput): Promise<Plan> {
    return this.prisma.plan.update({
      where: { id },
      data,
    });
  }

  async remove(id: number): Promise<Plan> {
    return this.prisma.plan.delete({
      where: { id },
    });
  }
}
