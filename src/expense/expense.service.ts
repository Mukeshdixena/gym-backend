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
  async findAll(userId: number) {
    return this.prisma.expense.findMany({
      where: { userId },
      orderBy: { expenseDate: 'desc' },
      include: { payments: true },
    });
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
