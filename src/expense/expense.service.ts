import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { Prisma, PaymentMethod } from '@prisma/client';
interface FindAllFilters {
  id?: string;
  title?: string;
  category?: string;
  amount?: string; // min amount
  status?: 'PENDING' | 'PARTIAL_PAID' | 'PAID';
  date?: string; // YYYY-MM-DD
}
interface FindAllOptions {
  userId: number;
  filters: FindAllFilters;
  pagination: { page: number; limit: number };
}
@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  /* ───────────────────────────────
     CREATE EXPENSE
  ─────────────────────────────── */
  async create(data: CreateExpenseDto, userId: number) {
    try {
      const expense = await this.prisma.expense.create({
        data: {
          userId,
          title: data.title,
          category: data.category,
          amount: data.amount,
          description: data.description,
          paid: 0,
          pending: data.amount,
          status: 'PENDING',
        },
      });

      return {
        success: true,
        message: 'Expense recorded successfully',
        data: expense,
      };
    } catch (error) {
      console.error('Expense creation error:', error);
      if (error instanceof Prisma.PrismaClientKnownRequestError)
        throw new BadRequestException('Database constraint error');
      throw new InternalServerErrorException('Failed to create expense');
    }
  }

  /* ───────────────────────────────
     READ EXPENSES
  ─────────────────────────────── */
  async findAll({ userId, filters, pagination }: FindAllOptions) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const where: any = { userId };

    // Text search (case-insensitive partial match)
    if (filters.id) where.id = parseInt(filters.id, 10);
    if (filters.title)
      where.title = { contains: filters.title, mode: 'insensitive' };
    if (filters.category)
      where.category = { contains: filters.category, mode: 'insensitive' };
    if (filters.status) where.status = filters.status;

    // Date filter (exact date match)
    if (filters.date) {
      const [from, to] = filters.date.split('_');
      if (from && to) {
        where.expenseDate = {
          gte: new Date(from),
          lt: new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000),
        };
      } else if (from) {
        where.expenseDate = {
          gte: new Date(from),
          lt: new Date(new Date(from).getTime() + 24 * 60 * 60 * 1000),
        };
      }
    }

    if (filters.amount) {
      const minAmount = parseFloat(filters.amount);
      if (!isNaN(minAmount)) {
        where.amount = { gte: minAmount };
      }
    }

    // === Parallel Queries: Data + Count + Aggregates ===
    const [data, total, aggregates] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        include: { payments: { orderBy: { paymentDate: 'desc' } } },
        orderBy: { expenseDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.expense.count({ where }),

      // Aggregate sum of amount, paid, and pending
      this.prisma.expense.aggregate({
        where,
        _sum: {
          amount: true,
          paid: true,
          pending: true,
        },
      }),
    ]);

    // === Build Response ===
    const totalAmount = aggregates._sum.amount ?? 0;
    const totalPaid = aggregates._sum.paid ?? 0;
    const totalPending = aggregates._sum.pending ?? 0;

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalAmount: Number(totalAmount.toFixed(2)),
        totalPaid: Number(totalPaid.toFixed(2)),
        totalPending: Number(totalPending.toFixed(2)),
      },
    };
  }

  async findOne(id: number, userId: number) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, userId },
      include: { payments: true },
    });
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  /* ───────────────────────────────
     UPDATE EXPENSE
  ─────────────────────────────── */
  async update(id: number, userId: number, dto: UpdateExpenseDto) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, userId },
    });
    if (!expense) throw new NotFoundException('Expense not found');

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        ...dto,
        expenseDate: dto.expenseDate
          ? new Date(dto.expenseDate)
          : expense.expenseDate,
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Expense updated successfully',
      data: updated,
    };
  }

  /* ───────────────────────────────
     DELETE EXPENSE
  ─────────────────────────────── */
  async delete(id: number, userId: number) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, userId },
    });
    if (!expense) throw new NotFoundException('Expense not found');

    await this.prisma.payment.deleteMany({ where: { expenseId: id } });
    await this.prisma.expense.delete({ where: { id } });

    return {
      success: true,
      message: 'Expense deleted successfully',
    };
  }

  /* ───────────────────────────────
     ADD PAYMENT TO EXPENSE
  ─────────────────────────────── */
  async addPayment(
    id: number,
    userId: number,
    dto: { amount: number; method: PaymentMethod; notes?: string },
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.findFirst({ where: { id, userId } });
      if (!expense) throw new NotFoundException('Expense not found');

      const newPaid = (expense.paid ?? 0) + dto.amount;
      const newPending = Math.max(expense.amount - newPaid, 0);
      const newStatus =
        newPending === 0 ? 'PAID' : newPaid > 0 ? 'PARTIAL_PAID' : 'PENDING';

      // 1️⃣ Create payment record
      await tx.payment.create({
        data: {
          userId,
          expenseId: id,
          amount: -Math.abs(dto.amount), // store as negative for outgoing
          method: dto.method,
          notes: dto.notes || 'Expense payment',
        },
      });

      // 2️⃣ Update expense totals
      const updated = await tx.expense.update({
        where: { id },
        data: {
          paid: newPaid,
          pending: newPending,
          status: newStatus,
          updatedAt: new Date(),
        },
        include: { payments: true },
      });

      return {
        success: true,
        message: 'Expense payment added successfully',
        data: updated,
      };
    });
  }

  /* ───────────────────────────────
     SUMMARY
  ─────────────────────────────── */
  async getSummary(userId: number) {
    const income = await this.prisma.payment.aggregate({
      where: { userId, amount: { gt: 0 } },
      _sum: { amount: true },
    });

    const expenses = await this.prisma.payment.aggregate({
      where: { userId, amount: { lt: 0 } },
      _sum: { amount: true },
    });

    return {
      totalIncome: income._sum.amount ?? 0,
      totalExpense: Math.abs(expenses._sum.amount ?? 0),
      netBalance: (income._sum.amount ?? 0) + (expenses._sum.amount ?? 0),
    };
  }
}
