import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMemberAddonDto } from './dto/create-member-addon.dto';
import { UpdateMemberAddonDto } from './dto/update-member-addon.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { MembershipStatus, Prisma, PaymentMethod } from '@prisma/client';

@Injectable()
export class MemberAddonsService {
  constructor(private prisma: PrismaService) {}

  /* ─────────────────────── CREATE ─────────────────────── */
  async create(data: CreateMemberAddonDto, userId: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const member = await tx.member.findFirst({
          where: { id: data.memberId, userId },
        });
        if (!member) throw new BadRequestException('Member not found');

        const addon = await tx.addon.findFirst({
          where: { id: data.addonId, userId },
        });
        if (!addon) throw new BadRequestException('Addon not found');

        if (data.trainerId) {
          const trainer = await tx.trainer.findFirst({
            where: { id: data.trainerId, userId },
          });
          if (!trainer) throw new BadRequestException('Trainer not found');
        }

        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);

        if (startDate >= endDate)
          throw new BadRequestException('End date must be after start date');
        if (endDate < today)
          throw new BadRequestException('End date cannot be in the past');

        const overlapping = await tx.memberAddon.findFirst({
          where: {
            memberId: data.memberId,
            member: { userId },
            AND: [
              { startDate: { lte: endDate } },
              { endDate: { gte: startDate } },
            ],
          },
        });
        if (overlapping)
          throw new BadRequestException(
            'Addon dates overlap with an existing addon for this member',
          );

        const paid = data.paid ?? 0;
        const discount = data.discount ?? 0;
        const pending = addon.price - (paid + discount);

        const status: MembershipStatus =
          pending <= 0
            ? MembershipStatus.ACTIVE
            : paid > 0
            ? MembershipStatus.PARTIAL_PAID
            : MembershipStatus.INACTIVE;

