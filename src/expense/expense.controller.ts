import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  BadRequestException,
  InternalServerErrorException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ExpensesService } from './expense.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PaymentMethod } from '@prisma/client';

interface AuthRequest extends Request {
  user: { id: number };
}

@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  /* ───────────────────────────────
     CREATE EXPENSE
  ─────────────────────────────── */
  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(@Body() dto: CreateExpenseDto, @Req() req: AuthRequest) {
    try {
      return await this.expensesService.create(dto, req.user.id);
    } catch (error) {
      console.error('Error creating expense:', error);
      throw new InternalServerErrorException('Failed to record expense');
    }
  }

  /* ───────────────────────────────
     GET ALL EXPENSES
  ─────────────────────────────── */
  @Get()
  async findAll(@Req() req: AuthRequest) {
    return this.expensesService.findAll(req.user.id);
  }

  /* ───────────────────────────────
     GET ONE EXPENSE
  ─────────────────────────────── */
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: AuthRequest) {
    const parsedId = Number(id);
    if (isNaN(parsedId)) throw new BadRequestException('Invalid expense ID');
    return this.expensesService.findOne(parsedId, req.user.id);
  }

  /* ───────────────────────────────
     UPDATE EXPENSE
  ─────────────────────────────── */
  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
    @Req() req: AuthRequest,
  ) {
    const parsedId = Number(id);
    if (isNaN(parsedId)) throw new BadRequestException('Invalid expense ID');
    return this.expensesService.update(parsedId, req.user.id, dto);
  }

  /* ───────────────────────────────
     ADD PAYMENT TO EXPENSE
  ─────────────────────────────── */
  @Patch(':id/payment')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async addPayment(
    @Param('id') id: string,
    @Body()
    body: {
      amount: number;
      method: keyof typeof PaymentMethod;
      notes?: string;
    },
    @Req() req: AuthRequest,
  ) {
    const parsedId = Number(id);
    if (isNaN(parsedId)) throw new BadRequestException('Invalid expense ID');

    if (!body.amount || isNaN(body.amount) || body.amount <= 0)
      throw new BadRequestException('Amount must be a positive number');

    return this.expensesService.addPayment(parsedId, req.user.id, {
      amount: body.amount,
      method: body.method as PaymentMethod,
      notes: body.notes,
    });
  }

  /* ───────────────────────────────
     DELETE EXPENSE
  ─────────────────────────────── */
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: AuthRequest) {
    const parsedId = Number(id);
    if (isNaN(parsedId)) throw new BadRequestException('Invalid expense ID');
    return this.expensesService.delete(parsedId, req.user.id);
  }

  /* ───────────────────────────────
     GET SUMMARY
  ─────────────────────────────── */
  @Get('summary')
  async getSummary(@Req() req: AuthRequest) {
    return this.expensesService.getSummary(req.user.id);
  }
}
