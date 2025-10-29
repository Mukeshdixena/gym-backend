import { Injectable } from '@nestjs/common';
// import { PrismaService } from '../prisma.service';
import { PrismaService } from '../prisma/prisma.service';

import { subMonths, startOfMonth, endOfMonth } from 'date-fns';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getDashboardData(userId: number) {
    const [
      members,
      trainers,
      activeMemberships,
      expiredMemberships,
      payments,
      totalClasses,
    ] = await Promise.all([
      this.prisma.member.count({ where: { userId } }),
      this.prisma.trainer.count({ where: { userId } }),
      this.prisma.membership.count({
        where: { userId, status: 'ACTIVE' },
      }),
      this.prisma.membership.count({
        where: { userId, status: 'EXPIRED' },
      }),
      this.prisma.payment.findMany({
        where: { userId },
        select: { amount: true, paymentDate: true },
      }),
      this.prisma.class.count({ where: { userId } }),
    ]);

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

    // Compute revenue by month (last 6 months)
    const monthlyRevenue = [];
    for (let i = 5; i >= 0; i--) {
      const start = startOfMonth(subMonths(new Date(), i));
      const end = endOfMonth(subMonths(new Date(), i));
      const revenue = payments
        .filter((p) => p.paymentDate >= start && p.paymentDate <= end)
        .reduce((sum, p) => sum + p.amount, 0);
      monthlyRevenue.push({
        month: start.toLocaleString('default', { month: 'short' }),
        revenue,
      });
    }

    // Today’s attendance count
    const today = new Date();
    const todayStart = new Date(today.setHours(0, 0, 0, 0));
    const todayEnd = new Date(today.setHours(23, 59, 59, 999));

    const todayAttendance = await this.prisma.attendance.count({
      where: {
        userId,
        date: { gte: todayStart, lte: todayEnd },
        status: 'PRESENT',
      },
    });

    return {
      members,
      trainers,
      activeMemberships,
      expiredMemberships,
      totalRevenue,
      totalClasses,
      monthlyRevenue,
      todayAttendance,
    };
  }
}
