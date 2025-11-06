// src/payments/dto/get-payment-history.dto.ts
import { PaginatedDto } from '../../common/dto/paginated.dto';
import {
  IsOptional,
  IsEnum,
  IsISO8601,
  IsString,
  ValidateIf,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class GetPaymentHistoryDto extends PaginatedDto {
  @IsOptional()
  @IsString()
  search?: string;

  @ValidateIf((o) => o.startDate !== '')
  @IsISO8601({}, { message: 'startDate must be a valid ISO 8601 date string' })
  startDate?: string;

  @ValidateIf((o) => o.endDate !== '')
  @IsISO8601({}, { message: 'endDate must be a valid ISO 8601 date string' })
  endDate?: string;

  @ValidateIf((o) => o.method !== '')
  @IsEnum(PaymentMethod, {
    message:
      'method must be one of the following values: CASH, CARD, UPI, ONLINE',
  })
  method?: PaymentMethod;
}
