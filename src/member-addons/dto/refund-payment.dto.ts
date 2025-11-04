// src/member-addons/dto/refund-payment.dto.ts
import { IsNumber, Min, IsEnum, IsOptional } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class RefundPaymentDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  reason?: string;
}
