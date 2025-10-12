import {
  IsInt,
  IsDateString,
  IsOptional,
  IsNumber,
  Min,
  IsEnum,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreateMembershipDto {
  @IsInt()
  memberId!: number;

  @IsInt()
  planId!: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsNumber()
  @Min(0)
  paid!: number;

  @IsNumber()
  @Min(0)
  discount!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pending?: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod; // <- add this
}
