// src/memberships/memberships.controller.ts
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
import { MembershipsService } from './memberships.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { MembershipStatus, PaymentMethod } from '@prisma/client';
import { JwtAuthGuard } from '../auth/auth.guard';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';

interface AuthRequest extends Request {
  user: {
    id: number;
  };
}

@UseGuards(JwtAuthGuard)
@Controller('memberships')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(@Body() dto: CreateMembershipDto, @Req() req: AuthRequest) {
    try {
      return await this.membershipsService.create(dto, req.user.id);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        'Unable to assign membership plan',
      );
    }
  }

  @Get()
  async findAll(@Req() req: AuthRequest) {
    return this.membershipsService.findAll(req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: AuthRequest) {
    const parsedId = Number(id);
    if (isNaN(parsedId)) throw new BadRequestException('Invalid ID');
    return this.membershipsService.findOne(parsedId, req.user.id);
  }

  @Get('download-bill/:id')
  async downloadBill(
    @Param('id') id: string,
    @Res() res: Response,
    @Req() req: AuthRequest,
  ) {
    const parsedId = Number(id);
    if (isNaN(parsedId)) throw new BadRequestException('Invalid membership ID');

    const membership = await this.membershipsService.findOne(
      parsedId,
      req.user.id,
    );
    if (!membership) throw new BadRequestException('Membership not found');

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=bill_${membership.id}.pdf`,
    );
    doc.pipe(res);

    // Header
    doc
      .fontSize(22)
      .fillColor('#000')
      .text('Membership Bill', { align: 'center', underline: true });
    doc.moveDown(1.5);

    // Member Info
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .text('Member Information', { underline: true })
      .moveDown(0.5)
      .font('Helvetica')
      .fontSize(12)
      .text(
        `Name: ${membership.member.firstName} ${membership.member.lastName}`,
      )
      .text(`Email: ${membership.member.email}`)
      .text(`Phone: ${membership.member.phone}`)
      .text(`Address: ${membership.member.address || 'N/A'}`)
      .moveDown(1);

    // Plan Info
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .text('Plan Details', { underline: true })
      .moveDown(0.5)
      .font('Helvetica')
      .fontSize(12)
      .text(`Plan Name: ${membership.plan.name}`)
      .text(`Description: ${membership.plan.description || 'N/A'}`)
      .text(`Price: ₹${membership.plan.price}`)
      .text(`Duration: ${membership.plan.durationDays} days`)
      .text(
        `Start Date: ${new Date(membership.startDate).toLocaleDateString()}`,
      )
      .text(`End Date: ${new Date(membership.endDate).toLocaleDateString()}`)
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
    headers.forEach((header, i) => {
      doc.text(header, x + 5, tableTop + 8, { width: columnWidths[i] });
      x += columnWidths[i];
    });

    let y = tableTop + rowHeight;
    doc.font('Helvetica').fontSize(12);
    membership.payments.forEach((p, i) => {
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

      const rowData = [
        i + 1,
        displayAmount,
        new Date(p.paymentDate).toLocaleDateString(),
        displayMethod,
      ];

      let colX = startX;
      rowData.forEach((data, j) => {
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
      .text(`Total Paid: ₹${membership.paid}`)
      .text(`Pending Amount: ₹${membership.pending}`)
      .text(`Discount: ₹${membership.discount}`)
      .text(`Status: ${membership.status}`)
      .moveDown(2)
      .font('Helvetica-Oblique')
      .fontSize(10)
      .fillColor('gray')
      .text('Thank you for choosing our services!', { align: 'center' });

    doc.end();
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async updateMembership(
    @Param('id') id: string,
    @Body() dto: UpdateMembershipDto,
    @Req() req: AuthRequest,
  ) {
    const parsedId = Number(id);
    if (isNaN(parsedId)) throw new BadRequestException('Invalid ID');

    try {
      return await this.membershipsService.updateMembership(
        parsedId,
        dto,
        req.user.id,
      );
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to update membership');
    }
  }

  @Post(':id/refund')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async refundPayment(
    @Param('id') id: string,
    @Body() dto: RefundPaymentDto,
    @Req() req: AuthRequest,
  ) {
    const parsedId = Number(id);
    if (isNaN(parsedId)) throw new BadRequestException('Invalid membership ID');

    try {
      return await this.membershipsService.refundPayment(
        parsedId,
        req.user.id,
        dto,
      );
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to process refund');
    }
  }

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
    const parsedId = Number(id);
    if (isNaN(parsedId)) throw new BadRequestException('Invalid ID');

    return this.membershipsService.addPayment(parsedId, req.user.id, {
      amount: body.amount,
      discount: body.discount,
      method: body.method as keyof typeof PaymentMethod,
      status: body.status as keyof typeof MembershipStatus,
    });
  }

  @Delete(':id')
  async deleteMembership(@Param('id') id: string, @Req() req: AuthRequest) {
    const parsedId = Number(id);
    if (isNaN(parsedId)) throw new BadRequestException('Invalid membership ID');

    try {
      return await this.membershipsService.deleteMembership(
        parsedId,
        req.user.id,
      );
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to delete membership');
    }
  }
}
