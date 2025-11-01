import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminUsersService {
  constructor(private prisma: PrismaService) {}

  async listPending() {
    return this.prisma.user.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(id: number) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { status: 'APPROVED' },
    });
    return { message: `${user.name} has been approved.` };
  }

  async reject(id: number) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { status: 'REJECTED' },
    });
    return { message: `${user.name} has been rejected.` };
  }
}
