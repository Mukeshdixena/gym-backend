// src/payments/dto/get-payment-history.dto.ts
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsInt,
  Min,
  IsDateString,
  IsEnum,
  IsPositive,
  Max, // ← NEW
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger'; // optional – for Swagger docs

export class GetPaymentHistoryDto {
  @ApiProperty({ example: 5, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  memberId?: number;

  @ApiProperty({ example: '2025-01-01', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ example: '2025-12-31', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ enum: PaymentMethod, required: false })
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @ApiProperty({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({ example: 10, minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100) // ← NOW RESOLVED
  @Type(() => Number)
  limit?: number = 10;
}