        const memberAddon = await tx.memberAddon.create({
          data: {
            memberId: data.memberId,
            addonId: data.addonId,
            trainerId: data.trainerId ?? null,
            startDate,
            endDate,
            price: addon.price,
            status,
            paid,
            discount,
            pending,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          include: { addon: true, member: true, trainer: true },
        });

        if (paid > 0) {
          await tx.payment.create({
            data: {
              userId,
              memberAddonId: memberAddon.id,
              amount: paid,
              paymentDate: new Date(),
              createdAt: new Date(),
              method:
                data.method &&
                Object.values(PaymentMethod).includes(data.method)
                  ? data.method
                  : PaymentMethod.CASH,
              notes: 'Initial payment for addon',
            },
          });
        }

        return {
          success: true,
          message: 'Member addon created successfully',
          data: memberAddon,
        };
      });
    } catch (error) {
      console.error('MemberAddon create error:', error);
      if (error instanceof Prisma.PrismaClientKnownRequestError)
        throw new BadRequestException('Database constraint error');
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to create member addon');
    }
  }

  /* ─────────────────────── READ ─────────────────────── */
  async findAll(userId: number) {
    return this.prisma.memberAddon.findMany({
      where: { member: { userId } },
      include: {
        addon: true,
        member: true,
        trainer: true,
        payments: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, userId: number) {
    const addon = await this.prisma.memberAddon.findFirst({
      where: { id, member: { userId } },
      include: {
        addon: true,
        member: true,
        trainer: true,
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!addon) throw new NotFoundException('Member addon not found');
    return addon;
  }

  /* ─────────────────────── UPDATE ─────────────────────── */
  async update(id: number, data: UpdateMemberAddonDto, userId: number) {
    const addon = await this.prisma.memberAddon.findFirst({
      where: { id, member: { userId } },
      include: { addon: true },
    });
    if (!addon) throw new NotFoundException('Member addon not found');

    const updates: Prisma.MemberAddonUpdateInput = {
      ...data,
      updatedAt: new Date(),
    };

    // ---- Date / Addon / Trainer Change Logic ----
    if (data.startDate || data.endDate || data.addonId || data.trainerId) {
      const startDate = data.startDate
        ? new Date(data.startDate)
        : addon.startDate;
      const endDate = data.endDate ? new Date(data.endDate) : addon.endDate;

      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);

      if (startDate >= endDate)
        throw new BadRequestException('End date must be after start date');

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (endDate < today)
        throw new BadRequestException('End date cannot be in the past');

      const overlapping = await this.prisma.memberAddon.findFirst({
        where: {
          memberId: addon.memberId,
          member: { userId },
          id: { not: id },
          AND: [
            { startDate: { lte: endDate } },
            { endDate: { gte: startDate } },
          ],
        },
      });
      if (overlapping)
        throw new BadRequestException(
          'Updated dates overlap with another addon',
        );

      // ---- Addon Change ----
      if (data.addonId && data.addonId !== addon.addonId) {
        const newAddon = await this.prisma.addon.findFirst({
          where: { id: data.addonId, userId },
        });
        if (!newAddon) throw new BadRequestException('Addon not found');

        const totalPaidAndDiscount = (addon.paid ?? 0) + (addon.discount ?? 0);
        const newPending = newAddon.price - totalPaidAndDiscount;

        updates.price = newAddon.price;
        updates.pending = newPending > 0 ? newPending : 0;
        updates.status =
          newPending <= 0 ? MembershipStatus.ACTIVE : MembershipStatus.INACTIVE;
      }

      // ---- Trainer Change ----
      if (data.trainerId !== undefined && data.trainerId !== addon.trainerId) {
        if (data.trainerId) {
          const trainer = await this.prisma.trainer.findFirst({
            where: { id: data.trainerId, userId },
          });
          if (!trainer) throw new BadRequestException('Trainer not found');
          updates.trainer = { connect: { id: data.trainerId } };
        } else {
          updates.trainer = { disconnect: true };
        }
      }
    }

    return this.prisma.memberAddon.update({
      where: { id },
      data: updates,
      include: { addon: true, member: true, trainer: true, payments: true },
    });
  }

  /* ─────────────────────── REFUND ─────────────────────── */
  async refund(addonId: number, userId: number, dto: RefundPaymentDto) {
    return this.prisma.$transaction(async (tx) => {
      const addon = await tx.memberAddon.findFirst({
        where: { id: addonId, member: { userId } },
        include: { payments: true },
      });
      if (!addon) throw new NotFoundException('Member addon not found');

      const currentPaid = addon.paid ?? 0;
      if (dto.amount > currentPaid)
        throw new BadRequestException('Refund amount cannot exceed total paid');

      const newPaid = currentPaid - dto.amount;
      const newPending = addon.price - newPaid - (addon.discount ?? 0);
      const newStatus =
        newPending <= 0
          ? MembershipStatus.ACTIVE
          : newPaid > 0
          ? MembershipStatus.PARTIAL_PAID
          : MembershipStatus.INACTIVE;

      const refund = await tx.payment.create({
        data: {
          userId,
          memberAddonId: addonId,
          amount: -dto.amount,
          paymentDate: new Date(),
          createdAt: new Date(),
          method: dto.method ?? PaymentMethod.CASH,
          notes: dto.reason ? `Refund: ${dto.reason}` : 'Refund issued',
        },
      });

      const updated = await tx.memberAddon.update({
        where: { id: addonId },
        data: {
          paid: newPaid,
          pending: newPending > 0 ? newPending : 0,
          status: newStatus,
          updatedAt: new Date(),
        },
        include: {
          addon: true,
          member: true,
          trainer: true,
          payments: { orderBy: { createdAt: 'desc' } },
        },
      });

      return {
        success: true,
        message: 'Refund processed successfully',
        data: { refund, addon: updated },
      };
    });
  }

  /* ─────────────────────── ADD PAYMENT ─────────────────────── */
  async addPayment(
    id: number,
    userId: number,
    data: {
      amount?: number;
      discount?: number;
      method?: keyof typeof PaymentMethod;
      status?: keyof typeof MembershipStatus;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const addon = await tx.memberAddon.findFirst({
        where: { id, member: { userId } },
      });
      if (!addon) throw new NotFoundException('Member addon not found');

      let newPaid = addon.paid ?? 0;
      let newDiscount = addon.discount ?? 0;
      let newPending = addon.price - newPaid - newDiscount;
      let newStatus = addon.status;

      if (data.amount && data.amount > 0 && data.method) {
        const additionalPaid = data.amount;
        const additionalDiscount = data.discount ?? 0;

        newPaid += additionalPaid;
        newDiscount += additionalDiscount;
        newPending = addon.price - (newPaid + newDiscount);

        if (newPending <= 0) newStatus = MembershipStatus.ACTIVE;
        else if (newPending > 0 && newPaid > 0)
          newStatus =
            data.status === 'PARTIAL_PAID'
              ? MembershipStatus.PARTIAL_PAID
              : MembershipStatus.INACTIVE;

        await tx.payment.create({
          data: {
            userId,
            memberAddonId: addon.id,
            amount: additionalPaid,
            paymentDate: new Date(),
            createdAt: new Date(),
            method: data.method,
            notes: 'Additional payment',
          },
        });
      }

      if (data.status) newStatus = data.status;

      const updated = await tx.memberAddon.update({
        where: { id },
        data: {
          paid: newPaid,
          discount: newDiscount,
          pending: newPending,
          status: newStatus,
          updatedAt: new Date(),
        },
        include: { addon: true, member: true, trainer: true, payments: true },
      });

      return {
        success: true,
        message: 'Addon payment updated successfully',
        data: updated,
      };
    });
  }

  /* ─────────────────────── DELETE ─────────────────────── */
  async delete(id: number, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const addon = await tx.memberAddon.findFirst({
        where: { id, member: { userId } },
      });
      if (!addon) throw new NotFoundException('Member addon not found');

      await tx.payment.deleteMany({
        where: { memberAddonId: id, userId },
      });

      await tx.memberAddon.delete({ where: { id } });

      return { success: true, message: 'Member addon deleted successfully' };
    });
  }
}
