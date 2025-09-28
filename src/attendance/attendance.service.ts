import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Attendance, Prisma } from '@prisma/client';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.AttendanceCreateInput): Promise<Attendance> {
    return this.prisma.attendance.create({ data });
  }

  async findAll(): Promise<Attendance[]> {
    return this.prisma.attendance.findMany({
      include: { member: true },
    });
  }

  async findOne(id: number): Promise<Attendance | null> {
    return this.prisma.attendance.findUnique({
      where: { id },
      include: { member: true },
    });
  }

  async update(
    id: number,
    data: Prisma.AttendanceUpdateInput,
  ): Promise<Attendance> {
    return this.prisma.attendance.update({
      where: { id },
      data,
    });
  }

  async remove(id: number): Promise<Attendance> {
    return this.prisma.attendance.delete({
      where: { id },
    });
  }
}
