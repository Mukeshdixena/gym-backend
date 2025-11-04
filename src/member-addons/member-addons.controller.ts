// src/member-addons/member-addons.controller.ts
import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Patch,
  BadRequestException,
  InternalServerErrorException,
  UsePipes,
  ValidationPipe,
  Res,
  UseGuards,
  Req,
  Delete,
} from '@nestjs/common';
import { MemberAddonsService } from './member-addons.service';
import { CreateMemberAddonDto } from './dto/create-member-addon.dto';
import { UpdateMemberAddonDto } from './dto/update-member-addon.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { MembershipStatus, PaymentMethod } from '@prisma/client';
import { JwtAuthGuard } from '../auth/auth.guard';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';

interface AuthRequest extends Request {
  user: { id: number };
}

@UseGuards(JwtAuthGuard)
@Controller('member-addons')
export class MemberAddonsController {
  constructor(private readonly service: MemberAddonsService) {}

  // ── CREATE ─────────────────────────────────────
  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(@Body() dto: CreateMemberAddonDto, @Req() req: AuthRequest) {
    try {
      return await this.service.create(dto, req.user.id);
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new InternalServerErrorException('Unable to assign addon');
    }
  }

  // ── READ ALL ───────────────────────────────────
  @Get()
  async findAll(@Req() req: AuthRequest) {
    return this.service.findAll(req.user.id);
  }

  // ── READ ONE ───────────────────────────────────
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: AuthRequest) {
    const pid = Number(id);
    if (isNaN(pid)) throw new BadRequestException('Invalid ID');
    return this.service.findOne(pid, req.user.id);
  }

  // ── PDF BILL ───────────────────────────────────
  @Get('download-bill/:id')
  async downloadBill(
    @Param('id') id: string,
    @Res() res: Response,
    @Req() req: AuthRequest,
  ) {
    const pid = Number(id);
    if (isNaN(pid)) throw new BadRequestException('Invalid addon ID');

    const addon = await this.service.findOne(pid, req.user.id);
    if (!addon) throw new BadRequestException('Addon not found');

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=addon_bill_${addon.id}.pdf`,
    );
    doc.pipe(res);

    // Header
    doc
      .fontSize(22)
      .fillColor('#000')
      .text('Addon Bill', { align: 'center', underline: true });
    doc.moveDown(1.5);

    // Member Info
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .text('Member Information', { underline: true })
      .moveDown(0.5)
      .font('Helvetica')
      .fontSize(12)
      .text(`Name: ${addon.member.firstName} ${addon.member.lastName}`)
      .text(`Email: ${addon.member.email}`)
      .text(`Phone: ${addon.member.phone}`)
      .text(`Address: ${addon.member.address || 'N/A'}`)
      .moveDown(1);

    // Addon Info
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .text('Addon Details', { underline: true })
      .moveDown(0.5)
      .font('Helvetica')
      .fontSize(12)
      .text(`Addon Name: ${addon.addon.name}`)
      .text(`Description: ${addon.addon.description || 'N/A'}`)
      .text(`Price: ₹${addon.price}`)
      .text(
        `Trainer: ${
          addon.trainer
            ? `${addon.trainer.firstName} ${addon.trainer.lastName}`
            : 'None'
        }`,
      )
      .text(`Start Date: ${new Date(addon.startDate).toLocaleDateString()}`)
      .text(`End Date: ${new Date(addon.endDate).toLocaleDateString()}`)
      .moveDown(1);

    // Payments Table
    const headers = ['No.', 'Amount (₹)', 'Date', 'Method'];
    const startX = 50;
    const columnWidths = [40, 120, 150, 100];
    const rowHeight = 25;
    const tableTop = doc.y;

    doc
      .rect(
        startX,
        tableTop,
        columnWidths.reduce((a, b) => a + b),
        rowHeight,
      )
      .fill('#f2f2f2')
      .stroke();
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(12);
    let x = startX;
    headers.forEach((h, i) => {
      doc.text(h, x + 5, tableTop + 8, { width: columnWidths[i] });
      x += columnWidths[i];
    });

    let y = tableTop + rowHeight;
    doc.font('Helvetica').fontSize(12);
    addon.payments.forEach((p, i) => {
      const isRefund = p.amount < 0;
      const displayAmount = isRefund
        ? `(Refund) ₹${Math.abs(p.amount)}`
        : `₹${p.amount}`;
      const displayMethod = isRefund ? `${p.method} (Refund)` : p.method;

      doc
        .rect(
          startX,
          y,
          columnWidths.reduce((a, b) => a + b),
          rowHeight,
        )
        .stroke();

      const row = [
        i + 1,
        displayAmount,
        new Date(p.paymentDate).toLocaleDateString(),
        displayMethod,
      ];

      let colX = startX;
      row.forEach((data, j) => {
        doc
          .fillColor(isRefund ? 'red' : 'black')
          .text(String(data), colX + 5, y + 8, { width: columnWidths[j] });
        colX += columnWidths[j];
      });
      y += rowHeight;
    });

    doc.moveDown(2);

    // Summary
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .text('Summary', { underline: true })
      .moveDown(0.5)
      .font('Helvetica')
      .fontSize(12)
      .text(`Total Paid: ₹${addon.paid}`)
      .text(`Pending Amount: ₹${addon.pending}`)
      .text(`Discount: ₹${addon.discount}`)
      .text(`Status: ${addon.status}`)
      .moveDown(2)
      .font('Helvetica-Oblique')
      .fontSize(10)
      .fillColor('gray')
      .text('Thank you for choosing our services!', { align: 'center' });

    doc.end();
  }

  // ── UPDATE ─────────────────────────────────────
  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMemberAddonDto,
    @Req() req: AuthRequest,
  ) {
    const pid = Number(id);
    if (isNaN(pid)) throw new BadRequestException('Invalid ID');
    try {
      return await this.service.update(pid, dto, req.user.id);
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new InternalServerErrorException('Failed to update addon');
    }
  }

  // ── REFUND ─────────────────────────────────────
  @Post(':id/refund')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async refund(
    @Param('id') id: string,
    @Body() dto: RefundPaymentDto,
    @Req() req: AuthRequest,
  ) {
    const pid = Number(id);
    if (isNaN(pid)) throw new BadRequestException('Invalid addon ID');
    try {
      return await this.service.refund(pid, req.user.id, dto);
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new InternalServerErrorException('Failed to process refund');
    }
  }

  // ── ADD PAYMENT ─────────────────────────────────
  @Patch('payment/:id')
  async addPayment(
    @Param('id') id: string,
    @Body()
    body: {
      amount?: number;
      discount?: number;
      method?: string;
      status?: string;
    },
    @Req() req: AuthRequest,
  ) {
    const pid = Number(id);
    if (isNaN(pid)) throw new BadRequestException('Invalid ID');

    return this.service.addPayment(pid, req.user.id, {
      amount: body.amount,
      discount: body.discount,
      method: body.method as keyof typeof PaymentMethod,
      status: body.status as keyof typeof MembershipStatus,
    });
  }

  // ── DELETE ─────────────────────────────────────
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: AuthRequest) {
    const pid = Number(id);
    if (isNaN(pid)) throw new BadRequestException('Invalid addon ID');
    try {
      return await this.service.delete(pid, req.user.id);
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new InternalServerErrorException('Failed to delete addon');
    }
  }
}
