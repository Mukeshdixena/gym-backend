// src/payments/payments.controller.ts
import {
  Controller,
  Get,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Req,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { GetPaymentHistoryDto } from './dto/get-payment-history.dto';
import { JwtAuthGuard } from '../auth/auth.guard';

interface AuthRequest extends Request {
  user: { id: number };
}

@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('history')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async getHistory(
    @Query() filters: GetPaymentHistoryDto,
    @Req() req: AuthRequest,
  ) {
    return this.paymentsService.getPaymentHistory(req.user.id, filters);
  }
}
