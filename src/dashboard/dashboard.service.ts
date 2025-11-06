// src/dashboard/dashboard.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipStatus } from '@prisma/client';

interface PendingDuesRow {
  total: string | number | null; // raw query returns string in some drivers
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  /**
   * Return a Date at 00:00:00.000 in UTC for "today" (start of day)
   */
  private getTodayUtcStart(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
  }

  /**
   * Return the start of the current month in UTC
   */
  private getStartOfMonthUtc(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
    );
  }

  /**
   * Return the start-of-month for `months` months ago (used for member growth)
   * For example months = 6 will return first day of month 5 months ago so we get 6 months range.
   */
  private getStartOfMonthsAgoUtc(months: number): Date {
    const now = new Date();
    const target = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
    );
    target.setUTCMonth(target.getUTCMonth() - months + 1);
    return target;
  }

  /* ──────────────────────── SUMMARY ──────────────────────── */
  async getSummary(userId: number) {
    try {
      const today = this.getTodayUtcStart();
      const startOfMonth = this.getStartOfMonthUtc();

      const [
        totalMembers,
        activeMembers,
        newMembersToday,
        revenueToday,
        revenueThisMonth,
        pendingDuesRaw,
        upcomingRenewals,
        activeTrainers,
      ] = await Promise.all([
        this.prisma.member.count({ where: { userId } }),
        this.prisma.membership.count({
          where: { userId, status: MembershipStatus.ACTIVE },
        }),
        this.prisma.member.count({
          where: { userId, createdAt: { gte: today } },
        }),
        this.prisma.payment.aggregate({
          where: { userId, paymentDate: { gte: today } },
          _sum: { amount: true },
        }),
        this.prisma.payment.aggregate({
          where: { userId, paymentDate: { gte: startOfMonth } },
          _sum: { amount: true },
        }),
        // parameterized raw query - safe binding via template tag
        this.prisma.$queryRaw<PendingDuesRow[]>`
          SELECT COALESCE(SUM(total_pending), 0)::numeric AS total
          FROM (
            SELECT pending AS total_pending FROM "Membership" WHERE "userId" = ${userId} AND pending > 0
            UNION ALL
            SELECT ma.pending AS total_pending
            FROM "MemberAddon" ma
            JOIN "Member" m ON ma."memberId" = m.id
            WHERE m."userId" = ${userId} AND ma.pending > 0
          ) AS dues
        `,
        this.prisma.membership.count({
          where: {
            userId,
            status: MembershipStatus.ACTIVE,
            endDate: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
          },
        }),
        this.prisma.trainer.count({ where: { userId } }),
      ]);

      const pendingDues = Number(pendingDuesRaw?.[0]?.total ?? 0) || 0;

      return {
        totalMembers,
        activeMembers,
        newMembersToday,
        revenueToday: revenueToday?._sum?.amount ?? 0,
        revenueThisMonth: revenueThisMonth?._sum?.amount ?? 0,
        pendingDues,
        upcomingRenewals,
        activeTrainers,
      };
    } catch (err) {
      // throw a typed error so the controller can convert to 500
      throw new InternalServerErrorException(
        'Failed to compute dashboard summary',
      );
    }
  }

  /* ──────────────────────── ALERTS ──────────────────────── */
  async getAlerts(userId: number) {
    try {
      const today = this.getTodayUtcStart();

      const [upcomingCount, pendingDuesRaw, newMembersToday] =
        await Promise.all([
          this.prisma.membership.count({
            where: {
              userId,
              status: MembershipStatus.ACTIVE,
              endDate: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
            },
          }),
          this.prisma.$queryRaw<PendingDuesRow[]>`
          SELECT COALESCE(SUM(total_pending), 0)::numeric AS total
          FROM (
            SELECT pending AS total_pending FROM "Membership" WHERE "userId" = ${userId} AND pending > 0
            UNION ALL
            SELECT ma.pending AS total_pending
            FROM "MemberAddon" ma
            JOIN "Member" m ON ma."memberId" = m.id
            WHERE m."userId" = ${userId} AND ma.pending > 0
          ) AS dues
        `,
          this.prisma.member.count({
            where: { userId, createdAt: { gte: today } },
          }),
        ]);

      const dues = Number(pendingDuesRaw?.[0]?.total ?? 0) || 0;

      const alerts: Array<Record<string, any>> = [];

      if (upcomingCount) {
        alerts.push({
          type: 'warning',
          priority: 2,
          title: `${upcomingCount} membership${
            upcomingCount > 1 ? 's' : ''
          } expiring in 7 days`,
          count: upcomingCount,
          action: 'Send renewal reminders',
          link: '/memberships?filter=expiring-soon',
        });
      }

      if (dues) {
        alerts.push({
          type: 'danger',
          priority: 1,
          title: `₹${dues.toLocaleString()} in pending dues`,
          count: dues,
          action: 'Collect payments',
          link: '/payments?filter=pending',
        });
      }

      if (newMembersToday) {
        alerts.push({
          type: 'success',
          priority: 3,
          title: `${newMembersToday} new member${
            newMembersToday > 1 ? 's' : ''
          } joined today`,
          count: newMembersToday,
          action: 'Send welcome message',
          link: '/members?filter=today',
        });
      }

      return alerts;
    } catch (err) {
      throw new InternalServerErrorException('Failed to load alerts');
    }
  }

  /* ───────────────────── REVENUE TREND ─────────────────────
   * Returns daily income, expense, and net for the range (last `days` days)
   * date: YYYY-MM-DD, income: number, expense: number, net: number
   */
  async getRevenueTrend(userId: number, days: number) {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // income = payments linked to membership or memberAddon
      // expense = payments linked to expense
      // net = income - expense
      const result = await this.prisma.$queryRaw<
        Array<{
          date: string;
          income: string | number;
          expense: string | number;
          net: string | number;
        }>
      >`
        SELECT
          DATE("paymentDate") AS date,
          COALESCE(SUM(CASE WHEN "expenseId" IS NULL THEN amount ELSE 0 END), 0)::numeric AS income,
          COALESCE(SUM(CASE WHEN "expenseId" IS NOT NULL THEN amount ELSE 0 END), 0)::numeric AS expense,
          COALESCE(SUM(CASE WHEN "expenseId" IS NULL THEN amount ELSE -amount END), 0)::numeric AS net
        FROM "Payment"
        WHERE "userId" = ${userId} AND "paymentDate" >= ${startDate}
        GROUP BY DATE("paymentDate")
        ORDER BY DATE("paymentDate");
      `;

      // convert numeric strings to numbers
      return result.map((r) => ({
        date: r.date,
        income: Number(r.income ?? 0),
        expense: Number(r.expense ?? 0),
        net: Number(r.net ?? 0),
      }));
    } catch (err) {
      throw new InternalServerErrorException('Failed to load revenue trend');
    }
  }

  /* ─────────────────── MEMBERSHIP STATUS ─────────────────── */
  async getMembershipStatus(userId: number) {
    try {
      const result = await this.prisma.membership.groupBy({
        by: ['status'],
        where: { userId },
        _count: { _all: true },
      });
      return result.reduce((acc, cur) => {
        acc[cur.status] = cur._count._all;
        return acc;
      }, {} as Record<string, number>);
    } catch (err) {
      throw new InternalServerErrorException(
        'Failed to load membership status',
      );
    }
  }

  /* ──────────────────── MEMBER GROWTH ──────────────────── */
  async getMemberGrowth(userId: number, months: number) {
    try {
      const startDate = this.getStartOfMonthsAgoUtc(months);

      const result = await this.prisma.$queryRaw<
        Array<{ month: string; newMembers: string | number }>
      >`
        SELECT
          TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon YYYY') AS month,
          COUNT(*)::int AS "newMembers"
        FROM "Member"
        WHERE "userId" = ${userId} AND "createdAt" >= ${startDate}
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY DATE_TRUNC('month', "createdAt");
      `;

      return result.map((r) => ({
        month: r.month,
        newMembers: Number((r as any).newMembers ?? 0),
      }));
    } catch (err) {
      throw new InternalServerErrorException('Failed to load member growth');
    }
  }

  /* ─────────────────── RECENT ACTIVITY ─────────────────── */
  async getRecentActivity(userId: number, limit: number) {
    try {
      const payments = await this.prisma.payment.findMany({
        where: { userId },
        take: limit,
        orderBy: { paymentDate: 'desc' },
        include: {
          membership: {
            include: {
              member: { select: { firstName: true, lastName: true } },
              plan: { select: { name: true } },
            },
          },
          memberAddon: {
            include: {
              member: { select: { firstName: true, lastName: true } },
              addon: { select: { name: true } },
            },
          },
          expense: { select: { title: true } },
        },
      });

      return payments.map((p) => {
        let title = '';
        let type = '';
        let icon = '';
        let link = '';

        if (p.membership) {
          title = `${p.membership.member.firstName} ${p.membership.member.lastName} paid ₹${p.amount} (${p.membership.plan.name})`;
          type = 'payment';
          icon = 'cash';
          link = `/memberships/${p.membershipId}`;
        } else if (p.memberAddon) {
          title = `${p.memberAddon.member.firstName} paid ₹${p.amount} (${p.memberAddon.addon.name})`;
          type = 'addon';
          icon = 'addon';
          link = `/addons/${p.memberAddonId}`;
        } else if (p.expense) {
          title = `Expense: ${p.expense.title} - ₹${p.amount}`;
          type = 'expense';
          icon = 'expense';
          link = `/expenses/${p.expenseId}`;
        }

        const diff = Date.now() - new Date(p.paymentDate).getTime();
        let time = '';
        if (diff < 3_600_000) time = `${Math.floor(diff / 60_000)} min ago`;
        else if (diff < 86_400_000)
          time = `${Math.floor(diff / 3_600_000)} hr ago`;
        else
          time = `${Math.floor(diff / 86_400_000)} day${
            Math.floor(diff / 86_400_000) > 1 ? 's' : ''
          } ago`;

        return { id: p.id, type, icon, title, time, link };
      });
    } catch (err) {
      throw new InternalServerErrorException('Failed to load recent activity');
    }
  }

  /* ───────────────────── TOP PLANS ─────────────────────
   * Single-query implementation that returns top plans by revenue (sum of paid)
   * and member count. Respects `limit`.
   */
  async getTopPlans(userId: number, limit: number) {
    try {
      // single optimized query: join membership -> plan, aggregate count and sum
      const rows = await this.prisma.$queryRaw<
        Array<{
          name: string;
          members: string | number;
          revenue: string | number;
        }>
      >`
        SELECT
          p.name,
          COUNT(m.id)::int AS members,
          COALESCE(SUM(m.paid), 0)::numeric AS revenue
        FROM "Membership" m
        JOIN "Plan" p ON p.id = m."planId"
        WHERE m."userId" = ${userId}
        GROUP BY p.id, p.name
        ORDER BY revenue DESC
        LIMIT ${limit};
      `;

      return rows.map((r) => ({
        name: r.name,
        members: Number((r as any).members ?? 0),
        revenue: Number((r as any).revenue ?? 0),
      }));
    } catch (err) {
      throw new InternalServerErrorException('Failed to load top plans');
    }
  }

  /* ─────────────────── EXPENSES SUMMARY ─────────────────── */
  async getExpensesSummary(userId: number) {
    try {
      const startOfMonth = this.getStartOfMonthUtc();

      const [summary, byCategory] = await Promise.all([
        this.prisma.expense.aggregate({
          where: { userId, expenseDate: { gte: startOfMonth } },
          _sum: { amount: true, paid: true, pending: true },
        }),
        this.prisma.expense.groupBy({
          by: ['category'],
          where: { userId, expenseDate: { gte: startOfMonth } },
          _sum: { amount: true },
        }),
      ]);

      return {
        total: summary._sum.amount ?? 0,
        paid: summary._sum.paid ?? 0,
        pending: summary._sum.pending ?? 0,
        byCategory: byCategory.map((c) => ({
          category: c.category,
          amount: c._sum.amount ?? 0,
        })),
      };
    } catch (err) {
      throw new InternalServerErrorException('Failed to load expenses summary');
    }
  }

  /* ─────────────────── TRAINER WORKLOAD ─────────────────── */
  async getTrainerWorkload(userId: number) {
    try {
      const groups = await this.prisma.memberAddon.groupBy({
        by: ['trainerId'],
        where: {
          member: { userId },
          status: MembershipStatus.ACTIVE,
          trainerId: { not: null },
        },
        _count: { _all: true },
      });

      const trainerIds = groups
        .map((g) => g.trainerId)
        .filter((id): id is number => id !== null);

      const [trainers, totalActiveAddons] = await Promise.all([
        this.prisma.trainer.findMany({
          where: { id: { in: trainerIds }, userId },
          select: { id: true, firstName: true, lastName: true },
        }),
        this.prisma.memberAddon.count({
          where: { member: { userId }, status: MembershipStatus.ACTIVE },
        }),
      ]);

      return groups.map((g) => {
        const trainer = trainers.find((t) => t.id === g.trainerId);
        const count = g._count?._all ?? 0;
        const utilization = totalActiveAddons
          ? Number(((count / totalActiveAddons) * 100).toFixed(1))
          : 0;
        return {
          trainer: trainer
            ? `${trainer.firstName} ${trainer.lastName}`
            : 'Unknown',
          activeAddons: count,
          utilizationPercent: utilization,
        };
      });
    } catch (err) {
      throw new InternalServerErrorException('Failed to load trainer workload');
    }
  }

  /* ────────────────── UPCOMING RENEWALS ────────────────── */
  async getUpcomingRenewals(userId: number, days: number) {
    try {
      const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      const items = await this.prisma.membership.findMany({
        where: {
          userId,
          status: MembershipStatus.ACTIVE,
          endDate: { lte: cutoff, gte: new Date() },
        },
        select: {
          endDate: true,
          pending: true,
          member: { select: { id: true, firstName: true, lastName: true } },
          plan: { select: { name: true } },
        },
        orderBy: { endDate: 'asc' },
      });

      return items.map((i) => ({
        member: {
          id: i.member.id,
          name: `${i.member.firstName} ${i.member.lastName}`,
        },
        plan: i.plan.name,
        endDate: i.endDate.toISOString().split('T')[0],
        pending: i.pending ?? 0,
      }));
    } catch (err) {
      throw new InternalServerErrorException(
        'Failed to load upcoming renewals',
      );
    }
  }
}
