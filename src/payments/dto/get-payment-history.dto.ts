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
import { Transform } from 'class-transformer';

// Proper enum
export enum PaymentType {
  MEMBERSHIP = 'membership',
  ADDON = 'addon',
  EXPENSE = 'expense',
}

export class GetPaymentHistoryDto extends PaginatedDto {
  @IsOptional()
  @IsString()
  search?: string;

  @ValidateIf((o) => o.startDate !== '' && o.startDate != null)
  @IsISO8601({}, { message: 'startDate must be a valid ISO 8601 date string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  startDate?: string;

  @ValidateIf((o) => o.endDate !== '' && o.endDate != null)
  @IsISO8601({}, { message: 'endDate must be a valid ISO 8601 date string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  endDate?: string;

  @ValidateIf((o) => o.method !== '' && o.method != null)
  @IsEnum(PaymentMethod, {
    message:
      'method must be one of the following values: CASH, CARD, UPI, ONLINE',
  })
  method?: PaymentMethod;

  @IsOptional()
  @ValidateIf((o) => o.type !== '' && o.type != null)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsEnum(PaymentType, {
    message:
      'type must be one of the following values: membership, addon, expense',
  })
  type?: PaymentType;
}
