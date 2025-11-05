// src/payments/payments.controller.ts
import {
  Controller,
  Get,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { GetPaymentHistoryDto } from './dto/get-payment-history.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PaginatedDto } from '../common/dto/paginated.dto';

interface AuthRequest extends Request {
  user: { id: number };
}

@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('history')
  async getPaymentHistory(
    @Req() req: AuthRequest,
    @Query() query: PaginatedDto,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('User not authenticated');

    const result = await this.paymentsService.findAllPaginated(userId, query);
    return {
      success: true,
      message: 'Payment history fetched successfully',
      data: result.data,
      meta: result.meta,
    };
  }
}
