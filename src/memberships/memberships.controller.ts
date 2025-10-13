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
} from '@nestjs/common';
import { MembershipsService } from './memberships.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { MembershipStatus, PaymentMethod } from '@prisma/client';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';

@Controller('memberships')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(@Body() dto: CreateMembershipDto) {
    try {
      return await this.membershipsService.create(dto);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        'Unable to assign membership plan',
      );
    }
  }

  @Get()
  async findAll() {
    return this.membershipsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const parsedId = Number(id);
    if (isNaN(parsedId)) throw new BadRequestException('Invalid ID');
    return this.membershipsService.findOne(parsedId);
  }

  @Get('download-bill/:id')
  async downloadBill(@Param('id') id: string, @Res() res: Response) {
    const parsedId = Number(id);
    if (isNaN(parsedId)) throw new BadRequestException('Invalid membership ID');

    const membership = await this.membershipsService.findOne(parsedId);
    if (!membership) throw new BadRequestException('Membership not found');

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=bill_${membership.id}.pdf`,
    );

    doc.pipe(res);

    // ========== HEADER ==========
    doc
      .fontSize(22)
      .fillColor('#000')
      .text('Membership Bill', { align: 'center', underline: true });
    doc.moveDown(1.5);

    // ========== MEMBER INFO ==========
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .text('Member Information', { underline: true });
    doc.moveDown(0.5);

    doc.font('Helvetica').fontSize(12);
    doc.text(
      `Name: ${membership.member.firstName} ${membership.member.lastName}`,
    );
    doc.text(`Email: ${membership.member.email}`);
    doc.text(`Phone: ${membership.member.phone}`);
    doc.text(`Address: ${membership.member.address}`);
    doc.moveDown(1);

    // ========== PLAN INFO ==========
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .text('Plan Details', { underline: true });
    doc.moveDown(0.5);

    doc.font('Helvetica').fontSize(12);
    doc.text(`Plan Name: ${membership.plan.name}`);
    doc.text(`Description: ${membership.plan.description}`);
    doc.text(`Price: ₹${membership.plan.price}`);
    doc.text(`Duration: ${membership.plan.durationDays} days`);
    doc.text(
      `Start Date: ${new Date(membership.startDate).toLocaleDateString()}`,
    );
    doc.text(`End Date: ${new Date(membership.endDate).toLocaleDateString()}`);
    doc.moveDown(1);

    // ========== PAYMENTS TABLE ==========
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .text('Payments', { underline: true });
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const startX = 50;
    const columnWidths = [40, 120, 150, 100];
    const rowHeight = 25;
    const headers = ['No.', 'Amount (₹)', 'Date', 'Method'];

    // --- Draw Table Header Background ---
    doc
      .rect(
        startX,
        tableTop,
        columnWidths.reduce((a, b) => a + b),
        rowHeight,
      )
      .fill('#f2f2f2')
      .stroke();

    // --- Draw Header Text ---
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(12);
    let x = startX;
    headers.forEach((header, i) => {
      doc.text(header, x + 5, tableTop + 8, {
        width: columnWidths[i],
        align: 'left',
      });
      x += columnWidths[i];
    });

    // --- Draw Rows ---
    let y = tableTop + rowHeight;
    doc.font('Helvetica').fontSize(12);
    membership.payments.forEach((p, i) => {
      // Row border
      doc
        .rect(
          startX,
          y,
          columnWidths.reduce((a, b) => a + b),
          rowHeight,
        )
        .stroke();

      // Row data
      let colX = startX;
      const rowData = [
        i + 1,
        `₹${p.amount}`,
        new Date(p.paymentDate).toLocaleDateString(),
        p.method,
      ];

      rowData.forEach((data, j) => {
        doc.text(String(data), colX + 5, y + 8, {
          width: columnWidths[j],
          align: 'left',
        });
        colX += columnWidths[j];
      });

      y += rowHeight;
    });

    doc.moveDown(2);

    // ========== SUMMARY ==========
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .text('Summary', { underline: true });
    doc.moveDown(0.5);

    doc.font('Helvetica').fontSize(12);
    doc.text(`Total Paid: ₹${membership.paid}`);
    doc.text(`Pending Amount: ₹${membership.pending}`);
    doc.text(`Discount: ₹${membership.discount}`);
    doc.text(`Status: ${membership.status}`);
    doc.moveDown(2);

    // ========== FOOTER ==========
    doc
      .font('Helvetica-Oblique')
      .fontSize(10)
      .fillColor('gray')
      .text('Thank you for choosing our services!', { align: 'center' });

    doc.end();
  }

  @Patch(':id')
  async updateMembership(
    @Param('id') id: string,
    @Body() dto: UpdateMembershipDto,
  ) {
    const parsedId = Number(id);
    if (isNaN(parsedId)) throw new BadRequestException('Invalid ID');

    try {
      return await this.membershipsService.updateMembership(parsedId, dto);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to update membership');
    }
  }

  @Patch('payment/:id')
  async addPayment(
    @Param('id') id: string,
    @Body()
    body: {
      amount?: number; // optional now
      discount?: number;
      method?: string; // optional now
      status?: string; // optional
    },
  ) {
    const parsedId = Number(id);
    if (isNaN(parsedId)) throw new BadRequestException('Invalid ID');

    return this.membershipsService.addPayment(parsedId, {
      amount: body.amount,
      discount: body.discount,
      method: body.method as keyof typeof PaymentMethod,
      status: body.status as keyof typeof MembershipStatus,
    });
  }
}
