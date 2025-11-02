// src/memberships/dto/refund-payment.dto.ts
import { IsNumber, IsOptional, Min, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class RefundPaymentDto {
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount!: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsIn(['CASH', 'CARD', 'UPI', 'ONLINE'])
  method?: string;
}
