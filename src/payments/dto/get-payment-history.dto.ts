// src/payments/dto/get-payment-history.dto.ts
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsInt,
  Min,
  IsDateString,
  IsEnum,
  Max,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class GetPaymentHistoryDto {
  @ApiProperty({
    description:
      'Filter payments by member ID. Applies to both membership and addon payments.',
    example: 5,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  memberId?: number;

  @ApiProperty({
    description: 'Start date for payment date range (ISO 8601 format)',
    example: '2025-01-01',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'End date for payment date range (ISO 8601 format)',
    example: '2025-12-31',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: 'Filter by payment method',
    enum: PaymentMethod,
    example: PaymentMethod.UPI,
    required: false,
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @ApiProperty({
    description: 'Page number for pagination',
    minimum: 1,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page? = 1;

  @ApiProperty({
    description: 'Number of items per page (max 100)',
    minimum: 1,
    maximum: 100,
    default: 10,
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit? = 10;
}
